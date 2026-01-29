<script setup lang="ts">
useHead({ title: 'Subscribe' })

const user = useSupabaseUser()
const toast = useToast()

const loading = ref(true)
const activating = ref<string | null>(null)
const state = ref<any>(null)
const errorMsg = ref<string | null>(null)
const okMsg = ref<string | null>(null)

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
    errorMsg.value = e?.data?.message || e?.message || 'Failed to load subscription status'
  } finally {
    loading.value = false
  }
}

await refresh()

const plans = [
  {
    code: '1d',
    title: '1 Day',
    days: 1,
    priceBdt: 50,
    desc: 'Great for a single tournament day.',
    bullets: ['Tournament access', 'Secure payment (SSLCOMMERZ)', 'Stacks with remaining time']
  },
  {
    code: '7d',
    title: '7 Days',
    days: 7,
    priceBdt: 199,
    desc: 'Best choice for weekly play.',
    bullets: ['Tournament access', 'Secure payment (SSLCOMMERZ)', 'Stacks with remaining time'],
    featured: true
  },
  {
    code: '30d',
    title: '30 Days',
    days: 30,
    priceBdt: 499,
    desc: 'Monthly access, maximum convenience.',
    bullets: ['Tournament access', 'Secure payment (SSLCOMMERZ)', 'Stacks with remaining time']
  }
] as const

function fmt(dt: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dt))
}

function msLeft(endsAt?: string | null) {
  if (!endsAt) return 0
  const t = new Date(endsAt).getTime()
  return Math.max(0, t - Date.now())
}

function formatRemaining(ms: number) {
  if (ms <= 0) return 'Expired'
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60)
  const minutes = totalMinutes - days * 60 * 24 - hours * 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

const active = computed(() => !!state.value?.active)
const endsAt = computed<string | null>(() => state.value?.subscription?.ends_at || null)
const remaining = computed(() => formatRemaining(msLeft(endsAt.value)))
const lastPlanTitle = computed(() => state.value?.subscription?.subscription_plans?.title || null)

function ctaLabel() {
  if (!user.value) return 'Log in to subscribe'
  return active.value ? 'Extend' : 'Subscribe'
}
function ctaHint(days: number) {
  if (!user.value) return 'Sign in required'
  return active.value
    ? `Adds +${days} day${days > 1 ? 's' : ''} after payment`
    : `Starts after payment • ${days} day${days > 1 ? 's' : ''}`
}

/**
 * ✅ REAL PAYMENT:
 * Call /api/payments/start -> get gatewayUrl -> redirect user to SSLCOMMERZ
 */
async function activate(planCode: typeof plans[number]['code']) {
  okMsg.value = null
  errorMsg.value = null

  if (!user.value) {
    errorMsg.value = 'Please log in first.'
    return
  }

  activating.value = planCode
  try {
    const res: any = await $fetch('/api/payments/start', {
      method: 'POST',
      credentials: 'include',
      headers: serverCookieHeaders(),
      body: { planCode }
    })

    const gatewayUrl = res?.gatewayUrl
    if (!gatewayUrl) throw new Error('No gatewayUrl returned')

    okMsg.value = 'Redirecting to payment gateway…'

    // ✅ redirect user to SSLCOMMERZ
    if (import.meta.client) window.location.href = gatewayUrl
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Payment start failed'
    toast.add({ title: 'Payment error', description: errorMsg.value, color: 'error' })
  } finally {
    activating.value = null
  }
}
</script>

<template>
  <UContainer class="py-10">
    <!-- Title -->
    <div class="flex flex-col gap-2">
      <h1 class="text-3xl font-semibold tracking-tight">Tournament Passes</h1>
      <p class="text-sm opacity-75 max-w-2xl">
        Pay with SSLCOMMERZ to unlock tournaments. Buying again extends your access if you still have time left.
      </p>
    </div>

    <!-- Current access (TOP) -->
    <div class="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="text-sm opacity-70">Current access</div>

          <div v-if="!user" class="mt-1 text-sm opacity-80">
            You’re not logged in.
          </div>

          <div v-else-if="active" class="mt-2">
            <div class="flex items-center gap-2">
              <span class="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <div class="text-base font-semibold">Active</div>
            </div>
            <div class="mt-1 text-sm opacity-80">
              Access until <span class="font-medium opacity-100">{{ endsAt ? fmt(endsAt) : '—' }}</span>
              <span class="mx-2 opacity-40">•</span>
              Remaining <span class="font-medium opacity-100">{{ remaining }}</span>
            </div>
            <div class="mt-1 text-xs opacity-70">
              Last purchase: <span class="font-medium opacity-100">{{ lastPlanTitle || '—' }}</span>
              <span class="mx-2 opacity-40">•</span>
              Time stacks on purchase.
            </div>
          </div>

          <div v-else class="mt-2">
            <div class="flex items-center gap-2">
              <span class="inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
              <div class="text-base font-semibold">Inactive</div>
            </div>
            <div class="mt-1 text-sm opacity-80">Choose a pass below to unlock tournaments.</div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <UButton class="!rounded-full" size="md" variant="soft" :disabled="!user" @click="refresh">
            Refresh
          </UButton>
          <div class="hidden sm:block text-xs opacity-60">
            Required for <span class="font-medium">/tournaments/embed/*</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Alerts -->
    <div v-if="okMsg" class="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
      ✅ {{ okMsg }}
    </div>
    <div v-if="errorMsg" class="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm">
      ⚠️ {{ errorMsg }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 opacity-80">
      Loading…
    </div>

    <!-- Pricing -->
    <div v-else class="mt-8 grid gap-5 lg:grid-cols-3">
      <div
        v-for="p in plans"
        :key="p.code"
        class="relative rounded-3xl border border-white/10 bg-white/5 p-7 flex flex-col"
      >
        <!-- Top row: title + duration pill -->
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-lg font-semibold">{{ p.title }}</div>
            <div class="mt-1 text-sm opacity-75">{{ p.desc }}</div>
          </div>

          <!-- duration pill -->
          <div
            class="shrink-0 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs"
          >
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-white/70" />
            <span class="font-medium">{{ p.days }} day{{ p.days > 1 ? 's' : '' }}</span>
          </div>
        </div>

        <!-- Price -->
        <div class="mt-6">
          <div class="text-3xl font-semibold tracking-tight">BDT {{ p.priceBdt }}</div>
          <div class="mt-1 text-xs opacity-60">
            Secure checkout • Code: <span class="font-medium">{{ p.code }}</span>
          </div>
        </div>

        <!-- Bullets -->
        <div class="mt-6 space-y-2 text-sm">
          <div v-for="b in p.bullets" :key="b" class="flex items-center gap-2 opacity-85">
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-white/60" />
            <span>{{ b }}</span>
          </div>
        </div>

        <div class="flex-1" />

        <!-- CTA -->
        <UButton
          class="mt-7 w-full !rounded-full"
          size="lg"
          variant="solid"
          :loading="activating === p.code"
          :disabled="!user"
          @click="activate(p.code)"
        >
          {{ ctaLabel() }}
        </UButton>

        <div class="mt-3 text-center text-xs opacity-70 min-h-[18px]">
          {{ ctaHint(p.days) }}
        </div>

        <!-- Most popular badge -->
        <div v-if="p.featured" class="absolute -top-3 left-6">
          <span class="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs">
            Most Popular
          </span>
        </div>
      </div>
    </div>

    <div class="mt-6 text-sm opacity-70">
      After payment, your access updates automatically (via SSLCOMMERZ IPN + validation).
    </div>
  </UContainer>
</template>
