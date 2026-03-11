// server/api/tournaments/list.get.ts
import { serverSupabaseClient } from '#supabase/server'
import { createError } from 'h3'

function computeStatus(t: any, nowMs = Date.now()) {
  const dbStatus = String(t?.status || 'scheduled').toLowerCase()
  if (dbStatus === 'canceled') return 'canceled'

  const s = Date.parse(String(t?.starts_at || ''))
  const e = Date.parse(String(t?.ends_at || ''))

  const hasS = Number.isFinite(s)
  const hasE = Number.isFinite(e)

  if (hasE && nowMs >= e) return 'ended'
  if (hasS && nowMs >= s && (!hasE || nowMs < e)) return 'live'
  return 'scheduled'
}

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)

  const { data, error } = await supabase
    .from('tournaments')
    .select(`
      id,
      slug,
      title,
      game_slug,
      starts_at,
      ends_at,
      status,
      description,
      thumbnail_url,
      thumbnail_path,
      promo_video_type,
      promo_video_url,
      promo_video_path,
      promo_video_youtube_id,
      promo_video_title
    `)
    .order('starts_at', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const tournaments = data ?? []
  const ids = tournaments
    .map((t: any) => String(t?.id || '').trim())
    .filter(Boolean)

  let prizeSummaryMap: Record<string, { count: number; top_prize: string | null }> = {}

  if (ids.length) {
    const { data: prizeMapRows, error: prizeErr } = await supabase
      .from('tournament_prize_map')
      .select(`
        tournament_id,
        rank,
        prize_id,
        prize:tournament_prizes!tournament_prize_map_prize_id_fkey (
          id,
          title
        )
      `)
      .in('tournament_id', ids)
      .order('rank', { ascending: true })

    if (prizeErr) {
      throw createError({ statusCode: 500, statusMessage: prizeErr.message })
    }

    const grouped: Record<string, Array<{ rank: number; title: string }>> = {}

    for (const row of prizeMapRows || []) {
      const tid = String((row as any)?.tournament_id || '').trim()
      const rank = Number((row as any)?.rank || 0)

      const joinedPrize = (row as any)?.prize
      const prizeObj = Array.isArray(joinedPrize) ? joinedPrize[0] : joinedPrize
      const title = String(prizeObj?.title || '').trim()

      if (!tid || !title) continue
      if (!grouped[tid]) grouped[tid] = []

      grouped[tid].push({ rank, title })
    }

    for (const tid of Object.keys(grouped)) {
      const arr = grouped[tid].sort((a, b) => a.rank - b.rank)
      prizeSummaryMap[tid] = {
        count: arr.length,
        top_prize: arr[0]?.title || null
      }
    }
  }

  const nowMs = Date.now()

  const rows = tournaments.map((t: any) => {
    const tid = String(t?.id || '').trim()
    const summary = prizeSummaryMap[tid] || { count: 0, top_prize: null }

    return {
      ...t,
      effective_status: computeStatus(t, nowMs),
      prize_summary: summary
    }
  })

  return { tournaments: rows }
})