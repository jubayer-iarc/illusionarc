<!-- app/pages/tournaments/[tournamentSlug].vue -->
<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import { useTournamentLeaderboard } from '~/composables/useTournamentLeaderboard'
import { useSubscription } from '~/composables/useSubscription'

const route = useRoute()
const slug = computed(() => String(route.params.tournamentSlug || '').trim())

const user = useSupabaseUser()
const supabase = useSupabaseClient()

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

useHead(() => ({
  title: t.value ? `Tournament — ${t.value.title}` : 'Tournament'
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
/** ✅ phone mask: keep first 6, hide the rest with X (Bangladesh 11 digits -> 5 X) */
function maskPhone(phone: any) {
  const p = String(phone || '').trim().replace(/\s+/g, '')
  if (!p) return '—'
  const keep = Math.min(6, p.length)
  return p.slice(0, keep) + 'X'.repeat(Math.max(0, p.length - keep))
}

/* ---------------- Prize helpers (new system) ---------------- */
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

/** Keep your existing list (used before), but we’ll also always render 3 prize cards */
const prizeList = computed(() => {
  if (!t.value) return []
  const p1 = getPrize1(t.value)
  const p2 = getPrize2(t.value)
  const p3 = getPrize3(t.value)
  const out = [
    p1 ? { rank: 1 as const, label: '1st Prize', value: p1 } : null,
    p2 ? { rank: 2 as const, label: '2nd Prize', value: p2 } : null,
    p3 ? { rank: 3 as const, label: '3rd Prize', value: p3 } : null
  ].filter(Boolean) as { rank: 1 | 2 | 3; label: string; value: string }[]
  return out
})

/** ✅ Always show 3 prizes (before start + after end) */
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

/**
 * ✅ Single source of truth for status:
 * - If canceled in DB -> canceled
 * - Else decide by time window:
 *   ended if now >= ends_at
 *   live if starts_at <= now < ends_at
 *   scheduled otherwise
 */
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

const startsInMs = computed(() => (t.value ? new Date(getStartsAt(t.value)).getTime() - now.value : 0))
const endsInMs = computed(() => (t.value ? new Date(getEndsAt(t.value)).getTime() - now.value : 0))

const game = computed(() => {
  if (!t.value) return null
  return GAMES.find((g) => g.slug === getGameSlug(t.value)) || null
})

const canPlay = computed(() => {
  if (!t.value) return false
  if (effectiveStatus.value !== 'live') return false
  if (!user.value) return false
  return sub.value?.active === true
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

/* ---------------- Winners (final snapshot) ---------------- */
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

/* ✅ Winner profile enrich (avatar + phone) */
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
  // Try common profile schemas without breaking if a column doesn't exist
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
      // try next schema
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

/* ---------------- Boundary refresh ---------------- */
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

/* initial winners load if already ended by time */
if (effectiveStatus.value === 'ended') {
  await loadWinners()
}

/* ---------------- Play (hard reload) ---------------- */
function playHard(tournamentSlug: string) {
  if (!import.meta.client) return
  const url = `/tournaments/embed/${encodeURIComponent(tournamentSlug)}?boot=${Date.now()}`
  window.location.assign(url)
}
</script>

<template>
  <UContainer class="py-10">
    <div v-if="!t" class="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div class="text-lg font-semibold">Tournament not found</div>
      <NuxtLink to="/tournaments" class="mt-3 inline-block text-sm opacity-80 hover:opacity-100">
        ← Back to tournaments
      </NuxtLink>
    </div>

    <div v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <NuxtLink to="/tournaments" class="text-sm opacity-70 hover:opacity-100">← Back</NuxtLink>

        <div class="flex items-center gap-2">
          <UButton v-if="user && sub && !sub.active" to="/subscribe" class="!rounded-full">
            Subscribe to Play
          </UButton>
          <UButton v-else-if="user" to="/subscribe" variant="soft" class="!rounded-full">
            Subscription
          </UButton>
        </div>
      </div>

      <!-- Title / Summary -->
      <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-semibold">{{ t.title }}</h1>
          <p v-if="t.description" class="mt-2 opacity-80 max-w-3xl">{{ t.description }}</p>

          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            <span
              v-if="effectiveStatus === 'live'"
              class="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/20 text-emerald-300"
            >
              LIVE
            </span>

            <span
              v-else-if="effectiveStatus === 'scheduled'"
              class="px-2 py-1 rounded-full bg-violet-500/15 border border-violet-400/20 text-violet-300"
            >
              SCHEDULED
            </span>

            <span
              v-else-if="effectiveStatus === 'canceled'"
              class="px-2 py-1 rounded-full bg-red-500/15 border border-red-400/20 text-red-200"
            >
              CANCELED
            </span>

            <span v-else class="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-white/70">
              ENDED
            </span>

            <span class="px-2 py-1 rounded-full bg-white/5 border border-white/10">
              Game: <b class="font-semibold">{{ game?.name || getGameSlug(t) }}</b>
            </span>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton v-if="canPlay" @click="playHard(t.slug)" class="!rounded-full">
            Play Now
          </UButton>

          <UButton
            v-else-if="effectiveStatus === 'live' && user && sub && !sub.active"
            to="/subscribe"
            class="!rounded-full"
          >
            Subscribe to Play
          </UButton>

          <UButton v-else :to="`/tournaments/embed/${t.slug}`" variant="soft" class="!rounded-full">
            Open
          </UButton>

          <UButton :to="`/arcade/${getGameSlug(t)}`" variant="soft" class="!rounded-full">
            Arcade (if available)
          </UButton>
        </div>
      </div>

      <!-- ✅ Prizes (ALWAYS show 3) -->
      <div v-if="effectiveStatus === 'live'" class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div class="text-lg font-semibold">Prizes</div>
        <div class="mt-3 grid gap-3 md:grid-cols-3">
          <div
            v-for="p in prizeTriplet"
            :key="p.rank"
            class="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div class="text-xs opacity-70">{{ p.label }}</div>
            <div class="mt-1 font-semibold">{{ p.value }}</div>
          </div>
        </div>
      </div>

      <!-- ✅ Winners Podium (ENDED only) -->
      <div
        v-if="effectiveStatus === 'ended'"
        class="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 overflow-hidden"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-trophy" class="w-5 h-5" />
              Final Results
            </div>
            <div class="mt-1 text-sm opacity-70">Winners are locked after the tournament ends.</div>
          </div>

          <UButton size="xs" variant="soft" class="!rounded-full" :loading="winnersPending" @click="loadWinners">
            Refresh
          </UButton>
        </div>

        <div v-if="winnersError" class="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
          {{ winnersError }}
        </div>

        <div
          v-if="!winnersPending && !hasWinners"
          class="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm opacity-80"
        >
          No winners snapshot yet. Refresh once (auto-finalize runs on this page).
        </div>

        <div v-else class="mt-6">
          <div class="grid gap-4 md:grid-cols-3 items-end">
            <!-- 2nd -->
            <div class="order-2 md:order-1">
              <div class="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <div class="text-3xl">🥈</div>
                <div class="mt-2 text-xs uppercase tracking-wider opacity-70">{{ podiumLabel(2) }}</div>

                <!-- ✅ Avatar -->
                <div class="mt-4 flex justify-center">
                  <div class="h-14 w-14 rounded-full overflow-hidden border border-white/10 bg-black/20">
                    <img
                      v-if="avatarFor(winnerByRank(2)?.user_id)"
                      :src="avatarFor(winnerByRank(2)?.user_id)"
                      alt="avatar"
                      class="h-full w-full object-cover"
                      @error="onAvatarError(winnerByRank(2)?.user_id)"
                    />
                    <div v-else class="h-full w-full grid place-items-center text-sm font-semibold opacity-80">
                      {{ initials(winnerByRank(2)?.player_name) }}
                    </div>
                  </div>
                </div>

                <div class="mt-2 text-lg font-semibold">{{ safeName(winnerByRank(2)?.player_name) }}</div>

                <!-- ✅ Phone masked -->
                <div class="mt-1 text-xs opacity-70">
                  Phone: <b class="font-semibold">{{ maskPhone(phoneFor(winnerByRank(2)?.user_id)) }}</b>
                </div>

                <div class="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm">
                  <UIcon name="i-heroicons-bolt" class="w-4 h-4 opacity-80" />
                  <span class="font-semibold">{{ winnerByRank(2)?.score ?? '—' }}</span>
                </div>

                <div v-if="winnerByRank(2)?.prize" class="mt-3 text-sm opacity-85">
                  <b>Prize:</b> {{ winnerByRank(2)?.prize }}
                </div>
                <!-- <div class="mt-4 h-12 rounded-xl bg-white/5 border border-white/10"></div> -->
              </div>
            </div>

            <!-- 1st -->
            <div class="order-1 md:order-2">
              <div class="rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-500/15 to-white/5 p-6 text-center">
                <div class="flex items-center justify-center gap-2">
                  <span class="text-3xl">🥇</span>
                  <span class="text-2xl">👑</span>
                </div>
                <div class="mt-2 text-xs uppercase tracking-wider text-amber-200/90">{{ podiumLabel(1) }}</div>

                <!-- ✅ Avatar -->
                <div class="mt-4 flex justify-center">
                  <div class="h-16 w-16 rounded-full overflow-hidden border border-amber-400/20 bg-black/20">
                    <img
                      v-if="avatarFor(winnerByRank(1)?.user_id)"
                      :src="avatarFor(winnerByRank(1)?.user_id)"
                      alt="avatar"
                      class="h-full w-full object-cover"
                      @error="onAvatarError(winnerByRank(1)?.user_id)"
                    />
                    <div v-else class="h-full w-full grid place-items-center text-sm font-semibold text-amber-100/80">
                      {{ initials(winnerByRank(1)?.player_name) }}
                    </div>
                  </div>
                </div>

                <div class="mt-2 text-2xl font-semibold">{{ safeName(winnerByRank(1)?.player_name) }}</div>

                <!-- ✅ Phone masked -->
                <div class="mt-1 text-xs text-amber-100/80">
                  Phone: <b class="font-semibold">{{ maskPhone(phoneFor(winnerByRank(1)?.user_id)) }}</b>
                </div>

                <div class="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-1 text-sm">
                  <UIcon name="i-heroicons-bolt" class="w-4 h-4 opacity-90" />
                  <span class="font-semibold">{{ winnerByRank(1)?.score ?? '—' }}</span>
                </div>
                <div v-if="winnerByRank(1)?.prize" class="mt-3 text-sm text-amber-100/90">
                  <b>Prize:</b> {{ winnerByRank(1)?.prize }}
                </div>
                <!--  <div class="mt-5 h-16 rounded-xl bg-amber-500/10 border border-amber-400/20"></div> -->
              </div>
            </div>

            <!-- 3rd -->
            <div class="order-3">
              <div class="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <div class="text-3xl">🥉</div>
                <div class="mt-2 text-xs uppercase tracking-wider opacity-70">{{ podiumLabel(3) }}</div>

                <!-- ✅ Avatar -->
                <div class="mt-4 flex justify-center">
                  <div class="h-14 w-14 rounded-full overflow-hidden border border-white/10 bg-black/20">
                    <img
                      v-if="avatarFor(winnerByRank(3)?.user_id)"
                      :src="avatarFor(winnerByRank(3)?.user_id)"
                      alt="avatar"
                      class="h-full w-full object-cover"
                      @error="onAvatarError(winnerByRank(3)?.user_id)"
                    />
                    <div v-else class="h-full w-full grid place-items-center text-sm font-semibold opacity-80">
                      {{ initials(winnerByRank(3)?.player_name) }}
                    </div>
                  </div>
                </div>

                <div class="mt-2 text-lg font-semibold">{{ safeName(winnerByRank(3)?.player_name) }}</div>

                <!-- ✅ Phone masked -->
                <div class="mt-1 text-xs opacity-70">
                  Phone: <b class="font-semibold">{{ maskPhone(phoneFor(winnerByRank(3)?.user_id)) }}</b>
                </div>

                <div class="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm">
                  <UIcon name="i-heroicons-bolt" class="w-4 h-4 opacity-80" />
                  <span class="font-semibold">{{ winnerByRank(3)?.score ?? '—' }}</span>
                </div>
                <div v-if="winnerByRank(3)?.prize" class="mt-3 text-sm opacity-85">
                  <b>Prize:</b> {{ winnerByRank(3)?.prize }}
                </div>
                <!-- <div class="mt-4 h-10 rounded-xl bg-white/5 border border-white/10"></div> -->
              </div>
            </div>
          </div>

          <div class="mt-6 grid gap-3 md:grid-cols-3">
            <div
              v-for="r in winners"
              :key="`${r.rank}-${r.player_name}-${r.score}`"
              class="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <!-- ✅ Avatar (list) -->
                  <div class="h-10 w-10 rounded-full overflow-hidden border border-white/10 bg-black/20">
                    <img
                      v-if="avatarFor(r.user_id)"
                      :src="avatarFor(r.user_id)"
                      alt="avatar"
                      class="h-full w-full object-cover"
                      @error="onAvatarError(r.user_id)"
                    />
                    <div v-else class="h-full w-full grid place-items-center text-xs font-semibold opacity-80">
                      {{ initials(r.player_name) }}
                    </div>
                  </div>

                  <div>
                    <div class="text-xs opacity-70">Rank #{{ r.rank }} • {{ medal(r.rank) }}</div>
                    <div class="font-semibold">{{ safeName(r.player_name) }}</div>

                    <!-- ✅ Phone masked -->
                    <div class="mt-0.5 text-[11px] opacity-70">
                      Phone: <b class="font-semibold">{{ maskPhone(phoneFor(r.user_id)) }}</b>
                    </div>

                    <div v-if="r.prize" class="mt-1 text-xs opacity-80">Prize: <b>{{ r.prize }}</b></div>
                  </div>
                </div>

                <div class="text-right">
                  <div class="text-xs opacity-70">Score</div>
                  <div class="text-lg font-semibold">{{ r.score }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-8 grid gap-4 lg:grid-cols-3">
        <!-- Details -->
        <div class="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-xl border border-white/10 bg-white/5 p-4">
              <div class="text-xs opacity-70">Starts</div>
              <div class="mt-1 text-sm font-medium">{{ fmt(getStartsAt(t)) }}</div>
              <div v-if="effectiveStatus === 'scheduled'" class="mt-2 text-sm opacity-80">
                Starts in: <span class="font-mono">{{ msToClock(startsInMs) }}</span>
              </div>
            </div>

            <div class="rounded-xl border border-white/10 bg-white/5 p-4">
              <div class="text-xs opacity-70">Ends</div>
              <div class="mt-1 text-sm font-medium">{{ fmt(getEndsAt(t)) }}</div>
              <div v-if="effectiveStatus === 'live'" class="mt-2 text-sm opacity-80">
                Ends in: <span class="font-mono">{{ msToClock(endsInMs) }}</span>
              </div>
            </div>
          </div>

          <!-- Gate hint -->
          <div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
            <div v-if="effectiveStatus !== 'live'" class="opacity-80">
              Tournament is not live. You can still view details and leaderboard.
            </div>

            <div v-else-if="!user" class="opacity-80">
              Please log in to play tournaments.
              <div class="mt-3">
                <UButton to="/login" class="!rounded-full">Login</UButton>
              </div>
            </div>

            <div v-else-if="sub && !sub.active" class="opacity-80">
              Subscription required to play. Activate a plan to participate.
              <div class="mt-3">
                <UButton to="/subscribe" class="!rounded-full">Subscribe</UButton>
              </div>
            </div>

            <div v-else class="opacity-80">
              You’re eligible to play. Click <b>Play Now</b> to start.
            </div>
          </div>
        </div>

        <!-- Leaderboard -->
        <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-lg font-semibold">Leaderboard</div>
              <p class="mt-1 text-sm opacity-70">Tournament-only scores.</p>
            </div>

            <UButton size="xs" variant="soft" class="!rounded-full" :loading="lbPending" @click="loadLeaderboard">
              Refresh
            </UButton>
          </div>

          <div v-if="lbError" class="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
            {{ lbError }}
          </div>

          <div v-if="!lbPending && !lb.length" class="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm opacity-80">
            No scores yet.
          </div>

          <div v-else class="mt-4 space-y-2">
            <div
              v-for="(r, i) in lb"
              :key="`${r.player_name}-${r.created_at}-${i}`"
              class="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <div class="flex items-center gap-2">
                <div class="w-6 text-xs opacity-70">{{ i + 1 }}</div>
                <div class="text-sm font-medium">{{ safeName(r.player_name) }}</div>
              </div>
              <div class="text-sm font-semibold">{{ r.score }}</div>
            </div>

            <div v-if="lbPending" class="rounded-xl border border-white/10 bg-white/5 p-4 text-sm opacity-70">
              Loading…
            </div>
          </div>
        </div>
      </div>
    </div>
  </UContainer>
</template>
