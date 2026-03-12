// server/api/tournaments/leaderboard.get.ts
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'

function computeEffectiveStatus(t: any, nowMs = Date.now()) {
  const db = String(t?.status || 'scheduled').toLowerCase()
  if (db === 'canceled') return 'canceled'

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
  const adminDb = await serverSupabaseServiceRole(event)

  const q = getQuery(event)
  const slug = String(q.slug || '').trim()
  const limit = Math.min(Math.max(Number(q.limit || 50), 1), 200)

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing slug' })
  }

  let t: any = null
  {
    const { data, error } = await adminDb
        .from('tournaments')
        .select('id, slug, status, starts_at, ends_at, game_slug, title, finalized')
        .eq('slug', slug)
        .maybeSingle()

    if (error) {
      const fb = await supabase
          .from('tournaments')
          .select('id, slug, status, starts_at, ends_at, game_slug, title, finalized')
          .eq('slug', slug)
          .maybeSingle()

      if (fb.error) {
        throw createError({ statusCode: 500, statusMessage: fb.error.message })
      }

      t = fb.data
    } else {
      t = data
    }
  }

  if (!t?.id) {
    return { tournament: null, rows: [] }
  }

  const effective_status = computeEffectiveStatus(t)

  let rows: any[] = []
  {
    const { data, error } = await adminDb
        .from('tournament_scores')
        .select('user_id, player_name, score, created_at')
        .eq('tournament_id', t.id)
        .order('score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit)

    if (error) {
      const fb = await supabase
          .from('tournament_scores')
          .select('user_id, player_name, score, created_at')
          .eq('tournament_id', t.id)
          .order('score', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(limit)

      if (fb.error) {
        throw createError({ statusCode: 500, statusMessage: fb.error.message })
      }

      rows = fb.data || []
    } else {
      rows = data || []
    }
  }

  return {
    tournament: {
      id: t.id,
      slug: t.slug,
      title: t.title,
      game_slug: t.game_slug,
      starts_at: t.starts_at,
      ends_at: t.ends_at,
      status: t.status,
      effective_status,
      finalized: Boolean(t.finalized)
    },
    rows: (rows || []).map((r) => ({
      user_id: r?.user_id || null,
      player_name: String(r?.player_name || '').trim() || 'Player',
      score: Number(r?.score || 0),
      created_at: r?.created_at || null
    }))
  }
})