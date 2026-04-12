<!-- app/pages/insights/[slug].vue -->
<script setup lang="ts">
const route = useRoute()
const supabase = useSupabaseClient()

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
  cover_image_path: string | null
  category: string | null
  tags: string[] | null
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string[] | null
  content_markdown: string | null
  status: BlogStatus
  is_featured: boolean
  is_deleted: boolean
  reading_time_minutes: number
  published_at: string | null
  created_at: string
}

const slug = computed(() => String(route.params.slug || '').trim())

function fmtDate(v?: string | null) {
  if (!v) return '—'
  return new Intl.DateTimeFormat('en-BD', {
    year: 'numeric',
    month: 'long',
    day: '2-digit'
  }).format(new Date(v))
}

function readingTime(v?: number | null) {
  return `${Number(v || 5)} min read`
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function applyInlineMarkdown(text: string) {
  let out = escapeHtml(text)

  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="blog-inline-image" />')
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')

  return out
}

function renderMarkdown(markdown?: string | null) {
  const source = String(markdown || '').replace(/\r\n/g, '\n')
  if (!source.trim()) return '<p>No content available.</p>'

  const lines = source.split('\n')
  const html: string[] = []

  let inUl = false
  let inOl = false
  let inBlockquote = false
  let paragraphBuffer: string[] = []

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return
    const text = paragraphBuffer.join(' ').trim()
    if (text) {
      html.push(`<p>${applyInlineMarkdown(text)}</p>`)
    }
    paragraphBuffer = []
  }

  const closeListsAndQuote = () => {
    if (inUl) {
      html.push('</ul>')
      inUl = false
    }
    if (inOl) {
      html.push('</ol>')
      inOl = false
    }
    if (inBlockquote) {
      html.push('</blockquote>')
      inBlockquote = false
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      closeListsAndQuote()
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph()
      closeListsAndQuote()
      const level = headingMatch[1].length
      html.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`)
      continue
    }

    const quoteMatch = line.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      flushParagraph()
      if (inUl) {
        html.push('</ul>')
        inUl = false
      }
      if (inOl) {
        html.push('</ol>')
        inOl = false
      }
      if (!inBlockquote) {
        html.push('<blockquote>')
        inBlockquote = true
      }
      html.push(`<p>${applyInlineMarkdown(quoteMatch[1])}</p>`)
      continue
    }

    const ulMatch = line.match(/^[-*+]\s+(.*)$/)
    if (ulMatch) {
      flushParagraph()
      if (inOl) {
        html.push('</ol>')
        inOl = false
      }
      if (inBlockquote) {
        html.push('</blockquote>')
        inBlockquote = false
      }
      if (!inUl) {
        html.push('<ul>')
        inUl = true
      }
      html.push(`<li>${applyInlineMarkdown(ulMatch[1])}</li>`)
      continue
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/)
    if (olMatch) {
      flushParagraph()
      if (inUl) {
        html.push('</ul>')
        inUl = false
      }
      if (inBlockquote) {
        html.push('</blockquote>')
        inBlockquote = false
      }
      if (!inOl) {
        html.push('<ol>')
        inOl = true
      }
      html.push(`<li>${applyInlineMarkdown(olMatch[1])}</li>`)
      continue
    }

    const imageOnlyMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imageOnlyMatch) {
      flushParagraph()
      closeListsAndQuote()
      html.push(
        `<figure><img src="${escapeHtml(imageOnlyMatch[2])}" alt="${escapeHtml(imageOnlyMatch[1])}" class="blog-inline-image" />${
          imageOnlyMatch[1] ? `<figcaption>${escapeHtml(imageOnlyMatch[1])}</figcaption>` : ''
        }</figure>`
      )
      continue
    }

    paragraphBuffer.push(line)
  }

  flushParagraph()
  closeListsAndQuote()

  return html.join('\n')
}

const {
  data: blog,
  pending,
  error
} = await useAsyncData<BlogRow | null>(`insight-${slug.value}`, async () => {
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('blogs')
    .select(`
      id,
      title,
      slug,
      excerpt,
      cover_image_url,
      cover_image_path,
      category,
      tags,
      seo_title,
      seo_description,
      seo_keywords,
      content_markdown,
      status,
      is_featured,
      is_deleted,
      reading_time_minutes,
      published_at,
      created_at
    `)
    .eq('slug', slug.value)
    .eq('status', 'published')
    .eq('is_deleted', false)
    .or(`published_at.is.null,published_at.lte.${nowIso}`)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found'
    })
  }

  return data as BlogRow
})

const {
  data: relatedBlogsData
} = await useAsyncData<BlogRow[]>(`insight-related-${slug.value}`, async () => {
  if (!blog.value) return []

  const nowIso = new Date().toISOString()

  let query = supabase
    .from('blogs')
    .select(`
      id,
      title,
      slug,
      excerpt,
      cover_image_url,
      cover_image_path,
      category,
      tags,
      seo_title,
      seo_description,
      seo_keywords,
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
    .neq('id', blog.value.id)
    .or(`published_at.is.null,published_at.lte.${nowIso}`)
    .limit(6)

  if (blog.value.category) {
    query = query.eq('category', blog.value.category)
  }

  const { data, error } = await query
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })

  if (error) return []
  return ((data || []) as BlogRow[]).slice(0, 3)
})

