<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import GamePlayer from '~/components/arcade/GamePlayer.vue'

definePageMeta({
  layout: 'embed',
  ssr: false,
  keepalive: false,
  middleware: 'subscription-required'
})

const route = useRoute()
const toast = useToast()
const { bySlug } = useTournaments()

const tournamentSlug = computed(() =>
  String(route.params.tournamentSlug || '').trim()
)

type AnyTournament = any
type DeviceType = 'Mobile' | 'PC' | 'Emulator'

type StartSessionResponse = {
  ok: boolean
  sessionId: string
  sessionNonce: string
  startedAt: string
  expiresAt: string
  status: string
  wsTicket: string
  wsTicketExp: number
}

type WsServerMessage =
  | { type: 'WELCOME'; sessionId?: string; message?: string }
  | {
      type: 'HELLO_ACK'
      ok?: boolean
      sessionId?: string
      tournamentSlug?: string
      serverTime?: number
      ticketExp?: number
    }
  | { type: 'PONG'; ts?: number }
  | { type: 'KEEPALIVE_ACK'; ts?: number }
  | { type: 'RUN_EVENT_ACK'; eventType?: string; value?: number; ts?: number }
  | { type: 'FINISH_ACK'; ts?: number }
  | { type: 'ERROR'; code?: string; message?: string }

type RunEventPayload = {
  eventType: string
  value: number
  raw?: any
}

type CanvasAuditSample = {
  seq: number | null
  phase: string | null
  capturedAt: string | null
  elapsedMs: number | null
  canvas: { width: number | null; height: number | null } | null
  frame: { width: number | null; height: number | null } | null
  container: { width: number | null; height: number | null } | null
  canvasRatio: number | null
  frameRatio: number | null
  orientation: string | null
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

/* ---------------- Device Fingerprint Type ---------------- */
type DeviceFingerprint = {
  // Classification result
  deviceType: DeviceType

  // Raw signals sent to server for validation
  signals: {
    // UA-derived (weakest — emulators spoof freely)
    uaMobile: boolean
    uaAndroid: boolean
    uaIOS: boolean
    uaEmulatorKeyword: boolean
    platform: string

    // Hardware capacity (reflects HOST machine for emulators)
    cores: number
    memory: number // deviceMemory GB
    dpr: number

    // Pointer / input
    maxTouchPoints: number
    hasTouchApi: boolean
    hasMousePointer: boolean // pointer: fine

    // WebGL (emulators often passthrough host GPU now)
    glRenderer: string
    glVendor: string
    glIsSoftware: boolean // SwiftShader / llvmpipe etc.

    // Touch quality (strongest client-side signal)
    // Real capacitive screens: radiusX/Y > 0, force > 0
    // Emulators: synthetic events with all zeros
    touchQuality: 'real' | 'fake' | 'none' | 'timeout'

    // Sensor (good but needs permission on iOS 13+)
    sensorSignal: 'real' | 'static' | 'unavailable' | 'not_checked'
    sensorVariance: number

    // Network hint (not Safari-compatible — -1 when unavailable)
    connectionRtt: number
    connectionDownlink: number
    connectionType: string

    // Geometry mismatches (emulators in windowed mode often leak these)
    outerInnerGap: number
    screenEqualsViewport: boolean

    // Battery (emulators often stuck at 100% or throw)
    batteryLevel: number   // 0–1, -1 if unavailable
    batteryCharging: boolean | null

    // Timing: how long the sensor check actually took (emulators can fire
    // synthetic motion events instantly to pass the check)
    sensorCheckDurationMs: number
  }
}

const t = ref<AnyTournament | null>(null)
const loading = ref(true)
const err = ref<string | null>(null)

const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

const rootEl = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const fullscreenHistoryArmed = ref(false)
const canUseFullscreen = ref(false)
const deviceType = ref<DeviceType>('PC')
const deviceFingerprint = ref<DeviceFingerprint | null>(null)

/* ---------------- Session State ---------------- */
const sessionLoading = ref(false)
const sessionId = ref('')
const sessionNonce = ref('')
const sessionStartedAt = ref('')
const sessionExpiresAt = ref('')
const wsTicket = ref('')
const wsTicketExp = ref(0)

function resetSessionState() {
  sessionLoading.value = false
  sessionId.value = ''
  sessionNonce.value = ''
  sessionStartedAt.value = ''
  sessionExpiresAt.value = ''
  wsTicket.value = ''
  wsTicketExp.value = 0
  resetSubmissionMeta()
}

/* ---------------- WebSocket State ---------------- */
const ws = ref<WebSocket | null>(null)
const wsConnected = ref(false)
const wsAuthed = ref(false)
const wsLastPongAt = ref(0)
const wsLastRunEventAt = ref(0)
const wsLastRunEventAckAt = ref(0)
const wsClosingIntentional = ref(false)

let wsPingTimer: ReturnType<typeof setInterval> | null = null
let wsKeepAliveTimer: ReturnType<typeof setInterval> | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null

function resetWsFlags() {
  wsConnected.value = false
  wsAuthed.value = false
  wsLastPongAt.value = 0
  wsLastRunEventAt.value = 0
  wsLastRunEventAckAt.value = 0
}

function clearWsTimers() {
  if (wsPingTimer) { clearInterval(wsPingTimer); wsPingTimer = null }
  if (wsKeepAliveTimer) { clearInterval(wsKeepAliveTimer); wsKeepAliveTimer = null }
  if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null }
}

function cleanupWebSocket() {
  clearWsTimers()
  resetWsFlags()
  wsClosingIntentional.value = true
  try { ws.value?.close() } catch {}
  ws.value = null
  setTimeout(() => { wsClosingIntentional.value = false }, 0)
}

