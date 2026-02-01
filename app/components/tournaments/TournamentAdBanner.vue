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
  slot: string
  banner_url: string | null
  banner_path: string | null
  alt: string | null
  // optional: if you keep schedule on ads
  starts_at?: string | null
  ends_at?: string | null
  tournaments: TournamentMini | null
}

const props = withDefaults(
  defineProps<{
    slot: string
    variant?: 'banner' | 'sidebar'
    ratio?: '21/9' | '16/9' | '3/1'
    livePulse?: boolean
  }>(),
  {
    variant: 'banner',
    ratio: '21/9',
    livePulse: true
  }
)

const supabase = useSupabaseClient()
const ad = ref<AdRow | null>(null)

/* ✅ reactive ticker so countdown updates */
const nowTick = ref(Date.now())
let timer: any = null

onMounted(() => {
  timer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

async function load() {
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('tournament_ads')
    .select(
      `
      slot, banner_url, banner_path, alt, starts_at, ends_at,
      tournaments:tournament_id (
        slug, title, thumbnail_url, starts_at, ends_at, status
      )
    `
    )
    .eq('slot', props.slot)
    .eq('is_active', true)
    // If tournament_ads doesn't have starts_at/ends_at, remove these 2 lines:
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .maybeSingle()

  ad.value = error ? null : ((data as any) || null)
}

onMounted(load)

const href = computed(() => {
  const slug = ad.value?.tournaments?.slug
  return slug ? `/tournaments/${slug}` : null
})

const img = computed(() => ad.value?.banner_url || ad.value?.tournaments?.thumbnail_url || null)
const isSidebar = computed(() => props.variant === 'sidebar')

const ratioClass = computed(() => {
  if (props.ratio === '16/9') return 'aspect-[16/9]'
  if (props.ratio === '3/1') return 'aspect-[3/1]'
  return 'aspect-[21/9]'
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
</script>

<template>
  <NuxtLink
    v-if="ad && href && img"
    :to="href"
    class="group relative block w-full overflow-hidden rounded-3xl
           border border-black/10 dark:border-white/10
           bg-white/70 dark:bg-white/5 backdrop-blur
           transition will-change-transform
           hover:-translate-y-[3px]
           hover:shadow-[0_24px_70px_rgba(0,0,0,.20)]
           dark:hover:shadow-[0_24px_70px_rgba(0,0,0,.55)]"
  >
    <!-- Ambient hover glow -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -inset-10 opacity-0 group-hover:opacity-100 transition duration-500 blur-2xl"
      :style="{
        background: `
          radial-gradient(520px 260px at 25% 35%, rgba(239,68,68,.16), transparent 60%),
          radial-gradient(520px 260px at 55% 55%, rgba(34,211,238,.12), transparent 60%),
          radial-gradient(520px 260px at 85% 30%, rgba(124,58,237,.14), transparent 60%)
        `
      }"
    />

    <!-- ✅ SIDEBAR -->
    <div v-if="isSidebar" class="relative w-full h-[420px]">
      <img
        :src="img"
        :alt="ad.alt || ad.tournaments?.title || 'Tournament'"
        class="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-[1.04]"
      />

      <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      <!-- ✅ LIVE badge (top-right, bigger, red) -->
      <div
        v-if="isLive"
        class="absolute right-4 top-4 z-10"
      >
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

      <!-- small label top-left -->
      <div class="absolute left-4 top-4 flex items-center gap-2">
        <span class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] text-white/85">
          <span class="inline-flex h-1.5 w-1.5 rounded-full bg-white/70" />
          TOURNAMENT
        </span>
      </div>

      <div class="absolute inset-x-0 bottom-0 p-5">
        <div class="text-lg font-extrabold text-white leading-tight line-clamp-2">
          {{ ad.tournaments?.title }}
        </div>

        <div class="mt-3 inline-flex items-center gap-2 rounded-full bg-white/12 border border-white/20 px-3 py-1.5 text-xs text-white/90">
          View details
          <span class="opacity-80 group-hover:translate-x-[3px] transition">→</span>
        </div>

        <div class="mt-3 h-[2px] w-24 rounded-full bg-white/20 overflow-hidden">
          <div class="h-full w-full translate-x-[-100%] group-hover:translate-x-0 transition duration-700 bg-white/45" />
        </div>
      </div>
    </div>

    <!-- ✅ BANNER -->
    <div v-else class="relative w-full" :class="ratioClass">
      <img
        :src="img"
        :alt="ad.alt || ad.tournaments?.title || 'Tournament'"
        class="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-[1.03]"
      />

      <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

      <!-- Shimmer sweep -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-700">
        <div class="absolute -inset-y-10 -left-1/2 w-1/2 rotate-12 bg-white/10 blur-xl animate-[adSweep_1.2s_ease-in-out_1]" />
      </div>

      <!-- top-left label -->
      <div class="absolute left-4 top-4 flex items-center gap-2">
        <span class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] text-white/85">
          <span class="inline-flex h-1.5 w-1.5 rounded-full bg-white/70" />
          TOURNAMENT
        </span>
      </div>

      <!-- ✅ LIVE badge (top-right, bigger, red) -->
      <div
        v-if="isLive"
        class="absolute right-4 top-4 z-10"
      >
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

      <!-- Content -->
      <div class="absolute inset-0 flex items-center">
        <div class="p-5 sm:p-7 max-w-[74%]">
          <div class="text-[11px] sm:text-xs uppercase tracking-wider text-white/75">
            Join now • Win prizes
          </div>

          <div class="mt-1 text-lg sm:text-2xl font-extrabold text-white leading-tight line-clamp-2 drop-shadow">
            {{ ad.tournaments?.title }}
          </div>

          <div class="mt-3 inline-flex items-center gap-2 rounded-full bg-white/12 border border-white/20 px-3 py-1.5 text-xs text-white/90">
            Tap to view
            <span class="opacity-80 group-hover:translate-x-[3px] transition">→</span>
          </div>

          <div class="mt-4 h-[2px] w-28 rounded-full bg-white/20 overflow-hidden">
            <div class="h-full w-full translate-x-[-100%] group-hover:translate-x-0 transition duration-700 bg-white/55" />
          </div>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
@keyframes adSweep {
  from { transform: translateX(-20%) rotate(12deg); opacity: 0; }
  30% { opacity: 1; }
  to { transform: translateX(220%) rotate(12deg); opacity: 0; }
}

/* ✅ Bigger RED pulsing dot */
.liveDot {
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background: rgba(248, 113, 113, 0.98); /* red-400-ish */
  box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.55);
  animation: pulseRed 1.05s ease-out infinite;
}

@keyframes pulseRed {
  0%   { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.55); transform: scale(1); }
  70%  { box-shadow: 0 0 0 12px rgba(248, 113, 113, 0.00); transform: scale(1.08); }
  100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.00); transform: scale(1); }
}
</style>
