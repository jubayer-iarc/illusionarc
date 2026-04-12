<!-- app/pages/insights/index.vue -->
<script setup lang="ts">
useHead({
  title: 'Insights — illusion Arc',
  meta: [
    {
      name: 'description',
      content: 'Articles, insights, updates, and creative technology thinking from illusion Arc.'
    }
  ]
})

type BlogStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'archived'

type BlogRow = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  category: string | null
  tags: string[] | null
  seo_title: string | null
  seo_description: string | null
  content_markdown: string | null
  status: BlogStatus
  is_featured: boolean
  is_deleted: boolean
  reading_time_minutes: number
  published_at: string | null
  created_at: string
}

const supabase = useSupabaseClient()

const q = ref('')
const category = ref('all')
const tag = ref('all')

function fmtDate(v?: string | null) {
  if (!v) return '—'
  return new Intl.DateTimeFormat('en-BD', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(new Date(v))
}

function readingTime(v?: number | null) {
  return `${Number(v || 5)} min read`
}

function extractPlainPreview(markdown?: string | null, fallback = '') {
  const raw = String(markdown || '')
  const text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text || fallback
}

const {
  data: blogsData,
  pending,
  refresh,
  error
} = await useAsyncData<BlogRow[]>('insights-index', async () => {
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('blogs')
    .select(`
      id,
      title,
      slug,
      excerpt,
      cover_image_url,
      category,
      tags,
      seo_title,
      seo_description,
      content_markdown,
      status,
      is_featured,
      is_deleted,
      reading_time_minutes,
      published_at,
      created_at
    `)
    .eq('status', 'published')
    .eq('is_deleted', false)
    .or(`published_at.is.null,published_at.lte.${nowIso}`)
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as BlogRow[]
})

const blogs = computed(() => blogsData.value || [])

const allCategories = computed(() => {
  return [
    'all',
    ...Array.from(
      new Set(
        blogs.value
          .map((b) => String(b.category || '').trim())
          .filter(Boolean)
      )
    ).sort()
  ]
})

const allTags = computed(() => {
  return [
    'all',
    ...Array.from(
      new Set(
        blogs.value.flatMap((b) =>
          (b.tags || []).map((t) => String(t || '').trim()).filter(Boolean)
        )
      )
    ).sort()
  ]
})

watchEffect(() => {
  if (!allCategories.value.includes(category.value)) category.value = 'all'
  if (!allTags.value.includes(tag.value)) tag.value = 'all'
})

const filteredBlogs = computed(() => {
  const query = q.value.trim().toLowerCase()

  return blogs.value.filter((blog) => {
    if (category.value !== 'all' && String(blog.category || '') !== category.value) return false
    if (tag.value !== 'all' && !(blog.tags || []).includes(tag.value)) return false

    if (!query) return true

    const hay = [
      blog.title,
      blog.slug,
      blog.excerpt,
      blog.category,
      blog.seo_description,
      blog.content_markdown,
      ...(blog.tags || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return hay.includes(query)
  })
})

const featuredBlogs = computed(() => filteredBlogs.value.filter((b) => b.is_featured))

const heroBlog = computed(() => featuredBlogs.value[0] || filteredBlogs.value[0] || null)

const secondaryFeatured = computed(() => {
  const heroId = heroBlog.value?.id
  return filteredBlogs.value
    .filter((b) => b.id !== heroId)
    .slice(0, 2)
})

const regularBlogs = computed(() => {
  const excludedIds = new Set<string>([
    heroBlog.value?.id || '',
    ...secondaryFeatured.value.map((b) => b.id)
  ])

  return filteredBlogs.value.filter((b) => !excludedIds.has(b.id))
})
</script>

<template>
  <div class="min-h-dvh bg-white text-black dark:bg-neutral-950 dark:text-white">
    <section class="border-b border-black/10 dark:border-white/10">
      <div class="mx-auto max-w-7xl px-4 py-12 lg:px-6 lg:py-16">
        <div class="max-w-3xl">
          <div class="text-sm text-black/60 dark:text-white/60">Insights</div>
          <h1 class="mt-2 text-3xl font-bold tracking-tight lg:text-5xl">
            Articles, updates, and ideas from illusion Arc
          </h1>
          <p class="mt-4 text-base leading-8 text-black/65 dark:text-white/65 lg:text-lg lg:leading-9">
            Thoughts on games, immersive media, interactive experiences, production workflows, and the creative systems behind our work.
          </p>
        </div>

        <div class="mt-8 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]">
          <input
            v-model="q"
            type="text"
            placeholder="Search articles"
            class="w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/20"
          >

          <select
            v-model="category"
            class="w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/20"
          >
            <option
              v-for="item in allCategories"
              :key="item"
              :value="item"
            >
              {{ item === 'all' ? 'All categories' : item }}
            </option>
          </select>

          <select
            v-model="tag"
            class="w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:focus:border-white/20"
          >
            <option
              v-for="item in allTags"
              :key="item"
              :value="item"
            >
              {{ item === 'all' ? 'All tags' : item }}
            </option>
          </select>

          <button
            type="button"
            class="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            @click="refresh"
          >
            Refresh
          </button>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:py-10">
      <div v-if="pending" class="space-y-8">
        <div class="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div class="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
            <div class="aspect-[16/9] animate-pulse bg-black/5 dark:bg-white/5" />
            <div class="space-y-3 p-5">
              <div class="h-4 w-28 rounded bg-black/5 dark:bg-white/5" />
              <div class="h-8 w-4/5 rounded bg-black/5 dark:bg-white/5" />
              <div class="h-4 w-full rounded bg-black/5 dark:bg-white/5" />
              <div class="h-4 w-2/3 rounded bg-black/5 dark:bg-white/5" />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div
              v-for="i in 2"
              :key="i"
              class="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10"
            >
              <div class="aspect-[16/10] animate-pulse bg-black/5 dark:bg-white/5" />
              <div class="space-y-3 p-5">
                <div class="h-4 w-24 rounded bg-black/5 dark:bg-white/5" />
                <div class="h-6 w-4/5 rounded bg-black/5 dark:bg-white/5" />
                <div class="h-4 w-full rounded bg-black/5 dark:bg-white/5" />
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="i in 6"
            :key="`skeleton-${i}`"
            class="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10"
          >
            <div class="aspect-[16/10] animate-pulse bg-black/5 dark:bg-white/5" />
            <div class="space-y-3 p-5">
              <div class="h-4 w-24 rounded bg-black/5 dark:bg-white/5" />
              <div class="h-6 w-4/5 rounded bg-black/5 dark:bg-white/5" />
              <div class="h-4 w-full rounded bg-black/5 dark:bg-white/5" />
              <div class="h-4 w-2/3 rounded bg-black/5 dark:bg-white/5" />
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="error"
        class="rounded-2xl border border-black/10 bg-white p-8 text-center dark:border-white/10 dark:bg-white/5"
      >
        <h2 class="text-xl font-semibold">Could not load insights</h2>
        <p class="mt-2 text-sm text-black/60 dark:text-white/60">
          Please try again.
        </p>
        <button
          type="button"
          class="mt-4 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          @click="refresh"
        >
          Retry
        </button>
      </div>

      <template v-else>
        <div v-if="heroBlog" class="mb-10">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="text-xl font-semibold">Featured</h2>
          </div>

          <div class="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <NuxtLink
              :to="`/insights/${heroBlog.slug}`"
              class="group overflow-hidden rounded-2xl border border-black/10 bg-white transition hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div class="aspect-[16/9] overflow-hidden bg-black/5 dark:bg-white/5">
                <img
                  v-if="heroBlog.cover_image_url"
                  :src="heroBlog.cover_image_url"
                  :alt="heroBlog.title"
                  class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                >
                <div
                  v-else
                  class="grid h-full w-full place-items-center text-sm text-black/40 dark:text-white/40"
                >
                  Featured article
                </div>
              </div>

              <div class="p-5 lg:p-6">
                <div class="flex flex-wrap items-center gap-2 text-xs text-black/55 dark:text-white/55">
                  <span
                    v-if="heroBlog.category"
                    class="rounded-full border border-black/10 px-2.5 py-1 dark:border-white/10"
                  >
                    {{ heroBlog.category }}
                  </span>
                  <span>{{ fmtDate(heroBlog.published_at || heroBlog.created_at) }}</span>
                  <span>•</span>
                  <span>{{ readingTime(heroBlog.reading_time_minutes) }}</span>
                </div>

                <h3 class="mt-3 text-2xl font-semibold leading-tight lg:text-3xl">
                  {{ heroBlog.title }}
                </h3>

                <p class="mt-4 text-sm leading-8 text-black/68 dark:text-white/68 lg:text-base lg:leading-8">
                  {{ heroBlog.excerpt || heroBlog.seo_description || extractPlainPreview(heroBlog.content_markdown, 'Read the full article.') }}
                </p>

                <div class="mt-4 flex flex-wrap gap-2">
                  <span
                    v-for="item in (heroBlog.tags || []).slice(0, 4)"
                    :key="item"
                    class="text-xs text-black/50 dark:text-white/50"
                  >
                    #{{ item }}
                  </span>
                </div>
              </div>
            </NuxtLink>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <NuxtLink
                v-for="blog in secondaryFeatured"
                :key="blog.id"
                :to="`/insights/${blog.slug}`"
                class="group overflow-hidden rounded-2xl border border-black/10 bg-white transition hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div class="aspect-[16/10] overflow-hidden bg-black/5 dark:bg-white/5">
                  <img
                    v-if="blog.cover_image_url"
                    :src="blog.cover_image_url"
                    :alt="blog.title"
                    class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  >
                  <div
                    v-else
                    class="grid h-full w-full place-items-center text-sm text-black/40 dark:text-white/40"
                  >
                    Featured article
                  </div>
                </div>

                <div class="p-5">
                  <div class="flex flex-wrap items-center gap-2 text-xs text-black/55 dark:text-white/55">
                    <span
                      v-if="blog.category"
                      class="rounded-full border border-black/10 px-2.5 py-1 dark:border-white/10"
                    >
                      {{ blog.category }}
                    </span>
                    <span>{{ fmtDate(blog.published_at || blog.created_at) }}</span>
                  </div>

                  <h3 class="mt-3 text-lg font-semibold leading-tight">
                    {{ blog.title }}
                  </h3>

                  <p class="mt-3 text-sm leading-7 text-black/68 dark:text-white/68">
                    {{ blog.excerpt || blog.seo_description || extractPlainPreview(blog.content_markdown, 'Read the full article.') }}
                  </p>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>

        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-xl font-semibold">All articles</h2>
          <div class="text-sm text-black/60 dark:text-white/60">
            {{ regularBlogs.length }} found
          </div>
        </div>

        <div
          v-if="regularBlogs.length"
          class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <NuxtLink
            v-for="blog in regularBlogs"
            :key="blog.id"
            :to="`/insights/${blog.slug}`"
            class="group overflow-hidden rounded-2xl border border-black/10 bg-white transition hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <div class="aspect-[16/10] overflow-hidden bg-black/5 dark:bg-white/5">
              <img
                v-if="blog.cover_image_url"
                :src="blog.cover_image_url"
                :alt="blog.title"
                class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              >
              <div
                v-else
                class="grid h-full w-full place-items-center text-sm text-black/40 dark:text-white/40"
              >
                Article image
              </div>
            </div>

            <div class="p-5">
              <div class="flex flex-wrap items-center gap-2 text-xs text-black/55 dark:text-white/55">
                <span
                  v-if="blog.category"
                  class="rounded-full border border-black/10 px-2.5 py-1 dark:border-white/10"
                >
                  {{ blog.category }}
                </span>
                <span>{{ fmtDate(blog.published_at || blog.created_at) }}</span>
              </div>

              <h3 class="mt-3 text-lg font-semibold leading-tight">
                {{ blog.title }}
              </h3>

              <p class="mt-3 text-sm leading-7 text-black/68 dark:text-white/68">
                {{ blog.excerpt || blog.seo_description || extractPlainPreview(blog.content_markdown, 'Read the full article.') }}
              </p>

              <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="item in (blog.tags || []).slice(0, 3)"
                    :key="item"
                    class="text-xs text-black/50 dark:text-white/50"
                  >
                    #{{ item }}
                  </span>
                </div>

                <span class="text-xs text-black/55 dark:text-white/55">
                  {{ readingTime(blog.reading_time_minutes) }}
                </span>
              </div>
            </div>
          </NuxtLink>
        </div>

        <div
          v-else
          class="rounded-2xl border border-black/10 bg-white p-8 text-center dark:border-white/10 dark:bg-white/5"
        >
          <h3 class="text-lg font-semibold">No articles found</h3>
          <p class="mt-2 text-sm text-black/60 dark:text-white/60">
            Try adjusting the search or filters.
          </p>
        </div>
      </template>
    </section>
  </div>
</template>