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
  display_name?: string | null
  avatar_url?: string | null
  masked_phone?: string | null
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
  user_id?: string | null
  player_name: string
  score: number
  created_at: string
  display_name?: string | null
  avatar_url?: string | null
  masked_phone?: string | null
}

type ProfileLite = {
  user_id: string
  display_name?: string | null
  avatar_url?: string | null
  phone?: string | null
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
const pageTitle = computed(() => (t.value ? `টুর্নামেন্ট — ${t.value.title}` : 'টুর্নামেন্ট'))
const pageDesc = computed(() =>
  String(
    t.value?.description ||
      'Illusion Arc-এর টুর্নামেন্ট খেলুন, লিডারবোর্ডে উঠুন এবং আকর্ষণীয় পুরস্কার জিতুন。'
  ).trim()
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
let timer: ReturnType<typeof setInterval> | null = null

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
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('bn-BD', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(d)
}
function toBnDigits(input: string | number) {
  return String(input).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])
}
function msToTournamentClock(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '০০ দিন: ০০ ঘন্টা: ০০ মিনিট'
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return `${toBnDigits(String(days).padStart(2, '0'))} দিন: ${toBnDigits(String(hours).padStart(2, '0'))} ঘন্টা: ${toBnDigits(String(minutes).padStart(2, '0'))} মিনিট`
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
  const p = String(phone || '').trim().replace(/\s+/g, '')
  if (!p) return '—'
  if (p.startsWith('+880') && p.length >= 14) return `0${p.slice(4, 7)}XXXXXXXX`
  if (p.startsWith('880') && p.length >= 13) return `0${p.slice(3, 6)}XXXXXXXX`
  if (p.startsWith('01') && p.length >= 11) return `${p.slice(0, 3)}XXXXXXXX`
  const keep = Math.min(3, p.length)
  return p.slice(0, keep) + 'X'.repeat(Math.max(0, p.length - keep))
}
function ordinalBn(n: number) {
  const map: Record<number, string> = {
    1: '১ম',
    2: '২য়',
    3: '৩য়'
  }
  return map[n] || `${toBnDigits(n)}তম`
}
function cleanText(v: any) {
  const s = String(v ?? '').trim()
  return s || ''
}
function medal(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅'
}
function rankChipClass(rank: number) {
  if (rank === 1) return 'border-amber-300/40 bg-amber-400/20 text-amber-700 dark:text-amber-100'
  if (rank === 2) return 'border-slate-300/40 bg-slate-300/20 text-slate-700 dark:text-slate-100'
  if (rank === 3) return 'border-orange-300/40 bg-orange-400/20 text-orange-700 dark:text-orange-100'
  return 'border-black/10 bg-black/5 text-black/80 dark:border-white/10 dark:bg-white/10 dark:text-white/90'
}
function normalizeUid(v: any) {
  return String(v || '').trim()
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

const canPlay = computed(() => Boolean(t.value) && isLive.value && user.value && sub.value?.active === true)

const statusBadge = computed(() => {
  const s = effectiveStatus.value
  if (s === 'live') {
    return {
      text: 'লাইভ',
      cls: 'border-emerald-400/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500 dark:bg-emerald-400'
    }
  }
  if (s === 'scheduled') {
    return {
      text: 'শিডিউলড',
      cls: 'border-violet-400/30 bg-violet-500/12 text-violet-700 dark:text-violet-200',
      dot: 'bg-violet-500 dark:bg-violet-400'
    }
  }
  if (s === 'canceled') {
    return {
      text: 'বাতিল',
      cls: 'border-rose-400/30 bg-rose-500/12 text-rose-700 dark:text-rose-200',
      dot: 'bg-rose-500 dark:bg-rose-400'
    }
  }
  return {
    text: 'সমাপ্ত',
    cls: 'border-red-400/30 bg-red-500/12 text-red-700 dark:text-red-200',
    dot: 'bg-red-500 dark:bg-red-400'
  }
})

/* ---------------- Bangla content ---------------- */
const introPitch = computed(() => {
  return 'এই ঈদে শুধু Facebook Scroll না করে নিজের গেমিং স্কিল দিয়ে আকর্ষণীয় গিফট জিতে নেওয়ার সুযোগ। Illusion Arc নিয়ে এসেছে Eid Salami Rush Fest—যেখানে Salami Rush খেলে টপ স্কোরার হলেই মিলবে দারুণ সব পুরস্কার।'
})

const howToPlayTitle = computed(() => {
  const g: any = game.value
  return g?.name ? `${g.name} কীভাবে খেলবেন` : 'কীভাবে খেলবেন'
})

const howToPlaySummary = computed(() => {
  return 'Salami Rush হলো এমন একটি গেম যেখানে আপনি মিউজিকের তালে তালে একের পর এক শক্তিশালী বসের মুখোমুখি হবেন। নিয়ন আলোর এই যুদ্ধক্ষেত্রে যতক্ষণ সম্ভব টিকে থাকাই হবে আপনার আসল চ্যালেঞ্জ।'
})

const howToPlaySteps = computed<string[]>(() => {
  return [
    'মোবাইল/ট্যাব: স্ক্রিনের বাম বা ডান পাশে টাচ করে দ্রুত এপাশ-ওপাশ সরে যান।',
    'কিবোর্ড: বাম ও ডান Arrow Key ব্যবহার করে ডানে-বামে মুভ করুন।',
    'বসের ছোড়া বুলেট বা গুলি এড়িয়ে যতক্ষণ সম্ভব বেঁচে থাকার চেষ্টা করুন।',
    'Slow Mo, Shield এবং Magnet-এর মতো পাওয়ার-আপ সংগ্রহ করুন।',
    'যত বেশি সম্ভব কয়েন সংগ্রহ করে স্কোর বাড়ান।'
  ]
})

const termsList = computed(() => {
  return [
    'গেমটি যখন লাইভ থাকবে, শুধুমাত্র তখনই খেলতে পারবেন।',
    'অংশ নিতে ও স্কোর জমা দিতে অ্যাকাউন্টে লগ-ইন থাকতে হবে।',
    'স্কোর জমা দিতে সক্রিয় সাবস্ক্রিপশন বাধ্যতামূলক।',
    'লাইভ চলাকালীন যার স্কোর সবচেয়ে বেশি হবে, সে লিডারবোর্ডে ওপরে থাকবে।',
    'শীর্ষ ২০ জন স্কোরার পুরস্কার পাবে।',
    'লাইভ শুরুর আগে প্র্যাকটিস করা যাবে, কিন্তু লাইভ শুরু হলে টুর্নামেন্ট পেজ থেকে খেলতে হবে।',
    'গেমের সময়সূচী: ১৫ মার্চ ১২:০১ মিনিট থেকে ২ এপ্রিল রাত ১১:৫৯ মিনিট পর্যন্ত।'
  ]
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
  if (!promoYoutubeId.value) return ''
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    rel: '0'
  })
  return `https://www.youtube.com/embed/${promoYoutubeId.value}?${params.toString()}`
})

