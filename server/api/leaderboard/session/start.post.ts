// server/api/leaderboard/session/start.post.ts
import { createError, getHeader, getRequestIP, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

type DeviceType = 'Mobile' | 'PC' | 'Emulator'

function normalizeDeviceType(input: unknown): DeviceType | null {
  const value = String(input || '').trim()
  if (value === 'Mobile' || value === 'PC' || value === 'Emulator') return value
  return null
}

function nowIso() {
  return new Date().toISOString()
}

function addMinutesIso(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user

  if (authErr || !user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Login required'
    })
  }

  const body = await readBody(event)

  const gameSlug = String(body?.gameSlug || '').trim()
  const deviceType = normalizeDeviceType(body?.deviceType)
  const forceNew = Boolean(body?.forceNew)

  if (!gameSlug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing gameSlug'
    })
  }

  const ip =
    getRequestIP(event, { xForwardedFor: true }) ||
    getHeader(event, 'x-forwarded-for') ||
    null

  const userAgent = getHeader(event, 'user-agent') || null
  const startedAt = nowIso()
  const expiresAt = addMinutesIso(120)

  if (!forceNew) {
    const { data: existing, error: existingErr } = await client
      .from('leaderboard_run_sessions')
      .select('id, session_nonce, started_at, expires_at, status, device_type')
      .eq('user_id', user.id)
      .eq('game_slug', gameSlug)
      .eq('status', 'active')
      .gt('expires_at', startedAt)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingErr) {
      throw createError({
        statusCode: 500,
        statusMessage: existingErr.message
      })
    }

    if (existing) {
      if (!existing.device_type && deviceType) {
        const { error: updateErr } = await client
          .from('leaderboard_run_sessions')
          .update({
            device_type: deviceType
          })
          .eq('id', existing.id)
          .eq('user_id', user.id)

        if (updateErr) {
          throw createError({
            statusCode: 500,
            statusMessage: updateErr.message
          })
        }
      }

      return {
        ok: true,
        reused: true,
        gameSlug,
        sessionId: existing.id,
        sessionNonce: existing.session_nonce,
        startedAt: existing.started_at,
        expiresAt: existing.expires_at
      }
    }
  }

  const { error: rejectErr } = await client
    .from('leaderboard_run_sessions')
    .update({
      status: 'rejected'
    })
    .eq('user_id', user.id)
    .eq('game_slug', gameSlug)
    .eq('status', 'active')

  if (rejectErr) {
    throw createError({
      statusCode: 500,
      statusMessage: rejectErr.message
    })
  }

  const { data: session, error: insertErr } = await client
    .from('leaderboard_run_sessions')
    .insert({
      user_id: user.id,
      game_slug: gameSlug,
      status: 'active',
      started_at: startedAt,
      expires_at: expiresAt,
      device_type: deviceType,
      ip,
      user_agent: userAgent
    })
    .select('id, session_nonce, started_at, expires_at')
    .single()

  if (insertErr) {
    throw createError({
      statusCode: 500,
      statusMessage: insertErr.message
    })
  }

  return {
    ok: true,
    reused: false,
    gameSlug,
    sessionId: session.id,
    sessionNonce: session.session_nonce,
    startedAt: session.started_at,
    expiresAt: session.expires_at
  }
})