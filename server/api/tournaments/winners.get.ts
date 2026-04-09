import { serverSupabaseClient } from '#supabase/server'
import { createError, getQuery } from 'h3'

type PrizeRelation = {
  id: string
  title: string
  description?: string | null
  image_url?: string | null
  image_path?: string | null
}

type WinnerRow = {
  rank: number
  player_name: string
  score: number
  user_id?: string | null
  created_at?: string
  prize_id?: string | null
  prize?: string | null
  prize_label?: string | null
  prize_bdt?: number | null
  is_verified?: boolean | null
  verified_link?: string | null
  tournament_prize?: PrizeRelation | null
}

type TournamentRow = {
  id: string
  slug: string
  ends_at: string | null
  status: string | null
  finalized: boolean | null
}

export default defineEventHandler(async (event) => {
  const db = await serverSupabaseClient(event)
  const q = getQuery(event)

  const slug = String(q.slug || '').trim()
  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing slug'
    })
  }

  function clean(v: any) {
    const s = String(v ?? '').trim()
    return s || null
  }

  function normalizeWinnerRow(w: any): WinnerRow {
    const joinedPrize = w?.tournament_prize || null
    const explicitPrize = clean(w?.prize)
    const labelPrize = clean(w?.prize_label)
    const joinedTitle = clean(joinedPrize?.title)

    let finalPrize = explicitPrize || labelPrize || joinedTitle
    if (!finalPrize && w?.prize_bdt != null) {
      finalPrize = `${Number(w.prize_bdt)} BDT`
    }

    return {
      rank: Number(w?.rank || 0),
      player_name: String(w?.player_name || '').trim() || 'Player',
      score: Number(w?.score || 0),
      user_id: w?.user_id || null,
      created_at: w?.created_at || undefined,
      prize_id: w?.prize_id || null,
      prize: finalPrize,
      prize_label: labelPrize,
      prize_bdt: w?.prize_bdt ?? null,
      is_verified: typeof w?.is_verified === 'boolean' ? w.is_verified : null,
      verified_link: clean(w?.verified_link),
      tournament_prize: joinedPrize
        ? {
            id: String(joinedPrize.id || '').trim(),
            title: String(joinedPrize.title || '').trim(),
            description: joinedPrize.description || null,
            image_url: joinedPrize.image_url || null,
            image_path: joinedPrize.image_path || null
          }
        : null
    }
  }

  async function readTournament(): Promise<TournamentRow> {
    const { data, error } = await db
      .from('tournaments')
      .select('id, slug, ends_at, status, finalized')
      .eq('slug', slug)
      .maybeSingle()

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message
      })
    }

    if (!data?.id) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    return data as TournamentRow
  }

  async function readWinners(): Promise<WinnerRow[]> {
    const { data, error } = await db
      .from('tournament_winners')
      .select(`
        rank,
        player_name,
        score,
        user_id,
        created_at,
        prize_id,
        prize,
        prize_label,
        prize_bdt,
        is_verified,
        verified_link,
        tournament_prize:tournament_prizes!tournament_winners_prize_id_fkey (
          id,
          title,
          description,
          image_url,
          image_path
        )
      `)
      .eq('tournament_slug', slug)
      .order('rank', { ascending: true })

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message
      })
    }

    return (data || []).map(normalizeWinnerRow)
  }

  const tournament = await readTournament()

  const existing = await readWinners()
  if (existing.length) {
    return {
      slug,
      winners: existing
    }
  }

  const endsMs = tournament.ends_at ? new Date(tournament.ends_at).getTime() : 0
  const nowMs = Date.now()
  const endedByTime = endsMs ? nowMs >= endsMs : false
  const endedByStatus = String(tournament.status || '').toLowerCase() === 'ended'

  if (!endedByTime && !endedByStatus) {
    return {
      slug,
      winners: []
    }
  }

  const { error: finalizeError } = await (db as any).rpc('finalize_tournament_winners', {
    p_tournament_id: String(tournament.id),
    p_force: false
  })

  if (finalizeError) {
    throw createError({
      statusCode: 500,
      statusMessage: finalizeError.message || 'Finalize failed'
    })
  }

  const winners = await readWinners()

  return {
    slug,
    winners
  }
})