/* ---------------- Issue report ---------------- */
const supportWhatsAppNumber = '8801329662037'

const issueReportMessage = computed(() => {
  const tournamentTitle = String(t.value?.title || 'Tournament').trim()
  const tournamentSlug = String(t.value?.slug || slug.value || '').trim()
  const gameName = String((game.value as any)?.name || getGameSlug(t.value) || '').trim()

  return [
    'হ্যালো, আমি একটি টুর্নামেন্ট ইস্যু রিপোর্ট করতে চাই।',
    `টুর্নামেন্ট: ${tournamentTitle}`,
    `Slug: ${tournamentSlug}`,
    gameName ? `গেম: ${gameName}` : '',
    'সমস্যার বিস্তারিত: '
  ]
    .filter(Boolean)
    .join('\n')
})

const whatsappReportLink = computed(() => {
  const phone = supportWhatsAppNumber.replace(/\D/g, '')
  const text = encodeURIComponent(issueReportMessage.value)
  return `https://wa.me/${phone}?text=${text}`
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
    prizesError.value = e?.message || 'পুরস্কারের তথ্য লোড করা যায়নি'
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

/* ---------------- Profiles ---------------- */
const profileMap = ref<Record<string, { displayName: string; avatarUrl: string; phone: string }>>({})

function avatarFor(uid?: string | null, fallbackAvatar?: string | null) {
  const id = normalizeUid(uid)
  if (id && profileMap.value[id]?.avatarUrl) return profileMap.value[id].avatarUrl
  return String(fallbackAvatar || '').trim()
}
function phoneFor(uid?: string | null, fallbackMaskedPhone?: string | null) {
  const id = normalizeUid(uid)
  if (id && profileMap.value[id]?.phone) return profileMap.value[id].phone
  return String(fallbackMaskedPhone || '').trim()
}
function displayNameForUid(uid?: string | null, fallbackDisplayName?: string | null, fallbackPlayerName?: string | null) {
  const id = normalizeUid(uid)
  if (id && profileMap.value[id]?.displayName) return profileMap.value[id].displayName
  return safeName(fallbackDisplayName || fallbackPlayerName)
}
function onAvatarError(uid?: string | null) {
  const id = normalizeUid(uid)
  if (!id) return
  if (!profileMap.value[id]) return
  profileMap.value = {
    ...profileMap.value,
    [id]: {
      ...profileMap.value[id],
      avatarUrl: ''
    }
  }
}

async function fetchProfiles(ids: string[]) {
  const cleanIds = Array.from(new Set(ids.map((x) => normalizeUid(x)).filter(Boolean)))
  if (!cleanIds.length) return

  try {
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('user_id, display_name, avatar_url, phone')
      .in('user_id', cleanIds)

    if (error) throw error

    const nextMap = { ...profileMap.value }

    for (const row of (data || []) as ProfileLite[]) {
      const uid = normalizeUid(row?.user_id)
      if (!uid) continue

      nextMap[uid] = {
        displayName: String(row?.display_name || '').trim(),
        avatarUrl: String(row?.avatar_url || '').trim(),
        phone: maskPhone(row?.phone)
      }
    }

    profileMap.value = nextMap
  } catch {
    // ignore profile hydration errors so page still works
  }
}

/* ---------------- Winners + prizes ---------------- */
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

    const ids = Array.from(new Set(arr.map((w) => normalizeUid(w.user_id)).filter(Boolean))) as string[]
    if (ids.length) await fetchProfiles(ids)
  } catch (e: any) {
    winnersError.value = e?.data?.message || e?.message || 'বিজয়ীদের তথ্য লোড করা যায়নি'
    winners.value = []
  } finally {
    winnersPending.value = false
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
    const res = await getLeaderboard(slug.value, 15)
    lb.value = (res?.rows || []) as LbRow[]
    lbUpdatedAt.value = Date.now()

    const ids = Array.from(new Set(lb.value.map((r) => normalizeUid(r.user_id)).filter(Boolean))) as string[]
    if (ids.length) await fetchProfiles(ids)
  } catch (e: any) {
    lbError.value = e?.data?.message || e?.message || 'লিডারবোর্ড লোড করা যায়নি'
    lb.value = []
  } finally {
    lbPending.value = false
  }
}
await loadLeaderboard()

