<!-- app/pages/admin/tournaments.vue -->
<script setup lang="ts">
import { GAMES } from '@/data/games'

/** ✅ Ad slots list */
const AD_SLOTS = [
  { key: 'home_top', label: 'Home — Top Banner' },
  { key: 'home_mid', label: 'Home — Middle Banner' },
  { key: 'home_bottom', label: 'Home — Bottom Banner' },
  { key: 'arcade_sidebar', label: 'Arcade — Top Banner' }
] as const
type AdSlotKey = typeof AD_SLOTS[number]['key']

/** ✅ Banner ratios (stored per ad) */
const AD_RATIOS = [
  { key: '16/9', label: '16:9 (standard)' },
  { key: '21/9', label: '21:9 (ultrawide)' },
  { key: '3/1', label: '3:1 (wide banner)' }
] as const
type AdRatioKey = typeof AD_RATIOS[number]['key']

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Tournaments' })

const toast = useToast()
const supabase = useSupabaseClient()

/* ---------------- Types ---------------- */
type TournamentStatus = 'scheduled' | 'live' | 'ended' | 'canceled' | string
type PromoVideoType = '' | 'upload' | 'youtube'

type TournamentRow = {
  id: string
  slug: string
  title: string
  description: string | null
  game_slug: string
  starts_at: string
  ends_at: string
  status: TournamentStatus
  finalized: boolean
  thumbnail_url?: string | null
  thumbnail_path?: string | null

  promo_video_type?: PromoVideoType | null
  promo_video_url?: string | null
  promo_video_path?: string | null
  promo_video_youtube_id?: string | null
  promo_video_title?: string | null

  created_at?: string
  updated_at?: string
}

type RewardStatus = 'pending' | 'given' | string
type RewardMethod = 'online' | 'offline' | '' | string

type WinnerRow = {
  id: string
  tournament_slug: string
  tournament_id?: string
  rank: number
  user_id: string | null
  player_name: string | null
  score: number
  prize_id?: string | null
  prize?: string | null
  prize_label?: string | null
  reward_status?: RewardStatus | null
  reward_method?: RewardMethod | null
  reward_txn_id?: string | null
  rewarded_at?: string | null
  created_at?: string
}

type AdRow = {
  id: string
  tournament_id: string
  slot: string
  ratio: AdRatioKey | string
  banner_url: string | null
  banner_path: string | null
  alt: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at?: string
}

type PrizeCatalogRow = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  image_path: string | null
  is_active?: boolean
  sort_order?: number
  created_at?: string
  updated_at?: string
}

type TournamentPrizeMapRow = {
  id: string
  tournament_id: string
  prize_id: string
  rank: number
  created_at?: string
  updated_at?: string
  prize?: PrizeCatalogRow | null
}

type PrizeMapFormRow = {
  id: string
  prize_id: string
  rank: number
}

/* ---------------- State ---------------- */
const loading = ref(false)
const errorMsg = ref<string | null>(null)

const q = ref('')
const filterStatus = ref<string>('')
const filterGame = ref<string>('')

const rows = ref<TournamentRow[]>([])
const selectedId = ref<string | null>(null)
const selected = computed(() => rows.value.find(r => r.id === selectedId.value) || null)
const isEditing = computed(() => Boolean(form.id))

/* ---------------- Tabs ---------------- */
const tab = ref<'details' | 'schedule' | 'ads' | 'winners'>('details')

/* ---------------- Form ---------------- */
const form = reactive({
  id: '' as string,
  slug: '' as string,
  title: '' as string,
  description: '' as string,
  game_slug: (GAMES[0]?.slug || '') as string,
  starts_local: '' as string,
  ends_local: '' as string,

  status: 'scheduled' as TournamentStatus,
  finalized: false as boolean,

  thumbnail_url: '' as string,
  thumbnail_path: '' as string,

  promo_video_type: '' as PromoVideoType,
  promo_video_url: '' as string,
  promo_video_path: '' as string,
  promo_video_youtube_id: '' as string,
  promo_video_title: '' as string
})

/* ---------------- Time helpers ---------------- */
function toIsoFromLocal(dtLocal: string) {
  if (!dtLocal) return ''
  const d = new Date(dtLocal)
  const ms = d.getTime()
  if (!Number.isFinite(ms)) return ''
  return d.toISOString()
}
function toLocalInputValue(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const ms = d.getTime()
  if (!Number.isFinite(ms)) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}
function fmt(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}
function msToClock(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}
function ordinal(n: number) {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

const now = ref(Date.now())
let ticker: any = null
onMounted(() => (ticker = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => {
  ticker && clearInterval(ticker)
  revokeVideoPreviewIfBlob()
})

const startsIso = computed(() => toIsoFromLocal(form.starts_local))
const endsIso = computed(() => toIsoFromLocal(form.ends_local))
const startsIn = computed(() => (startsIso.value ? new Date(startsIso.value).getTime() - now.value : 0))
const endsIn = computed(() => (endsIso.value ? new Date(endsIso.value).getTime() - now.value : 0))
const timeError = computed(() => {
  if (!startsIso.value || !endsIso.value) return ''
  const s = new Date(startsIso.value).getTime()
  const e = new Date(endsIso.value).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 'Invalid datetime'
  if (e <= s) return 'End must be after start'
  return ''
})

/* ---------------- Derived status (time-based) ---------------- */
function computeStatusFromWindow(startsAtIso: string, endsAtIso: string, statusStored: TournamentStatus) {
  if (statusStored === 'canceled') return 'canceled'
  const s = new Date(startsAtIso).getTime()
  const e = new Date(endsAtIso).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e)) return statusStored || 'scheduled'
  if (now.value < s) return 'scheduled'
  if (now.value >= s && now.value < e) return 'live'
  return 'ended'
}

const derivedStatus = computed<TournamentStatus>(() => {
  const s = startsIso.value
  const e = endsIso.value
  if (!s || !e) return form.status || 'scheduled'
  return computeStatusFromWindow(s, e, form.status)
})

const isCanceled = computed(() => derivedStatus.value === 'canceled')
const isEnded = computed(() => derivedStatus.value === 'ended')

/* ---------------- Slug auto ---------------- */
function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
watch(
  () => form.title,
  (v) => {
    if (!form.id) form.slug = slugify(v || '')
  }
)

/* ---------------- File preview helpers ---------------- */
function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}
function fileToObjectUrl(file: File) {
  return URL.createObjectURL(file)
}

/* ---------------- Thumbnail ---------------- */
const THUMB_BUCKET = 'tournament-thumbnails'
const thumbUploading = ref(false)
const thumbFile = ref<File | null>(null)
const thumbPreview = ref<string>('')
const thumbInputEl = ref<HTMLInputElement | null>(null)

async function setThumbFile(file: File | null) {
  thumbFile.value = file
  thumbPreview.value = ''
  if (file) {
    try {
      thumbPreview.value = await fileToDataUrl(file)
    } catch {
      thumbPreview.value = ''
    }
  }
}

async function onThumbPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0] || null
  await setThumbFile(file)
  if (input) input.value = ''
}

const effectiveThumbUrl = computed(() => {
  if (thumbPreview.value) return thumbPreview.value
  if (form.thumbnail_url) return form.thumbnail_url
  return ''
})

function clearThumbSelection() {
  setThumbFile(null)
  if (thumbInputEl.value) thumbInputEl.value.value = ''
}

async function uploadThumbAndPersist(tournamentId: string) {
  if (!thumbFile.value) return
  thumbUploading.value = true
  try {
    const safeName = thumbFile.value.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `tournaments/${tournamentId}/${Date.now()}-${safeName}`

    const { error: upErr } = await supabase.storage.from(THUMB_BUCKET).upload(path, thumbFile.value, {
      upsert: true,
      contentType: thumbFile.value.type
    })
    if (upErr) throw upErr

    const { data } = supabase.storage.from(THUMB_BUCKET).getPublicUrl(path)
    const publicUrl = data?.publicUrl || ''

    form.thumbnail_path = path
    form.thumbnail_url = publicUrl

    await apiUpsert({ saveOnlyMeta: true, skipThumbUpload: true, skipVideoUpload: true })
    clearThumbSelection()
    toast.add({ title: 'Thumbnail saved', color: 'success' })
  } finally {
    thumbUploading.value = false
  }
}

