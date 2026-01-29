<!-- app/pages/tournaments/index.vue -->
<script setup lang="ts">
import { GAMES } from '~/data/games'
import { TOURNAMENTS as FALLBACK } from '~/data/tournaments'
import { useTournaments } from '~/composables/useTournaments'
import { useSubscription } from '~/composables/useSubscription'

useHead({ title: 'Tournaments' })

type AnyTournament = any

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const { list } = useTournaments()
const { me } = useSubscription()

/* ---------------- Load tournaments ---------------- */
const tournaments = ref<AnyTournament[]>([])
try {
  tournaments.value = await list()
} catch {
  tournaments.value = FALLBACK as any
}

/* ---------------- Subscription ---------------- */
const sub = ref<{ active: boolean } | null>(null)
try {
  const s = await me()
  sub.value = { active: Boolean(s?.active) }
} catch {
  sub.value = null
}
const canPlay = computed(() => Boolean(user.value) && Boolean(sub.value?.active))

/* ---------------- Time ticker ---------------- */
const now = ref(Date.now())
let timer: any = null
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => timer && clearInterval(timer))

/* ---------------- Helpers ---------------- */
function getStatus(t: AnyTournament) {
  return String(t?.status || 'scheduled') as 'scheduled' | 'live' | 'ended' | 'canceled'
}
function getGameSlug(t: AnyTournament) {
  return String(t?.game_slug ?? t?.gameSlug ?? '').trim()
}
function getStartsAt(t: AnyTournament) {
  return String(t?.starts_at ?? t?.startsAt ?? '').trim()
}
function getEndsAt(t: AnyTournament) {
  return String(t?.ends_at ?? t?.endsAt ?? '').trim()
}
function gameTitle(slug: string) {
  return GAMES.find((g) => g.slug === slug)?.name || slug
}
function fmt(dt: string) {
  if (!dt) return ''
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}
function msToClock(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}
function startsIn(t: AnyTournament) {
  return new Date(getStartsAt(t)).getTime() - now.value
}
function endsIn(t: AnyTournament) {
  return new Date(getEndsAt(t)).getTime() - now.value
}

/* ---------------- Thumbnail resolver ---------------- */
const DEFAULT_BUCKET = 'tournament-thumbs' // change to your real bucket name

function rawThumb(t: AnyTournament) {
  return String(t?.thumbnail_url ?? t?.thumbnail ?? t?.thumb ?? '').trim()
}
function thumbBucket(t: AnyTournament) {
  return String(t?.thumbnail_bucket || DEFAULT_BUCKET).trim() || DEFAULT_BUCKET
}
function thumbPath(t: AnyTournament) {
  return String(t?.thumbnail_path ?? '').trim()
}

const thumbMap = reactive<Record<string, string>>({})

function normalizeMaybeUrl(x: string) {
  const s = String(x || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('/')) return s
  return s
}

async function resolveThumb(t: AnyTournament) {
  const slug = String(t?.slug || '').trim()
  if (!slug) return ''

  const direct = normalizeMaybeUrl(rawThumb(t))
  if (direct) {
    if (!/^https?:\/\//i.test(direct) && !direct.startsWith('/')) {
      const bucket = thumbBucket(t)
      const { data } = supabase.storage.from(bucket).getPublicUrl(direct)
      return String(data?.publicUrl || direct)
    }
    return direct
  }

  const p = thumbPath(t)
  if (p) {
    const bucket = thumbBucket(t)
    const { data } = supabase.storage.from(bucket).getPublicUrl(p)
    return String(data?.publicUrl || '')
  }

  return ''
}

async function hydrateThumbs(arr: AnyTournament[]) {
  for (const t of arr || []) {
    const slug = String(t?.slug || '').trim()
    if (!slug) continue
    if (thumbMap[slug]) continue
    const url = await resolveThumb(t)
    if (url) thumbMap[slug] = url
  }
}

watch(
  () => tournaments.value,
  async (arr) => {
    await hydrateThumbs(arr || [])
  },
  { immediate: true, deep: true }
)