const leaderboardPreview = computed(() => lb.value.slice(0, 15))

function leaderboardName(r: LbRow) {
  return displayNameForUid(r.user_id, r.display_name, r.player_name)
}
function leaderboardAvatar(r: LbRow) {
  return avatarFor(r.user_id, r.avatar_url)
}
function leaderboardPhone(r: LbRow) {
  return phoneFor(r.user_id, r.masked_phone)
}
function winnerName(w?: WinnerRow | null) {
  if (!w) return 'Player'
  return displayNameForUid(w.user_id, w.display_name, w.player_name)
}
function winnerAvatar(w?: WinnerRow | null) {
  return avatarFor(w?.user_id, w?.avatar_url)
}
function winnerPhone(w?: WinnerRow | null) {
  return phoneFor(w?.user_id, w?.masked_phone)
}

function lastUpdatedText() {
  const diff = Math.max(0, Date.now() - lbUpdatedAt.value)
  const mins = Math.floor(diff / 60000)
  if (mins <= 0) return 'এইমাত্র'
  if (mins === 1) return '১ মিনিট আগে'
  return `${toBnDigits(mins)} মিনিট আগে`
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

const practiceLink = computed(() => {
  const gameSlug = getGameSlug(t.value)
  if (!gameSlug) return '/arcade'
  return `/arcade/${encodeURIComponent(gameSlug)}`
})

const fullLeaderboardLink = computed(() => {
  const gameSlug = getGameSlug(t.value)
  const tournamentSlug = String(t.value?.slug || slug.value || '').trim()
  return `/arcade/leaderboard?game=${encodeURIComponent(gameSlug)}&period=daily&tournament=${encodeURIComponent(tournamentSlug)}#tournament-leaderboard`
})
</script>

<template>
  <div class="tournament-page">
    <UContainer class="py-6 sm:py-8 lg:py-10">
      <div
        v-if="!t"
        class="rounded-[26px] border border-black/10 bg-white p-5 text-slate-900 shadow-[0_14px_44px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6 dark:border-white/10 dark:bg-white/5 dark:text-white dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]"
      >
        <div class="text-lg font-semibold">টুর্নামেন্ট পাওয়া যায়নি</div>
        <NuxtLink
          to="/tournaments"
          class="mt-3 inline-block text-sm text-black/65 hover:text-black dark:text-white/65 dark:hover:text-white"
        >
          ← টুর্নামেন্টে ফিরে যান
        </NuxtLink>
      </div>

      <div v-else class="space-y-6 text-slate-900 sm:space-y-8 dark:text-white">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <NuxtLink
            to="/tournaments"
            class="text-sm text-black/65 hover:text-black dark:text-white/65 dark:hover:text-white"
          >
            ← ফিরে যান
          </NuxtLink>

          <div class="flex items-center gap-2">
            <UButton v-if="user && sub && !sub.active" to="/subscribe" size="sm" class="!rounded-full">
              খেলতে সাবস্ক্রাইব করুন
            </UButton>
            <UButton v-else-if="user" to="/subscribe" size="sm" variant="soft" class="!rounded-full">
              সাবস্ক্রিপশন
            </UButton>
          </div>
        </div>

        <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6">
          <div class="min-w-0 space-y-5 sm:space-y-6">
            <div
              class="hero-card relative overflow-hidden rounded-[26px] border border-black/10 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.07)] sm:p-7 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_40px_rgba(0,0,0,0.25)]"
            >
              <div class="hero-glow hero-glow-a"></div>
              <div class="hero-glow hero-glow-b"></div>

              <div class="relative space-y-3">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold"
                    :class="statusBadge.cls"
                  >
                    <span class="inline-flex h-1.5 w-1.5 rounded-full" :class="statusBadge.dot" />
                    {{ statusBadge.text }}
                  </span>

                  <span class="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-3 py-1 text-[11px] text-slate-900 dark:border-white/10 dark:bg-white/10 dark:text-white">
                    {{ game?.name || getGameSlug(t) }}
                  </span>

                  <span
                    v-if="sub?.active"
                    class="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-700 dark:text-emerald-200"
                  >
                    সাবস্ক্রিপশন চালু
                  </span>
                </div>

                <h1 class="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-white">
                  {{ t.title }}
                </h1>

                <div class="max-w-4xl text-sm leading-7 text-black/70 sm:text-base dark:text-white/75">
                  {{ introPitch }}
                </div>

                <div class="text-sm text-black/65 sm:text-base dark:text-white/70">
                  {{ fmt(getStartsAt(t)) }} – {{ fmt(getEndsAt(t)) }}
                </div>
              </div>
            </div>

            <div class="overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-[0_14px_44px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[28px] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]">
              <div class="aspect-[16/10] bg-black sm:aspect-[16/9]">
                <video
                  v-if="promoVideoType === 'upload' && promoVideoUrl"
                  :src="promoVideoUrl"
                  controls
                  autoplay
                  muted
                  playsinline
                  preload="metadata"
                  class="h-full w-full object-cover"
                />
                <iframe
                  v-else-if="promoVideoType === 'youtube' && promoYoutubeEmbedUrl"
                  :src="promoYoutubeEmbedUrl"
                  :title="promoVideoTitle || 'টুর্নামেন্ট প্রোমো ভিডিও'"
                  class="h-full w-full"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                />
                <div v-else class="relative h-full w-full">
                  <img :src="thumb" :alt="t.title" class="h-full w-full object-cover opacity-90" />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div class="absolute inset-0 grid place-items-center px-4">
                    <div class="rounded-full border border-white/15 bg-black/35 px-4 py-2 text-center text-sm text-white/80 backdrop-blur sm:px-5 sm:py-3">
                      প্রোমো ভিডিও শীঘ্রই আসছে
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="xl:hidden">
              <div
                class="state-shell rounded-[26px] p-[1px] sm:rounded-[30px]"
                :class="{
                  'state-shell-live': isLive,
                  'state-shell-scheduled': isScheduled,
                  'state-shell-ended': isEnded || isCanceled
                }"
              >
                <div class="rounded-[25px] bg-white p-4 sm:rounded-[29px] sm:p-6 dark:bg-[#0b1322]">
                  <div class="flex justify-center">
                    <span
                      class="inline-flex items-center gap-3 rounded-[16px] border px-4 py-2 text-xl font-extrabold tracking-tight sm:rounded-[18px] sm:px-5 sm:py-3 sm:text-2xl"
                      :class="statusBadge.cls"
                    >
                      <span class="inline-flex h-3 w-3 rounded-full sm:h-3.5 sm:w-3.5" :class="statusBadge.dot" />
                      {{ statusBadge.text }}
                    </span>
                  </div>

                  <div class="mt-6 text-center sm:mt-8">
                    <div class="text-lg text-slate-900 sm:text-2xl dark:text-white">
                      {{ isLive ? 'শেষ হতে বাকি' : isScheduled ? 'শুরু হতে বাকি' : isEnded ? 'টুর্নামেন্ট শেষ' : 'টুর্নামেন্ট বাতিল' }}
                    </div>
                    <div
                      class="mt-2 break-words text-2xl font-extrabold tracking-tight sm:text-4xl"
                      :class="{
                        'text-emerald-700 dark:text-emerald-300': isLive,
                        'text-violet-700 dark:text-violet-300': isScheduled,
                        'text-red-700 dark:text-red-300': isEnded || isCanceled
                      }"
                    >
                      {{ isLive ? msToTournamentClock(endsInMs) : isScheduled ? msToTournamentClock(startsInMs) : '০০ দিন: ০০ ঘন্টা: ০০ মিনিট' }}
                    </div>
                  </div>

                  <div class="mt-6 space-y-3 text-sm text-black/70 sm:mt-8 sm:text-base dark:text-white/75">
                    <div class="flex items-start gap-2">
                      <span class="mt-1.5 inline-block h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-300"></span>
                      <span>
                        যোগ্যতা:
                        <b class="font-semibold text-slate-900 dark:text-white">{{ sub?.active ? 'সাবস্ক্রিপশন চালু' : 'সাবস্ক্রিপশন প্রয়োজন' }}</b>
                      </span>
                    </div>
                  </div>

                  <div class="mt-6 space-y-3 sm:mt-8">
                    <UButton
                      v-if="canPlay"
                      block
                      size="xl"
                      class="cta-glow !rounded-[18px] min-h-[52px] sm:min-h-[56px]"
                      @click="playHard(t.slug)"
                    >
                      খেলুন
                    </UButton>

                    <UButton
                      v-else-if="isLive && user && sub && !sub.active"
                      block
                      size="xl"
                      class="cta-glow !rounded-[18px] min-h-[52px] sm:min-h-[56px]"
                      to="/subscribe"
                    >
                      খেলতে সাবস্ক্রাইব করুন
                    </UButton>

                    <UButton
                      v-else
                      block
                      size="xl"
                      class="cta-glow !rounded-[18px] min-h-[52px] sm:min-h-[56px]"
                      @click="playHard(t.slug)"
                    >
                      খেলুন
                    </UButton>

                    <UButton
                      v-if="isScheduled && game"
                      :to="practiceLink"
                      block
                      size="lg"
                      variant="solid"
                      color="primary"
                      class="practice-btn !rounded-[18px] min-h-[48px]"
                    >
                      প্র্যাকটিস করুন
                    </UButton>
                  </div>

                  <div class="mt-4 text-center text-sm text-black/55 dark:text-white/55">
                    {{ visiblePrizes.length ? `শীর্ষ ${toBnDigits(visiblePrizes.length)} জন পুরস্কার পাবে` : 'পুরস্কারের তথ্য শীঘ্রই আসছে' }}
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <h2 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">পুরস্কার</h2>
                  <div class="mt-1 text-sm text-black/55 dark:text-white/55">
                    {{ visiblePrizes.length ? `শীর্ষ ${toBnDigits(visiblePrizes.length)} জন বিজয়ী পুরস্কার পাবে` : 'পুরস্কারের তথ্য শীঘ্রই আসছে' }}
                  </div>
                </div>
              </div>

              <div
                v-if="prizesError && !visiblePrizes.length"
                class="rounded-[22px] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-100"
              >
                {{ prizesError }}
              </div>

              <div
                v-else-if="prizesPending && !visiblePrizes.length"
                class="rounded-[22px] border border-black/10 bg-white p-4 text-sm text-black/70 shadow-[0_14px_44px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]"
              >
                পুরস্কারের তথ্য লোড হচ্ছে…
              </div>

              <div
                v-else-if="!visiblePrizes.length"
                class="rounded-[22px] border border-black/10 bg-white p-4 text-sm text-black/70 shadow-[0_14px_44px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]"
              >
                পুরস্কারের বিস্তারিত শীঘ্রই প্রকাশ করা হবে।
              </div>

              <div
                v-else
                class="prize-scroll-x rounded-[24px] border border-black/10 bg-white p-3 shadow-[0_14px_44px_rgba(15,23,42,0.08)] sm:p-4 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]"
              >
                <div class="prize-row">
                  <div
                    v-for="p in visiblePrizes"
                    :key="`${p.rank}-${p.id || p.title}`"
                    class="prize-item prize-card-horizontal rounded-[20px] border border-black/10 bg-black/5 p-3 sm:rounded-[22px] sm:p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div class="relative h-36 w-full overflow-hidden rounded-[16px] border border-black/10 bg-white sm:h-40 sm:rounded-[18px] dark:border-white/10 dark:bg-white/10">
                      <img
                        v-if="p.image_url"
                        :src="p.image_url"
                        :alt="p.title"
                        class="h-full w-full object-cover"
                      />
                      <div v-else class="grid h-full w-full place-items-center text-5xl">
                        {{ medal(p.rank) }}
                      </div>
                    </div>

                    <div class="mt-4">
                      <div class="flex flex-wrap items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                          :class="rankChipClass(p.rank)"
                        >
                          {{ ordinalBn(p.rank) }}
                        </span>
                      </div>

                      <div class="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                        {{ p.title }}
                      </div>

                      <div v-if="p.description" class="mt-1 text-sm leading-6 text-black/70 dark:text-white/75">
                        {{ p.description }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="rounded-[24px] border border-black/10 bg-white p-5 text-sm leading-7 text-black/70 shadow-[0_14px_44px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]">
                টপ <b class="text-slate-900 dark:text-white">{{ toBnDigits(20) }}</b> জন স্কোরার পুরস্কার পাবে।
              </div>
            </div>

            <div class="xl:hidden rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_14px_44px_rgba(15,23,42,0.08)] sm:rounded-[26px] sm:p-6 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">লিডারবোর্ড</h2>
              </div>

              <div v-if="lbError" class="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-100">
                {{ lbError }}
              </div>

              <div
                v-else-if="!lbPending && !leaderboardPreview.length"
                class="mt-4 text-sm text-black/70 dark:text-white/75"
              >
                এখনো কোনো স্কোর জমা পড়েনি।
              </div>

              <div v-else class="mt-4 space-y-2.5">
                <div
                  v-for="(r, i) in leaderboardPreview"
                  :key="`${r.user_id || ''}-${r.player_name}-${r.created_at}-${i}`"
                  class="leader-row flex items-center justify-between gap-3 rounded-[16px] border border-black/10 bg-black/5 px-3 py-3 sm:rounded-[18px] sm:px-4 dark:border-white/10 dark:bg-white/5"
                  :class="i === 2 ? 'leader-row-active' : ''"
                >
                  <div class="flex min-w-0 items-center gap-3">
                    <div class="w-6 shrink-0 text-center text-lg">{{ medal(i + 1) }}</div>
                    <div class="min-w-0">
                      <div class="text-sm text-black/65 dark:text-white/65">{{ toBnDigits(i + 1) }}</div>
                    </div>
                    <div class="truncate text-base font-medium text-slate-900 sm:text-xl dark:text-white">
                      {{ leaderboardName(r) }}
                    </div>
                  </div>

                  <div class="shrink-0 text-base font-semibold text-slate-900 sm:text-xl dark:text-white">
                    {{ toBnDigits(r.score) }}
                  </div>
                </div>
              </div>

              <div class="mt-5 flex items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                <div class="text-sm text-black/55 dark:text-white/55">
                  সর্বশেষ আপডেট: {{ lastUpdatedText() }}
                </div>

                <UButton size="sm" variant="soft" class="!rounded-full" :loading="lbPending" @click="loadLeaderboard">
                  রিফ্রেশ
                </UButton>
              </div>

              <div class="mt-4">
                <UButton
                  :to="fullLeaderboardLink"
                  variant="soft"
                  block
                  class="!rounded-full"
                >
                  View Full Leaderboard
                </UButton>
              </div>
            </div>

            <div class="space-y-4">
              <h2 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{{ howToPlayTitle }}</h2>

              <div class="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_14px_44px_rgba(15,23,42,0.08)] sm:rounded-[26px] sm:p-6 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]">
                <div class="grid gap-5 lg:grid-cols-[8px_minmax(0,1fr)]">
                  <div class="hidden rounded-full bg-gradient-to-b from-emerald-400 via-emerald-500 to-transparent lg:block"></div>

                  <div>
                    <div v-if="howToPlaySummary" class="mb-5 text-sm leading-7 text-black/70 dark:text-white/75">
                      {{ howToPlaySummary }}
                    </div>

                    <ul class="space-y-4 sm:space-y-5">
                      <li v-for="(c, i) in howToPlaySteps" :key="`ctl-${i}`" class="flex gap-3">
                        <span class="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-black/80 dark:bg-white/80"></span>
                        <span class="text-sm leading-7 text-slate-900 sm:text-base sm:leading-8 dark:text-white">{{ c }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <section v-if="isEnded" class="space-y-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">চূড়ান্ত ফলাফল</h2>
                  <div class="mt-1 text-sm text-black/55 dark:text-white/55">টুর্নামেন্ট শেষ হলে বিজয়ীদের ফলাফল স্থির হয়ে যাবে।</div>
                </div>

                <UButton size="xs" variant="soft" class="!rounded-full" :loading="winnersPending" @click="loadWinners">
                  রিফ্রেশ
                </UButton>
              </div>

              <div
                v-if="winnersError"
                class="rounded-[22px] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-100"
              >
                {{ winnersError }}
              </div>

              <div
                v-else-if="!winnersPending && !hasWinners"
                class="rounded-[22px] border border-black/10 bg-white p-4 text-sm text-black/70 shadow-[0_14px_44px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]"
              >
                এখনো বিজয়ীদের তথ্য পাওয়া যায়নি। রিফ্রেশ করে দেখুন।
              </div>

              <div class="grid gap-4 md:grid-cols-3">
                <div
                  v-for="rank in [1, 2, 3]"
                  :key="`podium-${rank}`"
                  class="rounded-[22px] border border-black/10 bg-white p-5 text-center shadow-[0_14px_44px_rgba(15,23,42,0.08)] sm:rounded-[24px] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]"
                >
                  <div class="text-4xl">{{ medal(rank) }}</div>
                  <div class="mt-2 text-xs uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
                    {{ rank === 1 ? 'চ্যাম্পিয়ন' : rank === 2 ? 'রানার-আপ' : 'তৃতীয় স্থান' }}
                  </div>

                  <div class="mt-4 flex justify-center">
                    <div class="h-16 w-16 overflow-hidden rounded-full border border-black/10 bg-white dark:border-white/10 dark:bg-white/10">
                      <img
                        v-if="winnerAvatar(winnerByRank(rank))"
                        :src="winnerAvatar(winnerByRank(rank))"
                        alt="avatar"
                        class="h-full w-full object-cover"
                        @error="onAvatarError(winnerByRank(rank)?.user_id)"
                      />
                      <div v-else class="grid h-full w-full place-items-center text-sm font-semibold text-slate-900 dark:text-white">
                        {{ initials(winnerName(winnerByRank(rank))) }}
                      </div>
                    </div>
                  </div>

                  <div class="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
                    {{ winnerName(winnerByRank(rank)) }}
                  </div>

                  <div class="mt-1 text-xs text-black/55 dark:text-white/55">
                    ফোন:
                    <b class="font-semibold text-slate-900 dark:text-white">{{ winnerPhone(winnerByRank(rank)) || '—' }}</b>
                  </div>

                  <div class="mt-3 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-3 py-1.5 text-sm text-slate-900 dark:border-white/10 dark:bg-white/10 dark:text-white">
                    <UIcon name="i-heroicons-bolt" class="h-4 w-4 opacity-90" />
                    <span class="font-semibold">{{ toBnDigits(winnerByRank(rank)?.score ?? '—') }}</span>
                  </div>

                  <div v-if="winnerPrizeText(winnerByRank(rank))" class="mt-3 text-sm text-black/70 dark:text-white/75">
                    <b class="text-slate-900 dark:text-white">পুরস্কার:</b> {{ winnerPrizeText(winnerByRank(rank)) }}
                  </div>
                </div>
              </div>
            </section>

            <section class="space-y-4">
              <h2 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">সমস্যা রিপোর্ট</h2>

              <div class="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_14px_44px_rgba(15,23,42,0.08)] sm:rounded-[26px] sm:p-6 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]">
                <div class="flex flex-col gap-4 sm:gap-5">
                  <div>
                    <div class="text-lg font-semibold text-slate-900 dark:text-white">
                      কোনো সমস্যা পাচ্ছেন?
                    </div>
                    <div class="mt-2 text-sm leading-7 text-black/70 sm:text-base dark:text-white/75">
                      টুর্নামেন্ট, স্কোর, লোডিং, সাবমিশন বা গেম চালু না হওয়ার মতো কোনো সমস্যা হলে আমাদের জানান।
                      আপনি চাইলে Contact পেজে গিয়ে রিপোর্ট করতে পারেন, অথবা সরাসরি WhatsApp-এ মেসেজ পাঠাতে পারেন।
                    </div>
                  </div>

                  <div class="flex flex-col gap-3 sm:flex-row">
                    <UButton
                      to="/contact"
                      size="lg"
                      class="!rounded-[18px] min-h-[48px]"
                    >
                      <UIcon name="i-heroicons-envelope" class="mr-2 h-5 w-5" />
                      Contact Page
                    </UButton>

                    <a
                      :href="whatsappReportLink"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="wa-report-btn inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[18px] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      <UIcon name="i-simple-icons-whatsapp" class="h-5 w-5" />
                      WhatsApp-এ রিপোর্ট করুন
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <div class="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_14px_44px_rgba(15,23,42,0.08)] sm:rounded-[26px] sm:p-6 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]">
              <h3 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">শর্তাবলী</h3>

              <ul class="mt-4 space-y-3">
                <li v-for="(r, i) in termsList" :key="`terms-${i}`" class="flex gap-3">
                  <span class="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 dark:bg-emerald-300"></span>
                  <span class="text-sm leading-7 text-slate-900 sm:text-base dark:text-white">{{ r }}</span>
                </li>
              </ul>
            </div>
          </div>

          <aside class="hidden space-y-5 xl:sticky xl:top-6 xl:block xl:self-start xl:space-y-6">
            <div
              class="state-shell rounded-[26px] p-[1px] sm:rounded-[30px]"
              :class="{
                'state-shell-live': isLive,
                'state-shell-scheduled': isScheduled,
                'state-shell-ended': isEnded || isCanceled
              }"
            >
              <div class="rounded-[25px] bg-white p-4 sm:rounded-[29px] sm:p-6 dark:bg-[#0b1322]">
                <div class="flex justify-center">
                  <span
                    class="inline-flex items-center gap-3 rounded-[16px] border px-4 py-2 text-xl font-extrabold tracking-tight sm:rounded-[18px] sm:px-5 sm:py-3 sm:text-2xl"
                    :class="statusBadge.cls"
                  >
                    <span class="inline-flex h-3 w-3 rounded-full sm:h-3.5 sm:w-3.5" :class="statusBadge.dot" />
                    {{ statusBadge.text }}
                  </span>
                </div>

                <div class="mt-6 text-center sm:mt-8">
                  <div class="text-lg text-slate-900 sm:text-2xl dark:text-white">
                    {{ isLive ? 'শেষ হতে বাকি' : isScheduled ? 'শুরু হতে বাকি' : isEnded ? 'টুর্নামেন্ট শেষ' : 'টুর্নামেন্ট বাতিল' }}
                  </div>
                  <div
                    class="mt-2 break-words text-2xl font-extrabold tracking-tight sm:text-4xl"
                    :class="{
                      'text-emerald-700 dark:text-emerald-300': isLive,
                      'text-violet-700 dark:text-violet-300': isScheduled,
                      'text-red-700 dark:text-red-300': isEnded || isCanceled
                    }"
                  >
                    {{ isLive ? msToTournamentClock(endsInMs) : isScheduled ? msToTournamentClock(startsInMs) : '০০ দিন: ০০ ঘন্টা: ০০ মিনিট' }}
                  </div>
                </div>

                <div class="mt-6 space-y-3 text-sm text-black/70 sm:mt-8 sm:text-base dark:text-white/75">
                  <div class="flex items-start gap-2">
                    <span class="mt-1.5 inline-block h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-300"></span>
                    <span>
                      যোগ্যতা:
                      <b class="font-semibold text-slate-900 dark:text-white">{{ sub?.active ? 'সাবস্ক্রিপশন চালু' : 'সাবস্ক্রিপশন প্রয়োজন' }}</b>
                    </span>
                  </div>
                </div>

                <div class="mt-6 space-y-3 sm:mt-8">
                  <UButton
                    v-if="canPlay"
                    block
                    size="xl"
                    class="cta-glow !rounded-[18px] min-h-[52px] sm:min-h-[56px]"
                    @click="playHard(t.slug)"
                  >
                    খেলুন
                  </UButton>

                  <UButton
                    v-else-if="isLive && user && sub && !sub.active"
                    block
                    size="xl"
                    class="cta-glow !rounded-[18px] min-h-[52px] sm:min-h-[56px]"
                    to="/subscribe"
                  >
                    খেলতে সাবস্ক্রাইব করুন
                  </UButton>

                  <UButton
                    v-else
                    block
                    size="xl"
                    class="cta-glow !rounded-[18px] min-h-[52px] sm:min-h-[56px]"
                    @click="playHard(t.slug)"
                  >
                    খেলুন
                  </UButton>

                  <UButton
                    v-if="isScheduled && game"
                    :to="practiceLink"
                    block
                    size="lg"
                    variant="solid"
                    color="primary"
                    class="practice-btn !rounded-[18px] min-h-[48px]"
                  >
                    প্র্যাকটিস করুন
                  </UButton>
                </div>

                <div class="mt-4 text-center text-sm text-black/55 dark:text-white/55">
                  {{ visiblePrizes.length ? `শীর্ষ ${toBnDigits(visiblePrizes.length)} জন পুরস্কার পাবে` : 'পুরস্কারের তথ্য শীঘ্রই আসছে' }}
                </div>
              </div>
            </div>

            <div class="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_14px_44px_rgba(15,23,42,0.08)] sm:rounded-[26px] sm:p-6 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_46px_rgba(0,0,0,0.30)]">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">লিডারবোর্ড</h2>
              </div>

              <div v-if="lbError" class="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-100">
                {{ lbError }}
              </div>

              <div
                v-else-if="!lbPending && !leaderboardPreview.length"
                class="mt-4 text-sm text-black/70 dark:text-white/75"
              >
                এখনো কোনো স্কোর জমা পড়েনি।
              </div>

              <div v-else class="mt-4 space-y-2.5">
                <div
                  v-for="(r, i) in leaderboardPreview"
                  :key="`${r.user_id || ''}-${r.player_name}-${r.created_at}-${i}`"
                  class="leader-row flex items-center justify-between gap-3 rounded-[16px] border border-black/10 bg-black/5 px-3 py-3 sm:rounded-[18px] sm:px-4 dark:border-white/10 dark:bg-white/5"
                  :class="i === 2 ? 'leader-row-active' : ''"
                >
                  <div class="flex min-w-0 items-center gap-3">
                    <div class="w-6 shrink-0 text-center text-lg">{{ medal(i + 1) }}</div>
                    <div class="min-w-0">
                      <div class="text-sm text-black/65 dark:text-white/65">{{ toBnDigits(i + 1) }}</div>
                    </div>
                    <div class="truncate text-base font-medium text-slate-900 sm:text-xl dark:text-white">
                      {{ leaderboardName(r) }}
                    </div>
                  </div>

                  <div class="shrink-0 text-base font-semibold text-slate-900 sm:text-xl dark:text-white">
                    {{ toBnDigits(r.score) }}
                  </div>
                </div>
              </div>

              <div class="mt-5 flex items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                <div class="text-sm text-black/55 dark:text-white/55">
                  সর্বশেষ আপডেট: {{ lastUpdatedText() }}
                </div>

                <UButton size="sm" variant="soft" class="!rounded-full" :loading="lbPending" @click="loadLeaderboard">
                  রিফ্রেশ
                </UButton>
              </div>

              <div class="mt-4">
                <UButton
                  :to="fullLeaderboardLink"
                  variant="soft"
                  block
                  class="!rounded-full"
                >
                  View Full Leaderboard
                </UButton>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>
