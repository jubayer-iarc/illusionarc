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
  scoreEvents: number

  paymentsPending: number
  paymentsPaid: number
  totalIncomeBDT: number

  activeSubs: number
  expiringSubs: number

  liveTournaments: number
  scheduledTournaments: number

  endedTotal: number
  endedFinalized: number
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

type TournamentRow = {
  id: string
  slug: string
  title: string
  game_slug: string
  starts_at: string
  ends_at: string
  status: string
  finalized: boolean
  thumbnail_url?: string | null
}

type PrizeSummary = {
  count: number
  top_prize: string | null
}

/* ---------------- State ---------------- */
const stats = ref<DashboardStats>({
  users: 0,
  newMessages: 0,
  scoreEvents: 0,

  paymentsPending: 0,
  paymentsPaid: 0,
  totalIncomeBDT: 0,

  activeSubs: 0,
  expiringSubs: 0,

  liveTournaments: 0,
  scheduledTournaments: 0,

  endedTotal: 0,
  endedFinalized: 0,
  endedUnfinalized: 0,

  activeServices: 0,
  activeWorks: 0
})

const latestMessages = ref<MsgRow[]>([])
const latestPayments = ref<PaymentRow[]>([])
const latestScores = ref<ScoreRow[]>([])
const upcomingTournaments = ref<TournamentRow[]>([])
const liveTournaments = ref<TournamentRow[]>([])

const nameByUserId = ref<Record<string, string>>({})
const prizeSummaryMap = ref<Record<string, PrizeSummary>>({})

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
function fmtDate(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(d)
}
function minutesFromNow(iso: string) {
  const t = new Date(iso).getTime()
  const diff = t - Date.now()
  if (!Number.isFinite(t)) return null
  return Math.round(diff / 60000)
}
function relTime(iso: string) {
  const m = minutesFromNow(iso)
  if (m == null) return '—'
  if (m < 0) return 'started'
  if (m < 60) return `in ${m}m`
  const h = Math.round(m / 60)
  if (h < 48) return `in ${h}h`
  const d = Math.round(h / 24)
  return `in ${d}d`
}

function badgeClass(kind: string) {
  const k = String(kind || '').toLowerCase()
  if (k === 'new' || k === 'pending') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
  if (k === 'paid' || k === 'success' || k === 'active' || k === 'live' || k === 'ok') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
  if (k === 'expired' || k === 'ended') return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25'
  if (k === 'failed' || k === 'canceled' || k === 'cancelled') return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25'
  if (k === 'scheduled') return 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25'
  if (k === 'finalized') return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25'
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

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', ids)

  if (error) return

  const map: Record<string, string> = {}
  ;(data || []).forEach((p: any) => {
    const uid = String(p?.user_id || '').trim()
    if (!uid) return
    map[uid] = String(p?.display_name || '').trim()
  })

  nameByUserId.value = map
}

async function loadPrizeSummaryForTournaments(rows: TournamentRow[]) {
  const ids = Array.from(new Set(rows.map((t) => String(t.id || '').trim()).filter(Boolean)))
  prizeSummaryMap.value = {}

  if (!ids.length) return

  const { data, error } = await supabase
    .from('tournament_prize_map')
    .select(`
      tournament_id,
      rank,
      prize:tournament_prizes!tournament_prize_map_prize_id_fkey (
        title
      )
    `)
    .in('tournament_id', ids)
    .order('rank', { ascending: true })

  if (error) return

  const grouped: Record<string, Array<{ rank: number; title: string }>> = {}

  for (const row of data || []) {
    const tid = String((row as any)?.tournament_id || '').trim()
    const rank = Number((row as any)?.rank || 0)
    const title = String((row as any)?.prize?.title || '').trim()

    if (!tid || !title) continue
    if (!grouped[tid]) grouped[tid] = []
    grouped[tid].push({ rank, title })
  }

  const out: Record<string, PrizeSummary> = {}

  for (const tid of Object.keys(grouped)) {
    const arr = grouped[tid].sort((a, b) => a.rank - b.rank)
    out[tid] = {
      count: arr.length,
      top_prize: arr[0]?.title || null
    }
  }

  prizeSummaryMap.value = out
}

