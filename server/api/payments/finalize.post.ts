// server/api/payments/finalize.post.ts
import { createError, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

type PaymentRow = {
  user_id: string
  plan_code: string
  amount_bdt: number
  currency: string
  tran_id: string
  val_id: string | null
  applied: boolean
  referral_bonus_used_bdt?: number | null
}

type ProfileReferralRow = {
  referral_bonus_bdt: number | null
  referral_bonus_used_bdt: number | null
}

type UpdatedReferralRow = {
  id: number
  status: 'pending' | 'earned' | 'used'
}

function up(v: unknown) {
  return String(v || '').trim().toUpperCase()
}

function toNum(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function amountsMatch(a: number | null | undefined, b: number | null | undefined) {
  if (a == null || b == null) return false
  return Math.abs(Number(a) - Number(b)) < 0.000001
}

function safeMoney(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n))
}

export default defineEventHandler(async (event) => {
  const sb = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await sb.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  }

  const body = await readBody(event)
  const tran_id = String(body?.tran_id || '').trim()

  if (!tran_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tran_id' })
  }

  const { data: pay, error: payErr } = await sb
    .rpc('get_payment_for_ipn', { p_tran_id: tran_id })
    .single<PaymentRow>()

  if (payErr) {
    throw createError({ statusCode: 500, statusMessage: payErr.message })
  }

  if (!pay) {
    throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
  }

  if (pay.user_id !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'This payment does not belong to you' })
  }

  if (pay.applied) {
    return {
      ok: true,
      alreadyApplied: true,
      active: true
    }
  }

  const val_id = String(pay.val_id || '').trim()

  if (!val_id) {
    return {
      ok: false,
      pending: true,
      message: 'Waiting for payment confirmation from gateway'
    }
  }

  const storeId = process.env.SSLCZ_STORE_ID
  const storePass = process.env.SSLCZ_STORE_PASSWD
  const isLive = process.env.SSLCZ_IS_LIVE === 'true'

  if (!storeId || !storePass) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing SSLCZ_STORE_ID or SSLCZ_STORE_PASSWD'
    })
  }

  const base = isLive
    ? 'https://securepay.sslcommerz.com'
    : 'https://sandbox.sslcommerz.com'

  const validateUrl =
    `${base}/validator/api/validationserverAPI.php` +
    `?val_id=${encodeURIComponent(val_id)}` +
    `&store_id=${encodeURIComponent(storeId)}` +
    `&store_passwd=${encodeURIComponent(storePass)}` +
    `&v=1&format=json`

  let validation: any
  try {
    validation = await $fetch(validateUrl, { method: 'GET' })
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      statusMessage: e?.message || 'SSLCOMMERZ validation request failed'
    })
  }

  const vStatus = up(validation?.status)
  const vTranId = String(validation?.tran_id || '').trim()
  const vCurrency = up(validation?.currency)
  const vAmount = toNum(validation?.amount)

  if (vStatus !== 'VALID' && vStatus !== 'VALIDATED') {
    await sb.rpc('process_sslcommerz_ipn', {
      p_tran_id: tran_id,
      p_val_id: val_id,
      p_raw_ipn: { source: 'finalize', tran_id, user_id: user.id },
      p_raw_validation: validation
    })

    return {
      ok: false,
      pending: false,
      message: 'Payment validation failed'
    }
  }

  if (!vTranId || vTranId !== pay.tran_id) {
    throw createError({ statusCode: 400, statusMessage: 'Validation tran_id mismatch' })
  }

  if (!amountsMatch(pay.amount_bdt, vAmount)) {
    throw createError({ statusCode: 400, statusMessage: 'Validation amount mismatch' })
  }

  if (up(pay.currency) !== vCurrency) {
    throw createError({ statusCode: 400, statusMessage: 'Validation currency mismatch' })
  }

  const { data: rpcData, error: rpcErr } = await sb.rpc('process_sslcommerz_ipn', {
    p_tran_id: tran_id,
    p_val_id: val_id,
    p_raw_ipn: { source: 'finalize', tran_id, user_id: user.id },
    p_raw_validation: validation
  })

  if (rpcErr) {
    throw createError({ statusCode: 500, statusMessage: rpcErr.message })
  }

  const paymentReferralUsed = safeMoney(pay.referral_bonus_used_bdt)

  if (paymentReferralUsed > 0) {
    const { data: profile, error: profileErr } = await sb
      .from('profiles')
      .select('referral_bonus_bdt, referral_bonus_used_bdt')
      .eq('user_id', user.id)
      .maybeSingle<ProfileReferralRow>()

    if (profileErr) {
      throw createError({ statusCode: 500, statusMessage: profileErr.message })
    }

    if (profile) {
      const totalBonus = safeMoney(profile.referral_bonus_bdt)
      const alreadyUsed = safeMoney(profile.referral_bonus_used_bdt)
      const available = Math.max(0, totalBonus - alreadyUsed)
      const consumeNow = Math.min(paymentReferralUsed, available)

      if (consumeNow > 0) {
        const nextUsed = alreadyUsed + consumeNow

        const { error: updErr } = await sb
          .from('profiles')
          .update({
            referral_bonus_used_bdt: nextUsed,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)

        if (updErr) {
          throw createError({ statusCode: 500, statusMessage: updErr.message })
        }
      }
    }
  }

  // Mark pending referral as completed only after successful subscription purchase.
  // We also verify that a row was actually updated.
  const targetStatus: 'used' | 'earned' = paymentReferralUsed > 0 ? 'used' : 'earned'

  const { data: updatedReferral, error: refUpdateErr } = await sb
    .from('user_referrals')
    .update({ status: targetStatus })
    .eq('referred_user_id', user.id)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle<UpdatedReferralRow>()

  if (refUpdateErr) {
    throw createError({ statusCode: 500, statusMessage: refUpdateErr.message })
  }

  return {
    ok: true,
    active: true,
    result: rpcData || null,
    referralStatusUpdated: Boolean(updatedReferral?.id),
    referralStatus: updatedReferral?.status || null
  }
})