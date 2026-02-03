<!-- app/pages/admin/tournaments.vue -->
<script setup lang="ts">
import { GAMES } from '@/data/games'

/** ✅ Ad slots list */
const AD_SLOTS = [
  { key: 'home_top', label: 'Home — Top Banner' },
  { key: 'home_mid', label: 'Home — Middle Banner' },
  { key: 'home_bottom', label: 'Home — Bottom Banner' },
  { key: 'tournaments_top', label: 'Tournaments — Top Banner' },
  { key: 'arcade_sidebar', label: 'Arcade — Sidebar Banner' }
] as const
type AdSlotKey = typeof AD_SLOTS[number]['key']

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Tournaments' })

const toast = useToast()
const supabase = useSupabaseClient()

/* ---------------- Types ---------------- */
type TournamentStatus = 'scheduled' | 'live' | 'ended' | 'canceled' | string

type TournamentRow = {
  id: string
  slug: string
  title: string
  description: string | null
  game_slug: string
  starts_at: string
  ends_at: string
  status: TournamentStatus
  prize_1?: string | null
  prize_2?: string | null
  prize_3?: string | null
  finalized: boolean
  thumbnail_url?: string | null
  thumbnail_path?: string | null
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
  prize?: string | null
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
  banner_url: string | null
  banner_path: string | null
  alt: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at?: string
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

  prize_1: '' as string,
  prize_2: '' as string,
  prize_3: '' as string,

  status: 'scheduled' as TournamentStatus,
  finalized: false as boolean,

  thumbnail_url: '' as string,
  thumbnail_path: '' as string
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

const now = ref(Date.now())
let ticker: any = null
onMounted(() => (ticker = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => ticker && clearInterval(ticker))

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

/* ---------------- Thumbnail (kept as-is) ---------------- */
const THUMB_BUCKET = 'tournament-thumbnails'
const thumbUploading = ref(false)
const thumbFile = ref<File | null>(null)
const thumbPreview = ref<string>('')

function setThumbFile(file: File | null) {
  if (thumbPreview.value) URL.revokeObjectURL(thumbPreview.value)
  thumbPreview.value = ''
  thumbFile.value = file
  if (file) thumbPreview.value = URL.createObjectURL(file)
}
function onThumbPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0] || null
  setThumbFile(file)
}
const effectiveThumbUrl = computed(() => {
  if (thumbPreview.value) return thumbPreview.value
  if (form.thumbnail_url) return form.thumbnail_url
  return ''
})
function clearThumbSelection() {
  setThumbFile(null)
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

    await apiUpsert({ saveOnlyMeta: true, skipThumbUpload: true })

    setThumbFile(null)
    toast.add({ title: 'Thumbnail saved', color: 'success' })
  } finally {
    thumbUploading.value = false
  }
}

/* ---------------- Ads (MULTI ADS per tournament) ---------------- */
const ADS_BUCKET = 'tournament-banners'

const adLoading = ref(false)
const ads = ref<AdRow[]>([]) // ✅ all ads of selected tournament

// For slot availability (global active ads)
const slotOwners = ref<Record<string, string>>({}) // slot -> tournament_id (for ACTIVE only)

const adForm = reactive({
  id: '' as string, // ✅ important: id means edit existing ad
  enabled: false as boolean,
  slot: '' as AdSlotKey | '',
  alt: '' as string,
  starts_local: '' as string,
  ends_local: '' as string,
  banner_url: '' as string,
  banner_path: '' as string
})

const adFile = ref<File | null>(null)
const adPreview = ref<string>('')
const adUploading = ref(false)

function setAdFile(file: File | null) {
  if (adPreview.value) URL.revokeObjectURL(adPreview.value)
  adPreview.value = ''
  adFile.value = file
  if (file) adPreview.value = URL.createObjectURL(file)
}
function onAdPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0] || null
  setAdFile(file)
}
const effectiveAdImg = computed(() => adPreview.value || adForm.banner_url || '')
function clearAdSelection() {
  setAdFile(null)
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
  adForm.alt = row.alt || ''
  adForm.banner_url = row.banner_url || ''
  adForm.banner_path = row.banner_path || ''
  adForm.starts_local = row.starts_at ? toLocalInputValue(row.starts_at) : ''
  adForm.ends_local = row.ends_at ? toLocalInputValue(row.ends_at) : ''
  clearAdSelection()
}

