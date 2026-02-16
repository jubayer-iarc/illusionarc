<!-- app/pages/arcade/index.vue -->
<script setup lang="ts">
import { GAMES } from '@/data/games'
import TournamentAdBanner from '~/components/tournaments/TournamentAdBanner.vue'

useHead({ title: 'Arcade' })

const supabase = useSupabaseClient()
const authUser = useSupabaseUser()
const toast = useToast()

/* ---------------- Mandatory phone gate (after login) ---------------- */
const checkingPhone = ref(true)

async function requirePhoneOrRedirect() {
  if (!import.meta.client) return

  checkingPhone.value = true
  try {
    const {
      data: { user },
      error: userErr
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return

    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('phone')
      .eq('user_id', user.id)
      .maybeSingle()

    const phone = String(data?.phone || '').trim()
    if (error || !phone) {
      toast.add({
        title: 'Phone number required',
        description: 'Please add your phone number to continue.',
        color: 'warning'
      })
      return navigateTo('/profile?needPhone=1&next=/arcade', { replace: true })
    }
  } finally {
    checkingPhone.value = false
  }
}

onMounted(requirePhoneOrRedirect)

/* ---------------- Tournament exclusivity ---------------- */
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

await loadLiveGames()

const arcadeSource = computed(() => GAMES.filter(g => !liveGameSet.value.has(g.slug)))
const hasLiveTournaments = computed(() => liveRows.value.length > 0)

/* ---------------- Filters ---------------- */
const q = ref('')
const genre = ref<string>('all')
const onlyFeatured = ref(false)

const genres = computed(() => {
  const set = new Set<string>()
  arcadeSource.value.forEach(g => g.genre && set.add(g.genre))
  return ['all', ...Array.from(set)]
})

watchEffect(() => {
  if (genre.value !== 'all' && !genres.value.includes(genre.value)) genre.value = 'all'
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

function accessLabel(isPro?: boolean) {
  return isPro ? 'PRO' : 'FREE'
}
</script>

<template>
  <UContainer class="py-10">
    <!-- ✅ Top tournament ad -->
    <div class="mb-6">
      <TournamentAdBanner slot="arcade_sidebar" />
    </div>

    <!-- ✅ gate overlay -->
    <div
      v-if="checkingPhone && authUser?.id"
      class="mb-6 rounded-2xl border border-black/10 dark:border-white/10
             bg-white/70 dark:bg-white/5 backdrop-blur p-4"
    >
      <div class="flex items-center gap-3">
        <div
          class="h-9 w-9 rounded-xl border border-black/10 dark:border-white/10
                 bg-black/5 dark:bg-black/30 grid place-items-center"
        >
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

    <!-- Header -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-3xl font-semibold text-black dark:text-white">Arcade</h1>
        <p class="mt-2 text-black/70 dark:text-white/70">Play, score, and climb the leaderboard.</p>
      </div>

      <!-- Filters / actions (mobile stacks, desktop aligns) -->
      <div class="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[240px_160px_auto_auto_auto_auto] lg:items-center">
        <UInput v-model="q" placeholder="Search games…" class="w-full" />
        <USelect v-model="genre" :options="genres" class="w-full" />
        <div class="flex items-center">
          <UCheckbox v-model="onlyFeatured" label="Featured" />
        </div>

        <UButton to="/arcade/leaderboard" variant="solid" color="primary" class="w-full lg:w-auto justify-center">
          Leaderboard
        </UButton>
        <UButton to="/subscribe" variant="solid" color="primary" class="w-full lg:w-auto justify-center">
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
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="text-sm text-black/70 dark:text-white/70">
          Some games are currently in a <span class="font-semibold">LIVE tournament</span> and are only playable from
          the <span class="font-semibold">Tournament</span> section.
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton to="/tournaments" variant="solid" color="primary">Go to Tournaments</UButton>
          <UButton variant="soft" @click="loadLiveGames">Refresh</UButton>
        </div>
      </div>
    </div>

    <!-- Featured -->
    <div v-if="featured.length" class="mt-10">
      <div class="text-sm uppercase tracking-wider text-black/60 dark:text-white/60">Featured</div>

      <div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
        <NuxtLink
          v-for="g in featured"
          :key="g.slug"
          :to="`/arcade/${g.slug}`"
          class="group h-full overflow-hidden rounded-2xl border border-black/10 dark:border-white/10
                 bg-white/70 dark:bg-white/5 backdrop-blur
                 hover:bg-white/90 dark:hover:bg-white/10 transition"
        >
          <div class="flex h-full flex-col">
            <NuxtImg
              :src="g.thumbnail"
              :alt="g.name"
              width="1600"
              height="900"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
              class="h-44 w-full object-cover bg-black/5 dark:bg-black/30"
              loading="lazy"
            />

            <div class="flex h-full flex-col p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 font-semibold text-black dark:text-white truncate">
                  {{ g.name }}
                </div>
                <span class="shrink-0 text-xs text-black/60 dark:text-white/60" v-if="g.estTime">
                  {{ g.estTime }}
                </span>
              </div>

              <!-- clamp pitch for uniform height -->
              <div class="mt-1 text-sm text-black/70 dark:text-white/70 line-clamp-2">
                {{ g.shortPitch }}
              </div>

              <!-- Pills stick to bottom -->
              <div class="mt-auto pt-3 flex flex-wrap gap-2 text-xs">
                <!-- PRO/FREE first -->
                <span
                  class="px-2 py-1 rounded-full border border-amber-500/40 bg-amber-400/15
                         font-semibold tracking-wide text-amber-700 dark:text-amber-300"
                >
                  <span class="inline-flex items-center gap-1.5">
                    <UIcon v-if="g.pro" name="i-ph-crown-fill" class="w-3.5 h-3.5" />
                    <span>{{ accessLabel(g.pro) }}</span>
                  </span>
                </span>

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
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- All games -->
    <div class="mt-12">
      <div class="text-sm uppercase tracking-wider text-black/60 dark:text-white/60">All Games</div>

      <div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
        <NuxtLink
          v-for="g in filtered"
          :key="g.slug"
          :to="`/arcade/${g.slug}`"
          class="group h-full overflow-hidden rounded-2xl border border-black/10 dark:border-white/10
                 bg-white/70 dark:bg-white/5 backdrop-blur
                 hover:bg-white/90 dark:hover:bg-white/10 transition"
        >
          <div class="flex h-full flex-col">
            <NuxtImg
              :src="g.thumbnail"
              :alt="g.name"
              width="1600"
              height="900"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
              class="h-44 w-full object-cover bg-black/5 dark:bg-black/30"
              loading="lazy"
            />

            <div class="flex h-full flex-col p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 font-semibold text-black dark:text-white truncate">
                  {{ g.name }}
                </div>
                <span class="shrink-0 text-xs text-black/60 dark:text-white/60" v-if="g.estTime">
                  {{ g.estTime }}
                </span>
              </div>

              <div class="mt-1 text-sm text-black/70 dark:text-white/70 line-clamp-2">
                {{ g.shortPitch }}
              </div>

              <div class="mt-auto pt-3 flex flex-wrap gap-2 text-xs">
                <span
                  class="px-2 py-1 rounded-full border border-amber-500/40 bg-amber-400/15
                         font-semibold tracking-wide text-amber-700 dark:text-amber-300"
                >
                  <span class="inline-flex items-center gap-1.5">
                    <UIcon v-if="g.pro" name="i-ph-crown-fill" class="w-3.5 h-3.5" />
                    <span>{{ accessLabel(g.pro) }}</span>
                  </span>
                </span>

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
          </div>
        </NuxtLink>
      </div>

      <div v-if="filtered.length === 0" class="mt-10 text-center text-black/60 dark:text-white/60">
        No games match your filters.
      </div>
    </div>
  </UContainer>
</template>
