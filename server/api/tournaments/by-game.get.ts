// server/api/tournaments/by-game.get.ts
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const gameSlug = String(query.gameSlug || '').trim()

    if (!gameSlug) return { items: [] }

    const supabase = await serverSupabaseClient(event)

    const { data, error } = await supabase
        .from('tournaments')
        .select('id, slug, title, game_slug, starts_at, ends_at, status, effective_status')
        .eq('game_slug', gameSlug)
        .order('starts_at', { ascending: false })

    if (error) return { items: [] }

    return { items: data || [] }
})