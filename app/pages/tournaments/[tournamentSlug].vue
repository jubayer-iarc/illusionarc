<!-- app/pages/tournaments/[tournamentSlug].vue -->
<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import { useTournamentLeaderboard } from '~/composables/useTournamentLeaderboard'
import { useSubscription } from '~/composables/useSubscription'

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

type PrizeRelation = {
  id: string
  rank: number
  title: string
  description?: string | null
  image_url?: string | null
  image_path?: string | null
}

type WinnerRow = {
  rank: number
  player_name: string
  score: number
  user_id?: string | null
  prize_id?: string | null
  prize?: string | null
  prize_label?: string | null
  prize_bdt?: number | null
  tournament_prize?: PrizeRelation | null
}

type AssignedPrizeRow = {
  id: string
  rank: number
  prize_id: string
  prize: {
    id: string
    title: string
    description?: string | null
    image_url?: string | null
    image_path?: string | null
  } | null
}

type LbRow = {
  player_name: string
  score: number
  created_at: string
}

const t = ref<AnyTournament | null>(null)

/* ---------------- Load tournament ---------------- */
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
const pageDesc = computed(() =>
  String(t.value?.description || 'Play tournaments, climb the leaderboard, and win prizes.').trim()
)

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
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

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
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(dt))
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
  const b = parts.length > 1 ? parts[1]?.[0] || '' : parts[0]?.[1] || ''
  return (a + b).toUpperCase()
}
function maskPhone(phone: any) {
  const p = String(phone || '')
    .trim()
    .replace(/\s+/g, '')
  if (!p) return '—'
  const keep = Math.min(6, p.length)
  return p.slice(0, keep) + 'X'.repeat(Math.max(0, p.length - keep))
}
function ordinal(n: number) {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}
function cleanText(v: any) {
  const s = String(v ?? '').trim()
  return s || ''
}
function medal(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅'
}
function rankChipClass(rank: number) {
  if (rank === 1) return 'bg-amber-400/20 text-amber-100 border-amber-300/30'
  if (rank === 2) return 'bg-slate-300/20 text-slate-100 border-slate-300/25'
  if (rank === 3) return 'bg-orange-400/20 text-orange-100 border-orange-300/25'
  return 'bg-white/10 text-white/90 border-white/10'
}
function statusLine() {
  if (!t.value) return ''
  if (isLive.value) return `Ends in ${msToClock(endsInMs.value)}`
  if (isScheduled.value) return `Starts in ${msToClock(startsInMs.value)}`
  if (isCanceled.value) return 'This tournament was canceled.'
  return 'Tournament ended.'
}

