<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Users' })

const toast = useToast()
const supabase = useSupabaseClient()

type Role = 'user' | 'writer' | 'admin'
type SubStatus = 'active' | 'expired' | 'canceled' | 'none'
type ParticipationFilter = 'all' | 'joined_selected' | 'not_joined_selected'

type ProfileRow = {
  user_id: string
  display_name: string
  avatar_url: string | null
  updated_at: string | null
  role: Role
  phone: string | null
  referral_code: string | null
  referred_by_user_id: string | null
  referral_bonus_bdt: number
  referral_bonus_used_bdt: number
  writer_verified?: boolean | null
  writer_no_approval_needed?: boolean | null
}

type SubscriptionRow = {
  id: string
  user_id: string
  status: 'active' | 'expired' | 'canceled'
  starts_at: string | null
  ends_at: string | null
  amount_bdt: number
  currency: string
  provider: string | null
  provider_ref: string | null
  created_at: string | null
  updated_at: string | null
}

type PaymentRow = {
  id: string
  user_id: string
  plan_code: string
  amount_bdt: number
  currency: string
  provider: string
  tran_id: string
  status: string
  applied: boolean
  created_at: string | null
  paid_at: string | null
  referral_bonus_used_bdt: number
}

type TournamentScoreRow = {
  id: string
  tournament_id: string
  user_id: string
  player_name: string
  score: number
  accepted_score: number | null
  created_at: string | null
  updated_at: string | null
  device_type: string | null
  submitted_at: string | null
  session_id: string | null
}

type LeaderboardScoreRow = {
  id: number
  game_slug: string
  user_id: string
  player_name: string | null
  score: number
  created_at: string | null
}

type ReferralEarnedRow = {
  id: number
  referrer_user_id: string
  referred_user_id: string
  referral_code: string
  bonus_bdt: number
  status: string
  created_at: string | null
}

type TournamentMeta = {
  id: string
  slug: string
  title: string
  status: string
  starts_at: string | null
  ends_at: string | null
  updated_at: string | null
}

type TournamentScopedStats = {
  entries: number
  best_score: number | null
  best_accepted_score: number | null
  latest_at: string | null
  rows: TournamentScoreRow[]
}

type UserRow = {
  user_id: string
  display_name: string
  email: string | null
  avatar_url: string | null
  updated_at: string | null
  role: Role
  phone: string | null

  referral_code: string | null
  referred_by_user_id: string | null
  referral_bonus_bdt: number
  referral_bonus_used_bdt: number
  referrals_count: number
  referral_earned_total_bdt: number

  writer_verified: boolean
  writer_no_approval_needed: boolean

  subscription_status: SubStatus
  subscription_starts_at: string | null
  subscription_ends_at: string | null
  subscriptions_count: number
  subscriptions_total_bdt: number

  payments_count: number
  payments_paid_count: number
  payments_total_bdt: number
  payments_referral_used_bdt: number
  latest_payment_at: string | null

  tournament_entries: number
  tournament_best_score: number | null
  tournament_best_accepted_score: number | null
  tournament_latest_at: string | null

  leaderboard_entries: number
  leaderboard_best_score: number | null
  leaderboard_latest_at: string | null

  subscriptions: SubscriptionRow[]
  payments: PaymentRow[]
  tournament_scores: TournamentScoreRow[]
  leaderboard_scores: LeaderboardScoreRow[]
  referrals_earned: ReferralEarnedRow[]

  tournament_stats_by_id: Record<string, TournamentScopedStats>
}

const loading = ref(true)
const errorMsg = ref<string | null>(null)
const updating = ref(false)

const q = ref('')
const roleFilter = ref<Role | 'all'>('all')
const subFilter = ref<SubStatus | 'all'>('all')
const participationFilter = ref<ParticipationFilter>('all')

const sortBy = ref<
  | 'updated_desc'
  | 'name_asc'
  | 'payments_desc'
  | 'tournament_desc'
  | 'selected_tournament_desc'
  | 'leaderboard_desc'
  | 'referrals_desc'
>('updated_desc')

const limit = ref(100)

const rows = ref<UserRow[]>([])
const tournaments = ref<TournamentMeta[]>([])
const selectedTournamentId = ref<string>('')

const selected = ref<UserRow | null>(null)
const modalOpen = ref(false)

function clampLimit(n: number) {
  if (!Number.isFinite(n)) return 100
  return Math.max(10, Math.min(Math.floor(n), 500))
}

function fmtDate(ts?: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString()
}

function fmtMoney(n?: number | null) {
  return new Intl.NumberFormat().format(Number(n || 0))
}

function fmtScore(n?: number | null) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat().format(Number(n))
}

function rolePillClass(r: Role) {
  if (r === 'admin') return 'bg-rose-500/10 text-rose-700 dark:text-rose-200 border-rose-500/20'
  if (r === 'writer') return 'bg-violet-500/10 text-violet-700 dark:text-violet-200 border-violet-500/20'
  return 'bg-sky-500/10 text-sky-700 dark:text-sky-200 border-sky-500/20'
}

function subPillClass(s: SubStatus) {
  if (s === 'active') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/20'
  if (s === 'expired') return 'bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500/20'
  if (s === 'canceled') return 'bg-rose-500/10 text-rose-700 dark:text-rose-200 border-rose-500/20'
  return 'bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 border-black/10 dark:border-white/10'
}

function tournamentStatusClass(s?: string | null) {
  const v = String(s || '').toLowerCase()
  if (v === 'live') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/20'
  if (v === 'scheduled') return 'bg-sky-500/10 text-sky-700 dark:text-sky-200 border-sky-500/20'
  if (v === 'ended') return 'bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500/20'
  if (v === 'canceled') return 'bg-rose-500/10 text-rose-700 dark:text-rose-200 border-rose-500/20'
  return 'bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 border-black/10 dark:border-white/10'
}

function avatarFallback(name: string) {
  const s = (name || '').trim()
  if (!s) return 'U'
  const parts = s.split(/\s+/g)
  const a = parts[0]?.[0] ?? 'U'
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (a + b).toUpperCase()
}

function deriveSubscriptionStatus(subs: SubscriptionRow[]): {
  status: SubStatus
  starts_at: string | null
  ends_at: string | null
} {
  if (!subs.length) return { status: 'none', starts_at: null, ends_at: null }

  const now = Date.now()
  const ordered = [...subs].sort((a, b) => {
    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
    if (bCreated !== aCreated) return bCreated - aCreated

    const aEnds = a.ends_at ? new Date(a.ends_at).getTime() : 0
    const bEnds = b.ends_at ? new Date(b.ends_at).getTime() : 0
    return bEnds - aEnds
  })

  const activeLive = ordered.find((s) => {
    if (s.status !== 'active') return false
    if (!s.ends_at) return true
    return new Date(s.ends_at).getTime() > now
  })

  if (activeLive) {
    return {
      status: 'active',
      starts_at: activeLive.starts_at,
      ends_at: activeLive.ends_at
    }
  }

  const latest = ordered[0]
  if (!latest) return { status: 'none', starts_at: null, ends_at: null }

  if (latest.status === 'canceled') {
    return {
      status: 'canceled',
      starts_at: latest.starts_at,
      ends_at: latest.ends_at
    }
  }

  return {
    status: 'expired',
    starts_at: latest.starts_at,
    ends_at: latest.ends_at
  }
}

