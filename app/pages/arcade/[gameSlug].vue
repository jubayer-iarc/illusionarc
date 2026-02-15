<script setup lang="ts">
import { GAMES } from '@/data/games'
import GamePlayer from '@/components/arcade/GamePlayer.vue'
import TopScoresPanel from '@/components/arcade/TopScoresPanel.vue'

definePageMeta({
  middleware: ['require-play-auth'] // only blocks ?play=1
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const user = useSupabaseUser() // authenticated user

const slug = computed(() => String(route.params.gameSlug || ''))

/* ---------------- TOURNAMENT RULE ----------------
   If a tournament is LIVE for this game, redirect to tournament page.
-------------------------------------------------- */
type LiveRow = { gameSlug: string; tournamentSlug: string }

async function redirectIfLiveTournament() {
  try {
    const res = await $fetch<{ rows?: LiveRow[] }>('/api/tournaments/live-games')
    const match = (res?.rows || []).find((r) => r.gameSlug === slug.value)
    if (match?.tournamentSlug) {
      return navigateTo(`/tournaments/${match.tournamentSlug}`)
    }
  } catch {}
}
await redirectIfLiveTournament()

const game = computed(() => GAMES.find(g => g.slug === slug.value))
if (!game.value) throw createError({ statusCode: 404, statusMessage: 'Game not found' })

useHead(() => ({
  title: `${game.value!.name} — Arcade`,
  meta: [{ name: 'description', content: game.value!.shortPitch }]
}))

/* ---------------- PRO / Subscription Gate ----------------
   Only allow Pro games if user has active subscription
---------------------------------------------------------- */
async function checkProAccess() {
  if (!game.value?.pro) return true // free game
  if (!user.value) return false // not logged in → blocked

  try {
    const state = await $fetch<{ active: boolean }>('/api/subscriptions/me', {
      credentials: 'include'
    })
    return !!state.active
  } catch {
    return false
  }
}

/* ---------------- iOS + fullscreen ---------------- */
const isIOS = computed(() => {
  if (import.meta.server) return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOS = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1
  return iOS || iPadOS
})
const showFullscreen = computed(() => !isIOS.value)

/* ---------------- Player state ---------------- */
const playerName = useState<string>('playerName', () => 'Player')
const lastScore = ref<number | null>(null)
const saving = ref(false)

async function onScore(score: number) {
  lastScore.value = score
  saving.value = true
  try {
    await $fetch('/api/leaderboard/submit', {
      method: 'POST',
      credentials: 'include',
      body: { gameSlug: game.value!.slug, score }
    })
    toast.add({ title: 'Score saved', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: 'Failed to save score',
      description: e?.data?.message || e?.message || 'Try again',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

/* ---------------- Lobby state ---------------- */
const liked = ref(false)
const fav = ref(false)
const showControls = ref(false)

onMounted(() => {
  liked.value = localStorage.getItem(`like_${game.value!.slug}`) === '1'
  fav.value = localStorage.getItem(`fav_${game.value!.slug}`) === '1'
})
watch(liked, (v) => localStorage.setItem(`like_${game.value!.slug}`, v ? '1' : '0'))
watch(fav, (v) => localStorage.setItem(`fav_${game.value!.slug}`, v ? '1' : '0'))

/* ---------------- Play state ---------------- */
const playing = computed(() => route.query.play === '1')
const playerKey = ref(0)
const playerRef = ref<InstanceType<typeof GamePlayer> | null>(null)

async function openPlay() {
  // Pro game check
  const hasAccess = await checkProAccess()
  if (!hasAccess) {
    return navigateTo(`/subscribe?redirect=${encodeURIComponent(route.fullPath)}`)
  }

  if (!user.value) {
    const next = router.resolve({ path: route.path, query: { ...route.query, play: '1' } }).href
    toast.add({ title: 'Login required', description: 'Please login to play.', color: 'info' })
    return navigateTo({ path: '/login', query: { next } })
  }

  router.push({ query: { ...route.query, play: '1' } })
}

function closePlay() {
  const q: Record<string, any> = { ...route.query }
  delete q.play
  router.replace({ query: q })
}

function requestFullscreen() {
  if (!showFullscreen.value) return
  playerRef.value?.requestFullscreen?.()
}

function hardStop() {
  playerRef.value?.stop?.()
  playerKey.value++
}

watch(
  playing,
  async (v) => {
    if (v) {
      await nextTick()
      playerRef.value?.start?.()
    } else {
      hardStop()
    }
  },
  { immediate: true }
)

function onVisibilityChange() {
  if (!playing.value) return
  if (document.visibilityState === 'visible') playerRef.value?.start?.()
}
function onPageHide() {
  hardStop()
}
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', onPageHide)
})

/* ---------------- Rating ---------------- */
const ratingValue = computed(() => game.value?.rating?.value ?? 0)
const ratingCount = computed(() => game.value?.rating?.count ?? 0)
const fullStars = computed(() => Math.floor(ratingValue.value))

/* ---------------- Share / Embed ---------------- */
const origin = computed(() => (import.meta.client ? window.location.origin : ''))
const shareUrl = computed(() => `${origin.value}/arcade/${game.value!.slug}`)
const embedUrl = computed(() => `${origin.value}/arcade/${game.value!.slug}?embed=1`)
const embedCode = computed(() => {
  const aspect = game.value!.embed.aspectRatio || '16/9'
  return `<iframe src="${embedUrl.value}" width="100%" style="aspect-ratio:${aspect}; border:0; border-radius:16px; overflow:hidden" allow="autoplay; fullscreen; gamepad" allowfullscreen loading="lazy"></iframe>`
})

async function copy(text: string) {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: 'Copied!', description: 'Copied to clipboard.', color: 'success' })
  } catch {
    prompt('Copy this:', text)
  }
}

async function nativeShare() {
  if (!import.meta.client) return
  const url = shareUrl.value
  if (navigator.share) {
    await navigator.share({ title: game.value!.name, text: game.value!.shortPitch, url })
  } else {
    await copy(url)
  }
}
</script>

<template>
  <UContainer class="py-10 md:py-14">
    <div class="flex flex-col gap-2">
      <h1 class="text-3xl md:text-5xl font-semibold tracking-tight">{{ game!.name }}</h1>
      <p class="opacity-80 max-w-2xl">{{ game!.shortPitch }}</p>

      <div class="mt-2 flex flex-wrap gap-2 text-xs">
        <span v-if="game!.genre" class="px-2 py-1 rounded-full bg-black/30 border border-white/10">{{ game!.genre }}</span>
        <span v-if="game!.difficulty" class="px-2 py-1 rounded-full bg-black/30 border border-white/10">{{ game!.difficulty }}</span>
        <span v-if="game!.leaderboard" class="px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/20">Leaderboard</span>
        <span v-if="game!.embedAllowed" class="px-2 py-1 rounded-full bg-white/5 border border-white/10">Embeddable</span>
        <span v-if="game!.estTime" class="px-2 py-1 rounded-full bg-white/5 border border-white/10">{{ game!.estTime }}</span>
        <span v-if="game!.pro" class="px-2 py-1 rounded-full border border-amber-400/30 bg-amber-400/15 text-amber-600 dark:text-amber-300">PRO</span>
      </div>
    </div>

    <!-- Lobby Card -->
    <UCard class="mt-6 bg-white/5 border-white/10 overflow-hidden">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
          <NuxtImg
            :src="game!.thumbnail"
            format="webp"
            width="1200"
            height="675"
            sizes="(max-width: 768px) 100vw, 520px"
            class="w-full h-48 md:h-full object-cover"
            loading="eager"
            fetchpriority="high"
            alt="Game preview"
          />
        </div>

        <div class="flex flex-col justify-between gap-4">
          <!-- Rating -->
          <div class="flex items-end gap-4">
            <div class="flex items-center gap-1 pt-1">
              <UIcon
                v-for="i in 5"
                :key="i"
                :name="i <= fullStars ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                class="w-5 h-5 opacity-90"
              />
            </div>
            <div class="flex-1">
              <div class="text-sm opacity-80">
                <b class="opacity-100">{{ Number(ratingValue).toFixed(1) }}</b>
                <span class="opacity-70"> ({{ ratingCount }} ratings)</span>
              </div>
            </div>
          </div>

          <div class="flex-1">
            <p class="mt-2 text-sm opacity-80 leading-relaxed">
              {{ game!.description || game!.shortPitch }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2">
            <UButton color="primary" variant="solid" size="lg" @click="openPlay">
              <UIcon
                v-if="game!.pro"
                name="i-ph-crown-fill"
                class="w-5 h-5 text-amber-400"
              />
              <UIcon
                v-else
                name="i-heroicons-play-solid"
                class="w-5 h-5"
              />
              Play
            </UButton>


            <UButton variant="soft" size="lg" @click="liked = !liked" :aria-pressed="liked">
              <UIcon :name="liked ? 'i-heroicons-heart-solid' : 'i-heroicons-heart'" class="w-5 h-5" />
              Like
            </UButton>

            <UButton variant="soft" size="lg" @click="fav = !fav" :aria-pressed="fav">
              <UIcon :name="fav ? 'i-heroicons-bookmark-solid' : 'i-heroicons-bookmark'" class="w-5 h-5" />
              Favourite
            </UButton>

            <UButton variant="ghost" size="lg" @click="showControls = true">
              <UIcon name="i-heroicons-information-circle" class="w-5 h-5" />
              Controls
            </UButton>
          </div>

          <div class="text-sm opacity-70" v-if="lastScore !== null">
            Last score: <b class="opacity-100">{{ lastScore }}</b>
            <span v-if="saving" class="ml-2 opacity-60">Saving…</span>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Share / Embed -->
    <UCard v-if="game!.embedAllowed" class="mt-6 bg-white/5 border-white/10">
      <template #header>
        <div class="text-lg font-semibold">Share & Embed</div>
      </template>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-3">
          <div class="text-sm opacity-80">Share this game link or embed it on your website.</div>
          <div class="flex flex-wrap gap-2">
            <UButton color="primary" variant="solid" @click="nativeShare">
              <UIcon name="i-heroicons-share" class="w-5 h-5" /> Share
            </UButton>
            <UButton variant="soft" @click="copy(shareUrl)">
              <UIcon name="i-heroicons-link" class="w-5 h-5" /> Copy Link
            </UButton>
            <UButton variant="soft" @click="copy(embedCode)">
              <UIcon name="i-heroicons-clipboard-document" class="w-5 h-5" /> Copy Embed Code
            </UButton>
          </div>
        </div>

        <div class="rounded-xl border border-white/10 bg-black/30 p-3">
          <div class="text-xs opacity-70 mb-2">Embed code</div>
          <pre class="text-xs whitespace-pre-wrap break-words opacity-90 select-text">{{ embedCode }}</pre>
        </div>
      </div>
    </UCard>

    <!-- How to play + Leaderboard -->
    <div class="mt-10 grid gap-6 md:grid-cols-3">
      <div class="md:col-span-2 grid gap-6">
        <UCard class="bg-white/5 border-white/10">
          <template #header><div class="text-lg font-semibold">How to play</div></template>
          <ul class="space-y-2 opacity-85">
            <li v-for="(c, i) in game!.controls" :key="i">• {{ c }}</li>
          </ul>
        </UCard>
      </div>

      <ClientOnly>
        <TopScoresPanel v-if="game!.leaderboard" :game-slug="game!.slug" :limit="3" />
      </ClientOnly>
    </div>

    <!-- Controls Modal -->
    <UModal v-model="showControls">
      <UCard class="mt-6 bg-white/5 border-white/10">
        <template #header>
          <div class="text-lg font-semibold">Controls</div>
        </template>
        <ul class="space-y-2 opacity-85">
          <li v-for="(c, i) in game!.controls" :key="i">• {{ c }}</li>
        </ul>
      </UCard>
    </UModal>

    <!-- Fullscreen Overlay -->
    <Teleport to="body">
      <div v-if="playing" class="fixed inset-0 z-[200] bg-black">
        <div class="absolute left-0 right-0 top-0 z-[220] pointer-events-auto border-b border-white/10 bg-black/70 backdrop-blur"
             :style="{ paddingTop: 'env(safe-area-inset-top)' }">
          <div class="h-14 px-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-semibold">{{ game!.name }}</span>
              <span class="text-xs opacity-70">Play</span>
            </div>
            <div class="flex items-center gap-2">
              <UButton v-if="showFullscreen" variant="ghost" @click="requestFullscreen">
                <UIcon name="i-heroicons-arrows-pointing-out" class="w-5 h-5" /> Fullscreen
              </UButton>
              <UButton variant="ghost" @click="closePlay">
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5" /> Close
              </UButton>
            </div>
          </div>
        </div>

        <div class="absolute inset-0 z-[210]"
             :style="{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)', paddingBottom: 'env(safe-area-inset-bottom)' }">
          <div class="h-full p-2">
            <GamePlayer
              :key="playerKey"
              ref="playerRef"
              :game="game!"
              :defer="true"
              :fullscreen="true"
              @score="(e) => onScore(e.score)"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </UContainer>
</template>
