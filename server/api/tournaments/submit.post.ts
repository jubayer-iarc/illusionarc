// server/api/tournaments/submit.post.ts
import { readBody, createError } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

type DeviceType = 'Mobile' | 'PC' | 'Emulator'

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
    throw createError({ statusCode: 400, statusMessage: 'Missing tournamentSlug' })
  }
  if (!Number.isFinite(score) || score < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid score' })
  }

  /* ---------------- Subscription Gate ---------------- */
  const { data: hasSub, error: subErr } = await client.rpc(
    'has_active_subscription',
    { p_user_id: user.id }
  )

  if (subErr) {
    throw createError({ statusCode: 500, statusMessage: subErr.message })
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
    throw createError({ statusCode: 500, statusMessage: tErr.message })
  }
  if (!t) {
    throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
  }

  const now = Date.now()
  const startsAt = new Date(t.starts_at).getTime()
  const endsAt = new Date(t.ends_at).getTime()

  if (t.status !== 'live' || now < startsAt || now > endsAt) {
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
    throw createError({ statusCode: 500, statusMessage: pErr.message })
  }

  const playerName = String(profile?.display_name || 'Player')

  /* ---------------- Best-Score Logic ---------------- */
  const { data: existing, error: eErr } = await client
    .from('tournament_scores')
    .select('id, score')
    .eq('tournament_id', t.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (eErr) {
    throw createError({ statusCode: 500, statusMessage: eErr.message })
  }

  // Keep best score only
  if (existing && Number(existing.score) >= score) {
    return {
      ok: true,
      updated: false,
      keptBest: true
    }
  }

  const { error: upErr } = await client
    .from('tournament_scores')
    .upsert(
      {
        tournament_id: t.id,
        user_id: user.id,
        player_name: playerName,
        score,
        device_type: deviceType,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'tournament_id,user_id' }
    )

  if (upErr) {
    throw createError({ statusCode: 500, statusMessage: upErr.message })
  }

  return {
    ok: true,
    updated: true,
    keptBest: false
  }
})