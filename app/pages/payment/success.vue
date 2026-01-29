<script setup lang="ts">
useHead({ title: 'Payment Success' })

const route = useRoute()
const tranId = computed(() => String(route.query.tran_id || ''))

const toast = useToast()
const loading = ref(false)
const state = ref<any>(null)
const errorMsg = ref<string | null>(null)

function serverCookieHeaders() {
  return import.meta.server ? useRequestHeaders(['cookie']) : undefined
}

async function refresh() {
  loading.value = true
  errorMsg.value = null
  try {
    state.value = await $fetch('/api/subscriptions/me', {
      credentials: 'include',
      headers: serverCookieHeaders(),
      cache: 'no-store'
    })
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Failed to refresh status'
    toast.add({ title: 'Refresh failed', description: errorMsg.value, color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(refresh)
</script>

<template>
  <UContainer class="py-10">
    <div class="rounded-3xl border border-white/10 bg-white/5 p-7">
      <h1 class="text-2xl font-semibold">Payment received ✅</h1>
      <p class="mt-2 text-sm opacity-75">
        Transaction: <span class="font-mono">{{ tranId }}</span>
      </p>
      <p class="mt-3 text-sm opacity-80">
        We’re verifying your payment. If your access doesn’t update instantly, tap refresh in a few seconds.
      </p>

      <div v-if="errorMsg" class="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm">
        ⚠️ {{ errorMsg }}
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <UButton class="!rounded-full" :loading="loading" @click="refresh">Refresh status</UButton>
        <UButton class="!rounded-full" variant="soft" to="/tournaments">Go to tournaments</UButton>
      </div>

      <div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
        <div class="flex items-center justify-between">
          <span class="opacity-70">Active</span>
          <span class="font-medium">{{ state?.active ? 'Yes' : 'No' }}</span>
        </div>

        <div v-if="state?.subscription?.ends_at" class="mt-2 flex items-center justify-between">
          <span class="opacity-70">Ends</span>
          <span class="font-medium">{{ new Date(state.subscription.ends_at).toLocaleString() }}</span>
        </div>
      </div>
    </div>
  </UContainer>
</template>
