<!-- app/pages/arcade/winners.vue (adjust path if different) -->
<script setup lang="ts">
import { GAMES } from '@/data/games'

useHead({ title: 'Winners — illusion Arc' })

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()

const limit = ref(50)
const loading = ref(true)
const errorMsg = ref<string | null>(null)

const selected = ref<string>(GAMES[0]?.slug || '')

onMounted(() => {
  const q = route.query.game
  if (typeof q === 'string' && q.trim()) selected.value = q.trim()
  else selected.value = GAMES[0]?.slug || ''
})

watch(
  selected,
  async (v) => {
    const q: Record<string, any> = { ...route.query, game: v }
    await router.replace({ query: q })
  },
  { flush: 'post' }
)

type WinnerRow = {
  userId: string
  player: string
  bestScore: number
  achievedAt: string
}

const rows = ref<WinnerRow[]>([])

/** Avatar cache keyed by user_id */
const avatarMap = ref<Record<string, string>>({})

/** Phone cache keyed by user_id */
const phoneMap = ref<Record<string, string>>({})

function clampLimit(n: number) {
  if (!Number.isFinite(n)) return 50
  return Math.max(1, Math.min(Math.floor(n), 200))
}

/** initials fallback */
function initials(name: string) {
  const s = String(name || '').trim()
  if (!s) return 'P'
  const parts = s.split(/\s+/g).filter(Boolean)
  const a = parts[0]?.[0] || 'P'
  const b = parts.length > 1 ? (parts[1]?.[0] || '') : (parts[0]?.[1] || '')
  return (a + b).toUpperCase()
}

function avatarFor(r: WinnerRow) {
  const id = r.userId || ''
  return id ? avatarMap.value[id] || '' : ''
}

/** show only first 6 chars, rest X (e.g. +88017XXXXXXXX) */
function maskPhone(raw?: string) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const keep = 6
  if (s.length <= keep) return s
  return s.slice(0, keep) + 'X'.repeat(s.length - keep)
}

function maskedPhoneFor(r: WinnerRow) {
  const id = r.userId || ''
  const p = id ? phoneMap.value[id] || '' : ''
  return maskPhone(p)
}

