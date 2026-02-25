<script setup lang="ts">
import LiveTournamentBanner from '~/components/tournaments/LiveTournamentBanner.vue'
import UserMenu from '@/components/nav/UserMenu.vue'

const { settings } = useSiteSettings()

// optional: for a true app feel, keep a compact top bar and use bottom tabs
const route = useRoute()

const tabs = computed(() => [
  { label: 'Home', to: '/', icon: 'i-heroicons-home' },
  { label: 'Arcade', to: '/arcade', icon: 'i-heroicons-rocket-launch' },
  { label: 'Tournaments', to: '/tournaments', icon: 'i-heroicons-trophy' },
  { label: 'Work', to: '/work', icon: 'i-heroicons-briefcase' }
])

function isActive(to: string) {
  return route.path === to || (to !== '/' && route.path.startsWith(to))
}
</script>

<template>
  <!-- App-like shell -->
  <div class="min-h-dvh bg-[var(--app-bg)] text-[var(--app-fg)]">
    <!-- Top app bar -->
    <header
        class="sticky top-0 z-50 backdrop-blur
             border-b border-black/10 dark:border-white/5
             bg-white/80 dark:bg-black/35"
        style="padding-top: env(safe-area-inset-top);"
    >
      <UContainer class="py-3 flex flex-col gap-3">
        <LiveTournamentBanner />

        <div class="flex items-center justify-between gap-3">
          <NuxtLink to="/" class="flex items-center gap-2 min-w-0">
            <img
                :src="settings.brand_logo_url || '/android-chrome-512x512.png'"
                :alt="`${settings.brand_name || 'illusion Arc'} Logo`"
                class="h-8 w-8 object-contain"
            />
            <span class="font-semibold tracking-wide truncate">
              {{ settings.brand_name || 'illusion Arc' }}
            </span>
          </NuxtLink>

          <!-- App feel: keep a single profile button -->
          <UserMenu />
        </div>
      </UContainer>
    </header>

    <!-- Main content (reserve space for bottom tab bar) -->
    <main class="pb-20">
      <slot />
    </main>

    <!-- Bottom tab bar -->
    <nav
        class="fixed bottom-0 left-0 right-0 z-50
             border-t border-black/10 dark:border-white/10
             bg-white/85 dark:bg-black/45 backdrop-blur"
        style="padding-bottom: env(safe-area-inset-bottom);"
    >
      <UContainer class="py-2">
        <div class="grid grid-cols-4 gap-2">
          <NuxtLink
              v-for="t in tabs"
              :key="t.to"
              :to="t.to"
              class="flex flex-col items-center justify-center gap-1 rounded-2xl py-2 transition"
              :class="isActive(t.to)
              ? 'bg-black/5 dark:bg-white/10'
              : 'opacity-80 hover:opacity-100'"
          >
            <UIcon :name="t.icon" class="h-5 w-5" />
            <span class="text-[11px] font-medium">{{ t.label }}</span>
          </NuxtLink>
        </div>
      </UContainer>
    </nav>
  </div>
</template>