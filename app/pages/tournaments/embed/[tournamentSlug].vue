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
  | {
      type: 'WELCOME'
      sessionId?: string
      message?: string
    }
  | {
      type: 'HELLO_ACK'
      ok?: boolean
      sessionId?: string
      tournamentSlug?: string
      serverTime?: number
      ticketExp?: number
    }
  | {
      type: 'PONG'
      ts?: number
    }
  | {
      type: 'KEEPALIVE_ACK'
      ts?: number
    }
  | {
      type: 'RUN_EVENT_ACK'
      eventType?: string
      value?: number
      ts?: number
    }
  | {
      type: 'FINISH_ACK'
      ts?: number
    }
  | {
      type: 'ERROR'
      code?: string
      message?: string
    }

type RunEventPayload = {
  eventType: string
  value: number
  raw?: any
}

type ScreenCheckpointKey = 'load' | 'mid' | 'game_over'
type ScreenCheckpointPayload = Record<string, any>

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
  if (wsPingTimer) {
    clearInterval(wsPingTimer)
    wsPingTimer = null
  }
  if (wsKeepAliveTimer) {
    clearInterval(wsKeepAliveTimer)
    wsKeepAliveTimer = null
  }
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
}

function cleanupWebSocket() {
  clearWsTimers()
  resetWsFlags()
  wsClosingIntentional.value = true

  try {
    ws.value?.close()
  } catch {}

  ws.value = null

  setTimeout(() => {
    wsClosingIntentional.value = false
  }, 0)
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

  try {
    ws.value?.close()
  } catch {}

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
        if (typeof data.ticketExp === 'number') {
          wsTicketExp.value = data.ticketExp
        }
        return
      }

      if (data.type === 'PONG') {
        wsLastPongAt.value = Date.now()
        return
      }

      if (data.type === 'KEEPALIVE_ACK') {
        wsLastPongAt.value = Date.now()
        return
      }

      if (data.type === 'RUN_EVENT_ACK') {
        wsLastRunEventAckAt.value = Date.now()
        return
      }

      if (data.type === 'ERROR') {
        console.warn('[Tournament WS]', data.code, data.message)
      }
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

  socket.onerror = () => {
    wsConnected.value = false
  }

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

/* ---------------- Screen checkpoint meta ---------------- */
const screenCheckpoints = ref<{
  load: ScreenCheckpointPayload | null
  mid: ScreenCheckpointPayload | null
  game_over: ScreenCheckpointPayload | null
}>({
  load: null,
  mid: null,
  game_over: null
})

function resetSubmissionMeta() {
  screenCheckpoints.value = {
    load: null,
    mid: null,
    game_over: null
  }
}

function normalizeFiniteNumber(value: any) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeRect(raw: any) {
  if (!raw || typeof raw !== 'object') return null

  return {
    width: normalizeFiniteNumber(raw.width),
    height: normalizeFiniteNumber(raw.height),
    top: normalizeFiniteNumber(raw.top),
    left: normalizeFiniteNumber(raw.left)
  }
}

function normalizeScreenCheckpoint(raw: any) {
  if (!raw || typeof raw !== 'object') return null

  return {
    label: raw.label ? String(raw.label) : null,
    capturedAt: raw.capturedAt ? String(raw.capturedAt) : null,
    screenWidth: normalizeFiniteNumber(raw.screenWidth),
    screenHeight: normalizeFiniteNumber(raw.screenHeight),
    availWidth: normalizeFiniteNumber(raw.availWidth),
    availHeight: normalizeFiniteNumber(raw.availHeight),
    innerWidth: normalizeFiniteNumber(raw.innerWidth),
    innerHeight: normalizeFiniteNumber(raw.innerHeight),
    outerWidth: normalizeFiniteNumber(raw.outerWidth),
    outerHeight: normalizeFiniteNumber(raw.outerHeight),
    clientWidth: normalizeFiniteNumber(raw.clientWidth),
    clientHeight: normalizeFiniteNumber(raw.clientHeight),
    visualViewportWidth: normalizeFiniteNumber(raw.visualViewportWidth),
    visualViewportHeight: normalizeFiniteNumber(raw.visualViewportHeight),
    devicePixelRatio: normalizeFiniteNumber(raw.devicePixelRatio),
    orientation: raw.orientation ? String(raw.orientation) : null,
    userAgent: raw.userAgent ? String(raw.userAgent) : null,
    frameRect: normalizeRect(raw.frameRect),
    containerRect: normalizeRect(raw.containerRect),
    canvasRect: normalizeRect(raw.canvasRect)
  }
}

