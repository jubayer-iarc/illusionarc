<!-- app/pages/admin/tournament-prizes.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Tournament Prizes' })

const supabase = useSupabaseClient()
const toast = useToast()

type PrizeRow = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  image_path: string | null
  created_at?: string
  updated_at?: string
}

const PRIZE_BUCKET = 'tournament-prizes'

const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const errorMsg = ref<string | null>(null)

const q = ref('')
const rows = ref<PrizeRow[]>([])
const selectedId = ref<string | null>(null)

const form = reactive({
  id: '',
  title: '',
  description: '',
  image_url: '',
  image_path: ''
})

const isEditing = computed(() => Boolean(form.id))

const imageFile = ref<File | null>(null)
const imagePreview = ref('')
const imageInputEl = ref<HTMLInputElement | null>(null)

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

async function setImageFile(file: File | null) {
  imageFile.value = file
  imagePreview.value = ''
  if (file) {
    try {
      imagePreview.value = await fileToDataUrl(file)
    } catch {
      imagePreview.value = ''
    }
  }
}

async function onImagePick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0] || null
  await setImageFile(file)
  if (input) input.value = ''
}

function clearImageSelection() {
  setImageFile(null)
  if (imageInputEl.value) imageInputEl.value.value = ''
}

const effectiveImageUrl = computed(() => imagePreview.value || form.image_url || '')

function fmt(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString()
}

function resetForm() {
  selectedId.value = null
  form.id = ''
  form.title = ''
  form.description = ''
  form.image_url = ''
  form.image_path = ''
  clearImageSelection()
}

function selectRow(id: string) {
  selectedId.value = id
  const row = rows.value.find((x) => x.id === id)
  if (!row) return

  form.id = row.id
  form.title = row.title || ''
  form.description = row.description || ''
  form.image_url = row.image_url || ''
  form.image_path = row.image_path || ''
  clearImageSelection()
}

async function loadRows() {
  loading.value = true
  errorMsg.value = null

  try {
    let db = supabase
      .from('tournament_prizes')
      .select('id, title, description, image_url, image_path, created_at, updated_at')
      .order('updated_at', { ascending: false })

    const query = q.value.trim()
    if (query) {
      db = db.or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    }

    const { data, error } = await db
    if (error) throw error

    rows.value = (data || []) as PrizeRow[]
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load prize library'
    rows.value = []
  } finally {
    loading.value = false
  }
}

async function uploadImageAndGetMeta() {
  if (!imageFile.value) return null

  uploading.value = true
  try {
    const safeName = imageFile.value.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `library/${Date.now()}-${safeName}`

    const { error: upErr } = await supabase.storage.from(PRIZE_BUCKET).upload(path, imageFile.value, {
      upsert: true,
      contentType: imageFile.value.type
    })
    if (upErr) throw upErr

    const { data } = supabase.storage.from(PRIZE_BUCKET).getPublicUrl(path)
    return {
      path,
      url: String(data?.publicUrl || '')
    }
  } finally {
    uploading.value = false
  }
}

