<!-- app/pages/admin/catalogue.vue -->
<script setup lang="ts">
/**
 * Admin Catalogue (styled like admin/works.vue)
 * - No Nuxt UI UModal; uses custom modal overlay
 * - Full-width form (max-width shell) with tabs (Details / Media)
 * - Upload icon + feature graphic to Supabase Storage bucket: game-assets
 * - CRUD for public.game_catalogue
 */

definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Catalogue' })

const supabase = useSupabaseClient()
const toast = useToast()

/* ---------------- Types ---------------- */
type GameRow = {
  id: string
  slug: string
  title: string
  url: string
  platform: string
  genre: string[]
  orientation: string
  description: string
  features: string[]
  mechanics: string[] | null
  controls: string
  integration_note: string
  icon_url: string | null
  thumbnails_url: string | null
  feature_graphic_url: string | null
  is_published: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

/* ---------------- Constants ---------------- */
const BUCKET = 'game-assets' // Supabase Storage bucket for catalogue images

/* ---------------- State ---------------- */
const loading = ref(true)
const saving = ref(false)
const uploadingIcon = ref(false)
const uploadingFeature = ref(false)

const games = ref<GameRow[]>([])

const q = ref('')
const onlyPublished = ref(false)

const showForm = ref(false)
const isEditing = ref(false)

const showDelete = ref(false)
const deleting = ref(false)
const deleteTarget = ref<GameRow | null>(null)

/* Modal Tabs */
type TabKey = 'details' | 'media'
const activeTab = ref<TabKey>('details')

/* Form */
const form = reactive<GameRow>({
  id: '',
  slug: '',
  title: '',
  url: '',
  platform: 'HTML5 Web (Desktop + Mobile compatible)',
  genre: [],
  orientation: '',
  description: '',
  features: [],
  mechanics: null,
  controls: '',
  integration_note: '',
  icon_url: null,
  thumbnails_url: null,
  feature_graphic_url: null,
  is_published: true,
  sort_order: 100
})

/* ---------------- Helpers ---------------- */
function safeArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}
function safeText(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
}
function baseSlugFromTitle(title: string) {
  return String(title || '')
      .toLowerCase()
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
}
function normalizeSlug(v: string) {
  return baseSlugFromTitle(v)
}
function nextSortOrderForNew() {
  const maxOrder = Math.max(0, ...games.value.map((g) => Number(g.sort_order || 0)))
  return maxOrder + 10
}
function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(String(url || '').trim())
}
function extFromFile(file: File) {
  const name = file.name || ''
  const dot = name.lastIndexOf('.')
  const raw = dot >= 0 ? name.slice(dot + 1) : ''
  const ext = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  return ext || 'png'
}
function getPublicUrl(path: string) {
  if (!path) return ''
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data?.publicUrl || ''
}
function publicUrlToPath(url: string) {
  // .../storage/v1/object/public/<bucket>/<path>
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return ''
  return url.slice(idx + marker.length)
}

/* Preview helpers (like admin/works) */
const previewSlug = computed(() => normalizeSlug(form.slug || form.title || ''))
const previewPlay = computed(() => (isHttpUrl(form.url) ? form.url : 'https://...'))

function setTab(t: TabKey) {
  activeTab.value = t
}

