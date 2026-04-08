// app/composables/useLeaderboard.ts
import { encryptLeaderboardSubmitPayload } from '~/utils/encryptLeaderboardSubmit'

type DeviceType = 'Mobile' | 'PC' | 'Emulator'

type StartSessionPayload = {
  gameSlug: string
  deviceType?: DeviceType | null
  forceNew?: boolean
  source?: string
}

type StartSessionResponse = {
  ok: boolean
  reused?: boolean
  gameSlug: string
  sessionId: string
  sessionNonce: string
  startedAt: string
  expiresAt: string
  wsTicket?: string
  wsTicketExp?: number
}

type SubmitScoreSecurePayload = {
  gameSlug: string
  score: number
  sessionId: string
  sessionNonce: string
  deviceType?: DeviceType | null
  meta?: Record<string, any>
}

export function useLeaderboard() {
  const config = useRuntimeConfig()
  const supabase = useSupabaseClient()

  async function getTop(
    gameSlug: string,
    limit = 10,
    opts?: { period?: 'daily' | 'weekly' | 'all' }
  ) {
    return await $fetch('/api/leaderboard/get', {
      method: 'GET',
      query: {
        gameSlug,
        limit,
        period: opts?.period ?? 'daily'
      }
    })
  }

  async function startSession(payload: StartSessionPayload): Promise<StartSessionResponse> {
    return await $fetch<StartSessionResponse>('/api/leaderboard/session/start', {
      method: 'POST',
      credentials: 'include',
      body: {
        gameSlug: payload.gameSlug,
        deviceType: payload.deviceType ?? 'PC',
        forceNew: payload.forceNew ?? false,
        source: payload.source ?? 'arcade'
      }
    })
  }

  async function submitScoreSecure(payload: SubmitScoreSecurePayload) {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token

    if (!accessToken) {
      throw new Error('Login required')
    }

    const encryptedBody = await encryptLeaderboardSubmitPayload({
      gameSlug: payload.gameSlug,
      score: payload.score,
      sessionId: payload.sessionId,
      sessionNonce: payload.sessionNonce,
      deviceType: payload.deviceType ?? 'PC',
      meta: payload.meta ?? {}
    })

    const fnUrl = `${config.public.supabaseUrl}/functions/v1/leaderboard-submit-secure`

    return await $fetch(fnUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: config.public.supabaseAnonKey
      },
      body: encryptedBody
    })
  }

  return {
    getTop,
    startSession,
    submitScoreSecure
  }
}