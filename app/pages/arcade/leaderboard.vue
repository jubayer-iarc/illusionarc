<script setup lang="ts">
import { GAMES } from '@/data/games'
import { TOURNAMENTS as FALLBACK_TOURNAMENTS } from '~/data/tournaments'
import { useTournamentLeaderboard } from '~/composables/useTournamentLeaderboard'
import { useTournaments } from '~/composables/useTournaments'

useHead({ title: 'Leaderboard' })

const route = useRoute()
const router = useRouter()

const { getLeaderboard: getTournamentLeaderboard } = useTournamentLeaderboard()
const { list: listTournaments } = useTournaments()

const tournamentSectionRef = ref<HTMLElement | null>(null)

/* ---------------- Selected game ---------------- */
const selected = ref<string>(GAMES[0]?.slug || '')
onMounted(() => {
  const q = route.query.game
  if (typeof q === 'string' && q.trim()) selected.value = q.trim()
  else selected.value = GAMES[0]?.slug || ''
})

/* ---------------- Arcade period ---------------- */
const period = ref<'daily' | 'weekly'>('daily')
onMounted(() => {
  const p = route.query.period
  if (p === 'daily' || p === 'weekly') period.value = p
})

/* ---------------- Pagination ---------------- */
const arcadePage = ref(1)
const arcadePerPage = ref(10)
const tournamentPage = ref(1)
const tournamentPerPage = ref(10)
const perPageOptions = [10, 20, 50]

/* ---------------- Query sync ---------------- */
watch(
  [selected, period],
  async () => {
    const q: Record<string, any> = { ...route.query }
    q.game = selected.value
    q.period = period.value
    await router.replace({ query: q })
  },
  { flush: 'post' }
)

/* ---------------- Game label map ---------------- */
const gameNameBySlug = computed(() => {
  const map: Record<string, string> = {}
  for (const g of GAMES) map[g.slug] = g.name
  return map
})

/* ---------------- Shared time helpers ---------------- */
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

function msToHMS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const dd = Math.floor(total / 86400)
  const hh = Math.floor((total % 86400) / 3600)
  const mm = Math.floor((total % 3600) / 60)
  const ss = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return dd > 0
    ? `${dd}d ${pad(hh)}:${pad(mm)}:${pad(ss)}`
    : hh > 0
      ? `${hh}:${pad(mm)}:${pad(ss)}`
      : `${mm}:${pad(ss)}`
}

function nextUtcMidnightMs() {
  const d = new Date(now.value)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  return Date.UTC(y, m, day + 1, 0, 0, 0, 0)
}

function nextUtcSaturdayStartMs() {
  const d = new Date(now.value)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  const dow = d.getUTCDay()
  const daysUntilNextSat = ((6 - dow + 7) % 7) || 7
  return Date.UTC(y, m, day + daysUntilNextSat, 0, 0, 0, 0)
}

const resetAtMs = computed(() => (
  period.value === 'daily' ? nextUtcMidnightMs() : nextUtcSaturdayStartMs()
))
const timeLeftMs = computed(() => resetAtMs.value - now.value)
const timeLeftText = computed(() => msToHMS(timeLeftMs.value))
const resetLabel = computed(() => (
  period.value === 'daily' ? 'Resets at 00:00 UTC' : 'Resets Saturday 00:00 UTC'
))

