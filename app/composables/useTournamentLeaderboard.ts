// app/composables/useTournamentLeaderboard.ts
export type TournamentLeaderboardRow = {
  user_id?: string | null
  player_name: string
  score: number
  created_at: string | null
  updated_at?: string | null
  display_name?: string
  avatar_url?: string
  masked_phone?: string
}

export function useTournamentLeaderboard() {
  async function getLeaderboard(slug: string, limit = 50) {
    return await $fetch<{
      tournament: any | null
      rows: TournamentLeaderboardRow[]
    }>('/api/tournaments/leaderboard', {
      query: { slug, limit }
    })
  }

  async function submitScore(tournamentSlug: string, score: number) {
    return await $fetch('/api/tournaments/submit', {
      method: 'POST',
      body: { tournamentSlug, score }
    })
  }

  return { getLeaderboard, submitScore }
}