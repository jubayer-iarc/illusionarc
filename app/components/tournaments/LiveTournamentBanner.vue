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
let tickTimer: any = null
let refreshTimer: any = null

function getStartsAt(x: AnyTournament) {
  return String(x?.starts_at ?? x?.startsAt ?? '').trim()
}
function getEndsAt(x: AnyTournament) {
  return String(x?.ends_at ?? x?.endsAt ?? '').trim()
}
function getGameSlug(x: AnyTournament) {
  return String(x?.game_slug ?? x?.gameSlug ?? '').trim()
}

/** ✅ Timer format: 6D:02H:25M:44S */
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
  const s = new Date(getStartsAt(x)).getTime()
  const e = new Date(getEndsAt(x)).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e)) return false
  return now.value >= s && now.value < e
}

const endsIn = computed(() => {
  if (!t.value) return 0
  const end = new Date(getEndsAt(t.value)).getTime()
  if (!Number.isFinite(end)) return 0
  return end - now.value
})

const nearBoundary = computed(() => {
  if (!t.value) return false
  const s = new Date(getStartsAt(t.value)).getTime()
  const e = new Date(getEndsAt(t.value)).getTime()
  const n = now.value
  return Math.abs(n - s) < 120_000 || Math.abs(n - e) < 120_000
})

const gameName = computed(() => {
  if (!t.value) return ''
  const gs = getGameSlug(t.value)
  return GAMES.find((g) => g.slug === gs)?.name || gs
})

const windowText = computed(() => {
  if (!t.value) return ''
  const s = getStartsAt(t.value)
  const e = getEndsAt(t.value)
  if (!s || !e) return ''
  const fmt = (dt: string) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dt))
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
    if (!details) details = (FALLBACK as any).find((x: any) => x.slug === first.tournamentSlug) || null
  } catch {
    details = (FALLBACK as any).find((x: any) => x.slug === first.tournamentSlug) || null
  }

  if (details && isLiveByTime(details)) t.value = details
  else t.value = null
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
    doRefresh(false)
  }, ms)
}

onMounted(async () => {
  loading.value = true
  await doRefresh(true)
  loading.value = false

  tickTimer = setInterval(() => {
    now.value = Date.now()
    if (t.value && endsIn.value <= 0) {
      t.value = null
      doRefresh(false)
    }
  }, 1000)

  watch(
    nearBoundary,
    (isNear) => {
      startRefreshInterval(isNear ? 5_000 : 20_000)
    },
    { immediate: true }
  )

  const onVis = () => {
    if (document.visibilityState === 'visible') doRefresh(false)
  }
  document.addEventListener('visibilitychange', onVis)

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVis)
  })
})

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer)
  if (refreshTimer) clearInterval(refreshTimer)
})

watch(
  () => rows.value,
  async () => {
    await pickTournament()
  }
)

function hardPlay(slug: string) {
  if (!import.meta.client) return
  const url = `/tournaments/embed/${encodeURIComponent(slug)}?boot=${Date.now()}`
  window.location.assign(url)
}

/* ✅ Only render a root element when needed */
const showBanner = computed(() => loading.value || !!t.value)
</script>

<template>
  <!-- ✅ When nothing is live and not loading: render NOTHING (no reserved space) -->
  <div v-if="showBanner">
    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="rounded-xl md:rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 md:px-4 md:py-3"
      aria-label="Loading live tournament"
    >
      <!-- Mobile skeleton (tiny) -->
      <div class="flex items-center gap-2 md:hidden">
        <div class="h-5 w-14 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
        <div class="h-3 flex-1 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
        <div class="h-3 w-28 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
        <div class="h-7 w-9 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
      </div>

      <!-- Desktop skeleton -->
      <div class="hidden md:flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
          <div class="h-6 w-20 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
          <div class="min-w-0 flex-1">
            <div class="h-4 w-56 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
            <div class="mt-2 h-4 w-72 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
          </div>
        </div>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div class="h-9 w-full sm:w-24 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
          <div class="h-9 w-full sm:w-20 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>

    <!-- Live banner -->
    <div
      v-else-if="t"
      class="rounded-xl md:rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 md:px-4 md:py-3"
    >
      <!-- MOBILE: super compact -->
      <div class="flex items-center gap-2 md:hidden min-w-0">
        <span class="text-[11px] rounded-full px-2 py-1 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 w-max">
          LIVE
        </span>

        <div class="min-w-0 flex-1">
          <div class="text-[12px] font-semibold truncate text-black dark:text-white">
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

      <!-- DESKTOP: full details -->
      <div class="hidden md:flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
          <span class="text-xs rounded-full px-2 py-1 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 w-max">
            LIVE NOW
          </span>

          <div class="min-w-0">
            <div class="text-sm font-semibold truncate text-black dark:text-white">
              {{ t.title || 'Live Tournament' }}
            </div>

            <div class="mt-1 text-sm opacity-90 truncate text-black/80 dark:text-white/80">
              <span class="opacity-80">Game:</span>
              <b class="ml-1">{{ gameName }}</b>
              <span class="mx-2 opacity-40 hidden sm:inline">•</span>
              <span class="opacity-80">Ends in:</span>
              <span class="font-mono ml-1">{{ msToDHMS(endsIn) }}</span>
            </div>

            <div v-if="windowText" class="mt-1 text-xs opacity-70 truncate">
              {{ windowText }}
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <UButton :to="`/tournaments/${t.slug}`" variant="soft" class="!rounded-full w-full sm:w-auto">
            Details
          </UButton>

          <UButton @click="hardPlay(t.slug)" class="!rounded-full w-full sm:w-auto">
            Play
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>