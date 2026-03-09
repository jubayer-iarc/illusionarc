<!-- app/components/tournaments/LiveTournamentBanner.vue -->
<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import { useLiveTournaments } from '~/composables/useLiveTournaments'

const { rows, refresh } = useLiveTournaments()
const { bySlug } = useTournaments()

type AnyTournament = any

const t = ref<AnyTournament | null>(null)
const loading = ref(true)

const now = ref(Date.now())

let tickTimer: ReturnType<typeof setInterval> | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
let stopNearBoundaryWatch: (() => void) | null = null

function getStartsAt(x: AnyTournament) {
  return String(x?.starts_at ?? x?.startsAt ?? '').trim()
}

function getEndsAt(x: AnyTournament) {
  return String(x?.ends_at ?? x?.endsAt ?? '').trim()
}

function getGameSlug(x: AnyTournament) {
  return String(x?.game_slug ?? x?.gameSlug ?? '').trim()
}

function safeTimeMs(input: unknown) {
  const s = String(input ?? '').trim()
  if (!s) return 0
  const ms = Date.parse(s)
  return Number.isFinite(ms) ? ms : 0
}

/** Timer format: 6D:02H:25M:44S */
function msToDHMS(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0D:00H:00M:00S'

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const remAfterDays = totalSeconds % 86400
  const hours = Math.floor(remAfterDays / 3600)
  const remAfterHours = remAfterDays % 3600
  const minutes = Math.floor(remAfterHours / 60)
  const seconds = remAfterHours % 60

  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${days}D:${pad2(hours)}H:${pad2(minutes)}M:${pad2(seconds)}S`
}

function isLiveByTime(x: AnyTournament) {
  const s = safeTimeMs(getStartsAt(x))
  const e = safeTimeMs(getEndsAt(x))
  if (!s || !e) return false
  return now.value >= s && now.value < e
}

const endsIn = computed(() => {
  if (!t.value) return 0
  const end = safeTimeMs(getEndsAt(t.value))
  if (!end) return 0
  return Math.max(0, end - now.value)
})

const nearBoundary = computed(() => {
  if (!t.value) return false

  const s = safeTimeMs(getStartsAt(t.value))
  const e = safeTimeMs(getEndsAt(t.value))
  const n = now.value

  if (!s || !e) return false

  return Math.abs(n - s) < 120_000 || Math.abs(n - e) < 120_000
})

const gameName = computed(() => {
  if (!t.value) return ''
  const gs = getGameSlug(t.value)
  return GAMES.find(g => g.slug === gs)?.name || gs
})

const windowText = computed(() => {
  if (!t.value) return ''

  const s = getStartsAt(t.value)
  const e = getEndsAt(t.value)
  if (!s || !e) return ''

  const fmt = (dt: string) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(dt))

  return `Window: ${fmt(s)} → ${fmt(e)}`
})

async function pickTournament() {
  const first = rows.value?.[0]

  if (!first?.tournamentSlug) {
    t.value = null
    return
  }

  let details: AnyTournament | null = null

  try {
    details = await bySlug(first.tournamentSlug)
    if (!details) {
      details =
        (FALLBACK as any).find((x: any) => x.slug === first.tournamentSlug) || null
    }
  } catch {
    details =
      (FALLBACK as any).find((x: any) => x.slug === first.tournamentSlug) || null
  }

  t.value = details && isLiveByTime(details) ? details : null
}

async function doRefresh(hard = false) {
  try {
    await refresh(hard)
  } catch {}

  await pickTournament()
}

function startRefreshInterval(ms: number) {
  if (refreshTimer) clearInterval(refreshTimer)

  refreshTimer = setInterval(() => {
    void doRefresh(false)
  }, ms)
}

function stopRefreshInterval() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void doRefresh(false)
  }
}

watch(
  () => rows.value,
  async () => {
    await pickTournament()
  }
)

onMounted(async () => {
  loading.value = true
  await doRefresh(true)
  loading.value = false

  tickTimer = setInterval(() => {
    now.value = Date.now()

    if (t.value && endsIn.value <= 0) {
      t.value = null
      void doRefresh(false)
    }
  }, 1000)

  stopNearBoundaryWatch = watch(
    nearBoundary,
    (isNear) => {
      startRefreshInterval(isNear ? 5_000 : 20_000)
    },
    { immediate: true }
  )

  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }

  stopRefreshInterval()

  if (stopNearBoundaryWatch) {
    stopNearBoundaryWatch()
    stopNearBoundaryWatch = null
  }

  document.removeEventListener('visibilitychange', onVisibilityChange)
})

function hardPlay(slug: string) {
  if (!import.meta.client) return
  const url = `/tournaments/embed/${encodeURIComponent(slug)}?boot=${Date.now()}`
  window.location.assign(url)
}

const showBanner = computed(() => loading.value || !!t.value)
</script>

<template>
  <div v-if="showBanner">
    <div
      v-if="loading"
      class="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 md:rounded-2xl md:px-4 md:py-3"
      aria-label="Loading live tournament"
    >
      <div class="flex items-center gap-2 md:hidden">
        <div class="h-5 w-14 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
        <div class="h-3 flex-1 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div class="h-3 w-28 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div class="h-7 w-9 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
      </div>

      <div class="hidden flex-col gap-3 md:flex md:flex-row md:items-center md:justify-between">
        <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div class="h-6 w-20 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
          <div class="min-w-0 flex-1">
            <div class="h-4 w-56 animate-pulse rounded bg-black/10 dark:bg-white/10" />
            <div class="mt-2 h-4 w-72 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          </div>
        </div>
        <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div class="h-9 w-full animate-pulse rounded-full bg-black/10 dark:bg-white/10 sm:w-24" />
          <div class="h-9 w-full animate-pulse rounded-full bg-black/10 dark:bg-white/10 sm:w-20" />
        </div>
      </div>
    </div>

    <div
      v-else-if="t"
      class="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 md:rounded-2xl md:px-4 md:py-3"
    >
      <div class="flex min-w-0 items-center gap-2 md:hidden">
        <span class="w-max rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-800 dark:text-emerald-200">
          LIVE
        </span>

        <div class="min-w-0 flex-1">
          <div class="truncate text-[12px] font-semibold text-black dark:text-white">
            {{ t.title || 'Live Tournament' }}
          </div>
        </div>

        <div class="font-mono text-[11px] text-black/60 dark:text-white/60">
          {{ msToDHMS(endsIn) }}
        </div>

        <UButton
          size="xs"
          class="!rounded-full !px-2"
          @click="hardPlay(t.slug)"
          aria-label="Play"
          title="Play"
        >
          <UIcon name="i-heroicons-play" class="h-4 w-4" />
        </UButton>
      </div>

      <div class="hidden flex-col gap-3 md:flex md:flex-row md:items-center md:justify-between">
        <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span class="w-max rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-800 dark:text-emerald-200">
            LIVE NOW
          </span>

          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-black dark:text-white">
              {{ t.title || 'Live Tournament' }}
            </div>

            <div class="mt-1 truncate text-sm text-black/80 opacity-90 dark:text-white/80">
              <span class="opacity-80">Game:</span>
              <b class="ml-1">{{ gameName }}</b>
              <span class="mx-2 hidden opacity-40 sm:inline">•</span>
              <span class="opacity-80">Ends in:</span>
              <span class="ml-1 font-mono">{{ msToDHMS(endsIn) }}</span>
            </div>

            <div v-if="windowText" class="mt-1 truncate text-xs opacity-70">
              {{ windowText }}
            </div>
          </div>
        </div>

        <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <UButton
            :to="`/tournaments/${t.slug}`"
            variant="soft"
            class="!rounded-full w-full sm:w-auto"
          >
            Details
          </UButton>

          <UButton
            @click="hardPlay(t.slug)"
            class="!rounded-full w-full sm:w-auto"
          >
            Play
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>