/* ---------------- Promo Video ---------------- */
const VIDEO_BUCKET = 'tournament-videos'
const videoUploading = ref(false)
const videoFile = ref<File | null>(null)
const videoPreview = ref<string>('')
const videoInputEl = ref<HTMLInputElement | null>(null)
const youtubeInput = ref('')

function revokeVideoPreviewIfBlob() {
  if (videoPreview.value && videoPreview.value.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(videoPreview.value)
    } catch {}
  }
}

async function setVideoFile(file: File | null) {
  revokeVideoPreviewIfBlob()
  videoFile.value = file
  videoPreview.value = ''
  if (file) {
    try {
      videoPreview.value = fileToObjectUrl(file)
    } catch {
      videoPreview.value = ''
    }
  }
}

async function onVideoPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0] || null
  await setVideoFile(file)
  if (input) input.value = ''
}

function clearVideoSelection() {
  setVideoFile(null)
  if (videoInputEl.value) videoInputEl.value.value = ''
}

function extractYouTubeId(input: string) {
  const s = String(input || '').trim()
  if (!s) return ''
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s

  try {
    const url = new URL(s)

    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace('/', '').trim()
    }

    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v')
      if (v) return v.trim()

      const parts = url.pathname.split('/').filter(Boolean)
      const embedIndex = parts.findIndex(p => p === 'embed')
      if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1].trim()

      const shortsIndex = parts.findIndex(p => p === 'shorts')
      if (shortsIndex >= 0 && parts[shortsIndex + 1]) return parts[shortsIndex + 1].trim()
    }
  } catch {}

  return ''
}

const effectiveVideoUrl = computed(() => {
  if (videoPreview.value) return videoPreview.value
  if (form.promo_video_type === 'upload') return form.promo_video_url || ''
  return ''
})
const effectiveYoutubeId = computed(() => form.promo_video_type === 'youtube' ? form.promo_video_youtube_id || '' : '')
const effectiveYoutubeEmbedUrl = computed(() => effectiveYoutubeId.value ? `https://www.youtube.com/embed/${effectiveYoutubeId.value}` : '')

function clearStoredVideoFields() {
  form.promo_video_url = ''
  form.promo_video_path = ''
  form.promo_video_youtube_id = ''
}

async function removeStoredVideoFile() {
  if (!form.promo_video_path) return
  try {
    await supabase.storage.from(VIDEO_BUCKET).remove([form.promo_video_path])
  } catch {}
}

function onVideoTypeChange(nextType: PromoVideoType) {
  form.promo_video_type = nextType

  if (nextType === 'youtube') {
    clearVideoSelection()
    form.promo_video_url = ''
    form.promo_video_path = ''
  }

  if (nextType === 'upload') {
    youtubeInput.value = ''
    form.promo_video_youtube_id = ''
  }

  if (!nextType) {
    clearVideoSelection()
    youtubeInput.value = ''
    clearStoredVideoFields()
  }
}

function applyYoutubeInput() {
  const id = extractYouTubeId(youtubeInput.value)
  if (!id) {
    toast.add({ title: 'Invalid YouTube link', description: 'Paste a valid YouTube URL or 11-character video ID.', color: 'error' })
    return
  }

  clearVideoSelection()
  form.promo_video_type = 'youtube'
  form.promo_video_youtube_id = id
  form.promo_video_url = ''
  form.promo_video_path = ''
  youtubeInput.value = id
  toast.add({ title: 'YouTube video ready', color: 'success' })
}

async function uploadVideoAndPersist(tournamentId: string) {
  if (!videoFile.value) return

  videoUploading.value = true
  try {
    const safeName = videoFile.value.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `tournaments/${tournamentId}/videos/${Date.now()}-${safeName}`

    const { error: upErr } = await supabase.storage.from(VIDEO_BUCKET).upload(path, videoFile.value, {
      upsert: true,
      contentType: videoFile.value.type
    })
    if (upErr) throw upErr

    const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path)
    const publicUrl = data?.publicUrl || ''

    if (form.promo_video_path) {
      try {
        await supabase.storage.from(VIDEO_BUCKET).remove([form.promo_video_path])
      } catch {}
    }

    form.promo_video_type = 'upload'
    form.promo_video_path = path
    form.promo_video_url = publicUrl
    form.promo_video_youtube_id = ''

    await apiUpsert({ saveOnlyMeta: true, skipThumbUpload: true, skipVideoUpload: true })
    clearVideoSelection()
    toast.add({ title: 'Video saved', color: 'success' })
  } finally {
    videoUploading.value = false
  }
}

async function clearStoredVideo() {
  await removeStoredVideoFile()
  clearVideoSelection()
  youtubeInput.value = ''
  form.promo_video_type = ''
  clearStoredVideoFields()
  toast.add({ title: 'Video cleared', color: 'success' })
}

/* ---------------- Prize Catalog + Tournament Prize Mapping ---------------- */
const prizeCatalogLoading = ref(false)
const prizeMapLoading = ref(false)
const prizeMapSaving = ref(false)

const prizeCatalog = ref<PrizeCatalogRow[]>([])
const prizeMaps = ref<PrizeMapFormRow[]>([])

function makeEmptyPrizeMap(rank: number): PrizeMapFormRow {
  return {
    id: '',
    prize_id: '',
    rank
  }
}

function normalizePrizeMapRanks() {
  prizeMaps.value = prizeMaps.value.map((x, i) => ({
    ...x,
    rank: i + 1
  }))
}

function addPrizeMap() {
  prizeMaps.value.push(makeEmptyPrizeMap(prizeMaps.value.length + 1))
  normalizePrizeMapRanks()
}

function removePrizeMap(index: number) {
  prizeMaps.value.splice(index, 1)
  normalizePrizeMapRanks()
}

function movePrizeMapUp(index: number) {
  if (index <= 0) return
  const arr = [...prizeMaps.value]
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
  prizeMaps.value = arr
  normalizePrizeMapRanks()
}

function movePrizeMapDown(index: number) {
  if (index >= prizeMaps.value.length - 1) return
  const arr = [...prizeMaps.value]
  ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
  prizeMaps.value = arr
  normalizePrizeMapRanks()
}

function prizeById(id: string) {
  return prizeCatalog.value.find(p => p.id === id) || null
}

const selectablePrizeOptions = computed(() =>
  prizeCatalog.value
    .filter(p => (p as any).is_active !== false)
    .sort((a, b) => {
      const sa = Number((a as any).sort_order ?? 100)
      const sb = Number((b as any).sort_order ?? 100)
      if (sa !== sb) return sa - sb
      return String(a.title || '').localeCompare(String(b.title || ''))
    })
)

