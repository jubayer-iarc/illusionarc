<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const toast = useToast()

watch(
    () => user.value?.id,
    async () => {
      const u: any = user.value
      if (!u?.id) return

      const dn = u?.user_metadata?.display_name
      if (dn && String(dn).trim()) return

      await supabase.auth.updateUser({
        data: { display_name: randomDisplayName() }
      })
    },
    { immediate: true }
)


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

async function goProfile() {
  await navigateTo('/profile')
}

async function logout() {
  try {
    await supabase.auth.signOut()
    toast.add({ title: 'Logged out', color: 'success' })
    await navigateTo('/', { replace: true })
  } catch (e: any) {
    toast.add({
      title: 'Logout failed',
      description: e?.message || 'Please try again.',
      color: 'error'
    })
  }
}

/**
 * Nuxt UI v4 dropdown structure:
 * items: Array<Array<Item>>
 * Use onSelect instead of click.
 */
const items = computed(() => [
  [
    {
      label: 'Profile Settings',
      icon: 'i-heroicons-user-circle',
      onSelect: goProfile
    }
  ],
  [
    {
      label: 'Logout',
      icon: 'i-heroicons-arrow-right-on-rectangle',
      onSelect: logout
    }
  ]
])
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Not logged in -->
    <UButton
      v-if="!user"
      to="/login"
      color="primary"
      variant="soft"
      size="sm"
      icon="i-heroicons-lock-closed"
    >
      Login
    </UButton>

    <!-- Logged in -->
    <UDropdownMenu v-else :items="items" :popper="{ placement: 'bottom-end' }">
      <button
        type="button"
        class="group relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1.5
               hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <!-- Avatar -->
        <div class="h-9 w-9 overflow-hidden rounded-full border border-white/10 bg-black/30 shrink-0">
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            alt="Avatar"
            class="h-full w-full object-cover"
            referrerpolicy="no-referrer"
          />
          <div v-else class="h-full w-full grid place-items-center text-sm font-semibold opacity-90">
            {{ initials }}
          </div>
        </div>

        <!-- Name (hide on very small screens) -->
        <div class="hidden sm:flex flex-col leading-tight text-left">
          <div class="text-sm font-semibold">{{ displayName }}</div>
          <div class="text-[11px] opacity-70">Account</div>
        </div>

        <UIcon name="i-heroicons-chevron-down" class="hidden sm:block w-4 h-4 opacity-70" />
      </button>
    </UDropdownMenu>
  </div>
</template>
