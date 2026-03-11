// server/api/admin/tournaments/winners.get.ts
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'

async function requireAdmin(event: any) {
  const client = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user

  if (authErr || !user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  }

  const { data: prof, error: profErr } = await client
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profErr) {
    throw createError({ statusCode: 500, statusMessage: profErr.message })
  }

  if (String((prof as any)?.role || '').toLowerCase() !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const adminDb = await serverSupabaseServiceRole(event)

  const query = getQuery(event)
  const tournamentId = String(query.tournamentId || '').trim()
  const tournamentSlugFromQuery = String(query.tournamentSlug || '').trim()

  if (!tournamentId && !tournamentSlugFromQuery) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tournamentId or tournamentSlug' })
  }

  let tournamentSlug = tournamentSlugFromQuery
  let resolvedTournamentId = tournamentId

  if (tournamentId) {
    const { data: t, error: tErr } = await adminDb
      .from('tournaments')
      .select('id, slug')
      .eq('id', tournamentId)
      .maybeSingle()

    if (tErr) {
      throw createError({ statusCode: 400, statusMessage: tErr.message })
    }
    if (!t?.slug) {
      throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
    }

    tournamentSlug = String((t as any).slug || '').trim()
    resolvedTournamentId = String((t as any).id || '').trim()
  } else if (tournamentSlugFromQuery) {
    const { data: t, error: tErr } = await adminDb
      .from('tournaments')
      .select('id, slug')
      .eq('slug', tournamentSlugFromQuery)
      .maybeSingle()

    if (tErr) {
      throw createError({ statusCode: 400, statusMessage: tErr.message })
    }
    if (!t?.id) {
      throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
    }

    tournamentSlug = String((t as any).slug || '').trim()
    resolvedTournamentId = String((t as any).id || '').trim()
  }

  const { data, error } = await adminDb
    .from('tournament_winners')
    .select(`
      id,
      tournament_id,
      tournament_slug,
      rank,
      user_id,
      player_name,
      score,
      prize_id,
      prize,
      prize_label,
      prize_bdt,
      reward_status,
      reward_method,
      reward_txn_id,
      rewarded_at,
      created_at,
      tournament_prize:tournament_prizes (
        id,
        rank,
        title,
        description,
        image_url,
        image_path
      )
    `)
    .eq('tournament_slug', tournamentSlug)
    .order('rank', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data || []).map((r: any) => ({
    ...r,
    tournament_id: r.tournament_id || resolvedTournamentId
  }))

  return { rows }
})