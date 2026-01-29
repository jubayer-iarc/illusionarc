import { createError, readBody, readRawBody, getHeader } from 'h3'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function readPayload(event: any) {
  const ct = String(getHeader(event, 'content-type') || '').toLowerCase()
  if (ct.includes('application/x-www-form-urlencoded')) {
    const raw = (await readRawBody(event)) || ''
    const sp = new URLSearchParams(raw)
    const obj: Record<string, any> = {}
    for (const [k, v] of sp.entries()) obj[k] = v
    return obj
  }
  // fallback JSON
  return (await readBody(event)) || {}
}

export default defineEventHandler(async (event) => {
  const payload: any = await readPayload(event)

  const tran_id = String(payload?.tran_id || '').trim()
  const val_id = String(payload?.val_id || '').trim()
  const ipnStatus = String(payload?.status || '').toUpperCase()

  if (!tran_id) throw createError({ statusCode: 400, statusMessage: 'Missing tran_id' })

  const sb = serviceClient()

  // Find payment
  const { data: pay, error: payErr } = await sb.from('payments').select('*').eq('tran_id', tran_id).maybeSingle()
  if (payErr || !pay) throw createError({ statusCode: 404, statusMessage: 'Payment not found' })

  // Save IPN payload
  await sb.from('payments').update({ raw_ipn: payload }).eq('tran_id', tran_id)

  // If IPN says not valid, mark and exit early
  if (ipnStatus && ipnStatus !== 'VALID' && ipnStatus !== 'VALIDATED') {
    const newStatus = ipnStatus === 'CANCELLED' ? 'cancelled' : 'failed'
    await sb.from('payments').update({ status: newStatus }).eq('tran_id', tran_id)
    return { ok: true }
  }

  if (!val_id) throw createError({ statusCode: 400, statusMessage: 'Missing val_id' })

  const isLive = process.env.SSLCZ_IS_LIVE === 'true'
  const base = isLive ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com'

  // Validate payment server-to-server
  const validateUrl =
    `${base}/validator/api/validationserverAPI.php` +
    `?val_id=${encodeURIComponent(val_id)}` +
    `&store_id=${encodeURIComponent(process.env.SSLCZ_STORE_ID!)}` +
    `&store_passwd=${encodeURIComponent(process.env.SSLCZ_STORE_PASSWD!)}` +
    `&v=1&format=json`

  const validation: any = await $fetch(validateUrl, { method: 'GET' })
  const vStatus = String(validation?.status || '').toUpperCase()

  // Save validation
  await sb.from('payments')
    .update({ raw_validation: validation, val_id })
    .eq('tran_id', tran_id)

  if (vStatus !== 'VALID' && vStatus !== 'VALIDATED') {
    await sb.from('payments').update({ status: 'failed' }).eq('tran_id', tran_id)
    return { ok: true }
  }

  // Idempotent: avoid double extension
  if (pay.applied) return { ok: true }

  // Mark paid
  await sb.from('payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('tran_id', tran_id)

  // ✅ Extend subscription time (stacking)
  // You must have this RPC that works without auth cookie (takes user_id)
  const { error: rpcErr } = await sb.rpc('activate_subscription_for_user', {
    p_user_id: pay.user_id,
    p_plan_code: pay.plan_code
  })
  if (rpcErr) throw createError({ statusCode: 500, statusMessage: rpcErr.message })

  // Mark applied
  await sb.from('payments').update({ applied: true }).eq('tran_id', tran_id)

  return { ok: true }
})