.tournament-page {
  position: relative;
  min-height: 100%;
}

.tournament-page::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(circle at 18% 10%, rgba(139, 92, 246, 0.12), transparent 28%),
    radial-gradient(circle at 82% 14%, rgba(16, 185, 129, 0.1), transparent 24%),
    linear-gradient(180deg, #f7faff 0%, #eef4ff 52%, #f9fbff 100%);
}

.tournament-page::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.08;
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.08) 1px, transparent 1px);
  background-size: 38px 38px;
  mask-image: radial-gradient(circle at center, black 35%, transparent 100%);
}

.hero-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(64px);
  pointer-events: none;
}

.hero-glow-a {
  top: -72px;
  right: 8%;
  width: 220px;
  height: 220px;
  background: rgba(139, 92, 246, 0.16);
}

.hero-glow-b {
  bottom: -92px;
  left: 10%;
  width: 240px;
  height: 240px;
  background: rgba(16, 185, 129, 0.12);
}

.state-shell {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03),
    0 18px 48px rgba(15, 23, 42, 0.12);
}

.state-shell-live {
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.72), rgba(5, 150, 105, 0.34));
}

.state-shell-scheduled {
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.72), rgba(99, 102, 241, 0.34));
}

.state-shell-ended {
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.72), rgba(220, 38, 38, 0.34));
}