function fmtDate(ts?: string) {
  if (!ts) return ''
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

function fmt(dt?: string) {
  if (!dt) return ''
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

/* =========================
   ARCADE LEADERBOARD
   ========================= */
const arcadeLoading = ref(true)
const arcadeError = ref<string | null>(null)

type Row = {
  id?: string
  userId?: string
  player: string
  score: number
  createdAt: string
  displayName?: string
  avatarUrl?: string
  maskedPhone?: string
}

const rows = ref<Row[]>([])

function initials(name: string) {
  const s = String(name || '').trim()
  if (!s) return 'P'
  const parts = s.split(/\s+/g).filter(Boolean)
  const a = parts[0]?.[0] || 'P'
  const b = parts.length > 1 ? parts[1]?.[0] || '' : parts[0]?.[1] || ''
  return (a + b).toUpperCase()
}

function avatarFor(r: Row) {
  return String(r.avatarUrl || '').trim()
}

function displayNameForArcade(r: Row) {
  return String(r.displayName || r.player || 'Player').trim()
}

function maskedPhoneFor(r: Row) {
  return String(r.maskedPhone || '').trim()
}

async function loadArcade() {
  arcadeLoading.value = true
  arcadeError.value = null
  rows.value = []

  try {
    if (!selected.value) return

    const res: any = await $fetch('/api/leaderboard/get', {
      method: 'GET',
      query: {
        gameSlug: selected.value,
        period: period.value,
        limit: 200
      }
    })

    const items: Row[] = Array.isArray(res?.items) ? res.items : []
    rows.value = items
  } catch (e: any) {
    arcadeError.value = e?.data?.message || e?.message || 'Failed to load leaderboard.'
  } finally {
    arcadeLoading.value = false
  }
}

watch(
  [selected, period],
  async () => {
    arcadePage.value = 1
    await loadArcade()
  },
  { immediate: true }
)

const top3 = computed(() => rows.value.slice(0, 3))
const arcadeTotal = computed(() => rows.value.length)
const arcadePageCount = computed(() => Math.max(1, Math.ceil(arcadeTotal.value / arcadePerPage.value)))
const pagedArcadeRows = computed(() => {
  const start = (arcadePage.value - 1) * arcadePerPage.value
  return rows.value.slice(start, start + arcadePerPage.value)
})

watch(arcadePerPage, () => {
  arcadePage.value = 1
})
watch(arcadePageCount, (count) => {
  if (arcadePage.value > count) arcadePage.value = count
})

function medal(i: number) {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
}

function goWinners() {
  navigateTo('/arcade/winners')
}

/* =========================
   TOURNAMENTS
   ========================= */
type TournamentLite = {
  id?: string
  slug: string
  title: string
  game_slug?: string
  gameSlug?: string
  starts_at?: string
  ends_at?: string
  startsAt?: string
  endsAt?: string
  status?: string
  effective_status?: string
}

type TournamentRow = {
  user_id?: string | null
  player_name: string
  score: number
  created_at: string
  display_name?: string
  avatar_url?: string
  masked_phone?: string
}

const tournamentsLoading = ref(false)
const tournaments = ref<TournamentLite[]>([])
const selectedTournamentSlug = ref('')

const tournamentBoardLoading = ref(false)
const tournamentError = ref<string | null>(null)
const tournamentRows = ref<TournamentRow[]>([])

function getTournamentGameSlug(t: TournamentLite) {
  return String(t?.game_slug ?? t?.gameSlug ?? '').trim()
}

function getStartsAt(t: TournamentLite) {
  return String(t?.starts_at ?? t?.startsAt ?? '').trim()
}

function getEndsAt(t: TournamentLite) {
  return String(t?.ends_at ?? t?.endsAt ?? '').trim()
}

function getTournamentStatus(t: TournamentLite): 'scheduled' | 'live' | 'ended' | 'canceled' {
  const explicit = String(t?.effective_status || t?.status || '').toLowerCase()
  if (explicit === 'canceled') return 'canceled'

  const s = new Date(getStartsAt(t)).getTime()
  const e = new Date(getEndsAt(t)).getTime()

  if (Number.isFinite(e) && now.value >= e) return 'ended'
  if (Number.isFinite(s) && now.value >= s && (!Number.isFinite(e) || now.value < e)) return 'live'
  return 'scheduled'
}

function tournamentStatusPillClass(s: string) {
  if (s === 'live') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  if (s === 'scheduled') return 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-200'
  if (s === 'ended') return 'border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70'
  return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-200'
}

function tournamentChipCountdown(t: TournamentLite) {
  const status = getTournamentStatus(t)
  if (status === 'live') {
    const ms = new Date(getEndsAt(t)).getTime() - now.value
    return `Ends in ${msToHMS(ms)}`
  }
  if (status === 'scheduled') {
    const ms = new Date(getStartsAt(t)).getTime() - now.value
    return `Starts in ${msToHMS(ms)}`
  }
  return status === 'ended' ? 'Ended' : 'Canceled'
}

function tournamentAvatarFor(r: TournamentRow) {
  return String(r.avatar_url || '').trim()
}

function displayNameForTournament(r: TournamentRow) {
  return String(r.display_name || r.player_name || 'Player').trim()
}

function maskedPhoneForTournament(r: TournamentRow) {
  return String(r.masked_phone || '').trim()
}

async function loadTournaments() {
  tournamentsLoading.value = true

  try {
    const all = await listTournaments()
    tournaments.value = (Array.isArray(all) ? all : []).filter((t: any) => {
      return getTournamentGameSlug(t) === selected.value
    }) as TournamentLite[]
  } catch (e) {
    console.warn('Failed to load live tournaments, using fallback:', e)
    tournaments.value = (Array.isArray(FALLBACK_TOURNAMENTS) ? FALLBACK_TOURNAMENTS : []).filter(
      (t: any) => getTournamentGameSlug(t) === selected.value
    ) as TournamentLite[]
  } finally {
    tournamentsLoading.value = false
  }

  const queryTournament = String(route.query.tournament || '').trim()
  const stillExists = tournaments.value.some((t) => t.slug === selectedTournamentSlug.value)

  if (queryTournament && tournaments.value.some((t) => t.slug === queryTournament)) {
    selectedTournamentSlug.value = queryTournament
    return
  }

  if (!stillExists) {
    const live = tournaments.value.find((t) => getTournamentStatus(t) === 'live')
    selectedTournamentSlug.value = live?.slug || tournaments.value[0]?.slug || ''
  }
}

async function loadTournamentBoard() {
  if (!selectedTournamentSlug.value) {
    tournamentRows.value = []
    tournamentBoardLoading.value = false
    tournamentError.value = null
    return
  }

  tournamentBoardLoading.value = true
  tournamentError.value = null

  try {
    const res: any = await getTournamentLeaderboard(selectedTournamentSlug.value, 200)
    const items: TournamentRow[] = Array.isArray(res?.rows) ? res.rows : []
    tournamentRows.value = items
  } catch (e: any) {
    tournamentRows.value = []
    tournamentError.value = e?.data?.message || e?.message || 'Failed to load tournament leaderboard.'
  } finally {
    tournamentBoardLoading.value = false
  }
}

watch(
  selectedTournamentSlug,
  async () => {
    tournamentPage.value = 1
    await loadTournamentBoard()
  },
  { immediate: true }
)

watch(
  selected,
  async () => {
    tournaments.value = []
    selectedTournamentSlug.value = ''
    tournamentRows.value = []
    tournamentPage.value = 1
    await loadTournaments()
  },
  { immediate: true }
)

const hasTournaments = computed(() => tournaments.value.length > 0)

const liveTournament = computed(() => {
  return tournaments.value.find((t) => getTournamentStatus(t) === 'live') || null
})

const selectedTournament = computed(() => {
  return tournaments.value.find((t) => t.slug === selectedTournamentSlug.value) || null
})

const liveTournamentTimeLeft = computed(() => {
  if (!liveTournament.value) return ''
  const ms = new Date(getEndsAt(liveTournament.value)).getTime() - now.value
  return msToHMS(ms)
})

const tournamentTop3 = computed(() => tournamentRows.value.slice(0, 3))
const tournamentTotal = computed(() => tournamentRows.value.length)
const tournamentPageCount = computed(() => Math.max(1, Math.ceil(tournamentTotal.value / tournamentPerPage.value)))
const pagedTournamentRows = computed(() => {
  const start = (tournamentPage.value - 1) * tournamentPerPage.value
  return tournamentRows.value.slice(start, start + tournamentPerPage.value)
})

watch(tournamentPerPage, () => {
  tournamentPage.value = 1
})
watch(tournamentPageCount, (count) => {
  if (tournamentPage.value > count) tournamentPage.value = count
})

function pageWindow(page: number, count: number) {
  const out: number[] = []
  const start = Math.max(1, page - 2)
  const end = Math.min(count, page + 2)
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

const arcadePageWindow = computed(() => pageWindow(arcadePage.value, arcadePageCount.value))
const tournamentPageWindow = computed(() => pageWindow(tournamentPage.value, tournamentPageCount.value))

async function scrollToTournamentSection() {
  await nextTick()
  if (import.meta.client && tournamentSectionRef.value) {
    tournamentSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

onMounted(async () => {
  const queryTournament = String(route.query.tournament || '').trim()
  const hash = String(route.hash || '').trim()
  if (queryTournament || hash === '#tournament-leaderboard') {
    await scrollToTournamentSection()
  }
})

watch(
  () => [route.query.tournament, route.hash, selectedTournamentSlug.value, hasTournaments.value],
  async ([queryTournament, hash]) => {
    if (String(queryTournament || '').trim() || String(hash || '').trim() === '#tournament-leaderboard') {
      await scrollToTournamentSection()
    }
  }
)
</script>

<template>
  <UContainer class="py-12">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold text-[var(--app-fg)]">Leaderboard</h1>
        <p class="mt-2 text-black/70 dark:text-white/70">
          {{ gameNameBySlug[selected] || selected }} • Arcade &amp; Tournament Rankings
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="g in GAMES"
            :key="g.slug"
            size="sm"
            :variant="selected === g.slug ? 'solid' : 'soft'"
            :color="selected === g.slug ? 'primary' : 'info'"
            @click="selected = g.slug"
          >
            {{ g.name }}
          </UButton>
        </div>

        <div class="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
          <div class="inline-flex rounded-full border border-black/10 bg-white/60 p-1 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              class="rounded-full px-3 py-1.5 text-sm transition"
              :class="period === 'daily'
                ? 'bg-black/10 text-black dark:bg-white/10 dark:text-white'
                : 'text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white'"
              @click="period = 'daily'"
            >
              Daily
            </button>

            <button
              type="button"
              class="rounded-full px-3 py-1.5 text-sm transition"
              :class="period === 'weekly'
                ? 'bg-black/10 text-black dark:bg-white/10 dark:text-white'
                : 'text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white'"
              @click="period = 'weekly'"
            >
              Weekly
            </button>
          </div>

          <div class="rounded-2xl border border-black/10 bg-white/60 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div class="flex items-start gap-2">
              <div class="mt-0.5 grid h-8 w-8 place-items-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-black/30">
                <UIcon name="i-heroicons-clock" class="h-4 w-4 opacity-80" />
              </div>

              <div class="min-w-0">
                <div class="whitespace-nowrap text-[11px] leading-4 text-black/60 dark:text-white/60">
                  {{ resetLabel }}
                </div>

                <div class="mt-0.5 whitespace-nowrap text-sm font-semibold leading-5 tabular-nums text-black dark:text-white">
                  {{ timeLeftText }}
                  <span class="font-medium text-black/60 dark:text-white/60">left</span>
                </div>
              </div>
            </div>
          </div>

          <UButton variant="ghost" icon="i-heroicons-star" @click="goWinners">
            All-time Winners
          </UButton>
        </div>
      </div>
    </div>

    <section
      v-if="hasTournaments"
      id="tournament-leaderboard"
      ref="tournamentSectionRef"
      class="mt-6 rounded-3xl border border-black/10 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-5"
    >
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div class="min-w-0">
          <div
            class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
            :class="liveTournament
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
              : 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-200'"
          >
            <UIcon :name="liveTournament ? 'i-heroicons-bolt' : 'i-heroicons-calendar-days'" class="h-4 w-4" />
            <span>{{ liveTournament ? 'Live tournament available' : 'Tournament leaderboard available' }}</span>
          </div>

          <h2 class="mt-3 text-xl font-semibold text-black dark:text-white sm:text-2xl">
            Tournament Leaderboard
          </h2>

          <p class="mt-1 max-w-3xl text-sm text-black/70 dark:text-white/70">
            Tournament scores are separate from normal arcade scores. Choose a tournament below to view its ranking.
          </p>

          <div
            v-if="liveTournament"
            class="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-700 dark:text-emerald-200"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span class="font-medium">{{ liveTournament.title }}</span>
            <span class="opacity-80">• Ends in {{ liveTournamentTimeLeft }}</span>
          </div>
        </div>

        <div class="shrink-0 flex flex-wrap gap-2">
          <UButton
            v-if="selectedTournament"
            variant="soft"
            class="!rounded-full"
            :to="`/tournaments/${selectedTournament.slug}`"
          >
            Open Tournament
          </UButton>

          <UButton
            v-if="selectedTournament && getTournamentStatus(selectedTournament) === 'live'"
            class="!rounded-full"
            :to="`/tournaments/${selectedTournament.slug}`"
          >
            Play Tournament
          </UButton>
        </div>
      </div>

      <div v-if="tournamentsLoading" class="mt-4 text-sm text-black/70 dark:text-white/70">
        Loading tournaments…
      </div>

      <template v-else>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="t in tournaments"
            :key="t.slug"
            type="button"
            class="rounded-2xl border px-3 py-2 text-left transition"
            :class="
              selectedTournamentSlug === t.slug
                ? 'border-black/15 bg-black/5 text-black dark:border-white/15 dark:bg-white/10 dark:text-white'
                : 'border-black/10 bg-white text-black/70 hover:bg-black/5 hover:text-black dark:border-white/10 dark:bg-black/10 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white'
            "
            @click="selectedTournamentSlug = t.slug"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{{ t.title }}</span>
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
                :class="tournamentStatusPillClass(getTournamentStatus(t))"
              >
                {{ getTournamentStatus(t).toUpperCase() }}
              </span>
            </div>
            <div class="mt-1 text-[11px] text-black/60 dark:text-white/60">
              {{ tournamentChipCountdown(t) }}
            </div>
          </button>
        </div>

        <div
          v-if="selectedTournament"
          class="mt-5 rounded-2xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-black/20"
        >
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="min-w-0">
              <div class="text-base font-semibold text-black dark:text-white">
                {{ selectedTournament.title }}
              </div>
              <div class="mt-1 text-sm text-black/65 dark:text-white/65">
                {{ fmt(getStartsAt(selectedTournament)) || '—' }} → {{ fmt(getEndsAt(selectedTournament)) || '—' }}
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton
                variant="soft"
                class="!rounded-full"
                :to="`/tournaments/${selectedTournament.slug}`"
              >
                View Details
              </UButton>

              <UButton
                v-if="getTournamentStatus(selectedTournament) === 'live'"
                class="!rounded-full"
                :to="`/tournaments/${selectedTournament.slug}`"
              >
                Play Now
              </UButton>
            </div>
          </div>
        </div>

        <div
          v-if="!tournamentBoardLoading && !tournamentError && tournamentTop3.length"
          class="mt-5 grid gap-3 md:grid-cols-3"
        >
          <div
            v-for="(r, i) in tournamentTop3"
            :key="`${r.user_id ?? ''}_${r.player_name}_${r.score}_${r.created_at}_${i}`"
            class="rounded-3xl border border-black/10 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5"
          >
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-black dark:text-white">
                {{ medal(i) }} Rank #{{ i + 1 }}
              </div>
              <div
                class="text-xs"
                :class="selectedTournament && getTournamentStatus(selectedTournament) === 'live'
                  ? 'text-emerald-700 dark:text-emerald-200'
                  : 'text-black/60 dark:text-white/60'"
              >
                Tournament
              </div>
            </div>

            <div class="mt-3 flex items-center gap-3">
              <div class="relative h-12 w-12 overflow-hidden rounded-full border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                <img
                  v-if="tournamentAvatarFor(r)"
                  :src="tournamentAvatarFor(r)"
                  class="h-full w-full object-cover"
                  alt="avatar"
                  referrerpolicy="no-referrer"
                />
                <div v-else class="grid h-full w-full place-items-center text-sm font-semibold text-black/70 dark:text-white/70">
                  {{ initials(displayNameForTournament(r)) }}
                </div>
              </div>

              <div class="min-w-0">
                <div class="truncate font-semibold text-black dark:text-white">
                  {{ displayNameForTournament(r) }}
                </div>
                <div
                  v-if="maskedPhoneForTournament(r)"
                  class="mt-0.5 truncate text-[11px] text-black/60 dark:text-white/60"
                >
                  {{ maskedPhoneForTournament(r) }}
                </div>
                <div class="text-xs text-black/60 dark:text-white/60">
                  Achieved: {{ fmtDate(r.created_at) }}
                </div>
              </div>
            </div>

            <div class="mt-3 text-2xl font-semibold tabular-nums text-black dark:text-white">
              {{ r.score }}
              <span class="text-sm font-medium text-black/60 dark:text-white/60">pts</span>
            </div>
          </div>
        </div>

        <UCard class="mt-5 border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5">
          <template #header>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="font-semibold text-black dark:text-white">
                Tournament Top Players
              </div>

              <div class="flex items-center gap-2">
                <div v-if="tournamentBoardLoading" class="text-sm text-black/60 dark:text-white/60">Loading…</div>
                <select
                  v-model.number="tournamentPerPage"
                  class="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none dark:border-white/10 dark:bg-black/20 dark:text-white"
                >
                  <option v-for="n in perPageOptions" :key="`tp-${n}`" :value="n">{{ n }} / page</option>
                </select>
              </div>
            </div>
          </template>

          <div v-if="tournamentError" class="p-4 text-sm">
            <div class="text-black/90 dark:text-white/90">❌ {{ tournamentError }}</div>
            <div class="mt-3">
              <UButton size="sm" variant="soft" @click="loadTournamentBoard">Retry</UButton>
            </div>
          </div>

          <div v-if="!tournamentError" class="block md:hidden">
            <div v-if="!tournamentBoardLoading && pagedTournamentRows.length" class="space-y-3 p-4">
              <div
                v-for="(r, i) in pagedTournamentRows"
                :key="`m-${r.user_id ?? ''}_${r.player_name}_${r.score}_${r.created_at}_${i}`"
                class="rounded-2xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex items-center gap-3">
                    <div class="relative h-10 w-10 overflow-hidden rounded-full border border-black/10 bg-white dark:border-white/10 dark:bg-black/20">
                      <img
                        v-if="tournamentAvatarFor(r)"
                        :src="tournamentAvatarFor(r)"
                        class="h-full w-full object-cover"
                        alt="avatar"
                        referrerpolicy="no-referrer"
                      />
                      <div v-else class="grid h-full w-full place-items-center text-xs font-semibold text-black/70 dark:text-white/70">
                        {{ initials(displayNameForTournament(r)) }}
                      </div>
                    </div>
                    <div class="min-w-0">
                      <div class="truncate font-semibold text-black dark:text-white">{{ displayNameForTournament(r) }}</div>
                      <div class="text-xs text-black/60 dark:text-white/60">
                        Rank #{{ (tournamentPage - 1) * tournamentPerPage + i + 1 }}
                        <span v-if="maskedPhoneForTournament(r)">• {{ maskedPhoneForTournament(r) }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold tabular-nums text-black dark:text-white">{{ r.score }}</div>
                    <div class="text-[11px] text-black/60 dark:text-white/60">pts</div>
                  </div>
                </div>
                <div class="mt-3 text-xs text-black/60 dark:text-white/60">
                  {{ fmtDate(r.created_at) }}
                </div>
              </div>
            </div>

            <div v-else-if="!tournamentBoardLoading" class="py-10 text-center text-black/60 dark:text-white/60">
              No tournament scores found yet.
            </div>
          </div>

          <div v-if="!tournamentError" class="hidden overflow-auto md:block">
            <table class="w-full text-sm">
              <thead class="text-black/60 dark:text-white/60">
                <tr class="border-b border-black/10 text-left dark:border-white/10">
                  <th class="py-3 pr-3">#</th>
                  <th class="py-3 pr-3">Player</th>
                  <th class="py-3 pr-3">Phone</th>
                  <th class="py-3 pr-3">Score</th>
                  <th class="py-3 pr-3">Achieved</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="(r, i) in pagedTournamentRows"
                  :key="`${r.user_id ?? ''}_${r.player_name}_${r.score}_${r.created_at}_${i}`"
                  class="border-b border-black/10 transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <td class="py-3 pr-3 text-black/60 dark:text-white/60">
                    {{ (tournamentPage - 1) * tournamentPerPage + i + 1 }}
                  </td>

                  <td class="py-3 pr-3">
                    <div class="flex items-center gap-3">
                      <div class="relative h-9 w-9 overflow-hidden rounded-full border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                        <img
                          v-if="tournamentAvatarFor(r)"
                          :src="tournamentAvatarFor(r)"
                          class="h-full w-full object-cover"
                          alt="avatar"
                          referrerpolicy="no-referrer"
                        />
                        <div v-else class="grid h-full w-full place-items-center text-xs font-semibold text-black/70 dark:text-white/70">
                          {{ initials(displayNameForTournament(r)) }}
                        </div>
                      </div>

                      <div class="min-w-0">
                        <div class="truncate font-medium text-black dark:text-white">
                          {{ displayNameForTournament(r) }}
                        </div>
                        <div class="truncate text-[11px] text-black/50 dark:text-white/50">
                          {{ r.user_id ? 'Player' : 'Guest' }}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td class="py-3 pr-3 tabular-nums text-black/70 dark:text-white/70">
                    <span v-if="maskedPhoneForTournament(r)">{{ maskedPhoneForTournament(r) }}</span>
                    <span v-else class="text-black/40 dark:text-white/40">—</span>
                  </td>

                  <td class="py-3 pr-3 font-semibold tabular-nums text-black dark:text-white">{{ r.score }}</td>
                  <td class="py-3 pr-3 text-black/60 dark:text-white/60">{{ fmtDate(r.created_at) }}</td>
                </tr>

                <tr v-if="!tournamentBoardLoading && pagedTournamentRows.length === 0">
                  <td colspan="5" class="py-10 text-center text-black/60 dark:text-white/60">
                    No tournament scores found yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="tournamentTotal > 0"
            class="flex flex-col gap-3 border-t border-black/10 px-4 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="text-sm text-black/60 dark:text-white/60">
              Showing
              {{ (tournamentPage - 1) * tournamentPerPage + 1 }}
              -
              {{ Math.min(tournamentPage * tournamentPerPage, tournamentTotal) }}
              of {{ tournamentTotal }}
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <UButton size="sm" variant="soft" :disabled="tournamentPage <= 1" @click="tournamentPage--">Prev</UButton>
              <UButton
                v-for="p in tournamentPageWindow"
                :key="`tpw-${p}`"
                size="sm"
                :variant="p === tournamentPage ? 'solid' : 'soft'"
                @click="tournamentPage = p"
              >
                {{ p }}
              </UButton>
              <UButton size="sm" variant="soft" :disabled="tournamentPage >= tournamentPageCount" @click="tournamentPage++">Next</UButton>
            </div>
          </div>
        </UCard>
      </template>
    </section>

    <div v-if="!arcadeLoading && !arcadeError && top3.length" class="mt-6 grid gap-3 md:grid-cols-3">
      <div
        v-for="(r, i) in top3"
        :key="r.userId ?? `${r.player}_${r.score}_${r.createdAt}_${i}`"
        class="rounded-3xl border border-black/10 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5"
      >
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold text-black dark:text-white">
            {{ medal(i) }} Rank #{{ i + 1 }}
          </div>
          <div class="text-xs text-black/60 dark:text-white/60">
            {{ period === 'daily' ? 'Daily' : 'Weekly' }}
          </div>
        </div>

        <div class="mt-3 flex items-center gap-3">
          <div class="relative h-12 w-12 overflow-hidden rounded-full border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
            <img
              v-if="avatarFor(r)"
              :src="avatarFor(r)"
              class="h-full w-full object-cover"
              alt="avatar"
              referrerpolicy="no-referrer"
            />
            <div v-else class="grid h-full w-full place-items-center text-sm font-semibold text-black/70 dark:text-white/70">
              {{ initials(displayNameForArcade(r)) }}
            </div>
          </div>

          <div class="min-w-0">
            <div class="truncate font-semibold text-black dark:text-white">
              {{ displayNameForArcade(r) }}
            </div>

            <div
              v-if="maskedPhoneFor(r)"
              class="mt-0.5 truncate text-[11px] text-black/60 dark:text-white/60"
            >
              {{ maskedPhoneFor(r) }}
            </div>

            <div class="text-xs text-black/60 dark:text-white/60">
              Achieved: {{ fmtDate(r.createdAt) }}
            </div>
          </div>
        </div>

        <div class="mt-3 text-2xl font-semibold tabular-nums text-black dark:text-white">
          {{ r.score }}
          <span class="text-sm font-medium text-black/60 dark:text-white/60">pts</span>
        </div>
      </div>
    </div>

    <UCard class="mt-6 border border-black/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="font-semibold text-black dark:text-white">
            Top Players — {{ period === 'daily' ? 'Daily' : 'Weekly' }}
          </div>

          <div class="flex items-center gap-2">
            <div v-if="arcadeLoading" class="text-sm text-black/60 dark:text-white/60">Loading…</div>
            <select
              v-model.number="arcadePerPage"
              class="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              <option v-for="n in perPageOptions" :key="`ap-${n}`" :value="n">{{ n }} / page</option>
            </select>
          </div>
        </div>
      </template>

      <div v-if="arcadeError" class="p-4 text-sm">
        <div class="text-black/90 dark:text-white/90">❌ {{ arcadeError }}</div>
        <div class="mt-3">
          <UButton size="sm" variant="soft" @click="loadArcade">Retry</UButton>
        </div>
      </div>

      <div v-if="!arcadeError" class="block md:hidden">
        <div v-if="!arcadeLoading && pagedArcadeRows.length" class="space-y-3 p-4">
          <div
            v-for="(r, i) in pagedArcadeRows"
            :key="`am-${r.userId ?? `${r.player}_${r.score}_${r.createdAt}_${i}`}`"
            class="rounded-2xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex items-center gap-3">
                <div class="relative h-10 w-10 overflow-hidden rounded-full border border-black/10 bg-white dark:border-white/10 dark:bg-black/20">
                  <img
                    v-if="avatarFor(r)"
                    :src="avatarFor(r)"
                    class="h-full w-full object-cover"
                    alt="avatar"
                    referrerpolicy="no-referrer"
                  />
                  <div v-else class="grid h-full w-full place-items-center text-xs font-semibold text-black/70 dark:text-white/70">
                    {{ initials(displayNameForArcade(r)) }}
                  </div>
                </div>

                <div class="min-w-0">
                  <div class="truncate font-semibold text-black dark:text-white">{{ displayNameForArcade(r) }}</div>
                  <div class="text-xs text-black/60 dark:text-white/60">
                    Rank #{{ (arcadePage - 1) * arcadePerPage + i + 1 }}
                    <span v-if="maskedPhoneFor(r)">• {{ maskedPhoneFor(r) }}</span>
                  </div>
                </div>
              </div>

              <div class="text-right">
                <div class="font-semibold tabular-nums text-black dark:text-white">{{ r.score }}</div>
                <div class="text-[11px] text-black/60 dark:text-white/60">pts</div>
              </div>
            </div>

            <div class="mt-3 text-xs text-black/60 dark:text-white/60">
              {{ fmtDate(r.createdAt) }}
            </div>
          </div>
        </div>

        <div v-else-if="!arcadeLoading" class="py-10 text-center text-black/60 dark:text-white/60">
          No scores found for this {{ period }} period yet.
        </div>
      </div>

      <div v-if="!arcadeError" class="hidden overflow-auto md:block">
        <table class="w-full text-sm">
          <thead class="text-black/60 dark:text-white/60">
            <tr class="border-b border-black/10 text-left dark:border-white/10">
              <th class="py-3 pr-3">#</th>
              <th class="py-3 pr-3">Player</th>
              <th class="py-3 pr-3">Phone</th>
              <th class="py-3 pr-3">Best score</th>
              <th class="py-3 pr-3">Achieved</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="(r, i) in pagedArcadeRows"
              :key="r.userId ?? `${r.player}_${r.score}_${r.createdAt}_${i}`"
              class="border-b border-black/10 transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
            >
              <td class="py-3 pr-3 text-black/60 dark:text-white/60">
                {{ (arcadePage - 1) * arcadePerPage + i + 1 }}
              </td>

              <td class="py-3 pr-3">
                <div class="flex items-center gap-3">
                  <div class="relative h-9 w-9 overflow-hidden rounded-full border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                    <img
                      v-if="avatarFor(r)"
                      :src="avatarFor(r)"
                      class="h-full w-full object-cover"
                      alt="avatar"
                      referrerpolicy="no-referrer"
                    />
                    <div v-else class="grid h-full w-full place-items-center text-xs font-semibold text-black/70 dark:text-white/70">
                      {{ initials(displayNameForArcade(r)) }}
                    </div>
                  </div>

                  <div class="min-w-0">
                    <div class="truncate font-medium text-black dark:text-white">
                      {{ displayNameForArcade(r) }}
                    </div>
                    <div class="truncate text-[11px] text-black/50 dark:text-white/50">
                      {{ r.userId ? 'Player' : 'Guest' }}
                    </div>
                  </div>
                </div>
              </td>

              <td class="py-3 pr-3 tabular-nums text-black/70 dark:text-white/70">
                <span v-if="maskedPhoneFor(r)">{{ maskedPhoneFor(r) }}</span>
                <span v-else class="text-black/40 dark:text-white/40">—</span>
              </td>

              <td class="py-3 pr-3 font-semibold tabular-nums text-black dark:text-white">{{ r.score }}</td>
              <td class="py-3 pr-3 text-black/60 dark:text-white/60">{{ fmtDate(r.createdAt) }}</td>
            </tr>

            <tr v-if="!arcadeLoading && pagedArcadeRows.length === 0">
              <td colspan="5" class="py-10 text-center text-black/60 dark:text-white/60">
                No scores found for this {{ period }} period yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="arcadeTotal > 0"
        class="flex flex-col gap-3 border-t border-black/10 px-4 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="text-sm text-black/60 dark:text-white/60">
          Showing
          {{ (arcadePage - 1) * arcadePerPage + 1 }}
          -
          {{ Math.min(arcadePage * arcadePerPage, arcadeTotal) }}
          of {{ arcadeTotal }}
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UButton size="sm" variant="soft" :disabled="arcadePage <= 1" @click="arcadePage--">Prev</UButton>
          <UButton
            v-for="p in arcadePageWindow"
            :key="`apw-${p}`"
            size="sm"
            :variant="p === arcadePage ? 'solid' : 'soft'"
            @click="arcadePage = p"
          >
            {{ p }}
          </UButton>
          <UButton size="sm" variant="soft" :disabled="arcadePage >= arcadePageCount" @click="arcadePage++">Next</UButton>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>