<!-- app/pages/arcade/index.vue -->
<script setup lang="ts">
import { GAMES } from '@/data/games'
import TournamentAdBanner from '~/components/tournaments/TournamentAdBanner.vue'

useHead({ title: 'Arcade' })

const supabase = useSupabaseClient()
const authUser = useSupabaseUser()
const toast = useToast()

/* ---------------- Mandatory phone gate (after login) ----------------
   If user is logged in but has no phone in profiles, force redirect to /profile
--------------------------------------------------------------------- */
const checkingPhone = ref(true)

async function requirePhoneOrRedirect() {
  // only runs on client to avoid SSR redirects/hydration issues
  if (!import.meta.client) return

  checkingPhone.value = true
  try {
    // reliable auth check
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user?.id) return // not logged in -> no gate here

    // read phone from profiles (your schema: profiles.user_id PK -> auth.users.id)
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('phone')
      .eq('user_id', user.id)
      .maybeSingle()

    // treat missing row / blocked select / empty phone as "missing"
    const phone = String(data?.phone || '').trim()
    if (error || !phone) {
      toast.add({
        title: 'Phone number required',
        description: 'Please add your phone number to continue.',
        color: 'warning'
      })

      // redirect to profile and lock the flow
      return navigateTo('/profile?needPhone=1&next=/arcade', { replace: true })
    }
  } finally {
    checkingPhone.value = false
  }
}

onMounted(requirePhoneOrRedirect)

/* ---------------- Tournament exclusivity ----------------
   If a game is in a LIVE tournament, it must not show in Arcade.
   Source: GET /api/tournaments/live-games
---------------------------------------------------------- */
type LiveRow = { gameSlug: string; tournamentSlug: string }

const liveRows = ref<LiveRow[]>([])
const liveGameSet = computed(() => new Set(liveRows.value.map(r => r.gameSlug)))

async function loadLiveGames() {
  try {
    const res = await $fetch<{ rows?: LiveRow[] }>('/api/tournaments/live-games')
    liveRows.value = Array.isArray(res?.rows) ? res.rows : []
  } catch {
    liveRows.value = []
  }
}

// No visible loader — just fetch once.
await loadLiveGames()

const arcadeSource = computed(() => {
  // Only games NOT locked by a live tournament
  return GAMES.filter(g => !liveGameSet.value.has(g.slug))
})

const hasLiveTournaments = computed(() => liveRows.value.length > 0)

/* ---------------- Existing filters ---------------- */
const q = ref('')
const genre = ref<string>('all')
const onlyFeatured = ref(false)

const genres = computed(() => {
  const set = new Set<string>()
  arcadeSource.value.forEach(g => g.genre && set.add(g.genre))
  return ['all', ...Array.from(set)]
})

watchEffect(() => {
  if (genre.value !== 'all' && !genres.value.includes(genre.value)) {
    genre.value = 'all'
  }
})

const filtered = computed(() => {
  const text = q.value.trim().toLowerCase()
  return arcadeSource.value.filter(g => {
    if (onlyFeatured.value && !g.featured) return false
    if (genre.value !== 'all' && g.genre !== genre.value) return false
    if (!text) return true
    return (
      g.name.toLowerCase().includes(text) ||
      g.shortPitch.toLowerCase().includes(text) ||
      (g.genre || '').toLowerCase().includes(text)
    )
  })
})

const featured = computed(() => arcadeSource.value.filter(g => g.featured))
</script>

