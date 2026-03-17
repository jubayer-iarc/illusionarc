// server/api/tournaments/leaderboard.get.ts
import { serverSupabaseClient } from '#supabase/server'
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

function maskPhone(raw?: string | null) {
  const s = String(raw || '').trim().replace(/\s+/g, '')
  if (!s) return ''

  if (s.startsWith('+880') && s.length >= 14) {
    return `0${s.slice(4, 7)}XXXXXXXX`
  }

  if (s.startsWith('880') && s.length >= 13) {
    return `0${s.slice(3, 6)}XXXXXXXX`
  }

  if (s.startsWith('01') && s.length >= 11) {
    return `${s.slice(0, 3)}XXXXXXXX`
  }

  const keep = Math.min(3, s.length)
  return s.slice(0, keep) + 'X'.repeat(Math.max(0, s.length - keep))
}

export default defineEventHandler(async (event) => {
  try {
    const supabase = await serverSupabaseClient(event)

    const q = getQuery(event)
    const slug = String(q.slug || '').trim()

    const limitRaw = Number(q.limit || 50)
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.floor(limitRaw), 1), 200)
      : 50

    if (!slug) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing slug'
      })
    }

    const { data: tournament, error: tournamentError } = await (supabase as any)
      .from('tournaments')
      .select('id, slug, status, starts_at, ends_at, game_slug, title, finalized')
      .eq('slug', slug)
      .maybeSingle()

    if (tournamentError) {
      throw createError({
        statusCode: 500,
        statusMessage: tournamentError.message || 'Failed to load tournament'
      })
    }

    if (!tournament?.id) {
      return {
        tournament: null,
        rows: []
      }
    }

    const effective_status = computeEffectiveStatus(tournament)

    const { data: scoreRows, error: rowsError } = await (supabase as any)
      .from('tournament_scores')
      .select('user_id, player_name, score, created_at')
      .eq('tournament_id', tournament.id)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)

    if (rowsError) {
      throw createError({
        statusCode: 500,
        statusMessage: rowsError.message || 'Failed to load tournament leaderboard'
      })
    }

    const rows = Array.isArray(scoreRows) ? scoreRows : []

    const userIds = Array.from(
      new Set(
        rows
          .map((r: any) => String(r?.user_id || '').trim())
          .filter(Boolean)
      )
    )

    let profileMap: Record<string, { display_name: string; avatar_url: string; masked_phone: string }> = {}

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from('profiles')
        .select('user_id, display_name, avatar_url, phone')
        .in('user_id', userIds)

      if (!profilesError && Array.isArray(profiles)) {
        profileMap = Object.fromEntries(
          profiles.map((p: any) => [
            String(p.user_id),
            {
              display_name: String(p.display_name || '').trim(),
              avatar_url: String(p.avatar_url || '').trim(),
              masked_phone: maskPhone(p.phone)
            }
          ])
        )
      }
    }

    return {
      tournament: {
        id: tournament.id,
        slug: tournament.slug,
        title: tournament.title,
        game_slug: tournament.game_slug,
        starts_at: tournament.starts_at,
        ends_at: tournament.ends_at,
        status: tournament.status,
        effective_status,
        finalized: Boolean(tournament.finalized)
      },
      rows: rows.map((r: any) => {
        const uid = String(r?.user_id || '').trim()
        const profile = uid ? profileMap[uid] : undefined

        return {
          user_id: r?.user_id || null,
          player_name: String(r?.player_name || '').trim() || 'Player',
          score: Number(r?.score || 0),
          created_at: r?.created_at || null,
          display_name: profile?.display_name || String(r?.player_name || '').trim() || 'Player',
          avatar_url: profile?.avatar_url || '',
          masked_phone: profile?.masked_phone || ''
        }
      })
    }
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500
    const statusMessage =
      e?.statusMessage ||
      e?.message ||
      'Tournament leaderboard unavailable'

    throw createError({
      statusCode,
      statusMessage
    })
  }
})