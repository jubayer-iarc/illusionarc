<!-- app/pages/subscribe/index.vue -->
<script setup lang="ts">
useHead({ title: 'Subscribe' })

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const toast = useToast()

const loading = ref(true)
const plansLoading = ref(true)
const referralLoading = ref(true)
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

type ReferralSummary = {
  referralCode: string | null
  referralCount: number
  referralBonusBdt: number
  referralBonusUsedBdt: number
  referralBonusAvailableBdt: number
}

const referral = reactive<ReferralSummary>({
  referralCode: null,
  referralCount: 0,
  referralBonusBdt: 0,
  referralBonusUsedBdt: 0,
  referralBonusAvailableBdt: 0
})

function serverCookieHeaders() {
  return import.meta.server ? useRequestHeaders(['cookie']) : undefined
}

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

async function loadReferralSummary() {
  referralLoading.value = true
  try {
    if (!user.value) {
      referral.referralCode = null
      referral.referralCount = 0
      referral.referralBonusBdt = 0
      referral.referralBonusUsedBdt = 0
      referral.referralBonusAvailableBdt = 0
      return
    }

    const data: any = await $fetch('/api/referrals/me', {
      credentials: 'include',
      headers: serverCookieHeaders(),
      cache: 'no-store'
    })

    referral.referralCode = String(data?.referralCode || '').trim() || null
    referral.referralCount = Number(data?.referralCount || 0)
    referral.referralBonusBdt = Number(data?.referralBonusBdt || 0)
    referral.referralBonusUsedBdt = Number(data?.referralBonusUsedBdt || 0)
    referral.referralBonusAvailableBdt = Number(data?.referralBonusAvailableBdt || 0)
  } catch {
    referral.referralCode = null
    referral.referralCount = 0
    referral.referralBonusBdt = 0
    referral.referralBonusUsedBdt = 0
    referral.referralBonusAvailableBdt = 0
  } finally {
    referralLoading.value = false
  }
}

const plans = ref<PlanRow[]>([])

function effectivePrice(p: PlanRow) {
  const dp = p.discount_price_bdt
  const ok = p.discount_active && dp !== null && dp >= 0 && dp < p.price_bdt
  return ok ? dp : p.price_bdt
}

function hasValidDiscount(p: PlanRow) {
  return (
    p.discount_active &&
    p.discount_price_bdt !== null &&
    p.discount_price_bdt >= 0 &&
    p.discount_price_bdt < p.price_bdt
  )
}

function bonusUsedForPreview(p: PlanRow) {
  return Math.min(referral.referralBonusAvailableBdt || 0, effectivePrice(p))
}

function finalPayablePreview(p: PlanRow) {
  return Math.max(0, effectivePrice(p) - bonusUsedForPreview(p))
}

function showWalletPreview(_p: PlanRow) {
  return !!user.value && referral.referralBonusAvailableBdt > 0
}

function planBullets(_p: PlanRow) {
  return [
    'Tournament access',
    'Access Pro Games',
    'Secure payment (SSLCOMMERZ)',
    'Stacks with remaining time'
  ]
}

function planDesc(p: PlanRow) {
  const d = p.duration_days
  if (d <= 1) return 'Great for a single tournament day.'
  if (d <= 7) return 'Best choice for weekly play.'
  if (d <= 30) return 'Monthly access, maximum convenience.'
  return 'Long-term access, maximum value.'
}

function featured(p: PlanRow) {
  return p.code === '7d' || p.duration_days === 7
}

async function loadPlans() {
  plansLoading.value = true
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select(
        'id, code, title, duration_days, price_bdt, is_active, discount_active, discount_price_bdt, discount_note, created_at'
      )
      .eq('is_active', true)
      .order('duration_days', { ascending: true })

    if (error) throw error
    plans.value = (data || []) as PlanRow[]
  } catch (e: any) {
    toast.add({
      title: 'Failed to load plans',
      description: e?.message || 'Try again.',
      color: 'error'
    })
    plans.value = []
  } finally {
    plansLoading.value = false
  }
}

async function refreshAll() {
  loading.value = true
  okMsg.value = null
  errorMsg.value = null
  try {
    await Promise.all([refreshStatus(), loadPlans(), loadReferralSummary()])
  } finally {
    loading.value = false
  }
}

await refreshAll()

watch(
  () => user.value?.id,
  async () => {
    await refreshAll()
  }
)

function fmt(dt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(dt))
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
  return active.value ? 'Extend access' : 'Subscribe now'
}

function ctaHint(days: number) {
  if (!user.value) return 'Sign in required'
  return active.value
    ? `Adds +${days} day${days > 1 ? 's' : ''} after payment`
    : `Starts after payment • ${days} day${days > 1 ? 's' : ''}`
}

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
  return new Intl.NumberFormat('en-BD').format(v || 0)
}
</script>

