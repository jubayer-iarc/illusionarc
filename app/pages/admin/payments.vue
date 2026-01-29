<!-- app/pages/admin/payments.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Payments' })

const supabase = useSupabaseClient()
const toast = useToast()

type PaymentRow = {
  id: string
  created_at: string
  paid_at: string | null
  user_id: string
  plan_code: string
  amount_bdt: number
  currency: string
  provider: string
  tran_id: string
  ssl_sessionkey: string | null
  val_id: string | null
  status: string
  applied: boolean
  raw_ipn: any | null
  raw_validation: any | null
}

const loading = ref(true)
const refreshing = ref(false)

const rows = ref<PaymentRow[]>([])
const totalRows = ref(0)

const page = ref(1)
const pageSize = ref(20)

const q = ref('')
const status = ref<'all' | 'pending' | 'paid' | 'success' | 'failed' | 'canceled'>('all')
const applied = ref<'all' | 'applied' | 'not_applied'>('all')
const sort = ref<'newest' | 'oldest' | 'amount_high' | 'amount_low'>('newest')

const nameByUserId = ref<Record<string, string>>({})

const savingId = ref<string | null>(null)
const selected = ref<PaymentRow | null>(null)
const detailOpen = ref(false)

const summary = ref({
  totalIncomeBDT: 0,
  pendingAmountBDT: 0,
  paidCount: 0,
  pendingCount: 0,
  appliedCount: 0,
  totalCount: 0
})

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

function badgeClass(s: string) {
  const k = String(s || '').toLowerCase()
  if (k === 'pending') return 'border-amber-500/25 bg-amber-500/15 text-amber-700 dark:text-amber-300'
  if (k === 'paid' || k === 'success') return 'border-emerald-500/25 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  if (k === 'failed') return 'border-rose-500/25 bg-rose-500/15 text-rose-700 dark:text-rose-300'
  if (k === 'canceled' || k === 'cancelled') return 'border-slate-500/25 bg-slate-500/15 text-slate-700 dark:text-slate-300'
  return 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70'
}

function openRow(r: PaymentRow) {
  selected.value = r
  detailOpen.value = true
}

function applySort(qb: any) {
  if (sort.value === 'oldest') return qb.order('created_at', { ascending: true })
  if (sort.value === 'amount_high') return qb.order('amount_bdt', { ascending: false }).order('created_at', { ascending: false })
  if (sort.value === 'amount_low') return qb.order('amount_bdt', { ascending: true }).order('created_at', { ascending: false })
  return qb.order('created_at', { ascending: false })
}