function getThumb(t: AnyTournament) {
  const slug = String(t?.slug || '').trim()
  if (!slug) return ''
  return thumbMap[slug] || ''
}

function onThumbError(t: AnyTournament) {
  const slug = String(t?.slug || '').trim()
  const u = slug ? thumbMap[slug] : ''
  console.warn('[TournamentThumb] Failed to load:', {
    slug,
    url: u,
    raw: rawThumb(t),
    path: thumbPath(t),
    bucket: thumbBucket(t)
  })
  if (slug) thumbMap[slug] = ''
}

/* ---------------- UI State ---------------- */
const q = ref('')
const status = ref<'all' | 'live' | 'scheduled' | 'ended'>('all')
const gameFilter = ref<string>('all')
const onlyJoinable = ref(false)
const sortBy = ref<'smart' | 'startsSoon' | 'newest'>('smart')
const filtersOpen = ref(false)

/* ---------------- Sorting / Filtering ---------------- */
function statusRank(s: string) {
  return s === 'live' ? 0 : s === 'scheduled' ? 1 : s === 'ended' ? 2 : 3
}

const normalized = computed(() => {
  const arr = [...(tournaments.value || [])]

  if (sortBy.value === 'smart') {
    arr.sort((a, b) => {
      const sa = getStatus(a)
      const sb = getStatus(b)
      const ra = statusRank(sa)
      const rb = statusRank(sb)
      if (ra !== rb) return ra - rb
      const aa = new Date(getStartsAt(a)).getTime()
      const bb = new Date(getStartsAt(b)).getTime()
      return bb - aa
    })
    return arr
  }

  if (sortBy.value === 'startsSoon') {
    arr.sort((a, b) => {
      const sa = getStatus(a)
      const sb = getStatus(b)
      const ra = statusRank(sa)
      const rb = statusRank(sb)
      if (ra !== rb) return ra - rb

      const da = Math.abs(new Date(getStartsAt(a)).getTime() - now.value)
      const db = Math.abs(new Date(getStartsAt(b)).getTime() - now.value)
      return da - db
    })
    return arr
  }

  arr.sort((a, b) => {
    const aa = new Date(getStartsAt(a)).getTime()
    const bb = new Date(getStartsAt(b)).getTime()
    return bb - aa
  })
  return arr
})

const filtered = computed(() => {
  let arr = normalized.value

  const qs = q.value.trim().toLowerCase()
  if (qs) {
    arr = arr.filter((t) => {
      const title = String(t?.title || '').toLowerCase()
      const slug = String(t?.slug || '').toLowerCase()
      const g = getGameSlug(t).toLowerCase()
      return title.includes(qs) || slug.includes(qs) || g.includes(qs)
    })
  }

  if (status.value !== 'all') arr = arr.filter((t) => getStatus(t) === status.value)
  if (gameFilter.value !== 'all') arr = arr.filter((t) => getGameSlug(t) === gameFilter.value)

  if (onlyJoinable.value) arr = arr.filter((t) => getStatus(t) === 'live' && canPlay.value)

  return arr
})

const live = computed(() => filtered.value.filter((t) => getStatus(t) === 'live'))
const counts = computed(() => {
  const all = tournaments.value || []
  return {
    all: all.length,
    live: all.filter((t) => getStatus(t) === 'live').length,
    scheduled: all.filter((t) => getStatus(t) === 'scheduled').length,
    ended: all.filter((t) => getStatus(t) === 'ended').length
  }
})

function chipClass(active: boolean) {
  return active
    ? 'border-black/15 bg-black/5 text-black dark:border-white/15 dark:bg-white/10 dark:text-white'
    : 'border-black/10 bg-white text-black/70 hover:bg-black/5 hover:text-black dark:border-white/10 dark:bg-black/10 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white'
}

function statusPillClass(s: string) {
  if (s === 'live') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  if (s === 'scheduled') return 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-200'
  return 'border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70'
}

function clearFilters() {
  q.value = ''
  status.value = 'all'
  gameFilter.value = 'all'
  onlyJoinable.value = false
  sortBy.value = 'smart'
}

