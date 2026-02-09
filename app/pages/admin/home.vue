<!-- app/pages/admin/home.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin']
})

useHead({ title: 'Admin — Home Page' })

const supabase = useSupabaseClient()
const toast = useToast()

/* ---------------- Types ---------------- */
type HeroVariant = 'solid' | 'outline' | 'ghost'
type HeroCTA = { label: string; to: string; variant: HeroVariant; color?: string }
type HeroStat = { k: string; v: string }
type HeroData = { headline: string; subhead: string; ctas: HeroCTA[]; stats: HeroStat[] }

type Testimonial = { name: string; text: string }
type TestimonialsData = { title: string; subtitle: string; items: Testimonial[] }

/* ---------------- Defaults ---------------- */
const HERO_FALLBACK: HeroData = {
  headline: 'We build games & immersive realities.',
  subhead: 'From web to VR — interactive experiences that feel alive.',
  ctas: [
    { label: 'Start a Project', to: '/contact', variant: 'solid', color: 'primary' },
    { label: 'View Work', to: '/work', variant: 'outline' },
    { label: 'Play Games', to: '/arcade', variant: 'ghost' }
  ],
  stats: [
    { k: '60fps feel', v: 'Micro-interactions' },
    { k: 'Web → VR', v: 'Cross-platform builds' },
    { k: 'Embeddable', v: 'Game portal system' }
  ]
}

const TESTIMONIALS_FALLBACK: TestimonialsData = {
  title: 'Testimonials',
  subtitle: 'Dummy for now — we’ll replace with real quotes.',
  items: [
    { name: 'Client A', text: 'Polished delivery and great iteration speed.' },
    { name: 'Client B', text: 'The experience feels premium and fast.' },
    { name: 'Client C', text: 'Strong UI/UX + clean build pipeline.' }
  ]
}

/* ---------------- State ---------------- */
const loading = ref(true)
const saving = ref(false)
const dirty = ref(false)

const hero = ref<HeroData>(structuredClone(HERO_FALLBACK))
const testimonials = ref<TestimonialsData>(structuredClone(TESTIMONIALS_FALLBACK))

const heroPublished = ref(true)
const testimonialsPublished = ref(true)

const heroUpdatedAt = ref<string | null>(null)
const testimonialsUpdatedAt = ref<string | null>(null)

/* ✅ FIX: Selection "No data"
   Use simple string options for USelectMenu to avoid Nuxt UI option-attribute mismatch. */
const variantOptions: HeroVariant[] = ['solid', 'outline', 'ghost']
const variantLabel = (v: HeroVariant) => (v === 'solid' ? 'Solid' : v === 'outline' ? 'Outline' : 'Ghost')

/* ---------------- Helpers ---------------- */
function markDirty() {
  dirty.value = true
}

function normalizeVariant(v: any): HeroVariant {
  return v === 'outline' || v === 'ghost' || v === 'solid' ? v : 'solid'
}

function normalizeHero(x: any): HeroData {
  const safe: HeroData = structuredClone(HERO_FALLBACK)
  if (!x || typeof x !== 'object') return safe

  if (typeof x.headline === 'string' && x.headline.trim()) safe.headline = x.headline
  if (typeof x.subhead === 'string' && x.subhead.trim()) safe.subhead = x.subhead

  if (Array.isArray(x.ctas)) {
    const ctas = x.ctas
      .map((c: any) => ({
        label: String(c?.label || '').trim(),
        to: String(c?.to || '').trim(),
        variant: normalizeVariant(c?.variant),
        color: typeof c?.color === 'string' ? String(c.color).trim() : undefined
      }))
      .filter((c: any) => c.label && c.to)

    if (ctas.length) safe.ctas = ctas
  }

  if (Array.isArray(x.stats)) {
    const stats = x.stats
      .map((s: any) => ({ k: String(s?.k || '').trim(), v: String(s?.v || '').trim() }))
      .filter((s: any) => s.k && s.v)

    if (stats.length) safe.stats = stats
  }

  return safe
}