async function loadProfilesMap(paymentRows: PaymentRow[]) {
  const ids = Array.from(new Set(paymentRows.map((r) => r.user_id).filter(Boolean)))
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

async function loadSummary() {
  const { data, error } = await supabase.rpc('admin_payments_summary')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Payments summary RPC returned empty result')

  summary.value = {
    totalIncomeBDT: Number(row.total_income_bdt || 0),
    pendingAmountBDT: Number(row.pending_amount_bdt || 0),
    paidCount: Number(row.paid_count || 0),
    pendingCount: Number(row.pending_count || 0),
    appliedCount: Number(row.applied_count || 0),
    totalCount: Number(row.total_count || 0)
  }
}

async function loadPayments() {
  loading.value = true
  try {
    const from = (page.value - 1) * pageSize.value
    const to = from + pageSize.value - 1

    let qb = supabase
      .from('payments')
      .select(
        'id, created_at, paid_at, user_id, plan_code, amount_bdt, currency, provider, tran_id, ssl_sessionkey, val_id, status, applied, raw_ipn, raw_validation',
        { count: 'exact' }
      )

    if (status.value !== 'all') qb = qb.eq('status', status.value)
    if (applied.value === 'applied') qb = qb.eq('applied', true)
    if (applied.value === 'not_applied') qb = qb.eq('applied', false)

    const s = q.value.trim()
    if (s) qb = qb.or(`tran_id.ilike.%${s}%,user_id.ilike.%${s}%,plan_code.ilike.%${s}%`)

    qb = applySort(qb).range(from, to)

    const { data, error, count } = await qb
    if (error) throw error

    rows.value = (data || []) as PaymentRow[]
    totalRows.value = count || 0

    await loadProfilesMap(rows.value)
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.all([loadSummary(), loadPayments()])
  } catch (e: any) {
    toast.add({ title: 'Failed to load payments', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    refreshing.value = false
  }
}

async function toggleApplied(row: PaymentRow) {
  try {
    savingId.value = row.id
    const next = !row.applied
    const { error } = await supabase.from('payments').update({ applied: next }).eq('id', row.id)
    if (error) throw error
    row.applied = next
    if (selected.value?.id === row.id) selected.value = { ...row }
    toast.add({ title: next ? 'Marked applied' : 'Marked not applied', color: 'primary' })
    await loadSummary()
  } catch (e: any) {
    toast.add({ title: 'Update failed', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    savingId.value = null
  }
}

async function setStatus(row: PaymentRow, nextStatus: string) {
  try {
    savingId.value = row.id
    const patch: any = { status: nextStatus }
    if ((nextStatus === 'paid' || nextStatus === 'success') && !row.paid_at) patch.paid_at = new Date().toISOString()
    const { error } = await supabase.from('payments').update(patch).eq('id', row.id)
    if (error) throw error
    row.status = nextStatus
    if (patch.paid_at) row.paid_at = patch.paid_at
    if (selected.value?.id === row.id) selected.value = { ...row }
    toast.add({ title: `Status set to ${nextStatus}`, color: 'primary' })
    await loadSummary()
  } catch (e: any) {
    toast.add({ title: 'Update failed', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    savingId.value = null
  }
}

watch([page, pageSize], () => loadPayments())
watch([status, applied, sort], () => {
  page.value = 1
  loadPayments()
})
watch(
  () => q.value,
  () => {
    page.value = 1
    const t = setTimeout(() => loadPayments(), 250)
    return () => clearTimeout(t)
  }
)

onMounted(refreshAll)

const pages = computed(() => Math.max(1, Math.ceil((totalRows.value || 0) / pageSize.value)))
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 lg:p-6 shadow-[0_30px_90px_rgba(0,0,0,.12)] dark:shadow-[0_30px_90px_rgba(0,0,0,.30)] backdrop-blur">
      <div class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-60"
           style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.28), transparent 60%);" />
      <div class="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full blur-3xl opacity-60"
           style="background: radial-gradient(circle at 30% 30%, rgba(124,58,237,.26), transparent 60%);" />

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60">
            <span class="h-2 w-2 rounded-full"
                  style="background: radial-gradient(circle at 30% 30%, #22d3ee, #7c3aed); box-shadow: 0 0 0 6px rgba(34,211,238,.10);" />
            Payments
          </div>

          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">
            Payments & Income
          </h1>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-2xl">
            Overall income + pending amount (from RPC), and full transaction list.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <NuxtLink to="/admin"
            class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition">
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
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="text-sm font-semibold text-black dark:text-white">Overall Income</div>
        <div class="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-36 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ money(summary.totalIncomeBDT) }}</span>
        </div>
        <div class="mt-1 text-xs text-black/60 dark:text-white/60">paid/success only</div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="text-sm font-semibold text-black dark:text-white">Pending Amount</div>
        <div class="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-36 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ money(summary.pendingAmountBDT) }}</span>
        </div>
        <div class="mt-1 text-xs text-black/60 dark:text-white/60">pending only</div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="text-sm font-semibold text-black dark:text-white">Paid Tx</div>
        <div class="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ n(summary.paidCount) }}</span>
        </div>
        <div class="mt-1 text-xs text-black/60 dark:text-white/60">paid/success</div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="text-sm font-semibold text-black dark:text-white">Pending Tx</div>
        <div class="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ n(summary.pendingCount) }}</span>
        </div>
        <div class="mt-1 text-xs text-black/60 dark:text-white/60">pending</div>
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
            placeholder="tran_id, user_id, plan_code…"
            class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/30"
          />
        </div>

        <div class="md:col-span-3">
          <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Status</label>
          <select v-model="status" class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none">
            <option value="all">All</option>
            <option value="pending">pending</option>
            <option value="paid">paid</option>
            <option value="success">success</option>
            <option value="failed">failed</option>
            <option value="canceled">canceled</option>
          </select>
        </div>

        <div class="md:col-span-3">
          <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Applied</label>
          <select v-model="applied" class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none">
            <option value="all">All</option>
            <option value="applied">Applied</option>
            <option value="not_applied">Not applied</option>
          </select>
        </div>

        <div class="md:col-span-2">
          <label class="block text-xs font-semibold text-black/70 dark:text-white/70 mb-1">Sort</label>
          <select v-model="sort" class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm outline-none">
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
              <th class="px-4 py-3">Created</th>
              <th class="px-4 py-3">User</th>
              <th class="px-4 py-3">Plan</th>
              <th class="px-4 py-3">Amount</th>
              <th class="px-4 py-3">Tran ID</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Applied</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-black/5 dark:divide-white/10">
            <tr v-if="loading">
              <td class="px-4 py-6" colspan="8">
                <div class="h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
                <div class="mt-2 h-4 w-1/3 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
              </td>
            </tr>

            <tr v-else v-for="r in rows" :key="r.id" class="hover:bg-black/5 dark:hover:bg-white/5 transition">
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="font-semibold text-black dark:text-white">{{ fmtDT(r.created_at) }}</div>
                <div class="text-xs text-black/50 dark:text-white/50">Paid: {{ fmtDT(r.paid_at) }}</div>
              </td>

              <td class="px-4 py-3">
                <div class="font-semibold text-black dark:text-white truncate max-w-[220px]">
                  {{ nameByUserId[r.user_id] || '—' }}
                </div>
                <div class="text-xs text-black/50 dark:text-white/50 truncate max-w-[220px]">
                  {{ r.user_id }}
                </div>
              </td>

              <td class="px-4 py-3 whitespace-nowrap">
                <div class="font-semibold text-black dark:text-white">{{ r.plan_code }}</div>
                <div class="text-xs text-black/50 dark:text-white/50">{{ r.provider }}</div>
              </td>

              <td class="px-4 py-3 whitespace-nowrap font-extrabold tabular-nums text-black dark:text-white">
                {{ money(r.amount_bdt) }}
              </td>

              <td class="px-4 py-3 whitespace-nowrap">
                <div class="font-semibold text-black dark:text-white">{{ r.tran_id }}</div>
                <div class="text-xs text-black/50 dark:text-white/50 truncate max-w-[180px]">val_id: {{ r.val_id || '—' }}</div>
              </td>

              <td class="px-4 py-3 whitespace-nowrap">
                <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold" :class="badgeClass(r.status)">
                  {{ r.status }}
                </span>
              </td>

              <td class="px-4 py-3 whitespace-nowrap">
                <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                      :class="r.applied ? badgeClass('success') : badgeClass('other')">
                  {{ r.applied ? 'applied' : 'not applied' }}
                </span>
              </td>

              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-black/10 dark:hover:bg-white/10 transition"
                    @click="openRow(r)"
                  >
                    View
                  </button>

                  <button
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-black/10 dark:hover:bg-white/10 transition disabled:opacity-60"
                    :disabled="savingId === r.id"
                    @click="toggleApplied(r)"
                  >
                    {{ r.applied ? 'Unapply' : 'Apply' }}
                  </button>

                  <select
                    class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-xs font-semibold outline-none disabled:opacity-60"
                    :disabled="savingId === r.id"
                    :value="r.status"
                    @change="setStatus(r, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="pending">pending</option>
                    <option value="paid">paid</option>
                    <option value="success">success</option>
                    <option value="failed">failed</option>
                    <option value="canceled">canceled</option>
                  </select>
                </div>
              </td>
            </tr>

            <tr v-if="!loading && rows.length === 0">
              <td class="px-4 py-10 text-center text-sm text-black/60 dark:text-white/60" colspan="8">
                No payments found for current filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Details drawer -->
    <div v-if="detailOpen && selected" class="fixed inset-0 z-50" aria-modal="true" role="dialog">
      <div class="absolute inset-0 bg-black/40" @click="detailOpen = false" />

      <div class="absolute right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-neutral-950 border-l border-black/10 dark:border-white/10 shadow-2xl overflow-y-auto">
        <div class="p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs text-black/60 dark:text-white/60">Payment</div>
              <div class="mt-1 text-xl font-extrabold tracking-tight text-black dark:text-white">{{ selected.tran_id }}</div>
              <div class="mt-1 text-sm text-black/60 dark:text-white/60">
                {{ fmtDT(selected.created_at) }} • {{ selected.provider }} • {{ selected.plan_code }}
              </div>
            </div>

            <button class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition"
                    @click="detailOpen = false">
              Close
            </button>
          </div>

          <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">User</div>
              <div class="mt-1 font-semibold text-black dark:text-white">{{ nameByUserId[selected.user_id] || '—' }}</div>
              <div class="mt-1 text-xs text-black/50 dark:text-white/50 break-all">{{ selected.user_id }}</div>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Amount</div>
              <div class="mt-1 font-extrabold text-black dark:text-white">{{ money(selected.amount_bdt) }}</div>
              <div class="mt-1 text-xs text-black/50 dark:text-white/50">{{ selected.currency }} • {{ selected.provider }}</div>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Status</div>
              <div class="mt-2 flex items-center gap-2">
                <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold" :class="badgeClass(selected.status)">
                  {{ selected.status }}
                </span>
                <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                      :class="selected.applied ? badgeClass('success') : badgeClass('other')">
                  {{ selected.applied ? 'applied' : 'not applied' }}
                </span>
              </div>
              <div class="mt-2 text-xs text-black/50 dark:text-white/50">paid_at: {{ fmtDT(selected.paid_at) }}</div>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Gateway IDs</div>
              <div class="mt-1 text-sm text-black dark:text-white break-all">
                <div><span class="font-semibold">val_id:</span> {{ selected.val_id || '—' }}</div>
                <div><span class="font-semibold">sessionkey:</span> {{ selected.ssl_sessionkey || '—' }}</div>
              </div>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap gap-2">
            <button
              class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-black/10 dark:hover:bg-white/10 transition disabled:opacity-60"
              :disabled="savingId === selected.id"
              @click="toggleApplied(selected)"
            >
              {{ selected.applied ? 'Mark not applied' : 'Mark applied' }}
            </button>

            <select
              class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-sm font-semibold outline-none disabled:opacity-60"
              :disabled="savingId === selected.id"
              :value="selected.status"
              @change="setStatus(selected, ($event.target as HTMLSelectElement).value)"
            >
              <option value="pending">pending</option>
              <option value="paid">paid</option>
              <option value="success">success</option>
              <option value="failed">failed</option>
              <option value="canceled">canceled</option>
            </select>
          </div>

          <div class="mt-6 space-y-3">
            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
              <div class="text-sm font-extrabold text-black dark:text-white">raw_ipn</div>
              <pre class="mt-2 text-xs overflow-auto whitespace-pre-wrap break-words text-black/70 dark:text-white/70">{{ JSON.stringify(selected.raw_ipn, null, 2) }}</pre>
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
              <div class="text-sm font-extrabold text-black dark:text-white">raw_validation</div>
              <pre class="mt-2 text-xs overflow-auto whitespace-pre-wrap break-words text-black/70 dark:text-white/70">{{ JSON.stringify(selected.raw_validation, null, 2) }}</pre>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