<template>
  <UContainer class="py-10">
    <div class="flex flex-col gap-2">
      <h1 class="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        Tournament Passes
      </h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
        Pay with SSLCOMMERZ to unlock tournaments. Buying again extends your access if you still have time left.
      </p>
    </div>

    <div
      class="mt-6 rounded-3xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-6 shadow-sm shadow-black/5 dark:shadow-none"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="text-sm text-gray-600 dark:text-gray-400">Current access</div>

          <div v-if="!user" class="mt-1 text-sm text-gray-700 dark:text-gray-300">
            You’re not logged in.
          </div>

          <div v-else-if="active" class="mt-2">
            <div class="flex items-center gap-2">
              <span class="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <div class="text-base font-semibold text-gray-900 dark:text-gray-100">Active</div>
            </div>

            <div class="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Access until
              <span class="font-medium text-gray-900 dark:text-gray-100">
                {{ endsAt ? fmt(endsAt) : '—' }}
              </span>
              <span class="mx-2 text-gray-400 dark:text-gray-600">•</span>
              Remaining
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ remaining }}</span>
            </div>

            <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Last purchase:
              <span class="font-medium text-gray-900 dark:text-gray-100">
                {{ lastPlanTitle || '—' }}
              </span>
              <span class="mx-2 text-gray-400 dark:text-gray-600">•</span>
              Time stacks on purchase.
            </div>
          </div>

          <div v-else class="mt-2">
            <div class="flex items-center gap-2">
              <span class="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              <div class="text-base font-semibold text-gray-900 dark:text-gray-100">Inactive</div>
            </div>
            <div class="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Choose a pass below to unlock tournaments.
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <UButton class="!rounded-full" size="md" variant="soft" :disabled="!user" @click="refreshAll">
            Refresh
          </UButton>
        </div>
      </div>
    </div>

    <div
      v-if="okMsg"
      class="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-100"
    >
      ✅ {{ okMsg }}
    </div>

    <div
      v-if="errorMsg"
      class="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-900 dark:text-rose-100"
    >
      ⚠️ {{ errorMsg }}
    </div>

    <div
      v-if="loading"
      class="mt-8 rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-6 text-sm text-gray-700 dark:text-gray-300"
    >
      Loading…
    </div>

    <div
      v-else-if="plansLoading"
      class="mt-8 rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-6 text-sm text-gray-700 dark:text-gray-300"
    >
      Loading plans…
    </div>

    <div v-else class="mt-8 grid gap-5 lg:grid-cols-3 lg:items-stretch">
      <div
        v-for="p in plans"
        :key="p.code"
        class="relative rounded-3xl border p-7 flex flex-col border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur shadow-sm shadow-black/5 dark:shadow-none transition-transform duration-200 will-change-transform"
        :class="[
          featured(p)
            ? 'z-10 lg:scale-[1.06] lg:-translate-y-1 ring-1 ring-primary-500/30 dark:ring-primary-400/25'
            : 'lg:scale-100'
        ]"
      >
        <div v-if="featured(p)" class="mb-4">
          <span
            class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs border-gray-200 dark:border-white/15 bg-white/90 dark:bg-black/35 text-gray-800 dark:text-gray-100 shadow-sm shadow-black/5 dark:shadow-none"
          >
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-primary-500" />
            Most Popular
          </span>
        </div>

        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ p.title }}
            </div>
            <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {{ planDesc(p) }}
            </div>
          </div>

          <div
            class="shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs border-gray-200 dark:border-white/15 bg-gray-50 dark:bg-white/10 text-gray-700 dark:text-gray-200"
          >
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-200/70" />
            <span class="font-medium">{{ p.duration_days }} day{{ p.duration_days > 1 ? 's' : '' }}</span>
          </div>
        </div>

        <div class="mt-6">
          <div class="text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            You pay
          </div>

          <div class="mt-2 rounded-2xl border border-primary-500/20 bg-primary-500/10 p-4">
            <div class="flex items-end justify-between gap-3">
              <div>
                <div class="text-4xl font-extrabold tracking-tight text-primary-700 dark:text-primary-300">
                  ৳{{ money(finalPayablePreview(p)) }}
                </div>
                <div class="mt-1 text-sm text-primary-800/80 dark:text-primary-200/80">
                  Final payable amount at checkout
                </div>
              </div>

              <div v-if="showWalletPreview(p)" class="text-right text-xs text-primary-800/75 dark:text-primary-200/75">
                Auto-applied
              </div>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
            <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Base price: ৳{{ money(effectivePrice(p)) }}
            </div>

            <div
              v-if="hasValidDiscount(p)"
              class="text-sm text-gray-500 dark:text-gray-400 line-through"
            >
              ৳{{ money(p.price_bdt) }}
            </div>
          </div>

          <div
            v-if="hasValidDiscount(p) && p.discount_note"
            class="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
          >
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {{ p.discount_note }}
          </div>

          <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Secure checkout with SSLCOMMERZ
          </div>

          <div
            v-if="showWalletPreview(p)"
            class="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3"
          >
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="text-emerald-900/85 dark:text-emerald-100/85">Referral Bonus Applied</span>
              <span class="font-semibold text-emerald-900 dark:text-emerald-100">
                - ৳{{ money(bonusUsedForPreview(p)) }}
              </span>
            </div>

            <div class="mt-2 h-px bg-emerald-500/15" />

            <div class="mt-2 flex items-center justify-between gap-3">
              <span class="text-xs text-emerald-900/70 dark:text-emerald-100/70">
                Final amount to pay now
              </span>
              <span class="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                ৳{{ money(finalPayablePreview(p)) }}
              </span>
            </div>
          </div>
        </div>

        <div class="mt-6 space-y-2 text-sm">
          <div
            v-for="b in planBullets(p)"
            :key="b"
            class="flex items-center gap-2 text-gray-700 dark:text-gray-300"
          >
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-200/60" />
            <span>{{ b }}</span>
          </div>
        </div>

        <div class="flex-1" />

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

        <div class="mt-3 text-center text-xs text-gray-500 dark:text-gray-400 min-h-[18px]">
          {{ ctaHint(p.duration_days) }}
        </div>
      </div>
    </div>

    <div
      v-if="!loading && !plansLoading && plans.length === 0"
      class="mt-6 text-sm text-gray-600 dark:text-gray-400"
    >
      No active plans found. Please contact admin.
    </div>
  </UContainer>
</template>