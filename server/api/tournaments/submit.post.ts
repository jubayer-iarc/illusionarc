// server/api/tournaments/submit.post.ts
import { readBody, createError, getHeader } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

type DeviceType = 'Mobile' | 'PC' | 'Emulator'

type SubmitTournamentScoreRow = {
  ok: boolean
  updated: boolean
  kept_best: boolean
  final_score: number
}

type SubmissionReason =
  | 'accepted'
  | 'best_updated'
  | 'kept_existing_best'
  | 'tournament_not_live'
  | 'invalid_session'
  | 'invalid_session_nonce'
  | 'session_not_active'
  | 'invalid_session_start_time'
  | 'session_expired'
  | 'session_already_used'
  | 'device_type_mismatch'
  | 'replaced_by_newer_session'
  | 'rpc_submit_failed'
  | 'score_save_failed'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
type JsonObject = { [key: string]: JsonValue }

type NormalizedRect = {
  width: number | null
  height: number | null
  top: number | null
  left: number | null
}

type NormalizedScreenCheckpoint = {
  label: string | null
  capturedAt: string | null
  screenWidth: number | null
  screenHeight: number | null
  availWidth: number | null
  availHeight: number | null
  innerWidth: number | null
  innerHeight: number | null
  outerWidth: number | null
  outerHeight: number | null
  clientWidth: number | null
  clientHeight: number | null
  visualViewportWidth: number | null
  visualViewportHeight: number | null
  devicePixelRatio: number | null
  orientation: string | null
  userAgent: string | null
  frameRect: NormalizedRect | null
  containerRect: NormalizedRect | null
  canvasRect: NormalizedRect | null
}

type NormalizedSubmissionMeta = JsonObject & {
  screen_checkpoints?: {
    load: NormalizedScreenCheckpoint | null
    mid: NormalizedScreenCheckpoint | null
    game_over: NormalizedScreenCheckpoint | null
  }
}

function toFiniteNumberOrNull(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toShortStringOrNull(value: unknown, max = 200) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v) return null
  return v.slice(0, max)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeRect(value: unknown): NormalizedRect | null {
  if (!isPlainObject(value)) return null

  return {
    width: toFiniteNumberOrNull(value.width),
    height: toFiniteNumberOrNull(value.height),
    top: toFiniteNumberOrNull(value.top),
    left: toFiniteNumberOrNull(value.left)
  }
}

function normalizeScreenCheckpoint(value: unknown): NormalizedScreenCheckpoint | null {
  if (!isPlainObject(value)) return null

  return {
    label: toShortStringOrNull(value.label, 32),
    capturedAt: toShortStringOrNull(value.capturedAt, 64),
    screenWidth: toFiniteNumberOrNull(value.screenWidth),
    screenHeight: toFiniteNumberOrNull(value.screenHeight),
    availWidth: toFiniteNumberOrNull(value.availWidth),
    availHeight: toFiniteNumberOrNull(value.availHeight),
    innerWidth: toFiniteNumberOrNull(value.innerWidth),
    innerHeight: toFiniteNumberOrNull(value.innerHeight),
    outerWidth: toFiniteNumberOrNull(value.outerWidth),
    outerHeight: toFiniteNumberOrNull(value.outerHeight),
    clientWidth: toFiniteNumberOrNull(value.clientWidth),
    clientHeight: toFiniteNumberOrNull(value.clientHeight),
    visualViewportWidth: toFiniteNumberOrNull(value.visualViewportWidth),
    visualViewportHeight: toFiniteNumberOrNull(value.visualViewportHeight),
    devicePixelRatio: toFiniteNumberOrNull(value.devicePixelRatio),
    orientation: toShortStringOrNull(value.orientation, 64),
    userAgent: toShortStringOrNull(value.userAgent, 600),
    frameRect: normalizeRect(value.frameRect),
    containerRect: normalizeRect(value.containerRect),
    canvasRect: normalizeRect(value.canvasRect)
  }
}

function normalizeIncomingMeta(value: unknown): NormalizedSubmissionMeta {
  const result: NormalizedSubmissionMeta = {}

  if (!isPlainObject(value)) {
    return result
  }

  if (isPlainObject(value.screen_checkpoints)) {
    result.screen_checkpoints = {
      load: normalizeScreenCheckpoint(value.screen_checkpoints.load),
      mid: normalizeScreenCheckpoint(value.screen_checkpoints.mid),
      game_over: normalizeScreenCheckpoint(value.screen_checkpoints.game_over)
    }
  }

  return result
}