/* ---------------- Load ---------------- */
async function loadGames() {
  loading.value = true
  try {
    const { data, error } = await supabase
        .from('game_catalogue')
        .select(
            `
        id, slug, title, url, platform, genre, orientation,
        description, features, mechanics, controls, integration_note,
        icon_url, thumbnails_url, feature_graphic_url,
        is_published, sort_order, created_at, updated_at
      `
        )
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

    if (error) throw error

    const list = (data || []) as any[]
    games.value = list.map((r) => ({
      id: String(r.id),
      slug: String(r.slug || ''),
      title: String(r.title || ''),
      url: String(r.url || ''),
      platform: String(r.platform || ''),
      genre: safeArr(r.genre),
      orientation: String(r.orientation || ''),
      description: String(r.description || ''),
      features: safeArr(r.features),
      mechanics: Array.isArray(r.mechanics) ? safeArr(r.mechanics) : null,
      controls: String(r.controls || ''),
      integration_note: String(r.integration_note || ''),
      icon_url: r.icon_url ? String(r.icon_url) : null,
      thumbnails_url: r.thumbnails_url ? String(r.thumbnails_url) : null,
      feature_graphic_url: r.feature_graphic_url ? String(r.feature_graphic_url) : null,
      is_published: !!r.is_published,
      sort_order: Number(r.sort_order ?? 100),
      created_at: r.created_at,
      updated_at: r.updated_at
    }))
  } catch (e: any) {
    toast.add({ title: 'Failed to load catalogue', description: e?.message || 'Unknown error', color: 'error' })
    games.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadGames)

/* ---------------- Filtered view ---------------- */
const filteredGames = computed(() => {
  const query = q.value.trim().toLowerCase()
  return games.value.filter((g) => {
    if (onlyPublished.value && !g.is_published) return false
    if (!query) return true
    const blob = [
      g.title,
      g.slug,
      g.url,
      g.platform,
      g.orientation,
      g.description,
      (g.genre || []).join(' '),
      (g.features || []).join(' ')
    ]
        .join(' ')
        .toLowerCase()
    return blob.includes(query)
  })
})

/* ---------------- Open Create/Edit ---------------- */
function openCreate() {
  isEditing.value = false
  showForm.value = true
  activeTab.value = 'details'

  Object.assign(form, {
    id: '',
    slug: '',
    title: '',
    url: '',
    platform: 'HTML5 Web (Desktop + Mobile compatible)',
    genre: [],
    orientation: '',
    description: '',
    features: [],
    mechanics: null,
    controls: '',
    integration_note: '',
    icon_url: null,
    thumbnails_url: null,
    feature_graphic_url: null,
    is_published: true,
    sort_order: nextSortOrderForNew()
  })
}

function openEdit(g: GameRow) {
  isEditing.value = true
  showForm.value = true
  activeTab.value = 'details'

  Object.assign(form, {
    id: g.id,
    slug: g.slug,
    title: g.title,
    url: g.url,
    platform: g.platform,
    genre: safeArr(g.genre),
    orientation: g.orientation,
    description: g.description,
    features: safeArr(g.features),
    mechanics: g.mechanics ? safeArr(g.mechanics) : null,
    controls: g.controls,
    integration_note: g.integration_note,
    icon_url: g.icon_url ?? null,
    thumbnails_url: g.thumbnails_url ?? null,
    feature_graphic_url: g.feature_graphic_url ?? null,
    is_published: !!g.is_published,
    sort_order: Number(g.sort_order ?? 100)
  })
}

function closeModal() {
  showForm.value = false
}

/* ---------------- Delete ---------------- */
function openDelete(g: GameRow) {
  deleteTarget.value = g
  showDelete.value = true
}
function closeDelete() {
  showDelete.value = false
  deleteTarget.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const target = deleteTarget.value

    const { error } = await supabase.from('game_catalogue').delete().eq('id', target.id)
    if (error) throw error

    // Best-effort: remove stored assets (if they are from this bucket)
    try {
      const paths: string[] = []
      if (target.icon_url) {
        const p = publicUrlToPath(target.icon_url)
        if (p) paths.push(p)
      }
      if (target.feature_graphic_url) {
        const p = publicUrlToPath(target.feature_graphic_url)
        if (p) paths.push(p)
      }
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
    } catch {}

    toast.add({ title: 'Deleted', description: 'Game removed.', color: 'success' })
    closeDelete()
    await loadGames()
  } catch (e: any) {
    toast.add({ title: 'Delete failed', description: e?.message || 'Unable to delete.', color: 'error' })
  } finally {
    deleting.value = false
  }
}

/* ---------------- Upload (auto after choose) ---------------- */
const iconInputEl = ref<HTMLInputElement | null>(null)
const featureInputEl = ref<HTMLInputElement | null>(null)

