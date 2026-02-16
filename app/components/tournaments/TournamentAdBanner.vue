<!-- app/components/tournaments/TournamentAdBanner.vue -->
<script setup lang="ts">
type TournamentMini = {
  slug: string
  title: string
  thumbnail_url: string | null
  starts_at?: string | null
  ends_at?: string | null
  status?: string | null
}

type AdRow = {
  id?: string
  slot: string
  ratio?: string | null
  banner_url: string | null
  banner_path: string | null
  alt: string | null
  starts_at?: string | null
  ends_at?: string | null
  tournaments: TournamentMini | null
}

const props = withDefaults(
  defineProps<{
    slot: string
    variant?: 'banner' | 'sidebar'
    ratio?: '21/9' | '16/9' | '3/1'
    /** If you store ratio per ad (tournament_ads.ratio), set this true to prefer DB ratio */
    preferDbRatio?: boolean
    livePulse?: boolean
    showLiveBadge?: boolean
    /** refresh interval seconds (ad schedule changes without reload) */
    refreshSec?: number
  }>(),
  {
    variant: 'banner',
    ratio: '16/9',
    preferDbRatio: true,
    livePulse: true,
    showLiveBadge: true,
    refreshSec: 60
  }
)

const supabase = useSupabaseClient()
const ad = ref<AdRow | null>(null)

/* ✅ reactive ticker so countdown updates */
const nowTick = ref(Date.now())
let timer: any = null
let refreshTimer: any = null

onMounted(() => {
  timer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)

  if (props.refreshSec > 0) {
    refreshTimer = setInterval(() => load().catch(() => {}), props.refreshSec * 1000)
  }
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (refreshTimer) clearInterval(refreshTimer)
})

/** Pick best available active ad for slot at current time */
async function load() {
  const nowIso = new Date().toISOString()

  // We want:
  // - active ads for slot
  // - within schedule window (or null bounds)
  // - prefer newest created_at (in case multiple exist but only one should be active)
  const { data, error } = await supabase
    .from('tournament_ads')
    .select(
      `
      id, slot, ratio, banner_url, banner_path, alt, starts_at, ends_at, created_at,
      tournaments:tournament_id (
        slug, title, thumbnail_url, starts_at, ends_at, status
      )
    `
    )
    .eq('slot', props.slot)
    .eq('is_active', true)
    // time window (safe-ish: apply both bounds using AND via separate filters)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  ad.value = error ? null : ((data as any) || null)
}

onMounted(load)
watch(
  () => props.slot,
  () => load().catch(() => {})
)

/* ---------- Derived ---------- */
const href = computed(() => {
  const slug = ad.value?.tournaments?.slug
  return slug ? `/tournaments/${slug}` : null
})

const img = computed(() => ad.value?.banner_url || ad.value?.tournaments?.thumbnail_url || null)
const isSidebar = computed(() => props.variant === 'sidebar')

function normalizeRatio(r?: string | null) {
  const v = String(r || '').trim()
  if (v === '16/9' || v === '21/9' || v === '3/1') return v as '16/9' | '21/9' | '3/1'
  return null
}

/** ✅ Prefer DB ratio if present (tournament_ads.ratio), else fallback to prop ratio */
const effectiveRatio = computed<'16/9' | '21/9' | '3/1'>(() => {
  const db = props.preferDbRatio ? normalizeRatio(ad.value?.ratio ?? null) : null
  return (db || props.ratio || '16/9') as any
})

const ratioClass = computed(() => {
  if (effectiveRatio.value === '16/9') return 'aspect-[16/9]'
  if (effectiveRatio.value === '3/1') return 'aspect-[3/1]'
  return 'aspect-[21/9]'
})

/* For sidebar, you usually want a tall fixed panel */
const sidebarHeightClass = computed(() => {
  // make it a bit taller for ultrawide banners so it doesn't look too thin
  if (effectiveRatio.value === '21/9') return 'h-[440px]'
  return 'h-[420px]'
})

function toMs(v?: string | null) {
  if (!v) return NaN
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : NaN
}

/**
 * LIVE logic:
 * 1) Prefer tournament.status === 'live'
 * 2) Else use tournament starts_at/ends_at
 * 3) Fallback to ad schedule starts_at/ends_at
 */
const isLive = computed(() => {
  if (!props.livePulse) return false
  const t = ad.value?.tournaments
  const now = nowTick.value

  const status = String(t?.status || '').toLowerCase()
  if (status === 'live') return true
  if (status === 'ended' || status === 'canceled' || status === 'cancelled') return false

  const ts = toMs(t?.starts_at ?? null)
  const te = toMs(t?.ends_at ?? null)
  if (Number.isFinite(ts) && Number.isFinite(te)) return now >= ts && now < te

  const as = toMs(ad.value?.starts_at ?? null)
  const ae = toMs(ad.value?.ends_at ?? null)
  if (Number.isFinite(as) && Number.isFinite(ae)) return now >= as && now < ae

  return false
})

const timeLeft = computed(() => {
  const t = ad.value?.tournaments
  const e = toMs(t?.ends_at ?? null)
  if (!Number.isFinite(e)) return null

  const ms = Math.max(0, e - nowTick.value)
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
})