function pickLatestTime(rows: Array<{ updated_at?: string | null; created_at?: string | null; submitted_at?: string | null }>) {
  let best: string | null = null
  let bestTs = 0

  for (const row of rows) {
    const ts = row.updated_at || row.submitted_at || row.created_at || null
    if (!ts) continue
    const n = new Date(ts).getTime()
    if (Number.isNaN(n)) continue
    if (n > bestTs) {
      bestTs = n
      best = ts
    }
  }

  return best
}

function buildTournamentStatsById(scores: TournamentScoreRow[]): Record<string, TournamentScopedStats> {
  const grouped = new Map<string, TournamentScoreRow[]>()

  for (const row of scores) {
    const key = row.tournament_id
    const arr = grouped.get(key) || []
    arr.push(row)
    grouped.set(key, arr)
  }

  const out: Record<string, TournamentScopedStats> = {}

  for (const [tournamentId, list] of grouped.entries()) {
    const bestScore = list.length ? Math.max(...list.map((x) => Number(x.score ?? 0))) : null

    const acceptedValues = list
      .map((x) => (x.accepted_score === null || x.accepted_score === undefined ? null : Number(x.accepted_score)))
      .filter((x): x is number => x !== null)

    const bestAcceptedScore = acceptedValues.length ? Math.max(...acceptedValues) : null

    const ordered = [...list].sort((a, b) => {
      const at = a.updated_at ? new Date(a.updated_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0)
      const bt = b.updated_at ? new Date(b.updated_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0)
      return bt - at
    })

    out[tournamentId] = {
      entries: list.length,
      best_score: bestScore,
      best_accepted_score: bestAcceptedScore,
      latest_at: pickLatestTime(list),
      rows: ordered
    }
  }

  return out
}

function getScopedStats(user: UserRow, tournamentId: string) {
  if (!tournamentId) return null
  return user.tournament_stats_by_id[tournamentId] || null
}

const selectedTournament = computed(() => {
  return tournaments.value.find((t) => t.id === selectedTournamentId.value) || null
})

const tournamentSummary = computed(() => {
  if (!selectedTournamentId.value) {
    return {
      usersJoined: 0,
      totalEntries: 0,
      highestScore: null as number | null,
      highestAcceptedScore: null as number | null
    }
  }

  let usersJoined = 0
  let totalEntries = 0
  let highestScore: number | null = null
  let highestAcceptedScore: number | null = null

  for (const user of rows.value) {
    const stats = getScopedStats(user, selectedTournamentId.value)
    if (!stats) continue

    usersJoined += 1
    totalEntries += stats.entries

    if (stats.best_score !== null) {
      highestScore = highestScore === null ? stats.best_score : Math.max(highestScore, stats.best_score)
    }

    if (stats.best_accepted_score !== null) {
      highestAcceptedScore = highestAcceptedScore === null
        ? stats.best_accepted_score
        : Math.max(highestAcceptedScore, stats.best_accepted_score)
    }
  }

  return { usersJoined, totalEntries, highestScore, highestAcceptedScore }
})

const summary = computed(() => {
  const total = rows.value.length
  const admins = rows.value.filter((r) => r.role === 'admin').length
  const writers = rows.value.filter((r) => r.role === 'writer').length
  const activeSubs = rows.value.filter((r) => r.subscription_status === 'active').length
  const totalPayments = rows.value.reduce((sum, r) => sum + r.payments_total_bdt, 0)
  return { total, admins, writers, activeSubs, totalPayments }
})

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  let list = [...rows.value]

  if (roleFilter.value !== 'all') {
    list = list.filter((r) => r.role === roleFilter.value)
  }

  if (subFilter.value !== 'all') {
    list = list.filter((r) => r.subscription_status === subFilter.value)
  }

  if (selectedTournamentId.value) {
    if (participationFilter.value === 'joined_selected') {
      list = list.filter((r) => !!getScopedStats(r, selectedTournamentId.value))
    } else if (participationFilter.value === 'not_joined_selected') {
      list = list.filter((r) => !getScopedStats(r, selectedTournamentId.value))
    }
  }

  if (needle) {
    list = list.filter((r) => {
      const scoped = selectedTournamentId.value ? getScopedStats(r, selectedTournamentId.value) : null

      const searchable = [
        r.display_name,
        r.email || '',
        r.user_id,
        r.phone || '',
        r.role,
        r.referral_code || '',
        r.subscription_status,
        String(r.tournament_best_score ?? ''),
        String(r.tournament_best_accepted_score ?? ''),
        String(r.leaderboard_best_score ?? ''),
        String(scoped?.best_score ?? ''),
        String(scoped?.best_accepted_score ?? ''),
        String(scoped?.entries ?? '')
      ]
        .join(' ')
        .toLowerCase()

      return searchable.includes(needle)
    })
  }

  switch (sortBy.value) {
    case 'name_asc':
      list.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''))
      break

    case 'payments_desc':
      list.sort((a, b) => {
        if (b.payments_total_bdt !== a.payments_total_bdt) return b.payments_total_bdt - a.payments_total_bdt
        const at = a.updated_at ? new Date(a.updated_at).getTime() : 0
        const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0
        return bt - at
      })
      break

    case 'selected_tournament_desc':
      list.sort((a, b) => {
        const aStats = selectedTournamentId.value ? getScopedStats(a, selectedTournamentId.value) : null
        const bStats = selectedTournamentId.value ? getScopedStats(b, selectedTournamentId.value) : null

        const aBest = aStats?.best_score ?? -1
        const bBest = bStats?.best_score ?? -1
        if (bBest !== aBest) return bBest - aBest

        const aAccepted = aStats?.best_accepted_score ?? -1
        const bAccepted = bStats?.best_accepted_score ?? -1
        if (bAccepted !== aAccepted) return bAccepted - aAccepted

        const aLatest = aStats?.latest_at ? new Date(aStats.latest_at).getTime() : 0
        const bLatest = bStats?.latest_at ? new Date(bStats.latest_at).getTime() : 0
        if (bLatest !== aLatest) return bLatest - aLatest

        return a.display_name.localeCompare(b.display_name)
      })
      break

    case 'tournament_desc':
      list.sort((a, b) => {
        const as = a.tournament_best_score ?? -1
        const bs = b.tournament_best_score ?? -1
        if (bs !== as) return bs - as

        const aa = a.tournament_best_accepted_score ?? -1
        const ba = b.tournament_best_accepted_score ?? -1
        if (ba !== aa) return ba - aa

        const aLatest = a.tournament_latest_at ? new Date(a.tournament_latest_at).getTime() : 0
        const bLatest = b.tournament_latest_at ? new Date(b.tournament_latest_at).getTime() : 0
        if (bLatest !== aLatest) return bLatest - aLatest

        return a.display_name.localeCompare(b.display_name)
      })
      break

    case 'leaderboard_desc':
      list.sort((a, b) => {
        const as = a.leaderboard_best_score ?? -1
        const bs = b.leaderboard_best_score ?? -1
        if (bs !== as) return bs - as

        const aLatest = a.leaderboard_latest_at ? new Date(a.leaderboard_latest_at).getTime() : 0
        const bLatest = b.leaderboard_latest_at ? new Date(b.leaderboard_latest_at).getTime() : 0
        if (bLatest !== aLatest) return bLatest - aLatest

        return a.display_name.localeCompare(b.display_name)
      })
      break

    case 'referrals_desc':
      list.sort((a, b) => {
        if (b.referrals_count !== a.referrals_count) return b.referrals_count - a.referrals_count
        return b.referral_earned_total_bdt - a.referral_earned_total_bdt
      })
      break

    case 'updated_desc':
    default:
      list.sort((a, b) => {
        const at = a.updated_at ? new Date(a.updated_at).getTime() : 0
        const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0
        return bt - at
      })
      break
  }

  return list
})

