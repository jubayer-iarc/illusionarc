// server/api/tournaments/winners.get.ts
import { serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'

type WinnerRow = {
  rank: 1 | 2 | 3
  player_name: string
  score: number
  user_id?: string | null
  created_at?: string

  // stored in tournament_winners (often defaults today)
  prize?: string | null

  // legacy optional
  prize_bdt?: number | null
}

type TournamentRow = {
  id: string
  slug: string
  ends_at: string | null
  status: string | null
  finalized: boolean | null

  // ✅ your new columns from tournaments table
  prize_1: string | null
  prize_2: string | null
  prize_3: string | null

  // legacy single prize (optional)
  prize: string | null
}

export default defineEventHandler(async (event) => {
  const adminDb = await serverSupabaseServiceRole(event)
  const q = getQuery(event)

  const slug = String(q.slug || '').trim()
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })

  function clean(v: any) {
    const s = String(v ?? '').trim()
    return s || null
  }

  function applyTournamentPrizes(winners: WinnerRow[], t: TournamentRow | null) {
    if (!t) return winners

    const p1 = clean((t as any).prize_1)
    const p2 = clean((t as any).prize_2)
    const p3 = clean((t as any).prize_3)
    const legacy = clean((t as any).prize)

    return winners.map((w) => {
      const rank = Number(w.rank) as 1 | 2 | 3

      // Prefer tournament prizes ALWAYS if present
      const fromTournament =
        rank === 1 ? (p1 || legacy) : rank === 2 ? p2 : p3

      if (fromTournament) {
        return { ...w, prize: fromTournament }
      }

      // Otherwise: keep stored prize, but if empty and prize_bdt exists, show it
      const existingPrize = clean(w.prize)
      if (!existingPrize && w.prize_bdt != null) {
        return { ...w, prize: `${w.prize_bdt} BDT` }
      }

      return { ...w, prize: existingPrize }
    })
  }

  async function readWinners(): Promise<WinnerRow[]> {
    const { data, error } = await adminDb
      .from('tournament_winners')
      .select('rank, player_name, score, user_id, created_at, prize, prize_bdt')
      .eq('tournament_slug', slug)
      .order('rank', { ascending: true })

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return (data || []) as WinnerRow[]
  }

  async function readTournament(): Promise<TournamentRow> {
    const { data: t, error: tErr } = await adminDb
      .from('tournaments')
      .select('id, slug, ends_at, status, finalized, prize_1, prize_2, prize_3, prize')
      .eq('slug', slug)
      .maybeSingle()

    if (tErr) throw createError({ statusCode: 500, statusMessage: tErr.message })
    if (!t?.id) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })

    return t as any as TournamentRow
  }

  // 1) Read tournament first (we need prizes either way)
  const tournament = await readTournament()

  // 2) Quick return if winners exist
  const existing = await readWinners()
  if (existing.length) {
    return { slug, winners: applyTournamentPrizes(existing, tournament) }
  }

  // 3) Decide if ended
  const endsAtIso = String((tournament as any).ends_at || '')
  const status = String((tournament as any).status || '').toLowerCase()
  const finalized = Boolean((tournament as any).finalized)

  const endsMs = endsAtIso ? new Date(endsAtIso).getTime() : 0
  const nowMs = Date.now()
  const endedByTime = endsMs ? nowMs >= endsMs : false
  const endedByStatus = status === 'ended'
  const isEnded = endedByTime || endedByStatus

  if (!isEnded) return { slug, winners: [] }

  // 4) Auto-finalize (RPC)
  try {
    await (adminDb as any).rpc('finalize_tournament_winners', {
      p_tournament_id: String((tournament as any).id),
      p_force: false
    })
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      statusMessage: e?.message || 'Finalize failed'
    })
  }

  // 5) Return winners after finalize (but show tournament prizes)
  const winners = await readWinners()
  return { slug, winners: applyTournamentPrizes(winners, tournament), finalizedWas: finalized }
})