function mergeMeta(...parts: Array<Record<string, any> | undefined | null>): JsonObject {
  const out: JsonObject = {}

  for (const part of parts) {
    if (!part || typeof part !== 'object' || Array.isArray(part)) continue

    for (const [key, value] of Object.entries(part)) {
      out[key] = value as JsonValue
    }
  }

  return out
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  const nowIso = () => new Date().toISOString()

  const forwardedFor = getHeader(event, 'x-forwarded-for') || ''
  const userAgent = getHeader(event, 'user-agent') || ''
  const ip = forwardedFor.split(',')[0]?.trim() || null

  async function logSubmission(payload: {
    tournamentId: string
    userId: string
    sessionId?: string | null
    sessionNonce?: string | null
    deviceType: DeviceType
    submittedScore: number
    accepted: boolean
    acceptedScore?: number | null
    keptBest?: boolean
    updatedBest?: boolean
    reason: SubmissionReason
    meta?: Record<string, any>
  }) {
    const { error } = await client
      .from('tournament_score_submissions')
      .insert({
        tournament_id: payload.tournamentId,
        user_id: payload.userId,
        session_id: payload.sessionId ?? null,
        session_nonce: payload.sessionNonce ?? null,
        device_type: payload.deviceType,
        submitted_score: payload.submittedScore,
        accepted: payload.accepted,
        accepted_score: payload.acceptedScore ?? null,
        kept_best: payload.keptBest ?? false,
        updated_best: payload.updatedBest ?? false,
        reason: payload.reason,
        ip,
        user_agent: userAgent,
        meta: payload.meta ?? {}
      })

    if (error) {
      console.error('[tournament submit] submission log insert failed:', error.message)
    }
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
  const score = Number(body?.score)
  const sessionId = String(body?.sessionId || '').trim()
  const sessionNonce = String(body?.sessionNonce || '').trim()

  const rawDeviceType = String(body?.deviceType || '').trim()
  const deviceType: DeviceType =
    rawDeviceType === 'Mobile' ||
    rawDeviceType === 'PC' ||
    rawDeviceType === 'Emulator'
      ? rawDeviceType
      : 'PC'

  const incomingMeta = normalizeIncomingMeta(body?.meta)

  if (!tournamentSlug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing tournamentSlug'
    })
  }

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing sessionId'
    })
  }

  if (!sessionNonce) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing sessionNonce'
    })
  }

  if (!Number.isFinite(score) || score < 0 || !Number.isInteger(score)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid score'
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
    .select('id, slug, status, starts_at, ends_at')
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
    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'tournament_not_live',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug,
          tournament_status: t.status
        }
      )
    })

    throw createError({
      statusCode: 403,
      statusMessage: 'Tournament is not live'
    })
  }

  /* ---------------- Session Validation ---------------- */
  const { data: session, error: sErr } = await client
    .from('tournament_run_sessions')
    .select(
      'id, tournament_id, user_id, status, started_at, created_at, expires_at, used_at, session_nonce, device_type'
    )
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('tournament_id', t.id)
    .maybeSingle()

  if (sErr) {
    throw createError({
      statusCode: 500,
      statusMessage: sErr.message
    })
  }

  if (!session) {
    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'invalid_session',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug
        }
      )
    })

    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid session'
    })
  }

  if (String(session.session_nonce || '') !== sessionNonce) {
    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId: session.id,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'invalid_session_nonce',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug
        }
      )
    })

    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid session nonce'
    })
  }

  if (session.status !== 'active') {
    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId: session.id,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'session_not_active',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug,
          session_status: session.status
        }
      )
    })

    throw createError({
      statusCode: 403,
      statusMessage: 'Session is not active'
    })
  }

  const sessionStartedAt = new Date(session.started_at).getTime()
  const sessionExpiresAt = session.expires_at
    ? new Date(session.expires_at).getTime()
    : 0

  if (!Number.isFinite(sessionStartedAt)) {
    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId: session.id,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'invalid_session_start_time',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug
        }
      )
    })

    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid session start time'
    })
  }

  if (
    sessionExpiresAt &&
    Number.isFinite(sessionExpiresAt) &&
    nowMs >= sessionExpiresAt
  ) {
    await client
      .from('tournament_run_sessions')
      .update({
        status: 'expired',
        updated_at: nowIso()
      })
      .eq('id', session.id)

    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId: session.id,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'session_expired',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug,
          expires_at: session.expires_at
        }
      )
    })

    throw createError({
      statusCode: 403,
      statusMessage: 'Session expired'
    })
  }

  if (session.used_at) {
    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId: session.id,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'session_already_used',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug,
          used_at: session.used_at
        }
      )
    })

    throw createError({
      statusCode: 403,
      statusMessage: 'Session already used'
    })
  }

  if (session.device_type && session.device_type !== deviceType) {
    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId: session.id,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'device_type_mismatch',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug,
          expected_device_type: session.device_type
        }
      )
    })

    throw createError({
      statusCode: 403,
      statusMessage: 'Device type mismatch'
    })
  }

  /* ---------------- Reject older/replaced sessions ---------------- */
  const compareCreatedAt =
    String(session.created_at || session.started_at || '').trim()

  const { data: newerSession, error: newerErr } = await client
    .from('tournament_run_sessions')
    .select('id, created_at, status')
    .eq('tournament_id', t.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .neq('id', session.id)
    .gt('created_at', compareCreatedAt)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (newerErr) {
    throw createError({
      statusCode: 500,
      statusMessage: newerErr.message
    })
  }

  if (newerSession) {
    await client
      .from('tournament_run_sessions')
      .update({
        status: 'rejected',
        updated_at: nowIso()
      })
      .eq('id', session.id)
      .eq('status', 'active')

    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId: session.id,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'replaced_by_newer_session',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug,
          newer_session_id: newerSession.id
        }
      )
    })

    throw createError({
      statusCode: 409,
      statusMessage: 'This run was replaced by a newer session'
    })
  }

  /* ---------------- Touch active session ---------------- */
  const { error: touchErr } = await client
    .from('tournament_run_sessions')
    .update({
      updated_at: nowIso()
    })
    .eq('id', session.id)
    .eq('status', 'active')

  if (touchErr) {
    throw createError({
      statusCode: 500,
      statusMessage: touchErr.message
    })
  }

  /* ---------------- Player Name ---------------- */
  const { data: profile, error: pErr } = await client
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (pErr) {
    throw createError({
      statusCode: 500,
      statusMessage: pErr.message
    })
  }

  const playerName =
    String(profile?.display_name || 'Player').trim() || 'Player'

  /* ---------------- Atomic Best-Score Save ---------------- */
  const { data: rpcData, error: rpcErr } = await client.rpc(
    'submit_tournament_score',
    {
      p_tournament_id: t.id,
      p_user_id: user.id,
      p_player_name: playerName,
      p_score: score,
      p_device_type: deviceType,
      p_session_id: session.id
    }
  )

  if (rpcErr) {
    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId: session.id,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'rpc_submit_failed',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug,
          rpc_error: rpcErr.message
        }
      )
    })

    throw createError({
      statusCode: 500,
      statusMessage: rpcErr.message
    })
  }

  const row = Array.isArray(rpcData)
    ? (rpcData[0] as SubmitTournamentScoreRow | undefined)
    : (rpcData as SubmitTournamentScoreRow | null)

  if (!row) {
    await logSubmission({
      tournamentId: t.id,
      userId: user.id,
      sessionId: session.id,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: false,
      reason: 'score_save_failed',
      meta: mergeMeta(
        incomingMeta,
        {
          tournament_slug: tournamentSlug
        }
      )
    })

    throw createError({
      statusCode: 500,
      statusMessage: 'Score save failed'
    })
  }

  /* ---------------- Log Every Submission ---------------- */
  await logSubmission({
    tournamentId: t.id,
    userId: user.id,
    sessionId: session.id,
    sessionNonce,
    deviceType,
    submittedScore: score,
    accepted: row.ok === true,
    acceptedScore: Number(row.final_score || 0),
    keptBest: row.kept_best === true,
    updatedBest: row.updated === true,
    reason:
      row.updated === true
        ? 'best_updated'
        : row.kept_best === true
          ? 'kept_existing_best'
          : 'accepted',
    meta: mergeMeta(
      incomingMeta,
      {
        tournament_slug: tournamentSlug,
        player_name: playerName
      }
    )
  })

  return {
    ok: row.ok === true,
    updated: row.updated === true,
    keptBest: row.kept_best === true,
    finalScore: Number(row.final_score || 0)
  }
})