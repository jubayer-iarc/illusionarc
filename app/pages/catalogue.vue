<!-- app/pages/catalogue.vue -->
<script setup lang="ts">
useHead({
  title: 'Game Catalogue — illusion Arc',
  meta: [
    {
      name: 'description',
      content:
        'Explore Illusion Arc games with full metadata, controls, platform info, and direct play links. Click a game to expand details.'
    }
  ]
})

definePageMeta({
  layout: 'catalogue'
})

type Game = {
  id: string
  title: string
  url: string
  platform: string
  genre: string[]
  orientation: string
  description: string
  features: string[]
  mechanics?: string[]
  controls: string
  integrationNote: string
  thumbnailsLink?: string
  featureGraphicsLink?: string
  icon?: string // small icon shown when collapsed
}

const games = ref<Game[]>([
  {
    id: 'boss-rush-neon-arena',
    title: 'Boss Rush – Neon Arena',
    url: 'https://boss-rush.illusionarc.com',
    platform: 'HTML5 Web (Desktop + Mobile compatible)',
    genre: ['Arcade', 'Action', 'Survival'],
    orientation: 'Landscape / Portrait',
    description:
      'Boss Rush: Neon Arena is a high-speed bullet-hell reflex experience where a glowing stick-figure hero faces endless bosses inside a pulsing synthwave arena. With no minions and no traditional levels, the game focuses purely on rhythm, reaction, and survival through consecutive boss encounters.',
    features: [
      'Pure boss-fight gameplay: fast, skill-based, and intense',
      'Tap-to-dodge mechanics with cinematic slow-motion bursts',
      'Distinct boss personalities and attack patterns',
      'Neon retro visual identity',
      'Quick-play format suitable for mobile and streaming sessions'
    ],
    controls: 'Keyboard and touch movement (mobile supported)',
    integrationNote:
      'HTML/Web build, iframe-friendly, fullscreen supported, ready for leaderboard/API integration',
    icon: '/img/boss-rush/boss-rush-icon.png',
    thumbnailsLink: 'Boss-Rush Thumbnails',
    featureGraphicsLink: '/img/boss-rush/boss-rush-thumbnail.png'
  },
  {
    id: 'block-smash',
    title: 'Block Smash',
    url: 'https://blocksmash.illusionarc.com',
    platform: 'HTML5 Web (Desktop + Mobile compatible)',
    genre: ['Puzzle', 'Casual'],
    orientation: 'Portrait',
    description:
      'Block Smash is an engaging grid-based puzzle experience where players strategically place block shapes within a 9×9 board divided into 3×3 zones. By completing rows, columns, or zones, players clear space, accumulate points, trigger color transformations, and pursue bonus rewards through efficient spatial planning.',
    mechanics: [
      '9×9 grid with nine 3×3 zones',
      'Drag-and-drop block placement',
      'Line and zone clearing scoring system',
      'Dynamic color transformation feedback',
      'Color-based bonus clearing system'
    ],
    features: [
      'Fast to learn, deep to master',
      'Mobile-first puzzle loop',
      'Satisfying clears with visual feedback',
      'Perfect for quick sessions'
    ],
    controls: 'Drag-and-drop interaction (mobile-first supported)',
    integrationNote:
      'HTML/Web build, iframe-friendly, lightweight, and ready for leaderboard/API integration',
    icon: '/img/block-smash/block-smash-icon.png',
    thumbnailsLink: 'Block-Smash Thumbnails',
    featureGraphicsLink: '/img/block-smash/block-smash-thumbnail.jpg'
  }
])

/* UI: search + filter + expand */
const q = ref('')
const genreFilter = ref<string>('All')

const allGenres = computed(() => {
  const set = new Set<string>()
  for (const g of games.value) for (const k of g.genre) set.add(k)
  return ['All', ...Array.from(set).sort()]
})

const filtered = computed(() => {
  const query = q.value.trim().toLowerCase()
  return games.value.filter((g) => {
    const matchesQuery =
      !query ||
      g.title.toLowerCase().includes(query) ||
      g.description.toLowerCase().includes(query) ||
      g.genre.join(' ').toLowerCase().includes(query)

    const matchesGenre = genreFilter.value === 'All' || g.genre.includes(genreFilter.value)
    return matchesQuery && matchesGenre
  })
})

/** ✅ At landing no one will be expanded */
const openId = ref<string | null>(null)