function getWsUrl() {
  if (typeof window === 'undefined' || !sessionId.value) return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/tournament/${sessionId.value}`
}

function scheduleWsReconnect() {
  if (!isPlayable.value || !sessionReady.value) return
  if (wsReconnectTimer) return
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    connectTournamentSocket()
  }, 2000)
}

function sendWsJson(payload: Record<string, any>) {
  if (!ws.value) return false
  if (ws.value.readyState !== WebSocket.OPEN) return false
  if (!wsAuthed.value) return false
  try {
    ws.value.send(JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

function connectTournamentSocket() {
  if (typeof window === 'undefined') return
  if (!sessionReady.value || !tournamentSlug.value || !wsTicket.value) return

  clearWsTimers()
  resetWsFlags()
  wsClosingIntentional.value = false

  try { ws.value?.close() } catch {}

  const url = getWsUrl()
  if (!url) return

  const socket = new WebSocket(url)
  ws.value = socket

  socket.onopen = () => {
    wsConnected.value = true
    socket.send(JSON.stringify({
      type: 'HELLO',
      sessionId: sessionId.value,
      sessionNonce: sessionNonce.value,
      tournamentSlug: tournamentSlug.value,
      deviceType: deviceType.value,
      wsTicket: wsTicket.value,
      wsTicketExp: wsTicketExp.value
    }))
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(String(event.data || '{}')) as WsServerMessage

      if (data.type === 'HELLO_ACK') {
        wsAuthed.value = true
        wsLastPongAt.value = Date.now()
        if (typeof data.ticketExp === 'number') wsTicketExp.value = data.ticketExp
        return
      }
      if (data.type === 'PONG') { wsLastPongAt.value = Date.now(); return }
      if (data.type === 'KEEPALIVE_ACK') { wsLastPongAt.value = Date.now(); return }
      if (data.type === 'RUN_EVENT_ACK') { wsLastRunEventAckAt.value = Date.now(); return }
      if (data.type === 'ERROR') console.warn('[Tournament WS]', data.code, data.message)
    } catch (error) {
      console.warn('[Tournament WS] Failed to parse message', error)
    }
  }

  socket.onclose = () => {
    wsConnected.value = false
    wsAuthed.value = false
    if (!wsClosingIntentional.value && isPlayable.value && sessionReady.value) {
      scheduleWsReconnect()
    }
  }

  socket.onerror = () => { wsConnected.value = false }

  wsPingTimer = setInterval(() => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN || !wsAuthed.value) return
    ws.value.send(JSON.stringify({ type: 'PING', ts: Date.now() }))
  }, 15000)

  wsKeepAliveTimer = setInterval(() => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN || !wsAuthed.value) return
    ws.value.send(JSON.stringify({ type: 'KEEPALIVE', ts: Date.now() }))
  }, 60000)
}

function sendWsFinish() {
  sendWsJson({ type: 'FINISH' })
}

/* ---------------- Score Submit State ---------------- */
const bestQueuedScore = ref(0)
const bestSentScore = ref(0)
const submitInFlight = ref(false)
const lastSubmitErrorAt = ref(0)
const restarting = ref(false)

function resetScoreSubmitState() {
  bestQueuedScore.value = 0
  bestSentScore.value = 0
  submitInFlight.value = false
  lastSubmitErrorAt.value = 0
}

/* ---------------- RUN_EVENT throttling ---------------- */
const runEventThrottleMs = 250
const runEventLastSentByType = new Map<string, number>()

function shouldSendRunEvent(eventType: string) {
  const nowMs = Date.now()
  const last = runEventLastSentByType.get(eventType) || 0
  if (nowMs - last < runEventThrottleMs) return false
  runEventLastSentByType.set(eventType, nowMs)
  return true
}

function clearRunEventThrottle() {
  runEventLastSentByType.clear()
}

/* ---------------- Canvas audit meta ---------------- */
const canvasAuditStartedAt = ref<string | null>(null)
const canvasAuditSamples = ref<CanvasAuditSample[]>([])
const canvasAuditLatest = ref<CanvasAuditSample | null>(null)
const canvasAuditGameOver = ref<CanvasAuditSample | null>(null)

function resetSubmissionMeta() {
  canvasAuditStartedAt.value = null
  canvasAuditSamples.value = []
  canvasAuditLatest.value = null
  canvasAuditGameOver.value = null
}

function normalizeFiniteNumber(value: any) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeSize(raw: any) {
  if (!raw || typeof raw !== 'object') return null
  return {
    width: normalizeFiniteNumber(raw.width),
    height: normalizeFiniteNumber(raw.height)
  }
}

function normalizeCanvasAuditSample(raw: any): CanvasAuditSample | null {
  if (!raw || typeof raw !== 'object') return null
  return {
    seq: normalizeFiniteNumber(raw.seq),
    phase: raw.phase ? String(raw.phase) : null,
    capturedAt: raw.capturedAt ? String(raw.capturedAt) : null,
    elapsedMs: normalizeFiniteNumber(raw.elapsedMs),
    canvas: normalizeSize(raw.canvas),
    frame: normalizeSize(raw.frame),
    container: normalizeSize(raw.container),
    canvasRatio: normalizeFiniteNumber(raw.canvasRatio),
    frameRatio: normalizeFiniteNumber(raw.frameRatio),
    orientation: raw.orientation ? String(raw.orientation) : null
  }
}

function pushCanvasAuditSample(sample: CanvasAuditSample) {
  const seq = sample.seq ?? null

  if (seq != null) {
    const existingIndex = canvasAuditSamples.value.findIndex(item => item.seq === seq)
    if (existingIndex >= 0) {
      canvasAuditSamples.value[existingIndex] = sample
    } else {
      canvasAuditSamples.value.push(sample)
      canvasAuditSamples.value.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    }
  } else {
    canvasAuditSamples.value.push(sample)
  }

  canvasAuditLatest.value = sample
  if (sample.phase === 'game_over') canvasAuditGameOver.value = sample
}

function buildSyntheticGameOverFromLatest() {
  const latest = canvasAuditLatest.value
  if (!latest) return null
  return {
    ...latest,
    phase: 'game_over_fallback',
    seq: latest.seq,
    capturedAt: latest.capturedAt,
    elapsedMs: latest.elapsedMs
  }
}

function buildSubmissionMeta() {
  const finalGameOver = canvasAuditGameOver.value || buildSyntheticGameOverFromLatest()
  return {
    canvas_audit: {
      startedAt: canvasAuditStartedAt.value,
      samples: canvasAuditSamples.value,
      latest: canvasAuditLatest.value,
      gameOver: finalGameOver,
      summary: {
        sampleCount: canvasAuditSamples.value.length,
        hasRealGameOver: !!canvasAuditGameOver.value,
        usedFallbackGameOver: !canvasAuditGameOver.value && !!canvasAuditLatest.value,
        suspiciousLandscapeCanvas: canvasAuditSamples.value.some(sample => {
          const w = sample.canvas?.width ?? 0
          const h = sample.canvas?.height ?? 0
          return !!w && !!h && w > h
        })
      }
    },
    // Include full fingerprint in every submission for server-side analysis
    deviceFingerprint: deviceFingerprint.value ?? null
  }
}

function onWindowMessage(event: MessageEvent) {
  const data = event.data
  if (!data || typeof data !== 'object') return

  const type = String((data as any).type || '').trim()
  if (type !== 'IA_CANVAS_AUDIT') return

  const sample = normalizeCanvasAuditSample((data as any).payload)
  if (!sample) return

  if (!canvasAuditStartedAt.value && sample.capturedAt) {
    canvasAuditStartedAt.value = sample.capturedAt
  }

  pushCanvasAuditSample(sample)
}

/* ---------------- Secure Submit Helpers ---------------- */
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
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function importPublicKey(publicKeyPem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
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
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = stringToArrayBuffer(JSON.stringify(payload))

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext
  )

  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey)
  const publicKey = await importPublicKey(publicKeyPem)

  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
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

async function submitEncryptedScore(scoreToSend: number) {
  const { keyId, publicKey } = await $fetch<SubmitPublicKeyResponse>(
    '/api/tournaments/submit-public-key'
  )

  const submitPayload = {
    tournamentSlug: tournamentSlug.value,
    score: scoreToSend,
    deviceType: deviceType.value,
    sessionId: sessionId.value,
    sessionNonce: sessionNonce.value,
    meta: buildSubmissionMeta()
  }

  const encryptedBody = await encryptTournamentSubmitPayload(
    submitPayload,
    keyId,
    publicKey
  )

  const supabase = useSupabaseClient()

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    throw new Error('You must be logged in to submit score')
  }

  let { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
    if (refreshErr || !refreshed?.session?.access_token) {
      throw new Error('Unable to refresh login session')
    }
    session = refreshed.session
  }

  const accessToken = session.access_token

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseAnonKey = config.public.supabaseAnonKey

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase public config')
  }

  const functionUrl = `${supabaseUrl}/functions/v1/tournament-submit-secure`

  return await $fetch<{
    ok?: boolean
    updated?: boolean
    kept_best?: boolean
    final_score?: number
  }>(functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey
    },
    body: encryptedBody
  })
}

/* ---------------- Helpers ---------------- */
function getGameSlug(x: AnyTournament) {
  return String(x?.game_slug ?? x?.gameSlug ?? '').trim()
}
function getStartsAt(x: AnyTournament) {
  return String(x?.starts_at ?? x?.startsAt ?? '').trim()
}
function getEndsAt(x: AnyTournament) {
  return String(x?.ends_at ?? x?.endsAt ?? '').trim()
}
function getStatus(x: AnyTournament) {
  return String(x?.status || 'scheduled') as 'scheduled' | 'live' | 'ended' | 'canceled'
}
function safeTimeMs(s: string) {
  const ms = new Date(s).getTime()
  return Number.isFinite(ms) ? ms : 0
}
function msToClock(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '00D:00H:00M'
  const totalMinutes = Math.floor(ms / 1000 / 60)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return `${String(days).padStart(2, '0')}D:${String(hours).padStart(2, '0')}H:${String(minutes).padStart(2, '0')}M`
}
function getFullscreenRequestEl(el: any) {
  if (!el) return null
  return el.requestFullscreen || el.webkitRequestFullscreen || el.webkitEnterFullscreen || null
}
function getFullscreenExitDoc(doc: any) {
  if (!doc) return null
  return doc.exitFullscreen || doc.webkitExitFullscreen || null
}
function detectFullscreenSupport() {
  if (typeof document === 'undefined') return false
  const el: any = rootEl.value || document.documentElement
  const requestFn = getFullscreenRequestEl(el)
  const enabled = typeof document.fullscreenEnabled === 'boolean' ? document.fullscreenEnabled : true
  return !!requestFn && enabled
}
function withQuery(url: string, params: Record<string, string | number | boolean | null | undefined>) {
  const [base, hash = ''] = url.split('#')
  const [path, search = ''] = base.split('?')
  const qs = new URLSearchParams(search)
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    qs.set(key, String(value))
  }
  const queryString = qs.toString()
  return `${path}${queryString ? `?${queryString}` : ''}${hash ? `#${hash}` : ''}`
}

/* ================================================================
   DEVICE DETECTION — rewritten
   ================================================================

   Strategy (in order of reliability):

   1. Touch event metadata         — STRONGEST client-side signal
      Real capacitive screens always produce radiusX/Y > 0 and
      force > 0. Emulators inject synthetic MouseEvent-backed touch
      events where every metadata field is 0. This cannot be easily
      faked without patching the browser's native event path.

   2. Sensor variance + timing     — STRONG, but needs permission (iOS)
      Real devices held in hand have micro-jitter. Emulators either
      output 0,0,0 every tick or replay a static vector. We also
      record HOW FAST events fired — emulators can dispatch 8 events
      in <10ms to race through the threshold; real devices fire at
      ~60 Hz (≈133ms for 8 events).

   3. Network RTT                  — MEDIUM (unavailable in Safari)
      Desktop LAN connections show <10ms RTT. Real cellular mobile
      is 30–200ms. Emulators share the desktop's LAN.

   4. Battery API                  — MEDIUM (deprecated/unavailable many browsers)
      Emulators often report 100% + charging indefinitely, or throw.

   5. WebGL renderer               — WEAK (modern emulators passthrough GPU)
      Still catches software renderers (SwiftShader, llvmpipe).

   6. UA string                    — WEAKEST, used only as tiebreaker
      Emulators spoof this trivially. We never use it as primary.

   Classification rules:
   - touchQuality === 'real'                   → Mobile (hardware confirmed)
   - sensorSignal === 'real' (with timing ok)  → Mobile (strong corroboration)
   - uaMobile + multiple PC-class hardware     → Emulator
   - uaMobile + no suspicious hardware         → Mobile (best guess)
   - else                                      → PC
================================================================ */

function getWebGLInfo(): { renderer: string; vendor: string; isSoftware: boolean } {
  let renderer = ''
  let vendor = ''
  try {
    const canvas = document.createElement('canvas')
    const gl = (
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    ) as WebGLRenderingContext | null

    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) {
        renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
        vendor = String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '')
      }
    }
  } catch {}

  const isSoftware = /SwiftShader|llvmpipe|softpipe|Microsoft Basic Render/i.test(renderer)
  return { renderer, vendor, isSoftware }
}

/**
 * Waits for up to `timeoutMs` for a real touch event and inspects
 * its metadata. Returns immediately if we can tell no touch hardware
 * exists at all (maxTouchPoints === 0 and no touch API).
 *
 * Real capacitive screens:   radiusX > 0 || radiusY > 0 || force > 0
 * Emulator injected touches: all metadata fields are 0
 */
function collectTouchQuality(timeoutMs = 4000): Promise<'real' | 'fake' | 'none' | 'timeout'> {
  return new Promise(resolve => {
    // No touch hardware at all
    if (
      typeof window === 'undefined' ||
      (!('ontouchstart' in window) && navigator.maxTouchPoints === 0)
    ) {
      return resolve('none')
    }

    let settled = false

    function done(result: 'real' | 'fake' | 'none' | 'timeout') {
      if (settled) return
      settled = true
      window.removeEventListener('touchstart', handler, true)
      resolve(result)
    }

    function handler(e: TouchEvent) {
      const touch = e.changedTouches?.[0] ?? e.touches?.[0]
      if (!touch) return done('fake')

      const rx = Number(touch.radiusX ?? 0)
      const ry = Number(touch.radiusY ?? 0)
      const force = Number((touch as any).force ?? 0)
      // Some browsers expose touchType ('stylus' vs 'direct')
      const touchType = String((touch as any).touchType ?? '')

      const isReal = rx > 0 || ry > 0 || force > 0 || touchType === 'direct'
      done(isReal ? 'real' : 'fake')
    }

    // Use capture phase so we get the rawest event before any framework
    window.addEventListener('touchstart', handler, { passive: true, capture: true })
    setTimeout(() => done('timeout'), timeoutMs)
  })
}

/**
 * Listens to DeviceMotionEvent for up to `maxEvents` samples or
 * `timeoutMs` ms. Returns the signal quality and variance, plus
 * the actual elapsed time (emulators fire events far too fast).
 */
function collectSensorSignal(
  maxEvents = 8,
  timeoutMs = 1800
): Promise<{
  signal: 'real' | 'static' | 'unavailable' | 'not_checked'
  variance: number
  durationMs: number
}> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') {
      return resolve({ signal: 'not_checked', variance: 0, durationMs: 0 })
    }

    const startedAt = Date.now()
    let count = 0
    const values: number[] = []

    function finish() {
      window.removeEventListener('devicemotion', handler as EventListener)
      const durationMs = Date.now() - startedAt

      if (count === 0) {
        return resolve({ signal: 'unavailable', variance: 0, durationMs })
      }

      const mean = values.reduce((s, v) => s + v, 0) / values.length
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length

      // Emulators that try to fake the sensor may fire all 8 events in <50ms.
      // Real devices fire at ~60 Hz so 8 events take ≥100ms.
      const suspiciouslyFast = durationMs < 80 && count >= maxEvents

      if (suspiciouslyFast) {
        return resolve({ signal: 'static', variance, durationMs })
      }

      if (variance > 0.001) {
        resolve({ signal: 'real', variance, durationMs })
      } else if (values.some(v => v !== 0)) {
        resolve({ signal: 'static', variance, durationMs })
      } else {
        resolve({ signal: 'unavailable', variance, durationMs })
      }
    }

    function handler(e: DeviceMotionEvent) {
      count++
      const a = e.accelerationIncludingGravity
      values.push(
        Number(a?.x ?? 0),
        Number(a?.y ?? 0),
        Number(a?.z ?? 0)
      )
      if (count >= maxEvents) finish()
    }

    window.addEventListener('devicemotion', handler as EventListener)
    setTimeout(finish, timeoutMs)
  })
}

/**
 * Reads battery info. Returns -1 for level if unavailable.
 * Emulators often report level=1, charging=true indefinitely.
 */
async function collectBatteryInfo(): Promise<{
  level: number
  charging: boolean | null
}> {
  try {
    const nav: any = navigator
    if (typeof nav.getBattery !== 'function') return { level: -1, charging: null }
    const battery = await nav.getBattery()
    return {
      level: Number(battery.level ?? -1),
      charging: typeof battery.charging === 'boolean' ? battery.charging : null
    }
  } catch {
    return { level: -1, charging: null }
  }
}

/**
 * Main device detection. Runs all probes in parallel where possible,
 * then classifies based on the combined signal set.
 *
 * The touch quality probe waits up to 4s for the first touch.
 * Everything else resolves independently. We wait for sensor (1.8s
 * max) and battery concurrently while the tournament data is already
 * loading, so the wall-clock cost is hidden behind the API call.
 *
 * Call this at the START of onMounted, before init(), so that by the
 * time createRunSession() is called, deviceType is already set.
 * The touch probe continues in the background and updates deviceType
 * if it gets a definitive answer before score submission.
 */
async function buildDeviceFingerprint(): Promise<DeviceFingerprint> {
  const nav: any = navigator

  // ── Static signals (synchronous) ─────────────────────────────────
  const ua = String(nav.userAgent || '')
  const platform = String(nav.platform || '')
  const cores = Number(nav.hardwareConcurrency || 0)
  const memory = Number(nav.deviceMemory || 0)
  const dpr = Number(window.devicePixelRatio || 1)
  const maxTouchPoints = Number(nav.maxTouchPoints || 0)
  const hasTouchApi = 'ontouchstart' in window
  const hasMousePointer = !!window.matchMedia?.('(pointer: fine)').matches

  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)
  const uaAndroid = /Android/i.test(ua)
  const uaIOS = /iPhone|iPad|iPod/i.test(ua)
  const uaEmulatorKeyword = /Emulator|sdk_gphone|sdk_phone|generic|Andy\b/i.test(ua)

  const outerInnerGap = Math.max(
    Math.abs(window.outerWidth - window.innerWidth),
    Math.abs(window.outerHeight - window.innerHeight)
  )
  const screenEqualsViewport =
    window.screen.width === window.innerWidth &&
    window.screen.height === window.innerHeight

  const { renderer: glRenderer, vendor: glVendor, isSoftware: glIsSoftware } = getWebGLInfo()

  const connectionRtt = Number(nav.connection?.rtt ?? -1)
  const connectionDownlink = Number(nav.connection?.downlink ?? -1)
  const connectionType = String(nav.connection?.effectiveType ?? nav.connection?.type ?? '')

  // ── Async signals (run in parallel) ──────────────────────────────
  // Touch probe runs independently — we do NOT await it here so it
  // doesn't block classification. We await the shorter probes only.
  const [sensorResult, batteryResult] = await Promise.all([
    collectSensorSignal(),
    collectBatteryInfo()
  ])

  // Touch probe: start it now, we'll collect its result later if
  // still pending. For classification, we use what we have.
  // (The probe was started at component mount, see onMounted.)

  // ── Classification ───────────────────────────────────────────────
  // We build a score only for Emulator detection. Mobile vs PC is
  // decided by positive hardware evidence, not by a score.

  let emulatorScore = 0

  // Hard Emulator signals
  if (uaEmulatorKeyword) emulatorScore += 50
  if (glIsSoftware) emulatorScore += 45

  // Desktop GPU in a mobile UA — modern emulators passthrough GPU
  // so this now only adds a small weight rather than a large one
  if (uaMobile && /NVIDIA|AMD Radeon|GeForce|Intel.*Iris|Intel.*UHD|Intel.*HD Graphics/i.test(glRenderer)) {
    emulatorScore += 20
  }

  // Desktop platform string with mobile UA
  if (uaMobile && /Win32|Win64|WOW64|MacIntel|MacPPC/i.test(platform)) emulatorScore += 35
  if (uaMobile && /Linux x86_64/i.test(platform)) emulatorScore += 25

  // Implausibly high hardware specs for a real phone
  if (uaMobile && cores > 12) emulatorScore += 15
  if (uaMobile && memory >= 16) emulatorScore += 15

  // Touch + fine pointer simultaneously (emulators with mouse passthrough)
  if (uaMobile && hasTouchApi && hasMousePointer) emulatorScore += 20

  // No touch API at all despite mobile UA
  if (uaMobile && !hasTouchApi && maxTouchPoints === 0) emulatorScore += 20

  // Sensor: static or unavailable on a supposedly mobile device
  // Weight is small — real phones with no permission also show unavailable
  if (uaMobile && sensorResult.signal === 'static') emulatorScore += 15
  if (uaMobile && sensorResult.signal === 'unavailable') emulatorScore += 5
  // Suspiciously fast sensor events
  if (uaMobile && sensorResult.durationMs < 80 && sensorResult.signal !== 'not_checked') {
    emulatorScore += 20
  }

  // Desktop-class network latency with mobile UA
  if (uaMobile && connectionRtt >= 0 && connectionRtt < 8) emulatorScore += 15

  // Battery always at 100% + always charging = typical emulator default
  if (uaMobile && batteryResult.level === 1 && batteryResult.charging === true) {
    emulatorScore += 10
  }

  // Outer/inner size gap typical of browser chrome on desktop
  if (uaMobile && outerInnerGap > 150) emulatorScore += 15

  // ── Final classification ──────────────────────────────────────────
  // Priority order:
  // 1. Emulator score threshold  (hardware evidence overrides UA)
  // 2. Sensor 'real'             (strong positive mobile evidence)
  // 3. UA-based mobile           (weakest — only used if nothing contradicts)

  let classification: DeviceType

  if (emulatorScore >= 45) {
    classification = 'Emulator'
  } else if (sensorResult.signal === 'real') {
    // Real motion sensor = definitely a physical device
    classification = 'Mobile'
  } else if (uaAndroid || uaIOS) {
    // UA says mobile and no strong contradicting signals
    classification = 'Mobile'
  } else if (uaMobile && (hasTouchApi || maxTouchPoints > 0)) {
    classification = 'Mobile'
  } else {
    classification = 'PC'
  }

  return {
    deviceType: classification,
    signals: {
      uaMobile,
      uaAndroid,
      uaIOS,
      uaEmulatorKeyword,
      platform,
      cores,
      memory,
      dpr,
      maxTouchPoints,
      hasTouchApi,
      hasMousePointer,
      glRenderer,
      glVendor,
      glIsSoftware,
      touchQuality: 'timeout', // will be updated when touch probe resolves
      sensorSignal: sensorResult.signal,
      sensorVariance: sensorResult.variance,
      connectionRtt,
      connectionDownlink,
      connectionType,
      outerInnerGap,
      screenEqualsViewport,
      batteryLevel: batteryResult.level,
      batteryCharging: batteryResult.charging,
      sensorCheckDurationMs: sensorResult.durationMs
    }
  }
}

/**
 * Starts the touch quality probe in the background. When it
 * resolves, updates deviceFingerprint and potentially upgrades
 * an ambiguous classification. Must be called after mount.
 */
let touchProbePromise: Promise<'real' | 'fake' | 'none' | 'timeout'> | null = null

function startTouchProbe() {
  touchProbePromise = collectTouchQuality(4000)

  touchProbePromise.then(quality => {
    if (!deviceFingerprint.value) return

    // Update the stored signal
    deviceFingerprint.value.signals.touchQuality = quality

    if (quality === 'real') {
      // Confirmed physical capacitive screen — override to Mobile
      // unless we already have very strong emulator evidence
      const wasEmulator = deviceFingerprint.value.deviceType === 'Emulator'

      // Only override emulator classification if sensor also said real
      // (both sensors AND touch real = certainly not an emulator)
      const sensorAlsoReal = deviceFingerprint.value.signals.sensorSignal === 'real'

      if (!wasEmulator || sensorAlsoReal) {
        deviceFingerprint.value.deviceType = 'Mobile'
        deviceType.value = 'Mobile'
      }
    } else if (quality === 'fake') {
      // Synthetic touch with zero metadata — upgrade to Emulator
      // if we already suspect it's not a real PC
      const fp = deviceFingerprint.value
      if (fp.signals.uaMobile && fp.deviceType !== 'PC') {
        fp.deviceType = 'Emulator'
        deviceType.value = 'Emulator'
      }
    }
    // 'none' or 'timeout' — no touch came in, don't change classification
  })
}

/* ---------------- Time Logic ---------------- */
const startMs = computed(() => (t.value ? safeTimeMs(getStartsAt(t.value)) : 0))
const endMs = computed(() => (t.value ? safeTimeMs(getEndsAt(t.value)) : 0))
const startsInMs = computed(() => Math.max(0, startMs.value - now.value))
const endsInMs = computed(() => Math.max(0, endMs.value - now.value))

const inTimeWindow = computed(() => {
  if (!startMs.value || !endMs.value) return false
  return now.value >= startMs.value && now.value < endMs.value
})

const isPlayable = computed(() => {
  if (!t.value) return false
  const st = getStatus(t.value)
  if (st === 'canceled' || st === 'ended') return false
  return inTimeWindow.value
})

const game = computed(() => {
  if (!t.value) return null
  return GAMES.find((g) => g.slug === getGameSlug(t.value)) || null
})

const sessionReady = computed(() =>
  !!sessionId.value &&
  !!sessionNonce.value &&
  !!sessionStartedAt.value &&
  !!sessionExpiresAt.value &&
  !!wsTicket.value &&
  wsTicketExp.value > 0
)

const resolvedGame = computed(() => {
  if (!game.value || !sessionReady.value) return null
  return {
    ...game.value,
    sourceUrl: withQuery(game.value.sourceUrl, {
      tournamentSlug: tournamentSlug.value,
      sessionId: sessionId.value,
      sessionNonce: sessionNonce.value,
      deviceType: deviceType.value,
      startedAt: sessionStartedAt.value,
      expiresAt: sessionExpiresAt.value
    })
  }
})

useHead(() => ({
  title: t.value ? `${t.value.title} — Play` : 'Tournament — Play',
  meta: [
    { name: 'robots', content: 'noindex' },
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no'
    },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' }
  ]
}))

/* ---------------- Force GamePlayer Remount ---------------- */
const playerMountKey = ref(0)
function refreshPlayerMount() {
  playerMountKey.value = Date.now()
}

/* ---------------- Fullscreen ---------------- */
function syncFullscreenState() {
  const d: any = document
  isFullscreen.value = !!(d.fullscreenElement || d.webkitFullscreenElement)
}

function armMobileBackExit() {
  if (fullscreenHistoryArmed.value || !canUseFullscreen.value) return
  history.pushState({ tournamentFullscreen: true }, '')
  fullscreenHistoryArmed.value = true
}

function disarmMobileBackExit() {
  fullscreenHistoryArmed.value = false
}

async function enterFullscreen() {
  if (!canUseFullscreen.value) return
  try {
    const el: any = rootEl.value || document.documentElement
    const requestFn = getFullscreenRequestEl(el)
    if (!requestFn) return
    if (!document.fullscreenElement) await requestFn.call(el)
    syncFullscreenState()
    armMobileBackExit()
  } catch {
    toast.add({
      title: 'Fullscreen unavailable',
      description: 'Fullscreen is not supported on this browser/device.',
      color: 'warning'
    })
  }
}

async function exitFullscreen() {
  try {
    const doc: any = document
    const exitFn = getFullscreenExitDoc(doc)
    if (doc.fullscreenElement && exitFn) await exitFn.call(doc)
  } catch {}
  syncFullscreenState()
  disarmMobileBackExit()
}

async function toggleFullscreen() {
  if (!canUseFullscreen.value) return
  if (isFullscreen.value) await exitFullscreen()
  else await enterFullscreen()
}

/* ---------------- Session Flow ---------------- */
let initToken = 0

async function loadTournamentSafe() {
  try {
    const api = await bySlug(tournamentSlug.value)
    if (api) return api
  } catch {}
  return (FALLBACK as any).find((x: any) => x.slug === tournamentSlug.value) || null
}

async function createRunSession() {
  if (!tournamentSlug.value) throw new Error('Missing tournament slug')

  sessionLoading.value = true
  try {
    const res = await $fetch<StartSessionResponse>('/api/tournaments/start-session', {
      method: 'POST',
      credentials: 'include',
      body: {
        tournamentSlug: tournamentSlug.value,
        deviceType: deviceType.value,
        // Send the full fingerprint so server can validate/override
        deviceFingerprint: deviceFingerprint.value
          ? {
              signals: deviceFingerprint.value.signals
            }
          : undefined
      }
    })

    if (!res?.ok || !res.sessionId || !res.sessionNonce || !res.wsTicket) {
      throw new Error('Failed to start tournament session')
    }

    sessionId.value = String(res.sessionId)
    sessionNonce.value = String(res.sessionNonce)
    sessionStartedAt.value = String(res.startedAt || '')
    sessionExpiresAt.value = String(res.expiresAt || '')
    wsTicket.value = String(res.wsTicket || '')
    wsTicketExp.value = Number(res.wsTicketExp || 0)
  } finally {
    sessionLoading.value = false
  }
}

async function init() {
  const myToken = ++initToken
  loading.value = true
  err.value = null
  t.value = null

  resetScoreSubmitState()
  clearRunEventThrottle()
  cleanupWebSocket()
  resetSessionState()

  try {
    const found = await loadTournamentSafe()
    if (myToken !== initToken) return

    if (!found) { err.value = 'Tournament not found'; return }

    t.value = found
    if (!game.value) { err.value = 'Game not found'; return }
    if (!isPlayable.value) return

    await createRunSession()
    if (myToken !== initToken) return

    if (!sessionReady.value) { err.value = 'Failed to create play session'; return }

    connectTournamentSocket()
    refreshPlayerMount()
  } catch (e: any) {
    if (myToken !== initToken) return
    err.value = e?.data?.message || e?.message || 'Failed to load'
  } finally {
    if (myToken === initToken) loading.value = false
  }
}

async function restartRun() {
  if (restarting.value) return
  restarting.value = true
  try {
    sendWsFinish()
    clearRunEventThrottle()
    cleanupWebSocket()
    resetScoreSubmitState()
    resetSessionState()

    await createRunSession()

    if (!sessionReady.value) throw new Error('Failed to create a new run session')

    connectTournamentSocket()
    refreshPlayerMount()
  } catch (e: any) {
    toast.add({
      title: 'Restart failed',
      description: e?.data?.message || e?.message || 'Could not restart the run',
      color: 'error'
    })
  } finally {
    restarting.value = false
  }
}

async function onRestartRequest() {
  if (!isPlayable.value) return
  await restartRun()
}

function onRunEvent(payload: RunEventPayload) {
  if (!sessionReady.value || !wsAuthed.value) return

  const eventType = String(payload.eventType || '').trim().slice(0, 64)
  const value = Number.isFinite(payload.value) ? Math.floor(payload.value) : 0

  if (!eventType) return
  if (!shouldSendRunEvent(eventType)) return

  const sent = sendWsJson({
    type: 'RUN_EVENT',
    eventType,
    value,
    ts: Date.now()
  })

  if (sent) wsLastRunEventAt.value = Date.now()
}

/* ---------------- Navigation ---------------- */
async function closePage() {
  sendWsFinish()
  if (isFullscreen.value) await exitFullscreen()
  cleanupWebSocket()
  await navigateTo(`/tournaments/${tournamentSlug.value}`)
}

/* ---------------- Score Submit ---------------- */
async function flushBestScore() {
  if (submitInFlight.value) return
  if (!isPlayable.value) return
  if (!sessionReady.value) return
  if (bestQueuedScore.value <= bestSentScore.value) return

  submitInFlight.value = true
  try {
    const scoreToSend = bestQueuedScore.value
    const res = await submitEncryptedScore(scoreToSend)
    const finalScore = Number(res?.final_score ?? scoreToSend)

    bestSentScore.value = Math.max(
      bestSentScore.value,
      Number.isFinite(finalScore) ? finalScore : scoreToSend
    )

    if (bestQueuedScore.value > bestSentScore.value && isPlayable.value) {
      submitInFlight.value = false
      await flushBestScore()
      return
    }
  } catch (e: any) {
    const nowMs = Date.now()
    if (nowMs - lastSubmitErrorAt.value > 2500) {
      toast.add({
        title: 'Score submit failed',
        description: e?.data?.error || e?.data?.message || e?.message || 'Try again',
        color: 'error'
      })
      lastSubmitErrorAt.value = nowMs
    }
  } finally {
    submitInFlight.value = false
  }
}

async function onScore(score: number) {
  if (!isPlayable.value || !sessionReady.value) return
  if (!Number.isFinite(score)) return

  const normalizedScore = Math.floor(Number(score))
  if (normalizedScore < 0) return
  if (normalizedScore <= bestQueuedScore.value) return

  bestQueuedScore.value = normalizedScore
  await flushBestScore()
}

/* ---------------- Lifecycle ---------------- */
function onFullscreenChange() {
  syncFullscreenState()
  if (!isFullscreen.value) disarmMobileBackExit()
}

async function onPopState() {
  if (isFullscreen.value) {
    await exitFullscreen()
    history.pushState(null, '')
  }
}

onMounted(async () => {
  // Start touch probe immediately on mount — it waits passively for
  // the first user touch in the background without blocking anything.
  startTouchProbe()

  // Run sensor + battery probes concurrently with tournament load.
  // buildDeviceFingerprint() awaits sensor (≤1.8s) and battery,
  // but init() is also awaited after it, so total wall-clock cost
  // is max(fingerprintTime, tournamentLoadTime) not their sum.
  const [fp] = await Promise.all([
    buildDeviceFingerprint(),
    // Kick off the clock and DOM listeners immediately
    Promise.resolve().then(() => {
      tick = setInterval(() => { now.value = Date.now() }, 1000)
      canUseFullscreen.value = detectFullscreenSupport()
      document.addEventListener('fullscreenchange', onFullscreenChange)
      document.addEventListener('webkitfullscreenchange', onFullscreenChange as EventListener)
      window.addEventListener('popstate', onPopState)
      window.addEventListener('message', onWindowMessage)
    })
  ])

  deviceFingerprint.value = fp
  deviceType.value = fp.deviceType

  refreshPlayerMount()
  await init()
})

onBeforeUnmount(() => {
  sendWsFinish()
  clearRunEventThrottle()
  cleanupWebSocket()

  if (tick) clearInterval(tick)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange as EventListener)
  window.removeEventListener('popstate', onPopState)
  window.removeEventListener('message', onWindowMessage)
})

watch(
  () => tournamentSlug.value,
  async () => {
    resetScoreSubmitState()
    clearRunEventThrottle()
    cleanupWebSocket()
    resetSessionState()
    refreshPlayerMount()
    await init()
  }
)

watch(isPlayable, async (v, prev) => {
  if (prev && !v) {
    submitInFlight.value = false
    sendWsFinish()
    clearRunEventThrottle()
    cleanupWebSocket()
  }
})
</script>

<template>
  <div
    ref="rootEl"
    class="fixed inset-0 z-[9999] overflow-hidden bg-black text-white"
  >
    <div
      v-if="!isFullscreen"
      class="absolute left-0 right-0 top-0 z-[220] border-b border-white/10 bg-black/70 backdrop-blur"
      :style="{ paddingTop: 'env(safe-area-inset-top)' }"
    >
      <div class="flex h-14 items-center justify-between gap-2 px-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold">
            {{ t?.title || 'Tournament' }}
          </div>

          <div v-if="t" class="truncate text-xs opacity-70">
            {{ game?.name || '' }}
            <span class="mx-2 opacity-40">•</span>

            <template v-if="isPlayable">
              Ends in
              <span class="font-mono">{{ msToClock(endsInMs) }}</span>
            </template>

            <template v-else>
              Starts in
              <span class="font-mono">{{ msToClock(startsInMs) }}</span>
            </template>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <UButton
            v-if="canUseFullscreen"
            variant="soft"
            color="primary"
            class="!rounded-full"
            @click="toggleFullscreen"
          >
            <UIcon
              :name="
                isFullscreen
                  ? 'i-heroicons-arrows-pointing-in'
                  : 'i-heroicons-arrows-pointing-out'
              "
              class="h-5 w-5"
            />
            <span class="hidden sm:inline">
              {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
            </span>
          </UButton>

          <UButton
            variant="soft"
            color="primary"
            class="!rounded-full"
            @click="closePage"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
            <span class="hidden sm:inline">Close</span>
          </UButton>
        </div>
      </div>
    </div>

    <div
      v-if="isFullscreen && canUseFullscreen"
      class="absolute right-3 top-3 z-[230] flex items-center gap-2"
      :style="{ top: 'calc(env(safe-area-inset-top) + 12px)' }"
    >
      <UButton
        variant="soft"
        color="primary"
        class="!rounded-full bg-black/60 backdrop-blur"
        @click="exitFullscreen"
      >
        <UIcon name="i-heroicons-arrows-pointing-in" class="h-5 w-5" />
      </UButton>

      <UButton
        variant="soft"
        color="primary"
        class="!rounded-full bg-black/60 backdrop-blur"
        @click="closePage"
      >
        <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
      </UButton>
    </div>

    <div
      class="absolute inset-0 z-[210]"
      :style="{
        paddingTop: isFullscreen ? '0px' : 'calc(env(safe-area-inset-top) + 56px)',
        paddingBottom: isFullscreen ? '0px' : 'env(safe-area-inset-bottom)'
      }"
    >
      <ClientOnly>
        <div v-if="loading" class="grid h-full w-full place-items-center bg-black">
          <div class="px-6 text-center">
            <div class="text-lg font-semibold">Loading…</div>
            <div class="mt-2 text-sm opacity-70">Preparing tournament</div>
          </div>
        </div>

        <div
          v-else-if="err"
          class="grid h-full w-full place-items-center bg-black p-6"
        >
          <div class="max-w-md text-center">
            <div class="text-lg font-semibold">{{ err }}</div>
            <div class="mt-4 flex justify-center gap-2">
              <UButton class="!rounded-full" :to="`/tournaments/${tournamentSlug}`">
                Back to details
              </UButton>
              <UButton variant="soft" class="!rounded-full" to="/tournaments">
                All tournaments
              </UButton>
            </div>
          </div>
        </div>

        <div
          v-else-if="!isPlayable"
          class="grid h-full w-full place-items-center bg-black p-6"
        >
          <div class="max-w-md text-center">
            <div class="text-lg font-semibold">Tournament is not live</div>
            <p class="mt-2 text-sm opacity-80">
              You can't play outside the tournament window.
            </p>
          </div>
        </div>

        <div
          v-else-if="sessionLoading || !sessionReady || !resolvedGame || restarting"
          class="grid h-full w-full place-items-center bg-black"
        >
          <div class="px-6 text-center">
            <div class="text-lg font-semibold">
              {{ restarting ? 'Restarting run…' : 'Starting session…' }}
            </div>
            <div class="mt-2 text-sm opacity-70">
              {{ restarting ? 'Creating a fresh tournament run' : 'Creating secure play session' }}
            </div>
          </div>
        </div>

        <div v-else class="h-full w-full bg-black">
          <GamePlayer
            :key="`${tournamentSlug}-${playerMountKey}-${sessionId}`"
            :game="resolvedGame"
            :defer="false"
            :fullscreen="true"
            @score="e => onScore(e.score)"
            @restart-request="onRestartRequest"
            @run-event="onRunEvent"
          />
        </div>
      </ClientOnly>
    </div>
  </div>
</template>