function normalizeTestimonials(x: any): TestimonialsData {
  const safe: TestimonialsData = structuredClone(TESTIMONIALS_FALLBACK)
  if (!x || typeof x !== 'object') return safe

  if (typeof x.title === 'string' && x.title.trim()) safe.title = x.title
  if (typeof x.subtitle === 'string' && x.subtitle.trim()) safe.subtitle = x.subtitle

  if (Array.isArray(x.items)) {
    const items = x.items
      .map((t: any) => ({ name: String(t?.name || '').trim(), text: String(t?.text || '').trim() }))
      .filter((t: any) => t.name && t.text)

    if (items.length) safe.items = items
  }

  return safe
}

function validateRoutes(to: string) {
  const t = (to || '').trim()
  if (!t) return false
  if (t.startsWith('/')) return true
  if (t.startsWith('http://') || t.startsWith('https://')) return true
  if (t.startsWith('mailto:') || t.startsWith('tel:')) return true
  return false
}

function validateHero(): string | null {
  if (!hero.value.headline?.trim()) return 'Hero headline is required.'
  if (!hero.value.subhead?.trim()) return 'Hero subhead is required.'
  if (!hero.value.ctas?.length) return 'Add at least 1 CTA.'
  if (!hero.value.stats?.length) return 'Add at least 1 stat.'

  for (const c of hero.value.ctas) {
    if (!c.label?.trim()) return 'CTA label is required.'
    if (!validateRoutes(c.to)) return `CTA route invalid: "${c.to}". Use /path or https://...`
    c.variant = normalizeVariant(c.variant)
  }
  for (const s of hero.value.stats) {
    if (!s.k?.trim() || !s.v?.trim()) return 'Each stat must have both fields.'
  }
  return null
}

function validateTestimonials(): string | null {
  if (!testimonials.value.title?.trim()) return 'Testimonials title is required.'
  if (!testimonials.value.subtitle?.trim()) return 'Testimonials subtitle is required.'
  if (!testimonials.value.items?.length) return 'Add at least 1 testimonial.'
  for (const t of testimonials.value.items) {
    if (!t.name?.trim() || !t.text?.trim()) return 'Each testimonial must have name + quote.'
  }
  return null
}