// ✅ Fix Postgres timestamp parsing in Safari:
// "2026-01-07 08:17:53.462376+00" -> "2026-01-07T08:17:53.462376+00"
function parsePgTs(ts?: string) {
  if (!ts) return null
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Batch fetch avatar + phone from profiles for visible rows */
async function loadProfilesForRows(items: WinnerRow[]) {
  const ids = Array.from(new Set(items.map((r) => r.userId).filter(Boolean))) as string[]
  if (!ids.length) return

  try {
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('user_id, avatar_url, phone')
      .in('user_id', ids)

    if (error) {
      // Non-fatal (RLS might block). We'll show initials and "—" for phone.
      console.warn('Profile fetch blocked:', error.message)
      return
    }

    const aMap: Record<string, string> = { ...avatarMap.value }
    const pMap: Record<string, string> = { ...phoneMap.value }

    for (const p of data || []) {
      const uid = p?.user_id
      if (!uid) continue

      const url = String(p?.avatar_url || '').trim()
      const phone = String(p?.phone || '').trim()

      if (url) aMap[uid] = url
      if (phone) pMap[uid] = phone
    }

    avatarMap.value = aMap
    phoneMap.value = pMap
  } catch (e) {
    console.warn('Profile fetch failed:', e)
  }
}

async function load() {
  loading.value = true
  errorMsg.value = null

  try {
    if (!selected.value) {
      rows.value = []
      return
    }

    const res: any = await $fetch('/api/winner/get', {
      method: 'GET',
      query: {
        gameSlug: selected.value,
        limit: clampLimit(limit.value)
      }
    })

    const items: WinnerRow[] = Array.isArray(res?.items) ? res.items : []
    rows.value = items

    // ✅ pull avatar + phone after list loads
    await loadProfilesForRows(items)
  } catch (e: any) {
    rows.value = []
    errorMsg.value = e?.data?.message || e?.message || 'Failed to load winners.'
  } finally {
    loading.value = false
  }
}

watch([selected, limit], load, { immediate: true })
</script>

<template>
  <UContainer class="py-12">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold text-[var(--app-fg)]">All-time Winners</h1>
        <p class="mt-2 text-black/70 dark:text-white/70">
          Best score per player (per game).
        </p>
      </div>

      <div class="flex flex-wrap gap-2 items-center justify-end">
        <UButton
          variant="soft"
          icon="i-heroicons-chart-bar"
          :to="`/arcade/leaderboard?game=${selected}`"
        >
          Leaderboard
        </UButton>

        <div class="w-28">
          <UInput v-model.number="limit" type="number" min="1" max="200" />
        </div>
      </div>
    </div>

    <!-- Game tabs -->
    <div class="mt-5 flex gap-2 overflow-x-auto pb-1">
      <UButton
        v-for="g in GAMES"
        :key="g.slug"
        size="sm"
        :variant="selected === g.slug ? 'solid' : 'soft'"
        :color="selected === g.slug ? 'primary' : 'info'"
        @click="selected = g.slug"
      >
        {{ g.name }}
      </UButton>
    </div>

    <!-- Podium-ish mini highlight (top 3) -->
    <div v-if="!loading && !errorMsg && rows.length" class="mt-6 grid gap-3 md:grid-cols-3">
      <div
        v-for="(r, i) in rows.slice(0, 3)"
        :key="r.userId || i"
        class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-4"
      >
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold text-black dark:text-white">
            🏆 Rank #{{ i + 1 }}
          </div>
          <div class="text-xs text-black/60 dark:text-white/60">
            {{ selected }}
          </div>
        </div>

        <div class="mt-3 flex items-center gap-3">
          <div class="relative h-12 w-12 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
            <img
              v-if="avatarFor(r)"
              :src="avatarFor(r)"
              class="h-full w-full object-cover"
              alt="avatar"
              referrerpolicy="no-referrer"
            />
            <div v-else class="h-full w-full grid place-items-center text-sm font-semibold text-black/70 dark:text-white/70">
              {{ initials(r.player) }}
            </div>
          </div>

          <div class="min-w-0">
            <div class="font-semibold text-black dark:text-white truncate">
              {{ r.player }}
            </div>

            <div v-if="maskedPhoneFor(r)" class="mt-0.5 text-[11px] text-black/60 dark:text-white/60 truncate">
              {{ maskedPhoneFor(r) }}
            </div>
          </div>
        </div>

        <div class="mt-3 text-2xl font-semibold tabular-nums text-black dark:text-white">
          {{ r.bestScore }}
          <span class="text-sm font-medium text-black/60 dark:text-white/60">pts</span>
        </div>

        <div class="mt-2 text-xs text-black/60 dark:text-white/60">
          <span v-if="parsePgTs(r.achievedAt)">{{ parsePgTs(r.achievedAt)!.toLocaleString() }}</span>
          <span v-else>—</span>
        </div>
      </div>
    </div>

    <UCard class="mt-6 border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="font-semibold text-black dark:text-white">
            Winners — {{ selected }}
          </div>
          <div class="text-sm text-black/60 dark:text-white/60" v-if="loading">Loading…</div>
        </div>
      </template>

      <div v-if="errorMsg" class="p-4 text-sm">
        <div class="text-black/90 dark:text-white/90">❌ {{ errorMsg }}</div>
        <div class="mt-3">
          <UButton size="sm" variant="soft" @click="load">Retry</UButton>
        </div>
      </div>

      <div v-else class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="text-black/60 dark:text-white/60">
            <tr class="text-left border-b border-black/10 dark:border-white/10">
              <th class="py-3 pr-3">#</th>
              <th class="py-3 pr-3">Player</th>
              <th class="py-3 pr-3">Phone</th>
              <th class="py-3 pr-3">Best score</th>
              <th class="py-3 pr-3">Achieved</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="(r, i) in rows"
              :key="r.userId || i"
              class="border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <td class="py-3 pr-3 text-black/60 dark:text-white/60">{{ i + 1 }}</td>

              <!-- ✅ Avatar + name -->
              <td class="py-3 pr-3">
                <div class="flex items-center gap-3">
                  <div class="relative h-9 w-9 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                    <img
                      v-if="avatarFor(r)"
                      :src="avatarFor(r)"
                      class="h-full w-full object-cover"
                      alt="avatar"
                      referrerpolicy="no-referrer"
                    />
                    <div v-else class="h-full w-full grid place-items-center text-xs font-semibold text-black/70 dark:text-white/70">
                      {{ initials(r.player) }}
                    </div>
                  </div>

                  <div class="min-w-0">
                    <div class="font-medium text-black dark:text-white truncate">
                      {{ r.player }}
                    </div>
                    <div class="text-[11px] text-black/50 dark:text-white/50 truncate">
                      Winner
                    </div>
                  </div>
                </div>
              </td>

              <!-- ✅ masked phone -->
              <td class="py-3 pr-3 text-black/70 dark:text-white/70 tabular-nums">
                <span v-if="maskedPhoneFor(r)">{{ maskedPhoneFor(r) }}</span>
                <span v-else class="text-black/40 dark:text-white/40">—</span>
              </td>

              <td class="py-3 pr-3 font-semibold tabular-nums text-black dark:text-white">
                {{ r.bestScore }}
              </td>

              <td class="py-3 pr-3 text-black/60 dark:text-white/60">
                <span v-if="parsePgTs(r.achievedAt)">
                  {{ parsePgTs(r.achievedAt)!.toLocaleString() }}
                </span>
                <span v-else>—</span>
              </td>
            </tr>

            <tr v-if="!loading && rows.length === 0">
              <td colspan="5" class="py-10 text-center text-black/60 dark:text-white/60">
                No winners yet for this game.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </UContainer>
</template>