async function savePrize() {
  if (!form.title.trim()) {
    toast.add({ title: 'Title required', color: 'error' })
    return
  }

  saving.value = true
  try {
    let nextImageUrl = form.image_url || null
    let nextImagePath = form.image_path || null

    if (imageFile.value) {
      const uploaded = await uploadImageAndGetMeta()
      if (!uploaded?.url) throw new Error('Image upload failed')

      if (form.image_path) {
        try {
          await supabase.storage.from(PRIZE_BUCKET).remove([form.image_path])
        } catch {}
      }

      nextImageUrl = uploaded.url
      nextImagePath = uploaded.path
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: nextImageUrl,
      image_path: nextImagePath
    }

    if (form.id) {
      const { error } = await supabase
        .from('tournament_prizes')
        .update(payload)
        .eq('id', form.id)

      if (error) throw error
      toast.add({ title: 'Prize updated', color: 'success' })
    } else {
      const { data, error } = await supabase
        .from('tournament_prizes')
        .insert(payload)
        .select('id')
        .maybeSingle()

      if (error) throw error

      const newId = String((data as any)?.id || '')
      if (newId) form.id = newId

      toast.add({ title: 'Prize created', color: 'success' })
    }

    clearImageSelection()
    await loadRows()

    if (form.id) {
      selectRow(form.id)
    }
  } catch (e: any) {
    toast.add({
      title: 'Save failed',
      description: e?.message || 'Try again',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

async function clearStoredImage() {
  try {
    if (form.image_path) {
      try {
        await supabase.storage.from(PRIZE_BUCKET).remove([form.image_path])
      } catch {}
    }

    form.image_url = ''
    form.image_path = ''

    if (form.id) {
      const { error } = await supabase
        .from('tournament_prizes')
        .update({
          image_url: null,
          image_path: null
        })
        .eq('id', form.id)

      if (error) throw error
      await loadRows()
      selectRow(form.id)
    }

    toast.add({ title: 'Image removed', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: 'Could not remove image',
      description: e?.message || '',
      color: 'error'
    })
  }
}

async function deletePrize(row: PrizeRow) {
  const ok = confirm(`Delete "${row.title}" from the prize library?`)
  if (!ok) return

  loading.value = true
  try {
    if (row.image_path) {
      try {
        await supabase.storage.from(PRIZE_BUCKET).remove([row.image_path])
      } catch {}
    }

    const { error } = await supabase.from('tournament_prizes').delete().eq('id', row.id)
    if (error) throw error

    if (selectedId.value === row.id) {
      resetForm()
    }

    toast.add({ title: 'Prize deleted', color: 'success' })
    await loadRows()
  } catch (e: any) {
    toast.add({
      title: 'Delete failed',
      description: e?.message || '',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

const reloadDebounced = debounce(() => {
  loadRows().catch(() => {})
}, 250)

watch(q, () => reloadDebounced())

onMounted(async () => {
  resetForm()
  await loadRows()
})
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[380px_1fr]">
    <!-- LEFT: LIST -->
    <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur overflow-hidden">
      <div class="p-4 border-b border-black/10 dark:border-white/10">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs opacity-70">Admin</div>
            <div class="text-lg font-extrabold tracking-tight">Tournament Prize Library</div>
          </div>

          <div class="flex gap-2">
            <UButton size="xs" variant="soft" class="!rounded-full" :loading="loading" @click="loadRows()">
              Refresh
            </UButton>
            <UButton size="xs" class="!rounded-full" @click="resetForm()">
              New
            </UButton>
          </div>
        </div>

        <div class="mt-3 space-y-2">
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
            <input
              v-model="q"
              class="w-full bg-transparent text-sm outline-none"
              placeholder="Search prize title / description…"
            />
          </div>

          <div v-if="errorMsg" class="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm">
            {{ errorMsg }}
          </div>
        </div>
      </div>

      <div class="max-h-[calc(100vh-220px)] overflow-auto divide-y divide-black/10 dark:divide-white/10">
        <button
          v-for="r in rows"
          :key="r.id"
          class="w-full text-left p-4 hover:bg-black/5 dark:hover:bg-white/5 transition"
          :class="selectedId === r.id ? 'bg-black/5 dark:bg-white/5' : ''"
          @click="selectRow(r.id)"
        >
          <div class="flex items-start gap-3">
            <div class="h-14 w-14 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <img
                v-if="r.image_url"
                :src="r.image_url"
                :alt="r.title"
                class="h-full w-full object-cover"
              />
              <div v-else class="h-full w-full grid place-items-center text-[10px] opacity-60">
                No image
              </div>
            </div>

            <div class="min-w-0 flex-1">
              <div class="font-semibold truncate">{{ r.title }}</div>
              <div v-if="r.description" class="mt-1 text-xs opacity-70 line-clamp-2">
                {{ r.description }}
              </div>
              <div class="mt-2 text-[11px] opacity-60">
                Updated: {{ fmt(r.updated_at || r.created_at) }}
              </div>
            </div>
          </div>
        </button>

        <div v-if="!loading && rows.length === 0" class="p-6 text-sm opacity-70">
          No prize library items found.
        </div>
      </div>
    </div>

    <!-- RIGHT: EDITOR -->
    <div class="space-y-4">
      <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-xs opacity-70">Editor</div>
            <div class="text-2xl font-extrabold tracking-tight">
              {{ isEditing ? 'Edit Prize' : 'Create Prize' }}
            </div>
            <div class="mt-1 text-sm opacity-70" v-if="form.id">
              ID: <span class="font-mono">{{ form.id.slice(0, 8) }}…</span>
            </div>
          </div>

          <div class="flex gap-2">
            <UButton
              class="!rounded-full"
              :loading="saving || uploading"
              @click="savePrize"
            >
              {{ isEditing ? 'Save' : 'Create' }}
            </UButton>

            <UButton
              v-if="form.id"
              color="error"
              variant="soft"
              class="!rounded-full"
              :loading="loading"
              @click="deletePrize({ id: form.id, title: form.title, description: form.description || null, image_url: form.image_url || null, image_path: form.image_path || null })"
            >
              Delete
            </UButton>
          </div>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-[1fr_360px]">
        <!-- FORM -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <div class="font-semibold">Prize Details</div>

          <div class="mt-4 grid gap-4">
            <div class="grid gap-2">
              <label class="text-xs opacity-70">Prize title</label>
              <input
                v-model="form.title"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                placeholder="e.g. Gaming Mouse / Cash Prize ৳500 / Premium Headset"
              />
            </div>

            <div class="grid gap-2">
              <label class="text-xs opacity-70">Description (optional)</label>
              <textarea
                v-model="form.description"
                rows="5"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2 outline-none"
                placeholder="Short reusable prize description"
              />
            </div>

            <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="font-semibold text-sm">Usage notes</div>
              <ul class="mt-3 space-y-2 text-sm opacity-75">
                <li>• This page creates reusable prize items for all tournaments.</li>
                <li>• Rank is not stored here. Rank is assigned inside each tournament.</li>
                <li>• The same prize can be reused across multiple tournaments.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- IMAGE -->
        <div class="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <div class="flex items-start justify-between">
            <div>
              <div class="font-semibold">Prize Image</div>
              <div class="text-xs opacity-70">Upload image and save prize</div>
            </div>
            <div class="text-xs opacity-70" v-if="uploading">Uploading…</div>
          </div>

          <div class="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <div class="aspect-square bg-black/20 grid place-items-center">
              <img
                v-if="effectiveImageUrl"
                :key="effectiveImageUrl"
                :src="effectiveImageUrl"
                class="h-full w-full object-cover"
                alt="Prize image preview"
              />
              <div v-else class="text-xs opacity-60">No image</div>
            </div>
          </div>

          <div v-if="imageFile" class="mt-2 text-xs opacity-70">
            Selected: <span class="font-mono">{{ imageFile.name }}</span>
          </div>

          <div class="mt-4 space-y-3">
            <input
              ref="imageInputEl"
              type="file"
              accept="image/*"
              @change="onImagePick"
            />

            <div class="flex flex-wrap gap-2">
              <UButton
                variant="soft"
                class="!rounded-full"
                :disabled="!imageFile"
                @click="clearImageSelection"
              >
                Clear Selection
              </UButton>

              <UButton
                v-if="form.image_url"
                color="error"
                variant="soft"
                class="!rounded-full"
                @click="clearStoredImage"
              >
                Remove Stored Image
              </UButton>
            </div>

            <div class="text-xs opacity-60">
              Bucket: <span class="font-mono">{{ PRIZE_BUCKET }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>