// server/api/tournaments/winners.get.ts
import { serverSupabaseServiceRole } from '#supabase/server'
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
  const adminDb = await serverSupabaseServiceRole(event)
  const q = getQuery(event)

  const slug = String(q.slug || '').trim()
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing slug' })
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

  async function readWinners(): Promise<WinnerRow[]> {
    const { data, error } = await adminDb
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
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return (data || []).map(normalizeWinnerRow)
  }

  async function readTournament(): Promise<TournamentRow> {
    const { data: t, error: tErr } = await adminDb
      .from('tournaments')
      .select('id, slug, ends_at, status, finalized')
      .eq('slug', slug)
      .maybeSingle()

    if (tErr) {
      throw createError({ statusCode: 500, statusMessage: tErr.message })
    }
    if (!t?.id) {
      throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
    }

    return t as TournamentRow
  }

  // 1) Read tournament first
  const tournament = await readTournament()

  // 2) Quick return if winners already exist
  const existing = await readWinners()
  if (existing.length) {
    return { slug, winners: existing }
  }

  // 3) Decide if ended
  const endsAtIso = String(tournament.ends_at || '')
  const status = String(tournament.status || '').toLowerCase()
  const finalized = Boolean(tournament.finalized)

  const endsMs = endsAtIso ? new Date(endsAtIso).getTime() : 0
  const nowMs = Date.now()
  const endedByTime = endsMs ? nowMs >= endsMs : false
  const endedByStatus = status === 'ended'
  const isEnded = endedByTime || endedByStatus

  if (!isEnded) {
    return { slug, winners: [] }
  }

  // 4) Auto-finalize
  // Keep this only if your DB function exists.
  try {
    await (adminDb as any).rpc('finalize_tournament_winners', {
      p_tournament_id: String(tournament.id),
      p_force: false
    })
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      statusMessage: e?.message || 'Finalize failed'
    })
  }

  // 5) Return winners after finalize
  const winners = await readWinners()
  return { slug, winners, finalizedWas: finalized }
})