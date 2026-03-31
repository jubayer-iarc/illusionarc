// supabase/functions/tournament-submit-secure/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

type DeviceType = "Mobile" | "PC" | "Emulator"

type SubmitTournamentScoreRow = {
  ok: boolean
  updated: boolean
  kept_best: boolean
  final_score: number
}

type SubmissionReason =
  | "accepted"
  | "best_updated"
  | "kept_existing_best"
  | "tournament_not_live"
  | "invalid_session"
  | "invalid_session_nonce"
  | "session_not_active"
  | "invalid_session_start_time"
  | "session_expired"
  | "device_type_mismatch"
  | "replaced_by_newer_session"
  | "rpc_submit_failed"
  | "score_save_failed"
  | "cooldown_not_met"
  | "session_submit_limit_reached"
  | "score_above_limit"
  | "decrypt_failed"
  | "invalid_payload"
  | "auth_failed"

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
type JsonObject = { [key: string]: JsonValue }

type NormalizedSize = {
  width: number | null
  height: number | null
}

type NormalizedCanvasAuditSample = {
  seq: number | null
  phase: string | null
  capturedAt: string | null
  elapsedMs: number | null
  canvas: NormalizedSize | null
  frame: NormalizedSize | null
  container: NormalizedSize | null
  canvasRatio: number | null
  frameRatio: number | null
  orientation: string | null
}

type NormalizedSubmissionMeta = JsonObject & {
  canvas_audit?: {
    startedAt: string | null
    samples: NormalizedCanvasAuditSample[]
    latest: NormalizedCanvasAuditSample | null
    gameOver: NormalizedCanvasAuditSample | null
    summary?: JsonObject
  }
}

type EncryptedRequestBody = {
  keyId?: unknown
  encryptedKey?: unknown
  iv?: unknown
  ciphertext?: unknown
}

type DecryptedSubmitPayload = {
  tournamentSlug?: unknown
  score?: unknown
  sessionId?: unknown
  sessionNonce?: unknown
  deviceType?: unknown
  meta?: unknown
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
    PRIVATE_KEY_PEM: mustEnv("TOURNAMENT_SUBMIT_PRIVATE_KEY_PEM")
  }
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name)
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

const EXPECTED_KEY_ID = Deno.env.get("TOURNAMENT_SUBMIT_KEY_ID") || "v1"
const MAX_SUBMITS_PER_SESSION = positiveIntEnv("TOURNAMENT_SUBMIT_MAX_SUBMITS_PER_SESSION", 8)
const MIN_SECONDS_BETWEEN_SUBMITS = positiveIntEnv("TOURNAMENT_SUBMIT_MIN_SECONDS_BETWEEN_SUBMITS", 10)
const MAX_SCORE = positiveIntEnv("TOURNAMENT_SUBMIT_MAX_SCORE", 2_000_000)

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

