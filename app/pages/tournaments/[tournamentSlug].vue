<!-- app/pages/tournaments/[tournamentSlug].vue -->
<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import { useTournamentLeaderboard } from '~/composables/useTournamentLeaderboard'
import { useSubscription } from '~/composables/useSubscription'

/**
 * Public page (viewable). Gate only the Play button.
 */
definePageMeta({})

const route = useRoute()
const slug = computed(() => String(route.params.tournamentSlug || '').trim())

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const toast = useToast()

const { bySlug } = useTournaments()
const { getLeaderboard } = useTournamentLeaderboard()
const { me } = useSubscription()

type AnyTournament = any
const t = ref<AnyTournament | null>(null)

/* ---------------- Load tournament (API with fallback) ---------------- */
async function loadTournament() {
  try {
    const x = await bySlug(slug.value)
    t.value = x || (FALLBACK as any).find((k: any) => k.slug === slug.value) || null
  } catch {
    t.value = (FALLBACK as any).find((k: any) => k.slug === slug.value) || null
  }
}
await loadTournament()

/* ---------------- SEO ---------------- */
const pageTitle = computed(() => (t.value ? `Tournament — ${t.value.title}` : 'Tournament'))
const pageDesc = computed(() => String(t.value?.description || 'Play tournaments, climb the leaderboard, win prizes.').trim())

useHead(() => ({
  title: pageTitle.value,
  meta: [
    { name: 'description', content: pageDesc.value },
    { property: 'og:title', content: pageTitle.value },
    { property: 'og:description', content: pageDesc.value },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: String(t.value?.thumbnail_url || '') || undefined }
  ].filter(Boolean) as any
}))

/* ---------------- Subscription ---------------- */
const sub = ref<{ active: boolean; subscription?: any } | null>(null)

async function refreshSub() {
  try {
    const s = await me()
    sub.value = { active: Boolean(s?.active), subscription: s?.subscription || null }
  } catch {
    sub.value = { active: false, subscription: null }
  }
}
await refreshSub()

/* ---------------- Time ticker ---------------- */
const now = ref(Date.now())
let timer: any = null
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => timer && clearInterval(timer))

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
function fmt(dt: string) {
  if (!dt) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(dt))
}
function msToClock(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}
function safeName(name: any) {
  const s = String(name || '').trim()
  return s || 'Player'
}
function initials(name: any) {
  const s = String(name || '').trim()
  if (!s) return 'P'
  const parts = s.split(/\s+/g).filter(Boolean)
  const a = parts[0]?.[0] || 'P'
  const b = parts.length > 1 ? (parts[1]?.[0] || '') : (parts[0]?.[1] || '')
  return (a + b).toUpperCase()
}
function maskPhone(phone: any) {
  const p = String(phone || '').trim().replace(/\s+/g, '')
  if (!p) return '—'
  const keep = Math.min(6, p.length)
  return p.slice(0, keep) + 'X'.repeat(Math.max(0, p.length - keep))
}

/* ---------------- Status (single source of truth) ---------------- */
const effectiveStatus = computed<'scheduled' | 'live' | 'ended' | 'canceled'>(() => {
  if (!t.value) return 'scheduled'
  const db = String(t.value?.status || 'scheduled').toLowerCase()
  if (db === 'canceled') return 'canceled'

  const s = new Date(getStartsAt(t.value)).getTime()
  const e = new Date(getEndsAt(t.value)).getTime()
  const hasS = Number.isFinite(s)
  const hasE = Number.isFinite(e)

  if (hasE && now.value >= e) return 'ended'
  if (hasS && now.value >= s && (!hasE || now.value < e)) return 'live'
  return 'scheduled'
})

const isLive = computed(() => effectiveStatus.value === 'live')
const isScheduled = computed(() => effectiveStatus.value === 'scheduled')
const isEnded = computed(() => effectiveStatus.value === 'ended')
const isCanceled = computed(() => effectiveStatus.value === 'canceled')

const startsInMs = computed(() => (t.value ? new Date(getStartsAt(t.value)).getTime() - now.value : 0))
const endsInMs = computed(() => (t.value ? new Date(getEndsAt(t.value)).getTime() - now.value : 0))

