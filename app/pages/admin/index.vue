<!-- app/pages/admin/index.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Dashboard' })

const toast = useToast()
const supabase = useSupabaseClient()

const loading = ref(true)
const refreshing = ref(false)

/* ---------------- Types ---------------- */
type DashboardStats = {
  users: number
  newMessages: number
  newRequests: number
  scoreEvents: number

  paymentsPending: number
  paymentsPaid: number

  totalIncomeBDT: number
  pendingAmountBDT: number

  activeSubs: number
  expiringSubs: number

  liveTournaments: number
  scheduledTournaments: number
  endedUnfinalized: number

  activeServices: number
  activeWorks: number
}

type MsgRow = {
  id: string
  created_at: string
  name: string
  email: string
  subject: string | null
  status: string
  source: string
}

type ReqRow = {
  id: string
  created_at: string
  name: string
  email: string
  project_type: string
  budget: string
  status: string
  source: string
}

type PaymentRow = {
  id: string
  created_at: string
  paid_at: string | null
  user_id: string
  plan_code: string
  amount_bdt: number
  tran_id: string
  status: string
  applied: boolean
}

type ScoreRow = {
  id: number
  created_at: string
  game_slug: string
  player_name: string | null
  score: number
  user_id: string
}

/* ---------------- State ---------------- */
const stats = ref<DashboardStats>({
  users: 0,
  newMessages: 0,
  newRequests: 0,
  scoreEvents: 0,

  paymentsPending: 0,
  paymentsPaid: 0,

  totalIncomeBDT: 0,
  pendingAmountBDT: 0,

  activeSubs: 0,
  expiringSubs: 0,

  liveTournaments: 0,
  scheduledTournaments: 0,
  endedUnfinalized: 0,

  activeServices: 0,
  activeWorks: 0
})

const latestMessages = ref<MsgRow[]>([])
const latestRequests = ref<ReqRow[]>([])
const latestPayments = ref<PaymentRow[]>([])
const latestScores = ref<ScoreRow[]>([])

const nameByUserId = ref<Record<string, string>>({})

/* ---------------- UI helpers ---------------- */
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

function badgeClass(kind: string) {
  const k = String(kind || '').toLowerCase()
  if (k === 'new' || k === 'pending') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
  if (k === 'paid' || k === 'success' || k === 'active') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
  if (k === 'expired' || k === 'ended') return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25'
  if (k === 'failed' || k === 'canceled' || k === 'cancelled') return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25'
  return 'bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 border-black/10 dark:border-white/10'
}
function pill(v: string) {
  return `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(v)}`
}

