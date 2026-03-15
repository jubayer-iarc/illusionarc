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
    /**
     * ✅ If true, show placeholder ONLY while loading.
     * If false, show nothing when there is no ad.
     */
    showPlaceholderWhileLoading?: boolean
  }>(),
  {
    variant: 'banner',
    ratio: '16/9',
    preferDbRatio: true,
    livePulse: true,
    showLiveBadge: true,
    refreshSec: 60,
    showPlaceholderWhileLoading: false
  }
)

const supabase = useSupabaseClient()

const ad = ref<AdRow | null>(null)
const loading = ref(true)

/* ✅ reactive ticker so countdown updates */
const nowTick = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null

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
  loading.value = true
  try {
    const nowIso = new Date().toISOString()

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
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    ad.value = error ? null : ((data as any) || null)
  } finally {
    loading.value = false
  }
}

onMounted(() => load().catch(() => {}))
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
  return (db || props.ratio || '16/9') as '16/9' | '21/9' | '3/1'
})

const ratioClass = computed(() => {
  if (effectiveRatio.value === '16/9') return 'aspect-[16/9]'
  if (effectiveRatio.value === '3/1') return 'aspect-[3/1]'
  return 'aspect-[21/9]'
})

/* For sidebar, you usually want a tall fixed panel */
const sidebarHeightClass = computed(() => {
  if (effectiveRatio.value === '21/9') return 'h-[440px]'
  return 'h-[420px]'
})

function toMs(v?: string | null) {
  if (!v) return NaN
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : NaN
}

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0')
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

/** ✅ Countdown format: XXD: XXH: XXM */
const timeLeft = computed(() => {
  const t = ad.value?.tournaments
  const e = toMs(t?.ends_at ?? null)
  if (!Number.isFinite(e)) return null

  const ms = Math.max(0, e - nowTick.value)
  const totalMinutes = Math.floor(ms / 1000 / 60)

  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  return `${pad2(days)}D: ${pad2(hours)}H: ${pad2(minutes)}M`
})

/** Accessible alt */
const altText = computed(() => ad.value?.alt || ad.value?.tournaments?.title || 'Tournament')

/** ✅ True only when we actually have an ad to show */
const hasAd = computed(() => Boolean(ad.value && href.value && img.value))

/** ✅ Show placeholder ONLY while loading (if enabled) */
const showPlaceholder = computed(() => props.showPlaceholderWhileLoading && loading.value)
</script>

<template>
  <!-- ✅ Render ad ONLY when it exists -->
  <NuxtLink
    v-if="hasAd"
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
      <img :src="img!" :alt="altText" class="adImg absolute inset-0 h-full w-full object-cover" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />

      <div v-if="showLiveBadge && isLive" class="absolute right-4 top-4 z-10">
        <div
          class="inline-flex items-center gap-2 rounded-full
                 border border-red-400/30 bg-red-500/20
                 px-4 py-2 text-sm font-extrabold tracking-wide text-red-50"
        >
          <span class="liveDot" aria-hidden="true" />
          LIVE
          <span v-if="timeLeft" class="font-semibold opacity-90">• {{ timeLeft }}</span>
        </div>
      </div>
    </div>

    <!-- ✅ BANNER -->
    <div v-else class="relative w-full" :class="ratioClass">
      <img :src="img!" :alt="altText" class="adImg absolute inset-0 h-full w-full object-cover" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />

      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 opacity-0 transition duration-700 group-hover:opacity-100"
      >
        <div class="absolute -inset-y-10 -left-1/2 w-1/2 rotate-12 bg-white/12 blur-xl animate-[adSweep_1.2s_ease-in-out_1]" />
      </div>

      <div v-if="showLiveBadge && isLive" class="absolute right-4 top-4 z-10">
        <div
          class="inline-flex items-center gap-2 rounded-full
                 border border-red-400/30 bg-red-500/20
                 px-4 py-2 text-sm font-extrabold tracking-wide text-red-50 sm:text-base"
        >
          <span class="liveDot" aria-hidden="true" />
          LIVE
          <span v-if="timeLeft" class="font-semibold opacity-90">• {{ timeLeft }}</span>
        </div>
      </div>
    </div>

    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
    >
      <div class="absolute inset-0 bg-gradient-to-br from-white/18 via-white/0 to-white/0" />
    </div>
  </NuxtLink>

  <!-- ✅ Placeholder ONLY while loading (optional) -->
  <div
    v-else-if="showPlaceholder"
    class="overflow-hidden rounded-3xl border border-black/10
           bg-white/60 backdrop-blur animate-pulse
           dark:border-white/10 dark:bg-white/5"
  >
    <div v-if="isSidebar" class="relative w-full" :class="sidebarHeightClass">
      <div class="absolute inset-0 bg-black/10 dark:bg-white/5" />
    </div>
    <div v-else class="relative w-full" :class="ratioClass">
      <div class="absolute inset-0 bg-black/10 dark:bg-white/5" />
    </div>
  </div>

  <!-- ✅ When no ad and not loading: render NOTHING -->
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

.adCard {
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.18);
}
.adCard:hover {
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.3);
}
.adImg {
  transition: transform 650ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 450ms ease;
  will-change: transform, filter;
}
.adCard:hover .adImg {
  transform: scale(1.05);
  filter: brightness(1.14) saturate(1.22) contrast(1.06);
}

@media (prefers-reduced-motion: reduce) {
  .adImg {
    transition: none;
  }
  .adCard {
    transition: none;
  }
}

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
  0% {
    box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.55);
    transform: scale(1);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(248, 113, 113, 0);
    transform: scale(1.08);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(248, 113, 113, 0);
    transform: scale(1);
  }
}
</style>