function playHard(slug: string) {
  if (!import.meta.client) return
  const url = `/tournaments/embed/${encodeURIComponent(slug)}?boot=${Date.now()}`
  window.location.assign(url)
}

function windowText(t: AnyTournament) {
  const s = fmt(getStartsAt(t))
  const e = fmt(getEndsAt(t))
  return s && e ? `${s} → ${e}` : ''
}
</script>

<template>
  <UContainer class="py-8 sm:py-10">
    <!-- TOP: Header -->
    <div
      class="relative overflow-hidden rounded-3xl border border-black/10 bg-white p-5 sm:p-8
             dark:border-white/10 dark:bg-white/5"
    >
      <div class="pointer-events-none absolute inset-0" aria-hidden="true">
        <!-- Light blobs -->
        <div class="absolute -top-28 left-1/3 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl dark:bg-violet-500/15"></div>
        <div class="absolute -bottom-28 right-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/10"></div>

        <!-- Overlay: light vs dark -->
        <div class="absolute inset-0 bg-gradient-to-b from-black/0 to-black/0 dark:from-white/10 dark:to-transparent"></div>
      </div>

      <div class="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <div
            class="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-3 py-1.5 text-xs text-black/70
                   dark:border-white/10 dark:bg-black/20 dark:text-white/75"
          >
            <UIcon name="i-heroicons-sparkles" class="h-4 w-4 opacity-80" />
            <span>Illusion Arc • Competitive Events</span>
          </div>

          <h1 class="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-black dark:text-white">
            Tournament Dashboard
          </h1>

          <p class="mt-2 max-w-2xl text-sm sm:text-base text-black/70 dark:text-white/75">
            Discover live runs, upcoming windows, and ended results — all in one place.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <UButton v-if="user && sub && !sub.active" to="/subscribe" class="!rounded-full">
            Subscribe to Play
          </UButton>
          <UButton v-else-if="user" to="/subscribe" variant="soft" class="!rounded-full">
            Subscription
          </UButton>
          <UButton v-else to="/login" variant="soft" class="!rounded-full">
            Login
          </UButton>

          <UButton variant="soft" class="!rounded-full lg:hidden" @click="filtersOpen = !filtersOpen">
            <UIcon name="i-heroicons-adjustments-horizontal" class="h-4 w-4" />
            <span class="ml-1">Filters</span>
          </UButton>
        </div>
      </div>

      <!-- Stats row -->
      <div class="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-2xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-black/20">
          <div class="text-xs text-black/60 dark:text-white/60">Total</div>
          <div class="mt-1 text-2xl font-bold text-black dark:text-white">{{ counts.all }}</div>
          <div class="mt-2 text-xs text-black/50 dark:text-white/55">All tournaments loaded</div>
        </div>

        <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div class="text-xs text-emerald-700/80 dark:text-emerald-200/70">Live</div>
          <div class="mt-1 text-2xl font-bold text-emerald-800 dark:text-emerald-100">{{ counts.live }}</div>
          <div class="mt-2 text-xs text-emerald-700/60 dark:text-emerald-200/60">Join while timer runs</div>
        </div>

        <div class="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
          <div class="text-xs text-violet-700/80 dark:text-violet-200/70">Upcoming</div>
          <div class="mt-1 text-2xl font-bold text-violet-800 dark:text-violet-100">{{ counts.scheduled }}</div>
          <div class="mt-2 text-xs text-violet-700/60 dark:text-violet-200/60">Starts soon</div>
        </div>

        <div class="rounded-2xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5">
          <div class="text-xs text-black/60 dark:text-white/60">Ended</div>
          <div class="mt-1 text-2xl font-bold text-black dark:text-white">{{ counts.ended }}</div>
          <div class="mt-2 text-xs text-black/50 dark:text-white/55">Results available</div>
        </div>
      </div>
    </div>

    <!-- BODY -->
    <div class="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
      <!-- FILTERS -->
      <aside class="lg:sticky lg:top-6 lg:self-start" :class="filtersOpen ? 'block' : 'hidden lg:block'">
        <div class="rounded-3xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div class="flex items-center justify-between">
            <div class="font-semibold text-black dark:text-white">Filters</div>
            <button
              type="button"
              class="text-xs text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white lg:hidden"
              @click="filtersOpen = false"
            >
              Close
            </button>
          </div>

          <!-- Search -->
          <div class="mt-4 rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 dark:border-white/10 dark:bg-black/20">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-magnifying-glass" class="h-5 w-5 opacity-60" />
              <input
                v-model="q"
                type="text"
                placeholder="Search by title / slug / game…"
                class="w-full bg-transparent text-sm outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
              />
              <button
                v-if="q"
                class="rounded-full border border-black/10 bg-white px-2 py-1 text-xs text-black/70 hover:text-black
                       dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-white"
                @click="q = ''"
                type="button"
              >
                Clear
              </button>
            </div>
          </div>

          <!-- Status chips -->
          <div class="mt-4">
            <div class="text-xs text-black/60 dark:text-white/60">Status</div>
            <div class="mt-2 flex flex-wrap gap-2">
              <button type="button" class="rounded-full border px-3 py-1 text-xs transition" :class="chipClass(status==='all')" @click="status='all'">All</button>
              <button type="button" class="rounded-full border px-3 py-1 text-xs transition" :class="chipClass(status==='live')" @click="status='live'">Live</button>
              <button type="button" class="rounded-full border px-3 py-1 text-xs transition" :class="chipClass(status==='scheduled')" @click="status='scheduled'">Upcoming</button>
              <button type="button" class="rounded-full border px-3 py-1 text-xs transition" :class="chipClass(status==='ended')" @click="status='ended'">Ended</button>
            </div>
          </div>

          <!-- Game -->
          <div class="mt-4">
            <div class="text-xs text-black/60 dark:text-white/60">Game</div>
            <div class="mt-2 rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 dark:border-white/10 dark:bg-black/20">
              <select v-model="gameFilter" class="w-full bg-transparent text-sm outline-none">
                <option value="all">All games</option>
                <option v-for="g in GAMES" :key="g.slug" :value="g.slug">{{ g.name }}</option>
              </select>
            </div>
          </div>

          <!-- Sort -->
          <div class="mt-4">
            <div class="text-xs text-black/60 dark:text-white/60">Sort</div>
            <div class="mt-2 rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 dark:border-white/10 dark:bg-black/20">
              <select v-model="sortBy" class="w-full bg-transparent text-sm outline-none">
                <option value="smart">Smart</option>
                <option value="startsSoon">Starts soon</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          <!-- Joinable toggle -->
          <button
            type="button"
            class="mt-4 w-full rounded-2xl border border-black/10 bg-black/5 px-3 py-3 text-left hover:bg-black/10 transition
                   dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/5"
            @click="onlyJoinable = !onlyJoinable"
          >
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="text-xs text-black/60 dark:text-white/60">Quick filter</div>
                <div class="mt-1 text-sm font-medium text-black dark:text-white">
                  {{ onlyJoinable ? 'Only joinable' : 'Show all' }}
                </div>
              </div>

              <div
                class="h-6 w-11 rounded-full border border-black/10 p-1 transition dark:border-white/10"
                :class="onlyJoinable ? 'bg-emerald-500/20' : 'bg-white'"
              >
                <div
                  class="h-4 w-4 rounded-full transition"
                  :class="onlyJoinable ? 'translate-x-5 bg-emerald-600' : 'translate-x-0 bg-black/30 dark:bg-white/80'"
                />
              </div>
            </div>
            <div class="mt-1 text-xs text-black/50 dark:text-white/50">Live + subscription</div>
          </button>

          <!-- Actions -->
          <div class="mt-4 flex gap-2">
            <UButton variant="soft" class="flex-1 !rounded-full" @click="clearFilters">Reset</UButton>
            <UButton class="flex-1 !rounded-full" @click="filtersOpen = false" v-if="filtersOpen">Apply</UButton>
          </div>

          <div class="mt-3 text-[11px] text-black/45 dark:text-white/45">
            Tip: “Only joinable” requires login + active subscription.
          </div>
        </div>
      </aside>

      <!-- CONTENT -->
      <main class="min-w-0">
        <!-- LIVE STRIP -->
        <section
          v-if="live.length"
          class="rounded-3xl border border-black/10 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-white/5"
        >
          <div class="flex items-end justify-between gap-3">
            <div>
              <div class="text-xs text-black/60 dark:text-white/60">Live right now</div>
              <h2 class="mt-1 text-lg sm:text-xl font-semibold text-black dark:text-white">Jump in before it ends</h2>
            </div>
            <div class="text-xs text-black/60 dark:text-white/60 hidden sm:block">Timers update live</div>
          </div>

          <div class="mt-4 flex gap-3 overflow-x-auto pb-2">
            <article
              v-for="t in live"
              :key="t.slug"
              class="min-w-[300px] sm:min-w-[360px] max-w-[420px] flex-1 overflow-hidden rounded-3xl border border-black/10 bg-black/5
                     dark:border-white/10 dark:bg-black/20"
            >
              <div class="relative h-36">
                <img
                  v-if="getThumb(t)"
                  :src="getThumb(t)"
                  alt=""
                  class="absolute inset-0 h-full w-full object-cover"
                  @error="onThumbError(t)"
                />
                <div v-else class="absolute inset-0 bg-gradient-to-br from-black/10 via-black/5 to-transparent dark:from-white/10 dark:via-white/5"></div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>

                <div class="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs"
                     :class="'text-emerald-700 dark:text-emerald-200'">
                  <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                  LIVE
                </div>

                <div class="absolute right-3 top-3 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-black/90
                            dark:border-white/10 dark:bg-black/45 dark:text-white/90">
                  Ends in <span class="font-mono font-semibold">{{ msToClock(endsIn(t)) }}</span>
                </div>

                <div class="absolute bottom-3 left-3 right-3">
                  <div class="text-base sm:text-lg font-bold text-white truncate">{{ t.title }}</div>
                  <div class="mt-0.5 text-xs text-white/85 truncate">
                    {{ gameTitle(getGameSlug(t)) }}
                  </div>
                </div>
              </div>

              <div class="p-4">
                <div class="flex flex-wrap items-center gap-2 text-[11px] text-black/60 dark:text-white/70">
                  <span class="rounded-full border border-black/10 bg-white px-2.5 py-1 dark:border-white/10 dark:bg-white/5">
                    {{ windowText(t) || '—' }}
                  </span>
                  <span
                    v-if="t.prize"
                    class="rounded-full border border-black/10 bg-white px-2.5 py-1 dark:border-white/10 dark:bg-white/5"
                  >
                    Prize: <b class="font-semibold text-black/90 dark:text-white/90">{{ t.prize }}</b>
                  </span>
                </div>

                <div class="mt-3 flex flex-wrap gap-2">
                  <UButton :to="`/tournaments/${t.slug}`" variant="soft" class="!rounded-full">
                    Details
                  </UButton>

                  <UButton v-if="canPlay" class="!rounded-full" @click="playHard(t.slug)">
                    Play
                  </UButton>

                  <UButton v-else to="/subscribe" class="!rounded-full">
                    Subscribe
                  </UButton>
                </div>
              </div>
            </article>
          </div>
        </section>

        <!-- GRID -->
        <section class="mt-5">
          <div class="flex items-end justify-between gap-3">
            <div>
              <div class="text-xs text-black/60 dark:text-white/60">Browse</div>
              <h2 class="mt-1 text-lg sm:text-xl font-semibold text-black dark:text-white">Upcoming & Ended</h2>
            </div>

            <div class="text-xs text-black/60 dark:text-white/60">
              Showing <b class="text-black/80 dark:text-white/85">{{ filtered.length }}</b>
            </div>
          </div>

          <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article
              v-for="t in filtered"
              :key="t.slug"
              class="group overflow-hidden rounded-3xl border border-black/10 bg-white hover:bg-black/5 transition
                     dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
            >
              <div class="relative h-36">
                <img
                  v-if="getThumb(t)"
                  :src="getThumb(t)"
                  alt=""
                  class="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
                  @error="onThumbError(t)"
                />
                <div v-else class="absolute inset-0 bg-gradient-to-br from-black/10 via-black/5 to-transparent dark:from-white/10 dark:via-white/5"></div>

                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>

                <div
                  class="absolute left-3 top-3 inline-flex items-center rounded-full border px-2.5 py-1 text-xs"
                  :class="statusPillClass(getStatus(t))"
                >
                  {{ getStatus(t) === 'scheduled' ? 'UPCOMING' : getStatus(t) === 'live' ? 'LIVE' : getStatus(t) === 'ended' ? 'ENDED' : '—' }}
                </div>

                <div
                  v-if="getStatus(t) === 'scheduled'"
                  class="absolute right-3 top-3 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-xs text-black/85
                         dark:border-white/10 dark:bg-black/45 dark:text-white/85"
                >
                  Starts in <span class="font-mono font-semibold">{{ msToClock(startsIn(t)) }}</span>
                </div>

                <div
                  v-else-if="getStatus(t) === 'live'"
                  class="absolute right-3 top-3 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-xs text-black/85
                         dark:border-white/10 dark:bg-black/45 dark:text-white/85"
                >
                  Ends in <span class="font-mono font-semibold">{{ msToClock(endsIn(t)) }}</span>
                </div>

                <div class="absolute bottom-3 left-3 right-3">
                  <div class="text-base font-bold text-white truncate">{{ t.title }}</div>
                  <div class="mt-0.5 text-xs text-white/85 truncate">
                    {{ gameTitle(getGameSlug(t)) }}
                  </div>
                </div>
              </div>

              <div class="p-4">
                <div class="flex items-center justify-between gap-2">
                  <div class="text-[11px] text-black/60 dark:text-white/60 truncate">
                    {{ windowText(t) || '—' }}
                  </div>
                  <div v-if="t.prize" class="text-[11px] text-black/70 dark:text-white/70 truncate">
                    Prize: <b class="text-black/85 dark:text-white/90">{{ t.prize }}</b>
                  </div>
                </div>

                <div class="mt-3 flex flex-wrap gap-2">
                  <UButton :to="`/tournaments/${t.slug}`" variant="soft" class="!rounded-full">
                    {{ getStatus(t) === 'ended' ? 'Results' : 'View' }}
                  </UButton>

                  <UButton
                    v-if="getStatus(t) === 'live'"
                    class="!rounded-full"
                    :disabled="!canPlay"
                    @click="canPlay ? playHard(t.slug) : navigateTo('/subscribe')"
                  >
                    Play
                  </UButton>

                  <UButton
                    v-else-if="getStatus(t) === 'ended'"
                    :to="`/arcade/${getGameSlug(t)}`"
                    variant="soft"
                    class="!rounded-full"
                  >
                    Arcade
                  </UButton>
                </div>
              </div>
            </article>
          </div>

          <!-- Empty -->
          <div
            v-if="!filtered.length"
            class="mt-6 rounded-3xl border border-black/10 bg-white p-10 text-center dark:border-white/10 dark:bg-white/5"
          >
            <div class="mx-auto h-12 w-12 rounded-2xl border border-black/10 bg-black/5 grid place-items-center dark:border-white/10 dark:bg-black/20">
              <UIcon name="i-heroicons-calendar-days" class="h-6 w-6 opacity-70" />
            </div>
            <div class="mt-4 text-lg font-semibold text-black dark:text-white">No tournaments found</div>
            <p class="mt-1 text-sm text-black/60 dark:text-white/60">Try a different status, game, or search term.</p>
            <div class="mt-4 flex justify-center gap-2">
              <UButton variant="soft" class="!rounded-full" @click="clearFilters">
                Clear filters
              </UButton>
            </div>
          </div>
        </section>
      </main>
    </div>
  </UContainer>
</template>

<style scoped>
select { color: inherit; }
select option { color: #111; }
</style>