const game = computed(() => {
  if (!t.value) return null
  return GAMES.find((g) => g.slug === getGameSlug(t.value)) || null
})

/**
 * Arcade button visible until LIVE.
 * Once LIVE -> hide Arcade.
 */
const showArcadeBtn = computed(() => Boolean(t.value) && !isLive.value)

const canPlay = computed(() => {
  if (!t.value) return false
  if (!isLive.value) return false
  if (!user.value) return false
  return sub.value?.active === true
})

const statusBadge = computed(() => {
  const s = effectiveStatus.value
  if (s === 'live')
    return {
      text: 'LIVE',
      cls: 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-200',
      dot: 'bg-emerald-500'
    }
  if (s === 'scheduled')
    return {
      text: 'SCHEDULED',
      cls: 'bg-violet-500/10 border border-violet-500/25 text-violet-700 dark:text-violet-200',
      dot: 'bg-violet-500'
    }
  if (s === 'canceled')
    return {
      text: 'CANCELED',
      cls: 'bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-200',
      dot: 'bg-rose-500'
    }
  return {
    text: 'ENDED',
    cls: 'bg-gray-500/10 border border-gray-500/20 text-gray-700 dark:text-gray-300',
    dot: 'bg-gray-400'
  }
})

/* ---------------- Thumbnail ---------------- */
const fallbackThumb = '/img/placeholders/tournament.jpg'
const thumb = computed(() => {
  const a = String(t.value?.thumbnail_url || '').trim()
  if (a) return a
  const g = game.value as any
  const b = String(g?.thumbnail || g?.thumbnailUrl || '').trim()
  return b || fallbackThumb
})

/* ---------------- Prizes ---------------- */
function getPrize1(x: AnyTournament) {
  return String(x?.prize_1 ?? '').trim()
}
function getPrize2(x: AnyTournament) {
  return String(x?.prize_2 ?? '').trim()
}
function getPrize3(x: AnyTournament) {
  return String(x?.prize_3 ?? '').trim()
}
function getLegacyPrize(x: AnyTournament) {
  return String(x?.prize ?? '').trim()
}

const prizeTriplet = computed(() => {
  if (!t.value) {
    return [
      { rank: 1 as const, label: '1st Prize', value: '—' },
      { rank: 2 as const, label: '2nd Prize', value: '—' },
      { rank: 3 as const, label: '3rd Prize', value: '—' }
    ]
  }
  const p1 = getPrize1(t.value)
  const p2 = getPrize2(t.value)
  const p3 = getPrize3(t.value)
  const legacy = getLegacyPrize(t.value)
  return [
    { rank: 1 as const, label: '1st Prize', value: p1 || legacy || '—' },
    { rank: 2 as const, label: '2nd Prize', value: p2 || '—' },
    { rank: 3 as const, label: '3rd Prize', value: p3 || '—' }
  ]
})

/* ---------------- Leaderboard ---------------- */
type LbRow = { player_name: string; score: number; created_at: string }
const lb = ref<LbRow[]>([])
const lbPending = ref(false)
const lbError = ref<string | null>(null)

async function loadLeaderboard() {
  lbError.value = null
  lbPending.value = true
  try {
    const res = await getLeaderboard(slug.value, 50)
    lb.value = (res?.rows || []) as LbRow[]
  } catch (e: any) {
    lbError.value = e?.data?.message || e?.message || 'Failed to load leaderboard'
    lb.value = []
  } finally {
    lbPending.value = false
  }
}
await loadLeaderboard()

/* ---------------- Winners ---------------- */
type WinnerRow = {
  rank: 1 | 2 | 3
  player_name: string
  score: number
  user_id?: string | null
  prize?: string | null
  prize_bdt?: number | null
}

const winners = ref<WinnerRow[]>([])
const winnersPending = ref(false)
const winnersError = ref<string | null>(null)
const hasWinners = computed(() => winners.value.length > 0)

