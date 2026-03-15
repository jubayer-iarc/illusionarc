<script setup lang="ts">
useHead({ title: 'পেমেন্ট সফল' })

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
    errorMsg.value = e?.data?.message || e?.message || 'স্ট্যাটাস রিফ্রেশ করা যায়নি'
    toast.add({ title: 'রিফ্রেশ ব্যর্থ হয়েছে', description: errorMsg.value, color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(refresh)
</script>

<template>
  <UContainer class="py-10">
    <div class="rounded-3xl border border-white/10 bg-white/5 p-7">
      <h1 class="text-2xl font-semibold">পেমেন্ট সফল হয়েছে ✅</h1>

      <p class="mt-3 text-base font-medium text-primary">
        আমাদের সাথে যুক্ত হওয়ার জন্য আপনাকে ধন্যবাদ! 🎉
      </p>

      <p class="mt-2 text-sm opacity-75">
        ট্রানজ্যাকশন: <span class="font-mono">{{ tranId }}</span>
      </p>

      <p class="mt-3 text-sm opacity-80">
        আপনার পেমেন্ট সফল হয়েছে এবং আমরা এখন আপনার সাবস্ক্রিপশন অ্যাক্সেস যাচাই করছি।
        যদি আপনার অ্যাক্সেস সঙ্গে সঙ্গে আপডেট না হয়, তাহলে কয়েক সেকেন্ড পর রিফ্রেশ করুন।
      </p>

      <div
        v-if="errorMsg"
        class="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm"
      >
        ⚠️ {{ errorMsg }}
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <UButton class="!rounded-full" :loading="loading" @click="refresh" color="secondary">
          স্ট্যাটাস রিফ্রেশ করুন
        </UButton>

        <UButton
          class="!rounded-full"
          color="primary"
          to="/tournaments/embed/salami-rush-eid-tournament"
        >
          টুর্নামেন্ট খেলুন
        </UButton>
      </div>

      <div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
        <div class="flex items-center justify-between">
          <span class="opacity-70">সক্রিয়</span>
          <span class="font-medium">{{ state?.active ? 'হ্যাঁ' : 'না' }}</span>
        </div>

        <div v-if="state?.subscription?.ends_at" class="mt-2 flex items-center justify-between">
          <span class="opacity-70">শেষ হবে</span>
          <span class="font-medium">
            {{ new Date(state.subscription.ends_at).toLocaleString() }}
          </span>
        </div>
      </div>
    </div>
  </UContainer>
</template>