async function loadSlotOwners() {
  // all ACTIVE ads across site -> who owns each slot
  const { data, error } = await supabase.from('tournament_ads').select('slot, tournament_id').eq('is_active', true)
  if (error) throw error

  const map: Record<string, string> = {}
  for (const r of data || []) {
    const slot = String((r as any).slot || '')
    const tid = String((r as any).tournament_id || '')
    if (slot && tid) map[slot] = tid
  }
  slotOwners.value = map
}

async function loadAdsForTournament(tournamentId: string) {
  adLoading.value = true
  try {
    await loadSlotOwners()
    const { data, error } = await supabase
      .from('tournament_ads')
      .select('id, tournament_id, slot, banner_url, banner_path, alt, is_active, starts_at, ends_at, created_at')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })

    if (error) throw error

    ads.value = (data || []) as any
    // if currently editing an ad that no longer exists, reset
    if (adForm.id && !ads.value.some(a => a.id === adForm.id)) resetAdForm()
  } catch (e: any) {
    toast.add({ title: 'Failed to load ads', description: e?.message || 'Try again', color: 'error' })
    ads.value = []
  } finally {
    adLoading.value = false
  }
}

/**
 * ✅ Slot dropdown rule:
 * - When creating a NEW ad (adForm.id is empty), hide occupied slots (owned by other tournaments).
 * - When editing an existing ad, always include its current slot so it remains selectable.
 */
const selectableSlots = computed(() => {
  const myTid = form.id || ''
  const currentSlot = String(adForm.slot || '')
  const isEditingAd = Boolean(adForm.id)

  return AD_SLOTS.filter((s) => {
    const owner = slotOwners.value[s.key]
    const isTakenByOther = Boolean(owner && owner !== myTid)

    // new ad => hide anything taken by other tournament
    if (!isEditingAd) return !isTakenByOther

    // editing => allow current slot even if something weird happened
    if (s.key === currentSlot) return true

    // otherwise same rule: hide if taken by others
    return !isTakenByOther
  })
})

const noVacantSlotsForNewAd = computed(() => {
  const myTid = form.id || ''
  const isEditingAd = Boolean(adForm.id)
  if (isEditingAd) return false
  return AD_SLOTS.every((s) => {
    const owner = slotOwners.value[s.key]
    return Boolean(owner && owner !== myTid)
  })
})

/** Upload ad banner to storage and return {path, url} */
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

function slotIsTakenByOther(slot: string, tournamentId: string) {
  const owner = slotOwners.value[slot]
  return owner && owner !== tournamentId
}

/** Create or Update ONE ad row (multi ads supported) */
async function saveOneAd(tournamentId: string) {
  if (!tournamentId) throw new Error('Missing tournament id')

  const slot = adForm.slot as AdSlotKey
  if (!slot) {
    toast.add({ title: 'Choose a slot', description: 'Select an ad slot.', color: 'error' })
    throw new Error('Missing slot')
  }

  // if enabling => slot must not be occupied by another tournament
  if (adForm.enabled && slotIsTakenByOther(slot, tournamentId)) {
    toast.add({
      title: 'Slot occupied',
      description: 'That slot is already used by another tournament (active). Choose another slot.',
      color: 'error'
    })
    throw new Error('Slot occupied')
  }

  // Upload if new file chosen
  const uploaded = await uploadAdBanner(tournamentId)
  if (uploaded) {
    // remove old file if present
    try {
      if (adForm.banner_path) await supabase.storage.from(ADS_BUCKET).remove([adForm.banner_path])
    } catch {}
    adForm.banner_path = uploaded.path
    adForm.banner_url = uploaded.url
    clearAdSelection()
  }

  // Require banner url
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
    banner_url: adForm.banner_url || null,
    banner_path: adForm.banner_path || null,
    alt: adForm.alt?.trim() || null,
    starts_at,
    ends_at,
    is_active: Boolean(adForm.enabled)
  }

  // update existing
  if (adForm.id) {
    const { error } = await supabase.from('tournament_ads').update(payload).eq('id', adForm.id)
    if (error) throw error
    toast.add({ title: 'Ad updated', color: 'success' })
  } else {
    // insert new
    const { data, error } = await supabase.from('tournament_ads').insert(payload).select('id').maybeSingle()
    if (error) throw error
    adForm.id = String((data as any)?.id || '')
    toast.add({ title: 'Ad created', color: 'success' })
  }

  await loadAdsForTournament(tournamentId)
  await loadSlotOwners()
}