function winnerByRank(rank: 1 | 2 | 3) {
  return winners.value.find((w) => Number(w.rank) === rank) || null
}
function medal(rank: 1 | 2 | 3) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
}
function podiumLabel(rank: 1 | 2 | 3) {
  return rank === 1 ? 'Champion' : rank === 2 ? 'Runner-up' : '3rd Place'
}

/* profile enrich */
const avatarMap = ref<Record<string, string>>({})
const phoneMap = ref<Record<string, string>>({})

function avatarFor(uid?: string | null) {
  if (!uid) return ''
  return avatarMap.value[uid] || ''
}
function phoneFor(uid?: string | null) {
  if (!uid) return ''
  return phoneMap.value[uid] || ''
}
function onAvatarError(uid?: string | null) {
  if (!uid) return
  avatarMap.value = { ...avatarMap.value, [uid]: '' }
}

async function fetchProfiles(ids: string[]) {
  const attempts: Array<{ select: string; idKey: 'user_id' | 'id'; phoneKey: 'phone' | 'phone_number' }> = [
    { select: 'user_id, avatar_url, phone', idKey: 'user_id', phoneKey: 'phone' },
    { select: 'user_id, avatar_url, phone_number', idKey: 'user_id', phoneKey: 'phone_number' },
    { select: 'id, avatar_url, phone', idKey: 'id', phoneKey: 'phone' },
    { select: 'id, avatar_url, phone_number', idKey: 'id', phoneKey: 'phone_number' }
  ]

  for (const a of attempts) {
    try {
      const { data, error } = await (supabase as any).from('profiles').select(a.select).in(a.idKey, ids)
      if (error) throw error

      const nextA: Record<string, string> = { ...avatarMap.value }
      const nextP: Record<string, string> = { ...phoneMap.value }

      for (const row of data || []) {
        const uid = String(row?.[a.idKey] || '').trim()
        if (!uid) continue
        const av = String(row?.avatar_url || '').trim()
        const ph = String(row?.[a.phoneKey] || '').trim()
        if (av) nextA[uid] = av
        if (ph) nextP[uid] = ph
      }

      avatarMap.value = nextA
      phoneMap.value = nextP
      return
    } catch {
      // continue
    }
  }
}

async function loadWinners() {
  winnersError.value = null
  winnersPending.value = true
  try {
    const res = await $fetch<{ winners?: WinnerRow[] }>(`/api/tournaments/winners`, {
      credentials: 'include',
      query: { slug: slug.value }
    })
    const arr = Array.isArray(res?.winners) ? (res.winners as WinnerRow[]) : []
    winners.value = arr

    const ids = Array.from(new Set(arr.map((w) => w.user_id).filter(Boolean))) as string[]
    if (ids.length) await fetchProfiles(ids)
  } catch (e: any) {
    winnersError.value = e?.data?.message || e?.message || 'Failed to load winners'
    winners.value = []
  } finally {
    winnersPending.value = false
  }
}

/* boundary refresh */
const lastBoundaryTick = ref<number>(0)

watch(
  () => now.value,
  async () => {
    if (!t.value) return

    const s = new Date(getStartsAt(t.value)).getTime()
    const e = new Date(getEndsAt(t.value)).getTime()
    if (!Number.isFinite(s) && !Number.isFinite(e)) return

    const nearStart = Number.isFinite(s) ? Math.abs(now.value - s) < 1500 : false
    const nearEnd = Number.isFinite(e) ? Math.abs(now.value - e) < 1500 : false
    if (!nearStart && !nearEnd) return

    if (now.value - lastBoundaryTick.value < 2000) return
    lastBoundaryTick.value = now.value

    await loadTournament()
    await refreshSub()
    await loadLeaderboard()

    if (effectiveStatus.value === 'ended') {
      await loadWinners()
    }
  }
)

if (effectiveStatus.value === 'ended') {
  await loadWinners()
}

/* Play */
function playHard(tournamentSlug: string) {
  if (!import.meta.client) return
  const url = `/tournaments/embed/${encodeURIComponent(tournamentSlug)}?boot=${Date.now()}`
  window.location.assign(url)
}

