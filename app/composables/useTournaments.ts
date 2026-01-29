export type TournamentStatus = 'scheduled' | 'live' | 'ended' | 'canceled'

export type Tournament = {
  id: string
  slug: string
  title: string
  game_slug: string
  starts_at: string
  ends_at: string
  status: TournamentStatus

  // old
  prize: string | null
  description: string | null

  // ✅ new columns (from your table)
  finalized?: boolean | null
  prize_1?: string | null
  prize_2?: string | null
  prize_3?: string | null
  thumbnail_url?: string | null
  thumbnail_path?: string | null
  thumbnail_bucket?: string | null

  created_at?: string | null
  updated_at?: string | null
}

export function useTournaments() {
  async function list() {
    const res = await $fetch<{ tournaments: Tournament[] }>('/api/tournaments/list')
    return res.tournaments || []
  }

  async function bySlug(slug: string) {
    const res = await $fetch<{ tournament: Tournament | null }>('/api/tournaments/by-slug', {
      query: { slug }
    })
    return res.tournament
  }

  return { list, bySlug }
}
