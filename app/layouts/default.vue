<template>
  <div class="min-h-dvh flex flex-col bg-[var(--app-bg)] text-[var(--app-fg)]">
    <!-- Header -->
    <header
      class="sticky top-0 z-50 backdrop-blur
             border-b border-black/10 dark:border-white/5
             bg-white/60 dark:bg-black/20"
    >
      <UContainer class="py-3 flex flex-col gap-3">
        <!-- ✅ Live tournament banner (global) -->
        <ClientOnly>
          <LiveTournamentBanner />
        </ClientOnly>

        <!-- Header row -->
        <div class="flex items-center justify-between gap-3">
          <NuxtLink to="/" class="flex items-center gap-2">
            <!--<UIcon name="i-heroicons-sparkles" class="text-xl" /> -->
            <img src="/android-chrome-512x512.png" alt="illusion Arc Logo" class="h-8 w-8 object-contain" />
            <span class="font-semibold tracking-wide">illusion Arc</span>
          </NuxtLink>

          <nav class="hidden md:flex items-center gap-1">
            <UButton variant="ghost" to="/work">Work</UButton>
            <UButton variant="ghost" to="/services">Services</UButton>
            <UButton variant="ghost" to="/arcade">Arcade</UButton>
            <UButton variant="ghost" to="/tournaments">Tournaments</UButton>
            <UButton variant="ghost" to="/apps">Apps</UButton>
            <UButton variant="ghost" to="/about">About</UButton>
            <UButton variant="ghost" to="/arcade/leaderboard">Leaderboard</UButton>
            <UButton variant="ghost" to="/arcade/winners">Winners</UButton>
          </nav>

          <div class="flex items-center gap-2">
            <UButton class="hidden md:inline-flex" color="primary" to="/contact">
              Contact
            </UButton>

            <!-- Avatar / Login (desktop) -->
            <div class="hidden md:block">
              <UserMenu />
            </div>

            <!-- Mobile menu -->
            <UButton class="md:hidden" variant="ghost" @click="open = true">
              <UIcon name="i-heroicons-bars-3" />
            </UButton>
          </div>
        </div>
      </UContainer>
    </header>

    <!-- Mobile drawer -->
    <USlideover v-model:open="open">
      <template #body>
        <div class="p-4 flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-black/10 dark:border-white/10">
            <div class="text-sm font-semibold text-black/70 dark:text-white/70">Menu</div>
          </div>

          <!-- Avatar/Login inside drawer -->
          <div class="pb-2 border-b border-black/10 dark:border-white/10">
            <!-- Logged out -->
            <UButton
              v-if="!user"
              color="primary"
              variant="soft"
              to="/login"
              icon="i-heroicons-lock-closed"
              @click="open = false"
              class="w-full justify-center"
            >
              Login
            </UButton>

            <!-- Logged in -->
            <div v-else class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="h-10 w-10 overflow-hidden rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  <img
                    v-if="avatarUrl"
                    :src="avatarUrl"
                    alt="Avatar"
                    class="h-full w-full object-cover"
                    referrerpolicy="no-referrer"
                  />
                  <div v-else class="h-full w-full grid place-items-center text-sm font-semibold text-black/80 dark:text-white/90">
                    {{ initials }}
                  </div>
                </div>

                <div class="leading-tight">
                  <div class="text-sm font-semibold text-black dark:text-white">{{ displayName }}</div>
                  <div class="text-xs text-black/60 dark:text-white/60">Account</div>
                </div>
              </div>

              <UButton variant="ghost" icon="i-heroicons-arrow-right-on-rectangle" @click="logout">
                Logout
              </UButton>
            </div>

            <UButton
              v-if="user"
              variant="ghost"
              icon="i-heroicons-user-circle"
              to="/profile"
              class="mt-2 w-full justify-start"
              @click="open = false"
            >
              Edit Profile
            </UButton>
          </div>

          <UButton variant="ghost" to="/work" @click="open=false">Work</UButton>
          <UButton variant="ghost" to="/services" @click="open=false">Services</UButton>
          <UButton variant="ghost" to="/arcade" @click="open=false">Arcade</UButton>
          <UButton variant="ghost" to="/tournaments" @click="open=false">Tournaments</UButton>
          <UButton variant="ghost" to="/apps" @click="open=false">Apps</UButton>
          <UButton variant="ghost" to="/about" @click="open=false">About</UButton>
          <UButton variant="ghost" to="/arcade/leaderboard" @click="open=false">Leaderboard</UButton>
          <UButton variant="ghost" to="/arcade/winners" @click="open=false">Winners</UButton>
          <UButton color="primary" to="/contact" @click="open=false">Contact</UButton>

          <!-- ✅ Theme control removed from drawer (as you requested) -->
        </div>
      </template>
    </USlideover>

    <!-- Page -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-black/10 dark:border-white/5 bg-white/50 dark:bg-black/10">
      <UContainer class="py-10 grid gap-6 md:grid-cols-3">
        <div>
          <div class="font-semibold">illusion Arc</div>
          <div class="text-sm text-black/60 dark:text-white/60 mt-2">
            Games • AR/VR • VFX/CGI • Animation
          </div>
        </div>

        <div class="text-sm">
          <div class="text-black/60 dark:text-white/60 mb-2">Links</div>
          <div class="flex flex-col gap-1">
            <NuxtLink to="/work" class="text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white">Work</NuxtLink>
            <NuxtLink to="/arcade" class="text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white">Arcade</NuxtLink>
            <NuxtLink to="/tournaments" class="text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white">Tournaments</NuxtLink>
            <NuxtLink to="/contact" class="text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white">Contact</NuxtLink>
          </div>
        </div>

        <div class="text-sm">
          <div class="text-black/60 dark:text-white/60 mb-2">Legal</div>
          <div class="flex flex-col gap-1">
            <NuxtLink to="/privacy-policy" class="text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white">Privacy Policy</NuxtLink>
            <NuxtLink to="/terms" class="text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white">Terms & Conditions</NuxtLink>
          </div>
        </div>
      </UContainer>

      <!-- ✅ Footer bottom bar with theme button (good position) -->
      <UContainer class="py-4 border-t border-black/10 dark:border-white/5 flex items-center justify-between gap-3">
        <div class="text-xs text-black/50 dark:text-white/50">
          © {{ new Date().getFullYear() }} illusion Arc
        </div>

        <ClientOnly>
          <UButton
            variant="soft"
            size="sm"
            class="rounded-full"
            :title="`Theme: ${themeLabel} (click to change)`"
            @click="cycleTheme"
          >
            <UIcon :name="themeIcon" class="w-5 h-5" />
            <span class="ml-2">Theme: {{ themeLabel }}</span>
          </UButton>
        </ClientOnly>
      </UContainer>
    </footer>

    <!-- Install Button overlay -->
    <InstallPwaButton />
  </div>