function toggle(id: string) {
  openId.value = openId.value === id ? null : id
}

function hostname(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function isHttpLink(v?: string) {
  return !!v && /^https?:\/\//i.test(v)
}
</script>

<template>
  <div class="min-h-dvh">
    <UContainer class="py-10">
      <!-- Header -->
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--app-fg)]">
          Game Catalogue
        </h1>
        <p class="text-sm md:text-base text-black/60 dark:text-white/60 max-w-3xl">
          Click a game to expand full metadata, controls, platform details, integration notes, and quick links.
        </p>
      </div>

      <!-- Controls -->
      <div class="mt-6 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div class="md:col-span-8">
          <UInput
            v-model="q"
            icon="i-heroicons-magnifying-glass-20-solid"
            placeholder="Search games (title, genre, description)..."
          />
        </div>
        <div class="md:col-span-4">
          <USelect v-model="genreFilter" :options="allGenres" />
        </div>
      </div>

      <!-- List -->
      <div class="mt-8 space-y-4">
        <div
          v-for="g in filtered"
          :key="g.id"
          class="rounded-2xl border border-black/10 dark:border-white/10
                 bg-white/60 dark:bg-black/20 backdrop-blur
                 overflow-hidden shadow-sm"
        >
          <!-- Card header -->
          <button
            type="button"
            class="w-full text-left px-5 py-4 flex items-center justify-between gap-4
                   hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition"
            @click="toggle(g.id)"
          >
            <div class="min-w-0 flex items-center gap-3">
              <!-- Icon when collapsed -->
              <div v-if="openId !== g.id" class="shrink-0">
                <div
                  class="h-10 w-10 rounded-xl border border-black/10 dark:border-white/10
                         bg-white/70 dark:bg-black/30 overflow-hidden flex items-center justify-center"
                >
                  <img
                    v-if="g.icon"
                    :src="g.icon"
                    :alt="`${g.title} icon`"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <UIcon
                    v-else
                    name="i-heroicons-sparkles-20-solid"
                    class="h-5 w-5 text-black/60 dark:text-white/60"
                  />
                </div>
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-base md:text-lg font-semibold truncate">{{ g.title }}</span>
                  <UBadge variant="soft" color="gray">{{ g.orientation }}</UBadge>
                  <UBadge v-for="tag in g.genre" :key="tag" variant="subtle" color="primary">
                    {{ tag }}
                  </UBadge>
                </div>

                <div class="mt-1 text-xs md:text-sm text-black/60 dark:text-white/60">
                  <span class="font-medium">{{ g.platform }}</span>
                  <span class="mx-2">•</span>
                  <span class="truncate">{{ hostname(g.url) }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <UButton
                :to="g.url"
                target="_blank"
                rel="noopener"
                size="sm"
                color="primary"
                variant="soft"
                @click.stop
              >
                Play
              </UButton>

              <UIcon
                :name="openId === g.id ? 'i-heroicons-chevron-up-20-solid' : 'i-heroicons-chevron-down-20-solid'"
                class="h-5 w-5 text-black/50 dark:text-white/60"
              />
            </div>
          </button>

          <!-- Expanded body -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div v-if="openId === g.id" class="px-5 pb-5">
              <!-- Feature graphic after expansion -->
              <div class="pt-4">
                <div
                  class="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden
                         bg-white/70 dark:bg-black/30"
                >
                  <img
                    v-if="g.featureGraphicsLink"
                    :src="g.featureGraphicsLink"
                    :alt="`${g.title} feature graphic`"
                    class="w-full h-[180px] md:h-[260px] object-cover"
                    loading="lazy"
                  />
                  <div v-else class="p-6 text-sm text-black/50 dark:text-white/50">
                    Add a feature graphic for this game (set <code>featureGraphicsLink</code>).
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5">
                <!-- Left -->
                <div class="lg:col-span-8 space-y-4">
                  <div>
                    <div class="text-sm font-semibold mb-1">Description</div>
                    <p class="text-sm md:text-base text-black/70 dark:text-white/70 leading-relaxed">
                      {{ g.description }}
                    </p>
                  </div>

                  <div>
                    <div class="text-sm font-semibold mb-2">Key Features</div>
                    <ul class="list-disc pl-5 space-y-1 text-sm md:text-base text-black/70 dark:text-white/70">
                      <li v-for="f in g.features" :key="f">{{ f }}</li>
                    </ul>
                  </div>

                  <div v-if="g.mechanics?.length">
                    <div class="text-sm font-semibold mb-2">Game Mechanics</div>
                    <ul class="list-disc pl-5 space-y-1 text-sm md:text-base text-black/70 dark:text-white/70">
                      <li v-for="m in g.mechanics" :key="m">{{ m }}</li>
                    </ul>
                  </div>
                </div>

                <!-- Right -->
                <div class="lg:col-span-4">
                  <div
                    class="rounded-2xl border border-black/10 dark:border-white/10
                           bg-white/70 dark:bg-black/30 p-4 space-y-3"
                  >
                    <div class="text-sm font-semibold">Metadata</div>

                    <div class="text-sm text-black/70 dark:text-white/70 space-y-2">
                      <div class="flex items-start justify-between gap-3">
                        <span class="text-black/50 dark:text-white/50">URL</span>
                        <a
                          :href="g.url"
                          target="_blank"
                          rel="noopener"
                          class="text-right underline underline-offset-4 hover:opacity-80"
                        >
                          {{ g.url }}
                        </a>
                      </div>

                      <div class="flex items-start justify-between gap-3">
                        <span class="text-black/50 dark:text-white/50">Platform</span>
                        <span class="text-right">{{ g.platform }}</span>
                      </div>

                      <div class="flex items-start justify-between gap-3">
                        <span class="text-black/50 dark:text-white/50">Orientation</span>
                        <span class="text-right">{{ g.orientation }}</span>
                      </div>

                      <div class="flex items-start justify-between gap-3">
                        <span class="text-black/50 dark:text-white/50">Controls</span>
                        <span class="text-right">{{ g.controls }}</span>
                      </div>

                      <div class="pt-2 border-t border-black/10 dark:border-white/10">
                        <div class="text-black/50 dark:text-white/50 mb-1">Integration Note</div>
                        <div>{{ g.integrationNote }}</div>
                      </div>
                    </div>

                    <div class="flex flex-col gap-2 pt-2">
                      <UButton :to="g.url" target="_blank" rel="noopener" color="primary" variant="solid">
                        Open Game
                      </UButton>

                      <UButton
                        v-if="g.thumbnailsLink"
                        :to="isHttpLink(g.thumbnailsLink) ? g.thumbnailsLink : undefined"
                        :disabled="!isHttpLink(g.thumbnailsLink)"
                        target="_blank"
                        rel="noopener"
                        color="gray"
                        variant="soft"
                      >
                        Thumbnails Link
                      </UButton>

                      <div
                        v-if="g.thumbnailsLink && !isHttpLink(g.thumbnailsLink)"
                        class="text-xs text-black/50 dark:text-white/50"
                      >
                        Replace “{{ g.thumbnailsLink }}” with a real URL (https://...) when you upload thumbnails.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Optional embed snippet -->
              <div class="mt-5 rounded-2xl border border-black/10 dark:border-white/10 p-4 bg-white/50 dark:bg-black/20">
                <div class="flex items-center justify-between gap-3">
                  <div class="text-sm font-semibold">Embed Snippet (optional)</div>
                  <UBadge variant="soft" color="gray">iframe-friendly</UBadge>
                </div>
                <pre class="mt-3 text-xs md:text-sm overflow-auto rounded-xl p-3 bg-black/90 text-white/80"><code>&lt;iframe
  src="{{ g.url }}"
  style="width: 100%; height: 720px; border: 0;"
  allow="fullscreen"
  loading="lazy"
&gt;&lt;/iframe&gt;</code></pre>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Empty state -->
        <div
          v-if="filtered.length === 0"
          class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 p-8 text-center"
        >
          <div class="text-base font-semibold">No games found</div>
          <p class="text-sm text-black/60 dark:text-white/60 mt-1">
            Try a different keyword or change the genre filter.
          </p>
        </div>

        <!-- Note at the end -->
          <div class="flex items-start gap-3">
            <div class="mt-0.5">
              <UIcon
                name="i-heroicons-information-circle-20-solid"
                class="h-5 w-5 text-black/60 dark:text-white/60"
              />
            </div>
            <p class="text-sm md:text-base text-black/60 dark:text-white/60 max-w-3xl">
              This catalogue will be expanded with additional games over time.
            </p>
          </div>
        </div>
    </UContainer>
  </div>
</template>