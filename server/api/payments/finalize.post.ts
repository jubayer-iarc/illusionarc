import { createError, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

type PaymentRow = {
  user_id: string
  plan_code: string
  amount_bdt: number
  currency: string
  tran_id: string
  val_id: string | null
  status: string
  applied: boolean
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

export default defineEventHandler(async (event) => {
  const sb = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await sb.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  }

  const body = await readBody(event)
  const tran_id = String(body?.tran_id || '').trim()
  const val_id_input = String(body?.val_id || '').trim()

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
    return { ok: true, alreadyApplied: true }
  }

  const val_id = val_id_input || String(pay.val_id || '').trim()
  if (!val_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing val_id' })
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

    throw createError({ statusCode: 400, statusMessage: 'Payment not valid' })
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

  return { ok: true, result: rpcData || null }
})