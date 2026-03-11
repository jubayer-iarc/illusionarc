<!-- app/layouts/admin.vue -->
<script setup lang="ts">
const route = useRoute()
const supabase = useSupabaseClient()
const toast = useToast()

// ✅ pull brand name/logo from site_settings (admin-managed)
const { settings, refresh } = useSiteSettings()
await refresh()

type AdminNavItem = { label: string; to: string; exact?: boolean }

/**
 * ✅ Keep admin nav in code (recommended)
 * Because admin routes are your internal tools; not public website content.
 */
const nav: AdminNavItem[] = [
  { label: 'Dashboard', to: '/admin', exact: true },
  { label: 'Home Page', to: '/admin/home' },
  { label: 'Site Settings', to: '/admin/site' },
  { label: 'Messages', to: '/admin/messages' },
  { label: 'Users', to: '/admin/users' },
  { label: 'Scores', to: '/admin/scores' },
  { label: 'Services', to: '/admin/services' },
  { label: 'Works', to: '/admin/works' },
  { label: 'Prizes', to: '/admin/tournament-prizes' },
  { label: 'Tournaments', to: '/admin/tournaments' },
  { label: 'Payments', to: '/admin/payments' },
  { label: 'Subscriptions', to: '/admin/subscriptions' },
  { label: 'Catalogue', to: '/admin/catalogue' },
]

const isActive = (item: AdminNavItem) => {
  if (item.exact) return route.path === item.to
  return route.path === item.to || route.path.startsWith(item.to + '/')
}

const brandName = computed(() => settings.value.brand_name || 'illusion Arc')
const brandLogo = computed(() => settings.value.brand_logo_url || '/android-chrome-512x512.png')

async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    toast.add({ title: 'Signed out', color: 'success' })
    await navigateTo('/', { replace: true })
  } catch (e: any) {
    toast.add({ title: 'Sign out failed', description: e?.message || '', color: 'error' })
  }
}
</script>

<template>
  <div class="min-h-dvh text-[var(--app-fg)]">
    <div class="min-h-dvh">
      <!-- Mobile top bar -->
      <div class="lg:hidden sticky top-0 z-30 border-b border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/30 backdrop-blur">
        <div class="px-4 py-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="h-10 w-10 rounded-xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 font-bold overflow-hidden"
              style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.22), rgba(124,58,237,.16));"
            >
              <img :src="brandLogo" alt="Logo" class="h-full w-full object-contain p-1" />
            </div>

            <div class="min-w-0">
              <div class="font-semibold leading-5 truncate">{{ brandName }} — Admin</div>
              <div class="text-xs text-black/60 dark:text-white/60 truncate">{{ route.path }}</div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <UButton size="sm" variant="soft" to="/" icon="i-heroicons-home">
              Site
            </UButton>
          </div>
        </div>
      </div>

      <div class="lg:grid lg:grid-cols-[300px_1fr] lg:min-h-dvh">
        <!-- Sidebar -->
        <aside class="lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-black/10 lg:dark:border-white/10 lg:bg-white/60 lg:dark:bg-white/5 lg:backdrop-blur p-4">
          <!-- Brand -->
          <div class="hidden lg:flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 backdrop-blur">
            <div
              class="h-12 w-12 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 font-bold overflow-hidden"
              style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.22), rgba(124,58,237,.16));"
            >
              <img :src="brandLogo" alt="Logo" class="h-full w-full object-contain p-2" />
            </div>

            <div class="min-w-0">
              <div class="font-semibold truncate">{{ brandName }}</div>
              <div class="text-xs text-black/60 dark:text-white/60 truncate">Admin Console</div>
            </div>
          </div>

          <!-- Nav -->
          <nav class="mt-4 grid gap-2">
            <NuxtLink
              v-for="item in nav"
              :key="item.to"
              :to="item.to"
              class="admin-link"
              :class="{ active: isActive(item) }"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>

          <!-- Footer -->
          <div class="mt-6 grid gap-2">
            <button class="admin-btn" @click="navigateTo('/', { replace: true })">Back to site</button>
            <button class="admin-btn danger" @click="signOut">Sign out</button>
          </div>
        </aside>

        <!-- Main -->
        <main class="p-4 lg:p-6">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<style>
.admin-link {
  display: block;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
}
.dark .admin-link {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}
.admin-link:hover {
  transform: translateX(2px);
}

/* ✅ active state */
.admin-link.active {
  border-color: rgba(124, 58, 237, 0.35);
  background: rgba(124, 58, 237, 0.09);
}
.dark .admin-link.active {
  border-color: rgba(124, 58, 237, 0.45);
  background: rgba(124, 58, 237, 0.14);
}

.admin-btn {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.04);
  transition: transform 0.15s;
}
.dark .admin-btn {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}
.admin-btn:hover {
  transform: translateY(-1px);
}

.admin-btn.danger {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.08);
}
</style>