<template>
  <UContainer class="py-12">
    <!-- ✅ Top tournament ad (NOT sidebar) -->
    <div class="mb-6">
      <!--
        Banner sizing rules:
        - Uses full container width (matches your whitespace)
        - Fixed aspect ratio via the component (we’ll enforce 21:9 there)
        - No floating, no absolute outside the card
      -->
      <TournamentAdBanner slot="arcade_sidebar" />
    </div>

    <!-- ✅ tiny cool gate overlay while checking (no layout shift) -->
    <div
      v-if="checkingPhone && authUser?.id"
      class="mb-6 rounded-2xl border border-black/10 dark:border-white/10
             bg-white/70 dark:bg-white/5 backdrop-blur p-4"
    >
      <div class="flex items-center gap-3">
        <div class="h-9 w-9 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30 grid place-items-center">
          <UIcon name="i-heroicons-shield-check" class="h-5 w-5 opacity-80" />
        </div>
        <div class="min-w-0">
          <div class="text-sm font-semibold text-black dark:text-white">Verifying your profile…</div>
          <div class="text-xs text-black/60 dark:text-white/60">Phone number is required to continue.</div>
        </div>
        <div class="ml-auto">
          <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin opacity-70" />
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold text-black dark:text-white">Arcade</h1>
        <p class="mt-2 text-black/70 dark:text-white/70">Play, score, and climb the leaderboard.</p>
      </div>

      <div class="flex flex-wrap gap-2 items-center">
        <UInput v-model="q" placeholder="Search games…" class="w-60" />
        <USelect v-model="genre" :options="genres" class="w-40" />
        <UCheckbox v-model="onlyFeatured" label="Featured" />
        <UButton to="/arcade/leaderboard" variant="solid" color="primary">
          Leaderboard
        </UButton>
        <UButton to="/subscribe" variant="solid" color="primary">
          Pricing
        </UButton>
      </div>
    </div>

    <!-- Tournament exclusivity notice -->
    <div
      v-if="hasLiveTournaments"
      class="mt-6 rounded-2xl border border-black/10 dark:border-white/10
             bg-white/70 dark:bg-white/5 backdrop-blur p-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="text-sm text-black/70 dark:text-white/70">
          Some games are currently in a <span class="font-semibold">LIVE tournament</span> and are only playable from
          the <span class="font-semibold">Tournament</span> section.
        </div>

        <div class="flex gap-2">
          <UButton to="/tournaments" variant="solid" color="primary">
            Go to Tournaments
          </UButton>
          <UButton variant="soft" @click="loadLiveGames">
            Refresh
          </UButton>
        </div>
      </div>
    </div>

    <!-- Featured row -->
    <div v-if="featured.length" class="mt-8">
      <div class="text-sm uppercase tracking-wider text-black/60 dark:text-white/60">Featured</div>

      <div class="mt-3 grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="g in featured"
          :key="g.slug"
          :to="`/arcade/${g.slug}`"
          class="group overflow-hidden rounded-2xl border border-black/10 dark:border-white/10
                 bg-white/70 dark:bg-white/5 backdrop-blur
                 hover:bg-white/90 dark:hover:bg-white/10 transition"
        >
          <NuxtImg
            :src="g.thumbnail"
            :alt="g.name"
            width="1600"
            height="900"
            sizes="(max-width: 768px) 100vw, 420px"
            class="h-44 w-full object-cover bg-black/5 dark:bg-black/30"
            loading="lazy"
          />

          <div class="p-4">
            <div class="flex items-center justify-between gap-2">
              <div class="font-semibold text-black dark:text-white">{{ g.name }}</div>
              <span class="text-xs text-black/60 dark:text-white/60" v-if="g.estTime">{{ g.estTime }}</span>
            </div>

            <div class="mt-1 text-sm text-black/70 dark:text-white/70">
              {{ g.shortPitch }}
            </div>

            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <span
                v-if="g.genre"
                class="px-2 py-1 rounded-full border border-black/10 dark:border-white/10
                       bg-black/5 dark:bg-black/30 text-black/70 dark:text-white/70"
              >
                {{ g.genre }}
              </span>

              <span
                v-if="g.difficulty"
                class="px-2 py-1 rounded-full border border-black/10 dark:border-white/10
                       bg-black/5 dark:bg-black/30 text-black/70 dark:text-white/70"
              >
                {{ g.difficulty }}
              </span>

              <span
                v-if="g.leaderboard"
                class="px-2 py-1 rounded-full border border-emerald-600/20 dark:border-emerald-400/20
                       bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              >
                Leaderboard
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- All games -->
    <div class="mt-10">
      <div class="text-sm uppercase tracking-wider text-black/60 dark:text-white/60">All Games</div>

      <div class="mt-3 grid gap-4 md:grid-cols-3">
        <NuxtLink
          v-for="g in filtered"
          :key="g.slug"
          :to="`/arcade/${g.slug}`"
          class="group overflow-hidden rounded-2xl border border-black/10 dark:border-white/10
                 bg-white/70 dark:bg-white/5 backdrop-blur
                 hover:bg-white/90 dark:hover:bg-white/10 transition"
        >
          <NuxtImg
            :src="g.thumbnail"
            :alt="g.name"
            width="1600"
            height="900"
            sizes="(max-width: 768px) 100vw, 420px"
            class="h-44 w-full object-cover bg-black/5 dark:bg-black/30"
            loading="lazy"
          />

          <div class="p-4">
            <div class="flex items-center justify-between gap-2">
              <div class="font-semibold text-black dark:text-white">{{ g.name }}</div>
              <span class="text-xs text-black/60 dark:text-white/60" v-if="g.estTime">{{ g.estTime }}</span>
            </div>

            <div class="mt-1 text-sm text-black/70 dark:text-white/70">
              {{ g.shortPitch }}
            </div>

            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <span
                v-if="g.genre"
                class="px-2 py-1 rounded-full border border-black/10 dark:border-white/10
                       bg-black/5 dark:bg-black/30 text-black/70 dark:text-white/70"
              >
                {{ g.genre }}
              </span>

              <span
                v-if="g.difficulty"
                class="px-2 py-1 rounded-full border border-black/10 dark:border-white/10
                       bg-black/5 dark:bg-black/30 text-black/70 dark:text-white/70"
              >
                {{ g.difficulty }}
              </span>

              <span
                v-if="g.leaderboard"
                class="px-2 py-1 rounded-full border border-emerald-600/20 dark:border-emerald-400/20
                       bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              >
                Leaderboard
              </span>

              <span
                v-if="g.embedAllowed"
                class="px-2 py-1 rounded-full border border-black/10 dark:border-white/10
                       bg-white/60 dark:bg-white/5 text-black/70 dark:text-white/70"
              >
                Embeddable
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>

      <div v-if="filtered.length === 0" class="mt-10 text-center text-black/60 dark:text-white/60">
        No games match your filters.
      </div>
    </div>
  </UContainer>
</template>
