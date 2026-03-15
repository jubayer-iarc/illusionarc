<!-- app/pages/tournaments/embed/[tournamentSlug].vue -->
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
const t = ref<AnyTournament | null>(null)
const loading = ref(true)
const err = ref<string | null>(null)

const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

const rootEl = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const fullscreenHistoryArmed = ref(false)
const canUseFullscreen = ref(false)

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

/* ---------------- Time Logic ---------------- */
const startMs = computed(() =>
  t.value ? safeTimeMs(getStartsAt(t.value)) : 0
)
const endMs = computed(() =>
  t.value ? safeTimeMs(getEndsAt(t.value)) : 0
)

const startsInMs = computed(() =>
  Math.max(0, startMs.value - now.value)
)
const endsInMs = computed(() =>
  Math.max(0, endMs.value - now.value)
)

const inTimeWindow = computed(() => {
  if (!startMs.value || !endMs.value) return false
  return now.value >= startMs.value && now.value < endMs.value
})

const isPlayable = computed(() => {
  if (!t.value) return false
  const st = getStatus(t.value)
  if (st === 'canceled') return false
  if (st === 'ended') return false
  return inTimeWindow.value
})

const game = computed(() => {
  if (!t.value) return null
  return GAMES.find(g => g.slug === getGameSlug(t.value)) || null
})

useHead(() => ({
  title: t.value ? `${t.value.title} — Play` : 'Tournament — Play',
  meta: [
    { name: 'robots', content: 'noindex' },
    {
      name: 'viewport',
      content:
        'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no'
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
  } catch (e: any) {
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

/* ---------------- Load Tournament ---------------- */
let initToken = 0

async function loadTournamentSafe() {
  try {
    const api = await bySlug(tournamentSlug.value)
    if (api) return api
  } catch {}

  return (
    (FALLBACK as any).find(
      (x: any) => x.slug === tournamentSlug.value
    ) || null
  )
}

async function init() {
  const myToken = ++initToken
  loading.value = true
  err.value = null
  t.value = null

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

    refreshPlayerMount()
  } catch (e: any) {
    if (myToken !== initToken) return
    err.value = e?.data?.message || e?.message || 'Failed to load'
  } finally {
    if (myToken === initToken) loading.value = false
  }
}

/* ---------------- Navigation ---------------- */
async function closePage() {
  if (isFullscreen.value) {
    await exitFullscreen()
  }

  await navigateTo(`/tournaments/${tournamentSlug.value}`)
}

/* ---------------- Score Submit ---------------- */
async function onScore(score: number) {
  if (!isPlayable.value) return

  try {
    await $fetch('/api/tournaments/submit', {
      method: 'POST',
      credentials: 'include',
      body: { tournamentSlug: tournamentSlug.value, score }
    })
  } catch (e: any) {
    toast.add({
      title: 'Score submit failed',
      description: e?.data?.message || e?.message || 'Try again',
      color: 'error'
    })
  }
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
  tick = setInterval(() => {
    now.value = Date.now()
  }, 1000)

  canUseFullscreen.value = detectFullscreenSupport()

  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener(
    'webkitfullscreenchange',
    onFullscreenChange as EventListener
  )
  window.addEventListener('popstate', onPopState)

  refreshPlayerMount()
  await init()
})

onBeforeUnmount(() => {
  if (tick) clearInterval(tick)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener(
    'webkitfullscreenchange',
    onFullscreenChange as EventListener
  )
  window.removeEventListener('popstate', onPopState)
})

watch(
  () => tournamentSlug.value,
  async () => {
    refreshPlayerMount()
    await init()
  }
)

watch(isPlayable, (v, prev) => {
  if (!prev && v) {
    refreshPlayerMount()
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
            <div class="mt-2 text-sm opacity-70">
              Preparing tournament session
            </div>
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

        <div v-else class="h-full w-full bg-black">
          <GamePlayer
            :key="`${tournamentSlug}-${playerMountKey}`"
            :game="game!"
            :defer="false"
            :fullscreen="true"
            @score="e => onScore(e.score)"
          />
        </div>
      </ClientOnly>
    </div>
  </div>
</template>