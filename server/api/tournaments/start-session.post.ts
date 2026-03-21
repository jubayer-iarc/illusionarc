// server/api/tournaments/start-session.post.ts
import { readBody, createError, getHeader } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import crypto from 'node:crypto'

type DeviceType = 'Mobile' | 'PC' | 'Emulator'

type WsTicketPayload = {
  sid: string
  nonce: string
  slug: string
  uid: string
  tid: string
  dt: DeviceType
  iat: number
  exp: number
}

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function signWsTicket(payload: WsTicketPayload, secret: string) {
  const encoded = b64url(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest()
  return `${encoded}.${b64url(sig)}`
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const config = useRuntimeConfig()

  const wsTicketSecret = String(
    config.wsTicketSecret ||
    config.resetTicketSecret ||
    ''
  ).trim()

  if (!wsTicketSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing wsTicketSecret'
    })
  }

  /* ---------------- Auth ---------------- */
  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user

  if (authErr || !user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Login required'
    })
  }

  /* ---------------- Body ---------------- */
  const body = await readBody(event)
  const tournamentSlug = String(body?.tournamentSlug || '').trim()

  const rawDeviceType = String(body?.deviceType || '').trim()
  const deviceType: DeviceType =
    rawDeviceType === 'Mobile' ||
    rawDeviceType === 'PC' ||
    rawDeviceType === 'Emulator'
      ? rawDeviceType
      : 'PC'

  if (!tournamentSlug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing tournamentSlug'
    })
  }

  /* ---------------- Subscription Gate ---------------- */
  const { data: hasSub, error: subErr } = await client.rpc(
    'has_active_subscription',
    { p_user_id: user.id }
  )

  if (subErr) {
    throw createError({
      statusCode: 500,
      statusMessage: subErr.message
    })
  }

  if (!hasSub) {
    throw createError({
      statusCode: 402,
      statusMessage: 'Active subscription required to play tournament'
    })
  }

  /* ---------------- Tournament Validation ---------------- */
  const { data: t, error: tErr } = await client
    .from('tournaments')
    .select('id, slug, game_slug, status, starts_at, ends_at')
    .eq('slug', tournamentSlug)
    .maybeSingle()

  if (tErr) {
    throw createError({
      statusCode: 500,
      statusMessage: tErr.message
    })
  }

  if (!t) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tournament not found'
    })
  }

  const nowMs = Date.now()
  const startsAt = new Date(t.starts_at).getTime()
  const endsAt = new Date(t.ends_at).getTime()

  if (
    t.status !== 'live' ||
    !Number.isFinite(startsAt) ||
    !Number.isFinite(endsAt) ||
    nowMs < startsAt ||
    nowMs >= endsAt
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Tournament is not live'
    })
  }

  /* ---------------- Request Info ---------------- */
  const forwardedFor = String(getHeader(event, 'x-forwarded-for') || '').trim()
  const realIp = String(getHeader(event, 'x-real-ip') || '').trim()
  const userAgent = String(getHeader(event, 'user-agent') || '').trim()

  const ip =
    forwardedFor
      .split(',')
      .map((x) => x.trim())
      .find(Boolean) || realIp || null

  /* ---------------- Expire Previous Active Sessions ---------------- */
  const nowIso = new Date(nowMs).toISOString()

  const { error: expireErr } = await client
    .from('tournament_run_sessions')
    .update({
      status: 'expired',
      updated_at: nowIso
    })
    .eq('tournament_id', t.id)
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (expireErr) {
    throw createError({
      statusCode: 500,
      statusMessage: expireErr.message
    })
  }

  /* ---------------- Create New Run Session ---------------- */
  const startedAtIso = nowIso
  const expiresAtMs = nowMs + 2 * 60 * 60 * 1000
  const expiresAtIso = new Date(expiresAtMs).toISOString()

  const { data: inserted, error: insertErr } = await client
    .from('tournament_run_sessions')
    .insert({
      tournament_id: t.id,
      user_id: user.id,
      game_slug: String(t.game_slug || '').trim() || tournamentSlug,
      status: 'active',
      started_at: startedAtIso,
      expires_at: expiresAtIso,
      device_type: deviceType,
      ip,
      user_agent: userAgent || null
    })
    .select('id, session_nonce, started_at, expires_at, status')
    .single()

  if (insertErr) {
    throw createError({
      statusCode: 500,
      statusMessage: insertErr.message
    })
  }

  if (!inserted?.id || !inserted?.session_nonce) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create tournament run session'
    })
  }

  /* ---------------- Signed WebSocket Ticket ---------------- */
  const wsTicketPayload: WsTicketPayload = {
    sid: inserted.id,
    nonce: inserted.session_nonce,
    slug: tournamentSlug,
    uid: user.id,
    tid: t.id,
    dt: deviceType,
    iat: Math.floor(nowMs / 1000),
    exp: Math.floor(expiresAtMs / 1000)
  }

  const wsTicket = signWsTicket(wsTicketPayload, wsTicketSecret)

  return {
    ok: true,
    sessionId: inserted.id,
    sessionNonce: inserted.session_nonce,
    startedAt: inserted.started_at,
    expiresAt: inserted.expires_at,
    status: inserted.status,
    wsTicket,
    wsTicketExp: wsTicketPayload.exp
  }
})