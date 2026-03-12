<script setup lang="ts">
type Props = {
  image: string
  to: string
  alt?: string
  enabled?: boolean
  showOnlyOnHome?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  alt: 'Tournament banner',
  enabled: true,
  showOnlyOnHome: false
})

const route = useRoute()
const router = useRouter()

const hasShown = useState<boolean>('landing-tournament-banner-shown', () => false)
const isOpen = ref(false)

const blockedPrefixes = [
  '/tournaments',
  '/arcade',
  '/admin',
]

const blockedExactPaths = [
  props.to // also hide on the same tournament page the banner points to
]

const shouldAppearOnThisPage = computed(() => {
  if (!props.enabled) return false

  if (props.showOnlyOnHome && route.path !== '/') return false

  if (blockedExactPaths.includes(route.path)) return false

  if (blockedPrefixes.some(prefix => route.path.startsWith(prefix))) return false

  return true
})

onMounted(() => {
  if (!hasShown.value && shouldAppearOnThisPage.value) {
    isOpen.value = true
    hasShown.value = true
    document.documentElement.classList.add('overflow-hidden')
    document.body.classList.add('overflow-hidden')
  }
})

watch(isOpen, (open) => {
  if (import.meta.client) {
    if (open) {
      document.documentElement.classList.add('overflow-hidden')
      document.body.classList.add('overflow-hidden')
    } else {
      document.documentElement.classList.remove('overflow-hidden')
      document.body.classList.remove('overflow-hidden')
    }
  }
})

watch(
  () => route.path,
  () => {
    if (!shouldAppearOnThisPage.value) {
      isOpen.value = false
    }
  }
)

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.documentElement.classList.remove('overflow-hidden')
    document.body.classList.remove('overflow-hidden')
  }
})

function closeBanner() {
  isOpen.value = false
}

async function goToTournament() {
  isOpen.value = false
  await router.push(props.to)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Tournament promotion"
      >
        <div class="relative w-full max-w-2xl">
          <button
            type="button"
            aria-label="Close banner"
            class="absolute -top-3 -right-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/80 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black"
            @click="closeBanner"
          >
            <Icon name="i-heroicons-x-mark-20-solid" class="h-6 w-6" />
          </button>

          <button
            type="button"
            class="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl"
            @click="goToTournament"
          >
            <NuxtImg
              :src="image"
              :alt="alt"
              class="block max-h-[70vh] w-full object-contain transition duration-300 group-hover:scale-[1.01]"
              sizes="100vw sm:70vw md:600px"
              format="webp"
              preload
            />

            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 py-5 text-left"
            >
              <div class="text-sm font-medium text-white/90 sm:text-base">
                Tap to view tournament
              </div>
            </div>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>