/* ---------------- Data helpers ---------------- */
async function loadProfilesMapFromPayments(items: PaymentRow[]) {
  const ids = Array.from(new Set(items.map((p) => p.user_id).filter(Boolean)))
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

/* ---------------- Load dashboard ---------------- */
async function loadDashboard() {
  loading.value = true
  try {
    const [
      rpcStatsRes,
      latestMsgsRes,
      latestReqsRes,
      latestPaysRes,
      latestScoresRes
    ] = await Promise.all([
      supabase.rpc('admin_dashboard_stats'),

      supabase
        .from('contact_messages')
        .select('id, created_at, name, email, subject, status, source')
        .order('created_at', { ascending: false })
        .limit(6),

      supabase
        .from('contact_requests')
        .select('id, created_at, name, email, project_type, budget, status, source')
        .order('created_at', { ascending: false })
        .limit(6),

      supabase
        .from('payments')
        .select('id, created_at, paid_at, user_id, plan_code, amount_bdt, tran_id, status, applied')
        .order('created_at', { ascending: false })
        .limit(6),

      supabase
        .from('leaderboard_scores')
        .select('id, created_at, game_slug, player_name, score, user_id')
        .order('created_at', { ascending: false })
        .limit(8)
    ])

    if (rpcStatsRes.error) throw rpcStatsRes.error
    if (latestMsgsRes.error) throw latestMsgsRes.error
    if (latestReqsRes.error) throw latestReqsRes.error
    if (latestPaysRes.error) throw latestPaysRes.error
    if (latestScoresRes.error) throw latestScoresRes.error

    const row = Array.isArray(rpcStatsRes.data) ? rpcStatsRes.data[0] : rpcStatsRes.data
    if (!row) throw new Error('Dashboard RPC returned empty result')

    stats.value = {
      users: Number(row.users || 0),
      newMessages: Number(row.new_messages || 0),
      newRequests: Number(row.new_requests || 0),
      scoreEvents: Number(row.score_events || 0),

      paymentsPending: Number(row.payments_pending || 0),
      paymentsPaid: Number(row.payments_paid || 0),

      totalIncomeBDT: Number(row.total_income_bdt || 0),
      pendingAmountBDT: Number(row.pending_amount_bdt || 0),

      activeSubs: Number(row.active_subs || 0),
      expiringSubs: Number(row.expiring_subs || 0),

      liveTournaments: Number(row.live_tournaments || 0),
      scheduledTournaments: Number(row.scheduled_tournaments || 0),
      endedUnfinalized: Number(row.ended_unfinalized || 0),

      activeServices: Number(row.active_services || 0),
      activeWorks: Number(row.active_works || 0)
    }

    latestMessages.value = (latestMsgsRes.data || []) as MsgRow[]
    latestRequests.value = (latestReqsRes.data || []) as ReqRow[]
    latestPayments.value = (latestPaysRes.data || []) as PaymentRow[]
    latestScores.value = (latestScoresRes.data || []) as ScoreRow[]

    await loadProfilesMapFromPayments(latestPayments.value)
  } catch (e: any) {
    toast.add({ title: 'Failed to load dashboard', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await loadDashboard()
  } finally {
    refreshing.value = false
  }
}

onMounted(loadDashboard)

const attentionCount = computed(() => {
  return (
    (stats.value.newMessages || 0) +
    (stats.value.newRequests || 0) +
    (stats.value.endedUnfinalized || 0) +
    (stats.value.paymentsPending || 0) +
    (stats.value.expiringSubs || 0)
  )
})

const needsAttention = computed(() => attentionCount.value > 0)
</script>

<template>
  <div class="space-y-4">
    <!-- HERO -->
    <div
      class="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 lg:p-6 shadow-[0_30px_90px_rgba(0,0,0,.12)] dark:shadow-[0_30px_90px_rgba(0,0,0,.30)] backdrop-blur"
    >
      <div
        class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-60"
        style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.28), transparent 60%);"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full blur-3xl opacity-60"
        style="background: radial-gradient(circle at 30% 30%, rgba(124,58,237,.26), transparent 60%);"
        aria-hidden="true"
      />

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60">
            <span
              class="h-2 w-2 rounded-full"
              style="background: radial-gradient(circle at 30% 30%, #22d3ee, #7c3aed); box-shadow: 0 0 0 6px rgba(34,211,238,.10);"
            />
            Dashboard
            <span v-if="!loading" class="ml-1 opacity-70">•</span>
            <span v-if="!loading" class="opacity-70">Attention: {{ n(attentionCount) }}</span>
            <span
              v-if="!loading && needsAttention"
              class="ml-2 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              :class="badgeClass('pending')"
            >
              Action needed
            </span>
          </div>

          <h1 class="mt-3 text-2xl lg:text-3xl font-extrabold tracking-tight text-black dark:text-white">
            Admin Command Center
          </h1>
          <p class="mt-1 text-sm text-black/60 dark:text-white/60 max-w-2xl">
            Income, inbox, payments, subscriptions, tournaments, and activity — everything at a glance.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition disabled:opacity-60"
            :disabled="loading || refreshing"
            @click="refresh"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 opacity-80" />
            {{ refreshing ? 'Refreshing…' : 'Refresh' }}
          </button>

          <NuxtLink
            to="/admin/messages"
            class="inline-flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/80 dark:hover:bg-white/10 transition"
          >
            <UIcon name="i-heroicons-inbox" class="h-5 w-5 opacity-90" />
            Inbox
          </NuxtLink>

          <NuxtLink
            to="/admin/payments"
            class="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-violet-500/10 px-4 py-2.5 text-sm font-semibold hover:from-emerald-500/20 hover:via-cyan-500/15 hover:to-violet-500/15 transition"
          >
            <UIcon name="i-heroicons-banknotes" class="h-5 w-5 opacity-90" />
            Payments
          </NuxtLink>

          <NuxtLink
            to="/admin/tournaments"
            class="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/15 via-violet-500/10 to-emerald-500/10 px-4 py-2.5 text-sm font-semibold hover:from-cyan-400/20 hover:via-violet-500/15 hover:to-emerald-500/15 transition"
          >
            <UIcon name="i-heroicons-flag" class="h-5 w-5 opacity-90" />
            Tournaments
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- MONEY + ATTENTION KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-emerald-500/25 bg-emerald-500/10">
              <UIcon name="i-heroicons-banknotes" class="h-5 w-5 opacity-80" />
            </div>
            <div>
              <div class="text-sm font-semibold text-black dark:text-white">Total Income</div>
              <div class="text-xs text-black/60 dark:text-white/60">paid/success</div>
            </div>
          </div>
          <NuxtLink to="/admin/payments" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>

        <div class="mt-4 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-32 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ money(stats.totalIncomeBDT) }}</span>
        </div>

        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          <span :class="pill('paid')">{{ n(stats.paymentsPaid) }} paid tx</span>
        </div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-amber-500/25 bg-amber-500/10">
              <UIcon name="i-heroicons-clock" class="h-5 w-5 opacity-80" />
            </div>
            <div>
              <div class="text-sm font-semibold text-black dark:text-white">Pending Amount</div>
              <div class="text-xs text-black/60 dark:text-white/60">pending</div>
            </div>
          </div>
          <NuxtLink to="/admin/payments" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>

        <div class="mt-4 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-32 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ money(stats.pendingAmountBDT) }}</span>
        </div>

        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          <span :class="pill('pending')">{{ n(stats.paymentsPending) }} pending tx</span>
        </div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-inbox" class="h-5 w-5 opacity-80" />
            </div>
            <div>
              <div class="text-sm font-semibold text-black dark:text-white">New Messages</div>
              <div class="text-xs text-black/60 dark:text-white/60">contact_messages</div>
            </div>
          </div>
          <NuxtLink to="/admin/messages" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>

        <div class="mt-4 flex items-end justify-between gap-3">
          <div class="text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(stats.newMessages) }}</span>
          </div>
          <div class="text-xs">
            <span :class="pill(stats.newMessages > 0 ? 'new' : 'ok')">{{ stats.newMessages > 0 ? 'Needs review' : 'Clear' }}</span>
          </div>
        </div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-clipboard-document-list" class="h-5 w-5 opacity-80" />
            </div>
            <div>
              <div class="text-sm font-semibold text-black dark:text-white">New Requests</div>
              <div class="text-xs text-black/60 dark:text-white/60">contact_requests</div>
            </div>
          </div>
          <NuxtLink to="/admin/requests" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>

        <div class="mt-4 flex items-end justify-between gap-3">
          <div class="text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(stats.newRequests) }}</span>
          </div>
          <div class="text-xs">
            <span :class="pill(stats.newRequests > 0 ? 'new' : 'ok')">{{ stats.newRequests > 0 ? 'Follow up' : 'Clear' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SYSTEM KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-users" class="h-5 w-5 opacity-80" />
            </div>
            <div>
              <div class="text-sm font-semibold text-black dark:text-white">Users</div>
              <div class="text-xs text-black/60 dark:text-white/60">profiles</div>
            </div>
          </div>
          <NuxtLink to="/admin/users" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>
        <div class="mt-4 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ n(stats.users) }}</span>
        </div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-ticket" class="h-5 w-5 opacity-80" />
            </div>
            <div>
              <div class="text-sm font-semibold text-black dark:text-white">Subscriptions</div>
              <div class="text-xs text-black/60 dark:text-white/60">active / expiring</div>
            </div>
          </div>
          <NuxtLink to="/admin/subscriptions" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>

        <div class="mt-4 flex items-end justify-between gap-3">
          <div class="text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-24 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(stats.activeSubs) }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span :class="pill('active')">active</span>
            <span :class="pill(stats.expiringSubs > 0 ? 'pending' : 'ok')">{{ n(stats.expiringSubs) }} expiring</span>
          </div>
        </div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-flag" class="h-5 w-5 opacity-80" />
            </div>
            <div>
              <div class="text-sm font-semibold text-black dark:text-white">Tournaments</div>
              <div class="text-xs text-black/60 dark:text-white/60">live / scheduled / finalize</div>
            </div>
          </div>
          <NuxtLink to="/admin/tournaments" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>

        <div class="mt-4 flex items-end justify-between gap-3">
          <div class="text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-24 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(stats.liveTournaments) }}</span>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2 text-xs">
            <span :class="pill('active')">{{ n(stats.liveTournaments) }} live</span>
            <span :class="pill('scheduled')">{{ n(stats.scheduledTournaments) }} scheduled</span>
            <span :class="pill(stats.endedUnfinalized > 0 ? 'pending' : 'ok')">{{ n(stats.endedUnfinalized) }} finalize</span>
          </div>
        </div>
      </div>

      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-squares-2x2" class="h-5 w-5 opacity-80" />
            </div>
            <div>
              <div class="text-sm font-semibold text-black dark:text-white">Content</div>
              <div class="text-xs text-black/60 dark:text-white/60">services / works</div>
            </div>
          </div>
          <div class="text-xs text-black/60 dark:text-white/60">Quick</div>
        </div>

        <div class="mt-4 flex items-end justify-between gap-3">
          <div class="text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-24 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(stats.activeServices) }}</span>
          </div>

          <div class="flex items-center gap-2 text-xs">
            <NuxtLink to="/admin/services" class="hover:underline text-black/70 dark:text-white/70">Services</NuxtLink>
            <span class="opacity-40">•</span>
            <NuxtLink to="/admin/work" class="hover:underline text-black/70 dark:text-white/70">Works ({{ n(stats.activeWorks) }})</NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- RECENT ACTIVITY -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <!-- Messages -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Recent Messages</div>
            <div class="text-sm text-black/60 dark:text-white/60">Latest from contact_messages</div>
          </div>
          <NuxtLink to="/admin/messages" class="text-sm font-semibold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>

        <div class="mt-4 divide-y divide-black/5 dark:divide-white/10">
          <div v-if="loading" class="py-6">
            <div class="h-4 w-2/3 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
            <div class="mt-2 h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
          </div>

          <div v-else v-for="m in latestMessages" :key="m.id" class="py-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <div class="font-semibold text-black dark:text-white truncate">{{ m.name }}</div>
                <div class="text-xs text-black/50 dark:text-white/50 truncate">{{ m.email }}</div>
                <span :class="pill(m.status)">{{ m.status }}</span>
              </div>
              <div class="mt-1 text-sm text-black/70 dark:text-white/70 truncate">{{ m.subject || 'No subject' }}</div>
              <div class="mt-1 text-xs text-black/50 dark:text-white/50">{{ fmtDT(m.created_at) }} • {{ m.source }}</div>
            </div>
            <NuxtLink to="/admin/messages" class="shrink-0 text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">View →</NuxtLink>
          </div>

          <div v-if="!loading && latestMessages.length === 0" class="py-6 text-sm text-black/60 dark:text-white/60">
            No messages yet.
          </div>
        </div>
      </div>

      <!-- Requests -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Recent Requests</div>
            <div class="text-sm text-black/60 dark:text-white/60">Latest from contact_requests</div>
          </div>
          <NuxtLink to="/admin/requests" class="text-sm font-semibold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>

        <div class="mt-4 divide-y divide-black/5 dark:divide-white/10">
          <div v-if="loading" class="py-6">
            <div class="h-4 w-2/3 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
            <div class="mt-2 h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
          </div>

          <div v-else v-for="r in latestRequests" :key="r.id" class="py-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <div class="font-semibold text-black dark:text-white truncate">{{ r.name }}</div>
                <div class="text-xs text-black/50 dark:text-white/50 truncate">{{ r.email }}</div>
                <span :class="pill(r.status)">{{ r.status }}</span>
              </div>
              <div class="mt-1 text-sm text-black/70 dark:text-white/70 truncate">{{ r.project_type }} • Budget: {{ r.budget }}</div>
              <div class="mt-1 text-xs text-black/50 dark:text-white/50">{{ fmtDT(r.created_at) }} • {{ r.source }}</div>
            </div>
            <NuxtLink to="/admin/requests" class="shrink-0 text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">View →</NuxtLink>
          </div>

          <div v-if="!loading && latestRequests.length === 0" class="py-6 text-sm text-black/60 dark:text-white/60">
            No requests yet.
          </div>
        </div>
      </div>

      <!-- Payments -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Recent Payments</div>
            <div class="text-sm text-black/60 dark:text-white/60">Latest from payments</div>
          </div>
          <NuxtLink to="/admin/payments" class="text-sm font-semibold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>

        <div class="mt-4 divide-y divide-black/5 dark:divide-white/10">
          <div v-if="loading" class="py-6">
            <div class="h-4 w-2/3 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
            <div class="mt-2 h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
          </div>

          <div v-else v-for="p in latestPayments" :key="p.id" class="py-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <div class="font-semibold text-black dark:text-white truncate">
                  {{ p.plan_code }}
                  <span v-if="nameByUserId[p.user_id]" class="ml-2 text-xs font-normal text-black/50 dark:text-white/50">
                    ({{ nameByUserId[p.user_id] }})
                  </span>
                </div>
                <span :class="pill(p.status)">{{ p.status }}</span>
                <span v-if="p.applied" :class="pill('success')">applied</span>
              </div>
              <div class="mt-1 text-sm text-black/70 dark:text-white/70 truncate">{{ money(p.amount_bdt) }} • Tran: {{ p.tran_id }}</div>
              <div class="mt-1 text-xs text-black/50 dark:text-white/50">{{ fmtDT(p.created_at) }} • Paid: {{ fmtDT(p.paid_at) }}</div>
            </div>
            <NuxtLink to="/admin/payments" class="shrink-0 text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">View →</NuxtLink>
          </div>

          <div v-if="!loading && latestPayments.length === 0" class="py-6 text-sm text-black/60 dark:text-white/60">
            No payments yet.
          </div>
        </div>
      </div>

      <!-- Scores -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Latest Scores</div>
            <div class="text-sm text-black/60 dark:text-white/60">Recent leaderboard_scores events</div>
          </div>
          <NuxtLink to="/admin/scores" class="text-sm font-semibold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition">Open →</NuxtLink>
        </div>

        <div class="mt-4 divide-y divide-black/5 dark:divide-white/10">
          <div v-if="loading" class="py-6">
            <div class="h-4 w-2/3 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
            <div class="mt-2 h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
          </div>

          <div v-else v-for="s in latestScores" :key="s.id" class="py-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <div class="font-semibold text-black dark:text-white truncate">{{ s.game_slug }}</div>
                <span class="inline-flex items-center rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2.5 py-1 text-xs font-semibold text-black/70 dark:text-white/70">
                  {{ s.player_name || 'Player' }}
                </span>
              </div>
              <div class="mt-1 text-sm text-black/70 dark:text-white/70">
                Score: <span class="font-extrabold tabular-nums">{{ n(s.score) }}</span>
              </div>
              <div class="mt-1 text-xs text-black/50 dark:text-white/50">{{ fmtDT(s.created_at) }} • User: {{ s.user_id }}</div>
            </div>
            <NuxtLink to="/admin/scores" class="shrink-0 text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">View →</NuxtLink>
          </div>

          <div v-if="!loading && latestScores.length === 0" class="py-6 text-sm text-black/60 dark:text-white/60">
            No scores yet.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
