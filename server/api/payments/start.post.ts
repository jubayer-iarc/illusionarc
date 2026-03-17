// server/api/payments/start.post.ts
import { serverSupabaseClient } from '#supabase/server'
import { createError, readBody } from 'h3'
import crypto from 'node:crypto'

type PlanRow = {
  code: string
  title: string
  duration_days: number
  price_bdt: number
  is_active: boolean
  discount_active: boolean
  discount_price_bdt: number | null
  discount_note: string | null
}

function normalizePlanCode(input: string) {
  const map: Record<string, string> = {
    day: '1d',
    week: '7d',
    month: '30d',
    '1d': '1d',
    '7d': '7d',
    '30d': '30d'
  }
  return map[input] || input
}

function effectivePrice(plan: PlanRow) {
  const dp = plan.discount_price_bdt
  const hasDiscount =
    plan.discount_active === true &&
    dp !== null &&
    Number.isFinite(dp) &&
    dp >= 0 &&
    dp < plan.price_bdt

  return hasDiscount ? dp : plan.price_bdt
}

export default defineEventHandler(async (event) => {
  const sb = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await sb.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  }

  const body = await readBody(event)
  let planCode = String(body?.planCode || '').trim()
  if (!planCode) {
    throw createError({ statusCode: 400, statusMessage: 'Missing planCode' })
  }

  planCode = normalizePlanCode(planCode)

  const { data: plan, error: planErr } = await sb
    .from('subscription_plans')
    .select('code, title, duration_days, price_bdt, is_active, discount_active, discount_price_bdt, discount_note')
    .eq('code', planCode)
    .eq('is_active', true)
    .maybeSingle<PlanRow>()

  if (planErr || !plan) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid plan' })
  }

  const amount_bdt = effectivePrice(plan)

  const tran_id = `IA-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`

  const { error: payErr } = await sb.from('payments').insert({
    user_id: user.id,
    plan_code: plan.code,
    amount_bdt,
    currency: 'BDT',
    provider: 'sslcommerz',
    tran_id,
    status: 'pending'
  })

  if (payErr) {
    throw createError({ statusCode: 500, statusMessage: payErr.message })
  }

  const isLive = process.env.SSLCZ_IS_LIVE === 'true'
  const base = isLive
    ? 'https://securepay.sslcommerz.com'
    : 'https://sandbox.sslcommerz.com'

  const site = String(process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '')
  if (!site) {
    throw createError({ statusCode: 500, statusMessage: 'Missing PUBLIC_SITE_URL' })
  }

  const storeId = process.env.SSLCZ_STORE_ID
  const storePasswd = process.env.SSLCZ_STORE_PASSWD

  if (!storeId || !storePasswd) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing SSLCZ_STORE_ID or SSLCZ_STORE_PASSWD'
    })
  }

  // Keep success page as the place where finalize.post.ts runs
  const success_url = `${site}/payment/success?tran_id=${encodeURIComponent(tran_id)}`
  const fail_url = `${site}/payment/fail?tran_id=${encodeURIComponent(tran_id)}`
  const cancel_url = `${site}/payment/cancel?tran_id=${encodeURIComponent(tran_id)}`
  const ipn_url = `${site}/api/payments/sslcommerz/ipn`

  const params = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePasswd,

    total_amount: String(amount_bdt),
    currency: 'BDT',
    tran_id,

    success_url,
    fail_url,
    cancel_url,
    ipn_url,

    product_name: `Tournament Pass ${plan.code}`,
    product_category: 'Subscription',
    product_profile: 'general',

    shipping_method: 'NO',
    num_of_item: '1',

    cus_name: user.email || 'Customer',
    cus_email: user.email || 'customer@example.com',
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_state: 'Dhaka',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: '01700000000'
  })

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
    await sb
      .from('payments')
      .update({
        status: 'failed'
      })
      .eq('tran_id', tran_id)

    throw createError({
      statusCode: 502,
      statusMessage: e?.message || 'SSLCOMMERZ session request failed'
    })
  }

  console.log('[SSLCOMMERZ session response]', res)

  const gatewayUrl = res?.GatewayPageURL
  const ssl_sessionkey = res?.sessionkey || null

  if (!gatewayUrl) {
    const reason =
      res?.failedreason ||
      res?.failedReason ||
      res?.status ||
      res?.message ||
      'No GatewayPageURL returned'

    await sb
      .from('payments')
      .update({
        status: 'failed',
        ssl_sessionkey
      })
      .eq('tran_id', tran_id)

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create SSLCOMMERZ session: ${reason}`
    })
  }

  const { error: updErr } = await sb
    .from('payments')
    .update({
      ssl_sessionkey
    })
    .eq('tran_id', tran_id)

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }

  return {
    ok: true,
    tran_id,
    gatewayUrl,
    amount_bdt
  }
})