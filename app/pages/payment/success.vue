<script setup lang="ts">
useHead({ title: 'পেমেন্ট সফল' })

const route = useRoute()
const toast = useToast()

const tranId = computed(() => String(route.query.tran_id || '').trim())

const loading = ref(false)
const finalizing = ref(false)
const finalized = ref(false)
const pendingMsg = ref<string | null>(null)
const state = ref<any>(null)
const errorMsg = ref<string | null>(null)

function serverCookieHeaders() {
  return import.meta.server ? useRequestHeaders(['cookie']) : undefined
}

async function refresh() {
  loading.value = true
  try {
    state.value = await $fetch('/api/subscriptions/me', {
      credentials: 'include',
      headers: serverCookieHeaders(),
      cache: 'no-store'
    })
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'স্ট্যাটাস রিফ্রেশ করা যায়নি'
    toast.add({
      title: 'রিফ্রেশ ব্যর্থ হয়েছে',
      description: errorMsg.value,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function finalizePayment() {
  if (!tranId.value) {
    errorMsg.value = 'ট্রানজ্যাকশন আইডি পাওয়া যায়নি'
    return
  }

  finalizing.value = true
  errorMsg.value = null
  pendingMsg.value = null

  try {
    const res: any = await $fetch('/api/payments/finalize', {
      method: 'POST',
      credentials: 'include',
      headers: serverCookieHeaders(),
      body: {
        tran_id: tranId.value
      }
    })

    if (res?.pending) {
      pendingMsg.value =
        'পেমেন্ট কনফার্মেশনের জন্য অপেক্ষা করা হচ্ছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
      return
    }

    finalized.value = true
    toast.add({
      title: 'সাবস্ক্রিপশন চালু হয়েছে',
      description: 'আপনার টুর্নামেন্ট অ্যাক্সেস এখন সক্রিয়।',
      color: 'success'
    })
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'পেমেন্ট ফাইনালাইজ করা যায়নি'
    toast.add({
      title: 'ফাইনালাইজ ব্যর্থ হয়েছে',
      description: errorMsg.value,
      color: 'error'
    })
  } finally {
    finalizing.value = false
  }
}

async function run() {
  await finalizePayment()
  await refresh()
}

onMounted(run)
</script>

<template>
  <UContainer class="py-10">
    <div class="rounded-3xl border border-white/10 bg-white/5 p-7">
      <h1 class="text-2xl font-semibold">পেমেন্ট সফল হয়েছে ✅</h1>

      <p class="mt-3 text-base font-medium text-primary">
        আমাদের সাথে যুক্ত হওয়ার জন্য আপনাকে ধন্যবাদ! 🎉
      </p>

      <p class="mt-2 text-sm opacity-75">
        ট্রানজ্যাকশন: <span class="font-mono">{{ tranId || '—' }}</span>
      </p>

      <p class="mt-3 text-sm opacity-80">
        আপনার পেমেন্ট যাচাই করে সাবস্ক্রিপশন অ্যাক্টিভ করা হচ্ছে।
      </p>

      <div
        v-if="finalizing"
        class="mt-4 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm"
      >
        ⏳ আপনার পেমেন্ট যাচাই করা হচ্ছে...
      </div>

      <div
        v-else-if="finalized"
        class="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm"
      >
        ✅ আপনার সাবস্ক্রিপশন সফলভাবে চালু হয়েছে।
      </div>

      <div
        v-if="pendingMsg"
        class="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm"
      >
        ⏳ {{ pendingMsg }}
      </div>

      <div
        v-if="errorMsg"
        class="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm"
      >
        ⚠️ {{ errorMsg }}
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <UButton
          class="!rounded-full"
          :loading="finalizing || loading"
          @click="run"
          color="secondary"
        >
          আবার যাচাই করুন
        </UButton>

        <UButton
          class="!rounded-full"
          color="primary"
          to="/subscribe"
        >
          সাবস্ক্রিপশন পেজে যান
        </UButton>

        <UButton
          class="!rounded-full"
          color="primary"
          variant="soft"
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

        <div
          v-if="state?.subscription?.ends_at"
          class="mt-2 flex items-center justify-between"
        >
          <span class="opacity-70">শেষ হবে</span>
          <span class="font-medium">
            {{ new Date(state.subscription.ends_at).toLocaleString() }}
          </span>
        </div>

        <div
          v-if="state?.subscription?.subscription_plans?.title"
          class="mt-2 flex items-center justify-between"
        >
          <span class="opacity-70">প্ল্যান</span>
          <span class="font-medium">{{ state.subscription.subscription_plans.title }}</span>
        </div>
      </div>
    </div>
  </UContainer>
</template>