/* Copy link + toast */
async function shareLink() {
  if (!import.meta.client) return
  try {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    toast.add({
      title: 'Link copied',
      description: 'Tournament link copied to clipboard.',
      icon: 'i-heroicons-clipboard-document-check',
      color: 'green'
    })
  } catch {
    toast.add({
      title: 'Could not copy',
      description: 'Your browser blocked clipboard access.',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red'
    })
  }
}

function statusLine() {
  if (!t.value) return ''
  if (isLive.value) return `Ends in ${msToClock(endsInMs.value)}`
  if (isScheduled.value) return `Starts in ${msToClock(startsInMs.value)}`
  if (isCanceled.value) return 'This tournament was canceled.'
  return 'Tournament ended.'
}
</script>

<template>
  <UContainer class="py-10">
    <!-- Not found -->
    <div
      v-if="!t"
      class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-6
             text-gray-900 dark:text-gray-100 shadow-sm shadow-black/5 dark:shadow-none"
    >
      <div class="text-lg font-semibold">Tournament not found</div>
      <NuxtLink to="/tournaments" class="mt-3 inline-block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
        ← Back to tournaments
      </NuxtLink>
    </div>

    <div v-else>
      <!-- Top bar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <NuxtLink to="/tournaments" class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
          ← Back
        </NuxtLink>

        <div class="flex items-center gap-2">
          <UButton size="sm" variant="soft" class="!rounded-full" @click="shareLink">
            Copy link
          </UButton>

          <UButton v-if="user && sub && !sub.active" to="/subscribe" size="sm" class="!rounded-full">
            Subscribe to Play
          </UButton>
          <UButton v-else-if="user" to="/subscribe" size="sm" variant="soft" class="!rounded-full">
            Subscription
          </UButton>
        </div>
      </div>

      <!-- HERO -->
      <div class="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <!-- Left: hero -->
        <div
          class="group relative overflow-hidden rounded-3xl border
                 border-gray-200/70 dark:border-white/10
                 bg-white/70 dark:bg-white/5 backdrop-blur
                 shadow-sm shadow-black/5 dark:shadow-none"
        >
          <img
            :src="thumb"
            :alt="t.title"
            class="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035] group-hover:brightness-[1.06]"
          />

          <!-- Stronger overlay in light mode too -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
          <div class="absolute inset-0 bg-gradient-to-r from-black/60 via-black/10 to-transparent" />

          <div aria-hidden="true" class="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-700">
            <div class="absolute -inset-y-10 -left-1/2 w-1/2 rotate-12 bg-white/10 blur-xl animate-[adSweep_1.2s_ease-in-out_1]" />
          </div>

          <div class="absolute left-4 top-4 flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold"
              :class="statusBadge.cls"
            >
              <span class="inline-flex h-1.5 w-1.5 rounded-full" :class="statusBadge.dot" />
              {{ statusBadge.text }}
            </span>

            <span
              class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]
                     border-white/20 bg-black/35 text-white/90"
            >
              <span class="inline-flex h-1.5 w-1.5 rounded-full bg-white/70" />
              {{ game?.name || getGameSlug(t) }}
            </span>

            <span
              v-if="sub?.active"
              class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]
                     border-emerald-400/25 bg-emerald-500/10 text-emerald-100/95"
            >
              <span class="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Pass Active
            </span>
          </div>

          <div class="relative p-6 sm:p-7">
            <h1 class="mt-6 text-3xl sm:text-4xl font-semibold text-white drop-shadow">
              {{ t.title }}
            </h1>

            <p v-if="t.description" class="mt-2 max-w-2xl text-sm sm:text-base text-white/80">
              {{ t.description }}
            </p>

            <div class="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/90">
              <span class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1.5">
                <UIcon name="i-heroicons-clock" class="h-4 w-4 opacity-90" />
                {{ statusLine() }}
              </span>

              <span class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1.5">
                <UIcon name="i-heroicons-calendar-days" class="h-4 w-4 opacity-90" />
                {{ fmt(getStartsAt(t)) }}
              </span>

              <span class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1.5">
                <UIcon name="i-heroicons-flag" class="h-4 w-4 opacity-90" />
                {{ fmt(getEndsAt(t)) }}
              </span>
            </div>

            <div class="mt-6 flex flex-wrap gap-2">
              <UButton v-if="canPlay" size="lg" class="!rounded-full" @click="playHard(t.slug)">
                <UIcon name="i-heroicons-play" class="h-5 w-5" />
                Play Now
              </UButton>

              <UButton v-else-if="isLive && user && sub && !sub.active" to="/subscribe" size="lg" class="!rounded-full">
                <UIcon name="i-heroicons-lock-closed" class="h-5 w-5" />
                Subscribe to Play
              </UButton>

              <UButton v-else :to="`/tournaments/embed/${t.slug}`" size="lg" variant="soft" class="!rounded-full">
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-5 w-5" />
                Open
              </UButton>

              <!-- Arcade (visible only before LIVE) -->
              <UButton v-if="showArcadeBtn" :to="`/arcade/${getGameSlug(t)}`" size="lg" variant="soft" class="!rounded-full">
                <UIcon name="i-heroicons-rectangle-group" class="h-5 w-5" />
                Arcade
              </UButton>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div class="space-y-4">
          <!-- Schedule -->
          <div
            class="rounded-3xl border border-gray-200/70 dark:border-white/10
                   bg-white/70 dark:bg-white/5 backdrop-blur p-5
                   text-gray-900 dark:text-gray-100 shadow-sm shadow-black/5 dark:shadow-none"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-semibold">Schedule</div>
                <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Live is computed by time window.
                </div>
              </div>
              <span class="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{{ slug }}</span>
            </div>

            <div class="mt-4 grid gap-3">
              <div class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
                <div class="text-xs text-gray-600 dark:text-gray-400">Starts</div>
                <div class="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{{ fmt(getStartsAt(t)) }}</div>
                <div v-if="isScheduled" class="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Starts in: <span class="font-mono">{{ msToClock(startsInMs) }}</span>
                </div>
              </div>

              <div class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
                <div class="text-xs text-gray-600 dark:text-gray-400">Ends</div>
                <div class="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{{ fmt(getEndsAt(t)) }}</div>
                <div v-if="isLive" class="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Ends in: <span class="font-mono">{{ msToClock(endsInMs) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Eligibility -->
          <div
            class="rounded-3xl border border-gray-200/70 dark:border-white/10
                   bg-white/70 dark:bg-white/5 backdrop-blur p-5
                   text-gray-900 dark:text-gray-100 shadow-sm shadow-black/5 dark:shadow-none"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-semibold">Eligibility</div>

              <span
                class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]
                       border-gray-200 dark:border-white/10
                       bg-gray-50 dark:bg-black/20
                       text-gray-700 dark:text-gray-200"
              >
                <span class="inline-flex h-1.5 w-1.5 rounded-full" :class="sub?.active ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-white/35'" />
                {{ sub?.active ? 'Subscription Active' : 'Subscription Required' }}
              </span>
            </div>

            <div class="mt-3 text-sm text-gray-700 dark:text-gray-300">
              <template v-if="!isLive">
                Tournament is not live yet. You can view details & leaderboard.
              </template>

              <template v-else-if="!user">
                Please log in to play tournaments.
                <div class="mt-3">
                  <UButton to="/login" class="!rounded-full">Login</UButton>
                </div>
              </template>

              <template v-else-if="sub && !sub.active">
                Subscription required to play. Activate a plan to participate.
                <div class="mt-3">
                  <UButton to="/subscribe" class="!rounded-full">Subscribe</UButton>
                </div>
              </template>

              <template v-else>
                You’re eligible to play. Tap <b>Play Now</b> on the left.
              </template>
            </div>
          </div>

          <!-- Prizes -->
          <div
            class="rounded-3xl border border-gray-200/70 dark:border-white/10
                   bg-white/70 dark:bg-white/5 backdrop-blur p-5
                   text-gray-900 dark:text-gray-100 shadow-sm shadow-black/5 dark:shadow-none"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold">Prizes</div>
                <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">Top 3 winners will be rewarded.</div>
              </div>
              <UIcon name="i-heroicons-gift" class="h-5 w-5 text-gray-700 dark:text-gray-200 opacity-90" />
            </div>

            <div class="mt-4 grid gap-3">
              <div v-for="p in prizeTriplet" :key="p.rank" class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs text-gray-600 dark:text-gray-400">{{ p.label }}</div>
                  <div class="text-base">{{ p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉' }}</div>
                </div>
                <div class="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ p.value }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Winners (ENDED only) -->
      <div
        v-if="isEnded"
        class="mt-8 rounded-3xl border border-gray-200/70 dark:border-white/10
               bg-white/70 dark:bg-white/5 backdrop-blur p-6 overflow-hidden
               text-gray-900 dark:text-gray-100 shadow-sm shadow-black/5 dark:shadow-none"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-trophy" class="w-5 h-5" />
              Final Results
            </div>
            <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">Winners are locked after the tournament ends.</div>
          </div>

          <UButton size="xs" variant="soft" class="!rounded-full" :loading="winnersPending" @click="loadWinners">
            Refresh
          </UButton>
        </div>

        <div v-if="winnersError" class="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-100">
          {{ winnersError }}
        </div>

        <div v-if="!winnersPending && !hasWinners" class="mt-5 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 text-sm text-gray-700 dark:text-gray-300">
          No winners snapshot yet. Refresh once.
        </div>

        <div v-else class="mt-6">
          <div class="grid gap-4 md:grid-cols-3 items-end">
            <!-- 2nd -->
            <div class="order-2 md:order-1">
              <div class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 text-center">
                <div class="text-3xl">🥈</div>
                <div class="mt-2 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">{{ podiumLabel(2) }}</div>

                <div class="mt-4 flex justify-center">
                  <div class="h-14 w-14 rounded-full overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-black/20">
                    <img
                      v-if="avatarFor(winnerByRank(2)?.user_id)"
                      :src="avatarFor(winnerByRank(2)?.user_id)"
                      alt="avatar"
                      class="h-full w-full object-cover"
                      @error="onAvatarError(winnerByRank(2)?.user_id)"
                    />
                    <div v-else class="h-full w-full grid place-items-center text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {{ initials(winnerByRank(2)?.player_name) }}
                    </div>
                  </div>
                </div>

                <div class="mt-2 text-lg font-semibold">{{ safeName(winnerByRank(2)?.player_name) }}</div>
                <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Phone: <b class="font-semibold text-gray-900 dark:text-gray-100">{{ maskPhone(phoneFor(winnerByRank(2)?.user_id)) }}</b>
                </div>

                <div class="mt-2 inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-3 py-1 text-sm">
                  <UIcon name="i-heroicons-bolt" class="w-4 h-4 opacity-80" />
                  <span class="font-semibold">{{ winnerByRank(2)?.score ?? '—' }}</span>
                </div>

                <div v-if="winnerByRank(2)?.prize" class="mt-3 text-sm text-gray-700 dark:text-gray-300">
                  <b>Prize:</b> {{ winnerByRank(2)?.prize }}
                </div>
              </div>
            </div>

            <!-- 1st -->
            <div class="order-1 md:order-2">
              <div class="rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-500/15 to-white/70 dark:to-white/5 p-6 text-center">
                <div class="flex items-center justify-center gap-2">
                  <span class="text-3xl">🥇</span>
                  <span class="text-2xl">👑</span>
                </div>
                <div class="mt-2 text-xs uppercase tracking-wider text-amber-700 dark:text-amber-200/90">{{ podiumLabel(1) }}</div>

                <div class="mt-4 flex justify-center">
                  <div class="h-16 w-16 rounded-full overflow-hidden border border-amber-400/25 bg-gray-100 dark:bg-black/20">
                    <img
                      v-if="avatarFor(winnerByRank(1)?.user_id)"
                      :src="avatarFor(winnerByRank(1)?.user_id)"
                      alt="avatar"
                      class="h-full w-full object-cover"
                      @error="onAvatarError(winnerByRank(1)?.user_id)"
                    />
                    <div v-else class="h-full w-full grid place-items-center text-sm font-semibold text-amber-800 dark:text-amber-100/80">
                      {{ initials(winnerByRank(1)?.player_name) }}
                    </div>
                  </div>
                </div>

                <div class="mt-2 text-2xl font-semibold">{{ safeName(winnerByRank(1)?.player_name) }}</div>
                <div class="mt-1 text-xs text-amber-800/90 dark:text-amber-100/80">
                  Phone: <b class="font-semibold">{{ maskPhone(phoneFor(winnerByRank(1)?.user_id)) }}</b>
                </div>

                <div class="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-4 py-1 text-sm">
                  <UIcon name="i-heroicons-bolt" class="w-4 h-4 opacity-90" />
                  <span class="font-semibold">{{ winnerByRank(1)?.score ?? '—' }}</span>
                </div>

                <div v-if="winnerByRank(1)?.prize" class="mt-3 text-sm text-amber-900 dark:text-amber-100/90">
                  <b>Prize:</b> {{ winnerByRank(1)?.prize }}
                </div>
              </div>
            </div>

            <!-- 3rd -->
            <div class="order-3">
              <div class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 text-center">
                <div class="text-3xl">🥉</div>
                <div class="mt-2 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">{{ podiumLabel(3) }}</div>

                <div class="mt-4 flex justify-center">
                  <div class="h-14 w-14 rounded-full overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-black/20">
                    <img
                      v-if="avatarFor(winnerByRank(3)?.user_id)"
                      :src="avatarFor(winnerByRank(3)?.user_id)"
                      alt="avatar"
                      class="h-full w-full object-cover"
                      @error="onAvatarError(winnerByRank(3)?.user_id)"
                    />
                    <div v-else class="h-full w-full grid place-items-center text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {{ initials(winnerByRank(3)?.player_name) }}
                    </div>
                  </div>
                </div>

                <div class="mt-2 text-lg font-semibold">{{ safeName(winnerByRank(3)?.player_name) }}</div>
                <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Phone: <b class="font-semibold text-gray-900 dark:text-gray-100">{{ maskPhone(phoneFor(winnerByRank(3)?.user_id)) }}</b>
                </div>

                <div class="mt-2 inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-3 py-1 text-sm">
                  <UIcon name="i-heroicons-bolt" class="w-4 h-4 opacity-80" />
                  <span class="font-semibold">{{ winnerByRank(3)?.score ?? '—' }}</span>
                </div>

                <div v-if="winnerByRank(3)?.prize" class="mt-3 text-sm text-gray-700 dark:text-gray-300">
                  <b>Prize:</b> {{ winnerByRank(3)?.prize }}
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 grid gap-3 md:grid-cols-3">
            <div
              v-for="r in winners"
              :key="`${r.rank}-${r.player_name}-${r.score}`"
              class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="h-10 w-10 rounded-full overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-black/20">
                    <img v-if="avatarFor(r.user_id)" :src="avatarFor(r.user_id)" alt="avatar" class="h-full w-full object-cover" @error="onAvatarError(r.user_id)" />
                    <div v-else class="h-full w-full grid place-items-center text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {{ initials(r.player_name) }}
                    </div>
                  </div>

                  <div>
                    <div class="text-xs text-gray-600 dark:text-gray-400">Rank #{{ r.rank }} • {{ medal(r.rank) }}</div>
                    <div class="font-semibold">{{ safeName(r.player_name) }}</div>
                    <div class="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                      Phone: <b class="font-semibold text-gray-900 dark:text-gray-100">{{ maskPhone(phoneFor(r.user_id)) }}</b>
                    </div>
                    <div v-if="r.prize" class="mt-1 text-xs text-gray-700 dark:text-gray-300">Prize: <b>{{ r.prize }}</b></div>
                  </div>
                </div>

                <div class="text-right">
                  <div class="text-xs text-gray-600 dark:text-gray-400">Score</div>
                  <div class="text-lg font-semibold">{{ r.score }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom grid: How it works + Leaderboard -->
      <div class="mt-8 grid gap-4 lg:grid-cols-3">
        <div class="lg:col-span-2 space-y-4">
          <div
            class="rounded-3xl border border-gray-200/70 dark:border-white/10
                   bg-white/70 dark:bg-white/5 backdrop-blur p-5
                   text-gray-900 dark:text-gray-100 shadow-sm shadow-black/5 dark:shadow-none"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-lg font-semibold">How it works</div>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Play during the live window. Highest scores rank on the leaderboard. Top 3 win prizes.
                </p>
              </div>
              <UIcon name="i-heroicons-information-circle" class="h-6 w-6 text-gray-700 dark:text-gray-200 opacity-90" />
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
                <div class="text-xs text-gray-600 dark:text-gray-400">Entry</div>
                <div class="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <span v-if="user && sub?.active">✅ Eligible</span>
                  <span v-else-if="!user">Login required</span>
                  <span v-else>Subscription required</span>
                </div>
                <div class="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  You must be logged in and have an active subscription to submit scores.
                </div>
              </div>

              <div class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
                <div class="text-xs text-gray-600 dark:text-gray-400">Game</div>
                <div class="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ game?.name || getGameSlug(t) }}</div>
                <div class="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  Practice before live. When live, play from the tournament page.
                </div>
              </div>
            </div>
          </div>

          <div
            class="rounded-3xl border border-gray-200/70 dark:border-white/10
                   bg-white/70 dark:bg-white/5 backdrop-blur p-5
                   text-gray-900 dark:text-gray-100 shadow-sm shadow-black/5 dark:shadow-none"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="text-lg font-semibold">Quick actions</div>
              <UIcon name="i-heroicons-sparkles" class="h-6 w-6 text-gray-700 dark:text-gray-200 opacity-90" />
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <UButton v-if="canPlay" @click="playHard(t.slug)" class="!rounded-full">
                <UIcon name="i-heroicons-play" class="h-5 w-5" />
                Play Now
              </UButton>

              <UButton v-else to="/subscribe" variant="soft" class="!rounded-full">
                <UIcon name="i-heroicons-credit-card" class="h-5 w-5" />
                View plans
              </UButton>


              <UButton v-if="showArcadeBtn" :to="`/arcade/${getGameSlug(t)}`" variant="soft" class="!rounded-full">
                <UIcon name="i-heroicons-rectangle-group" class="h-5 w-5" />
                Go to arcade
              </UButton>
            </div>
          </div>
        </div>

        <div
          class="rounded-3xl border border-gray-200/70 dark:border-white/10
                 bg-white/70 dark:bg-white/5 backdrop-blur p-5
                 text-gray-900 dark:text-gray-100 shadow-sm shadow-black/5 dark:shadow-none"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-lg font-semibold">Leaderboard</div>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Tournament-only scores.</p>
            </div>

            <UButton size="xs" variant="soft" class="!rounded-full" :loading="lbPending" @click="loadLeaderboard">
              Refresh
            </UButton>
          </div>

          <div v-if="lbError" class="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-100">
            {{ lbError }}
          </div>

          <div v-if="!lbPending && !lb.length" class="mt-4 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 text-sm text-gray-700 dark:text-gray-300">
            No scores yet.
          </div>

          <div v-else class="mt-4 space-y-2">
            <div
              v-for="(r, i) in lb"
              :key="`${r.player_name}-${r.created_at}-${i}`"
              class="flex items-center justify-between rounded-2xl border
                     border-gray-200/70 dark:border-white/10
                     bg-white/70 dark:bg-white/5 px-3 py-2"
            >
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-6 text-xs text-gray-500 dark:text-gray-400">{{ i + 1 }}</div>
                <div class="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{{ safeName(r.player_name) }}</div>
              </div>
              <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ r.score }}</div>
            </div>

            <div v-if="lbPending" class="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 text-sm text-gray-600 dark:text-gray-400">
              Loading…
            </div>
          </div>
        </div>
      </div>
    </div>
  </UContainer>
</template>

<style scoped>
@keyframes adSweep {
  from {
    transform: translateX(-20%) rotate(12deg);
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  to {
    transform: translateX(220%) rotate(12deg);
    opacity: 0;
  }
}
</style>