const relatedBlogs = computed(() => relatedBlogsData.value || [])

const renderedContent = computed(() => {
  return renderMarkdown(blog.value?.content_markdown)
})

useSeoMeta({
  title: () => blog.value?.seo_title || blog.value?.title || 'Insights — illusion Arc',
  description: () =>
    blog.value?.seo_description ||
    blog.value?.excerpt ||
    'Article from illusion Arc insights.',
  ogTitle: () => blog.value?.seo_title || blog.value?.title || 'Insights — illusion Arc',
  ogDescription: () =>
    blog.value?.seo_description ||
    blog.value?.excerpt ||
    'Article from illusion Arc insights.',
  ogImage: () => blog.value?.cover_image_url || '',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <div class="min-h-dvh bg-white text-black dark:bg-neutral-950 dark:text-white">
    <template v-if="pending">
      <div class="mx-auto max-w-4xl px-4 py-10 lg:px-6 lg:py-14">
        <div class="h-4 w-32 rounded bg-black/5 dark:bg-white/5" />
        <div class="mt-4 h-12 w-4/5 rounded bg-black/5 dark:bg-white/5" />
        <div class="mt-3 h-5 w-3/5 rounded bg-black/5 dark:bg-white/5" />
        <div class="mt-8 aspect-[16/9] rounded-2xl bg-black/5 dark:bg-white/5" />
        <div class="mt-8 space-y-4">
          <div class="h-4 w-full rounded bg-black/5 dark:bg-white/5" />
          <div class="h-4 w-full rounded bg-black/5 dark:bg-white/5" />
          <div class="h-4 w-5/6 rounded bg-black/5 dark:bg-white/5" />
        </div>
      </div>
    </template>

    <template v-else-if="error">
      <div class="mx-auto max-w-3xl px-4 py-16 lg:px-6 lg:py-24">
        <div class="rounded-2xl border border-black/10 bg-white p-8 text-center dark:border-white/10 dark:bg-white/5">
          <div class="text-sm text-black/60 dark:text-white/60">404</div>
          <h1 class="mt-2 text-2xl font-semibold">Article not found</h1>
          <p class="mt-3 text-sm text-black/60 dark:text-white/60">
            The article may have been removed, unpublished, or the link may be incorrect.
          </p>
          <NuxtLink
            to="/insights"
            class="mt-6 inline-flex items-center justify-center rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            Back to insights
          </NuxtLink>
        </div>
      </div>
    </template>

    <template v-else-if="blog">
      <article>
        <section class="border-b border-black/10 dark:border-white/10">
          <div class="mx-auto max-w-4xl px-4 py-10 lg:px-6 lg:py-14">
            <NuxtLink
              to="/insights"
              class="inline-flex items-center gap-2 text-sm text-black/60 transition hover:text-black dark:text-white/60 dark:hover:text-white"
            >
              <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
              Back to insights
            </NuxtLink>

            <div class="mt-6 flex flex-wrap items-center gap-2 text-xs text-black/55 dark:text-white/55">
              <span
                v-if="blog.category"
                class="rounded-full border border-black/10 px-2.5 py-1 dark:border-white/10"
              >
                {{ blog.category }}
              </span>
              <span>{{ fmtDate(blog.published_at || blog.created_at) }}</span>
              <span>•</span>
              <span>{{ readingTime(blog.reading_time_minutes) }}</span>
            </div>

            <h1 class="mt-4 text-3xl font-bold tracking-tight lg:text-5xl">
              {{ blog.title }}
            </h1>

            <p
              v-if="blog.excerpt"
              class="mt-4 max-w-3xl text-base leading-8 text-black/65 dark:text-white/65 lg:text-lg lg:leading-9"
            >
              {{ blog.excerpt }}
            </p>

            <div
              v-if="blog.cover_image_url"
              class="mt-8 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10"
            >
              <img
                :src="blog.cover_image_url"
                :alt="blog.title"
                class="h-full w-full object-cover"
              >
            </div>
          </div>
        </section>

        <section class="mx-auto max-w-4xl px-4 py-10 lg:px-6 lg:py-14">
          <div
            class="blog-content text-justify text-[17px] leading-8 text-black/82 dark:text-white/82"
            v-html="renderedContent"
          />

          <div
            v-if="blog.tags?.length"
            class="mt-10 flex flex-wrap gap-2"
          >
            <span
              v-for="item in blog.tags"
              :key="item"
              class="rounded-full border border-black/10 px-3 py-1.5 text-sm text-black/60 dark:border-white/10 dark:text-white/60"
            >
              #{{ item }}
            </span>
          </div>
        </section>
      </article>

      <section
        v-if="relatedBlogs.length"
        class="border-t border-black/10 dark:border-white/10"
      >
        <div class="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-14">
          <div class="mb-5 flex items-center justify-between gap-3">
            <h2 class="text-2xl font-semibold">More insights</h2>
            <NuxtLink
              to="/insights"
              class="text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
            >
              View all
            </NuxtLink>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <NuxtLink
              v-for="item in relatedBlogs"
              :key="item.id"
              :to="`/insights/${item.slug}`"
              class="group overflow-hidden rounded-2xl border border-black/10 bg-white transition hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div class="aspect-[16/10] overflow-hidden bg-black/5 dark:bg-white/5">
                <img
                  v-if="item.cover_image_url"
                  :src="item.cover_image_url"
                  :alt="item.title"
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
                    v-if="item.category"
                    class="rounded-full border border-black/10 px-2.5 py-1 dark:border-white/10"
                  >
                    {{ item.category }}
                  </span>
                  <span>{{ fmtDate(item.published_at || item.created_at) }}</span>
                </div>

                <h3 class="mt-3 text-lg font-semibold leading-tight">
                  {{ item.title }}
                </h3>

                <p class="mt-3 text-sm leading-7 text-black/68 dark:text-white/68">
                  {{ item.excerpt || item.seo_description || 'Read the full article.' }}
                </p>

                <div class="mt-4 text-xs text-black/55 dark:text-white/55">
                  {{ readingTime(item.reading_time_minutes) }}
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.blog-content :deep(h1),
.blog-content :deep(h2),
.blog-content :deep(h3),
.blog-content :deep(h4),
.blog-content :deep(h5),
.blog-content :deep(h6) {
  color: inherit;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.blog-content :deep(h1) {
  font-size: 2rem;
  margin-top: 0;
  margin-bottom: 1rem;
}

.blog-content :deep(h2) {
  font-size: 1.55rem;
  margin-top: 2.5rem;
  margin-bottom: 1rem;
}

.blog-content :deep(h3) {
  font-size: 1.25rem;
  margin-top: 2rem;
  margin-bottom: 0.85rem;
}

.blog-content :deep(p) {
  margin: 0 0 1.1rem;
  text-align: justify;
  text-justify: inter-word;
}

.blog-content :deep(ul),
.blog-content :deep(ol) {
  margin: 1rem 0 1.25rem 1.25rem;
  padding-left: 1rem;
}

.blog-content :deep(li) {
  margin-bottom: 0.55rem;
  line-height: 1.85;
}

.blog-content :deep(blockquote) {
  margin: 1.5rem 0;
  padding: 1rem 1.1rem;
  border-left: 4px solid rgba(120, 120, 120, 0.35);
  background: rgba(0, 0, 0, 0.03);
  border-radius: 0.9rem;
}

.dark .blog-content :deep(blockquote) {
  background: rgba(255, 255, 255, 0.04);
}

.blog-content :deep(a) {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.blog-content :deep(code) {
  padding: 0.12rem 0.4rem;
  border-radius: 0.45rem;
  background: rgba(0, 0, 0, 0.06);
  font-size: 0.92em;
}

.dark .blog-content :deep(code) {
  background: rgba(255, 255, 255, 0.08);
}

.blog-content :deep(figure) {
  margin: 1.5rem 0;
}

.blog-content :deep(figcaption) {
  margin-top: 0.55rem;
  font-size: 0.9rem;
  opacity: 0.7;
}

.blog-content :deep(.blog-inline-image) {
  width: 100%;
  border-radius: 1rem;
  display: block;
}

.blog-content :deep(strong) {
  font-weight: 700;
}

.blog-content :deep(em) {
  font-style: italic;
}
</style>