function toFiniteNumberOrNull(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toShortStringOrNull(value: unknown, max = 200) {
  if (typeof value !== "string") return null
  const v = value.trim()
  if (!v) return null
  return v.slice(0, max)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function normalizeSize(value: unknown): NormalizedSize | null {
  if (!isPlainObject(value)) return null
  return {
    width: toFiniteNumberOrNull(value.width),
    height: toFiniteNumberOrNull(value.height)
  }
}

function normalizeCanvasAuditSample(value: unknown): NormalizedCanvasAuditSample | null {
  if (!isPlainObject(value)) return null
  return {
    seq: toFiniteNumberOrNull(value.seq),
    phase: toShortStringOrNull(value.phase, 40),
    capturedAt: toShortStringOrNull(value.capturedAt, 64),
    elapsedMs: toFiniteNumberOrNull(value.elapsedMs),
    canvas: normalizeSize(value.canvas),
    frame: normalizeSize(value.frame),
    container: normalizeSize(value.container),
    canvasRatio: toFiniteNumberOrNull(value.canvasRatio),
    frameRatio: toFiniteNumberOrNull(value.frameRatio),
    orientation: toShortStringOrNull(value.orientation, 32)
  }
}

function normalizeSummary(value: unknown): JsonObject | undefined {
  if (!isPlainObject(value)) return undefined
  const out: JsonObject = {}
  for (const [key, raw] of Object.entries(value)) {
    if (
      raw === null ||
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    ) {
      out[key] = raw as JsonValue
    }
  }
  return out
}

function normalizeIncomingMeta(value: unknown): NormalizedSubmissionMeta {
  const result: NormalizedSubmissionMeta = {}

  if (!isPlainObject(value)) return result

  if (isPlainObject(value.canvas_audit)) {
    const rawSamples = Array.isArray(value.canvas_audit.samples)
      ? value.canvas_audit.samples
      : []

    result.canvas_audit = {
      startedAt: toShortStringOrNull(value.canvas_audit.startedAt, 64),
      samples: rawSamples
        .map(normalizeCanvasAuditSample)
        .filter((x): x is NormalizedCanvasAuditSample => !!x),
      latest: normalizeCanvasAuditSample(value.canvas_audit.latest),
      gameOver: normalizeCanvasAuditSample(value.canvas_audit.gameOver),
      summary: normalizeSummary(value.canvas_audit.summary)
    }
  }

  return result
}

function mergeMeta(...parts: Array<Record<string, unknown> | undefined | null>): JsonObject {
  const out: JsonObject = {}
  for (const part of parts) {
    if (!part || typeof part !== "object" || Array.isArray(part)) continue
    for (const [key, value] of Object.entries(part)) {
      out[key] = value as JsonValue
    }
  }
  return out
}

function normalizeDeviceType(value: unknown): DeviceType {
  const raw = String(value || "").trim()
  return raw === "Mobile" || raw === "PC" || raw === "Emulator" ? raw : "PC"
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

  if (!isPlainObject(payload)) throw new Error("Decrypted payload is not an object")
  return payload as DecryptedSubmitPayload
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: getCorsHeaders(req)
      })
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

    const ip = firstForwardedIp(req)
    const userAgent = req.headers.get("user-agent") || ""

    async function logSubmission(payload: {
      tournamentId: string
      userId: string
      sessionId?: string | null
      sessionNonce?: string | null
      deviceType: DeviceType
      submittedScore: number
      accepted: boolean
      acceptedScore?: number | null
      keptBest?: boolean
      updatedBest?: boolean
      reason: SubmissionReason
      meta?: Record<string, unknown>
    }) {
      const { error } = await supabase
        .from("tournament_score_submissions")
        .insert({
          tournament_id: payload.tournamentId,
          user_id: payload.userId,
          session_id: payload.sessionId ?? null,
          session_nonce: payload.sessionNonce ?? null,
          device_type: payload.deviceType,
          submitted_score: payload.submittedScore,
          accepted: payload.accepted,
          accepted_score: payload.acceptedScore ?? null,
          kept_best: payload.keptBest ?? false,
          updated_best: payload.updatedBest ?? false,
          reason: payload.reason,
          ip,
          user_agent: userAgent,
          meta: payload.meta ?? {}
        })

      if (error) {
        console.error("[secure tournament submit] submission log insert failed:", error.message)
      }
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
      console.error("[secure tournament submit] decrypt failed:", err)
      return json(req, 400, {
        error: "Unable to decrypt payload",
        reason: "decrypt_failed"
      })
    }

    const tournamentSlug = String(decrypted.tournamentSlug || "").trim()
    const score = Number(decrypted.score)
    const sessionId = String(decrypted.sessionId || "").trim()
    const sessionNonce = String(decrypted.sessionNonce || "").trim()
    const deviceType = normalizeDeviceType(decrypted.deviceType)
    const incomingMeta = normalizeIncomingMeta(decrypted.meta)

    if (!tournamentSlug || !sessionId || !sessionNonce || !Number.isInteger(score) || score < 0) {
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

    const { data: hasSub, error: subErr } = await supabase.rpc(
      "has_active_subscription",
      { p_user_id: user.id }
    )

    if (subErr) {
      return json(req, 500, { error: subErr.message })
    }

    if (!hasSub) {
      return json(req, 402, { error: "Active subscription required to play tournament" })
    }

    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .select("id, slug, status, starts_at, ends_at")
      .eq("slug", tournamentSlug)
      .maybeSingle()

    if (tErr) {
      return json(req, 500, { error: tErr.message })
    }

    if (!tournament) {
      return json(req, 404, { error: "Tournament not found" })
    }

    const nowMs = Date.now()
    const startsAtMs = tournament.starts_at ? new Date(tournament.starts_at).getTime() : NaN
    const endsAtMs = tournament.ends_at ? new Date(tournament.ends_at).getTime() : NaN
    const isLive =
      tournament.status === "live" &&
      Number.isFinite(startsAtMs) &&
      Number.isFinite(endsAtMs) &&
      nowMs >= startsAtMs &&
      nowMs <= endsAtMs

    if (!isLive) {
      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "tournament_not_live",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug,
          tournament_status: tournament.status
        })
      })

      return json(req, 403, { error: "Tournament is not live" })
    }

    const { data: session, error: sErr } = await supabase
      .from("tournament_run_sessions")
      .select("id, tournament_id, user_id, status, started_at, expires_at, used_at, created_at, updated_at, device_type, session_nonce")
      .eq("id", sessionId)
      .eq("tournament_id", tournament.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (sErr) {
      return json(req, 500, { error: sErr.message })
    }

    if (!session) {
      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "invalid_session",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug
        })
      })

      return json(req, 403, { error: "Invalid session" })
    }

    if (String(session.session_nonce || "") !== sessionNonce) {
      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId: session.id,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "invalid_session_nonce",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug
        })
      })

      return json(req, 403, { error: "Invalid session nonce" })
    }

    if (session.status !== "active") {
      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId: session.id,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "session_not_active",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug,
          session_status: session.status
        })
      })

      return json(req, 403, { error: "Session is not active" })
    }

    if (!session.started_at || Number.isNaN(new Date(session.started_at).getTime())) {
      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId: session.id,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "invalid_session_start_time",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug
        })
      })

      return json(req, 403, { error: "Invalid session start time" })
    }

    if (session.expires_at && new Date(session.expires_at).getTime() < nowMs) {
      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId: session.id,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "session_expired",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug,
          expires_at: session.expires_at
        })
      })

      return json(req, 403, { error: "Session expired" })
    }

    if (session.device_type && session.device_type !== deviceType) {
      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId: session.id,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "device_type_mismatch",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug,
          expected_device_type: session.device_type
        })
      })

      return json(req, 403, { error: "Device type mismatch" })
    }

    const compareCreatedAt = String(session.created_at || session.started_at || "").trim()

    const { data: newerSession, error: newerErr } = await supabase
      .from("tournament_run_sessions")
      .select("id, created_at, status")
      .eq("tournament_id", tournament.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .neq("id", session.id)
      .gt("created_at", compareCreatedAt)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (newerErr) {
      return json(req, 500, { error: newerErr.message })
    }

    if (newerSession) {
      await supabase
        .from("tournament_run_sessions")
        .update({
          status: "rejected",
          updated_at: nowIso()
        })
        .eq("id", session.id)
        .eq("status", "active")

      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId: session.id,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "replaced_by_newer_session",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug,
          newer_session_id: newerSession.id
        })
      })

      return json(req, 409, { error: "This run was replaced by a newer session" })
    }

    const { count: submitCount, error: countErr } = await supabase
      .from("tournament_score_submissions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)

    if (countErr) {
      return json(req, 500, { error: countErr.message })
    }

    if ((submitCount || 0) >= MAX_SUBMITS_PER_SESSION) {
      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId: session.id,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "session_submit_limit_reached",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug,
          submit_count: submitCount,
          max_submits: MAX_SUBMITS_PER_SESSION
        })
      })

      return json(req, 429, { error: "Session submit limit reached" })
    }

    const { data: latestSubmission, error: latestErr } = await supabase
      .from("tournament_score_submissions")
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
          tournamentId: tournament.id,
          userId: user.id,
          sessionId: session.id,
          sessionNonce,
          deviceType,
          submittedScore: score,
          accepted: false,
          reason: "cooldown_not_met",
          meta: mergeMeta(incomingMeta, {
            tournament_slug: tournamentSlug,
            min_seconds_between_submits: MIN_SECONDS_BETWEEN_SUBMITS,
            previous_submit_at: latestSubmission.created_at
          })
        })

        return json(req, 429, { error: "Please wait before submitting again" })
      }
    }

    const { error: touchErr } = await supabase
      .from("tournament_run_sessions")
      .update({
        updated_at: nowIso()
      })
      .eq("id", session.id)
      .eq("status", "active")

    if (touchErr) {
      return json(req, 500, { error: touchErr.message })
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()

    if (pErr) {
      return json(req, 500, { error: pErr.message })
    }

    const playerName = String(profile?.display_name || "Player").trim() || "Player"

    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "submit_tournament_score",
      {
        p_tournament_id: tournament.id,
        p_user_id: user.id,
        p_player_name: playerName,
        p_score: score,
        p_device_type: deviceType,
        p_session_id: session.id
      }
    )

    if (rpcErr) {
      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId: session.id,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "rpc_submit_failed",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug,
          rpc_error: rpcErr.message
        })
      })

      return json(req, 500, { error: rpcErr.message })
    }

    const row = Array.isArray(rpcData)
      ? (rpcData[0] as SubmitTournamentScoreRow | undefined)
      : (rpcData as SubmitTournamentScoreRow | null)

    if (!row) {
      await logSubmission({
        tournamentId: tournament.id,
        userId: user.id,
        sessionId: session.id,
        sessionNonce,
        deviceType,
        submittedScore: score,
        accepted: false,
        reason: "score_save_failed",
        meta: mergeMeta(incomingMeta, {
          tournament_slug: tournamentSlug
        })
      })

      return json(req, 500, { error: "Score save failed" })
    }

    const acceptedReason: SubmissionReason = row.updated
      ? "best_updated"
      : row.kept_best
        ? "kept_existing_best"
        : "accepted"

    await logSubmission({
      tournamentId: tournament.id,
      userId: user.id,
      sessionId: session.id,
      sessionNonce,
      deviceType,
      submittedScore: score,
      accepted: true,
      acceptedScore: row.final_score,
      keptBest: !!row.kept_best,
      updatedBest: !!row.updated,
      reason: acceptedReason,
      meta: mergeMeta(incomingMeta, {
        tournament_slug: tournamentSlug
      })
    })

    return json(req, 200, {
      ok: true,
      updated: !!row.updated,
      kept_best: !!row.kept_best,
      final_score: row.final_score
    })
  } catch (error: any) {
    console.error("[secure tournament submit] unhandled error:", error)
    return json(req, 500, {
      error: error?.message || "Internal server error"
    })
  }
})