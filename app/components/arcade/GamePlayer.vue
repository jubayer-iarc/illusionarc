<script setup lang="ts">
import type { ArcadeGame } from '@/data/games'

const props = withDefaults(
  defineProps<{
    game: ArcadeGame
    defer?: boolean
    fullscreen?: boolean
    /** change this to force iframe src + remount */
    cacheKey?: string
  }>(),
  {
    defer: false,
    fullscreen: false,
    cacheKey: ''
  }
)

const route = useRoute()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const wrapRef = ref<HTMLElement | null>(null)

const aspect = computed(() => props.game.embed.aspectRatio || '16/9')
const minHeight = computed(() => props.game.embed.minHeight ?? 520)

const started = ref(false)
const frameKey = ref(0)

/* ---------------- score bridge guards ---------------- */
const bestEmittedScore = ref<number>(-1)

function resetScoreBridge() {
  bestEmittedScore.value = -1
}

function start() {
  resetScoreBridge()
  started.value = true
}

function stop() {
  started.value = false
}

function reload() {
  started.value = true
  frameKey.value++
  resetScoreBridge()
}

// Auto-start rules
const shouldAutoStart = computed(() => {
  if (!props.defer) return true
  if (props.fullscreen) return true
  if (String(route.query.play || '') === '1') return true
  if (String(route.query.autostart || '') === '1') return true
  return false
})

watch(
  shouldAutoStart,
  (v) => {
    if (v) {
      started.value = true
      resetScoreBridge()
    }
  },
  { immediate: true }
)

function send(payload: any) {
  iframeRef.value?.contentWindow?.postMessage(payload, '*')
}

function requestFullscreen() {
  const el = wrapRef.value as any
  if (!el) return
  if (el.requestFullscreen) el.requestFullscreen()
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
}

/* ---------------- expected session from iframe url ---------------- */
const expectedSessionId = computed(() => {
  try {
    const value = new URL(src.value, window.location.origin).searchParams.get('sessionId')
    return String(value || '').trim()
  } catch {
    return ''
  }
})

const expectedSessionNonce = computed(() => {
  try {
    const value = new URL(src.value, window.location.origin).searchParams.get('sessionNonce')
    return String(value || '').trim()
  } catch {
    return ''
  }
})

function hasValidSessionPayload(data: any) {
  const incomingSessionId = String(data?.sessionId || '').trim()
  const incomingSessionNonce = String(data?.sessionNonce || '').trim()

  if (!expectedSessionId.value || !expectedSessionNonce.value) return false
  if (!incomingSessionId || !incomingSessionNonce) return false
  if (incomingSessionId !== expectedSessionId.value) return false
  if (incomingSessionNonce !== expectedSessionNonce.value) return false

  return true
}

/* ---------------- bridge emits ---------------- */
const emit = defineEmits<{
  (e: 'score', payload: { score: number; raw?: any }): void
  (e: 'restart-request', payload: { raw?: any }): void
  (e: 'run-event', payload: { eventType: string; value: number; raw?: any }): void
}>()

function onMessage(e: MessageEvent) {
  if (typeof window === 'undefined') return
  if (e.origin !== window.location.origin) return

  const data = e.data
  if (!data || typeof data !== 'object') return

  const type = String((data as any).type || '').trim()
  if (!type) return

  if (!hasValidSessionPayload(data)) return

  if (type === 'SCORE') {
    const rawScore = Number((data as any).score)
    if (!Number.isFinite(rawScore)) return

    const score = Math.floor(rawScore)
    if (score < 0) return

    // Emit only when score improves
    if (score <= bestEmittedScore.value) return

    bestEmittedScore.value = score
    emit('score', { score, raw: data })
    return
  }

  if (type === 'RESTART_REQUEST') {
    emit('restart-request', { raw: data })
    return
  }

  if (type === 'RUN_EVENT') {
    const eventType = String((data as any).eventType || '').trim()
    if (!eventType) return

    const rawValue = Number((data as any).value ?? 0)
    const value = Number.isFinite(rawValue) ? Math.floor(rawValue) : 0

    emit('run-event', { eventType, value, raw: data })
  }
}

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

watch(
  () => props.game?.sourceUrl,
  () => {
    resetScoreBridge()
  }
)

watch(
  () => props.cacheKey,
  () => {
    resetScoreBridge()
  }
)

// iframe src with cache-bust that changes when cacheKey changes
const src = computed(() => {
  const autostart =
    route.query.autostart != null
      ? String(route.query.autostart)
      : props.fullscreen
        ? '1'
        : '0'

  const qs = new URLSearchParams()
  qs.set('autostart', autostart)

  // IMPORTANT: make src unique per navigation / click
  const v = props.cacheKey || `${Date.now()}-${frameKey.value}`
  qs.set('v', v)

  const base = props.game.sourceUrl
  return `${base}${base.includes('?') ? '&' : '?'}${qs.toString()}`
})

defineExpose({ start, stop, reload, send, requestFullscreen })
</script>

<template>
  <div class="relative" :class="props.fullscreen ? 'h-full' : ''">
    <div
      ref="wrapRef"
      class="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl"
      :class="props.fullscreen ? 'h-full' : ''"
      :style="props.fullscreen ? { height: '100%', minHeight: '100%' } : { minHeight: minHeight + 'px' }"
    >
      <div class="relative w-full" :style="props.fullscreen ? { height: '100%' } : { aspectRatio: aspect }">
        <iframe
          v-if="started"
          :key="frameKey"
          ref="iframeRef"
          class="absolute inset-0 h-full w-full"
          :src="src"
          title="Game"
          allow="autoplay; fullscreen; gamepad"
          allowfullscreen
          loading="eager"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
        />

        <div v-else class="absolute inset-0 grid place-items-center text-sm opacity-70">
          Ready to play
        </div>
      </div>
    </div>
  </div>
</template>