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

type SubmitPublicKeyResponse = {
  keyId: string
  publicKey: string
}

type EncryptedSubmitRequest = {
  keyId: string
  encryptedKey: string
  iv: string
  ciphertext: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function stringToArrayBuffer(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '')

  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}

async function importPublicKey(publicKeyPem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    false,
    ['encrypt']
  )
}

async function encryptTournamentSubmitPayload(
  payload: Record<string, unknown>,
  keyId: string,
  publicKeyPem: string
): Promise<EncryptedSubmitRequest> {
  const aesKey = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = stringToArrayBuffer(JSON.stringify(payload))

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    aesKey,
    plaintext
  )

  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey)
  const publicKey = await importPublicKey(publicKeyPem)

  const encryptedKey = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    publicKey,
    rawAesKey
  )

  return {
    keyId,
    encryptedKey: arrayBufferToBase64(encryptedKey),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext)
  }
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

  async function submitScore(
    tournamentSlug: string,
    score: number,
    options?: {
      sessionId?: string
      sessionNonce?: string
      deviceType?: 'Mobile' | 'PC' | 'Emulator'
      meta?: Record<string, any>
    }
  ) {
    const sessionId = options?.sessionId?.trim()
    const sessionNonce = options?.sessionNonce?.trim()

    if (!sessionId || !sessionNonce) {
      throw new Error('Missing sessionId or sessionNonce for secure submit')
    }

    const { keyId, publicKey } = await $fetch<SubmitPublicKeyResponse>(
      '/api/tournaments/submit-public-key'
    )

    const submitPayload = {
      tournamentSlug,
      score,
      sessionId,
      sessionNonce,
      deviceType: options?.deviceType || 'PC',
      meta: options?.meta || {}
    }

    const encryptedBody = await encryptTournamentSubmitPayload(
      submitPayload,
      keyId,
      publicKey
    )

    const supabase = useSupabaseClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()

    const accessToken = session?.access_token
    if (!accessToken) {
      throw new Error('You must be logged in to submit score')
    }

    const config = useRuntimeConfig()
    const supabaseUrl = config.public.supabaseUrl
    const supabaseAnonKey = config.public.supabaseAnonKey

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase public config')
    }

    const functionUrl = `${supabaseUrl}/functions/v1/tournament-submit-secure`

    return await $fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey
      },
      body: encryptedBody
    })
  }

  return { getLeaderboard, submitScore }
}