<!-- app/pages/admin/site.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Site Settings' })

const supabase = useSupabaseClient()
const toast = useToast()

type NavItem = { label: string; to: string; enabled?: boolean }
type LinkItem = { label: string; to: string }

type SiteSettingsRow = {
  id: string
  brand_name: string
  brand_logo_url: string
  header_nav: NavItem[]
  footer_links: LinkItem[]
  footer_legal: LinkItem[]
  footer_tagline: string
  updated_at?: string
}

const FALLBACK: SiteSettingsRow = {
  id: 'global',
  brand_name: 'illusion Arc',
  brand_logo_url: '/android-chrome-512x512.png',
  header_nav: [
    { label: 'Work', to: '/work', enabled: true },
    { label: 'Services', to: '/services', enabled: true },
    { label: 'Arcade', to: '/arcade', enabled: true },
    { label: 'Tournaments', to: '/tournaments', enabled: true },
    { label: 'Apps', to: '/apps', enabled: true },
    { label: 'About', to: '/about', enabled: true },
    { label: 'Leaderboard', to: '/arcade/leaderboard', enabled: true },
    { label: 'Winners', to: '/arcade/winners', enabled: true }
  ],
  footer_links: [
    { label: 'Work', to: '/work' },
    { label: 'Arcade', to: '/arcade' },
    { label: 'Tournaments', to: '/tournaments' },
    { label: 'Contact', to: '/contact' }
  ],
  footer_legal: [
    { label: 'Privacy Policy', to: '/privacy-policy' },
    { label: 'Terms & Conditions', to: '/terms' }
  ],
  footer_tagline: 'Games • AR/VR • VFX/CGI • Animation'
}

const loading = ref(true)
const saving = ref(false)

// We edit a local draft then save
const draft = ref<SiteSettingsRow>(structuredClone(FALLBACK))

function normalizeNav(v: any): NavItem[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => ({
      label: String(x?.label || '').trim(),
      to: String(x?.to || '').trim(),
      enabled: x?.enabled === false ? false : true
    }))
    .filter((x) => x.label && x.to)
}

function normalizeLinks(v: any): LinkItem[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => ({
      label: String(x?.label || '').trim(),
      to: String(x?.to || '').trim()
    }))
    .filter((x) => x.label && x.to)
}

