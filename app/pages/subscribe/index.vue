<!-- app/pages/subscribe.vue -->
<script setup lang="ts">
useHead({ title: 'Subscribe' })

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const toast = useToast()

const loading = ref(true)
const plansLoading = ref(true)
const activating = ref<string | null>(null)

const state = ref<any>(null)
const errorMsg = ref<string | null>(null)
const okMsg = ref<string | null>(null)

type PlanRow = {
  id: string
  code: string
  title: string
  duration_days: number
  price_bdt: number
  is_active: boolean
  discount_active: boolean
  discount_price_bdt: number | null
  discount_note: string | null
  created_at: string
}

function serverCookieHeaders() {
  return import.meta.server ? useRequestHeaders(['cookie']) : undefined
}

/* ---------------- Subscription status ---------------- */
async function refreshStatus() {
  errorMsg.value = null
  try {
    state.value = await $fetch('/api/subscriptions/me', {
      credentials: 'include',
      headers: serverCookieHeaders(),
      cache: 'no-store'
    })
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Failed to load subscription status'
  }
}

/* ---------------- Plans from DB ---------------- */
const plans = ref<PlanRow[]>([])

function effectivePrice(p: PlanRow) {
  const dp = p.discount_price_bdt
  const ok = p.discount_active && dp !== null && dp >= 0 && dp < p.price_bdt
  return ok ? dp : p.price_bdt
}
function hasValidDiscount(p: PlanRow) {
  return p.discount_active && p.discount_price_bdt !== null && p.discount_price_bdt >= 0 && p.discount_price_bdt < p.price_bdt
}

function planBullets(p: PlanRow) {
  // Keep bullets consistent (you can customize per plan later if you add columns)
  return ['Tournament access', 'Secure payment (SSLCOMMERZ)', 'Stacks with remaining time']
}

function planDesc(p: PlanRow) {
  const d = p.duration_days
  if (d <= 1) return 'Great for a single tournament day.'
  if (d <= 7) return 'Best choice for weekly play.'
  if (d <= 30) return 'Monthly access, maximum convenience.'
  return 'Long-term access, maximum value.'
}

function featured(p: PlanRow) {
  // Simple rule: feature the middle option (or 7-day) if exists
  return p.code === '7d' || p.duration_days === 7
}

async function loadPlans() {
  plansLoading.value = true
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('id, code, title, duration_days, price_bdt, is_active, discount_active, discount_price_bdt, discount_note, created_at')
      .eq('is_active', true)
      .order('duration_days', { ascending: true })

    if (error) throw error
    plans.value = (data || []) as PlanRow[]
  } catch (e: any) {
    toast.add({ title: 'Failed to load plans', description: e?.message || 'Try again.', color: 'error' })
    plans.value = []
  } finally {
    plansLoading.value = false
  }
}

/* ---------------- Page load ---------------- */
async function refreshAll() {
  loading.value = true
  okMsg.value = null
  errorMsg.value = null
  try {
    await Promise.all([refreshStatus(), loadPlans()])
  } finally {
    loading.value = false
  }
}

await refreshAll()

/* ---------------- Time helpers ---------------- */
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

/* ---------------- CTA helpers ---------------- */
function ctaLabel() {
  if (!user.value) return 'Log in to subscribe'
  return active.value ? 'Extend' : 'Subscribe'
}
function ctaHint(days: number) {
  if (!user.value) return 'Sign in required'
  return active.value ? `Adds +${days} day${days > 1 ? 's' : ''} after payment` : `Starts after payment • ${days} day${days > 1 ? 's' : ''}`
}

/* ---------------- Payment start ---------------- */
async function activate(planCode: string) {
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
    if (import.meta.client) window.location.href = gatewayUrl
  } catch (e: any) {
    errorMsg.value = e?.data?.message || e?.message || 'Payment start failed'
    toast.add({ title: 'Payment error', description: errorMsg.value, color: 'error' })
  } finally {
    activating.value = null
  }
}

function money(v: number) {
  return new Intl.NumberFormat().format(v || 0)
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
          <UButton class="!rounded-full" size="md" variant="soft" :disabled="!user" @click="refreshAll">
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

    <!-- Plans loading -->
    <div v-else-if="plansLoading" class="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 opacity-80">
      Loading plans…
    </div>

    <!-- Pricing -->
    <div v-else class="mt-8 grid gap-5 lg:grid-cols-3">
      <div
        v-for="p in plans"
        :key="p.code"
        class="relative rounded-3xl border border-white/10 bg-white/5 p-7 flex flex-col"
      >
        <!-- Most popular badge -->
        <div v-if="featured(p)" class="absolute -top-3 left-6">
          <span class="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs">
            Most Popular
          </span>
        </div>

        <!-- Top row: title + duration pill -->
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-lg font-semibold">{{ p.title }}</div>
            <div class="mt-1 text-sm opacity-75">{{ planDesc(p) }}</div>
          </div>

          <!-- duration pill -->
          <div class="shrink-0 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs">
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-white/70" />
            <span class="font-medium">{{ p.duration_days }} day{{ p.duration_days > 1 ? 's' : '' }}</span>
          </div>
        </div>

        <!-- Price -->
        <div class="mt-6">
          <div class="flex items-baseline gap-3">
            <div class="text-3xl font-semibold tracking-tight">
              BDT {{ money(effectivePrice(p)) }}
            </div>

            <div v-if="hasValidDiscount(p)" class="text-sm opacity-70 line-through">
              BDT {{ money(p.price_bdt) }}
            </div>
          </div>

          <div v-if="hasValidDiscount(p) && p.discount_note" class="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs">
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {{ p.discount_note }}
          </div>

          <div class="mt-2 text-xs opacity-60">
            Secure checkout • Code: <span class="font-medium">{{ p.code }}</span>
          </div>
        </div>

        <!-- Bullets -->
        <div class="mt-6 space-y-2 text-sm">
          <div v-for="b in planBullets(p)" :key="b" class="flex items-center gap-2 opacity-85">
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
          {{ ctaHint(p.duration_days) }}
        </div>
      </div>
    </div>

    <div class="mt-6 text-sm opacity-70">
      After payment, your access updates automatically (via SSLCOMMERZ IPN + validation).
    </div>

    <div v-if="!loading && !plansLoading && plans.length === 0" class="mt-6 text-sm opacity-70">
      No active plans found. Please contact admin.
    </div>
  </UContainer>
</template>