async function uploadToBucket(file: File, kind: 'icon' | 'feature') {
  const slug = previewSlug.value
  if (!slug) throw new Error('Please set a Title (or Slug) before uploading.')

  const ext = extFromFile(file)
  const path = `catalogue/${slug}/${kind}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type
  })
  if (error) throw error
  return getPublicUrl(path)
}

async function onIconPickedAuto(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (!file) return

  uploadingIcon.value = true
  try {
    const url = await uploadToBucket(file, 'icon')
    form.icon_url = url
    toast.add({ title: 'Icon uploaded', description: 'Icon image ready.', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Upload failed', description: err?.message || 'Could not upload icon.', color: 'error' })
  } finally {
    uploadingIcon.value = false
    if (iconInputEl.value) iconInputEl.value.value = ''
  }
}

async function onFeaturePickedAuto(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (!file) return

  uploadingFeature.value = true
  try {
    const url = await uploadToBucket(file, 'feature')
    form.feature_graphic_url = url
    toast.add({ title: 'Feature uploaded', description: 'Feature graphic ready.', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Upload failed', description: err?.message || 'Could not upload feature graphic.', color: 'error' })
  } finally {
    uploadingFeature.value = false
    if (featureInputEl.value) featureInputEl.value.value = ''
  }
}

/* ---------------- Save ---------------- */
const genreCsv = computed({
  get: () => (form.genre || []).join(', '),
  set: (v: string) => (form.genre = safeArr(v))
})
const featuresCsv = computed({
  get: () => (form.features || []).join(', '),
  set: (v: string) => (form.features = safeArr(v))
})
const mechanicsCsv = computed({
  get: () => (form.mechanics || []).join(', '),
  set: (v: string) => (form.mechanics = safeArr(v))
})

async function saveGame() {
  const title = String(form.title || '').trim()
  const slug = normalizeSlug(form.slug || form.title || '')
  const url = String(form.url || '').trim()

  if (!title) {
    toast.add({ title: 'Title required', description: 'Please enter a game title.', color: 'warning' })
    return
  }
  if (!slug) {
    toast.add({ title: 'Slug required', description: 'Please provide a slug or a valid title.', color: 'warning' })
    return
  }
  if (!url || !isHttpUrl(url)) {
    toast.add({ title: 'URL required', description: 'Please enter a valid URL (https://...).', color: 'warning' })
    return
  }
  if (!String(form.platform || '').trim()) {
    toast.add({ title: 'Platform required', description: 'Please enter platform.', color: 'warning' })
    return
  }
  if (!String(form.orientation || '').trim()) {
    toast.add({ title: 'Orientation required', description: 'Please enter orientation.', color: 'warning' })
    return
  }
  if (!String(form.description || '').trim()) {
    toast.add({ title: 'Description required', description: 'Please enter description.', color: 'warning' })
    return
  }
  if (!String(form.controls || '').trim()) {
    toast.add({ title: 'Controls required', description: 'Please enter controls.', color: 'warning' })
    return
  }
  if (!String(form.integration_note || '').trim()) {
    toast.add({ title: 'Integration note required', description: 'Please enter integration note.', color: 'warning' })
    return
  }

  saving.value = true
  try {
    const payload: any = {
      slug,
      title,
      url,
      platform: String(form.platform || '').trim(),
      genre: safeArr(form.genre),
      orientation: String(form.orientation || '').trim(),
      description: String(form.description || '').trim(),
      features: safeArr(form.features),
      mechanics: safeArr(form.mechanics),
      controls: String(form.controls || '').trim(),
      integration_note: String(form.integration_note || '').trim(),
      icon_url: safeText(form.icon_url),
      thumbnails_url: safeText(form.thumbnails_url),
      feature_graphic_url: safeText(form.feature_graphic_url),
      is_published: !!form.is_published,
      sort_order: Number(form.sort_order ?? 100)
    }

    // mechanics: store null if empty array
    if (!payload.mechanics?.length) payload.mechanics = null

    if (isEditing.value && form.id) {
      const { error } = await supabase.from('game_catalogue').update(payload).eq('id', form.id)
      if (error) throw error
      toast.add({ title: 'Saved', description: 'Game updated.', color: 'success' })
    } else {
      const { error } = await supabase.from('game_catalogue').insert(payload)
      if (error) throw error
      toast.add({ title: 'Created', description: 'Game created.', color: 'success' })
    }

    await loadGames()
    closeModal()
  } catch (e: any) {
    toast.add({ title: 'Save failed', description: e?.message || 'Unable to save game.', color: 'error' })
  } finally {
    saving.value = false
  }
}

/* ---------------- Publish toggle (quick) ---------------- */
async function togglePublished(g: GameRow) {
  try {
    const next = !g.is_published
    const { error } = await supabase.from('game_catalogue').update({ is_published: next }).eq('id', g.id)
    if (error) throw error
    g.is_published = next
    toast.add({ title: 'Updated', description: `${g.title} is now ${next ? 'Published' : 'Hidden'}.`, color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Update failed', description: e?.message || 'Unable to update.', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-black dark:text-white">Catalogue</h1>
        <p class="mt-1 text-sm text-black/60 dark:text-white/60">
          Manage games shown on the public catalogue (CRUD). Upload images to Supabase Storage.
        </p>
      </div>

      <button
          type="button"
          class="btn px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition"
          @click="openCreate"
      >
        + New Game
      </button>
    </div>

    <!-- Filters -->
    <div class="grid gap-3 md:grid-cols-12">
      <div class="md:col-span-8">
        <input v-model="q" class="input" placeholder="Search games (title, slug, genre, etc.)" />
      </div>
      <div class="md:col-span-4 flex items-center justify-end gap-3">
        <label class="inline-flex items-center gap-2 text-xs text-black/70 dark:text-white/70">
          <input type="checkbox" v-model="onlyPublished" class="checkbox" />
          Published only
        </label>

        <button
            type="button"
            class="btn px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
            @click="loadGames"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">
      <div v-if="loading" class="p-6">
        <div class="animate-pulse space-y-3">
          <div class="h-4 w-40 rounded bg-black/10 dark:bg-white/10" />
          <div class="h-3 w-72 rounded bg-black/10 dark:bg-white/10" />
          <div class="h-3 w-full rounded bg-black/10 dark:bg-white/10" />
          <div class="h-3 w-full rounded bg-black/10 dark:bg-white/10" />
          <div class="h-3 w-5/6 rounded bg-black/10 dark:bg-white/10" />
        </div>
      </div>

      <div v-else class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-black/60 dark:text-white/60">
          <tr class="border-b border-black/10 dark:border-white/10">
            <th class="px-4 py-3 w-16">Icon</th>
            <th class="px-4 py-3">Title</th>
            <th class="px-4 py-3 hidden md:table-cell">Genres</th>
            <th class="px-4 py-3 hidden lg:table-cell">Slug</th>
            <th class="px-4 py-3 hidden md:table-cell">Order</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
          </thead>

          <tbody>
          <tr
              v-for="g in filteredGames"
              :key="g.id"
              class="border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <td class="px-4 py-3">
              <div class="h-10 w-10 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                <img v-if="g.icon_url" :src="g.icon_url" alt="" class="h-full w-full object-cover" />
                <div v-else class="h-full w-full grid place-items-center text-black/40 dark:text-white/40">—</div>
              </div>
            </td>

            <td class="px-4 py-3">
              <div class="font-semibold text-black dark:text-white">{{ g.title }}</div>
              <div class="text-xs text-black/60 dark:text-white/60 mt-1 line-clamp-1">{{ g.url }}</div>
            </td>

            <td class="px-4 py-3 hidden md:table-cell">
              <div class="flex flex-wrap gap-1.5">
                  <span
                      v-for="(t, i) in (g.genre || [])"
                      :key="t + i"
                      class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]
                           border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5
                           text-black/70 dark:text-white/70"
                  >
                    {{ t }}
                  </span>
                <span v-if="(g.genre || []).length === 0" class="text-xs text-black/50 dark:text-white/50">—</span>
              </div>
            </td>

            <td class="px-4 py-3 hidden lg:table-cell">
              <span class="font-mono text-xs text-black/60 dark:text-white/60">{{ g.slug }}</span>
            </td>

            <td class="px-4 py-3 hidden md:table-cell text-black/70 dark:text-white/70">
              {{ g.sort_order }}
            </td>

            <td class="px-4 py-3">
                <span
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                    :class="g.is_published
                    ? 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300'
                    : 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'"
                >
                  <span class="h-2 w-2 rounded-full" :class="g.is_published ? 'bg-green-500' : 'bg-red-500'" />
                  {{ g.is_published ? 'Published' : 'Hidden' }}
                </span>
            </td>

            <td class="px-4 py-3 text-right whitespace-nowrap">
              <button
                  type="button"
                  class="btn px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
                  @click="togglePublished(g)"
              >
                {{ g.is_published ? 'Hide' : 'Publish' }}
              </button>

              <button
                  type="button"
                  class="btn px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition ml-2"
                  @click="openEdit(g)"
              >
                Edit
              </button>

              <button
                  type="button"
                  class="btn px-3 py-2 rounded-xl border border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/15 transition ml-2"
                  @click="openDelete(g)"
              >
                Delete
              </button>
            </td>
          </tr>

          <tr v-if="filteredGames.length === 0">
            <td colspan="7" class="px-4 py-10 text-center text-black/60 dark:text-white/60">No games found.</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== Create/Edit Modal ===== -->
    <div v-if="showForm" class="modalOverlay" @keydown.esc.prevent="closeModal" tabindex="0">
      <div class="modalShell" role="dialog" aria-modal="true">
        <div class="modalHeader">
          <div class="min-w-0">
            <div class="text-lg font-semibold text-black dark:text-white">
              {{ isEditing ? 'Edit Game' : 'Create Game' }}
            </div>
            <div class="mt-1 text-xs text-black/60 dark:text-white/60">
              Slug preview: <span class="font-mono">{{ previewSlug || '...' }}</span>
              <span class="mx-2">•</span>
              URL preview: <span class="font-mono">{{ previewPlay }}</span>
            </div>
          </div>

          <button type="button" class="modalClose" @click="closeModal" aria-label="Close modal">✕</button>
        </div>

        <div class="modalBody">
          <!-- Local loading overlay inside modal -->
          <div v-if="saving || uploadingIcon || uploadingFeature" class="loadingOverlay">
            <div class="loadingCard">
              <div class="spinner" />
              <div class="mt-2 text-sm font-semibold text-black dark:text-white">
                <span v-if="saving">Saving…</span>
                <span v-else-if="uploadingIcon">Uploading icon…</span>
                <span v-else>Uploading feature…</span>
              </div>
              <div class="mt-1 text-xs text-black/60 dark:text-white/60">Please don’t close the modal.</div>
            </div>
          </div>

          <div class="modalTopRow">
            <span
                class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                :class="form.is_published
                ? 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300'
                : 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'"
            >
              <span class="h-2 w-2 rounded-full" :class="form.is_published ? 'bg-green-500' : 'bg-red-500'" />
              {{ form.is_published ? 'Published' : 'Hidden' }}
            </span>

            <label class="inline-flex items-center gap-2 text-xs text-black/70 dark:text-white/70">
              <input type="checkbox" v-model="form.is_published" class="checkbox" />
              Show on public catalogue
            </label>
          </div>

          <div class="tabWrap">
            <div class="tabBar">
              <button type="button" class="tabBtn" :class="{ active: activeTab === 'details' }" @click="setTab('details')">
                Details
              </button>
              <button type="button" class="tabBtn" :class="{ active: activeTab === 'media' }" @click="setTab('media')">
                Media
              </button>
            </div>

            <div class="tabPanel">
              <!-- DETAILS TAB -->
              <div v-if="activeTab === 'details'" class="space-y-4">
                <div class="grid gap-2 md:grid-cols-2">
                  <div class="grid gap-2">
                    <label class="text-xs font-semibold text-black/70 dark:text-white/70">Title</label>
                    <input v-model="form.title" class="input" placeholder="e.g. Boss Rush – Neon Arena" />
                  </div>

                  <div class="grid gap-2">
                    <label class="text-xs font-semibold text-black/70 dark:text-white/70">Slug</label>
                    <input
                        v-model="form.slug"
                        class="input"
                        placeholder="boss-rush-neon-arena"
                        @blur="form.slug = normalizeSlug(form.slug || form.title)"
                    />
                    <div class="text-[11px] text-black/60 dark:text-white/60">
                      If empty, it will be generated from Title.
                    </div>
                  </div>
                </div>

                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">Game URL</label>
                  <input v-model="form.url" class="input" placeholder="https://boss-rush.illusionarc.com" />
                </div>

                <div class="grid gap-2 md:grid-cols-2">
                  <div class="grid gap-2">
                    <label class="text-xs font-semibold text-black/70 dark:text-white/70">Platform</label>
                    <input v-model="form.platform" class="input" />
                  </div>
                  <div class="grid gap-2">
                    <label class="text-xs font-semibold text-black/70 dark:text-white/70">Sort order</label>
                    <input v-model.number="form.sort_order" type="number" class="input" />
                  </div>
                </div>

                <div class="grid gap-2 md:grid-cols-2">
                  <div class="grid gap-2">
                    <label class="text-xs font-semibold text-black/70 dark:text-white/70">Genres (comma separated)</label>
                    <input v-model="genreCsv" class="input" placeholder="Arcade, Action, Survival" />
                  </div>
                  <div class="grid gap-2">
                    <label class="text-xs font-semibold text-black/70 dark:text-white/70">Orientation</label>
                    <input v-model="form.orientation" class="input" placeholder="Landscape / Portrait" />
                  </div>
                </div>

                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">Description</label>
                  <textarea v-model="form.description" class="input" rows="5" />
                </div>

                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">Key Features (comma separated)</label>
                  <textarea v-model="featuresCsv" class="input" rows="4" />
                </div>

                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">Mechanics (comma separated)</label>
                  <textarea v-model="mechanicsCsv" class="input" rows="4" />
                  <div class="text-[11px] text-black/60 dark:text-white/60">Optional. Leave empty if not needed.</div>
                </div>

                <div class="grid gap-2 md:grid-cols-2">
                  <div class="grid gap-2">
                    <label class="text-xs font-semibold text-black/70 dark:text-white/70">Controls</label>
                    <input v-model="form.controls" class="input" />
                  </div>
                  <div class="grid gap-2">
                    <label class="text-xs font-semibold text-black/70 dark:text-white/70">Thumbnails link (optional)</label>
                    <input v-model="form.thumbnails_url" class="input" placeholder="https://drive.google.com/..." />
                  </div>
                </div>

                <div class="grid gap-2">
                  <label class="text-xs font-semibold text-black/70 dark:text-white/70">Integration Note</label>
                  <textarea v-model="form.integration_note" class="input" rows="3" />
                </div>
              </div>

              <!-- MEDIA TAB -->
              <div v-else class="space-y-4">
                <div class="panel">
                  <div class="panelHead">
                    <div class="font-semibold text-black dark:text-white">Icon</div>
                    <div class="text-xs text-black/60 dark:text-white/60">
                      Uploads to Storage bucket: <span class="font-mono">{{ BUCKET }}</span>
                    </div>
                  </div>
                  <div class="panelBody space-y-3">
                    <div v-if="form.icon_url" class="mediaRow">
                      <img :src="form.icon_url" class="mediaThumb iconThumb" alt="" />
                      <div class="min-w-0 flex-1">
                        <div class="text-xs text-black/60 dark:text-white/60 break-all font-mono">{{ form.icon_url }}</div>
                      </div>
                      <button type="button" class="btnDangerMini" @click="form.icon_url = null">Clear</button>
                    </div>
                    <input
                        ref="iconInputEl"
                        class="input"
                        type="file"
                        accept="image/*"
                        :disabled="uploadingIcon"
                        @change="onIconPickedAuto"
                    />
                    <div class="text-[11px] text-black/60 dark:text-white/60">
                      Tip: Set Title/Slug first so file path is created correctly.
                    </div>
                  </div>
                </div>

                <div class="panel">
                  <div class="panelHead">
                    <div class="font-semibold text-black dark:text-white">Feature Graphic</div>
                    <div class="text-xs text-black/60 dark:text-white/60">Shown when a game expands on the public catalogue.</div>
                  </div>
                  <div class="panelBody space-y-3">
                    <div v-if="form.feature_graphic_url" class="mediaRow">
                      <img :src="form.feature_graphic_url" class="mediaThumb" alt="" />
                      <div class="min-w-0 flex-1">
                        <div class="text-xs text-black/60 dark:text-white/60 break-all font-mono">
                          {{ form.feature_graphic_url }}
                        </div>
                      </div>
                      <button type="button" class="btnDangerMini" @click="form.feature_graphic_url = null">Clear</button>
                    </div>
                    <input
                        ref="featureInputEl"
                        class="input"
                        type="file"
                        accept="image/*"
                        :disabled="uploadingFeature"
                        @change="onFeaturePickedAuto"
                    />
                  </div>
                </div>

                <div class="panel">
                  <div class="panelHead">
                    <div class="font-semibold text-black dark:text-white">Preview</div>
                    <div class="text-xs text-black/60 dark:text-white/60">Quick look before saving.</div>
                  </div>
                  <div class="panelBody space-y-3">
                    <div class="flex items-center gap-3">
                      <div class="h-12 w-12 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                        <img v-if="form.icon_url" :src="form.icon_url" class="h-full w-full object-cover" alt="" />
                        <div v-else class="h-full w-full grid place-items-center text-black/40 dark:text-white/40">—</div>
                      </div>
                      <div class="min-w-0">
                        <div class="text-sm font-semibold text-black dark:text-white truncate">{{ form.title || 'Untitled Game' }}</div>
                        <div class="text-xs text-black/60 dark:text-white/60 truncate">{{ previewPlay }}</div>
                      </div>
                    </div>
                    <div v-if="form.feature_graphic_url" class="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10">
                      <img :src="form.feature_graphic_url" alt="" class="w-full h-44 object-cover" />
                    </div>
                  </div>
                </div>
              </div>
              <!-- /MEDIA -->
            </div>
          </div>
        </div>

        <div class="modalFooter">
          <button
              type="button"
              class="btn px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
              :disabled="saving || uploadingIcon || uploadingFeature"
              @click="closeModal"
          >
            Close
          </button>

          <button
              type="button"
              class="btn px-4 py-2.5 rounded-2xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition"
              :disabled="saving || uploadingIcon || uploadingFeature"
              @click="saveGame"
          >
            <span v-if="!saving">{{ isEditing ? 'Save changes' : 'Create game' }}</span>
            <span v-else>Saving…</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Delete Modal ===== -->
    <div v-if="showDelete" class="fixed inset-0 z-[9999] grid place-items-center bg-black/55 p-4">
      <div
          class="w-full max-w-md rounded-3xl border border-red-500/20 bg-white dark:bg-[#0b0f1a] shadow-[0_40px_120px_rgba(0,0,0,.35)] overflow-hidden"
      >
        <div class="p-5 border-b border-black/10 dark:border-white/10 bg-red-500/5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold text-black dark:text-white">Delete game?</div>
              <div class="text-xs text-black/60 dark:text-white/60 mt-1">This action cannot be undone.</div>
            </div>
            <button class="btn px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5" @click="closeDelete">
              ✕
            </button>
          </div>
        </div>

        <div class="p-5">
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3">
            <div class="text-sm font-semibold text-black dark:text-white">{{ deleteTarget?.title }}</div>
            <div class="mt-1 text-xs text-black/60 dark:text-white/60 font-mono">{{ deleteTarget?.slug }}</div>
          </div>
        </div>

        <div class="p-5 border-t border-black/10 dark:border-white/10 flex justify-end gap-2">
          <button class="btn px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5" @click="closeDelete">
            Cancel
          </button>
          <button
              class="btn px-4 py-2.5 rounded-2xl border border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/15 transition"
              :disabled="deleting"
              @click="confirmDelete"
          >
            <span v-if="!deleting">Delete</span>
            <span v-else>Deleting…</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Inputs */
.input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.65);
  color: rgba(0, 0, 0, 0.9);
  outline: none;
}
.dark .input {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
}
.input::placeholder {
  color: rgba(0, 0, 0, 0.45);
}
.dark .input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

/* Checkbox */
.checkbox {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.dark .checkbox {
  border-color: rgba(255, 255, 255, 0.2);
}

/* Small danger button */
.btnDangerMini {
  padding: 6px 10px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.1);
  color: rgba(185, 28, 28, 0.95);
  font-size: 12px;
  white-space: nowrap;
}
.dark .btnDangerMini {
  color: rgba(252, 165, 165, 0.95);
}

/* Panels */
.panel {
  border-radius: 22px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.65);
  overflow: hidden;
}
.dark .panel {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}
.panelHead {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.03);
}
.dark .panelHead {
  border-bottom-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}
.panelBody {
  padding: 12px 14px;
}

/* Media rows */
.mediaRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.03);
}
.dark .mediaRow {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}
.mediaThumb {
  width: 70px;
  height: 52px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.03);
}
.iconThumb {
  width: 52px;
  height: 52px;
}
.dark .mediaThumb {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

/* ===== Modal ===== */
.modalOverlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.55);
  padding: 16px;
}
.modalShell {
  width: 100%;
  max-width: 980px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 40px 120px rgba(0, 0, 0, 0.35);
  position: relative;
}
.dark .modalShell {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(11, 15, 26, 0.92);
}
.modalHeader {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
}
.dark .modalHeader {
  border-bottom-color: rgba(255, 255, 255, 0.1);
  background: rgba(11, 15, 26, 0.75);
}
.modalClose {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.05);
  transition: 0.15s;
}
.dark .modalClose {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
}
.modalClose:hover {
  transform: translateY(-1px);
}
.modalBody {
  padding: 16px;
  overflow: auto;
  flex: 1;
}
.modalFooter {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
}
.dark .modalFooter {
  border-top-color: rgba(255, 255, 255, 0.1);
  background: rgba(11, 15, 26, 0.75);
}
.modalTopRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

/* ===== Tabs ===== */
.tabWrap {
  border-radius: 22px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.65);
  overflow: hidden;
}
.dark .tabWrap {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}
.tabBar {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.03);
}
.dark .tabBar {
  border-bottom-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}
.tabBtn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.7);
  color: rgba(0, 0, 0, 0.75);
  font-size: 12px;
  font-weight: 600;
  transition: 0.15s;
}
.dark .tabBtn {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.75);
}
.tabBtn:hover {
  transform: translateY(-1px);
}
.tabBtn.active {
  border-color: rgba(124, 58, 237, 0.35);
  background: rgba(124, 58, 237, 0.12);
  color: rgba(0, 0, 0, 0.9);
}
.dark .tabBtn.active {
  color: rgba(255, 255, 255, 0.92);
  background: rgba(124, 58, 237, 0.18);
  border-color: rgba(124, 58, 237, 0.4);
}
.tabPanel {
  padding: 12px;
}

/* Loading overlay inside modal */
.loadingOverlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
}
.loadingCard {
  width: min(360px, 92%);
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(11, 15, 26, 0.88);
  padding: 16px;
  text-align: center;
}
.spinner {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.22);
  border-top-color: rgba(255, 255, 255, 0.85);
  margin: 0 auto;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>