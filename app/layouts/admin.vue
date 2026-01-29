<script setup lang="ts">
const route = useRoute()
const supabase = useSupabaseClient()

async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  await navigateTo('/', { replace: true })
}
</script>

<template>
  <div class="min-h-dvh text-[var(--app-fg)]">
    <!-- SHELL -->
    <div class="min-h-dvh">
      <!-- Mobile top bar -->
      <div
        class="lg:hidden sticky top-0 z-30 border-b border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/30 backdrop-blur"
      >
        <div class="px-4 py-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="h-10 w-10 rounded-xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 font-bold"
              style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.22), rgba(124,58,237,.16));"
            >
              IA
            </div>
            <div class="min-w-0">
              <div class="font-semibold leading-5 truncate">Admin</div>
              <div class="text-xs text-black/60 dark:text-white/60 truncate">
                {{ route.path }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="lg:grid lg:grid-cols-[300px_1fr] lg:min-h-dvh">
        <!-- Sidebar -->
        <aside
          class="lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-black/10 lg:dark:border-white/10 lg:bg-white/60 lg:dark:bg-white/5 lg:backdrop-blur p-4"
        >
          <!-- Brand -->
          <div
            class="hidden lg:flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 backdrop-blur"
          >
            <div
              class="h-12 w-12 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 font-bold"
              style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.22), rgba(124,58,237,.16));"
            >
              IA
            </div>
            <div class="min-w-0">
              <div class="font-semibold truncate">illusion Arc</div>
              <div class="text-xs text-black/60 dark:text-white/60 truncate">
                Admin Console
              </div>
            </div>
          </div>

          <!-- Nav -->
          <nav class="mt-4 grid gap-2">
            <NuxtLink to="/admin" class="admin-link">Dashboard</NuxtLink>
            <NuxtLink to="/admin/messages" class="admin-link">Messages</NuxtLink>
            <NuxtLink to="/admin/requests" class="admin-link">Requests</NuxtLink>
            <NuxtLink to="/admin/users" class="admin-link">Users</NuxtLink>
            <NuxtLink to="/admin/scores" class="admin-link">Scores</NuxtLink>
            <NuxtLink to="/admin/services" class="admin-link">Services</NuxtLink>
            <NuxtLink to="/admin/works" class="admin-link">Works</NuxtLink>
            <NuxtLink to="/admin/tournaments" class="admin-link">Tournaments</NuxtLink>
            <NuxtLink to="/admin/payments" class="admin-link">Payments</NuxtLink>
          </nav>

          <!-- Footer -->
          <div class="mt-6 grid gap-2">
            <button
              class="admin-btn"
              @click="navigateTo('/', { replace: true })"
            >
              Back to site
            </button>

            <button
              class="admin-btn danger"
              @click="signOut"
            >
              Sign out
            </button>
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
  border: 1px solid rgba(0,0,0,.1);
  background: rgba(0,0,0,.04);
  transition: all .2s;
}
.dark .admin-link {
  border-color: rgba(255,255,255,.1);
  background: rgba(255,255,255,.05);
}
.admin-link:hover {
  transform: translateX(2px);
}

.admin-btn {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,.1);
  background: rgba(0,0,0,.04);
}
.dark .admin-btn {
  border-color: rgba(255,255,255,.1);
  background: rgba(255,255,255,.05);
}
.admin-btn.danger {
  border-color: rgba(239,68,68,.4);
  background: rgba(239,68,68,.08);
}
</style>
