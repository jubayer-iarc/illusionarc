<!-- app/pages/admin/logs.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Logs' })

const supabase = useSupabaseClient()
const toast = useToast()

type LogRow = {
  id: number
  blog_id: string | null
  actor_user_id: string | null
  action: string
  meta: Record<string, any> | null
  created_at: string
}

type BlogLite = {
  id: string
  title: string
  slug: string
  status?: string | null
}

type ProfileLite = {
  user_id: string
  display_name: string
}

const loading = ref(true)
const refreshing = ref(false)
const selectedLog = ref<LogRow | null>(null)

const logs = ref<LogRow[]>([])
const blogMap = ref<Record<string, BlogLite>>({})
const profileMap = ref<Record<string, ProfileLite>>({})

const q = ref('')
const actionFilter = ref('all')
const actorFilter = ref('all')
const blogFilter = ref('all')
const limit = ref(100)

function fmtDT(v?: string | null) {
  if (!v) return '—'
  return new Intl.DateTimeFormat('en-BD', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(v))
}

function n(v: number | null | undefined) {
  return new Intl.NumberFormat().format(Number(v || 0))
}

function actionClass(action: string) {
  const a = String(action || '').toLowerCase()

  if (a.includes('approved')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
  if (a.includes('published')) return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25'
  if (a.includes('rejected')) return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25'
  if (a.includes('archived') || a.includes('deleted')) return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25'
  if (a.includes('created')) return 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25'
  if (a.includes('saved') || a.includes('updated')) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'

  return 'bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 border-black/10 dark:border-white/10'
}

function pillClass(extra = '') {
  return `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${extra}`
}

function actorName(id?: string | null) {
  if (!id) return 'Unknown user'
  return profileMap.value[id]?.display_name || id
}

function blogTitle(id?: string | null) {
  if (!id) return 'No blog'
  return blogMap.value[id]?.title || id
}

function blogSlug(id?: string | null) {
  if (!id) return ''
  return blogMap.value[id]?.slug || ''
}

const actionOptions = computed(() => {
  return ['all', ...Array.from(new Set(logs.value.map((x) => x.action).filter(Boolean))).sort()]
})

const actorOptions = computed(() => {
  const ids = Array.from(new Set(logs.value.map((x) => x.actor_user_id).filter(Boolean) as string[]))
  return [
    { label: 'All actors', value: 'all' },
    ...ids.map((id) => ({
      label: actorName(id),
      value: id
    }))
  ]
})

const blogOptions = computed(() => {
  const ids = Array.from(new Set(logs.value.map((x) => x.blog_id).filter(Boolean) as string[]))
  return [
    { label: 'All blogs', value: 'all' },
    ...ids.map((id) => ({
      label: blogTitle(id),
      value: id
    }))
  ]
})

const filteredLogs = computed(() => {
  const needle = q.value.trim().toLowerCase()

  return logs.value.filter((row) => {
    if (actionFilter.value !== 'all' && row.action !== actionFilter.value) return false
    if (actorFilter.value !== 'all' && row.actor_user_id !== actorFilter.value) return false
    if (blogFilter.value !== 'all' && row.blog_id !== blogFilter.value) return false

    if (!needle) return true

    const hay = [
      row.action,
      row.actor_user_id || '',
      actorName(row.actor_user_id),
      row.blog_id || '',
      blogTitle(row.blog_id),
      blogSlug(row.blog_id),
      JSON.stringify(row.meta || {})
    ]
      .join(' ')
      .toLowerCase()

    return hay.includes(needle)
  })
})

const displayedLogs = computed(() => filteredLogs.value.slice(0, Math.max(10, Math.min(500, Number(limit.value || 100)))))

const summary = computed(() => {
  const total = logs.value.length
  const visible = filteredLogs.value.length
  const actors = new Set(logs.value.map((x) => x.actor_user_id).filter(Boolean)).size
  const blogsCount = new Set(logs.value.map((x) => x.blog_id).filter(Boolean)).size
  return { total, visible, actors, blogsCount }
})

async function loadLogs() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('blog_activity_logs')
      .select('id, blog_id, actor_user_id, action, meta, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) throw error

    logs.value = (data || []) as LogRow[]

    const blogIds = Array.from(new Set(logs.value.map((x) => x.blog_id).filter(Boolean) as string[]))
    const actorIds = Array.from(new Set(logs.value.map((x) => x.actor_user_id).filter(Boolean) as string[]))

    if (blogIds.length) {
      const { data: blogRows, error: blogErr } = await supabase
        .from('blogs')
        .select('id, title, slug, status')
        .in('id', blogIds)

      if (blogErr) throw blogErr

      const map: Record<string, BlogLite> = {}
      ;(blogRows || []).forEach((row: any) => {
        map[String(row.id)] = {
          id: String(row.id),
          title: String(row.title || 'Untitled'),
          slug: String(row.slug || ''),
          status: row.status ? String(row.status) : null
        }
      })
      blogMap.value = map
    } else {
      blogMap.value = {}
    }

    if (actorIds.length) {
      const { data: profileRows, error: profileErr } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', actorIds)

      if (profileErr) throw profileErr

      const map: Record<string, ProfileLite> = {}
      ;(profileRows || []).forEach((row: any) => {
        map[String(row.user_id)] = {
          user_id: String(row.user_id),
          display_name: String(row.display_name || 'User')
        }
      })
      profileMap.value = map
    } else {
      profileMap.value = {}
    }
  } catch (e: any) {
    toast.add({
      title: 'Failed to load logs',
      description: e?.message || 'Unknown error',
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
    await loadLogs()
  } finally {
    refreshing.value = false
  }
}

function copyJson(value: any) {
  const text = JSON.stringify(value || {}, null, 2)
  navigator.clipboard.writeText(text).then(
    () => {
      toast.add({
        title: 'Copied',
        description: 'Log metadata copied.',
        color: 'success'
      })
    },
    () => {
      toast.add({
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access.',
        color: 'warning'
      })
    }
  )
}

onMounted(loadLogs)
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-5 lg:p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-sm text-black/60 dark:text-white/60">Security</div>
          <h1 class="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            Activity Logs
          </h1>
          <p class="mt-2 text-sm text-black/60 dark:text-white/60 max-w-3xl">
            Review blog activity by actor, blog, action, and payload. Only admins can view this page.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition disabled:opacity-60"
            :disabled="loading || refreshing"
            @click="refresh"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5" />
            {{ refreshing ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
          <div class="text-xs text-black/60 dark:text-white/60">Total logs</div>
          <div class="mt-1 text-xl font-bold">{{ n(summary.total) }}</div>
        </div>

        <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
          <div class="text-xs text-black/60 dark:text-white/60">Visible now</div>
          <div class="mt-1 text-xl font-bold">{{ n(summary.visible) }}</div>
        </div>

        <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
          <div class="text-xs text-black/60 dark:text-white/60">Actors</div>
          <div class="mt-1 text-xl font-bold">{{ n(summary.actors) }}</div>
        </div>

        <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-4">
          <div class="text-xs text-black/60 dark:text-white/60">Blogs</div>
          <div class="mt-1 text-xl font-bold">{{ n(summary.blogsCount) }}</div>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px_240px_240px_120px] gap-3">
        <input
          v-model="q"
          type="text"
          placeholder="Search action, actor, blog, meta…"
          class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
        >

        <select
          v-model="actionFilter"
          class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
        >
          <option value="all">All actions</option>
          <option
            v-for="item in actionOptions"
            :key="item"
            :value="item"
          >
            {{ item }}
          </option>
        </select>

        <select
          v-model="actorFilter"
          class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
        >
          <option
            v-for="item in actorOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>

        <select
          v-model="blogFilter"
          class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
        >
          <option
            v-for="item in blogOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>

        <input
          v-model.number="limit"
          type="number"
          min="10"
          max="500"
          class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
          placeholder="Limit"
        >
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4">
      <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="text-black/60 dark:text-white/60">
              <tr class="text-left border-b border-black/10 dark:border-white/10">
                <th class="py-3 px-4">Time</th>
                <th class="py-3 px-4">Action</th>
                <th class="py-3 px-4">Actor</th>
                <th class="py-3 px-4">Blog</th>
                <th class="py-3 px-4">Meta</th>
                <th class="py-3 px-4 text-right">Open</th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="loading" v-for="i in 8" :key="i" class="border-b border-black/10 dark:border-white/10">
                <td class="px-4 py-4" colspan="6">
                  <div class="h-10 rounded bg-black/5 dark:bg-white/5 animate-pulse" />
                </td>
              </tr>

              <tr
                v-else-if="displayedLogs.length"
                v-for="row in displayedLogs"
                :key="row.id"
                class="border-b border-black/10 dark:border-white/10 align-top hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                <td class="px-4 py-4 min-w-[160px]">
                  <div class="text-sm">{{ fmtDT(row.created_at) }}</div>
                  <div class="text-[11px] text-black/50 dark:text-white/50">#{{ row.id }}</div>
                </td>

                <td class="px-4 py-4 min-w-[180px]">
                  <span :class="pillClass(actionClass(row.action))">
                    {{ row.action }}
                  </span>
                </td>

                <td class="px-4 py-4 min-w-[180px]">
                  <div class="font-medium">{{ actorName(row.actor_user_id) }}</div>
                  <div class="text-[11px] text-black/50 dark:text-white/50 break-all">
                    {{ row.actor_user_id || '—' }}
                  </div>
                </td>

                <td class="px-4 py-4 min-w-[220px]">
                  <div class="font-medium">{{ blogTitle(row.blog_id) }}</div>
                  <div class="text-[11px] text-black/50 dark:text-white/50">
                    {{ blogSlug(row.blog_id) ? `/insights/${blogSlug(row.blog_id)}` : '—' }}
                  </div>
                </td>

                <td class="px-4 py-4 min-w-[220px]">
                  <div class="line-clamp-2 text-xs text-black/60 dark:text-white/60 break-all">
                    {{ JSON.stringify(row.meta || {}) }}
                  </div>
                </td>

                <td class="px-4 py-4 text-right">
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
                    @click="selectedLog = row"
                  >
                    <UIcon name="i-heroicons-eye" class="h-4 w-4" />
                    View
                  </button>
                </td>
              </tr>

              <tr v-else class="border-b border-black/10 dark:border-white/10">
                <td colspan="6" class="px-4 py-10 text-center text-sm text-black/60 dark:text-white/60">
                  No logs found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-base font-semibold">Log Details</div>
            <div class="text-xs text-black/60 dark:text-white/60">
              Select a row to inspect metadata.
            </div>
          </div>

          <button
            v-if="selectedLog"
            type="button"
            class="text-xs text-black/60 dark:text-white/60 hover:underline"
            @click="selectedLog = null"
          >
            Clear
          </button>
        </div>

        <div v-if="selectedLog" class="mt-4 space-y-4">
          <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
            <div class="text-xs text-black/60 dark:text-white/60">Action</div>
            <div class="mt-2">
              <span :class="pillClass(actionClass(selectedLog.action))">
                {{ selectedLog.action }}
              </span>
            </div>
          </div>

          <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4 space-y-3">
            <div>
              <div class="text-xs text-black/60 dark:text-white/60">Time</div>
              <div class="mt-1 text-sm font-medium">{{ fmtDT(selectedLog.created_at) }}</div>
            </div>

            <div>
              <div class="text-xs text-black/60 dark:text-white/60">Actor</div>
              <div class="mt-1 text-sm font-medium">{{ actorName(selectedLog.actor_user_id) }}</div>
              <div class="mt-1 text-[11px] text-black/50 dark:text-white/50 break-all">
                {{ selectedLog.actor_user_id || '—' }}
              </div>
            </div>

            <div>
              <div class="text-xs text-black/60 dark:text-white/60">Blog</div>
              <div class="mt-1 text-sm font-medium">{{ blogTitle(selectedLog.blog_id) }}</div>
              <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">
                {{ blogSlug(selectedLog.blog_id) ? `/insights/${blogSlug(selectedLog.blog_id)}` : '—' }}
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-xs text-black/60 dark:text-white/60">Metadata</div>
                <div class="mt-1 text-sm font-medium">JSON payload</div>
              </div>

              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
                @click="copyJson(selectedLog.meta)"
              >
                <UIcon name="i-heroicons-clipboard" class="h-4 w-4" />
                Copy
              </button>
            </div>

            <pre class="mt-3 overflow-auto rounded-xl border border-black/10 dark:border-white/10 bg-neutral-950 text-white p-4 text-xs leading-6">{{ JSON.stringify(selectedLog.meta || {}, null, 2) }}</pre>
          </div>
        </div>

        <div v-else class="mt-6 rounded-xl border border-dashed border-black/10 dark:border-white/10 p-6 text-sm text-black/60 dark:text-white/60">
          Pick a log entry from the table to inspect the full payload.
        </div>
      </aside>
    </div>
  </div>
</template>