async function load() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('id, brand_name, brand_logo_url, header_nav, footer_links, footer_legal, footer_tagline, updated_at')
      .eq('id', 'global')
      .single()

    if (error) {
      // If row missing, fallback stays
      draft.value = structuredClone(FALLBACK)
      return
    }

    draft.value = {
      id: data.id ?? 'global',
      brand_name: String(data.brand_name ?? FALLBACK.brand_name),
      brand_logo_url: String(data.brand_logo_url ?? FALLBACK.brand_logo_url),
      header_nav: normalizeNav(data.header_nav ?? FALLBACK.header_nav),
      footer_links: normalizeLinks(data.footer_links ?? FALLBACK.footer_links),
      footer_legal: normalizeLinks(data.footer_legal ?? FALLBACK.footer_legal),
      footer_tagline: String(data.footer_tagline ?? FALLBACK.footer_tagline),
      updated_at: data.updated_at ?? undefined
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ---------- UI actions ---------- */
function addNav() {
  draft.value.header_nav.push({ label: 'New', to: '/', enabled: true })
}
function removeNav(i: number) {
  draft.value.header_nav.splice(i, 1)
}
function addFooterLink() {
  draft.value.footer_links.push({ label: 'New', to: '/' })
}
function removeFooterLink(i: number) {
  draft.value.footer_links.splice(i, 1)
}
function addLegalLink() {
  draft.value.footer_legal.push({ label: 'New', to: '/' })
}
function removeLegalLink(i: number) {
  draft.value.footer_legal.splice(i, 1)
}

function validateBeforeSave() {
  const bn = draft.value.brand_name.trim()
  if (!bn) return 'Brand name is required.'

  const bl = draft.value.brand_logo_url.trim()
  if (!bl) return 'Brand logo URL is required.'

  if (!draft.value.footer_tagline.trim()) return 'Footer tagline is required.'

  // Ensure header nav entries are valid
  for (const n of draft.value.header_nav) {
    if (!n.label?.trim() || !n.to?.trim()) return 'Header nav items must have label + to.'
  }
  for (const l of draft.value.footer_links) {
    if (!l.label?.trim() || !l.to?.trim()) return 'Footer links must have label + to.'
  }
  for (const l of draft.value.footer_legal) {
    if (!l.label?.trim() || !l.to?.trim()) return 'Legal links must have label + to.'
  }
  return null
}

async function save() {
  const err = validateBeforeSave()
  if (err) {
    toast.add({ title: 'Fix required', description: err, color: 'error' })
    return
  }

  saving.value = true
  try {
    const payload = {
      id: 'global',
      brand_name: draft.value.brand_name.trim(),
      brand_logo_url: draft.value.brand_logo_url.trim(),
      header_nav: draft.value.header_nav.map((x) => ({
        label: x.label.trim(),
        to: x.to.trim(),
        enabled: x.enabled !== false
      })),
      footer_links: draft.value.footer_links.map((x) => ({ label: x.label.trim(), to: x.to.trim() })),
      footer_legal: draft.value.footer_legal.map((x) => ({ label: x.label.trim(), to: x.to.trim() })),
      footer_tagline: draft.value.footer_tagline.trim()
    }

    const { error } = await supabase.from('site_settings').upsert(payload, { onConflict: 'id' })
    if (error) throw error

    toast.add({ title: 'Saved', description: 'Site settings updated.', color: 'success' })

    // Optional: refresh composable cache if you use it elsewhere
    try {
      const { refresh } = useSiteSettings()
      await refresh()
    } catch {}
  } catch (e: any) {
    toast.add({ title: 'Save failed', description: e?.message || 'Unknown error', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UContainer class="py-10">
    <div class="flex items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl md:text-3xl font-semibold">Site Settings</h1>
        <p class="mt-2 text-black/60 dark:text-white/60">
          Manage branding, header nav, and footer links used across the site.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UButton variant="soft" :loading="loading" @click="load">Reload</UButton>
        <UButton color="primary" :loading="saving" @click="save">Save</UButton>
      </div>
    </div>

    <div v-if="loading" class="mt-8 text-sm text-black/60 dark:text-white/60">
      Loading settings…
    </div>

    <div v-else class="mt-8 grid gap-6">
      <!-- Branding -->
      <UCard class="border border-black/10 dark:border-white/10" :ui="{ body: 'p-5' }">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">Branding</h2>
          <div class="text-xs text-black/50 dark:text-white/50">id: global</div>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label class="text-sm text-black/70 dark:text-white/70">Brand name</label>
            <UInput v-model="draft.brand_name" placeholder="illusion Arc" class="mt-1" />
          </div>

          <div>
            <label class="text-sm text-black/70 dark:text-white/70">Logo URL</label>
            <UInput v-model="draft.brand_logo_url" placeholder="/android-chrome-512x512.png" class="mt-1" />
            <div class="mt-2 flex items-center gap-2">
              <div class="h-10 w-10 rounded border border-black/10 dark:border-white/10 overflow-hidden bg-black/5 dark:bg-white/5">
                <img :src="draft.brand_logo_url" alt="Preview" class="h-full w-full object-contain" />
              </div>
              <div class="text-xs text-black/50 dark:text-white/50">Preview</div>
            </div>
          </div>

          <div class="md:col-span-2">
            <label class="text-sm text-black/70 dark:text-white/70">Footer tagline</label>
            <UInput v-model="draft.footer_tagline" placeholder="Games • AR/VR • VFX/CGI • Animation" class="mt-1" />
          </div>
        </div>
      </UCard>

      <!-- Header nav -->
      <UCard class="border border-black/10 dark:border-white/10" :ui="{ body: 'p-5' }">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">Header Navigation</h2>
          <UButton variant="soft" size="sm" @click="addNav">Add item</UButton>
        </div>

        <div class="mt-4 grid gap-3">
          <div
            v-for="(n, i) in draft.header_nav"
            :key="i"
            class="grid gap-3 md:grid-cols-[1.2fr_1.6fr_.6fr_auto] items-end p-3 rounded-lg
                   border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5"
          >
            <div>
              <label class="text-xs text-black/60 dark:text-white/60">Label</label>
              <UInput v-model="n.label" placeholder="Work" class="mt-1" />
            </div>

            <div>
              <label class="text-xs text-black/60 dark:text-white/60">Route</label>
              <UInput v-model="n.to" placeholder="/work" class="mt-1" />
            </div>

            <div class="flex items-center gap-2 md:justify-center">
              <UCheckbox v-model="n.enabled" />
              <span class="text-xs text-black/60 dark:text-white/60">Enabled</span>
            </div>

            <div class="flex md:justify-end">
              <UButton color="red" variant="soft" size="sm" @click="removeNav(i)">Remove</UButton>
            </div>
          </div>

          <div v-if="draft.header_nav.length === 0" class="text-sm text-black/60 dark:text-white/60">
            No nav items. Add at least one.
          </div>
        </div>
      </UCard>

      <!-- Footer links -->
      <div class="grid gap-6 md:grid-cols-2">
        <UCard class="border border-black/10 dark:border-white/10" :ui="{ body: 'p-5' }">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">Footer Links</h2>
            <UButton variant="soft" size="sm" @click="addFooterLink">Add</UButton>
          </div>

          <div class="mt-4 grid gap-3">
            <div
              v-for="(l, i) in draft.footer_links"
              :key="i"
              class="grid gap-3 md:grid-cols-[1.1fr_1.6fr_auto] items-end p-3 rounded-lg
                     border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5"
            >
              <div>
                <label class="text-xs text-black/60 dark:text-white/60">Label</label>
                <UInput v-model="l.label" placeholder="Work" class="mt-1" />
              </div>

              <div>
                <label class="text-xs text-black/60 dark:text-white/60">Route</label>
                <UInput v-model="l.to" placeholder="/work" class="mt-1" />
              </div>

              <div class="flex md:justify-end">
                <UButton color="red" variant="soft" size="sm" @click="removeFooterLink(i)">Remove</UButton>
              </div>
            </div>

            <div v-if="draft.footer_links.length === 0" class="text-sm text-black/60 dark:text-white/60">
              No footer links.
            </div>
          </div>
        </UCard>

        <UCard class="border border-black/10 dark:border-white/10" :ui="{ body: 'p-5' }">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">Legal Links</h2>
            <UButton variant="soft" size="sm" @click="addLegalLink">Add</UButton>
          </div>

          <div class="mt-4 grid gap-3">
            <div
              v-for="(l, i) in draft.footer_legal"
              :key="i"
              class="grid gap-3 md:grid-cols-[1.1fr_1.6fr_auto] items-end p-3 rounded-lg
                     border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5"
            >
              <div>
                <label class="text-xs text-black/60 dark:text-white/60">Label</label>
                <UInput v-model="l.label" placeholder="Privacy Policy" class="mt-1" />
              </div>

              <div>
                <label class="text-xs text-black/60 dark:text-white/60">Route</label>
                <UInput v-model="l.to" placeholder="/privacy-policy" class="mt-1" />
              </div>

              <div class="flex md:justify-end">
                <UButton color="red" variant="soft" size="sm" @click="removeLegalLink(i)">Remove</UButton>
              </div>
            </div>

            <div v-if="draft.footer_legal.length === 0" class="text-sm text-black/60 dark:text-white/60">
              No legal links.
            </div>
          </div>
        </UCard>
      </div>

      <!-- Save bar -->
      <div class="flex items-center justify-end gap-2">
        <UButton variant="soft" @click="load">Reset</UButton>
        <UButton color="primary" :loading="saving" @click="save">Save changes</UButton>
      </div>
    </div>
  </UContainer>
</template>
