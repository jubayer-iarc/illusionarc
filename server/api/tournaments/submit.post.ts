// server/api/tournaments/submit.post.ts
import { readBody, createError } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

type DeviceType = 'Mobile' | 'PC' | 'Emulator'

type SubmitTournamentScoreRow = {
  ok: boolean
  updated: boolean
  kept_best: boolean
  final_score: number
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

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

  const now = Date.now()
  const startsAt = new Date(t.starts_at).getTime()
  const endsAt = new Date(t.ends_at).getTime()

  if (
    t.status !== 'live' ||
    !Number.isFinite(startsAt) ||
    !Number.isFinite(endsAt) ||
    now < startsAt ||
    now >= endsAt
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Tournament is not live'
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

  const playerName = String(profile?.display_name || 'Player').trim() || 'Player'

  /* ---------------- Atomic Best-Score Save ---------------- */
  const { data: rpcData, error: rpcErr } = await client.rpc(
    'submit_tournament_score',
    {
      p_tournament_id: t.id,
      p_user_id: user.id,
      p_player_name: playerName,
      p_score: score,
      p_device_type: deviceType
    }
  )

  if (rpcErr) {
    throw createError({
      statusCode: 500,
      statusMessage: rpcErr.message
    })
  }

  const row = Array.isArray(rpcData)
    ? (rpcData[0] as SubmitTournamentScoreRow | undefined)
    : (rpcData as SubmitTournamentScoreRow | null)

  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Score save failed'
    })
  }

  return {
    ok: row.ok === true,
    updated: row.updated === true,
    keptBest: row.kept_best === true,
    finalScore: Number(row.final_score || 0)
  }
})