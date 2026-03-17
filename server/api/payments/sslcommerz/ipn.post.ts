// server/api/payments/sslcommerz/ipn.post.ts
import { createError, readBody, readRawBody, getHeader, setResponseStatus } from 'h3'
import { createClient } from '@supabase/supabase-js'

type PaymentLookupRow = {
  user_id: string
  plan_code: string
  amount_bdt: number | null
  currency: string | null
  tran_id: string
}

function publicClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY

  if (!url || !key) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing SUPABASE_URL or SUPABASE_KEY'
    })
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  })
}

async function readPayload(event: any) {
  const ct = String(getHeader(event, 'content-type') || '').toLowerCase()

  if (ct.includes('application/x-www-form-urlencoded')) {
    const raw = (await readRawBody(event, 'utf8')) || ''
    const sp = new URLSearchParams(raw)
    const obj: Record<string, any> = {}
    for (const [k, v] of sp.entries()) obj[k] = v
    return obj
  }

  return (await readBody(event)) || {}
}

function up(v: unknown) {
  return String(v || '').trim().toUpperCase()
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function amountsMatch(a: number | null | undefined, b: number | null | undefined) {
  if (a == null || b == null) return false
  return Math.abs(Number(a) - Number(b)) < 0.000001
}

export default defineEventHandler(async (event) => {
  const payload: any = await readPayload(event)

  const tran_id = String(payload?.tran_id || '').trim()
  const val_id = String(payload?.val_id || '').trim()
  const ipnStatus = up(payload?.status)

  if (!tran_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tran_id' })
  }

  const sb = publicClient()

  // IMPORTANT:
  // With publishable key, this select only works if your RLS allows this route to
  // read the minimum fields needed for the transaction OR you expose a safe view/RPC.
  const { data: pay, error: payErr } = await sb
    .from('payments')
    .select('user_id, plan_code, amount_bdt, currency, tran_id')
    .eq('tran_id', tran_id)
    .maybeSingle<PaymentLookupRow>()

  if (payErr) {
    throw createError({ statusCode: 500, statusMessage: payErr.message })
  }

  if (!pay) {
    throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
  }

  // If IPN itself says failed/cancelled, hand off to RPC to record it safely.
  if (ipnStatus && ipnStatus !== 'VALID' && ipnStatus !== 'VALIDATED') {
    const { error: rpcErr } = await sb.rpc('process_sslcommerz_ipn', {
      p_tran_id: tran_id,
      p_val_id: val_id || null,
      p_user_id: pay.user_id,
      p_plan_code: pay.plan_code,
      p_amount_bdt: pay.amount_bdt,
      p_currency: pay.currency || 'BDT',
      p_raw_ipn: payload,
      p_raw_validation: {
        status: ipnStatus,
        source: 'ipn_non_valid'
      }
    })

    if (rpcErr) {
      throw createError({ statusCode: 500, statusMessage: rpcErr.message })
    }

    setResponseStatus(event, 200)
    return 'OK'
  }

  if (!val_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing val_id' })
  }

  const isLive = process.env.SSLCZ_IS_LIVE === 'true'
  const storeId = process.env.SSLCZ_STORE_ID
  const storePass = process.env.SSLCZ_STORE_PASSWD

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
  const vAmount = num(validation?.amount)

  if (vStatus !== 'VALID' && vStatus !== 'VALIDATED') {
    const { error: rpcErr } = await sb.rpc('process_sslcommerz_ipn', {
      p_tran_id: tran_id,
      p_val_id: val_id,
      p_user_id: pay.user_id,
      p_plan_code: pay.plan_code,
      p_amount_bdt: pay.amount_bdt,
      p_currency: pay.currency || 'BDT',
      p_raw_ipn: payload,
      p_raw_validation: validation
    })

    if (rpcErr) {
      throw createError({ statusCode: 500, statusMessage: rpcErr.message })
    }

    setResponseStatus(event, 200)
    return 'OK'
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

  // Finalize all DB changes inside a single SECURITY DEFINER RPC.
  const { error: rpcErr } = await sb.rpc('process_sslcommerz_ipn', {
    p_tran_id: tran_id,
    p_val_id: val_id,
    p_user_id: pay.user_id,
    p_plan_code: pay.plan_code,
    p_amount_bdt: pay.amount_bdt,
    p_currency: pay.currency || 'BDT',
    p_raw_ipn: payload,
    p_raw_validation: validation
  })

  if (rpcErr) {
    throw createError({ statusCode: 500, statusMessage: rpcErr.message })
  }

  setResponseStatus(event, 200)
  return 'OK'
})