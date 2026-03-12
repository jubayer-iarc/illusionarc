<script setup lang="ts">
const nuxtApp = useNuxtApp()
const route = useRoute()

const reducedMotion = ref(false)

const routeLoader = nuxtApp.$routeLoader ?? {
  isLoading: ref(false),
  progress: ref(0)
}

const isTournamentEmbedPage = computed(() => {
  return route.path.startsWith('/tournaments/embed/')
})

const isArcadeChildPage = computed(() => {
  return route.path.startsWith('/arcade/')
})

const shouldHideLoader = computed(() => {
  return isTournamentEmbedPage.value || isArcadeChildPage.value
})

onMounted(() => {
  reducedMotion.value =
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
})

const showOverlay = computed(() => {
  if (shouldHideLoader.value) return false
  return routeLoader.isLoading.value
})

const p = computed(() => {
  if (shouldHideLoader.value) return 0
  return routeLoader.progress.value
})
</script>

<template>
  <div
    v-if="!shouldHideLoader"
    class="route-progress"
    :class="{ 'is-on': showOverlay, reduced: reducedMotion }"
    aria-hidden="true"
  >
    <div class="route-progress__bar" :style="{ transform: `scaleX(${p})` }" />
    <div
      class="route-progress__glow"
      :style="{ left: `${Math.max(0, p * 100 - 12)}%` }"
    />
  </div>

  <Teleport to="body">
    <Transition name="route-overlay">
      <div
        v-if="showOverlay"
        class="route-overlay"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="route-overlay__card">
          <div class="orb" />
          <div class="text">
            <div class="title">illusion Arc</div>
            <div class="sub">Loading…</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.route-progress {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 3px;
  z-index: 9999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 140ms ease;
}

.route-progress.is-on {
  opacity: 1;
}

.route-progress__bar {
  height: 100%;
  width: 100%;
  transform-origin: 0 50%;
  transform: scaleX(0);
  transition: transform 140ms ease;
  background: linear-gradient(90deg, #24f0ff, #a855f7, #ff3df2);
  box-shadow: 0 0 18px rgba(168, 85, 247, 0.45);
}

.route-progress__glow {
  position: absolute;
  top: -6px;
  width: 56px;
  height: 16px;
  filter: blur(10px);
  background: radial-gradient(circle, rgba(36, 240, 255, 0.8), rgba(168, 85, 247, 0));
  opacity: 0.9;
}

.route-progress.reduced .route-progress__bar {
  transition: none;
}

.route-progress.reduced .route-progress__glow {
  display: none;
}

.route-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: grid;
  place-items: center;
  background: rgba(7, 10, 18, 0.72);
  backdrop-filter: blur(10px);
}

.route-overlay__card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 14, 24, 0.65);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
}

.orb {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, #24f0ff, #a855f7 55%, #070a12 72%);
  box-shadow:
    0 0 28px rgba(36, 240, 255, 0.25),
    0 0 42px rgba(168, 85, 247, 0.22);
  animation: orb 900ms ease-in-out infinite;
}

@keyframes orb {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-2px) scale(1.04);
  }
}

.text .title {
  font-weight: 700;
  letter-spacing: 0.2px;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.1;
}

.text .sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  margin-top: 2px;
}

.route-overlay-enter-active,
.route-overlay-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.route-overlay-enter-from,
.route-overlay-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>