.cta-glow {
  box-shadow:
    0 0 0 1px rgba(16, 185, 129, 0.14),
    0 12px 28px rgba(16, 185, 129, 0.18);
}

.practice-btn {
  background-color: rgb(37 99 235) !important;
  border-color: rgb(37 99 235) !important;
  color: white !important;
}

.practice-btn:hover {
  background-color: rgb(29 78 216) !important;
  border-color: rgb(29 78 216) !important;
}

.wa-report-btn {
  background: linear-gradient(135deg, rgb(34 197 94), rgb(22 163 74));
  box-shadow:
    0 0 0 1px rgba(34, 197, 94, 0.18),
    0 12px 28px rgba(34, 197, 94, 0.22);
}

.prize-scroll-x {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgba(16, 185, 129, 0.4) rgba(0, 0, 0, 0.06);
}

.prize-scroll-x::-webkit-scrollbar {
  height: 8px;
}

.prize-scroll-x::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.06);
  border-radius: 999px;
}

.prize-scroll-x::-webkit-scrollbar-thumb {
  background: rgba(16, 185, 129, 0.4);
  border-radius: 999px;
}

.prize-row {
  display: flex;
  gap: 16px;
  min-width: max-content;
}

.prize-card-horizontal {
  width: 280px;
  min-width: 280px;
  max-width: 280px;
  flex: 0 0 280px;
}

.prize-item {
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.prize-item:hover {
  transform: translateY(-2px);
}

.leader-row-active {
  border-color: rgba(16, 185, 129, 0.4) !important;
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.13), rgba(16, 185, 129, 0.06)) !important;
  box-shadow:
    inset 0 0 0 1px rgba(16, 185, 129, 0.08),
    0 0 18px rgba(16, 185, 129, 0.08);
}

@media (max-width: 1279px) {
  .tournament-page :deep(.container) {
    max-width: 100%;
  }
}

@media (max-width: 1023px) {
  .prize-card-horizontal {
    width: 250px;
    min-width: 250px;
    max-width: 250px;
    flex-basis: 250px;
  }
}

@media (max-width: 640px) {
  .tournament-page::after {
    background-size: 24px 24px;
  }

  .prize-row {
    gap: 12px;
  }

  .prize-card-horizontal {
    width: 220px;
    min-width: 220px;
    max-width: 220px;
    flex-basis: 220px;
  }
}
</style>