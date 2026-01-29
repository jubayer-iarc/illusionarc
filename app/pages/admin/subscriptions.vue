<!-- app/pages/admin/subscriptions.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Subscriptions' })

const supabase = useSupabaseClient()
const toast = useToast()

/* ---------------- Types ---------------- */
type SubRow = {
  id: string
  user_id: string
  plan_id: string
  status: 'active' | 'expired' | 'canceled'
  starts_at: string
  ends_at: string
  amount_bdt: number
  currency: string
  provider: string | null
  provider_ref: string | null
  created_at: string
  updated_at: string | null
}

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

type Summary = {
  activeCount: number
  expiring3dCount: number
  expiredCount: number
  canceledCount: number
  totalCount: number
}

/* ---------------- UI State ---------------- */
const tab = ref<'subs' | 'plans'>('subs')

const loading = ref(true)
const refreshing = ref(false)

/* ---------------- Subscriptions List State ---------------- */
const rows = ref<SubRow[]>([])
const totalRows = ref(0)

const page = ref(1)
const pageSize = ref(20)

const q = ref('')
const status = ref<'all' | 'active' | 'expired' | 'canceled'>('all')
const expiring = ref<'all' | '3d'>('all')
const sort = ref<'ends_soon' | 'newest' | 'oldest' | 'amount_high' | 'amount_low'>('ends_soon')

const nameByUserId = ref<Record<string, string>>({})
const summary = ref<Summary>({
  activeCount: 0,
  expiring3dCount: 0,
  expiredCount: 0,
  canceledCount: 0,
  totalCount: 0
})

/* ---------------- Plans Manager State ---------------- */
const plansLoading = ref(true)
const plans = ref<PlanRow[]>([])
const planDrawerOpen = ref(false)
const editingPlan = ref<PlanRow | null>(null)
const planSaving = ref(false)
const planDeleting = ref(false)

const planForm = reactive({
  id: '' as string,
  code: '',
  title: '',
  duration_days: 1,
  price_bdt: 0,
  is_active: true,
  discount_active: false,
  discount_price_bdt: null as number | null,
  discount_note: '' as string
})

/* ---------------- Helpers ---------------- */
function n(v: number) {
  return new Intl.NumberFormat().format(v || 0)
}
function money(v: number) {
  return `৳ ${n(v || 0)}`
}
function fmtDT(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}
function fmtD(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(d)
}

function badgeClass(s: string) {
  const k = String(s || '').toLowerCase()
  if (k === 'active' || k === 'paid' || k === 'success')
    return 'border-emerald-500/25 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  if (k === 'expired' || k === 'ended')
    return 'border-slate-500/25 bg-slate-500/15 text-slate-700 dark:text-slate-300'
  if (k === 'canceled' || k === 'cancelled' || k === 'failed')
    return 'border-rose-500/25 bg-rose-500/15 text-rose-700 dark:text-rose-300'
  if (k === 'pending' || k === 'new' || k === 'warning')
    return 'border-amber-500/25 bg-amber-500/15 text-amber-700 dark:text-amber-300'
  return 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70'
}

function endOfRange(daysFromNow: number) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

function applySort(qb: any) {
  if (sort.value === 'oldest') return qb.order('created_at', { ascending: true })
  if (sort.value === 'newest') return qb.order('created_at', { ascending: false })
  if (sort.value === 'amount_high') return qb.order('amount_bdt', { ascending: false }).order('created_at', { ascending: false })
  if (sort.value === 'amount_low') return qb.order('amount_bdt', { ascending: true }).order('created_at', { ascending: false })
  return qb.order('ends_at', { ascending: true }).order('created_at', { ascending: false }) // ends_soon
}

function isExpiringSoon(r: SubRow) {
  if (r.status !== 'active') return false
  const now = Date.now()
  const end = new Date(r.ends_at).getTime()
  const diff = end - now
  return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000
}

