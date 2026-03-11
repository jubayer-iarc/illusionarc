// app/composables/useTournaments.ts
export type TournamentStatus = 'scheduled' | 'live' | 'ended' | 'canceled'
export type PromoVideoType = '' | 'upload' | 'youtube'

export type TournamentPrizeSummary = {
  count: number
  top_prize: string | null
}

export type Tournament = {
  id: string
  slug: string
  title: string
  game_slug: string
  starts_at: string
  ends_at: string

  // stored DB status
  status: TournamentStatus

  // computed by API
  effective_status?: TournamentStatus

  description: string | null

  finalized?: boolean | null

  thumbnail_url?: string | null
  thumbnail_path?: string | null
  thumbnail_bucket?: string | null

  promo_video_type?: PromoVideoType | null
  promo_video_url?: string | null
  promo_video_path?: string | null
  promo_video_youtube_id?: string | null
  promo_video_title?: string | null

  prize_summary?: TournamentPrizeSummary | null

  // legacy compatibility
  prize?: string | null
  prize_1?: string | null
  prize_2?: string | null
  prize_3?: string | null

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