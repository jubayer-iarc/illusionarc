// supabase/functions/leaderboard-submit-secure/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

type DeviceType = "Mobile" | "PC" | "Emulator"
type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
type JsonObject = { [key: string]: JsonValue }

type EncryptedRequestBody = {
  keyId?: unknown
  encryptedKey?: unknown
  iv?: unknown
  ciphertext?: unknown
}

type DecryptedSubmitPayload = {
  gameSlug?: unknown
  score?: unknown
  sessionId?: unknown
  sessionNonce?: unknown
  deviceType?: unknown
  meta?: unknown
}

type ProfileRow = {
  display_name: string | null
}

type SessionRow = {
  id: string
  user_id: string
  game_slug: string
  status: string
  session_nonce: string
  started_at: string | null
  expires_at: string | null
  device_type: DeviceType | null
}

function mustEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function getRuntimeEnv() {
  return {
    SUPABASE_URL: mustEnv("SUPABASE_URL"),
    SUPABASE_ANON_KEY: mustEnv("SUPABASE_ANON_KEY"),
    PRIVATE_KEY_PEM: mustEnv("LEADERBOARD_SUBMIT_PRIVATE_KEY_PEM")
  }
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name)
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

const EXPECTED_KEY_ID = Deno.env.get("LEADERBOARD_SUBMIT_KEY_ID") || "v1"
const MAX_SCORE = positiveIntEnv("LEADERBOARD_SUBMIT_MAX_SCORE", 2_000_000)
const MAX_SUBMITS_PER_SESSION = positiveIntEnv("LEADERBOARD_SUBMIT_MAX_SUBMITS_PER_SESSION", 20)
const MIN_SECONDS_BETWEEN_SUBMITS = positiveIntEnv("LEADERBOARD_SUBMIT_MIN_SECONDS_BETWEEN_SUBMITS", 3)

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "*"
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin"
  }
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: getCorsHeaders(req)
  })
}

function nowIso() {
  return new Date().toISOString()
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || ""
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function firstForwardedIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for") || ""
  return forwarded.split(",")[0]?.trim() || null
}

function normalizeDeviceType(input: unknown): DeviceType | null {
  const value = String(input || "").trim()
  if (value === "Mobile" || value === "PC" || value === "Emulator") return value
  return null
}

function normalizeMeta(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN[\s\S]+?-----/g, "")
    .replace(/-----END[\s\S]+?-----/g, "")
    .replace(/\s+/g, "")

  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem)
  return await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  )
}