/* ---------------- Load Profiles Map for list ---------------- */
async function loadProfilesMap(subs: SubRow[]) {
  const ids = Array.from(new Set(subs.map((r) => r.user_id).filter(Boolean)))
  if (!ids.length) {
    nameByUserId.value = {}
    return
  }
  const { data, error } = await supabase.from('profiles').select('user_id, display_name').in('user_id', ids)
  if (error) return
  const map: Record<string, string> = {}
  ;(data || []).forEach((p: any) => (map[p.user_id] = p.display_name))
  nameByUserId.value = map
}

/* ---------------- Summary Counts (NO aggregates) ---------------- */
async function loadSummaryCounts() {
  const nowISO = new Date().toISOString()
  const exp3 = endOfRange(3)

  const [allRes, activeRes, expRes, expiredRes, canceledRes] = await Promise.all([
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gt('ends_at', nowISO)
      .lt('ends_at', exp3),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'canceled')
  ])

  const anyErr = allRes.error || activeRes.error || expRes.error || expiredRes.error || canceledRes.error
  if (anyErr) throw anyErr

  summary.value = {
    totalCount: allRes.count || 0,
    activeCount: activeRes.count || 0,
    expiring3dCount: expRes.count || 0,
    expiredCount: expiredRes.count || 0,
    canceledCount: canceledRes.count || 0
  }
}

/* ---------------- Load Subscriptions ---------------- */
async function loadSubscriptions() {
  loading.value = true
  try {
    const from = (page.value - 1) * pageSize.value
    const to = from + pageSize.value - 1

    const nowISO = new Date().toISOString()
    const exp3 = endOfRange(3)

    let qb = supabase
      .from('subscriptions')
      .select(
        'id, user_id, plan_id, status, starts_at, ends_at, amount_bdt, currency, provider, provider_ref, created_at, updated_at',
        { count: 'exact' }
      )

    if (status.value !== 'all') qb = qb.eq('status', status.value)

    if (expiring.value === '3d') {
      qb = qb.eq('status', 'active').gt('ends_at', nowISO).lt('ends_at', exp3)
    }

    const s = q.value.trim()
    if (s) qb = qb.or(`user_id.ilike.%${s}%,provider_ref.ilike.%${s}%`)

    qb = applySort(qb).range(from, to)

    const { data, error, count } = await qb
    if (error) throw error

    rows.value = (data || []) as SubRow[]
    totalRows.value = count || 0

    await loadProfilesMap(rows.value)
  } catch (e: any) {
    toast.add({ title: 'Failed to load subscriptions', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    loading.value = false
  }
}

/* ---------------- Plan Manager: load plans ---------------- */
async function loadPlans() {
  plansLoading.value = true
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('id, code, title, duration_days, price_bdt, is_active, discount_active, discount_price_bdt, discount_note, created_at')
      .order('price_bdt', { ascending: true })

    if (error) throw error
    plans.value = (data || []) as any
  } catch (e: any) {
    toast.add({ title: 'Failed to load plans', description: e?.message || 'Check RLS policies.', color: 'error' })
  } finally {
    plansLoading.value = false
  }
}

function effectivePrice(p: PlanRow) {
  const dp = p.discount_price_bdt ?? null
  const ok = p.discount_active && dp !== null && dp >= 0 && dp < p.price_bdt
  return ok ? dp : p.price_bdt
}

function openCreatePlan() {
  editingPlan.value = null
  Object.assign(planForm, {
    id: '',
    code: '',
    title: '',
    duration_days: 1,
    price_bdt: 0,
    is_active: true,
    discount_active: false,
    discount_price_bdt: null,
    discount_note: ''
  })
  planDrawerOpen.value = true
}

function openEditPlan(p: PlanRow) {
  editingPlan.value = p
  Object.assign(planForm, {
    id: p.id,
    code: p.code,
    title: p.title,
    duration_days: p.duration_days,
    price_bdt: p.price_bdt,
    is_active: p.is_active,
    discount_active: p.discount_active,
    discount_price_bdt: p.discount_price_bdt ?? null,
    discount_note: p.discount_note || ''
  })
  planDrawerOpen.value = true
}

function validatePlan() {
  const code = planForm.code.trim()
  const title = planForm.title.trim()
  if (!code) return 'Code is required (example: day1, week1, month1)'
  if (!title) return 'Title is required'
  if (!Number.isFinite(planForm.duration_days) || planForm.duration_days <= 0) return 'Duration must be > 0'
  if (!Number.isFinite(planForm.price_bdt) || planForm.price_bdt < 0) return 'Price must be >= 0'

  if (planForm.discount_active) {
    if (planForm.discount_price_bdt === null || planForm.discount_price_bdt === undefined) return 'Discount price is required'
    if (planForm.discount_price_bdt < 0) return 'Discount price must be >= 0'
    if (planForm.discount_price_bdt >= planForm.price_bdt) return 'Discount price must be less than base price'
  }
  return null
}

async function savePlan() {
  const err = validatePlan()
  if (err) {
    toast.add({ title: 'Invalid plan', description: err, color: 'error' })
    return
  }

  planSaving.value = true
  try {
    const payload: any = {
      code: planForm.code.trim(),
      title: planForm.title.trim(),
      duration_days: Number(planForm.duration_days),
      price_bdt: Number(planForm.price_bdt),
      is_active: !!planForm.is_active,
      discount_active: !!planForm.discount_active,
      discount_price_bdt: planForm.discount_active ? Number(planForm.discount_price_bdt) : null,
      discount_note: (planForm.discount_note || '').trim() || null
    }

    if (editingPlan.value?.id) {
      const { error } = await supabase.from('subscription_plans').update(payload).eq('id', editingPlan.value.id)
      if (error) throw error
      toast.add({ title: 'Plan updated', color: 'primary' })
    } else {
      const { error } = await supabase.from('subscription_plans').insert(payload)
      if (error) throw error
      toast.add({ title: 'Plan created', color: 'primary' })
    }

    planDrawerOpen.value = false
    await loadPlans()
  } catch (e: any) {
    toast.add({ title: 'Save failed', description: e?.message || 'Check RLS policies.', color: 'error' })
  } finally {
    planSaving.value = false
  }
}

async function deletePlan() {
  if (!editingPlan.value?.id) return
  planDeleting.value = true
  try {
    const { error } = await supabase.from('subscription_plans').delete().eq('id', editingPlan.value.id)
    if (error) throw error
    toast.add({ title: 'Plan deleted', color: 'primary' })
    planDrawerOpen.value = false
    await loadPlans()
  } catch (e: any) {
    toast.add({ title: 'Delete failed', description: e?.message || 'This plan may be referenced by subscriptions.', color: 'error' })
  } finally {
    planDeleting.value = false
  }
}

/* ---------------- Refresh ---------------- */
async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.all([loadSummaryCounts(), loadSubscriptions(), loadPlans()])
  } finally {
    refreshing.value = false
  }
}

