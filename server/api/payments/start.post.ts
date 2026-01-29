// server/api/payments/start.post.ts
import { serverSupabaseClient } from '#supabase/server'
import { createError, readBody } from 'h3'
import crypto from 'node:crypto'

export default defineEventHandler(async (event) => {
  const sb = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await sb.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) throw createError({ statusCode: 401, statusMessage: 'Login required' })

  const body = await readBody(event)
  let planCode = String(body?.planCode || '').trim()
  if (!planCode) throw createError({ statusCode: 400, statusMessage: 'Missing planCode' })

  // Optional safety mapping
  const map: Record<string, string> = { day: '1d', week: '7d', month: '30d', '1d': '1d', '7d': '7d', '30d': '30d' }
  planCode = map[planCode] || planCode

  const { data: plan, error: planErr } = await sb
    .from('subscription_plans')
    .select('code, title, duration_days, price_bdt, is_active')
    .eq('code', planCode)
    .eq('is_active', true)
    .maybeSingle()

  if (planErr || !plan) throw createError({ statusCode: 400, statusMessage: 'Invalid plan' })

  // Create transaction id
  const tran_id = `IA-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`

  // Insert pending payment row (RLS must allow insert for auth user)
  const { error: payErr } = await sb.from('payments').insert({
    user_id: user.id,
    plan_code: plan.code,
    amount_bdt: plan.price_bdt,
    currency: 'BDT',
    provider: 'sslcommerz',
    tran_id,
    status: 'pending'
  })
  if (payErr) throw createError({ statusCode: 500, statusMessage: payErr.message })

  const isLive = process.env.SSLCZ_IS_LIVE === 'true'
  const base = isLive ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com'

  const site = process.env.PUBLIC_SITE_URL
  if (!site) throw createError({ statusCode: 500, statusMessage: 'Missing PUBLIC_SITE_URL' })

  // NOTE: SSLCOMMERZ redirects SUCCESS/FAIL/CANCEL with POST in many cases.
  // We'll handle that in server routes later; session creation still works.
  const success_url = `${site}/payment/success?tran_id=${encodeURIComponent(tran_id)}`
  const fail_url = `${site}/payment/fail?tran_id=${encodeURIComponent(tran_id)}`
  const cancel_url = `${site}/payment/cancel?tran_id=${encodeURIComponent(tran_id)}`
  const ipn_url = `${site}/api/payments/sslcommerz/ipn`

  // ✅ v4 session API expects x-www-form-urlencoded :contentReference[oaicite:3]{index=3}
  // ✅ Some fields are effectively required (shipping_method, num_of_item, product fields) :contentReference[oaicite:4]{index=4}
  const params = new URLSearchParams({
    // Required primary info
    store_id: process.env.SSLCZ_STORE_ID!,
    store_passwd: process.env.SSLCZ_STORE_PASSWD!,
    total_amount: String(plan.price_bdt),
    currency: 'BDT',
    tran_id,
    success_url,
    fail_url,
    cancel_url,
    ipn_url,

    // Required product info
    product_name: `Tournament Pass ${plan.code}`,
    product_category: 'Subscription',
    product_profile: 'general',

    // Shipment (commonly required by v4 integrations)
    shipping_method: 'NO',
    num_of_item: '1',

    // Customer info (keep simple but complete)
    cus_name: user.email || 'Customer',
    cus_email: user.email || 'customer@example.com',
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_state: 'Dhaka',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: '01700000000'
  })

  // Call SSLCOMMERZ session API (Create and Get Session) :contentReference[oaicite:5]{index=5}
  let res: any
  try {
    res = await $fetch(`${base}/gwprocess/v4/api.php`, {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
  } catch (e: any) {
    // if fetch fails (network/timeout), surface it
    throw createError({ statusCode: 502, statusMessage: e?.message || 'SSLCOMMERZ session request failed' })
  }

  // 🔎 Debug: see the exact gateway response in your terminal
  console.log('[SSLCOMMERZ session response]', res)

  const gatewayUrl = res?.GatewayPageURL
  if (!gatewayUrl) {
    // SSLCOMMERZ returns failedreason / status in many cases
    const reason =
      res?.failedreason ||
      res?.failedReason ||
      res?.status ||
      res?.message ||
      'No GatewayPageURL returned'
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create SSLCOMMERZ session: ${reason}`
    })
  }

  // store sessionkey (optional)
  await sb.from('payments').update({ ssl_sessionkey: res?.sessionkey || null }).eq('tran_id', tran_id)

  return { ok: true, tran_id, gatewayUrl }
})