const displayedRows = computed(() => filtered.value.slice(0, clampLimit(limit.value)))

async function load(): Promise<void> {
  loading.value = true
  errorMsg.value = null
  rows.value = []

  try {
    const fetchCap = 5000

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        display_name,
        avatar_url,
        updated_at,
        role,
        phone,
        referral_code,
        referred_by_user_id,
        referral_bonus_bdt,
        referral_bonus_used_bdt,
        writer_verified,
        writer_no_approval_needed
      `)
      .order('updated_at', { ascending: false })
      .range(0, fetchCap - 1)

    if (profilesError) throw profilesError

    const profileRows = ((profiles || []) as ProfileRow[]).map((p) => ({
      ...p,
      role: (p.role || 'user') as Role
    }))

    const [
      tournamentsRes,
      subscriptionsRes,
      paymentsRes,
      tournamentRes,
      leaderboardRes,
      referralsRes
    ] = await Promise.all([
      supabase
        .from('tournaments')
        .select(`
          id,
          slug,
          title,
          status,
          starts_at,
          ends_at,
          updated_at
        `)
        .order('starts_at', { ascending: false }),

      profileRows.length
        ? supabase
            .from('subscriptions')
            .select(`
              id,
              user_id,
              status,
              starts_at,
              ends_at,
              amount_bdt,
              currency,
              provider,
              provider_ref,
              created_at,
              updated_at
            `)
            .in('user_id', profileRows.map((p) => p.user_id))
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),

      profileRows.length
        ? supabase
            .from('payments')
            .select(`
              id,
              user_id,
              plan_code,
              amount_bdt,
              currency,
              provider,
              tran_id,
              status,
              applied,
              created_at,
              paid_at,
              referral_bonus_used_bdt
            `)
            .in('user_id', profileRows.map((p) => p.user_id))
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),

      profileRows.length
        ? supabase
            .from('tournament_scores')
            .select(`
              id,
              tournament_id,
              user_id,
              player_name,
              score,
              accepted_score,
              created_at,
              updated_at,
              device_type,
              submitted_at,
              session_id
            `)
            .in('user_id', profileRows.map((p) => p.user_id))
            .order('updated_at', { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),

      profileRows.length
        ? supabase
            .from('leaderboard_scores')
            .select(`
              id,
              game_slug,
              user_id,
              player_name,
              score,
              created_at
            `)
            .in('user_id', profileRows.map((p) => p.user_id))
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),

      profileRows.length
        ? supabase
            .from('user_referrals')
            .select(`
              id,
              referrer_user_id,
              referred_user_id,
              referral_code,
              bonus_bdt,
              status,
              created_at
            `)
            .in('referrer_user_id', profileRows.map((p) => p.user_id))
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null } as any)
    ])

    if (tournamentsRes.error) throw tournamentsRes.error
    if (subscriptionsRes.error) throw subscriptionsRes.error
    if (paymentsRes.error) throw paymentsRes.error
    if (tournamentRes.error) throw tournamentRes.error
    if (leaderboardRes.error) throw leaderboardRes.error
    if (referralsRes.error) throw referralsRes.error

    tournaments.value = ((tournamentsRes.data || []) as TournamentMeta[]).map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      status: t.status,
      starts_at: t.starts_at,
      ends_at: t.ends_at,
      updated_at: t.updated_at
    }))

    if (selectedTournamentId.value && !tournaments.value.find((t) => t.id === selectedTournamentId.value)) {
      selectedTournamentId.value = ''
    }

    if (!profileRows.length) {
      rows.value = []
      return
    }

    const subscriptions = (subscriptionsRes.data || []) as SubscriptionRow[]
    const payments = (paymentsRes.data || []) as PaymentRow[]
    const tournamentScores = (tournamentRes.data || []) as TournamentScoreRow[]
    const leaderboardScores = (leaderboardRes.data || []) as LeaderboardScoreRow[]
    const referrals = (referralsRes.data || []) as ReferralEarnedRow[]

    const subsMap = new Map<string, SubscriptionRow[]>()
    const payMap = new Map<string, PaymentRow[]>()
    const tournamentMap = new Map<string, TournamentScoreRow[]>()
    const leaderboardMap = new Map<string, LeaderboardScoreRow[]>()
    const referralsMap = new Map<string, ReferralEarnedRow[]>()

    for (const s of subscriptions) {
      const arr = subsMap.get(s.user_id) || []
      arr.push(s)
      subsMap.set(s.user_id, arr)
    }

    for (const p of payments) {
      const arr = payMap.get(p.user_id) || []
      arr.push(p)
      payMap.set(p.user_id, arr)
    }

    for (const t of tournamentScores) {
      const arr = tournamentMap.get(t.user_id) || []
      arr.push(t)
      tournamentMap.set(t.user_id, arr)
    }

    for (const l of leaderboardScores) {
      const arr = leaderboardMap.get(l.user_id) || []
      arr.push(l)
      leaderboardMap.set(l.user_id, arr)
    }

    for (const r of referrals) {
      const arr = referralsMap.get(r.referrer_user_id) || []
      arr.push(r)
      referralsMap.set(r.referrer_user_id, arr)
    }

    rows.value = profileRows.map((p) => {
      const userSubs = subsMap.get(p.user_id) || []
      const userPayments = payMap.get(p.user_id) || []
      const userTournament = tournamentMap.get(p.user_id) || []
      const userLeaderboard = leaderboardMap.get(p.user_id) || []
      const userReferrals = referralsMap.get(p.user_id) || []

      const subInfo = deriveSubscriptionStatus(userSubs)

      const paymentsPaid = userPayments.filter((x) => {
        const s = String(x.status || '').toLowerCase()
        return s === 'paid' || s === 'success'
      })
      const paymentsTotal = userPayments.reduce((sum, x) => sum + Number(x.amount_bdt || 0), 0)
      const paymentsReferralUsed = userPayments.reduce((sum, x) => sum + Number(x.referral_bonus_used_bdt || 0), 0)
      const subscriptionsTotal = userSubs.reduce((sum, x) => sum + Number(x.amount_bdt || 0), 0)

      const tournamentBest = userTournament.length
        ? Math.max(...userTournament.map((x) => Number(x.score ?? 0)))
        : null

      const tournamentAcceptedValues = userTournament
        .map((x) => (x.accepted_score === null || x.accepted_score === undefined ? null : Number(x.accepted_score)))
        .filter((x): x is number => x !== null)

      const tournamentBestAccepted = tournamentAcceptedValues.length
        ? Math.max(...tournamentAcceptedValues)
        : null

      const leaderboardBest = userLeaderboard.length
        ? Math.max(...userLeaderboard.map((x) => Number(x.score || 0)))
        : null

      const latestPaymentAt = userPayments[0]?.paid_at || userPayments[0]?.created_at || null
      const tournamentLatestAt = pickLatestTime(userTournament)
      const leaderboardLatestAt = userLeaderboard[0]?.created_at || null

      return {
        user_id: p.user_id,
        display_name: p.display_name,
        email: null,
        avatar_url: p.avatar_url,
        updated_at: p.updated_at,
        role: p.role,
        phone: p.phone,

        referral_code: p.referral_code,
        referred_by_user_id: p.referred_by_user_id,
        referral_bonus_bdt: Number(p.referral_bonus_bdt || 0),
        referral_bonus_used_bdt: Number(p.referral_bonus_used_bdt || 0),
        referrals_count: userReferrals.length,
        referral_earned_total_bdt: userReferrals.reduce((sum, x) => sum + Number(x.bonus_bdt || 0), 0),

        writer_verified: Boolean(p.writer_verified),
        writer_no_approval_needed: Boolean(p.writer_no_approval_needed),

        subscription_status: subInfo.status,
        subscription_starts_at: subInfo.starts_at,
        subscription_ends_at: subInfo.ends_at,
        subscriptions_count: userSubs.length,
        subscriptions_total_bdt: subscriptionsTotal,

        payments_count: userPayments.length,
        payments_paid_count: paymentsPaid.length,
        payments_total_bdt: paymentsTotal,
        payments_referral_used_bdt: paymentsReferralUsed,
        latest_payment_at: latestPaymentAt,

        tournament_entries: userTournament.length,
        tournament_best_score: tournamentBest,
        tournament_best_accepted_score: tournamentBestAccepted,
        tournament_latest_at: tournamentLatestAt,

        leaderboard_entries: userLeaderboard.length,
        leaderboard_best_score: leaderboardBest,
        leaderboard_latest_at: leaderboardLatestAt,

        subscriptions: userSubs,
        payments: userPayments,
        tournament_scores: userTournament,
        leaderboard_scores: userLeaderboard,
        referrals_earned: userReferrals,

        tournament_stats_by_id: buildTournamentStatsById(userTournament)
      }
    })
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load users.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function resetTournamentLens() {
  selectedTournamentId.value = ''
  participationFilter.value = 'all'
  if (sortBy.value === 'selected_tournament_desc') {
    sortBy.value = 'updated_desc'
  }
}

function openRow(r: UserRow) {
  selected.value = r
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  selected.value = null
}

function copy(v: string) {
  if (!import.meta.client) return
  navigator.clipboard.writeText(v).then(
    () => toast.add({ title: 'Copied', description: v, color: 'success' }),
    () => toast.add({ title: 'Copy failed', description: 'Your browser blocked it.', color: 'warning' })
  )
}

async function setRole(next: Role): Promise<void> {
  if (!selected.value) return
  if (updating.value) return
  if (selected.value.role === next) return

  updating.value = true
  try {
    const id = selected.value.user_id

    const { error } = await supabase
      .from('profiles')
      .update({ role: next })
      .eq('user_id', id)

    if (error) throw error

    const nowIso = new Date().toISOString()

    rows.value = rows.value.map((r) =>
      r.user_id === id ? { ...r, role: next, updated_at: nowIso } : r
    )

    selected.value = {
      ...selected.value,
      role: next,
      updated_at: nowIso
    }

    toast.add({
      title: 'Role updated',
      description: `User is now "${next}".`,
      color: next === 'admin' ? 'warning' : 'info'
    })
  } catch (e: any) {
    toast.add({
      title: 'Update failed',
      description: e?.message || 'Try again.',
      color: 'error'
    })
  } finally {
    updating.value = false
  }
}

async function setWriterFlags(key: 'writer_verified' | 'writer_no_approval_needed', nextValue: boolean) {
  if (!selected.value) return
  if (updating.value) return

  updating.value = true
  try {
    const id = selected.value.user_id

    const { error } = await supabase
      .from('profiles')
      .update({ [key]: nextValue })
      .eq('user_id', id)

    if (error) throw error

    rows.value = rows.value.map((r) =>
      r.user_id === id ? { ...r, [key]: nextValue } : r
    )

    selected.value = {
      ...selected.value,
      [key]: nextValue
    }

    toast.add({
      title: 'Writer setting updated',
      description: `${key} set to ${nextValue ? 'true' : 'false'}.`,
      color: 'success'
    })
  } catch (e: any) {
    toast.add({
      title: 'Update failed',
      description: e?.message || 'Try again.',
      color: 'error'
    })
  } finally {
    updating.value = false
  }
}

const selectedScopedStats = computed(() => {
  if (!selected.value || !selectedTournamentId.value) return null
  return getScopedStats(selected.value, selectedTournamentId.value)
})

const selectedRecentPayments = computed(() => selected.value?.payments.slice(0, 12) || [])
const selectedRecentTournament = computed(() => {
  if (!selected.value) return []
  if (selectedTournamentId.value) {
    return getScopedStats(selected.value, selectedTournamentId.value)?.rows.slice(0, 20) || []
  }
  return selected.value.tournament_scores.slice(0, 20)
})
const selectedRecentLeaderboard = computed(() => selected.value?.leaderboard_scores.slice(0, 12) || [])
const selectedRecentReferrals = computed(() => selected.value?.referrals_earned.slice(0, 12) || [])
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-5 lg:p-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="text-sm text-black/60 dark:text-white/60">Users</div>
          <h1 class="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-black dark:text-white">
            User Management
          </h1>
          <p class="mt-2 text-sm text-black/60 dark:text-white/60 max-w-4xl">
            Manage role, subscriptions, payments, referrals, and tournament participation from one place.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
            @click="load"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5" />
            Refresh
          </button>

          <div class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5">
            <span class="text-xs text-black/60 dark:text-white/60">Show</span>
            <input
              v-model.number="limit"
              type="number"
              min="10"
              max="500"
              class="w-24 bg-transparent text-sm text-black dark:text-white outline-none"
            />
          </div>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
          <div class="text-xs text-black/60 dark:text-white/60">Total users</div>
          <div class="mt-1 text-xl font-bold text-black dark:text-white">{{ summary.total }}</div>
        </div>

        <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
          <div class="text-xs text-black/60 dark:text-white/60">Admins</div>
          <div class="mt-1 text-xl font-bold text-black dark:text-white">{{ summary.admins }}</div>
        </div>

        <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
          <div class="text-xs text-black/60 dark:text-white/60">Writers</div>
          <div class="mt-1 text-xl font-bold text-black dark:text-white">{{ summary.writers }}</div>
        </div>

        <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
          <div class="text-xs text-black/60 dark:text-white/60">Active subscriptions</div>
          <div class="mt-1 text-xl font-bold text-black dark:text-white">{{ summary.activeSubs }}</div>
        </div>

        <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
          <div class="text-xs text-black/60 dark:text-white/60">Total payments</div>
          <div class="mt-1 text-xl font-bold text-black dark:text-white">৳{{ fmtMoney(summary.totalPayments) }}</div>
        </div>
      </div>

      <div class="mt-5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-black dark:text-white">Tournament focus</div>
            <div class="mt-1 text-xs text-black/60 dark:text-white/60">
              Select a tournament to view joined users, top scores, and selected-tournament ranking.
            </div>
          </div>

          <button
            v-if="selectedTournamentId"
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
            @click="resetTournamentLens"
          >
            <UIcon name="i-heroicons-x-mark" class="h-4 w-4" />
            Clear focus
          </button>
        </div>

        <div class="mt-3 grid grid-cols-1 xl:grid-cols-[1.3fr_auto_auto_auto] gap-3">
          <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5">
            <div class="mb-1 text-[11px] text-black/50 dark:text-white/50">Tournament</div>
            <select
              v-model="selectedTournamentId"
              class="w-full bg-transparent text-sm text-black dark:text-white outline-none"
            >
              <option value="">All tournaments</option>
              <option
                v-for="t in tournaments"
                :key="t.id"
                :value="t.id"
              >
                {{ t.title }} ({{ t.slug }})
              </option>
            </select>
          </div>

          <div class="inline-flex flex-wrap items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-1.5">
            <button
              type="button"
              class="px-3 py-2 rounded-lg text-sm transition"
              :class="participationFilter === 'all'
                ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
                : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
              @click="participationFilter = 'all'"
            >
              All
            </button>

            <button
              type="button"
              class="px-3 py-2 rounded-lg text-sm transition"
              :disabled="!selectedTournamentId"
              :class="participationFilter === 'joined_selected'
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white disabled:opacity-40'"
              @click="participationFilter = 'joined_selected'"
            >
              Joined
            </button>

            <button
              type="button"
              class="px-3 py-2 rounded-lg text-sm transition"
              :disabled="!selectedTournamentId"
              :class="participationFilter === 'not_joined_selected'
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white disabled:opacity-40'"
              @click="participationFilter = 'not_joined_selected'"
            >
              Not joined
            </button>
          </div>

          <div
            v-if="selectedTournament"
            class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5"
          >
            <div class="mb-1 text-[11px] text-black/50 dark:text-white/50">Status</div>
            <span
              class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
              :class="tournamentStatusClass(selectedTournament.status)"
            >
              {{ selectedTournament.status }}
            </span>
          </div>

          <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5">
            <div class="mb-1 text-[11px] text-black/50 dark:text-white/50">Sort</div>
            <select
              v-model="sortBy"
              class="w-full bg-transparent text-sm text-black dark:text-white outline-none"
            >
              <option value="updated_desc">Recently updated</option>
              <option value="name_asc">Name A-Z</option>
              <option value="payments_desc">Highest payments</option>
              <option value="tournament_desc">Highest overall tournament score</option>
              <option :disabled="!selectedTournamentId" value="selected_tournament_desc">Highest selected tournament score</option>
              <option value="leaderboard_desc">Highest leaderboard score</option>
              <option value="referrals_desc">Most referrals</option>
            </select>
          </div>
        </div>

        <div
          v-if="selectedTournament"
          class="mt-3 grid grid-cols-2 xl:grid-cols-4 gap-3"
        >
          <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
            <div class="text-xs text-black/60 dark:text-white/60">Users joined</div>
            <div class="mt-1 text-xl font-bold text-black dark:text-white">{{ tournamentSummary.usersJoined }}</div>
          </div>

          <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
            <div class="text-xs text-black/60 dark:text-white/60">Total entries</div>
            <div class="mt-1 text-xl font-bold text-black dark:text-white">{{ tournamentSummary.totalEntries }}</div>
          </div>

          <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
            <div class="text-xs text-black/60 dark:text-white/60">Highest score</div>
            <div class="mt-1 text-xl font-bold text-black dark:text-white">{{ fmtScore(tournamentSummary.highestScore) }}</div>
          </div>

          <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
            <div class="text-xs text-black/60 dark:text-white/60">Highest accepted</div>
            <div class="mt-1 text-xl font-bold text-black dark:text-white">{{ fmtScore(tournamentSummary.highestAcceptedScore) }}</div>
          </div>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 xl:grid-cols-[1fr_auto_auto] gap-3">
        <div class="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5">
          <UIcon name="i-heroicons-magnifying-glass" class="h-5 w-5 opacity-60" />
          <input
            v-model="q"
            type="text"
            placeholder="Search name, user id, phone, referral code, score…"
            class="w-full bg-transparent text-sm outline-none text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
          />
          <button
            v-if="q.trim()"
            type="button"
            class="rounded-lg px-2 py-1 text-xs border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
            @click="q = ''"
          >
            Clear
          </button>
        </div>

        <div class="inline-flex flex-wrap items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-1.5">
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm transition"
            :class="roleFilter === 'all'
              ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
            @click="roleFilter = 'all'"
          >
            All roles
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm transition"
            :class="roleFilter === 'user'
              ? 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
            @click="roleFilter = 'user'"
          >
            Users
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm transition"
            :class="roleFilter === 'writer'
              ? 'bg-violet-500/15 text-violet-800 dark:text-violet-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
            @click="roleFilter = 'writer'"
          >
            Writers
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm transition"
            :class="roleFilter === 'admin'
              ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
            @click="roleFilter = 'admin'"
          >
            Admins
          </button>
        </div>

        <div class="inline-flex flex-wrap items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-1.5">
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm transition"
            :class="subFilter === 'all'
              ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
            @click="subFilter = 'all'"
          >
            All subs
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm transition"
            :class="subFilter === 'active'
              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
            @click="subFilter = 'active'"
          >
            Active
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm transition"
            :class="subFilter === 'expired'
              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
            @click="subFilter = 'expired'"
          >
            Expired
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm transition"
            :class="subFilter === 'canceled'
              ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
            @click="subFilter = 'canceled'"
          >
            Canceled
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm transition"
            :class="subFilter === 'none'
              ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
              : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'"
            @click="subFilter = 'none'"
          >
            None
          </button>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-black/60 dark:text-white/60">
        <span class="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5">
          Showing
          <span class="font-semibold text-black dark:text-white">{{ displayedRows.length }}</span>
          of
          <span class="font-semibold text-black dark:text-white">{{ filtered.length }}</span>
        </span>

        <span
          v-if="selectedTournament"
          class="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-cyan-800 dark:text-cyan-200"
        >
          Focused on: {{ selectedTournament.title }}
        </span>

        <span
          v-if="loading"
          class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5"
        >
          <span class="h-2 w-2 rounded-full animate-pulse bg-cyan-400" />
          Loading…
        </span>
      </div>

      <div class="mt-2 text-[11px] text-black/45 dark:text-white/45">
        Email is not shown here because this page is loading directly from app tables. For auth email, expose it through a secure admin server API.
      </div>
    </div>

    <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
      <div v-if="errorMsg" class="p-4">
        <div class="text-sm text-black dark:text-white">❌ {{ errorMsg }}</div>
        <div class="mt-3">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
            @click="load"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5" />
            Retry
          </button>
        </div>
      </div>

      <div v-else class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="text-black/60 dark:text-white/60">
            <tr class="text-left border-b border-black/10 dark:border-white/10">
              <th class="py-3 px-4">User</th>
              <th class="py-3 px-4 hidden lg:table-cell">Phone</th>
              <th class="py-3 px-4">Role</th>
              <th class="py-3 px-4 hidden xl:table-cell">Subscription</th>
              <th class="py-3 px-4 hidden xl:table-cell">Payments</th>
              <th class="py-3 px-4">Tournament focus</th>
              <th class="py-3 px-4 hidden 2xl:table-cell">Overall tournament</th>
              <th class="py-3 px-4 hidden 2xl:table-cell">Leaderboard</th>
              <th class="py-3 px-4 text-right">Manage</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="r in displayedRows"
              :key="r.user_id"
              class="border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <td class="py-3 px-4 min-w-[260px]">
                <div class="flex items-center gap-3">
                  <div class="h-10 w-10 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 grid place-items-center overflow-hidden">
                    <img
                      v-if="r.avatar_url"
                      :src="r.avatar_url"
                      alt=""
                      class="h-full w-full object-cover"
                    />
                    <span v-else class="text-xs font-bold text-black/70 dark:text-white/70">
                      {{ avatarFallback(r.display_name) }}
                    </span>
                  </div>

                  <div class="min-w-0">
                    <div class="font-semibold text-black dark:text-white truncate">
                      {{ r.display_name }}
                    </div>
                    <div class="text-xs text-black/60 dark:text-white/60 break-all">
                      {{ r.user_id }}
                    </div>
                    <div class="text-[11px] text-black/50 dark:text-white/50 truncate">
                      Updated: {{ fmtDate(r.updated_at) }}
                    </div>
                  </div>
                </div>
              </td>

              <td class="py-3 px-4 hidden lg:table-cell text-black/70 dark:text-white/70">
                {{ r.phone || '—' }}
              </td>

              <td class="py-3 px-4">
                <div class="flex flex-col gap-1">
                  <span
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold w-fit"
                    :class="rolePillClass(r.role)"
                  >
                    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                    {{ r.role }}
                  </span>

                  <span
                    v-if="r.role === 'writer' && r.writer_verified"
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold w-fit bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/20"
                  >
                    Verified
                  </span>
                </div>
              </td>

              <td class="py-3 px-4 hidden xl:table-cell">
                <div class="flex flex-col gap-1">
                  <span
                    class="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                    :class="subPillClass(r.subscription_status)"
                  >
                    {{ r.subscription_status }}
                  </span>
                  <span class="text-[11px] text-black/50 dark:text-white/50">
                    Ends: {{ fmtDate(r.subscription_ends_at) }}
                  </span>
                </div>
              </td>

              <td class="py-3 px-4 hidden xl:table-cell text-black/70 dark:text-white/70">
                <div class="font-semibold">৳{{ fmtMoney(r.payments_total_bdt) }}</div>
                <div class="text-[11px] text-black/50 dark:text-white/50">
                  {{ r.payments_paid_count }}/{{ r.payments_count }} paid
                </div>
              </td>

              <td class="py-3 px-4 min-w-[250px] text-black/70 dark:text-white/70">
                <template v-if="selectedTournamentId">
                  <div v-if="getScopedStats(r, selectedTournamentId)">
                    <div class="font-semibold">
                      Best: {{ fmtScore(getScopedStats(r, selectedTournamentId)?.best_score) }}
                    </div>
                    <div class="text-[11px] text-black/50 dark:text-white/50">
                      Accepted: {{ fmtScore(getScopedStats(r, selectedTournamentId)?.best_accepted_score) }}
                    </div>
                    <div class="text-[11px] text-black/50 dark:text-white/50">
                      Entries: {{ getScopedStats(r, selectedTournamentId)?.entries || 0 }}
                    </div>
                    <div class="text-[11px] text-black/50 dark:text-white/50">
                      Latest: {{ fmtDate(getScopedStats(r, selectedTournamentId)?.latest_at) }}
                    </div>
                  </div>
                  <div v-else class="text-sm text-black/45 dark:text-white/45">
                    Not joined
                  </div>
                </template>

                <template v-else>
                  <div class="font-semibold">{{ fmtScore(r.tournament_best_score) }}</div>
                  <div class="text-[11px] text-black/50 dark:text-white/50">
                    Accepted: {{ fmtScore(r.tournament_best_accepted_score) }}
                  </div>
                  <div class="text-[11px] text-black/50 dark:text-white/50">
                    {{ r.tournament_entries }} entries
                  </div>
                </template>
              </td>

              <td class="py-3 px-4 hidden 2xl:table-cell text-black/70 dark:text-white/70">
                <div class="font-semibold">{{ fmtScore(r.tournament_best_score) }}</div>
                <div class="text-[11px] text-black/50 dark:text-white/50">
                  Accepted: {{ fmtScore(r.tournament_best_accepted_score) }}
                </div>
                <div class="text-[11px] text-black/50 dark:text-white/50">
                  Latest: {{ fmtDate(r.tournament_latest_at) }}
                </div>
              </td>

              <td class="py-3 px-4 hidden 2xl:table-cell text-black/70 dark:text-white/70">
                <div class="font-semibold">{{ fmtScore(r.leaderboard_best_score) }}</div>
                <div class="text-[11px] text-black/50 dark:text-white/50">
                  {{ r.leaderboard_entries }} entries
                </div>
              </td>

              <td class="py-3 px-4 text-right">
                <div class="inline-flex gap-2 justify-end">
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
                    @click="copy(r.user_id)"
                  >
                    <UIcon name="i-heroicons-clipboard" class="h-4 w-4" />
                    Copy ID
                  </button>

                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
                    @click="openRow(r)"
                  >
                    <UIcon name="i-heroicons-eye" class="h-4 w-4" />
                    View
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="!loading && displayedRows.length === 0">
              <td colspan="9" class="py-10 text-center text-black/60 dark:text-white/60">
                No users found.
              </td>
            </tr>

            <tr v-if="loading">
              <td colspan="9" class="py-8">
                <div class="px-4 grid gap-2">
                  <div class="h-10 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
                  <div class="h-10 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
                  <div class="h-10 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="modalOpen && selected"
      class="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal" />

      <div
        class="relative w-full sm:max-w-6xl rounded-t-3xl sm:rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0b1020] shadow-[0_30px_100px_rgba(0,0,0,.35)] overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div class="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <div class="text-lg font-bold tracking-tight text-black dark:text-white truncate">
                  {{ selected.display_name }}
                </div>

                <span
                  class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                  :class="rolePillClass(selected.role)"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {{ selected.role }}
                </span>

                <span
                  class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                  :class="subPillClass(selected.subscription_status)"
                >
                  {{ selected.subscription_status }}
                </span>

                <span
                  v-if="selectedTournament"
                  class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                  :class="tournamentStatusClass(selectedTournament.status)"
                >
                  {{ selectedTournament.title }}
                </span>
              </div>

              <div class="mt-1 text-xs text-black/60 dark:text-white/60 font-mono break-all">
                {{ selected.user_id }}
              </div>
            </div>

            <button
              type="button"
              class="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10 transition"
              @click="closeModal"
            >
              <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-4 sm:p-5 grid gap-4">
          <div class="grid grid-cols-1 xl:grid-cols-[1.4fr_.8fr] gap-4">
            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="flex items-start gap-4">
                <div class="h-16 w-16 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 grid place-items-center overflow-hidden shrink-0">
                  <img v-if="selected.avatar_url" :src="selected.avatar_url" class="h-full w-full object-cover" alt="" />
                  <span v-else class="text-sm font-bold text-black/70 dark:text-white/70">
                    {{ avatarFallback(selected.display_name) }}
                  </span>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    <div>
                      <div class="text-xs text-black/60 dark:text-white/60">Display name</div>
                      <div class="mt-1 text-sm font-semibold text-black dark:text-white break-words">
                        {{ selected.display_name }}
                      </div>
                    </div>

                    <div>
                      <div class="text-xs text-black/60 dark:text-white/60">Phone</div>
                      <div class="mt-1 text-sm font-semibold text-black dark:text-white">
                        {{ selected.phone || '—' }}
                      </div>
                    </div>

                    <div>
                      <div class="text-xs text-black/60 dark:text-white/60">Updated</div>
                      <div class="mt-1 text-sm font-semibold text-black dark:text-white">
                        {{ fmtDate(selected.updated_at) }}
                      </div>
                    </div>

                    <div>
                      <div class="text-xs text-black/60 dark:text-white/60">Referral code</div>
                      <div class="mt-1 text-sm font-semibold text-black dark:text-white break-all">
                        {{ selected.referral_code || '—' }}
                      </div>
                    </div>

                    <div>
                      <div class="text-xs text-black/60 dark:text-white/60">Referred by</div>
                      <div class="mt-1 text-sm font-semibold text-black dark:text-white break-all">
                        {{ selected.referred_by_user_id || '—' }}
                      </div>
                    </div>

                    <div>
                      <div class="text-xs text-black/60 dark:text-white/60">Avatar</div>
                      <div class="mt-1 text-sm font-semibold text-black dark:text-white">
                        {{ selected.avatar_url ? 'Has avatar' : 'No avatar' }}
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
                      @click="copy(selected.user_id)"
                    >
                      <UIcon name="i-heroicons-clipboard" class="h-4 w-4" />
                      Copy user id
                    </button>

                    <button
                      v-if="selected.phone"
                      type="button"
                      class="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
                      @click="copy(selected.phone)"
                    >
                      <UIcon name="i-heroicons-phone" class="h-4 w-4" />
                      Copy phone
                    </button>

                    <button
                      v-if="selected.referral_code"
                      type="button"
                      class="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
                      @click="copy(selected.referral_code)"
                    >
                      <UIcon name="i-heroicons-ticket" class="h-4 w-4" />
                      Copy referral code
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Role actions</div>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-800 dark:text-sky-200 hover:bg-sky-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.role === 'user'"
                  @click="setRole('user')"
                >
                  <UIcon name="i-heroicons-user" class="h-5 w-5" />
                  Set user
                </button>

                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-800 dark:text-violet-200 hover:bg-violet-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.role === 'writer'"
                  @click="setRole('writer')"
                >
                  <UIcon name="i-heroicons-pencil-square" class="h-5 w-5" />
                  Set writer
                </button>

                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:text-rose-200 hover:bg-rose-500/15 transition disabled:opacity-60"
                  :disabled="updating || selected.role === 'admin'"
                  @click="setRole('admin')"
                >
                  <UIcon name="i-heroicons-shield-check" class="h-5 w-5" />
                  Set admin
                </button>
              </div>

              <div v-if="selected.role === 'writer' || selected.writer_verified || selected.writer_no_approval_needed" class="mt-4">
                <div class="mb-2 text-xs text-black/60 dark:text-white/60">Writer controls</div>

                <div class="grid gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition disabled:opacity-60"
                    :disabled="updating"
                    @click="setWriterFlags('writer_verified', !selected.writer_verified)"
                  >
                    <span>Writer verified</span>
                    <span class="font-semibold">{{ selected.writer_verified ? 'On' : 'Off' }}</span>
                  </button>

                  <button
                    type="button"
                    class="inline-flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition disabled:opacity-60"
                    :disabled="updating"
                    @click="setWriterFlags('writer_no_approval_needed', !selected.writer_no_approval_needed)"
                  >
                    <span>No approve needed further</span>
                    <span class="font-semibold">{{ selected.writer_no_approval_needed ? 'On' : 'Off' }}</span>
                  </button>
                </div>
              </div>

              <div class="mt-3 text-xs text-black/60 dark:text-white/60">
                Profile updates depend on your RLS policies allowing admins to update profiles.
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 xl:grid-cols-6 gap-3">
            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Subscription</div>
              <div class="mt-1 text-lg font-bold text-black dark:text-white">{{ selected.subscription_status }}</div>
              <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">
                {{ fmtDate(selected.subscription_ends_at) }}
              </div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Payments</div>
              <div class="mt-1 text-lg font-bold text-black dark:text-white">{{ selected.payments_count }}</div>
              <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">৳{{ fmtMoney(selected.payments_total_bdt) }}</div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">
                {{ selectedTournament ? 'Selected entries' : 'Tournament entries' }}
              </div>
              <div class="mt-1 text-lg font-bold text-black dark:text-white">
                {{ selectedTournament ? (selectedScopedStats?.entries ?? 0) : selected.tournament_entries }}
              </div>
              <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">
                Best: {{ selectedTournament ? fmtScore(selectedScopedStats?.best_score) : fmtScore(selected.tournament_best_score) }}
              </div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">
                {{ selectedTournament ? 'Selected accepted best' : 'Overall accepted best' }}
              </div>
              <div class="mt-1 text-lg font-bold text-black dark:text-white">
                {{ selectedTournament ? fmtScore(selectedScopedStats?.best_accepted_score) : fmtScore(selected.tournament_best_accepted_score) }}
              </div>
              <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">
                Latest: {{ selectedTournament ? fmtDate(selectedScopedStats?.latest_at) : fmtDate(selected.tournament_latest_at) }}
              </div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Leaderboard entries</div>
              <div class="mt-1 text-lg font-bold text-black dark:text-white">{{ selected.leaderboard_entries }}</div>
              <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">Best: {{ fmtScore(selected.leaderboard_best_score) }}</div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="text-xs text-black/60 dark:text-white/60">Referrals</div>
              <div class="mt-1 text-lg font-bold text-black dark:text-white">{{ selected.referrals_count }}</div>
              <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">Earned: ৳{{ fmtMoney(selected.referral_earned_total_bdt) }}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="text-sm font-semibold text-black dark:text-white">Subscriptions</div>
                <div class="text-xs text-black/60 dark:text-white/60">{{ selected.subscriptions.length }}</div>
              </div>

              <div v-if="selected.subscriptions.length" class="mt-3 overflow-auto">
                <table class="w-full text-sm">
                  <thead class="text-black/60 dark:text-white/60">
                    <tr class="border-b border-black/10 dark:border-white/10">
                      <th class="py-2 pr-3 text-left">Status</th>
                      <th class="py-2 pr-3 text-left">Start</th>
                      <th class="py-2 pr-3 text-left">End</th>
                      <th class="py-2 pr-0 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in selected.subscriptions.slice(0, 12)" :key="s.id" class="border-b border-black/5 dark:border-white/5">
                      <td class="py-2 pr-3">{{ s.status }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ fmtDate(s.starts_at) }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ fmtDate(s.ends_at) }}</td>
                      <td class="py-2 pr-0 text-right">৳{{ fmtMoney(s.amount_bdt) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="mt-3 text-sm text-black/60 dark:text-white/60">
                No subscriptions found.
              </div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="text-sm font-semibold text-black dark:text-white">Payments</div>
                <div class="text-xs text-black/60 dark:text-white/60">{{ selected.payments.length }}</div>
              </div>

              <div v-if="selectedRecentPayments.length" class="mt-3 overflow-auto">
                <table class="w-full text-sm">
                  <thead class="text-black/60 dark:text-white/60">
                    <tr class="border-b border-black/10 dark:border-white/10">
                      <th class="py-2 pr-3 text-left">Status</th>
                      <th class="py-2 pr-3 text-left">Plan</th>
                      <th class="py-2 pr-3 text-left">Paid</th>
                      <th class="py-2 pr-0 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in selectedRecentPayments" :key="p.id" class="border-b border-black/5 dark:border-white/5">
                      <td class="py-2 pr-3">{{ p.status }}</td>
                      <td class="py-2 pr-3">{{ p.plan_code }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ fmtDate(p.paid_at || p.created_at) }}</td>
                      <td class="py-2 pr-0 text-right">৳{{ fmtMoney(p.amount_bdt) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="mt-3 text-sm text-black/60 dark:text-white/60">
                No payments found.
              </div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4 xl:col-span-2">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <div class="text-sm font-semibold text-black dark:text-white">
                    {{ selectedTournament ? 'Selected tournament scores' : 'Tournament scores' }}
                  </div>
                  <span
                    v-if="selectedTournament"
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold"
                    :class="tournamentStatusClass(selectedTournament.status)"
                  >
                    {{ selectedTournament.title }}
                  </span>
                </div>

                <div class="text-xs text-black/60 dark:text-white/60">
                  {{ selectedTournament ? (selectedScopedStats?.entries ?? 0) : selected.tournament_scores.length }}
                </div>
              </div>

              <div v-if="selectedRecentTournament.length" class="mt-3 overflow-auto">
                <table class="w-full text-sm">
                  <thead class="text-black/60 dark:text-white/60">
                    <tr class="border-b border-black/10 dark:border-white/10">
                      <th class="py-2 pr-3 text-left">Name</th>
                      <th class="py-2 pr-3 text-left">Score</th>
                      <th class="py-2 pr-3 text-left">Accepted</th>
                      <th class="py-2 pr-3 text-left">Device</th>
                      <th class="py-2 pr-0 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in selectedRecentTournament" :key="t.id" class="border-b border-black/5 dark:border-white/5">
                      <td class="py-2 pr-3">{{ t.player_name }}</td>
                      <td class="py-2 pr-3">{{ fmtScore(t.score) }}</td>
                      <td class="py-2 pr-3">{{ fmtScore(t.accepted_score) }}</td>
                      <td class="py-2 pr-3">{{ t.device_type || '—' }}</td>
                      <td class="py-2 pr-0 text-right whitespace-nowrap">{{ fmtDate(t.updated_at || t.created_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="mt-3 text-sm text-black/60 dark:text-white/60">
                No tournament scores found.
              </div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="text-sm font-semibold text-black dark:text-white">Leaderboard scores</div>
                <div class="text-xs text-black/60 dark:text-white/60">{{ selected.leaderboard_scores.length }}</div>
              </div>

              <div v-if="selectedRecentLeaderboard.length" class="mt-3 overflow-auto">
                <table class="w-full text-sm">
                  <thead class="text-black/60 dark:text-white/60">
                    <tr class="border-b border-black/10 dark:border-white/10">
                      <th class="py-2 pr-3 text-left">Game</th>
                      <th class="py-2 pr-3 text-left">Score</th>
                      <th class="py-2 pr-0 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="l in selectedRecentLeaderboard" :key="l.id" class="border-b border-black/5 dark:border-white/5">
                      <td class="py-2 pr-3">{{ l.game_slug }}</td>
                      <td class="py-2 pr-3">{{ fmtScore(l.score) }}</td>
                      <td class="py-2 pr-0 text-right whitespace-nowrap">{{ fmtDate(l.created_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="mt-3 text-sm text-black/60 dark:text-white/60">
                No leaderboard scores found.
              </div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="text-sm font-semibold text-black dark:text-white">Referrals earned</div>
                <div class="text-xs text-black/60 dark:text-white/60">{{ selected.referrals_earned.length }}</div>
              </div>

              <div v-if="selectedRecentReferrals.length" class="mt-3 overflow-auto">
                <table class="w-full text-sm">
                  <thead class="text-black/60 dark:text-white/60">
                    <tr class="border-b border-black/10 dark:border-white/10">
                      <th class="py-2 pr-3 text-left">Referred user</th>
                      <th class="py-2 pr-3 text-left">Code</th>
                      <th class="py-2 pr-3 text-left">Status</th>
                      <th class="py-2 pr-3 text-left">Created</th>
                      <th class="py-2 pr-0 text-right">Bonus</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in selectedRecentReferrals" :key="r.id" class="border-b border-black/5 dark:border-white/5">
                      <td class="py-2 pr-3 font-mono text-xs break-all">{{ r.referred_user_id }}</td>
                      <td class="py-2 pr-3">{{ r.referral_code }}</td>
                      <td class="py-2 pr-3">{{ r.status }}</td>
                      <td class="py-2 pr-3 whitespace-nowrap">{{ fmtDate(r.created_at) }}</td>
                      <td class="py-2 pr-0 text-right">৳{{ fmtMoney(r.bonus_bdt) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="mt-3 text-sm text-black/60 dark:text-white/60">
                No referrals found.
              </div>
            </div>
          </div>
        </div>

        <div class="p-4 sm:p-5 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex justify-end">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
            @click="closeModal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>