watch([page, pageSize], () => loadSubscriptions())
watch([status, expiring, sort], () => {
  page.value = 1
  loadSubscriptions()
})
watch(
  () => q.value,
  () => {
    page.value = 1
    const t = setTimeout(() => loadSubscriptions(), 250)
    return () => clearTimeout(t)
  }
)

onMounted(async () => {
  await refreshAll()
})

const pages = computed(() => Math.max(1, Math.ceil((totalRows.value || 0) / pageSize.value)))
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div
      class="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 lg:p-6 shadow-[0_30px_90px_rgba(0,0,0,.12)] dark:shadow-[0_30px_90px_rgba(0,0,0,.30)] backdrop-blur"
    >
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div
            class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60"
          >
            <span
              class="h-2 w-2 rounded-full"
              style="background: radial-gradient(circle at 30% 30%, #22d3ee, #7c3aed); box-shadow: 0 0 0 6px rgba(34,211,238,.10);"
            />
            Subscriptions
          </div>

          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">
            Subscriptions & Plans
          </h1>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-2xl">
            Manage subscriptions and edit subscription plans (including discounted price).
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
          >
            <UIcon name="i-heroicons-squares-2x2" class="h-5 w-5 opacity-80" />
            Dashboard
          </NuxtLink>

          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition disabled:opacity-60"
            :disabled="refreshing"
            @click="refreshAll"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 opacity-80" />
            {{ refreshing ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="mt-5 flex flex-wrap gap-2">
        <button
          class="rounded-2xl border px-4 py-2 text-sm font-semibold transition"
          :class="tab === 'subs'
            ? 'border-black/10 dark:border-white/10 bg-black/10 dark:bg-white/10 text-black dark:text-white'
            : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10'"
          @click="tab = 'subs'"
        >
          Subscriptions
        </button>

        <button
          class="rounded-2xl border px-4 py-2 text-sm font-semibold transition"
          :class="tab === 'plans'
            ? 'border-black/10 dark:border-white/10 bg-black/10 dark:bg-white/10 text-black dark:text-white'
            : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10'"
          @click="tab = 'plans'"
        >
          Plans
        </button>
      </div>
    </div>

    <!-- SUBSCRIPTIONS TAB -->
    <div v-if="tab === 'subs'" class="space-y-4">
      <!-- Summary cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
          <div class="text-sm font-semibold text-black dark:text-white">Total</div>
          <div class="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(summary.totalCount) }}</span>
          </div>
        </div>
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
          <div class="text-sm font-semibold text-black dark:text-white">Active</div>
          <div class="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(summary.activeCount) }}</span>
          </div>
        </div>
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
          <div class="text-sm font-semibold text-black dark:text-white">Expiring (3d)</div>
          <div class="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(summary.expiring3dCount) }}</span>
          </div>
        </div>
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
          <div class="text-sm font-semibold text-black dark:text-white">Expired</div>
          <div class="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(summary.expiredCount) }}</span>
          </div>
        </div>
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
          <div class="text-sm font-semibold text-black dark:text-white">Canceled</div>
          <div class="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(summary.canceledCount) }}</span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div class="md:col-span-4">
            <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Search</label>
            <input
              v-model="q"
              type="text"
              placeholder="user_id, provider_ref…"
              class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/30"
            />
          </div>

          <div class="md:col-span-3">
            <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Status</label>
            <select v-model="status" class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none">
              <option value="all">All</option>
              <option value="active">active</option>
              <option value="expired">expired</option>
              <option value="canceled">canceled</option>
            </select>
          </div>

          <div class="md:col-span-3">
            <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Expiring</label>
            <select v-model="expiring" class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none">
              <option value="all">All</option>
              <option value="3d">Expiring in 3 days</option>
            </select>
          </div>

          <div class="md:col-span-2">
            <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Sort</label>
            <select v-model="sort" class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none">
              <option value="ends_soon">Ends soon</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="amount_high">Amount (high)</option>
              <option value="amount_low">Amount (low)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">
        <div class="p-4 flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm text-black/60 dark:text-white/60">
            Showing <span class="font-semibold text-black dark:text-white">{{ n(totalRows) }}</span> rows (filtered)
          </div>

          <div class="flex items-center gap-2">
            <select v-model.number="pageSize" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>

            <div class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm">
              <button class="px-2 py-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                      :disabled="page <= 1 || loading" @click="page--">←</button>
              <span class="tabular-nums">{{ page }} / {{ pages }}</span>
              <button class="px-2 py-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                      :disabled="page >= pages || loading" @click="page++">→</button>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="text-left text-xs text-black/60 dark:text-white/60">
              <tr class="border-t border-black/5 dark:border-white/10">
                <th class="px-4 py-3">User</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Period</th>
                <th class="px-4 py-3">Amount</th>
                <th class="px-4 py-3">Provider</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-black/5 dark:divide-white/10">
              <tr v-if="loading">
                <td class="px-4 py-6" colspan="5">
                  <div class="h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
                  <div class="mt-2 h-4 w-1/3 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
                </td>
              </tr>

              <tr v-else v-for="r in rows" :key="r.id" class="hover:bg-black/5 dark:hover:bg-white/5 transition">
                <td class="px-4 py-3">
                  <div class="font-semibold text-black dark:text-white truncate max-w-[260px]">
                    {{ nameByUserId[r.user_id] || '—' }}
                  </div>
                  <div class="text-xs text-black/50 dark:text-white/50 truncate max-w-[260px]">{{ r.user_id }}</div>
                </td>

                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold" :class="badgeClass(r.status)">
                    {{ r.status }}
                  </span>
                  <span
                    v-if="isExpiringSoon(r)"
                    class="ml-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                    :class="badgeClass('warning')"
                  >
                    expiring
                  </span>
                </td>

                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="font-semibold text-black dark:text-white">{{ fmtD(r.starts_at) }} → {{ fmtD(r.ends_at) }}</div>
                  <div class="text-xs text-black/50 dark:text-white/50">created: {{ fmtDT(r.created_at) }}</div>
                </td>

                <td class="px-4 py-3 whitespace-nowrap font-extrabold tabular-nums text-black dark:text-white">
                  {{ money(r.amount_bdt) }}
                </td>

                <td class="px-4 py-3">
                  <div class="font-semibold text-black dark:text-white">{{ r.provider || '—' }}</div>
                  <div class="text-xs text-black/50 dark:text-white/50 truncate max-w-[220px]">{{ r.provider_ref || '—' }}</div>
                </td>
              </tr>

              <tr v-if="!loading && rows.length === 0">
                <td class="px-4 py-10 text-center text-sm text-black/60 dark:text-white/60" colspan="5">
                  No subscriptions found for current filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- PLANS TAB -->
    <div v-else class="space-y-4">
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Subscription Plans</div>
          <div class="text-sm text-black/60 dark:text-white/60">Create/edit plans and set discounted price.</div>
        </div>

        <button
          class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-black/10 dark:hover:bg-white/10 transition"
          @click="openCreatePlan"
        >
          <UIcon name="i-heroicons-plus" class="h-5 w-5 opacity-80" />
          New Plan
        </button>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">
        <div class="p-4 text-sm text-black/60 dark:text-white/60">
          Click a plan to edit.
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="text-left text-xs text-black/60 dark:text-white/60">
              <tr class="border-t border-black/5 dark:border-white/10">
                <th class="px-4 py-3">Code</th>
                <th class="px-4 py-3">Title</th>
                <th class="px-4 py-3">Duration</th>
                <th class="px-4 py-3">Price</th>
                <th class="px-4 py-3">Discount</th>
                <th class="px-4 py-3">Active</th>
                <th class="px-4 py-3 text-right">Edit</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-black/5 dark:divide-white/10">
              <tr v-if="plansLoading">
                <td class="px-4 py-6" colspan="7">
                  <div class="h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
                  <div class="mt-2 h-4 w-1/3 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
                </td>
              </tr>

              <tr
                v-else
                v-for="p in plans"
                :key="p.id"
                class="hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                @click="openEditPlan(p)"
              >
                <td class="px-4 py-3 font-semibold text-black dark:text-white">{{ p.code }}</td>
                <td class="px-4 py-3">
                  <div class="font-semibold text-black dark:text-white">{{ p.title }}</div>
                  <div class="text-xs text-black/50 dark:text-white/50">created: {{ fmtDT(p.created_at) }}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">{{ n(p.duration_days) }} days</td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="font-extrabold tabular-nums text-black dark:text-white">{{ money(p.price_bdt) }}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div v-if="p.discount_active && p.discount_price_bdt !== null" class="flex items-center gap-2">
                    <span class="line-through text-black/40 dark:text-white/40">{{ money(p.price_bdt) }}</span>
                    <span class="font-extrabold tabular-nums text-black dark:text-white">{{ money(effectivePrice(p)) }}</span>
                  </div>
                  <div v-else class="text-black/50 dark:text-white/50">—</div>
                  <div v-if="p.discount_note" class="text-xs text-black/50 dark:text-white/50 truncate max-w-[220px]">
                    {{ p.discount_note }}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                        :class="p.is_active ? badgeClass('active') : badgeClass('expired')">
                    {{ p.is_active ? 'active' : 'inactive' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-black/10 dark:hover:bg-white/10 transition"
                    @click.stop="openEditPlan(p)"
                  >
                    Edit
                  </button>
                </td>
              </tr>

              <tr v-if="!plansLoading && plans.length === 0">
                <td class="px-4 py-10 text-center text-sm text-black/60 dark:text-white/60" colspan="7">
                  No plans found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Plan Drawer -->
      <div v-if="planDrawerOpen" class="fixed inset-0 z-50" aria-modal="true" role="dialog">
        <div class="absolute inset-0 bg-black/40" @click="planDrawerOpen = false" />

        <div class="absolute right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-neutral-950 border-l border-black/10 dark:border-white/10 shadow-2xl overflow-y-auto">
          <div class="p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs text-black/60 dark:text-white/60">Plan</div>
                <div class="mt-1 text-xl font-extrabold tracking-tight text-black dark:text-white">
                  {{ editingPlan ? 'Edit Plan' : 'New Plan' }}
                </div>
                <div class="mt-1 text-sm text-black/60 dark:text-white/60">
                  Code must be unique (example: day1, week1, month1).
                </div>
              </div>

              <button
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
                @click="planDrawerOpen = false"
              >
                Close
              </button>
            </div>

            <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Code</label>
                <input
                  v-model="planForm.code"
                  :disabled="!!editingPlan"
                  class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none disabled:opacity-60"
                  placeholder="day1"
                />
                <div v-if="editingPlan" class="mt-1 text-xs text-black/50 dark:text-white/50">Code cannot be changed.</div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Title</label>
                <input
                  v-model="planForm.title"
                  class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none"
                  placeholder="1 Day Pass"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Duration (days)</label>
                <input
                  v-model.number="planForm.duration_days"
                  type="number"
                  min="1"
                  class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Base Price (BDT)</label>
                <input
                  v-model.number="planForm.price_bdt"
                  type="number"
                  min="0"
                  class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none"
                />
              </div>

              <div class="sm:col-span-2 flex flex-wrap items-center gap-3">
                <label class="inline-flex items-center gap-2 text-sm text-black/70 dark:text-white/70">
                  <input v-model="planForm.is_active" type="checkbox" class="h-4 w-4" />
                  Active
                </label>

                <label class="inline-flex items-center gap-2 text-sm text-black/70 dark:text-white/70">
                  <input v-model="planForm.discount_active" type="checkbox" class="h-4 w-4" />
                  Discount active
                </label>
              </div>

              <div>
                <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Discount Price (BDT)</label>
                <input
                  v-model.number="planForm.discount_price_bdt"
                  :disabled="!planForm.discount_active"
                  type="number"
                  min="0"
                  class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none disabled:opacity-60"
                  placeholder="e.g. 49"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Discount Note (optional)</label>
                <input
                  v-model="planForm.discount_note"
                  :disabled="!planForm.discount_active"
                  class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none disabled:opacity-60"
                  placeholder="New Year offer"
                />
              </div>

              <div class="sm:col-span-2">
                <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
                  <div class="text-xs text-black/60 dark:text-white/60">Effective price shown to users</div>
                  <div class="mt-1 text-xl font-extrabold text-black dark:text-white tabular-nums">
                    {{
                      planForm.discount_active && planForm.discount_price_bdt !== null && planForm.discount_price_bdt < planForm.price_bdt
                        ? money(planForm.discount_price_bdt)
                        : money(planForm.price_bdt)
                    }}
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-6 flex flex-wrap items-center justify-between gap-2">
              <button
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-black/10 dark:hover:bg-white/10 transition disabled:opacity-60"
                :disabled="planSaving"
                @click="savePlan"
              >
                {{ planSaving ? 'Saving…' : (editingPlan ? 'Update Plan' : 'Create Plan') }}
              </button>

              <button
                v-if="editingPlan"
                class="rounded-2xl border border-rose-500/25 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-60"
                :disabled="planDeleting"
                @click="deletePlan"
              >
                {{ planDeleting ? 'Deleting…' : 'Delete Plan' }}
              </button>
            </div>

            <div v-if="editingPlan" class="mt-4 text-xs text-black/50 dark:text-white/50 break-all">
              Plan ID: {{ editingPlan.id }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