</template>

<script setup lang="ts">
import UserMenu from '@/components/nav/UserMenu.vue'
import LiveTournamentBanner from '~/components/tournaments/LiveTournamentBanner.vue'

const open = ref(false)

// Mobile drawer user info
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const toast = useToast()

const displayName = computed(() => {
  const u: any = user.value
  return (
    u?.user_metadata?.display_name ||
    u?.user_metadata?.full_name ||
    u?.email?.split?.('@')?.[0] ||
    'Player'
  )
})

const avatarUrl = computed(() => {
  const u: any = user.value
  return u?.user_metadata?.avatar_url || ''
})

const initials = computed(() => {
  const n = (displayName.value || '').trim()
  return n ? n.slice(0, 1).toUpperCase() : 'U'
})
watch(
  () => user.value?.id,
  (id) => {
    if (!id) open.value = false
  }
)
async function logout() {
  try {
    // 1) close drawer instantly (UI feels responsive)
    open.value = false

    // 2) sign out
    const { error } = await supabase.auth.signOut()
    if (error) throw error

    // 3) toast (optional)
    toast.add({ title: 'Logged out', color: 'success' })

    // 4) hard redirect (most reliable)
    if (import.meta.client) {
      window.location.assign('/login')
    }
  } catch (e: any) {
    toast.add({ title: 'Logout failed', description: e?.message || '', color: 'error' })
  }
}

/* ✅ Color mode logic (kept here, button is ClientOnly in footer) */
const colorMode = useColorMode()

type Mode = 'system' | 'light' | 'dark'
const order: Mode[] = ['system', 'light', 'dark']

function normalizeMode(v: unknown): Mode {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

const pref = computed<Mode>(() => normalizeMode((colorMode as any).preference))

// show what user is SEEING
const effective = computed<'light' | 'dark'>(() => ((colorMode as any).value === 'dark' ? 'dark' : 'light'))

const themeIcon = computed(() => (effective.value === 'dark' ? 'i-heroicons-moon' : 'i-heroicons-sun'))

const themeLabel = computed(() => {
  if (pref.value === 'system') return `System (${effective.value})`
  return pref.value === 'dark' ? 'Dark' : 'Light'
})

function cycleTheme() {
  const i = order.indexOf(pref.value)
  const next = order[(i + 1) % order.length]
  ;(colorMode as any).preference = next
}
</script>
