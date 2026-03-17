import { createError, getQuery } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event)

    const gameSlug = String(q.gameSlug ?? '').trim()
    const period = String(q.period ?? 'daily').toLowerCase() === 'weekly' ? 'weekly' : 'daily'

    const limitRaw = Number(q.limit ?? 50)
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(Math.floor(limitRaw), 200))
      : 50

    if (!gameSlug) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing gameSlug'
      })
    }

    const client = await serverSupabaseClient(event)

    // leaderboard_best_period should return only public-safe fields.
    // Expected extra columns from RPC:
    // - display_name
    // - avatar_url
    // - masked_phone
    const { data, error } = await (client as any).rpc('leaderboard_best_period', {
      p_game_slug: gameSlug,
      p_period: period,
      p_limit: limit
    })

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message || 'Leaderboard unavailable'
      })
    }

    const items = (Array.isArray(data) ? data : []).map((r: any) => ({
      id: r.id,
      userId: r.user_id || undefined,
      gameSlug: r.game_slug || gameSlug,
      score: Number(r.score ?? 0),
      createdAt: r.created_at || '',
      player: String(r.player_name || r.display_name || 'Player'),

      // Public-safe profile fields returned by the RPC.
      displayName: String(r.display_name || r.player_name || 'Player'),
      avatarUrl: String(r.avatar_url || ''),
      maskedPhone: String(r.masked_phone || '')
    }))

    return {
      ok: true,
      items,
      gameSlug,
      period,
      limit
    }
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500
    const statusMessage =
      e?.statusMessage ||
      e?.message ||
      'Leaderboard unavailable'

    throw createError({
      statusCode,
      statusMessage
    })
  }
})