async function loadPrizeCatalog() {
  prizeCatalogLoading.value = true
  try {
    const { data, error } = await supabase
      .from('tournament_prizes')
      .select('id, title, description, image_url, image_path, is_active, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })

    if (error) throw error
    prizeCatalog.value = (data || []) as PrizeCatalogRow[]
  } catch (e: any) {
    toast.add({ title: 'Failed to load prize catalog', description: e?.message || 'Try again', color: 'error' })
    prizeCatalog.value = []
  } finally {
    prizeCatalogLoading.value = false
  }
}

async function loadPrizeMapsForTournament(tournamentId: string) {
  prizeMapLoading.value = true
  try {
    const { data, error } = await supabase
      .from('tournament_prize_map')
      .select('id, tournament_id, prize_id, rank, created_at, updated_at')
      .eq('tournament_id', tournamentId)
      .order('rank', { ascending: true })

    if (error) throw error

    prizeMaps.value = ((data || []) as TournamentPrizeMapRow[]).map((r) => ({
      id: r.id,
      prize_id: r.prize_id,
      rank: Number(r.rank || 0) || 1
    }))

    normalizePrizeMapRanks()
  } catch (e: any) {
    toast.add({ title: 'Failed to load tournament prizes', description: e?.message || 'Try again', color: 'error' })
    prizeMaps.value = []
  } finally {
    prizeMapLoading.value = false
  }
}

async function savePrizeMaps(tournamentId: string) {
  if (!tournamentId) throw new Error('Missing tournament id')

  normalizePrizeMapRanks()

  const cleaned = prizeMaps.value
    .map((row, i) => ({
      id: row.id || null,
      tournament_id: tournamentId,
      prize_id: String(row.prize_id || '').trim(),
      rank: i + 1
    }))
    .filter((row) => row.prize_id)

  const duplicatePrize = (() => {
    const seen = new Set<string>()
    for (const row of cleaned) {
      if (seen.has(row.prize_id)) return true
      seen.add(row.prize_id)
    }
    return false
  })()

  if (duplicatePrize) {
    toast.add({ title: 'Duplicate prize selected', description: 'A prize can be used only once in the same tournament.', color: 'error' })
    return
  }

  prizeMapSaving.value = true
  try {
    const { data: existingRows, error: existingErr } = await supabase
      .from('tournament_prize_map')
      .select('id')
      .eq('tournament_id', tournamentId)

    if (existingErr) throw existingErr

    const existing = (existingRows || []) as Array<{ id: string }>
    const keepIds = new Set(cleaned.map(x => x.id).filter(Boolean) as string[])
    const deleteIds = existing.filter(x => !keepIds.has(x.id)).map(x => x.id)

    if (deleteIds.length) {
      const { error: delErr } = await supabase.from('tournament_prize_map').delete().in('id', deleteIds)
      if (delErr) throw delErr
    }

    for (const row of cleaned) {
      if (row.id) {
        const { error } = await supabase
          .from('tournament_prize_map')
          .update({
            prize_id: row.prize_id,
            rank: row.rank,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tournament_prize_map')
          .insert({
            tournament_id: row.tournament_id,
            prize_id: row.prize_id,
            rank: row.rank
          })

        if (error) throw error
      }
    }

    await loadPrizeMapsForTournament(tournamentId)
    toast.add({ title: 'Tournament prizes saved', color: 'success' })
  } finally {
    prizeMapSaving.value = false
  }
}

/* ---------------- Ads ---------------- */
const ADS_BUCKET = 'tournament-banners'

const adLoading = ref(false)
const ads = ref<AdRow[]>([])

const activeSlotUsage = ref<Record<string, { adId: string; tournamentId: string }>>({})
const slotOccupied = computed(() => new Set(Object.keys(activeSlotUsage.value || {})))

const adForm = reactive({
  id: '' as string,
  enabled: false as boolean,
  slot: '' as AdSlotKey | '',
  ratio: '16/9' as AdRatioKey,
  alt: '' as string,
  starts_local: '' as string,
  ends_local: '' as string,
  banner_url: '' as string,
  banner_path: '' as string
})

const adFile = ref<File | null>(null)
const adPreview = ref<string>('')
const adUploading = ref(false)
const adInputEl = ref<HTMLInputElement | null>(null)

async function setAdFile(file: File | null) {
  adFile.value = file
  adPreview.value = ''
  if (file) {
    try {
      adPreview.value = await fileToDataUrl(file)
    } catch {
      adPreview.value = ''
    }
  }
}

async function onAdPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0] || null
  await setAdFile(file)
  if (input) input.value = ''
}

const effectiveAdImg = computed(() => adPreview.value || adForm.banner_url || '')
const previewRatioClass = computed(() => {
  const r = String(adForm.ratio || '16/9')
  if (r === '21/9') return 'aspect-[21/9]'
  if (r === '3/1') return 'aspect-[3/1]'
  return 'aspect-[16/9]'
})

function clearAdSelection() {
  setAdFile(null)
  if (adInputEl.value) adInputEl.value.value = ''
}

function toIsoFromLocalOrNull(dtLocal: string) {
  if (!dtLocal) return null
  const iso = toIsoFromLocal(dtLocal)
  return iso || null
}

function resetAdForm() {
  adForm.id = ''
  adForm.enabled = true
  adForm.slot = ''
  adForm.ratio = '16/9'
  adForm.alt = ''
  adForm.starts_local = ''
  adForm.ends_local = ''
  adForm.banner_url = ''
  adForm.banner_path = ''
  clearAdSelection()
}

function pickAdForEdit(row: AdRow) {
  adForm.id = row.id
  adForm.enabled = Boolean(row.is_active)
  adForm.slot = (row.slot as AdSlotKey) || ''
  adForm.ratio = (String((row as any).ratio || '16/9') as AdRatioKey) || '16/9'
  adForm.alt = row.alt || ''
  adForm.banner_url = row.banner_url || ''
  adForm.banner_path = row.banner_path || ''
  adForm.starts_local = row.starts_at ? toLocalInputValue(row.starts_at) : ''
  adForm.ends_local = row.ends_at ? toLocalInputValue(row.ends_at) : ''
  clearAdSelection()
}

async function loadActiveSlotUsage() {
  const { data, error } = await supabase.from('tournament_ads').select('id, slot, tournament_id').eq('is_active', true)
  if (error) throw error

  const map: Record<string, { adId: string; tournamentId: string }> = {}
  for (const r of data || []) {
    const slot = String((r as any).slot || '')
    const adId = String((r as any).id || '')
    const tid = String((r as any).tournament_id || '')
    if (slot && adId && tid) map[slot] = { adId, tournamentId: tid }
  }
  activeSlotUsage.value = map
}

async function loadAdsForTournament(tournamentId: string) {
  adLoading.value = true
  try {
    await loadActiveSlotUsage()
    const { data, error } = await supabase
      .from('tournament_ads')
      .select('id, tournament_id, slot, ratio, banner_url, banner_path, alt, is_active, starts_at, ends_at, created_at')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })

    if (error) throw error

    ads.value = (data || []) as any
    if (adForm.id && !ads.value.some(a => a.id === adForm.id)) resetAdForm()
  } catch (e: any) {
    toast.add({ title: 'Failed to load ads', description: e?.message || 'Try again', color: 'error' })
    ads.value = []
  } finally {
    adLoading.value = false
  }
}

const usedSlotsInThisTournament = computed(() => {
  const set = new Set<string>()
  for (const a of ads.value) {
    const slot = String(a.slot || '')
    if (slot) set.add(slot)
  }
  return set
})

const selectableSlots = computed(() => {
  const isEditingAd = Boolean(adForm.id)
  const currentSlot = String(adForm.slot || '')

  return AD_SLOTS.filter((s) => {
    const occupied = slotOccupied.value.has(s.key)
    const usedHere = usedSlotsInThisTournament.value.has(s.key)

    if (isEditingAd && s.key === currentSlot) return true
    if (!isEditingAd) return !occupied && !usedHere
    return !occupied && !usedHere
  })
})

const noVacantSlotsForNewAd = computed(() => {
  if (adForm.id) return false
  return AD_SLOTS.every((s) => slotOccupied.value.has(s.key) || usedSlotsInThisTournament.value.has(s.key))
})

async function uploadAdBanner(tournamentId: string) {
  if (!adFile.value) return null
  adUploading.value = true
  try {
    const safeName = adFile.value.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `ads/${tournamentId}/${Date.now()}-${safeName}`

    const { error: upErr } = await supabase.storage.from(ADS_BUCKET).upload(path, adFile.value, {
      upsert: true,
      contentType: adFile.value.type
    })
    if (upErr) throw upErr

    const { data } = supabase.storage.from(ADS_BUCKET).getPublicUrl(path)
    const url = data?.publicUrl || ''

    return { path, url }
  } finally {
    adUploading.value = false
  }
}

function slotIsOccupiedByOtherActiveAd(slot: string) {
  const usage = activeSlotUsage.value[slot]
  if (!usage) return false
  if (adForm.id && usage.adId === adForm.id) return false
  return true
}

