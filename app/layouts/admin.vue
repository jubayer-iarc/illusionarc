<!-- app/layouts/admin.vue -->
<script setup lang="ts">
const route = useRoute()
const supabase = useSupabaseClient()
const toast = useToast()

const { settings, refresh } = useSiteSettings()
await refresh()

type Role = 'admin' | 'writer' | 'user' | null

type RoleResponse = {
  role: Role
  found: boolean
}

type AdminNavItem = {
  label: string
  to: string
  exact?: boolean
}

type AdminNavGroup = {
  title: string
  items: AdminNavItem[]
}

const mobileMenuOpen = ref(false)
const loadingRole = ref(true)
const role = ref<Role>(null)

const brandName = computed(() => settings.value.brand_name || 'illusion Arc')
const brandLogo = computed(() => settings.value.brand_logo_url || '/android-chrome-512x512.png')

const isWriter = computed(() => role.value === 'writer')
const isAdmin = computed(() => role.value === 'admin')

const writerNav: AdminNavGroup[] = [
  {
    title: 'Content',
    items: [
      { label: 'Blogs', to: '/admin/blogs', exact: true }
    ]
  }
]

const adminNav: AdminNavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/admin', exact: true }
    ]
  },
  {
    title: 'Content',
    items: [
      { label: 'Home Page', to: '/admin/home' },
      { label: 'Site Settings', to: '/admin/site' },
      { label: 'Blogs', to: '/admin/blogs' },
      { label: 'Services', to: '/admin/services' },
      { label: 'Works', to: '/admin/works' },
      { label: 'Catalogue', to: '/admin/catalogue' }
    ]
  },
  {
    title: 'Operations',
    items: [
      { label: 'Messages', to: '/admin/messages' },
      { label: 'Users', to: '/admin/users' },
      { label: 'Scores', to: '/admin/scores' },
      { label: 'Payments', to: '/admin/payments' },
      { label: 'Subscriptions', to: '/admin/subscriptions' }
    ]
  },
  {
    title: 'Tournament',
    items: [
      { label: 'Prizes', to: '/admin/tournament-prizes' },
      { label: 'Tournaments', to: '/admin/tournaments' }
    ]
  },
  {
    title: 'Security',
    items: [
      { label: 'Logs', to: '/admin/logs' }
    ]
  }
]

const navGroups = computed<AdminNavGroup[]>(() => {
  if (isWriter.value) return writerNav
  if (isAdmin.value) return adminNav
  return []
})

const flatNav = computed(() => navGroups.value.flatMap(group => group.items))

const currentPageLabel = computed(() => {
  const found = flatNav.value.find(item => isActive(item))
  return found?.label || 'Admin'
})

function isActive(item: AdminNavItem) {
  if (item.exact) return route.path === item.to
  return route.path === item.to || route.path.startsWith(item.to + '/')
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

watch(
  () => route.fullPath,
  () => {
    closeMobileMenu()
  }
)

async function loadRole() {
  loadingRole.value = true
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('admin layout getSession error:', error.message)
    }

    if (!data?.session) {
      role.value = null
      return
    }

    const res = await $fetch<RoleResponse>('/api/auth/role', {
      credentials: 'include'
    })

    role.value = res.role
  } catch (e: any) {
    console.warn('admin layout role fetch failed:', e?.message || e)
    role.value = null
  } finally {
    loadingRole.value = false
  }
}

async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error

    toast.add({
      title: 'Signed out',
      color: 'success'
    })

    await navigateTo('/', { replace: true })
  } catch (e: any) {
    toast.add({
      title: 'Sign out failed',
      description: e?.message || '',
      color: 'error'
    })
  }
}

onMounted(loadRole)
</script>