/* ---------------- Load ---------------- */
async function load() {
  loading.value = true
  dirty.value = false
  try {
    const { data, error } = await supabase
      .from('page_sections')
      .select('section_key, data, is_published, updated_at')
      .eq('page', 'home')
      .in('section_key', ['hero', 'testimonials'])

    if (error) throw error

    // Reset to defaults
    hero.value = structuredClone(HERO_FALLBACK)
    testimonials.value = structuredClone(TESTIMONIALS_FALLBACK)
    heroPublished.value = true
    testimonialsPublished.value = true
    heroUpdatedAt.value = null
    testimonialsUpdatedAt.value = null

    for (const row of data || []) {
      if (row.section_key === 'hero') {
        hero.value = normalizeHero(row.data)
        heroPublished.value = row.is_published !== false
        heroUpdatedAt.value = row.updated_at || null
      }
      if (row.section_key === 'testimonials') {
        testimonials.value = normalizeTestimonials(row.data)
        testimonialsPublished.value = row.is_published !== false
        testimonialsUpdatedAt.value = row.updated_at || null
      }
    }
  } catch (e: any) {
    toast.add({ title: 'Load failed', description: e?.message || 'Unknown error', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ---------------- Save ---------------- */
async function saveAll() {
  const e1 = validateHero()
  if (e1) return toast.add({ title: 'Fix Hero', description: e1, color: 'error' })

  const e2 = validateTestimonials()
  if (e2) return toast.add({ title: 'Fix Testimonials', description: e2, color: 'error' })

  saving.value = true
  try {
    const payload = [
      {
        page: 'home',
        section_key: 'hero',
        data: {
          headline: hero.value.headline.trim(),
          subhead: hero.value.subhead.trim(),
          ctas: hero.value.ctas.map((c) => ({
            label: c.label.trim(),
            to: c.to.trim(),
            variant: normalizeVariant(c.variant),
            color: normalizeVariant(c.variant) === 'solid' ? (c.color?.trim() || 'primary') : undefined
          })),
          stats: hero.value.stats.map((s) => ({ k: s.k.trim(), v: s.v.trim() }))
        },
        is_published: heroPublished.value
      },
      {
        page: 'home',
        section_key: 'testimonials',
        data: {
          title: testimonials.value.title.trim(),
          subtitle: testimonials.value.subtitle.trim(),
          items: testimonials.value.items.map((t) => ({ name: t.name.trim(), text: t.text.trim() }))
        },
        is_published: testimonialsPublished.value
      }
    ]

    const { error } = await supabase.from('page_sections').upsert(payload, { onConflict: 'page,section_key' })
    if (error) throw error

    toast.add({ title: 'Saved', description: 'Home page updated.', color: 'success' })
    dirty.value = false
    await load()
  } catch (e: any) {
    toast.add({ title: 'Save failed', description: e?.message || 'Unknown error', color: 'error' })
  } finally {
    saving.value = false
  }
}

/* ---------------- Actions ---------------- */
function resetToFallback() {
  hero.value = structuredClone(HERO_FALLBACK)
  testimonials.value = structuredClone(TESTIMONIALS_FALLBACK)
  heroPublished.value = true
  testimonialsPublished.value = true
  markDirty()
  toast.add({ title: 'Reset', description: 'Restored defaults (not saved yet).', color: 'warning' })
}

function addHeroCta() {
  hero.value.ctas.push({ label: 'New Button', to: '/', variant: 'outline' })
  markDirty()
}
function removeHeroCta(i: number) {
  hero.value.ctas.splice(i, 1)
  markDirty()
}
function addHeroStat() {
  hero.value.stats.push({ k: 'New', v: 'Description' })
  markDirty()
}
function removeHeroStat(i: number) {
  hero.value.stats.splice(i, 1)
  markDirty()
}
function addTestimonial() {
  testimonials.value.items.push({ name: 'Client', text: 'Write a quote…' })
  markDirty()
}
function removeTestimonial(i: number) {
  testimonials.value.items.splice(i, 1)
  markDirty()
}
function moveUp<T>(arr: T[], i: number) {
  if (i <= 0) return
  const tmp = arr[i - 1]
  arr[i - 1] = arr[i]
  arr[i] = tmp
  markDirty()
}
function moveDown<T>(arr: T[], i: number) {
  if (i >= arr.length - 1) return
  const tmp = arr[i + 1]
  arr[i + 1] = arr[i]
  arr[i] = tmp
  markDirty()
}

/* mark dirty on any edit (reliable) */
watch(hero, markDirty, { deep: true })
watch(testimonials, markDirty, { deep: true })
watch([heroPublished, testimonialsPublished], markDirty)
</script>

<template>
  <UContainer class="py-10">
    <!-- Top bar (single save button) -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl md:text-3xl font-semibold">Home Page</h1>
        <p class="mt-1 text-sm text-black/60 dark:text-white/60">
          Manage <span class="font-semibold">Hero</span> and <span class="font-semibold">Testimonials</span> from Supabase.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UBadge v-if="dirty" color="orange" variant="soft">Unsaved changes</UBadge>
        <UButton variant="soft" :loading="loading" @click="load">Reload</UButton>
        <UButton variant="soft" color="orange" @click="resetToFallback">Reset</UButton>
        <UButton color="primary" :loading="saving" @click="saveAll">Save</UButton>
      </div>
    </div>

    <div v-if="loading" class="mt-8 text-sm text-black/60 dark:text-white/60">Loading…</div>

    <div v-else class="mt-8 grid gap-6">
      <!-- HERO (full width, no empty right side) -->
      <UCard class="border border-black/10 dark:border-white/10 overflow-hidden" :ui="{ body: 'p-0' }">
        <div class="p-6 border-b border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold">Hero</h2>
                <UBadge variant="soft">home / hero</UBadge>
              </div>
              <div class="mt-1 text-xs text-black/50 dark:text-white/50">
                <span v-if="heroUpdatedAt">Last updated: {{ heroUpdatedAt }}</span>
                <span v-else>No saved record yet</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UCheckbox v-model="heroPublished" />
              <span class="text-sm text-black/70 dark:text-white/70">Published</span>
            </div>
          </div>
        </div>

        <div class="p-6 grid gap-6">
          <div class="grid gap-4">
            <div>
              <div class="text-sm font-semibold text-black/80 dark:text-white/80">Headline</div>
              <UTextarea
                v-model="hero.headline"
                class="mt-2 w-full"
                :rows="4"
                placeholder="We build games & immersive realities."
                :ui="{ base: 'w-full min-h-[140px]' }"
              />
            </div>

            <div>
              <div class="text-sm font-semibold text-black/80 dark:text-white/80">Subhead</div>
              <UTextarea
                v-model="hero.subhead"
                class="mt-2 w-full"
                :rows="4"
                placeholder="From web to VR — interactive experiences that feel alive."
                :ui="{ base: 'w-full min-h-[140px]' }"
              />
            </div>
          </div>

          <!-- CTAs -->
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="font-semibold">CTA Buttons</div>
                <div class="text-xs text-black/50 dark:text-white/50">Shown left → right</div>
              </div>
              <UButton variant="soft" size="sm" @click="addHeroCta">Add CTA</UButton>
            </div>

            <div class="mt-4 grid gap-4">
              <div
                v-for="(c, i) in hero.ctas"
                :key="i"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="text-sm font-semibold">CTA #{{ i + 1 }}</div>
                  <div class="flex items-center gap-2">
                    <UButton variant="soft" size="xs" :disabled="i === 0" @click="moveUp(hero.ctas, i)">Up</UButton>
                    <UButton variant="soft" size="xs" :disabled="i === hero.ctas.length - 1" @click="moveDown(hero.ctas, i)">Down</UButton>
                    <UButton color="red" variant="soft" size="xs" @click="removeHeroCta(i)">Remove</UButton>
                  </div>
                </div>

                <div class="mt-4 grid gap-4 md:grid-cols-2">
                  <div class="md:col-span-1">
                    <label class="text-xs text-black/60 dark:text-white/60">Label</label>
                    <UInput v-model="c.label" class="mt-1 w-full" placeholder="Start a Project" />
                  </div>

                  <div class="md:col-span-1">
                    <label class="text-xs text-black/60 dark:text-white/60">Route / URL</label>
                    <UInput v-model="c.to" class="mt-1 w-full" placeholder="/contact or https://..." />
                  </div>

                  <div class="md:col-span-1">
                    <label class="text-xs text-black/60 dark:text-white/60">Variant</label>

                    <!-- ✅ WORKING: options are simple strings, so it will never show "No data" -->
                    <USelectMenu v-model="c.variant" :options="variantOptions" class="mt-1 w-full">
                      <template #label>
                        <span>{{ variantLabel(c.variant) }}</span>
                      </template>
                      <template #option="{ option }">
                        <span class="capitalize">{{ variantLabel(option) }}</span>
                      </template>
                    </USelectMenu>
                  </div>

                  <div class="md:col-span-1">
                    <label class="text-xs text-black/60 dark:text-white/60">Color (Solid only)</label>
                    <UInput
                      v-model="c.color"
                      class="mt-1 w-full"
                      placeholder="primary"
                      :disabled="c.variant !== 'solid'"
                    />
                    <div class="mt-1 text-xs text-black/45 dark:text-white/45">
                      If empty, solid uses <code>primary</code>.
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="hero.ctas.length === 0" class="text-sm text-black/60 dark:text-white/60">
                Add at least 1 CTA.
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="font-semibold">Stats Cards</div>
                <div class="text-xs text-black/50 dark:text-white/50">Shown left → right</div>
              </div>
              <UButton variant="soft" size="sm" @click="addHeroStat">Add Stat</UButton>
            </div>

            <div class="mt-4 grid gap-4">
              <div
                v-for="(s, i) in hero.stats"
                :key="i"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="text-sm font-semibold">Stat #{{ i + 1 }}</div>
                  <div class="flex items-center gap-2">
                    <UButton variant="soft" size="xs" :disabled="i === 0" @click="moveUp(hero.stats, i)">Up</UButton>
                    <UButton variant="soft" size="xs" :disabled="i === hero.stats.length - 1" @click="moveDown(hero.stats, i)">Down</UButton>
                    <UButton color="red" variant="soft" size="xs" @click="removeHeroStat(i)">Remove</UButton>
                  </div>
                </div>

                <div class="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label class="text-xs text-black/60 dark:text-white/60">Title (k)</label>
                    <UInput v-model="s.k" class="mt-1 w-full" placeholder="60fps feel" />
                  </div>

                  <div>
                    <label class="text-xs text-black/60 dark:text-white/60">Subtitle (v)</label>
                    <UInput v-model="s.v" class="mt-1 w-full" placeholder="Micro-interactions" />
                  </div>
                </div>
              </div>

              <div v-if="hero.stats.length === 0" class="text-sm text-black/60 dark:text-white/60">
                Add at least 1 stat.
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- TESTIMONIALS (full width, attractive card) -->
      <UCard class="border border-black/10 dark:border-white/10 overflow-hidden" :ui="{ body: 'p-0' }">
        <div class="p-6 border-b border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold">Testimonials</h2>
                <UBadge variant="soft">home / testimonials</UBadge>
              </div>
              <div class="mt-1 text-xs text-black/50 dark:text-white/50">
                <span v-if="testimonialsUpdatedAt">Last updated: {{ testimonialsUpdatedAt }}</span>
                <span v-else>No saved record yet</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UCheckbox v-model="testimonialsPublished" />
              <span class="text-sm text-black/70 dark:text-white/70">Published</span>
            </div>
          </div>
        </div>

        <div class="p-6 grid gap-6">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <div class="text-sm font-semibold text-black/80 dark:text-white/80">Title</div>
              <UInput v-model="testimonials.title" class="mt-2 w-full" placeholder="Testimonials" />
            </div>

            <div>
              <div class="text-sm font-semibold text-black/80 dark:text-white/80">Subtitle</div>
              <UInput
                v-model="testimonials.subtitle"
                class="mt-2 w-full"
                placeholder="Dummy for now — we’ll replace with real quotes."
              />
            </div>
          </div>

          <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="font-semibold">Items</div>
                <div class="text-xs text-black/50 dark:text-white/50">Each item becomes one testimonial card.</div>
              </div>
              <UButton variant="soft" size="sm" @click="addTestimonial">Add</UButton>
            </div>

            <div class="mt-4 grid gap-4">
              <div
                v-for="(x, i) in testimonials.items"
                :key="i"
                class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="text-sm font-semibold">Item #{{ i + 1 }}</div>
                  <UButton color="red" variant="soft" size="xs" @click="removeTestimonial(i)">Remove</UButton>
                </div>

                <div class="mt-4 grid gap-4">
                  <div class="w-full">
                    <label class="text-xs text-black/60 dark:text-white/60">Name</label>
                    <UInput v-model="x.name" class="mt-1 w-full" placeholder="Client A" />
                  </div>

                  <div class="w-full">
                    <label class="text-xs text-black/60 dark:text-white/60">Quote</label>
                    <UTextarea
                      v-model="x.text"
                      class="mt-1 w-full"
                      :rows="5"
                      placeholder="Polished delivery and great iteration speed."
                      :ui="{ base: 'w-full min-h-[180px]' }"
                    />
                  </div>
                </div>
              </div>

              <div v-if="testimonials.items.length === 0" class="text-sm text-black/60 dark:text-white/60">
                Add at least 1 testimonial.
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Single bottom note (no extra save button) -->
      <div class="text-xs text-black/50 dark:text-white/50">
        Tip: Use <code>Reload</code> to discard changes, and <code>Save</code> to publish updates.
      </div>
    </div>
  </UContainer>
</template>