/** Deactivate (keep row) */
async function deactivateAd(adId: string) {
  if (!form.id) return
  const { error } = await supabase.from('tournament_ads').update({ is_active: false }).eq('id', adId)
  if (error) throw error
  toast.add({ title: 'Ad deactivated', color: 'success' })
  await loadAdsForTournament(form.id)
  await loadSlotOwners()
}

/** Delete row + file */
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
    await loadSlotOwners()
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

type UpsertOpts = { saveOnlyMeta?: boolean; skipThumbUpload?: boolean }

async function apiUpsert(opts: UpsertOpts = {}) {
  const saveOnlyMeta = Boolean(opts.saveOnlyMeta)
  const skipThumbUpload = Boolean(opts.skipThumbUpload)

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

        prize_1: form.prize_1.trim() || null,
        prize_2: form.prize_2.trim() || null,
        prize_3: form.prize_3.trim() || null,

        game_slug: form.game_slug,
        starts_at: startsIso.value,
        ends_at: endsIso.value,
        status: statusToSave,

        finalized: Boolean(form.finalized),

        thumbnail_url: form.thumbnail_url || null,
        thumbnail_path: form.thumbnail_path || null
      }
    })

    const t = res?.tournament
    if (!t?.id) throw new Error('Upsert did not return tournament id')

    form.id = t.id
    form.slug = t.slug
    form.thumbnail_url = t.thumbnail_url || form.thumbnail_url
    form.thumbnail_path = t.thumbnail_path || form.thumbnail_path

    form.prize_1 = (t as any).prize_1 || ''
    form.prize_2 = (t as any).prize_2 || ''
    form.prize_3 = (t as any).prize_3 || ''

    form.status = (t.status || statusToSave) as TournamentStatus
    form.finalized = Boolean(t.finalized)

    if (!saveOnlyMeta) toast.add({ title: isEditing.value ? 'Tournament saved' : 'Tournament created', color: 'success' })

    if (!skipThumbUpload) {
      try {
        await uploadThumbAndPersist(t.id)
      } catch (e: any) {
        toast.add({ title: 'Saved, but thumbnail upload failed', description: e?.message || 'Try again', color: 'error' })
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
    await $fetch('/api/admin/tournaments/finalize', { method: 'POST', credentials: 'include', body: { tournamentId: form.id, force } })
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
  if (requiresTxnId(w) && !String(w.reward_txn_id || '').trim()) return 'Transaction ID is required for online rewards marked as GIVEN.'
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
  form.prize_1 = ''
  form.prize_2 = ''
  form.prize_3 = ''
  form.thumbnail_url = ''
  form.thumbnail_path = ''
  form.game_slug = GAMES[0]?.slug || ''
  form.status = 'scheduled'
  form.finalized = false

  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  form.starts_local = toLocalInputValue(d.toISOString())
  d.setHours(d.getHours() + 2)
  form.ends_local = toLocalInputValue(d.toISOString())

  winners.value = []
  winnersErr.value = null
  setThumbFile(null)

  // ✅ Ads reset
  ads.value = []
  slotOwners.value = {}
  resetAdForm()
}

function selectTournament(id: string) {
  selectedId.value = id
  const t = rows.value.find(r => r.id === id)
  if (!t) return

  form.id = t.id
  form.slug = t.slug
  form.title = t.title
  form.description = t.description || ''
  form.game_slug = t.game_slug

  form.prize_1 = (t as any).prize_1 || ''
  form.prize_2 = (t as any).prize_2 || ''
  form.prize_3 = (t as any).prize_3 || ''

  form.starts_local = toLocalInputValue(t.starts_at)
  form.ends_local = toLocalInputValue(t.ends_at)

  form.thumbnail_url = t.thumbnail_url || ''
  form.thumbnail_path = t.thumbnail_path || ''

  form.status = (t.status || 'scheduled') as TournamentStatus
  form.finalized = Boolean(t.finalized)

  setThumbFile(null)
  loadWinners().catch(() => {})

  // ✅ Load multi ads for this tournament
  if (t.id) {
    loadAdsForTournament(t.id).catch(() => {})
    resetAdForm()
  }
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
  await apiList()
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
      <!-- TOP BAR -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-xs opacity-70">Editor</div>
            <div class="text-2xl font-extrabold tracking-tight">
              {{ isEditing ? 'Edit Tournament' : 'Create Tournament' }}
            </div>
            <div class="mt-1 text-sm opacity-70" v-if="form.slug">
              Slug: <span class="font-mono opacity-100">{{ form.slug }}</span>
              <span v-if="form.id" class="opacity-60">• ID: <span class="font-mono">{{ form.id.slice(0, 8) }}…</span></span>
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

        <!-- TABS -->
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

          <UButton class="!rounded-full" :loading="loading || thumbUploading || adUploading" @click="apiUpsert()">
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

      <!-- DETAILS TAB (kept minimal, same structure) -->
      <div v-if="tab === 'details'" class="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <div class="font-semibold">Tournament Details</div>

          <div class="mt-4 grid gap-3">
            <div class="grid gap-2">
              <label class="text-xs opacity-70">Title</label>
              <input v-model="form.title" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
              <div class="text-xs opacity-60">Slug auto-generates from title (new tournaments only).</div>
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Game</label>
              <select v-model="form.game_slug" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none">
                <option v-for="g in GAMES" :key="g.slug" :value="g.slug">{{ g.name }}</option>
              </select>
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Description</label>
              <textarea v-model="form.description" rows="4" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
            </div>

            <div class="grid gap-3 md:grid-cols-3">
              <div class="grid gap-2">
                <label class="text-xs opacity-70">Prize #1</label>
                <input v-model="form.prize_1" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
              </div>
              <div class="grid gap-2">
                <label class="text-xs opacity-70">Prize #2</label>
                <input v-model="form.prize_2" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
              </div>
              <div class="grid gap-2">
                <label class="text-xs opacity-70">Prize #3</label>
                <input v-model="form.prize_3" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
              </div>
            </div>
          </div>
        </div>

        <!-- THUMB -->
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
              <img v-if="effectiveThumbUrl" :src="effectiveThumbUrl" class="h-full w-full object-cover" />
              <div v-else class="text-xs opacity-60">No image</div>
            </div>
          </div>

          <div class="mt-4 space-y-3">
            <input type="file" accept="image/*" @change="onThumbPick" />
            <div class="flex flex-wrap gap-2">
              <UButton variant="soft" class="!rounded-full" :disabled="!thumbFile" @click="clearThumbSelection">Clear</UButton>
            </div>
          </div>
        </div>
      </div>

      <!-- SCHEDULE TAB -->
      <div v-else-if="tab === 'schedule'" class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
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
            <input v-model="form.starts_local" type="datetime-local" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
            <div class="text-xs opacity-60">UTC: <span class="font-mono">{{ startsIso }}</span></div>
          </div>

          <div class="grid gap-2">
            <label class="text-xs opacity-70">Ends (Dhaka)</label>
            <input v-model="form.ends_local" type="datetime-local" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none" />
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

      <!-- ✅ ADS TAB (MULTI ADS UI) -->
      <div v-else-if="tab === 'ads'" class="grid gap-4 lg:grid-cols-[1fr_360px]">
        <!-- LEFT: list + editor -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold">Tournament Ads</div>
              <div class="text-xs opacity-70">
                This tournament can have multiple ads (different slots). Only one ACTIVE ad per slot globally.
              </div>
            </div>
            <div class="text-xs opacity-70" v-if="adLoading">Loading…</div>
          </div>

          <div v-if="!form.id" class="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
            Create/save the tournament first to add ads.
          </div>

          <div v-else class="mt-4">
            <div class="flex flex-wrap gap-2">
              <UButton variant="soft" class="!rounded-full" :loading="adLoading" @click="loadAdsForTournament(form.id)">
                Refresh
              </UButton>
              <UButton class="!rounded-full" @click="resetAdForm()">
                New Ad
              </UButton>
            </div>

            <!-- Existing ads list -->
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
                    <div class="font-semibold truncate">
                      {{ AD_SLOTS.find(s => s.key === a.slot)?.label || a.slot }}
                    </div>
                    <div class="mt-1 text-xs opacity-70">
                      {{ a.starts_at ? fmt(a.starts_at) : 'No start' }} → {{ a.ends_at ? fmt(a.ends_at) : 'No end' }}
                    </div>
                    <div class="mt-1 text-xs opacity-60 truncate" v-if="a.alt">Alt: {{ a.alt }}</div>
                  </div>

                  <div class="shrink-0 flex flex-col items-end gap-2">
                    <span
                      class="px-2 py-1 rounded-full border text-[11px]"
                      :class="a.is_active
                        ? 'bg-emerald-500/15 border-emerald-400/20 text-emerald-300'
                        : 'bg-white/10 border-white/10 text-white/70'"
                    >
                      {{ a.is_active ? 'ACTIVE' : 'INACTIVE' }}
                    </span>
                    <span class="text-[11px] opacity-60">{{ a.id.slice(0, 8) }}…</span>
                  </div>
                </div>
              </button>
            </div>

            <!-- Editor -->
            <div class="mt-6 rounded-2xl border border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="font-semibold">
                  {{ adForm.id ? 'Edit Ad' : 'Create New Ad' }}
                </div>
                <div class="flex gap-2">
                  <UButton
                    variant="soft"
                    class="!rounded-full"
                    :disabled="!adForm.id"
                    @click="(async () => {
                      const row = ads.find(x => x.id === adForm.id)
                      if (!row) return
                      await deactivateAd(row.id)
                    })()"
                  >
                    Deactivate
                  </UButton>

                  <UButton
                    color="error"
                    variant="soft"
                    class="!rounded-full"
                    :disabled="!adForm.id"
                    @click="(async () => {
                      const row = ads.find(x => x.id === adForm.id)
                      if (!row) return
                      await deleteAd(row)
                    })()"
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
                  All slots are currently occupied by other tournaments. Deactivate an active ad elsewhere to free a slot.
                </div>

                <div class="grid gap-2">
                  <label class="text-xs opacity-70">Slot</label>
                  <select
                    v-model="adForm.slot"
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                    :disabled="!form.id"
                  >
                    <option value="">(choose)</option>

                    <!-- ✅ Only show selectable slots (occupied ones hidden for NEW ads) -->
                    <option
                      v-for="s in selectableSlots"
                      :key="s.key"
                      :value="s.key"
                    >
                      {{ s.label }}
                    </option>
                  </select>

                  <div class="text-xs opacity-60">
                    Occupied slots (active on another tournament) are hidden when creating a new ad.
                    When editing an existing ad, its current slot remains visible.
                  </div>
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
                    @click="(async () => {
                      if (!form.id) return
                      await saveOneAd(form.id)
                    })()"
                  >
                    {{ adForm.id ? 'Save Changes' : 'Create Ad' }}
                  </UButton>

                  <UButton variant="soft" class="!rounded-full" @click="resetAdForm()">
                    Clear Form
                  </UButton>
                </div>

                <div class="text-xs opacity-60">
                  Bucket: <span class="font-mono">{{ ADS_BUCKET }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: preview + upload -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <div class="flex items-start justify-between">
            <div>
              <div class="font-semibold">Banner</div>
              <div class="text-xs opacity-70">Upload & preview</div>
            </div>
            <div class="text-xs opacity-70" v-if="adUploading">Uploading…</div>
          </div>

          <div class="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <div class="aspect-[16/6] bg-black/20 grid place-items-center">
              <img v-if="effectiveAdImg" :src="effectiveAdImg" class="h-full w-full object-cover" />
              <div v-else class="text-xs opacity-60">No banner</div>
            </div>
          </div>

          <div class="mt-4 space-y-3">
            <input type="file" accept="image/*" @change="onAdPick" :disabled="!form.id" />
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
            <div class="text-xs opacity-70">
              Finalize winners after end. Online + GIVEN requires transaction id.
            </div>
          </div>

          <div class="flex items-center gap-2">
            <UButton variant="soft" size="xs" class="!rounded-full" :loading="winnersLoading" :disabled="!form.id && !form.slug" @click="loadWinners()">Refresh</UButton>
            <UButton size="xs" class="!rounded-full" :disabled="!form.id" :loading="winnersLoading" @click="finalize(false)">Finalize</UButton>
            <UButton variant="soft" size="xs" class="!rounded-full" :disabled="!form.id" :loading="winnersLoading" @click="finalize(true)">Re-Finalize</UButton>
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
                    Prize: <b class="opacity-100">{{ w.prize || '—' }}</b>
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
