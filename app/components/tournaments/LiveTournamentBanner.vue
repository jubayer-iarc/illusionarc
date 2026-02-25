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

function msToClock(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
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
  return GAMES.find(g => g.slug === gs)?.name || gs
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

  // ✅ Hard guard: never show ended / invalid
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
  // initial
  await doRefresh(true)

  // tick each second
  tickTimer = setInterval(() => {
    now.value = Date.now()

    // ended? hide instantly and refresh quickly
    if (t.value && endsIn.value <= 0) {
      t.value = null
      doRefresh(false)
    }
  }, 1000)

  // smart refresh: 20s normally, 5s near start/end (2 min)
  watch(
    nearBoundary,
    (isNear) => {
      startRefreshInterval(isNear ? 5_000 : 20_000)
    },
    { immediate: true }
  )

  // refresh when returning to tab
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

// also re-pick when the live list changes
watch(
  () => rows.value,
  async () => {
    await pickTournament()
  }
)
function hardPlay(slug: string) {
  if (!import.meta.client) return
  const url = `/tournaments/embed/${encodeURIComponent(slug)}?boot=${Date.now()}`
  window.location.assign(url) // ✅ real refresh navigation
}
</script>

<template>
  <div
    v-if="t"
    class="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3"
  >
    <!-- ✅ responsive: stacked on mobile -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
        <span class="text-xs rounded-full px-2 py-1 bg-emerald-500/20 text-black-200 dark:text-emerald-200 w-max">
          LIVE NOW
        </span>

        <div class="min-w-0">
          <div class="text-sm font-semibold truncate">
            {{ t.title || 'Live Tournament' }}
          </div>

          <div class="mt-1 text-sm opacity-90 truncate">
            <span class="opacity-80">Game:</span>
            <b class="ml-1">{{ gameName }}</b>
            <span class="mx-2 opacity-40 hidden sm:inline">•</span>
            <span class="opacity-80"> Ends in:</span>
            <span class="font-mono ml-1">{{ msToClock(endsIn) }}</span>
          </div>

          <div v-if="windowText" class="mt-1 text-xs opacity-70 truncate">
            {{ windowText }}
          </div>
        </div>
      </div>

      <!-- ✅ buttons full-width on mobile -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
</template>
