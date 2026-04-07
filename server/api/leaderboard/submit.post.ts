import { readBody, createError, getHeader, getRequestIP } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

type ProfileRow = {
  display_name: string | null
}

type SessionRow = {
  id: string
  user_id: string
  game_slug: string
  status: string
  session_nonce: string
  started_at: string | null
  expires_at: string | null
  device_type: 'Mobile' | 'PC' | 'Emulator' | null
}

function normalizeDeviceType(input: unknown): 'Mobile' | 'PC' | 'Emulator' | null {
  const value = String(input || '').trim()
  if (value === 'Mobile' || value === 'PC' || value === 'Emulator') return value
  return null
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user

  if (authErr || !user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  }

  const body = await readBody(event)

  const gameSlug = String(body?.gameSlug ?? '').trim()
  const sessionId = String(body?.sessionId ?? '').trim()
  const sessionNonce = String(body?.sessionNonce ?? '').trim()
  const scoreRaw = Number(body?.score ?? 0)
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.floor(scoreRaw)) : 0
  const meta = body?.meta && typeof body.meta === 'object' ? body.meta : {}
  const submittedDeviceType = normalizeDeviceType(body?.deviceType)

  if (!gameSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing gameSlug' })
  }

  if (!sessionId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sessionId' })
  }

  if (!sessionNonce) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sessionNonce' })
  }

  const ip =
    getRequestIP(event, { xForwardedFor: true }) ||
    getHeader(event, 'x-forwarded-for') ||
    null

  const userAgent = getHeader(event, 'user-agent') || null
  const nowIso = new Date().toISOString()

  const { data: profileData, error: pErr } = await client
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (pErr) {
    throw createError({ statusCode: 500, statusMessage: pErr.message })
  }

  const profile = profileData as ProfileRow | null
  const displayName = String(profile?.display_name ?? '').trim()

  if (!displayName) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Profile missing display_name. Ensure profile row is created for this user.'
    })
  }

  const { data: sessionData, error: sessionErr } = await client
    .from('leaderboard_run_sessions')
    .select('id, user_id, game_slug, status, session_nonce, started_at, expires_at, device_type')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionErr) {
    throw createError({ statusCode: 500, statusMessage: sessionErr.message })
  }

  const session = sessionData as SessionRow | null

  const logSubmission = async (payload: {
    accepted: boolean
    acceptedScore: number | null
    keptBest: boolean
    updatedBest: boolean
    reason: string
  }) => {
    const submissionPayload = {
      game_slug: gameSlug,
      user_id: user.id,
      session_id: sessionId,
      session_nonce: sessionNonce,
      device_type: submittedDeviceType ?? session?.device_type ?? null,
      submitted_score: score,
      accepted: payload.accepted,
      accepted_score: payload.acceptedScore,
      kept_best: payload.keptBest,
      updated_best: payload.updatedBest,
      reason: payload.reason,
      ip,
      user_agent: userAgent,
      meta
    }

    const { error: logErr } = await client
      .from('leaderboard_score_submissions')
      .insert(submissionPayload)

    if (logErr) {
      console.error('[leaderboard/submit] failed to log submission:', logErr.message)
    }
  }

  if (!session) {
    await logSubmission({
      accepted: false,
      acceptedScore: null,
      keptBest: false,
      updatedBest: false,
      reason: 'session_not_found'
    })

    throw createError({ statusCode: 400, statusMessage: 'Invalid session' })
  }

  if (session.user_id !== user.id) {
    await logSubmission({
      accepted: false,
      acceptedScore: null,
      keptBest: false,
      updatedBest: false,
      reason: 'session_user_mismatch'
    })

    throw createError({ statusCode: 403, statusMessage: 'Session does not belong to this user' })
  }

  if (session.game_slug !== gameSlug) {
    await logSubmission({
      accepted: false,
      acceptedScore: null,
      keptBest: false,
      updatedBest: false,
      reason: 'session_game_mismatch'
    })

    throw createError({ statusCode: 400, statusMessage: 'Session game mismatch' })
  }

  if (session.session_nonce !== sessionNonce) {
    await logSubmission({
      accepted: false,
      acceptedScore: null,
      keptBest: false,
      updatedBest: false,
      reason: 'session_nonce_mismatch'
    })

    throw createError({ statusCode: 403, statusMessage: 'Invalid session nonce' })
  }

  if (session.status !== 'active') {
    await logSubmission({
      accepted: false,
      acceptedScore: null,
      keptBest: false,
      updatedBest: false,
      reason: `session_not_active:${session.status}`
    })

    throw createError({ statusCode: 400, statusMessage: 'Session is not active' })
  }

  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    await client
      .from('leaderboard_run_sessions')
      .update({
        status: 'expired',
        updated_at: nowIso
      })
      .eq('id', session.id)
      .eq('user_id', user.id)

    await logSubmission({
      accepted: false,
      acceptedScore: null,
      keptBest: false,
      updatedBest: false,
      reason: 'session_expired'
    })

    throw createError({ statusCode: 400, statusMessage: 'Session expired' })
  }

  if (!session.device_type && submittedDeviceType) {
    const { error: updateDeviceErr } = await client
      .from('leaderboard_run_sessions')
      .update({
        device_type: submittedDeviceType,
        updated_at: nowIso
      })
      .eq('id', session.id)
      .eq('user_id', user.id)

    if (updateDeviceErr) {
      throw createError({ statusCode: 500, statusMessage: updateDeviceErr.message })
    }
  }

  const { error: insertErr } = await client
    .from('leaderboard_scores')
    .insert({
      game_slug: gameSlug,
      user_id: user.id,
      player_name: displayName,
      score
    })

  if (insertErr) {
    throw createError({ statusCode: 500, statusMessage: insertErr.message })
  }

  await logSubmission({
    accepted: true,
    acceptedScore: score,
    keptBest: false,
    updatedBest: false,
    reason: 'accepted_arcade_period_score'
  })

  return {
    ok: true,
    playerName: displayName,
    inserted: true,
    score
  }
})