async function decryptPayload(
  body: EncryptedRequestBody,
  privateKeyPem: string
): Promise<DecryptedSubmitPayload> {
  const keyId = String(body.keyId || "").trim()
  const encryptedKeyB64 = String(body.encryptedKey || "").trim()
  const ivB64 = String(body.iv || "").trim()
  const ciphertextB64 = String(body.ciphertext || "").trim()

  if (!keyId || !encryptedKeyB64 || !ivB64 || !ciphertextB64) {
    throw new Error("Missing encrypted body fields")
  }

  if (keyId !== EXPECTED_KEY_ID) {
    throw new Error("Unexpected keyId")
  }

  const privateKey = await importPrivateKey(privateKeyPem)

  const wrappedAesKey = base64ToBytes(encryptedKeyB64)
  const aesRawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    wrappedAesKey
  )

  const aesKey = await crypto.subtle.importKey(
    "raw",
    aesRawKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  )

  const iv = base64ToBytes(ivB64)
  const ciphertext = base64ToBytes(ciphertextB64)

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  )

  const plaintext = new TextDecoder().decode(plaintextBuffer)
  const payload = JSON.parse(plaintext)

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Decrypted payload is not an object")
  }

  return payload as DecryptedSubmitPayload
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: getCorsHeaders(req) })
    }

    if (req.method !== "POST") {
      return json(req, 405, { error: "Method not allowed" })
    }

    const { SUPABASE_URL, SUPABASE_ANON_KEY, PRIVATE_KEY_PEM } = getRuntimeEnv()

    const token = getBearerToken(req)
    if (!token) {
      return json(req, 401, { error: "Missing bearer token" })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    })

    const { data: authData, error: authErr } = await supabase.auth.getUser()
    const user = authData?.user

    if (authErr || !user?.id) {
      return json(req, 401, { error: "Login required" })
    }

    let requestBody: EncryptedRequestBody
    try {
      requestBody = await req.json()
    } catch {
      return json(req, 400, { error: "Invalid JSON body" })
    }

    let decrypted: DecryptedSubmitPayload
    try {
      decrypted = await decryptPayload(requestBody, PRIVATE_KEY_PEM)
    } catch (err) {
      console.error("[secure arcade submit] decrypt failed:", err)
      return json(req, 400, {
        error: "Unable to decrypt payload",
        reason: "decrypt_failed"
      })
    }

    const gameSlug = String(decrypted.gameSlug || "").trim()
    const sessionId = String(decrypted.sessionId || "").trim()
    const sessionNonce = String(decrypted.sessionNonce || "").trim()

    const scoreRaw = Number(decrypted.score ?? 0)
    const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.floor(scoreRaw)) : NaN

    const submittedDeviceType = normalizeDeviceType(decrypted.deviceType)
    const meta = normalizeMeta(decrypted.meta)

    if (!gameSlug || !sessionId || !sessionNonce || !Number.isInteger(score) || score < 0) {
      return json(req, 400, {
        error: "Invalid decrypted payload",
        reason: "invalid_payload"
      })
    }

    if (score > MAX_SCORE) {
      return json(req, 400, {
        error: "Score above allowed limit",
        reason: "score_above_limit"
      })
    }

    const ip = firstForwardedIp(req)
    const userAgent = req.headers.get("user-agent") || ""
    const nowMs = Date.now()

    const { data: profileData, error: pErr } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()

    if (pErr) {
      return json(req, 500, { error: pErr.message })
    }

    const profile = profileData as ProfileRow | null
    const displayName = String(profile?.display_name ?? "").trim()

    if (!displayName) {
      return json(req, 500, {
        error: "Profile missing display_name"
      })
    }

    const { data: sessionData, error: sessionErr } = await supabase
      .from("leaderboard_run_sessions")
      .select("id, user_id, game_slug, status, session_nonce, started_at, expires_at, device_type")
      .eq("id", sessionId)
      .maybeSingle()

    if (sessionErr) {
      return json(req, 500, { error: sessionErr.message })
    }

    const session = sessionData as SessionRow | null

    const logSubmission = async (payload: {
      accepted: boolean
      acceptedScore: number | null
      keptBest: boolean
      updatedBest: boolean
      reason: string
    }) => {
      const submissionPayload = {
        game_slug: gameSlug,
        user_id: user.id,
        session_id: sessionId,
        session_nonce: sessionNonce,
        device_type: submittedDeviceType ?? session?.device_type ?? null,
        submitted_score: score,
        accepted: payload.accepted,
        accepted_score: payload.acceptedScore,
        kept_best: payload.keptBest,
        updated_best: payload.updatedBest,
        reason: payload.reason,
        ip,
        user_agent: userAgent,
        meta
      }

      const { error: logErr } = await supabase
        .from("leaderboard_score_submissions")
        .insert(submissionPayload)

      if (logErr) {
        console.error("[secure arcade submit] failed to log submission:", logErr.message)
      }
    }

    if (!session) {
      await logSubmission({
        accepted: false,
        acceptedScore: null,
        keptBest: false,
        updatedBest: false,
        reason: "session_not_found"
      })
      return json(req, 400, { error: "Invalid session" })
    }

    if (session.user_id !== user.id) {
      await logSubmission({
        accepted: false,
        acceptedScore: null,
        keptBest: false,
        updatedBest: false,
        reason: "session_user_mismatch"
      })
      return json(req, 403, { error: "Session does not belong to this user" })
    }

    if (session.game_slug !== gameSlug) {
      await logSubmission({
        accepted: false,
        acceptedScore: null,
        keptBest: false,
        updatedBest: false,
        reason: "session_game_mismatch"
      })
      return json(req, 400, { error: "Session game mismatch" })
    }

    if (session.session_nonce !== sessionNonce) {
      await logSubmission({
        accepted: false,
        acceptedScore: null,
        keptBest: false,
        updatedBest: false,
        reason: "session_nonce_mismatch"
      })
      return json(req, 403, { error: "Invalid session nonce" })
    }

    if (session.status !== "active") {
      await logSubmission({
        accepted: false,
        acceptedScore: null,
        keptBest: false,
        updatedBest: false,
        reason: `session_not_active:${session.status}`
      })
      return json(req, 400, { error: "Session is not active" })
    }

    if (session.expires_at && new Date(session.expires_at).getTime() < nowMs) {
      await supabase
        .from("leaderboard_run_sessions")
        .update({
          status: "expired",
          updated_at: nowIso()
        })
        .eq("id", session.id)
        .eq("user_id", user.id)

      await logSubmission({
        accepted: false,
        acceptedScore: null,
        keptBest: false,
        updatedBest: false,
        reason: "session_expired"
      })

      return json(req, 400, { error: "Session expired" })
    }

    if (!session.device_type && submittedDeviceType) {
      const { error: updateDeviceErr } = await supabase
        .from("leaderboard_run_sessions")
        .update({
          device_type: submittedDeviceType,
          updated_at: nowIso()
        })
        .eq("id", session.id)
        .eq("user_id", user.id)

      if (updateDeviceErr) {
        return json(req, 500, { error: updateDeviceErr.message })
      }
    }

    const { count: submitCount, error: countErr } = await supabase
      .from("leaderboard_score_submissions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)

    if (countErr) {
      return json(req, 500, { error: countErr.message })
    }

    if ((submitCount || 0) >= MAX_SUBMITS_PER_SESSION) {
      await logSubmission({
        accepted: false,
        acceptedScore: null,
        keptBest: false,
        updatedBest: false,
        reason: "session_submit_limit_reached"
      })
      return json(req, 429, { error: "Session submit limit reached" })
    }

    const { data: latestSubmission, error: latestErr } = await supabase
      .from("leaderboard_score_submissions")
      .select("id, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestErr) {
      return json(req, 500, { error: latestErr.message })
    }

    if (latestSubmission?.created_at) {
      const deltaMs = nowMs - new Date(latestSubmission.created_at).getTime()
      if (Number.isFinite(deltaMs) && deltaMs < MIN_SECONDS_BETWEEN_SUBMITS * 1000) {
        await logSubmission({
          accepted: false,
          acceptedScore: null,
          keptBest: false,
          updatedBest: false,
          reason: "cooldown_not_met"
        })
        return json(req, 429, { error: "Please wait before submitting again" })
      }
    }

    const { error: insertErr } = await supabase
      .from("leaderboard_scores")
      .insert({
        game_slug: gameSlug,
        user_id: user.id,
        player_name: displayName,
        score
      })

    if (insertErr) {
      return json(req, 500, { error: insertErr.message })
    }

    await logSubmission({
      accepted: true,
      acceptedScore: score,
      keptBest: false,
      updatedBest: false,
      reason: "accepted_arcade_period_score"
    })

    return json(req, 200, {
      ok: true,
      playerName: displayName,
      inserted: true,
      score
    })
  } catch (error: any) {
    console.error("[secure arcade submit] unhandled error:", error)
    return json(req, 500, {
      error: error?.message || "Internal server error"
    })
  }
})