async function saveOneAd(tournamentId: string) {
  if (!tournamentId) throw new Error('Missing tournament id')

  const slot = adForm.slot as AdSlotKey
  if (!slot) {
    toast.add({ title: 'Choose a slot', description: 'Select an ad slot.', color: 'error' })
    throw new Error('Missing slot')
  }

  if (!adForm.id && usedSlotsInThisTournament.value.has(slot)) {
    toast.add({
      title: 'Slot already used',
      description: 'This tournament already has an ad for that slot.',
      color: 'error'
    })
    throw new Error('Slot used in tournament')
  }

  if (adForm.enabled && slotIsOccupiedByOtherActiveAd(slot)) {
    toast.add({
      title: 'Slot occupied',
      description: 'That slot is already used by another ACTIVE ad. Choose another slot or deactivate the other one.',
      color: 'error'
    })
    throw new Error('Slot occupied')
  }

  const uploaded = await uploadAdBanner(tournamentId)
  if (uploaded) {
    try {
      if (adForm.banner_path) await supabase.storage.from(ADS_BUCKET).remove([adForm.banner_path])
    } catch {}
    adForm.banner_path = uploaded.path
    adForm.banner_url = uploaded.url
    clearAdSelection()
  }

  if (!adForm.banner_url) {
    toast.add({ title: 'Banner required', description: 'Upload a banner image.', color: 'error' })
    throw new Error('Missing banner')
  }

  const starts_at = toIsoFromLocalOrNull(adForm.starts_local)
  const ends_at = toIsoFromLocalOrNull(adForm.ends_local)
  if (starts_at && ends_at) {
    const s = new Date(starts_at).getTime()
    const e = new Date(ends_at).getTime()
    if (e <= s) {
      toast.add({ title: 'Ad schedule invalid', description: 'Ad ends must be after starts.', color: 'error' })
      throw new Error('Invalid schedule')
    }
  }

  const payload = {
    tournament_id: tournamentId,
    slot,
    ratio: (adForm.ratio || '16/9') as string,
    banner_url: adForm.banner_url || null,
    banner_path: adForm.banner_path || null,
    alt: adForm.alt?.trim() || null,
    starts_at,
    ends_at,
    is_active: Boolean(adForm.enabled)
  }

  if (adForm.id) {
    const { error } = await supabase.from('tournament_ads').update(payload).eq('id', adForm.id)
    if (error) throw error
    toast.add({ title: 'Ad updated', color: 'success' })
  } else {
    const { data, error } = await supabase.from('tournament_ads').insert(payload).select('id').maybeSingle()
    if (error) throw error
    adForm.id = String((data as any)?.id || '')
    toast.add({ title: 'Ad created', color: 'success' })
  }

  await loadAdsForTournament(tournamentId)
  await loadActiveSlotUsage()
}

async function deactivateAd(adId: string) {
  if (!form.id) return
  const { error } = await supabase.from('tournament_ads').update({ is_active: false }).eq('id', adId)
  if (error) throw error
  toast.add({ title: 'Ad deactivated', color: 'success' })
  await loadAdsForTournament(form.id)
  await loadActiveSlotUsage()
}

async function deleteAd(adRow: AdRow) {
  if (!form.id) return
  const ok = confirm('Delete this ad permanently?')
  if (!ok) return

  try {
    if (adRow.banner_path) {
      try {
        await supabase.storage.from(ADS_BUCKET).remove([adRow.banner_path])
      } catch {}
    }
    const { error } = await supabase.from('tournament_ads').delete().eq('id', adRow.id)
    if (error) throw error

    if (adForm.id === adRow.id) resetAdForm()
    toast.add({ title: 'Ad deleted', color: 'success' })
    await loadAdsForTournament(form.id)
    await loadActiveSlotUsage()
  } catch (e: any) {
    toast.add({ title: 'Delete failed', description: e?.message || '', color: 'error' })
  }
}

/* ---------------- API ---------------- */
async function apiList() {
  loading.value = true
  errorMsg.value = null
  try {
    const res = await $fetch<{ rows: TournamentRow[] }>('/api/admin/tournaments/list', {
      credentials: 'include',
      query: {
        q: q.value || undefined,
        status: filterStatus.value || undefined,
        gameSlug: filterGame.value || undefined
      }
    })
    rows.value = (res?.rows || []) as TournamentRow[]
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Failed to load tournaments'
    rows.value = []
  } finally {
    loading.value = false
  }
}

type UpsertOpts = {
  saveOnlyMeta?: boolean
  skipThumbUpload?: boolean
  skipVideoUpload?: boolean
}

async function apiUpsert(opts: UpsertOpts = {}) {
  const saveOnlyMeta = Boolean(opts.saveOnlyMeta)
  const skipThumbUpload = Boolean(opts.skipThumbUpload)
  const skipVideoUpload = Boolean(opts.skipVideoUpload)

  if (timeError.value) {
    toast.add({ title: 'Fix time window', description: timeError.value, color: 'error' })
    return null
  }
  if (!form.title.trim()) {
    toast.add({ title: 'Title required', color: 'error' })
    return null
  }
  if (!form.slug.trim()) {
    toast.add({ title: 'Slug could not be generated', description: 'Change the title', color: 'error' })
    return null
  }
  if (!form.game_slug) {
    toast.add({ title: 'Game required', color: 'error' })
    return null
  }
  if (form.promo_video_type === 'youtube' && !form.promo_video_youtube_id) {
    toast.add({ title: 'YouTube video missing', description: 'Paste and apply a valid YouTube link or video ID.', color: 'error' })
    return null
  }

  const statusToSave: TournamentStatus =
    form.status === 'canceled' ? 'canceled' : computeStatusFromWindow(startsIso.value, endsIso.value, form.status)

  loading.value = true
  errorMsg.value = null

  try {
    const res = await $fetch<{ ok: boolean; tournament: TournamentRow }>('/api/admin/tournaments/upsert', {
      method: 'POST',
      credentials: 'include',
      body: {
        id: form.id || null,
        slug: form.slug.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        game_slug: form.game_slug,
        starts_at: startsIso.value,
        ends_at: endsIso.value,
        status: statusToSave,
        finalized: Boolean(form.finalized),

        thumbnail_url: form.thumbnail_url || null,
        thumbnail_path: form.thumbnail_path || null,

        promo_video_type: form.promo_video_type || null,
        promo_video_url: form.promo_video_url || null,
        promo_video_path: form.promo_video_path || null,
        promo_video_youtube_id: form.promo_video_youtube_id || null,
        promo_video_title: form.promo_video_title.trim() || null
      }
    })

    const t = res?.tournament
    if (!t?.id) throw new Error('Upsert did not return tournament id')

    form.id = t.id
    form.slug = t.slug
    form.thumbnail_url = t.thumbnail_url || form.thumbnail_url
    form.thumbnail_path = t.thumbnail_path || form.thumbnail_path
    form.status = (t.status || statusToSave) as TournamentStatus
    form.finalized = Boolean(t.finalized)

    form.promo_video_type = (t.promo_video_type || form.promo_video_type || '') as PromoVideoType
    form.promo_video_url = t.promo_video_url || form.promo_video_url
    form.promo_video_path = t.promo_video_path || form.promo_video_path
    form.promo_video_youtube_id = t.promo_video_youtube_id || form.promo_video_youtube_id
    form.promo_video_title = t.promo_video_title || form.promo_video_title

    if (!saveOnlyMeta) {
      toast.add({ title: isEditing.value ? 'Tournament saved' : 'Tournament created', color: 'success' })
    }

    if (!skipThumbUpload) {
      try {
        await uploadThumbAndPersist(t.id)
      } catch (e: any) {
        toast.add({ title: 'Saved, but thumbnail upload failed', description: e?.message || 'Try again', color: 'error' })
      }
    }

    if (!skipVideoUpload && videoFile.value && form.promo_video_type === 'upload') {
      try {
        await uploadVideoAndPersist(t.id)
      } catch (e: any) {
        toast.add({ title: 'Saved, but video upload failed', description: e?.message || 'Try again', color: 'error' })
      }
    }

    await apiList()
    selectTournament(t.id)
    return t
  } catch (e: any) {
    toast.add({ title: 'Save failed', description: e?.data?.message || e?.message || 'Try again', color: 'error' })
    return null
  } finally {
    loading.value = false
  }
}

