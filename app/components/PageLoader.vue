<script setup lang="ts">
const loader = usePageLoader()

const pct = computed(() => Math.round((loader.progress.value || 0) * 100))
</script>

<template>
  <!-- Top bar + subtle overlay (overlay only when loading) -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="loader.visible.value" class="fixed inset-0 z-[9999] pointer-events-none">
        <!-- subtle overlay -->
        <div class="absolute inset-0 bg-black/5 dark:bg-black/20" />

        <!-- top progress bar -->
        <div class="absolute top-0 left-0 right-0 h-[3px] bg-black/10 dark:bg-white/10">
          <div
            class="h-full bg-black dark:bg-white transition-[width] duration-150 ease-out"
            :style="{ width: `${pct}%` }"
          />
        </div>

        <!-- small status pill -->
        <div class="absolute top-3 right-3">
          <div
            class="px-3 py-1.5 rounded-full text-xs font-medium
                   border border-black/10 bg-white/80 text-black/80
                   dark:border-white/10 dark:bg-black/40 dark:text-white/80
                   backdrop-blur"
          >
            Loading… <span class="tabular-nums opacity-70">{{ pct }}%</span>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 160ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