function tournamentPills(t: TournamentRow) {
  const summary = prizeSummaryMap.value[t.id]
  const out: string[] = []

  if (summary?.count) out.push(`${summary.count} prize${summary.count > 1 ? 's' : ''}`)
  if (summary?.top_prize) out.push(`Top: ${summary.top_prize}`)

  return out.slice(0, 2)
}

/* ---------------- Load dashboard ---------------- */
async function loadDashboard() {
  loading.value = true

  try {
    const nowIso = new Date().toISOString()

    const [rpcStatsRes, latestMsgsRes, latestPaysRes, latestScoresRes, upcomingRes, liveRes] =
      await Promise.all([
        supabase.rpc('admin_dashboard_stats'),

        supabase
          .from('contact_messages')
          .select('id, created_at, name, email, subject, status, source')
          .order('created_at', { ascending: false })
          .limit(3),

        supabase
          .from('payments')
          .select('id, created_at, paid_at, user_id, plan_code, amount_bdt, tran_id, status, applied')
          .order('created_at', { ascending: false })
          .limit(3),

        supabase
          .from('leaderboard_scores')
          .select('id, created_at, game_slug, player_name, score, user_id')
          .order('created_at', { ascending: false })
          .limit(3),

        supabase
          .from('tournaments')
          .select('id, slug, title, game_slug, starts_at, ends_at, status, finalized, thumbnail_url')
          .neq('status', 'canceled')
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(5),

        supabase
          .from('tournaments')
          .select('id, slug, title, game_slug, starts_at, ends_at, status, finalized, thumbnail_url')
          .neq('status', 'canceled')
          .lte('starts_at', nowIso)
          .gte('ends_at', nowIso)
          .order('ends_at', { ascending: true })
          .limit(5)
      ])

    if (rpcStatsRes.error) throw rpcStatsRes.error
    if (latestMsgsRes.error) throw latestMsgsRes.error
    if (latestPaysRes.error) throw latestPaysRes.error
    if (latestScoresRes.error) throw latestScoresRes.error
    if (upcomingRes.error) throw upcomingRes.error
    if (liveRes.error) throw liveRes.error

    const row: any = Array.isArray(rpcStatsRes.data) ? rpcStatsRes.data[0] : rpcStatsRes.data
    if (!row) throw new Error('Dashboard RPC returned empty result')

    stats.value = {
      users: Number(row.users || 0),
      newMessages: Number(row.new_messages || 0),
      scoreEvents: Number(row.score_events || 0),

      paymentsPending: Number(row.payments_pending || 0),
      paymentsPaid: Number(row.payments_paid || 0),
      totalIncomeBDT: Number(row.total_income_bdt || 0),

      activeSubs: Number(row.active_subs || 0),
      expiringSubs: Number(row.expiring_subs || 0),

      liveTournaments: Number(row.live_tournaments || 0),
      scheduledTournaments: Number(row.scheduled_tournaments || 0),

      endedTotal: Number(row.ended_total || 0),
      endedFinalized: Number(row.ended_finalized || 0),
      endedUnfinalized: Number(row.ended_unfinalized || 0),

      activeServices: Number(row.active_services || 0),
      activeWorks: Number(row.active_works || 0)
    }

    latestMessages.value = (latestMsgsRes.data || []) as MsgRow[]
    latestPayments.value = (latestPaysRes.data || []) as PaymentRow[]
    latestScores.value = (latestScoresRes.data || []) as ScoreRow[]
    upcomingTournaments.value = (upcomingRes.data || []) as TournamentRow[]
    liveTournaments.value = (liveRes.data || []) as TournamentRow[]

    await Promise.all([
      loadProfilesMapFromPayments(latestPayments.value),
      loadPrizeSummaryForTournaments([
        ...upcomingTournaments.value,
        ...liveTournaments.value
      ])
    ])
  } catch (e: any) {
    toast.add({
      title: 'Failed to load dashboard',
      description: e?.message || 'Try again.',
      color: 'error'
    })
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
          <div
            class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs text-black/60 dark:text-white/60"
          >
            <span
              class="h-2 w-2 rounded-full"
              style="background: radial-gradient(circle at 30% 30%, #22d3ee, #7c3aed); box-shadow: 0 0 0 6px rgba(34,211,238,.10);"
            />
            Admin Dashboard
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
            Messages, payments, scores, tournaments — the essentials, clean and fast.
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

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <!-- Total Income -->
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
          <NuxtLink to="/admin/payments" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">
            Open →
          </NuxtLink>
        </div>

        <div class="mt-4 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-32 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ money(stats.totalIncomeBDT) }}</span>
        </div>

        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          <span :class="pill('paid')">{{ n(stats.paymentsPaid) }} paid</span>
          <span v-if="stats.paymentsPending > 0" :class="pill('pending')">{{ n(stats.paymentsPending) }} pending</span>
        </div>
      </div>

      <!-- Users -->
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
          <NuxtLink to="/admin/users" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">
            Open →
          </NuxtLink>
        </div>

        <div class="mt-4 text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
          <span v-if="loading" class="inline-block h-9 w-20 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
          <span v-else>{{ n(stats.users) }}</span>
        </div>
      </div>

      <!-- Inbox -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <UIcon name="i-heroicons-inbox" class="h-5 w-5 opacity-80" />
            </div>
            <div>
              <div class="text-sm font-semibold text-black dark:text-white">Inbox</div>
              <div class="text-xs text-black/60 dark:text-white/60">new messages</div>
            </div>
          </div>
          <NuxtLink to="/admin/messages" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">
            Open →
          </NuxtLink>
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

      <!-- Tournaments focus -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl grid place-items-center border border-cyan-500/25 bg-cyan-500/10">
              <UIcon name="i-heroicons-flag" class="h-5 w-5 opacity-80" />
            </div>
            <div>
              <div class="text-sm font-semibold text-black dark:text-white">Tournaments</div>
              <div class="text-xs text-black/60 dark:text-white/60">live + upcoming + ended</div>
            </div>
          </div>
          <NuxtLink to="/admin/tournaments" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">
            Open →
          </NuxtLink>
        </div>

        <div class="mt-4 flex items-end justify-between gap-3">
          <div class="text-3xl font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            <span v-if="loading" class="inline-block h-9 w-24 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <span v-else>{{ n(stats.endedTotal) }}</span>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2 text-xs">
            <span :class="pill('live')">{{ n(stats.liveTournaments) }} live</span>
            <span :class="pill('scheduled')">{{ n(stats.scheduledTournaments) }} scheduled</span>
            <span :class="pill('finalized')">{{ n(stats.endedFinalized) }} finalized</span>
            <span v-if="stats.endedUnfinalized > 0" :class="pill('pending')">{{ n(stats.endedUnfinalized) }} needs finalize</span>
          </div>
        </div>
      </div>
    </div>

    <!-- CONTENT + SUBS -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <!-- Subscriptions -->
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
          <NuxtLink to="/admin/subscriptions" class="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition">
            Open →
          </NuxtLink>
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

      <!-- Content -->
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
            <NuxtLink to="/admin/works" class="hover:underline text-black/70 dark:text-white/70">
              Works ({{ n(stats.activeWorks) }})
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-gradient-to-br from-cyan-400/10 via-violet-500/10 to-emerald-500/10 p-4 backdrop-blur">
        <div
          class="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl opacity-40"
          style="background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.30), transparent 60%);"
        />
        <div class="text-sm font-extrabold tracking-tight text-black dark:text-white">Quick Actions</div>
        <div class="mt-1 text-xs text-black/60 dark:text-white/60">Jump straight to your daily ops.</div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <NuxtLink
            to="/admin/messages"
            class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/90 dark:hover:bg-white/10 transition"
          >
            Inbox →
          </NuxtLink>
          <NuxtLink
            to="/admin/payments"
            class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/90 dark:hover:bg-white/10 transition"
          >
            Payments →
          </NuxtLink>
          <NuxtLink
            to="/admin/tournaments"
            class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/90 dark:hover:bg-white/10 transition"
          >
            Tournaments →
          </NuxtLink>
          <NuxtLink
            to="/admin/subscriptions"
            class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/90 dark:hover:bg-white/10 transition"
          >
            Subscriptions →
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- MAIN PANELS -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
      <!-- LEFT -->
      <div class="xl:col-span-2 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <!-- Recent Messages -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur lg:col-span-1">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Recent Messages</div>
              <div class="text-xs text-black/60 dark:text-white/60">Latest 3 from contact_messages</div>
            </div>
            <NuxtLink to="/admin/messages" class="text-xs font-semibold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition">
              Open →
            </NuxtLink>
          </div>

          <div class="mt-4 space-y-3">
            <div v-if="loading" class="space-y-2">
              <div class="h-4 w-2/3 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
              <div class="h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
              <div class="h-4 w-3/5 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
            </div>

            <div v-else-if="latestMessages.length === 0" class="py-4 text-sm text-black/60 dark:text-white/60">
              No messages yet.
            </div>

            <div
              v-else
              v-for="m in latestMessages"
              :key="m.id"
              class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 hover:bg-white/80 dark:hover:bg-white/10 transition"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <div class="font-semibold text-black dark:text-white truncate">{{ m.name }}</div>
                    <span :class="pill(m.status)">{{ m.status }}</span>
                  </div>
                  <div class="mt-1 text-xs text-black/60 dark:text-white/60 truncate">{{ m.email }}</div>
                  <div class="mt-2 text-sm text-black/70 dark:text-white/70 line-clamp-1">{{ m.subject || 'No subject' }}</div>
                  <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">{{ fmtDT(m.created_at) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Payments -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur lg:col-span-1">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Recent Payments</div>
              <div class="text-xs text-black/60 dark:text-white/60">Latest 3 from payments</div>
            </div>
            <NuxtLink to="/admin/payments" class="text-xs font-semibold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition">
              Open →
            </NuxtLink>
          </div>

          <div class="mt-4 space-y-3">
            <div v-if="loading" class="space-y-2">
              <div class="h-4 w-2/3 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
              <div class="h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
              <div class="h-4 w-3/5 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
            </div>

            <div v-else-if="latestPayments.length === 0" class="py-4 text-sm text-black/60 dark:text-white/60">
              No payments yet.
            </div>

            <div
              v-else
              v-for="p in latestPayments"
              :key="p.id"
              class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 hover:bg-white/80 dark:hover:bg-white/10 transition"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="font-semibold text-black dark:text-white truncate">
                      {{ p.plan_code }}
                      <span v-if="nameByUserId[p.user_id]" class="ml-1 text-xs font-normal text-black/50 dark:text-white/50">
                        ({{ nameByUserId[p.user_id] }})
                      </span>
                    </div>
                    <span :class="pill(p.status)">{{ p.status }}</span>
                    <span v-if="p.applied" :class="pill('success')">applied</span>
                  </div>
                  <div class="mt-2 text-sm text-black/70 dark:text-white/70 truncate">
                    {{ money(p.amount_bdt) }} • Tran: {{ p.tran_id }}
                  </div>
                  <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">
                    {{ fmtDT(p.created_at) }} <span class="opacity-50">•</span> Paid: {{ fmtDT(p.paid_at) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Latest Scores -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur lg:col-span-1">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Latest Scores</div>
              <div class="text-xs text-black/60 dark:text-white/60">Latest 3 from leaderboard_scores</div>
            </div>
            <NuxtLink to="/admin/scores" class="text-xs font-semibold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition">
              Open →
            </NuxtLink>
          </div>

          <div class="mt-4 space-y-3">
            <div v-if="loading" class="space-y-2">
              <div class="h-4 w-2/3 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
              <div class="h-4 w-1/2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
              <div class="h-4 w-3/5 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
            </div>

            <div v-else-if="latestScores.length === 0" class="py-4 text-sm text-black/60 dark:text-white/60">
              No scores yet.
            </div>

            <div
              v-else
              v-for="s in latestScores"
              :key="s.id"
              class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 hover:bg-white/80 dark:hover:bg-white/10 transition"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="font-semibold text-black dark:text-white truncate">{{ s.game_slug }}</div>
                    <span
                      class="inline-flex items-center rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2.5 py-1 text-xs font-semibold text-black/70 dark:text-white/70"
                    >
                      {{ s.player_name || 'Player' }}
                    </span>
                  </div>
                  <div class="mt-2 text-sm text-black/70 dark:text-white/70">
                    Score: <span class="font-extrabold tabular-nums">{{ n(s.score) }}</span>
                  </div>
                  <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">{{ fmtDT(s.created_at) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Tournaments panel -->
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5 backdrop-blur">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-extrabold tracking-tight text-black dark:text-white">Tournaments</div>
            <div class="text-xs text-black/60 dark:text-white/60">Live now + upcoming</div>
          </div>
          <NuxtLink to="/admin/tournaments" class="text-xs font-semibold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition">
            Open →
          </NuxtLink>
        </div>

        <!-- Live -->
        <div v-if="!loading && liveTournaments.length" class="mt-4">
          <div class="flex items-center justify-between">
            <div class="text-sm font-semibold text-black dark:text-white">Live now</div>
            <span :class="pill('live')">{{ liveTournaments.length }} live</span>
          </div>

          <div class="mt-3 space-y-2">
            <NuxtLink
              v-for="t in liveTournaments"
              :key="t.id"
              :to="`/admin/tournaments`"
              class="block rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-violet-500/10 p-3 hover:from-emerald-500/15 hover:via-cyan-500/15 hover:to-violet-500/15 transition"
            >
              <div class="flex items-start gap-3">
                <div class="h-11 w-14 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
                  <img v-if="t.thumbnail_url" :src="t.thumbnail_url" class="h-full w-full object-cover" />
                  <div v-else class="h-full w-full grid place-items-center text-[10px] opacity-60">LIVE</div>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <div class="font-semibold text-black dark:text-white truncate">{{ t.title }}</div>
                    <span :class="pill('live')">live</span>
                    <span
                      v-if="!t.finalized && new Date(t.ends_at).getTime() < Date.now() + 5 * 60 * 1000"
                      :class="pill('pending')"
                    >
                      finalize soon
                    </span>
                  </div>
                  <div class="mt-1 text-xs text-black/60 dark:text-white/60 truncate">
                    {{ t.game_slug }} • ends {{ relTime(t.ends_at) }}
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1 text-[11px] text-black/70 dark:text-white/70">
                    <span
                      v-for="x in tournamentPills(t)"
                      :key="x"
                      class="rounded-full border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-0.5"
                    >
                      {{ x }}
                    </span>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- Upcoming -->
        <div class="mt-5">
          <div class="flex items-center justify-between">
            <div class="text-sm font-semibold text-black dark:text-white">Upcoming</div>
            <span v-if="!loading" class="text-xs text-black/60 dark:text-white/60">
              {{ upcomingTournaments.length ? `${upcomingTournaments.length} scheduled` : 'none' }}
            </span>
          </div>

          <div class="mt-3 space-y-2">
            <div v-if="loading" class="space-y-2">
              <div class="h-14 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
              <div class="h-14 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
            </div>

            <div
              v-else-if="upcomingTournaments.length === 0"
              class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4 text-sm text-black/60 dark:text-white/60"
            >
              No upcoming tournaments.
            </div>

            <NuxtLink
              v-else
              v-for="t in upcomingTournaments"
              :key="t.id"
              :to="`/admin/tournaments`"
              class="block rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 hover:bg-white/80 dark:hover:bg-white/10 transition"
            >
              <div class="flex items-start gap-3">
                <div class="h-11 w-14 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
                  <img v-if="t.thumbnail_url" :src="t.thumbnail_url" class="h-full w-full object-cover" />
                  <div v-else class="h-full w-full grid place-items-center text-[10px] opacity-60">SOON</div>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <div class="font-semibold text-black dark:text-white truncate">{{ t.title }}</div>
                    <span :class="pill('scheduled')">scheduled</span>
                  </div>
                  <div class="mt-1 text-xs text-black/60 dark:text-white/60 truncate">
                    {{ t.game_slug }} • starts {{ relTime(t.starts_at) }}
                  </div>
                  <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">
                    {{ fmtDate(t.starts_at) }} → {{ fmtDate(t.ends_at) }}
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1 text-[11px] text-black/70 dark:text-white/70">
                    <span
                      v-for="x in tournamentPills(t)"
                      :key="x"
                      class="rounded-full border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-0.5"
                    >
                      {{ x }}
                    </span>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- Finalize reminder -->
        <div v-if="!loading && stats.endedUnfinalized > 0" class="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <div class="flex items-start gap-3">
            <div class="h-10 w-10 rounded-xl grid place-items-center border border-amber-500/25 bg-amber-500/10">
              <UIcon name="i-heroicons-exclamation-triangle" class="h-5 w-5 opacity-80" />
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-black dark:text-white">Finalize needed</div>
              <div class="mt-1 text-sm text-black/70 dark:text-white/70">
                {{ n(stats.endedUnfinalized) }} ended tournament(s) are not finalized.
              </div>
              <NuxtLink to="/admin/tournaments" class="mt-2 inline-flex text-sm font-semibold hover:underline">
                Go finalize →
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>