async function apiDelete(id: string) {
  if (!id) return
  const ok = confirm('Delete this tournament? (If winners exist, it will be blocked)')
  if (!ok) return
  loading.value = true
  try {
    await $fetch('/api/admin/tournaments/delete', { method: 'POST', credentials: 'include', body: { id } })
    toast.add({ title: 'Deleted', color: 'success' })
    if (selectedId.value === id) resetForm()
    await apiList()
  } catch (e: any) {
    toast.add({ title: 'Delete failed', description: e?.data?.message || e?.message || '', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function cancelTournament() {
  if (!form.id) return
  const ok = confirm('Cancel this tournament?')
  if (!ok) return
  form.status = 'canceled'
  await apiUpsert()
}
async function uncancelTournament() {
  if (!form.id) return
  const ok = confirm('Uncancel this tournament?')
  if (!ok) return
  form.status = computeStatusFromWindow(startsIso.value, endsIso.value, 'scheduled')
  await apiUpsert()
}

/* ---------------- Winners ---------------- */
const winners = ref<WinnerRow[]>([])
const winnersLoading = ref(false)
const winnersErr = ref<string | null>(null)

function normalizeRewardFields(w: WinnerRow): WinnerRow {
  const rw = { ...w }
  if (rw.reward_status == null || rw.reward_status === '') rw.reward_status = 'pending'
  if (rw.reward_method == null) rw.reward_method = ''
  if (rw.reward_txn_id == null) rw.reward_txn_id = ''
  return rw
}

async function loadWinners() {
  winnersErr.value = null
  winners.value = []
  if (!form.id && !form.slug) return

  winnersLoading.value = true
  try {
    const res = await $fetch<{ rows: WinnerRow[] }>('/api/admin/tournaments/winners', {
      credentials: 'include',
      query: { tournamentId: form.id || undefined, tournamentSlug: form.slug || undefined }
    })
    winners.value = (res?.rows || []).map(normalizeRewardFields) as WinnerRow[]
  } catch (e: any) {
    winnersErr.value = e?.data?.message || e?.message || 'Failed to load winners'
  } finally {
    winnersLoading.value = false
  }
}

async function finalize(force = false) {
  if (!form.id) return
  winnersErr.value = null
  winnersLoading.value = true
  try {
    await $fetch('/api/admin/tournaments/finalize', {
      method: 'POST',
      credentials: 'include',
      body: { tournamentId: form.id, force }
    })
    toast.add({ title: force ? 'Re-finalized' : 'Finalized winners', color: 'success' })
    form.finalized = true
    await apiList()
    await loadWinners()
  } catch (e: any) {
    toast.add({ title: 'Finalize failed', description: e?.data?.message || e?.message || '', color: 'error' })
  } finally {
    winnersLoading.value = false
  }
}

function requiresTxnId(w: WinnerRow) {
  return (w.reward_method || '') === 'online' && (w.reward_status || '') === 'given'
}
function validateWinnerReward(w: WinnerRow) {
  if (requiresTxnId(w) && !String(w.reward_txn_id || '').trim()) {
    return 'Transaction ID is required for online rewards marked as GIVEN.'
  }
  return ''
}

async function updateWinnerReward(row: WinnerRow) {
  const err = validateWinnerReward(row)
  if (err) {
    toast.add({ title: 'Missing info', description: err, color: 'error' })
    return
  }

  try {
    await $fetch('/api/admin/tournaments/winners.update', {
      method: 'POST',
      credentials: 'include',
      body: {
        id: row.id,
        reward_status: row.reward_status ?? 'pending',
        reward_method: row.reward_method ?? '',
        reward_txn_id: String(row.reward_txn_id || '').trim() || null
      }
    })
    toast.add({ title: 'Reward saved', color: 'success' })
    await loadWinners()
  } catch (e: any) {
    toast.add({ title: 'Update failed', description: e?.data?.message || e?.message || '', color: 'error' })
  }
}

/* ---------------- Selection & reset ---------------- */
function resetForm() {
  selectedId.value = null
  form.id = ''
  form.title = ''
  form.slug = ''
  form.description = ''
  form.thumbnail_url = ''
  form.thumbnail_path = ''
  form.game_slug = GAMES[0]?.slug || ''
  form.status = 'scheduled'
  form.finalized = false

  form.promo_video_type = ''
  form.promo_video_url = ''
  form.promo_video_path = ''
  form.promo_video_youtube_id = ''
  form.promo_video_title = ''
  youtubeInput.value = ''
  clearVideoSelection()

  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  form.starts_local = toLocalInputValue(d.toISOString())
  d.setHours(d.getHours() + 2)
  form.ends_local = toLocalInputValue(d.toISOString())

  winners.value = []
  winnersErr.value = null
  setThumbFile(null)

  prizeMaps.value = []

  ads.value = []
  activeSlotUsage.value = {}
  resetAdForm()
}

async function selectTournament(id: string) {
  selectedId.value = id
  const t = rows.value.find(r => r.id === id)
  if (!t) return

  form.id = t.id
  form.slug = t.slug
  form.title = t.title
  form.description = t.description || ''
  form.game_slug = t.game_slug

  form.starts_local = toLocalInputValue(t.starts_at)
  form.ends_local = toLocalInputValue(t.ends_at)

  form.thumbnail_url = t.thumbnail_url || ''
  form.thumbnail_path = t.thumbnail_path || ''

  form.promo_video_type = (t.promo_video_type || '') as PromoVideoType
  form.promo_video_url = t.promo_video_url || ''
  form.promo_video_path = t.promo_video_path || ''
  form.promo_video_youtube_id = t.promo_video_youtube_id || ''
  form.promo_video_title = t.promo_video_title || ''
  youtubeInput.value = form.promo_video_youtube_id || ''

  form.status = (t.status || 'scheduled') as TournamentStatus
  form.finalized = Boolean(t.finalized)

  setThumbFile(null)
  clearVideoSelection()

  await Promise.allSettled([
    loadWinners(),
    loadPrizeCatalog(),
    loadPrizeMapsForTournament(t.id),
    loadAdsForTournament(t.id)
  ])

  resetAdForm()
}

/* ---------------- Debounced reload ---------------- */
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: any = null
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}
const reloadDebounced = debounce(() => apiList().catch(() => {}), 250)
watch([q, filterStatus, filterGame], () => reloadDebounced())

function badgeClass(s: string) {
  if (s === 'live') return 'bg-emerald-500/15 border-emerald-400/20 text-emerald-300'
  if (s === 'scheduled') return 'bg-violet-500/15 border-violet-400/20 text-violet-300'
  if (s === 'ended') return 'bg-white/10 border-white/10 text-white/70'
  if (s === 'canceled') return 'bg-red-500/10 border-red-500/20 text-red-200'
  return 'bg-white/10 border-white/10 text-white/70'
}

onMounted(async () => {
  resetForm()
  await Promise.allSettled([apiList(), loadPrizeCatalog()])
})
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[380px_1fr]">
    <!-- LEFT: LIST PANEL -->
    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">
      <div class="p-4 border-b border-black/10 dark:border-white/10">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs opacity-70">Admin</div>
            <div class="text-lg font-extrabold tracking-tight">Tournaments</div>
          </div>
          <div class="flex gap-2">
            <UButton size="xs" variant="soft" class="!rounded-full" :loading="loading" @click="apiList()">Refresh</UButton>
            <UButton size="xs" class="!rounded-full" @click="resetForm()">New</UButton>
          </div>
        </div>

        <div class="mt-3 space-y-2">
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
            <input v-model="q" class="w-full bg-transparent text-sm outline-none" placeholder="Search title / slug…" />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
              <div class="text-[11px] opacity-70">Status</div>
              <select v-model="filterStatus" class="w-full bg-transparent text-sm outline-none">
                <option value="">All</option>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
              <div class="text-[11px] opacity-70">Game</div>
              <select v-model="filterGame" class="w-full bg-transparent text-sm outline-none">
                <option value="">All</option>
                <option v-for="g in GAMES" :key="g.slug" :value="g.slug">{{ g.name }}</option>
              </select>
            </div>
          </div>

          <div v-if="errorMsg" class="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
            {{ errorMsg }}
          </div>
        </div>
      </div>

      <div class="max-h-[calc(100vh-220px)] overflow-auto divide-y divide-black/10 dark:divide-white/10">
        <button
          v-for="r in rows"
          :key="r.id"
          class="w-full text-left p-4 hover:bg-black/5 dark:hover:bg-white/5 transition"
          :class="selectedId === r.id ? 'bg-black/5 dark:bg-white/5' : ''"
          @click="selectTournament(r.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-semibold truncate">{{ r.title }}</div>
              <div class="mt-1 text-xs opacity-70 truncate">
                <span class="font-mono">{{ r.slug }}</span> • {{ r.game_slug }}
              </div>
              <div class="mt-2 text-xs opacity-70">{{ fmt(r.starts_at) }} → {{ fmt(r.ends_at) }}</div>
            </div>
            <div class="shrink-0 flex flex-col items-end gap-2">
              <span class="px-2 py-1 rounded-full border text-[11px]" :class="badgeClass(r.status)">
                {{ String(r.status || 'scheduled').toUpperCase() }}
              </span>
              <span
                v-if="r.finalized"
                class="px-2 py-1 rounded-full border border-amber-400/20 bg-amber-500/10 text-amber-200 text-[11px]"
              >
                FINALIZED
              </span>
            </div>
          </div>
        </button>

        <div v-if="!loading && rows.length === 0" class="p-6 text-sm opacity-70">No tournaments found.</div>
      </div>
    </div>

    <!-- RIGHT: EDITOR PANEL -->
    <div class="space-y-4">
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-xs opacity-70">Editor</div>
            <div class="text-2xl font-extrabold tracking-tight">
              {{ isEditing ? 'Edit Tournament' : 'Create Tournament' }}
            </div>
            <div class="mt-1 text-sm opacity-70" v-if="form.slug">
              Slug: <span class="font-mono opacity-100">{{ form.slug }}</span>
              <span v-if="form.id" class="opacity-60"> • ID: <span class="font-mono">{{ form.id.slice(0, 8) }}…</span></span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="px-2 py-1 rounded-full border text-xs" :class="badgeClass(derivedStatus)">
              {{ String(derivedStatus).toUpperCase() }}
            </span>
            <span
              v-if="form.finalized"
              class="px-2 py-1 rounded-full border border-amber-400/20 bg-amber-500/10 text-amber-200 text-xs"
            >
              FINALIZED
            </span>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            class="px-4 py-2 rounded-full border text-sm transition"
            :class="tab === 'details' ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'bg-white/5 border-white/10 hover:bg-white/10'"
            @click="tab = 'details'"
          >
            Details
          </button>
          <button
            class="px-4 py-2 rounded-full border text-sm transition"
            :class="tab === 'schedule' ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'bg-white/5 border-white/10 hover:bg-white/10'"
            @click="tab = 'schedule'"
          >
            Schedule
          </button>
          <button
            class="px-4 py-2 rounded-full border text-sm transition"
            :class="tab === 'ads' ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'bg-white/5 border-white/10 hover:bg-white/10'"
            @click="tab = 'ads'"
          >
            Ads
          </button>
          <button
            class="px-4 py-2 rounded-full border text-sm transition"
            :class="tab === 'winners' ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'bg-white/5 border-white/10 hover:bg-white/10'"
            @click="tab = 'winners'"
          >
            Winners
          </button>

          <div class="flex-1" />

          <UButton class="!rounded-full" :loading="loading || thumbUploading || adUploading || prizeMapSaving || videoUploading" @click="apiUpsert()">
            {{ isEditing ? 'Save' : 'Create' }}
          </UButton>

          <UButton v-if="form.slug" variant="soft" class="!rounded-full" :to="`/tournaments/${form.slug}`">
            Open
          </UButton>

          <UButton v-if="form.id && !isCanceled" color="error" variant="soft" class="!rounded-full" :loading="loading" @click="cancelTournament">
            Cancel
          </UButton>
          <UButton v-if="form.id && isCanceled" variant="soft" class="!rounded-full" :loading="loading" @click="uncancelTournament">
            Uncancel
          </UButton>

          <UButton v-if="form.id" color="error" variant="soft" class="!rounded-full" :loading="loading" @click="apiDelete(form.id)">
            Delete
          </UButton>
        </div>
      </div>

      <!-- DETAILS TAB -->
      <div v-if="tab === 'details'" class="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <div class="font-semibold">Tournament Details</div>

          <div class="mt-4 grid gap-3">
            <div class="grid gap-2">
              <label class="text-xs opacity-70">Title</label>
              <input
                v-model="form.title"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
              />
              <div class="text-xs opacity-60">Slug auto-generates from title (new tournaments only).</div>
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Game</label>
              <select
                v-model="form.game_slug"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
              >
                <option v-for="g in GAMES" :key="g.slug" :value="g.slug">{{ g.name }}</option>
              </select>
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Description</label>
              <textarea
                v-model="form.description"
                rows="4"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
              />
            </div>

            <!-- Promo Video -->
            <div class="mt-2 rounded-3xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div>
                <div class="font-semibold">Promo Video</div>
                <div class="text-xs opacity-70">Upload a hosted video or attach a YouTube video.</div>
              </div>

              <div class="mt-4 space-y-4">
                <div class="grid gap-2">
                  <label class="text-xs opacity-70">Video type</label>
                  <select
                    :value="form.promo_video_type"
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                    @change="onVideoTypeChange(($event.target as HTMLSelectElement).value as PromoVideoType)"
                  >
                    <option value="">None</option>
                    <option value="upload">Upload video</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </div>

                <div class="grid gap-2">
                  <label class="text-xs opacity-70">Video title (optional)</label>
                  <input
                    v-model="form.promo_video_title"
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                    placeholder="e.g. Tournament trailer"
                  />
                </div>

                <div v-if="form.promo_video_type === 'upload'" class="space-y-3">
                  <div class="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                    <div class="aspect-video bg-black grid place-items-center">
                      <video
                        v-if="effectiveVideoUrl"
                        :src="effectiveVideoUrl"
                        controls
                        playsinline
                        preload="metadata"
                        class="h-full w-full"
                      />
                      <div v-else class="text-xs opacity-60">No video selected</div>
                    </div>
                  </div>

                  <div v-if="videoFile" class="text-xs opacity-70">Selected: <span class="font-mono">{{ videoFile.name }}</span></div>

                  <input ref="videoInputEl" type="file" accept="video/*" @change="onVideoPick" />

                  <div class="flex flex-wrap gap-2">
                    <UButton class="!rounded-full" :disabled="!form.id || !videoFile" :loading="videoUploading" @click="uploadVideoAndPersist(form.id)">
                      Upload Video
                    </UButton>

                    <UButton variant="soft" class="!rounded-full" :disabled="!videoFile" @click="clearVideoSelection">
                      Clear Selection
                    </UButton>

                    <UButton v-if="form.promo_video_url" color="error" variant="soft" class="!rounded-full" @click="clearStoredVideo">
                      Remove Stored Video
                    </UButton>
                  </div>

                  <div v-if="form.promo_video_url" class="text-xs opacity-60 break-all">{{ form.promo_video_url }}</div>
                </div>

                <div v-if="form.promo_video_type === 'youtube'" class="space-y-3">
                  <div class="grid gap-2">
                    <label class="text-xs opacity-70">YouTube URL or Video ID</label>
                    <div class="flex gap-2">
                      <input
                        v-model="youtubeInput"
                        class="flex-1 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                      <UButton class="!rounded-full" @click="applyYoutubeInput">Apply</UButton>
                    </div>
                    <div class="text-xs opacity-60">Paste a full YouTube link or 11-character video ID.</div>
                  </div>

                  <div class="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                    <div class="aspect-video bg-black grid place-items-center">
                      <iframe
                        v-if="effectiveYoutubeEmbedUrl"
                        :src="effectiveYoutubeEmbedUrl"
                        title="YouTube preview"
                        class="h-full w-full"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowfullscreen
                      />
                      <div v-else class="text-xs opacity-60">No YouTube video selected</div>
                    </div>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <UButton v-if="form.promo_video_youtube_id" color="error" variant="soft" class="!rounded-full" @click="clearStoredVideo">
                      Clear YouTube Video
                    </UButton>
                  </div>
                </div>
              </div>
            </div>

            <!-- Prize selection -->
            <div class="mt-2 rounded-3xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="font-semibold">Tournament Prizes</div>
                  <div class="text-xs opacity-70">Select prizes from the global prize catalog.</div>
                </div>

                <div class="flex gap-2">
                  <UButton variant="soft" class="!rounded-full" :disabled="!form.id" @click="addPrizeMap()">
                    Add Prize Slot
                  </UButton>
                  <UButton variant="soft" class="!rounded-full" :loading="prizeCatalogLoading" @click="loadPrizeCatalog()">
                    Refresh Catalog
                  </UButton>
                  <UButton class="!rounded-full" :disabled="!form.id" :loading="prizeMapSaving" @click="savePrizeMaps(form.id)">
                    Save Prize Selection
                  </UButton>
                </div>
              </div>

              <div v-if="!form.id" class="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
                Create/save the tournament first to assign prizes.
              </div>

              <div v-else class="mt-4">
                <div v-if="prizeCatalogLoading || prizeMapLoading" class="text-sm opacity-70">Loading prize data…</div>

                <div v-else-if="selectablePrizeOptions.length === 0" class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
                  No prize catalog items found. Create prizes from the separate admin prize page first.
                </div>

                <div v-else-if="prizeMaps.length === 0" class="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm opacity-80">
                  No prizes selected for this tournament yet.
                </div>

                <div v-else class="space-y-4">
                  <div
                    v-for="(row, i) in prizeMaps"
                    :key="row.id || `map-${i}`"
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 p-4"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div class="font-semibold">{{ ordinal(row.rank) }} Prize</div>

                      <div class="flex gap-2">
                        <UButton size="xs" variant="soft" class="!rounded-full" :disabled="i === 0" @click="movePrizeMapUp(i)">Up</UButton>
                        <UButton size="xs" variant="soft" class="!rounded-full" :disabled="i === prizeMaps.length - 1" @click="movePrizeMapDown(i)">Down</UButton>
                        <UButton size="xs" color="error" variant="soft" class="!rounded-full" @click="removePrizeMap(i)">Remove</UButton>
                      </div>
                    </div>

                    <div class="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
                      <div class="space-y-3">
                        <div class="grid gap-2">
                          <label class="text-xs opacity-70">Select prize</label>
                          <select
                            v-model="row.prize_id"
                            class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                          >
                            <option value="">(choose prize)</option>
                            <option v-for="p in selectablePrizeOptions" :key="p.id" :value="p.id">
                              {{ p.title }}
                            </option>
                          </select>
                        </div>

                        <div v-if="prizeById(row.prize_id)" class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
                          <div class="text-sm font-semibold">{{ prizeById(row.prize_id)?.title }}</div>
                          <div v-if="prizeById(row.prize_id)?.description" class="mt-1 text-xs opacity-70">
                            {{ prizeById(row.prize_id)?.description }}
                          </div>
                        </div>
                      </div>

                      <div class="space-y-3">
                        <div class="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                          <div class="aspect-square bg-black/20 grid place-items-center">
                            <img
                              v-if="prizeById(row.prize_id)?.image_url"
                              :src="prizeById(row.prize_id)?.image_url || ''"
                              class="h-full w-full object-cover"
                              alt="Prize preview"
                            />
                            <div v-else class="text-xs opacity-60">No image</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flex justify-end">
                    <UButton class="!rounded-full" :loading="prizeMapSaving" @click="savePrizeMaps(form.id)">
                      Save Prize Selection
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT -->
        <div class="space-y-4">
          <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <div class="flex items-start justify-between">
              <div>
                <div class="font-semibold">Thumbnail</div>
                <div class="text-xs opacity-70">Upload on Save/Create</div>
              </div>
              <div class="text-xs opacity-70" v-if="thumbUploading">Uploading…</div>
            </div>

            <div class="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <div class="aspect-[16/10] bg-black/20 grid place-items-center">
                <img
                  v-if="effectiveThumbUrl"
                  :key="effectiveThumbUrl"
                  :src="effectiveThumbUrl"
                  class="h-full w-full object-cover"
                  alt="Tournament thumbnail preview"
                />
                <div v-else class="text-xs opacity-60">No image</div>
              </div>
            </div>

            <div v-if="thumbFile" class="mt-2 text-xs opacity-70">
              Selected: <span class="font-mono">{{ thumbFile.name }}</span>
            </div>

            <div class="mt-4 space-y-3">
              <input ref="thumbInputEl" type="file" accept="image/*" @change="onThumbPick" />
              <div class="flex flex-wrap gap-2">
                <UButton variant="soft" class="!rounded-full" :disabled="!thumbFile" @click="clearThumbSelection">Clear</UButton>
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <div class="font-semibold">Video Summary</div>
            <div class="mt-1 text-xs opacity-70">Current selected video source.</div>

            <div class="mt-4 grid gap-3">
              <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
                <div class="text-xs opacity-70">Type</div>
                <div class="mt-1 font-medium">{{ form.promo_video_type || 'None' }}</div>
              </div>

              <div v-if="form.promo_video_type === 'youtube' && form.promo_video_youtube_id" class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
                <div class="text-xs opacity-70">YouTube ID</div>
                <div class="mt-1 font-mono text-sm break-all">{{ form.promo_video_youtube_id }}</div>
              </div>

              <div v-if="form.promo_video_type === 'upload' && form.promo_video_url" class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
                <div class="text-xs opacity-70">Hosted URL</div>
                <div class="mt-1 font-mono text-xs break-all">{{ form.promo_video_url }}</div>
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <div class="font-semibold">Prize Summary</div>
            <div class="mt-1 text-xs opacity-70">Selected rewards for this tournament.</div>

            <div class="mt-4 space-y-3">
              <div
                v-for="row in prizeMaps"
                :key="row.id || `summary-${row.rank}`"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3"
              >
                <div class="text-xs opacity-70">{{ ordinal(row.rank) }} Prize</div>
                <div class="mt-1 text-sm font-semibold">{{ prizeById(row.prize_id)?.title || 'Not selected' }}</div>
              </div>

              <div v-if="!prizeMaps.length" class="text-sm opacity-70">No prize selected.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- SCHEDULE TAB -->
      <div
        v-else-if="tab === 'schedule'"
        class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-semibold">Schedule</div>
            <div class="text-xs opacity-70">Status is derived from time (scheduled → live → ended). Only canceled is manual.</div>
          </div>

          <span class="px-3 py-1.5 rounded-full border text-xs" :class="badgeClass(derivedStatus)">
            {{ String(derivedStatus).toUpperCase() }}
          </span>
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="grid gap-2">
            <label class="text-xs opacity-70">Starts (Dhaka)</label>
            <input
              v-model="form.starts_local"
              type="datetime-local"
              class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
            />
            <div class="text-xs opacity-60">UTC: <span class="font-mono">{{ startsIso }}</span></div>
          </div>

          <div class="grid gap-2">
            <label class="text-xs opacity-70">Ends (Dhaka)</label>
            <input
              v-model="form.ends_local"
              type="datetime-local"
              class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
            />
            <div class="text-xs opacity-60">UTC: <span class="font-mono">{{ endsIso }}</span></div>
          </div>
        </div>

        <div v-if="timeError" class="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
          {{ timeError }}
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
            <div class="text-xs opacity-70">Starts in</div>
            <div class="mt-1 font-mono text-lg">{{ msToClock(startsIn) }}</div>
          </div>
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
            <div class="text-xs opacity-70">Ends in</div>
            <div class="mt-1 font-mono text-lg">{{ msToClock(endsIn) }}</div>
          </div>
        </div>
      </div>

      <!-- ADS TAB -->
      <div v-else-if="tab === 'ads'" class="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold">Tournament Ads</div>
              <div class="text-xs opacity-70">Multiple ads per tournament (different slots). Only one ACTIVE ad per slot globally.</div>
            </div>
            <div class="text-xs opacity-70" v-if="adLoading">Loading…</div>
          </div>

          <div v-if="!form.id" class="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
            Create/save the tournament first to add ads.
          </div>

          <div v-else class="mt-4">
            <div class="flex flex-wrap gap-2">
              <UButton variant="soft" class="!rounded-full" :loading="adLoading" @click="loadAdsForTournament(form.id)">Refresh</UButton>
              <UButton class="!rounded-full" @click="(async () => { resetAdForm(); await loadActiveSlotUsage() })()">New Ad</UButton>
            </div>

            <div class="mt-4 space-y-3">
              <div v-if="ads.length === 0" class="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm opacity-80">
                No ads for this tournament yet.
              </div>

              <button
                v-for="a in ads"
                :key="a.id"
                class="w-full text-left rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
                :class="adForm.id === a.id ? 'ring-2 ring-emerald-400/30' : ''"
                @click="pickAdForEdit(a)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="font-semibold truncate">{{ AD_SLOTS.find(s => s.key === a.slot)?.label || a.slot }}</div>
                    <div class="mt-1 text-xs opacity-70">Ratio: <span class="font-mono opacity-100">{{ (a as any).ratio || '16/9' }}</span></div>
                    <div class="mt-1 text-xs opacity-70">{{ a.starts_at ? fmt(a.starts_at) : 'No start' }} → {{ a.ends_at ? fmt(a.ends_at) : 'No end' }}</div>
                    <div class="mt-1 text-xs opacity-60 truncate" v-if="a.alt">Alt: {{ a.alt }}</div>
                  </div>

                  <div class="shrink-0 flex flex-col items-end gap-2">
                    <span
                      class="px-2 py-1 rounded-full border text-[11px]"
                      :class="a.is_active ? 'bg-emerald-500/15 border-emerald-400/20 text-emerald-300' : 'bg-white/10 border-white/10 text-white/70'"
                    >
                      {{ a.is_active ? 'ACTIVE' : 'INACTIVE' }}
                    </span>
                    <span class="text-[11px] opacity-60">{{ a.id.slice(0, 8) }}…</span>
                  </div>
                </div>
              </button>
            </div>

            <div class="mt-6 rounded-2xl border border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="font-semibold">{{ adForm.id ? 'Edit Ad' : 'Create New Ad' }}</div>
                <div class="flex gap-2">
                  <UButton
                    variant="soft"
                    class="!rounded-full"
                    :disabled="!adForm.id"
                    @click="(async () => { const row = ads.find(x => x.id === adForm.id); if (!row) return; await deactivateAd(row.id) })()"
                  >
                    Deactivate
                  </UButton>

                  <UButton
                    color="error"
                    variant="soft"
                    class="!rounded-full"
                    :disabled="!adForm.id"
                    @click="(async () => { const row = ads.find(x => x.id === adForm.id); if (!row) return; await deleteAd(row) })()"
                  >
                    Delete
                  </UButton>
                </div>
              </div>

              <div class="mt-4 space-y-4">
                <label class="flex items-center gap-3">
                  <input type="checkbox" v-model="adForm.enabled" :disabled="!form.id" />
                  <span class="text-sm font-semibold">Active</span>
                </label>

                <div v-if="noVacantSlotsForNewAd" class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
                  No slots available. (All are occupied globally or already used in this tournament.)
                </div>

                <div class="grid gap-2">
                  <label class="text-xs opacity-70">Slot</label>
                  <select
                    v-model="adForm.slot"
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                    :disabled="!form.id"
                  >
                    <option value="">(choose)</option>
                    <option v-for="s in selectableSlots" :key="s.key" :value="s.key">{{ s.label }}</option>
                  </select>
                </div>

                <div class="grid gap-2">
                  <label class="text-xs opacity-70">Banner ratio</label>
                  <select
                    v-model="adForm.ratio"
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                    :disabled="!form.id"
                  >
                    <option v-for="r in AD_RATIOS" :key="r.key" :value="r.key">{{ r.label }}</option>
                  </select>
                </div>

                <div class="grid gap-2">
                  <label class="text-xs opacity-70">Alt text (optional)</label>
                  <input
                    v-model="adForm.alt"
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                    placeholder="Tournament banner"
                  />
                </div>

                <div class="grid gap-3 md:grid-cols-2">
                  <div class="grid gap-2">
                    <label class="text-xs opacity-70">Ad starts (optional)</label>
                    <input
                      v-model="adForm.starts_local"
                      type="datetime-local"
                      class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                    />
                  </div>
                  <div class="grid gap-2">
                    <label class="text-xs opacity-70">Ad ends (optional)</label>
                    <input
                      v-model="adForm.ends_local"
                      type="datetime-local"
                      class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                    />
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  <UButton
                    class="!rounded-full"
                    :disabled="!form.id || (!adForm.id && noVacantSlotsForNewAd)"
                    :loading="adUploading"
                    @click="(async () => { if (!form.id) return; await saveOneAd(form.id) })()"
                  >
                    {{ adForm.id ? 'Save Changes' : 'Create Ad' }}
                  </UButton>

                  <UButton variant="soft" class="!rounded-full" @click="resetAdForm()">Clear Form</UButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <div class="flex items-start justify-between">
            <div>
              <div class="font-semibold">Banner</div>
              <div class="text-xs opacity-70">Upload & preview</div>
            </div>
            <div class="text-xs opacity-70" v-if="adUploading">Uploading…</div>
          </div>

          <div class="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <div class="bg-black/20 grid place-items-center" :class="previewRatioClass">
              <img
                v-if="effectiveAdImg"
                :key="effectiveAdImg"
                :src="effectiveAdImg"
                class="h-full w-full object-cover"
                alt="Ad banner preview"
              />
              <div v-else class="text-xs opacity-60">No banner</div>
            </div>
          </div>

          <div v-if="adFile" class="mt-2 text-xs opacity-70">Selected: <span class="font-mono">{{ adFile.name }}</span></div>

          <div class="mt-4 space-y-3">
            <input ref="adInputEl" type="file" accept="image/*" @change="onAdPick" :disabled="!form.id" />
            <div class="flex flex-wrap gap-2">
              <UButton variant="soft" class="!rounded-full" :disabled="!adFile" @click="clearAdSelection">Clear</UButton>
            </div>
          </div>
        </div>
      </div>

      <!-- WINNERS TAB -->
      <div v-else class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="font-semibold">Winners & Rewards</div>
            <div class="text-xs opacity-70">Finalize winners after end. Online + GIVEN requires transaction id.</div>
          </div>

          <div class="flex items-center gap-2">
            <UButton variant="soft" size="xs" class="!rounded-full" :loading="winnersLoading" :disabled="!form.id && !form.slug" @click="loadWinners()">
              Refresh
            </UButton>
            <UButton size="xs" class="!rounded-full" :disabled="!form.id" :loading="winnersLoading" @click="finalize(false)">
              Finalize
            </UButton>
            <UButton variant="soft" size="xs" class="!rounded-full" :disabled="!form.id" :loading="winnersLoading" @click="finalize(true)">
              Re-Finalize
            </UButton>
          </div>
        </div>

        <div v-if="!form.id" class="mt-4 text-sm opacity-70">Select a tournament first.</div>

        <div v-else>
          <div v-if="winnersErr" class="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
            {{ winnersErr }}
          </div>

          <div v-if="winnersLoading" class="mt-4 text-sm opacity-70">Loading…</div>

          <div v-else-if="winners.length === 0" class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm opacity-80">
            No winners yet. Finalize after the tournament is ended.
          </div>

          <div v-else class="mt-4 space-y-3">
            <div v-for="w in winners" :key="w.id" class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="font-semibold">#{{ w.rank }} — {{ w.player_name || 'Unknown' }}</div>
                  <div class="mt-1 text-xs opacity-70">
                    Score: <b class="opacity-100">{{ w.score }}</b>
                    <span class="opacity-40">•</span>
                    Prize: <b class="opacity-100">{{ w.prize || w.prize_label || '—' }}</b>
                  </div>
                </div>

                <span
                  class="px-2 py-1 rounded-full border text-[11px]"
                  :class="(w.reward_status || 'pending') === 'given'
                    ? 'bg-emerald-500/15 border-emerald-400/20 text-emerald-300'
                    : 'bg-white/10 border-white/10 text-white/70'"
                >
                  {{ String(w.reward_status || 'pending').toUpperCase() }}
                </span>
              </div>

              <div class="mt-4 grid gap-2 md:grid-cols-3 items-end">
                <div class="grid gap-1">
                  <label class="text-[11px] opacity-70">Reward Status</label>
                  <select v-model="w.reward_status" class="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-sm outline-none">
                    <option value="pending">pending</option>
                    <option value="given">given</option>
                  </select>
                </div>

                <div class="grid gap-1">
                  <label class="text-[11px] opacity-70">Method</label>
                  <select v-model="w.reward_method" class="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-sm outline-none">
                    <option value="">(select)</option>
                    <option value="online">online</option>
                    <option value="offline">offline</option>
                  </select>
                </div>

                <div class="grid gap-1">
                  <label class="text-[11px] opacity-70">Transaction ID (online + given)</label>
                  <input
                    v-model="w.reward_txn_id"
                    class="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-sm outline-none"
                    :placeholder="requiresTxnId(w) ? 'Required' : 'Optional'"
                  />
                  <div v-if="requiresTxnId(w) && !(w.reward_txn_id || '').trim()" class="text-[11px] text-red-300">
                    Required for online rewards marked as GIVEN.
                  </div>
                </div>
              </div>

              <div class="mt-3 flex justify-end">
                <UButton size="xs" class="!rounded-full" @click="updateWinnerReward(w)">Save</UButton>
              </div>
            </div>
          </div>
        </div>

        <div v-if="form.id && !isEnded" class="mt-4 text-xs opacity-60">
          Tip: This tournament is not ended yet ({{ String(derivedStatus).toUpperCase() }}). Finalize works after end.
        </div>
      </div>
    </div>
  </div>
</template>