/** Accessible alt */
const altText = computed(() => ad.value?.alt || ad.value?.tournaments?.title || 'Tournament')

/** Allow rendering a graceful placeholder (optional) */
const ready = computed(() => Boolean(ad.value && href.value && img.value))
</script>

<template>
  <NuxtLink
    v-if="ready"
    :to="href!"
    class="adCard group relative block w-full overflow-hidden rounded-3xl
           border border-black/10 dark:border-white/10
           bg-white/60 dark:bg-white/5 backdrop-blur
           transition-transform duration-300 will-change-transform
           hover:-translate-y-[4px]
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20"
  >
    <!-- Neon/ambient glow (only on hover) -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -inset-10 opacity-0 group-hover:opacity-100 transition duration-500 blur-2xl"
      :style="{
        background: `
          radial-gradient(520px 260px at 18% 30%, rgba(34,211,238,.20), transparent 60%),
          radial-gradient(520px 260px at 55% 55%, rgba(124,58,237,.22), transparent 60%),
          radial-gradient(520px 260px at 85% 28%, rgba(239,68,68,.18), transparent 60%)
        `
      }"
    />

    <!-- ✅ SIDEBAR -->
    <div v-if="isSidebar" class="relative w-full" :class="sidebarHeightClass">
      <img :src="img!" :alt="altText" class="adImg absolute inset-0 w-full h-full object-cover" />

      <!-- subtle vignette for depth (no text) -->
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />

      <!-- Optional LIVE badge (top-right) -->
      <div v-if="showLiveBadge && isLive" class="absolute right-4 top-4 z-10">
        <div
          class="inline-flex items-center gap-2 rounded-full
                 border border-red-400/30 bg-red-500/20
                 px-4 py-2 text-sm font-extrabold tracking-wide text-red-50"
        >
          <span class="liveDot" aria-hidden="true" />
          LIVE
          <span v-if="timeLeft" class="opacity-90 font-semibold">• {{ timeLeft }}</span>
        </div>
      </div>
    </div>

    <!-- ✅ BANNER -->
    <div v-else class="relative w-full" :class="ratioClass">
      <img :src="img!" :alt="altText" class="adImg absolute inset-0 w-full h-full object-cover" />

      <!-- subtle depth (no text) -->
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />

      <!-- Shimmer sweep -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-700">
        <div class="absolute -inset-y-10 -left-1/2 w-1/2 rotate-12 bg-white/12 blur-xl animate-[adSweep_1.2s_ease-in-out_1]" />
      </div>

      <!-- Optional LIVE badge (top-right) -->
      <div v-if="showLiveBadge && isLive" class="absolute right-4 top-4 z-10">
        <div
          class="inline-flex items-center gap-2 rounded-full
                 border border-red-400/30 bg-red-500/20
                 px-4 py-2 text-sm sm:text-base font-extrabold tracking-wide text-red-50"
        >
          <span class="liveDot" aria-hidden="true" />
          LIVE
          <span v-if="timeLeft" class="opacity-90 font-semibold">• {{ timeLeft }}</span>
        </div>
      </div>
    </div>

    <!-- Gloss highlight (very subtle) -->
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500">
      <div class="absolute inset-0 bg-gradient-to-br from-white/18 via-white/0 to-white/0" />
    </div>
  </NuxtLink>

  <!-- Optional fallback (keeps layout stable if you want) -->
  <div
    v-else
    class="rounded-3xl border border-black/10 dark:border-white/10
           bg-white/60 dark:bg-white/5 backdrop-blur
           overflow-hidden"
  >
    <div v-if="isSidebar" class="relative w-full" :class="sidebarHeightClass">
      <div class="absolute inset-0 bg-black/10 dark:bg-white/5" />
    </div>
    <div v-else class="relative w-full" :class="ratioClass">
      <div class="absolute inset-0 bg-black/10 dark:bg-white/5" />
    </div>
  </div>
</template>

<style scoped>
@keyframes adSweep {
  from { transform: translateX(-20%) rotate(12deg); opacity: 0; }
  30% { opacity: 1; }
  to { transform: translateX(220%) rotate(12deg); opacity: 0; }
}

/* ✅ "Pop + Bright" hover:
   - scale slightly
   - brighter, more saturated, a bit more contrast
   - stronger shadow
*/
.adCard {
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.18);
}
.adCard:hover {
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.30);
}
.adImg {
  transition: transform 650ms cubic-bezier(.2,.8,.2,1), filter 450ms ease;
  will-change: transform, filter;
}
.adCard:hover .adImg {
  transform: scale(1.05);
  filter: brightness(1.14) saturate(1.22) contrast(1.06);
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .adImg { transition: none; }
  .adCard { transition: none; }
}

/* ✅ Bigger RED pulsing dot */
.liveDot {
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background: rgba(248, 113, 113, 0.98);
  box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.55);
  animation: pulseRed 1.05s ease-out infinite;
}

@keyframes pulseRed {
  0%   { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.55); transform: scale(1); }
  70%  { box-shadow: 0 0 0 12px rgba(248, 113, 113, 0.00); transform: scale(1.08); }
  100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.00); transform: scale(1); }
}
</style>