<template>
  <div class="min-h-dvh bg-white dark:bg-neutral-950 text-black dark:text-white">
    <!-- Mobile top bar -->
    <header class="lg:hidden sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950">
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="h-10 w-10 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 shrink-0">
            <img :src="brandLogo" alt="Logo" class="h-full w-full object-contain p-1.5" />
          </div>

          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">{{ brandName }}</div>
            <div class="text-xs text-black/60 dark:text-white/60 truncate">
              {{ currentPageLabel }}
            </div>
          </div>
        </div>

        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900"
          @click="mobileMenuOpen = true"
        >
          <UIcon name="i-heroicons-bars-3" class="h-5 w-5" />
        </button>
      </div>
    </header>

    <div class="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:min-h-dvh">
      <!-- Desktop sidebar -->
      <aside class="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-dvh border-r border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-neutral-925">
        <div class="p-4 border-b border-black/10 dark:border-white/10">
          <div class="flex items-center gap-3 min-w-0">
            <div class="h-11 w-11 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 shrink-0">
              <img :src="brandLogo" alt="Logo" class="h-full w-full object-contain p-2" />
            </div>

            <div class="min-w-0">
              <div class="font-semibold truncate">{{ brandName }}</div>
              <div class="text-xs text-black/60 dark:text-white/60">
                {{ isWriter ? 'Writer Panel' : 'Admin Panel' }}
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div v-if="loadingRole" class="space-y-4">
            <div v-for="i in 5" :key="i" class="h-10 rounded-lg bg-black/5 dark:bg-white/5 animate-pulse" />
          </div>

          <template v-else>
            <div
              v-for="group in navGroups"
              :key="group.title"
              class="mb-6"
            >
              <div class="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
                {{ group.title }}
              </div>

              <nav class="space-y-1">
                <NuxtLink
                  v-for="item in group.items"
                  :key="item.to"
                  :to="item.to"
                  class="admin-link"
                  :class="{ active: isActive(item) }"
                >
                  {{ item.label }}
                </NuxtLink>
              </nav>
            </div>
          </template>
        </div>

        <div class="p-4 border-t border-black/10 dark:border-white/10 space-y-2">
          <button class="admin-btn" @click="navigateTo('/', { replace: true })">
            Back to site
          </button>
          <button class="admin-btn danger" @click="signOut">
            Sign out
          </button>
        </div>
      </aside>

      <!-- Mobile sidebar -->
      <Teleport to="body">
        <div
          v-if="mobileMenuOpen"
          class="lg:hidden fixed inset-0 z-50"
        >
          <div class="absolute inset-0 bg-black/40" @click="closeMobileMenu" />

          <div class="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-white dark:bg-neutral-950 border-r border-black/10 dark:border-white/10 flex flex-col">
            <div class="flex items-center justify-between gap-3 p-4 border-b border-black/10 dark:border-white/10">
              <div class="flex items-center gap-3 min-w-0">
                <div class="h-10 w-10 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 shrink-0">
                  <img :src="brandLogo" alt="Logo" class="h-full w-full object-contain p-1.5" />
                </div>

                <div class="min-w-0">
                  <div class="font-semibold truncate">{{ brandName }}</div>
                  <div class="text-xs text-black/60 dark:text-white/60">
                    {{ isWriter ? 'Writer Panel' : 'Admin Panel' }}
                  </div>
                </div>
              </div>

              <button
                type="button"
                class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900"
                @click="closeMobileMenu"
              >
                <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-4">
              <div v-if="loadingRole" class="space-y-4">
                <div v-for="i in 5" :key="i" class="h-10 rounded-lg bg-black/5 dark:bg-white/5 animate-pulse" />
              </div>

              <template v-else>
                <div
                  v-for="group in navGroups"
                  :key="group.title"
                  class="mb-6"
                >
                  <div class="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
                    {{ group.title }}
                  </div>

                  <nav class="space-y-1">
                    <NuxtLink
                      v-for="item in group.items"
                      :key="item.to"
                      :to="item.to"
                      class="admin-link"
                      :class="{ active: isActive(item) }"
                    >
                      {{ item.label }}
                    </NuxtLink>
                  </nav>
                </div>
              </template>
            </div>

            <div class="p-4 border-t border-black/10 dark:border-white/10 space-y-2">
              <button class="admin-btn" @click="navigateTo('/', { replace: true })">
                Back to site
              </button>
              <button class="admin-btn danger" @click="signOut">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Main -->
      <div class="min-w-0 flex flex-col">
        <div class="hidden lg:flex items-center justify-between gap-4 px-6 py-4 border-b border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950">
          <div class="min-w-0">
            <div class="text-lg font-semibold truncate">{{ currentPageLabel }}</div>
            <div class="text-sm text-black/60 dark:text-white/60 truncate">
              {{ route.path }}
            </div>
          </div>

          <div class="flex items-center gap-2 text-sm text-black/60 dark:text-white/60">
            <span>{{ isWriter ? 'Writer' : 'Admin' }}</span>
          </div>
        </div>

        <main class="flex-1 p-4 lg:p-6">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-link {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  color: inherit;
  background: transparent;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.admin-link:hover {
  background: rgba(0, 0, 0, 0.04);
}

.dark .admin-link:hover {
  background: rgba(255, 255, 255, 0.06);
}

.admin-link.active {
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.08);
  font-weight: 600;
}

.dark .admin-link.active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.admin-btn {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: white;
  color: inherit;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.dark .admin-btn {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
}

.admin-btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

.dark .admin-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.admin-btn.danger {
  border-color: rgba(239, 68, 68, 0.25);
  color: rgb(185, 28, 28);
}

.dark .admin-btn.danger {
  color: rgb(252, 165, 165);
}
</style>