function buildSubmissionMeta() {
  return {
    screen_checkpoints: {
      load: screenCheckpoints.value.load,
      mid: screenCheckpoints.value.mid,
      game_over: screenCheckpoints.value.game_over
    }
  }
}

function onWindowMessage(event: MessageEvent) {
  const data = event.data
  if (!data || typeof data !== 'object') return

  const type = String((data as any).type || '').trim()
  if (type !== 'IA_SCREEN_CHECKPOINT') return

  const checkpoint = String((data as any).checkpoint || '').trim() as ScreenCheckpointKey
  if (checkpoint !== 'load' && checkpoint !== 'mid' && checkpoint !== 'game_over') return

  const normalized = normalizeScreenCheckpoint((data as any).payload)
  if (!normalized) return

  screenCheckpoints.value[checkpoint] = normalized
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
  return String(x?.status || 'scheduled') as
    | 'scheduled'
    | 'live'
    | 'ended'
    | 'canceled'
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

  const d = String(days).padStart(2, '0')
  const h = String(hours).padStart(2, '0')
  const m = String(minutes).padStart(2, '0')

  return `${d}D:${h}H:${m}M`
}

function getFullscreenRequestEl(el: any) {
  if (!el) return null
  return (
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitEnterFullscreen ||
    null
  )
}

function getFullscreenExitDoc(doc: any) {
  if (!doc) return null
  return doc.exitFullscreen || doc.webkitExitFullscreen || null
}

function detectFullscreenSupport() {
  if (typeof document === 'undefined') return false
  const el: any = rootEl.value || document.documentElement
  const requestFn = getFullscreenRequestEl(el)
  const enabled =
    typeof document.fullscreenEnabled === 'boolean'
      ? document.fullscreenEnabled
      : true

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

/* ---------------- Device Detection ---------------- */
function getWebGLRendererInfo() {
  let renderer = ''
  let vendor = ''

  try {
    const canvas = document.createElement('canvas')
    const gl =
      (canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null

    if (!gl) return { renderer, vendor }

    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return { renderer, vendor }

    renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
    vendor = String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '')
  } catch {}

  return { renderer, vendor }
}

async function detectSensorSignal(): Promise<'real' | 'static' | 'unavailable' | 'not_checked'> {
  if (typeof window === 'undefined') return 'not_checked'
  if (typeof DeviceMotionEvent === 'undefined') return 'not_checked'

  return await new Promise((resolve) => {
    let count = 0
    let changed = 0
    const values: number[] = []

    const handler = (e: DeviceMotionEvent) => {
      count++

      const a = e.accelerationIncludingGravity
      const x = Number(a?.x ?? 0)
      const y = Number(a?.y ?? 0)
      const z = Number(a?.z ?? 0)

      values.push(x, y, z)

      if (Math.abs(x) > 0.01 || Math.abs(y) > 0.01 || Math.abs(z) > 0.01) {
        changed++
      }

      if (count >= 8) {
        window.removeEventListener('devicemotion', handler as EventListener)

        const mean = values.reduce((s, v) => s + v, 0) / (values.length || 1)
        const variance =
          values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length || 1)

        if (changed > 0 && variance > 0.0001) resolve('real')
        else if (changed > 0) resolve('static')
        else resolve('unavailable')
      }
    }

    window.addEventListener('devicemotion', handler as EventListener)

    setTimeout(() => {
      window.removeEventListener('devicemotion', handler as EventListener)
      if (count === 0) resolve('unavailable')
      else resolve('static')
    }, 1800)
  })
}