/* ---------------- Status ---------------- */
const effectiveStatus = computed<'scheduled' | 'live' | 'ended' | 'canceled'>(() => {
  if (!t.value) return 'scheduled'

  const explicit = String(t.value?.effective_status || t.value?.status || 'scheduled').toLowerCase()
  if (explicit === 'canceled') return 'canceled'

  const s = new Date(getStartsAt(t.value)).getTime()
  const e = new Date(getEndsAt(t.value)).getTime()

  if (Number.isFinite(e) && now.value >= e) return 'ended'
  if (Number.isFinite(s) && now.value >= s && (!Number.isFinite(e) || now.value < e)) return 'live'
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

const showArcadeBtn = computed(() => Boolean(t.value) && !isLive.value)
const canPlay = computed(() => Boolean(t.value) && isLive.value && user.value && sub.value?.active === true)

const statusBadge = computed(() => {
  const s = effectiveStatus.value
  if (s === 'live') {
    return {
      text: 'LIVE',
      cls: 'border-emerald-400/35 bg-emerald-500/14 text-emerald-300',
      dot: 'bg-emerald-400'
    }
  }
  if (s === 'scheduled') {
    return {
      text: 'SCHEDULED',
      cls: 'border-violet-400/35 bg-violet-500/14 text-violet-200',
      dot: 'bg-violet-400'
    }
  }
  if (s === 'canceled') {
    return {
      text: 'CANCELED',
      cls: 'border-rose-400/35 bg-rose-500/14 text-rose-200',
      dot: 'bg-rose-400'
    }
  }
  return {
    text: 'ENDED',
    cls: 'border-white/15 bg-white/8 text-white/75',
    dot: 'bg-white/45'
  }
})

/* ---------------- How to play ---------------- */
const howToPlayTitle = computed(() => {
  const g: any = game.value
  return g?.name ? `How to Play — ${g.name}` : 'How to Play'
})
const howToPlaySteps = computed<string[]>(() => {
  const g: any = game.value
  const steps = Array.isArray(g?.controls)
    ? g.controls.map((x: any) => String(x).trim()).filter(Boolean)
    : []
  return steps.length ? steps : ['Controls info coming soon.']
})
const howToPlaySummary = computed(() => {
  const g: any = game.value
  const d = String(g?.description || '').trim()
  if (!d) return ''
  return d.length > 220 ? d.slice(0, 220).trim() + '…' : d
})
const tournamentRules = computed(() => {
  const rules: string[] = []
  rules.push('Play only during the LIVE window.')
  rules.push('Subscription required to submit scores.')
  rules.push('Highest valid score ranks on the leaderboard.')
  return rules
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

/* ---------------- Promo video ---------------- */
const promoVideoType = computed(() => String(t.value?.promo_video_type || '').trim())
const promoVideoUrl = computed(() => String(t.value?.promo_video_url || '').trim())
const promoYoutubeId = computed(() => String(t.value?.promo_video_youtube_id || '').trim())
const promoVideoTitle = computed(() => String(t.value?.promo_video_title || '').trim())
const promoYoutubeEmbedUrl = computed(() => {
  return promoYoutubeId.value ? `https://www.youtube.com/embed/${promoYoutubeId.value}` : ''
})
const hasPromoVideo = computed(() => {
  if (promoVideoType.value === 'upload' && promoVideoUrl.value) return true
  if (promoVideoType.value === 'youtube' && promoYoutubeEmbedUrl.value) return true
  return false
})

/* ---------------- Assigned prizes ---------------- */
const assignedPrizes = ref<PrizeRelation[]>([])
const prizesPending = ref(false)
const prizesError = ref<string | null>(null)

async function loadAssignedPrizes() {
  prizesPending.value = true
  prizesError.value = null

  try {
    if (!t.value?.id) {
      assignedPrizes.value = []
      return
    }

    const { data, error } = await supabase
      .from('tournament_prize_map')
      .select(`
        id,
        rank,
        prize_id,
        prize:tournament_prizes!tournament_prize_map_prize_id_fkey (
          id,
          title,
          description,
          image_url,
          image_path
        )
      `)
      .eq('tournament_id', t.value.id)
      .order('rank', { ascending: true })

    if (error) throw error

    assignedPrizes.value = ((data || []) as AssignedPrizeRow[])
      .map((row) => {
        const p = row.prize
        if (!p) return null
        return {
          id: String(p.id || '').trim(),
          rank: Number(row.rank || 0),
          title: String(p.title || '').trim(),
          description: p.description || null,
          image_url: p.image_url || null,
          image_path: p.image_path || null
        } as PrizeRelation
      })
      .filter(Boolean) as PrizeRelation[]
  } catch (e: any) {
    prizesError.value = e?.message || 'Failed to load prizes'
    assignedPrizes.value = []
  } finally {
    prizesPending.value = false
  }
}

await loadAssignedPrizes()

/* ---------------- Winners ---------------- */
const winners = ref<WinnerRow[]>([])
const winnersPending = ref(false)
const winnersError = ref<string | null>(null)
const hasWinners = computed(() => winners.value.length > 0)

function winnerByRank(rank: number) {
  return winners.value.find((w) => Number(w.rank) === rank) || null
}
function winnerPrizeText(w?: WinnerRow | null) {
  return String(w?.prize || w?.prize_label || w?.tournament_prize?.title || '').trim()
}

const visiblePrizes = computed(() => {
  if (assignedPrizes.value.length) return assignedPrizes.value

  const seen = new Set<number>()
  const fromWinners: PrizeRelation[] = []

  for (const w of winners.value || []) {
    const p = w?.tournament_prize
    if (!p) continue
    const rank = Number(p.rank || w.rank || 0)
    if (!rank || seen.has(rank)) continue
    seen.add(rank)
    fromWinners.push({
      id: p.id,
      rank,
      title: p.title,
      description: p.description || null,
      image_url: p.image_url || null,
      image_path: p.image_path || null
    })
  }

  if (fromWinners.length) return fromWinners.sort((a, b) => a.rank - b.rank)

  const legacy: PrizeRelation[] = []
  const p1 = cleanText(t.value?.prize_1 || t.value?.prize)
  const p2 = cleanText(t.value?.prize_2)
  const p3 = cleanText(t.value?.prize_3)

  if (p1) legacy.push({ id: 'legacy-1', rank: 1, title: p1 })
  if (p2) legacy.push({ id: 'legacy-2', rank: 2, title: p2 })
  if (p3) legacy.push({ id: 'legacy-3', rank: 3, title: p3 })

  return legacy
})

async function loadWinners() {
  winnersError.value = null
  winnersPending.value = true
  try {
    const res = await $fetch<{ winners?: WinnerRow[] }>('/api/tournaments/winners', {
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

/* ---------------- Profiles ---------------- */
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
  const attempts: Array<{
    select: string
    idKey: 'user_id' | 'id'
    phoneKey: 'phone' | 'phone_number'
  }> = [
    { select: 'user_id, avatar_url, phone', idKey: 'user_id', phoneKey: 'phone' },
    { select: 'user_id, avatar_url, phone_number', idKey: 'user_id', phoneKey: 'phone_number' },
    { select: 'id, avatar_url, phone', idKey: 'id', phoneKey: 'phone' },
    { select: 'id, avatar_url, phone_number', idKey: 'id', phoneKey: 'phone_number' }
  ]

  for (const a of attempts) {
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select(a.select)
        .in(a.idKey, ids)

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

/* ---------------- Leaderboard ---------------- */
const lb = ref<LbRow[]>([])
const lbPending = ref(false)
const lbError = ref<string | null>(null)
const lbUpdatedAt = ref<number>(Date.now())

async function loadLeaderboard() {
  lbError.value = null
  lbPending.value = true
  try {
    const res = await getLeaderboard(slug.value, 50)
    lb.value = (res?.rows || []) as LbRow[]
    lbUpdatedAt.value = Date.now()
  } catch (e: any) {
    lbError.value = e?.data?.message || e?.message || 'Failed to load leaderboard'
    lb.value = []
  } finally {
    lbPending.value = false
  }
}
await loadLeaderboard()

const leaderboardPreview = computed(() => lb.value.slice(0, 8))

function lastUpdatedText() {
  const diff = Math.max(0, Date.now() - lbUpdatedAt.value)
  const mins = Math.floor(diff / 60000)
  if (mins <= 0) return 'just now'
  if (mins === 1) return '1m ago'
  return `${mins}m ago`
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
    await loadAssignedPrizes()
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

/* ---------------- Actions ---------------- */
function playHard(tournamentSlug: string) {
  if (!import.meta.client) return
  const url = `/tournaments/embed/${encodeURIComponent(tournamentSlug)}?boot=${Date.now()}`
  window.location.assign(url)
}

async function shareLink() {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(window.location.href)
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
</script>

<template>
  <UContainer class="page-wrap py-8 sm:py-10">
    <div
      v-if="!t"
      class="glass-card rounded-[26px] p-6 text-white"
    >
      <div class="text-lg font-semibold">Tournament not found</div>
      <NuxtLink to="/tournaments" class="mt-3 inline-block text-sm text-white/70 hover:text-white">
        ← Back to tournaments
      </NuxtLink>
    </div>

    <div v-else class="space-y-8 text-white">
      <!-- top actions -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <NuxtLink to="/tournaments" class="text-sm text-white/70 hover:text-white">
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

      <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <!-- LEFT MAIN -->
        <div class="space-y-6">
          <!-- title / meta -->
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold"
                :class="statusBadge.cls"
              >
                <span class="inline-flex h-1.5 w-1.5 rounded-full" :class="statusBadge.dot" />
                {{ statusBadge.text }}
              </span>

              <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/85">
                {{ game?.name || getGameSlug(t) }}
              </span>

              <span
                v-if="sub?.active"
                class="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200"
              >
                Pass Active
              </span>
            </div>

            <h1 class="text-4xl font-extrabold leading-none tracking-tight text-white sm:text-5xl">
              {{ t.title }}
            </h1>

            <div class="text-base text-white/70">
              {{ fmt(getStartsAt(t)) }} – {{ fmt(getEndsAt(t)) }}
            </div>
          </div>

          <!-- VIDEO HERO -->
          <div class="glass-card rounded-[28px] overflow-hidden">
            <div class="aspect-[16/9] bg-black">
              <video
                v-if="promoVideoType === 'upload' && promoVideoUrl"
                :src="promoVideoUrl"
                controls
                playsinline
                preload="metadata"
                class="h-full w-full object-cover"
              />
              <iframe
                v-else-if="promoVideoType === 'youtube' && promoYoutubeEmbedUrl"
                :src="promoYoutubeEmbedUrl"
                :title="promoVideoTitle || 'Tournament promo video'"
                class="h-full w-full"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
              />
              <div v-else class="relative h-full w-full">
                <img :src="thumb" :alt="t.title" class="h-full w-full object-cover opacity-90" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div class="absolute inset-0 grid place-items-center">
                  <div class="rounded-full border border-white/15 bg-black/35 px-5 py-3 text-white/80 backdrop-blur">
                    Promo video coming soon
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PRIZES -->
          <div class="space-y-4">
            <div class="flex items-end justify-between gap-3">
              <div>
                <h2 class="text-3xl font-bold tracking-tight text-white">Prizes</h2>
                <div class="mt-1 text-sm text-white/60">
                  {{ visiblePrizes.length ? `Top ${visiblePrizes.length} players win prizes` : 'Prize details coming soon' }}
                </div>
              </div>
            </div>

            <div
              v-if="prizesError && !visiblePrizes.length"
              class="glass-card rounded-[22px] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100"
            >
              {{ prizesError }}
            </div>

            <div
              v-else-if="prizesPending && !visiblePrizes.length"
              class="glass-card rounded-[22px] p-4 text-sm text-white/70"
            >
              Loading prizes…
            </div>

            <div
              v-else-if="!visiblePrizes.length"
              class="glass-card rounded-[22px] p-4 text-sm text-white/70"
            >
              Prize details are coming soon.
            </div>

            <div
              v-else
              class="prize-scroll glass-card rounded-[24px] p-3 sm:p-4"
            >
              <div class="space-y-3">
                <div
                  v-for="p in visiblePrizes"
                  :key="`${p.rank}-${p.id || p.title}`"
                  class="prize-item rounded-[22px] border border-white/10 bg-white/5 p-3 sm:p-4"
                >
                  <div class="flex items-center gap-4">
                    <div class="relative h-24 w-24 shrink-0 overflow-hidden rounded-[18px] border border-white/10 bg-white/5">
                      <img
                        v-if="p.image_url"
                        :src="p.image_url"
                        :alt="p.title"
                        class="h-full w-full object-cover"
                      />
                      <div v-else class="grid h-full w-full place-items-center text-3xl">
                        {{ medal(p.rank) }}
                      </div>
                    </div>

                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                          :class="rankChipClass(p.rank)"
                        >
                          {{ ordinal(p.rank) }}
                        </span>
                      </div>

                      <div class="mt-2 text-lg font-semibold text-white">
                        {{ p.title }}
                      </div>

                      <div v-if="p.description" class="mt-1 text-sm leading-6 text-white/65">
                        {{ p.description }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- HOW TO PLAY -->
          <div class="space-y-4">
            <h2 class="text-3xl font-bold tracking-tight text-white">How to Play</h2>

            <div class="glass-card rounded-[26px] p-5 sm:p-6">
              <div class="grid gap-5 lg:grid-cols-[8px_minmax(0,1fr)]">
                <div class="rounded-full bg-gradient-to-b from-emerald-400 via-emerald-500 to-transparent"></div>

                <div>
                  <div v-if="howToPlaySummary" class="mb-5 text-sm leading-7 text-white/70">
                    {{ howToPlaySummary }}
                  </div>

                  <ul class="space-y-5">
                    <li v-for="(c, i) in howToPlaySteps" :key="`ctl-${i}`" class="flex gap-3">
                      <span class="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-white/80"></span>
                      <span class="text-base leading-8 text-white/88">{{ c }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- WINNERS -->
          <section
            v-if="isEnded"
            class="space-y-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-3xl font-bold tracking-tight text-white">Final Results</h2>
                <div class="mt-1 text-sm text-white/60">Winners are locked after the tournament ends.</div>
              </div>

              <UButton size="xs" variant="soft" class="!rounded-full" :loading="winnersPending" @click="loadWinners">
                Refresh
              </UButton>
            </div>

            <div
              v-if="winnersError"
              class="glass-card rounded-[22px] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100"
            >
              {{ winnersError }}
            </div>

            <div
              v-else-if="!winnersPending && !hasWinners"
              class="glass-card rounded-[22px] p-4 text-sm text-white/70"
            >
              No winners snapshot yet. Refresh once.
            </div>

            <div v-else class="grid gap-4 md:grid-cols-3">
              <div
                v-for="rank in [1, 2, 3]"
                :key="`podium-${rank}`"
                class="glass-card rounded-[24px] p-5 text-center"
              >
                <div class="text-4xl">{{ medal(rank) }}</div>
                <div class="mt-2 text-xs uppercase tracking-[0.2em] text-white/50">
                  {{ rank === 1 ? 'Champion' : rank === 2 ? 'Runner-up' : '3rd Place' }}
                </div>

                <div class="mt-4 flex justify-center">
                  <div class="h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-white/5">
                    <img
                      v-if="avatarFor(winnerByRank(rank)?.user_id)"
                      :src="avatarFor(winnerByRank(rank)?.user_id)"
                      alt="avatar"
                      class="h-full w-full object-cover"
                      @error="onAvatarError(winnerByRank(rank)?.user_id)"
                    />
                    <div v-else class="grid h-full w-full place-items-center text-sm font-semibold text-white/85">
                      {{ initials(winnerByRank(rank)?.player_name) }}
                    </div>
                  </div>
                </div>

                <div class="mt-3 text-xl font-semibold text-white">
                  {{ safeName(winnerByRank(rank)?.player_name) }}
                </div>

                <div class="mt-1 text-xs text-white/55">
                  Phone:
                  <b class="font-semibold text-white/85">{{ maskPhone(phoneFor(winnerByRank(rank)?.user_id)) }}</b>
                </div>

                <div class="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90">
                  <UIcon name="i-heroicons-bolt" class="h-4 w-4 opacity-90" />
                  <span class="font-semibold">{{ winnerByRank(rank)?.score ?? '—' }}</span>
                </div>

                <div v-if="winnerPrizeText(winnerByRank(rank))" class="mt-3 text-sm text-white/70">
                  <b class="text-white/90">Prize:</b> {{ winnerPrizeText(winnerByRank(rank)) }}
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- RIGHT SIDEBAR -->
        <aside class="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <!-- LIVE / CTA CARD -->
          <div class="live-card rounded-[30px] p-[1px]">
            <div class="live-card-inner rounded-[29px] p-5 sm:p-6">
              <div class="flex justify-center">
                <span
                  class="inline-flex items-center gap-3 rounded-[18px] border px-5 py-3 text-2xl font-extrabold tracking-tight"
                  :class="statusBadge.cls"
                >
                  <span class="inline-flex h-3.5 w-3.5 rounded-full" :class="statusBadge.dot" />
                  {{ statusBadge.text }}
                </span>
              </div>

              <div class="mt-8 text-center">
                <div class="text-2xl text-white/90">
                  {{ isLive ? 'Ends in' : isScheduled ? 'Starts in' : isEnded ? 'Ended' : 'Canceled' }}
                </div>
                <div class="mt-2 text-5xl font-extrabold tracking-tight text-emerald-300">
                  {{ isLive ? msToClock(endsInMs) : isScheduled ? msToClock(startsInMs) : '00:00:00' }}
                </div>
              </div>

              <div class="mt-8 text-base text-white/80">
                <div class="flex items-start gap-2">
                  <span class="mt-1.5 inline-block h-2 w-2 rounded-full bg-blue-300"></span>
                  <span>
                    Eligibility:
                    <b class="font-semibold text-white">{{ sub?.active ? 'Subscription Active' : 'Subscription Required' }}</b>
                  </span>
                </div>
              </div>

              <div class="mt-8 space-y-3">
                <UButton
                  v-if="canPlay"
                  block
                  size="lg"
                  class="cta-glow !rounded-[18px]"
                  @click="playHard(t.slug)"
                >
                  Play Now
                </UButton>

                <UButton
                  v-else-if="isLive && user && sub && !sub.active"
                  block
                  size="lg"
                  class="cta-glow !rounded-[18px]"
                  to="/subscribe"
                >
                  Subscribe to Play
                </UButton>

                <UButton
                  v-else
                  block
                  size="lg"
                  class="cta-glow !rounded-[18px]"
                  variant="soft"
                  :to="`/tournaments/embed/${t.slug}`"
                >
                  Open Tournament
                </UButton>

                <UButton
                  block
                  size="lg"
                  variant="soft"
                  class="!rounded-[18px]"
                  @click="shareLink"
                >
                  Copy Link
                </UButton>
              </div>

              <div class="mt-4 text-center text-sm text-white/60">
                {{ visiblePrizes.length ? `Top ${visiblePrizes.length} players win prizes` : 'Prize details coming soon' }}
              </div>
            </div>
          </div>

          <!-- RULES -->
          <div class="glass-card rounded-[26px] p-5 sm:p-6">
            <h3 class="text-2xl font-bold tracking-tight text-white">Tournament Rules</h3>

            <ul class="mt-4 space-y-3">
              <li v-for="(r, i) in tournamentRules" :key="`rule-${i}`" class="flex gap-3">
                <span class="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-white/80"></span>
                <span class="text-base leading-7 text-white/85">{{ r }}</span>
              </li>
            </ul>
          </div>

          <!-- LEADERBOARD -->
          <div class="glass-card rounded-[26px] p-5 sm:p-6">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-2xl font-bold tracking-tight text-white">Leaderboard</h3>
            </div>

            <div v-if="lbError" class="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-100">
              {{ lbError }}
            </div>

            <div
              v-else-if="!lbPending && !leaderboardPreview.length"
              class="mt-4 text-sm text-white/65"
            >
              No scores yet.
            </div>

            <div v-else class="mt-4 space-y-2.5">
              <div
                v-for="(r, i) in leaderboardPreview"
                :key="`${r.player_name}-${r.created_at}-${i}`"
                class="leader-row flex items-center justify-between gap-3 rounded-[18px] px-4 py-3"
                :class="i === 2 ? 'leader-row-active' : ''"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <div class="w-6 text-center text-lg">{{ medal(i + 1) }}</div>
                  <div class="min-w-0">
                    <div class="text-sm text-white/70">{{ i + 1 }}</div>
                  </div>
                  <div class="truncate text-xl font-medium text-white">
                    {{ safeName(r.player_name) }}
                  </div>
                </div>

                <div class="text-xl font-semibold text-white">
                  {{ r.score }}
                </div>
              </div>
            </div>

            <div class="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div class="text-sm text-white/55">
                Last updated: {{ lastUpdatedText() }}
              </div>

              <UButton size="sm" variant="soft" class="!rounded-full" :loading="lbPending" @click="loadLeaderboard">
                Refresh
              </UButton>
            </div>
          </div>

          <!-- OPTIONAL ARCADE / SUBSCRIBE -->
          <div class="glass-card rounded-[26px] p-5">
            <div class="text-sm text-white/60">Quick actions</div>
            <div class="mt-3 flex flex-wrap gap-2">
              <UButton v-if="showArcadeBtn" :to="`/arcade/${getGameSlug(t)}`" variant="soft" class="!rounded-full">
                Arcade
              </UButton>
              <UButton v-if="!sub?.active" to="/subscribe" variant="soft" class="!rounded-full">
                Plans
              </UButton>
            </div>
          </div>
        </aside>
      </section>
    </div>
  </UContainer>
</template>

<style scoped>
.page-wrap {
  --page-bg-1: rgba(17, 34, 84, 0.6);
  --page-bg-2: rgba(1, 10, 31, 0.96);
}

.page-wrap :deep(.container),
.page-wrap {
  position: relative;
}

.page-wrap::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(circle at 20% 10%, rgba(50, 140, 255, 0.18), transparent 28%),
    radial-gradient(circle at 80% 15%, rgba(0, 255, 140, 0.12), transparent 24%),
    linear-gradient(180deg, #07112c 0%, #030918 52%, #020715 100%);
}

.page-wrap::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.16;
  background-image:
    linear-gradient(rgba(65, 255, 160, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(65, 255, 160, 0.08) 1px, transparent 1px);
  background-size: 38px 38px;
  mask-image: radial-gradient(circle at center, black 35%, transparent 100%);
}

.glass-card {
  border: 1px solid rgba(255, 255, 255, 0.09);
  background:
    linear-gradient(180deg, rgba(16, 28, 63, 0.92), rgba(8, 17, 40, 0.92));
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(14px);
}

.live-card {
  background: linear-gradient(180deg, rgba(92, 255, 130, 0.95), rgba(70, 212, 109, 0.7));
  box-shadow:
    0 0 0 1px rgba(120, 255, 155, 0.18),
    0 0 34px rgba(84, 255, 146, 0.28),
    0 0 70px rgba(64, 255, 136, 0.16);
}

.live-card-inner {
  background:
    radial-gradient(circle at top center, rgba(92, 255, 130, 0.1), transparent 40%),
    linear-gradient(180deg, rgba(10, 22, 54, 0.98), rgba(5, 12, 28, 0.98));
}

.cta-glow {
  box-shadow:
    0 0 0 1px rgba(110, 255, 150, 0.12),
    0 8px 30px rgba(84, 255, 146, 0.2);
}

.prize-scroll {
  max-height: 540px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(85, 255, 155, 0.45) rgba(255, 255, 255, 0.06);
}

.prize-scroll::-webkit-scrollbar {
  width: 8px;
}
.prize-scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
}
.prize-scroll::-webkit-scrollbar-thumb {
  background: rgba(85, 255, 155, 0.45);
  border-radius: 999px;
}

.prize-item {
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}
.prize-item:hover {
  transform: translateY(-2px);
  border-color: rgba(96, 255, 150, 0.22);
  background: rgba(255, 255, 255, 0.07);
}

.leader-row {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}
.leader-row-active {
  border-color: rgba(95, 255, 145, 0.45);
  background:
    linear-gradient(180deg, rgba(67, 255, 146, 0.13), rgba(67, 255, 146, 0.06));
  box-shadow:
    inset 0 0 0 1px rgba(95, 255, 145, 0.1),
    0 0 18px rgba(67, 255, 146, 0.08);
}
</style>