async function detectDeviceType(): Promise<DeviceType> {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return 'PC'
  }

  const nav: any = navigator
  const ua = String(nav.userAgent || '')
  const platform = String(nav.platform || '')
  const cores = Number(nav.hardwareConcurrency || 0) || 0
  const memory = Number(nav.deviceMemory || 0) || 0
  const touchPoints = Number(nav.maxTouchPoints || 0) || 0
  const hasTouch = touchPoints > 0 || 'ontouchstart' in window
  const hasMousePointer = !!window.matchMedia?.('(pointer: fine)').matches
  const dpr = Number(window.devicePixelRatio || 1)

  const isMobileUA =
    /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)
  const isAndroidUA = /Android/i.test(ua)
  const isIOSUA = /iPhone|iPad|iPod/i.test(ua)

  let score = 0

  if (/Emulator|sdk_gphone|sdk_phone|generic|Andy\b/i.test(ua)) score += 40

  const { renderer } = getWebGLRendererInfo()

  if (/SwiftShader|llvmpipe|softpipe|Microsoft Basic Render/i.test(renderer)) score += 40
  if (isMobileUA && /NVIDIA|AMD Radeon|GeForce|Intel.*Iris|Intel.*UHD|Intel.*HD Graphics/i.test(renderer)) score += 35
  if (isMobileUA && /Win32|Win64|WOW64|MacIntel|MacPPC/i.test(platform)) score += 30
  if (isMobileUA && /Linux x86_64/i.test(platform)) score += 25
  if (isMobileUA && cores > 8) score += 20
  if (isMobileUA && cores > 16) score += 10
  if (isMobileUA && memory >= 8) score += 15
  if (isMobileUA && hasTouch && hasMousePointer) score += 20
  if (isMobileUA && !hasTouch) score += 15

  const outerInnerGap = Math.max(
    Math.abs(window.outerWidth - window.innerWidth),
    Math.abs(window.outerHeight - window.innerHeight)
  )
  if (outerInnerGap > 160) score += 20

  const screenEqualsViewport =
    window.screen.width === window.innerWidth &&
    window.screen.height === window.innerHeight

  if (isMobileUA && screenEqualsViewport) score += 10
  if (isMobileUA && dpr === 1) score += 10

  const sensorSignal = await detectSensorSignal()
  if (isMobileUA && sensorSignal === 'static') score += 10
  if (isMobileUA && sensorSignal === 'unavailable') score += 5

  if (score >= 50) return 'Emulator'
  if (isAndroidUA || isIOSUA || (isMobileUA && hasTouch)) return 'Mobile'
  return 'PC'
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

    if (!document.fullscreenElement) {
      await requestFn.call(el)
    }

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
    if (doc.fullscreenElement && exitFn) {
      await exitFn.call(doc)
    }
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
  if (!tournamentSlug.value) {
    throw new Error('Missing tournament slug')
  }

  sessionLoading.value = true

  try {
    const res = await $fetch<StartSessionResponse>('/api/tournaments/start-session', {
      method: 'POST',
      credentials: 'include',
      body: {
        tournamentSlug: tournamentSlug.value,
        deviceType: deviceType.value
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

    if (!found) {
      err.value = 'Tournament not found'
      return
    }

    t.value = found

    if (!game.value) {
      err.value = 'Game not found'
      return
    }

    if (!isPlayable.value) return

    await createRunSession()
    if (myToken !== initToken) return

    if (!sessionReady.value) {
      err.value = 'Failed to create play session'
      return
    }

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

    if (!sessionReady.value) {
      throw new Error('Failed to create a new run session')
    }

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

  if (sent) {
    wsLastRunEventAt.value = Date.now()
  }
}

/* ---------------- Navigation ---------------- */
async function closePage() {
  sendWsFinish()

  if (isFullscreen.value) {
    await exitFullscreen()
  }

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

    const res = await $fetch<{
      ok?: boolean
      updated?: boolean
      keptBest?: boolean
      finalScore?: number
    }>('/api/tournaments/submit', {
      method: 'POST',
      credentials: 'include',
      body: {
        tournamentSlug: tournamentSlug.value,
        score: scoreToSend,
        deviceType: deviceType.value,
        sessionId: sessionId.value,
        sessionNonce: sessionNonce.value,
        meta: buildSubmissionMeta()
      }
    })

    const finalScore = Number(res?.finalScore ?? scoreToSend)

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
        description: e?.data?.message || e?.message || 'Try again',
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
  if (!isFullscreen.value) {
    disarmMobileBackExit()
  }
}

async function onPopState() {
  if (isFullscreen.value) {
    await exitFullscreen()
    history.pushState(null, '')
  }
}

onMounted(async () => {
  deviceType.value = await detectDeviceType()

  tick = setInterval(() => {
    now.value = Date.now()
  }, 1000)

  canUseFullscreen.value = detectFullscreenSupport()

  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange as EventListener)
  window.addEventListener('popstate', onPopState)
  window.addEventListener('message', onWindowMessage)

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
        <div
          v-if="loading"
          class="grid h-full w-full place-items-center bg-black"
        >
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
              <UButton
                class="!rounded-full"
                :to="`/tournaments/${tournamentSlug}`"
              >
                Back to details
              </UButton>
              <UButton
                variant="soft"
                class="!rounded-full"
                to="/tournaments"
              >
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
              You can’t play outside the tournament window.
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