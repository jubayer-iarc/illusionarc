<!-- app/pages/admin/blogs.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['admin-or-writer']
})

useHead({ title: 'Admin — Blogs' })

import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const supabase = useSupabaseClient()
const toast = useToast()

type Role = 'admin' | 'writer' | 'user' | null
type RoleResponse = { role: Role; found: boolean }

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
  author_user_id: string
  last_editor_user_id: string | null
  approval_required: boolean
  approved_by_user_id: string | null
  approved_at: string | null
  rejection_reason: string | null
  no_approval_needed: boolean
  is_featured: boolean
  is_deleted: boolean
  reading_time_minutes: number
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

type BlogAssetRow = {
  id: string
  blog_id: string
  kind: 'cover' | 'gallery' | 'inline' | 'og'
  url: string | null
  path: string | null
  alt: string | null
  caption: string | null
  sort_order: number
  created_at: string
}

type ProfileLite = {
  user_id: string
  display_name: string
  role?: string | null
  writer_verified?: boolean | null
  writer_no_approval_needed?: boolean | null
}

type BlogLogRow = {
  id: number
  blog_id: string | null
  actor_user_id: string | null
  action: string
  meta: Record<string, any> | null
  created_at: string
}

const COVER_BUCKET = 'blog-covers'
const GALLERY_BUCKET = 'blog-gallery'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const publishing = ref(false)
const uploadingCover = ref(false)
const markdownMode = ref<'edit' | 'preview' | 'split'>('split')

const role = ref<Role>(null)
const currentUserId = ref('')
const currentUserProfile = ref<ProfileLite | null>(null)

const blogs = ref<BlogRow[]>([])
const recentLogs = ref<BlogLogRow[]>([])
const profileMap = ref<Record<string, string>>({})
const assetsByBlogId = ref<Record<string, BlogAssetRow[]>>({})

const q = ref('')
const statusFilter = ref<'all' | BlogStatus>('all')
const categoryFilter = ref('all')
const mineOnly = ref(false)
const showArchived = ref(false)

const selectedBlogId = ref<string | null>(null)
const adminRejectReason = ref('')

const form = reactive({
  id: '',
  title: '',
  slug: '',
  excerpt: '',
  cover_image_url: '',
  cover_image_path: '',
  category: '',
  tagsText: '',
  seo_title: '',
  seo_description: '',
  seo_keywords_text: '',
  content_markdown: '',
  status: 'draft' as BlogStatus,
  approval_required: true,
  no_approval_needed: false,
  is_featured: false,
  reading_time_minutes: 5,
  scheduled_at: '',
  published_at: '',
  gallery: [] as Array<{
    id?: string
    url: string
    path?: string
    alt?: string
    caption?: string
    sort_order: number
    uploading?: boolean
  }>
})

function defaultMarkdown() {
  return `# Blog title

Write your introduction here.

## Section heading

- Bullet point 1
- Bullet point 2
- Bullet point 3

### Subheading

Write more details here.

> Add an important quote or callout here.

![Image alt text](https://example.com/image.webp)

[Optional link text](https://example.com)`
}

function emptyForm() {
  return {
    id: '',
    title: '',
    slug: '',
    excerpt: '',
    cover_image_url: '',
    cover_image_path: '',
    category: '',
    tagsText: '',
    seo_title: '',
    seo_description: '',
    seo_keywords_text: '',
    content_markdown: defaultMarkdown(),
    status: 'draft' as BlogStatus,
    approval_required: role.value !== 'admin',
    no_approval_needed: false,
    is_featured: false,
    reading_time_minutes: 5,
    scheduled_at: '',
    published_at: '',
    gallery: [] as Array<{
      id?: string
      url: string
      path?: string
      alt?: string
      caption?: string
      sort_order: number
      uploading?: boolean
    }>
  }
}

function resetForm() {
  Object.assign(form, emptyForm())
  adminRejectReason.value = ''
  selectedBlogId.value = null
}

function n(v: number | null | undefined) {
  return new Intl.NumberFormat().format(Number(v || 0))
}

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

function badgeClass(kind: string) {
  const k = String(kind || '').toLowerCase()
  if (k === 'draft') return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25'
  if (k === 'in_review') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
  if (k === 'approved') return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25'
  if (k === 'published') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
  if (k === 'rejected') return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25'
  if (k === 'archived') return 'bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 border-black/10 dark:border-white/10'
  if (k === 'verified') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
  if (k === 'admin') return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25'
  if (k === 'writer') return 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25'
  return 'bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 border-black/10 dark:border-white/10'
}

function pill(kind: string) {
  return `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(kind)}`
}

const isAdmin = computed(() => role.value === 'admin')
const isWriter = computed(() => role.value === 'writer')

const canSkipApproval = computed(() => {
  if (isAdmin.value) return true
  return Boolean(currentUserProfile.value?.writer_no_approval_needed)
})

function slugify(v: string) {
  return String(v || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

watch(
  () => form.title,
  (val) => {
    if (!form.id && !form.slug.trim()) {
      form.slug = slugify(val)
    }
  }
)

const renderedMarkdown = computed(() => {
  const html = md.render(String(form.content_markdown || ''))
  return DOMPurify.sanitize(html)
})

const markdownWordCount = computed(() => {
  const text = String(form.content_markdown || '')
    .replace(/[#>*`\-\[\]\(\)!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text ? text.split(' ').length : 0
})

const markdownCharCount = computed(() => String(form.content_markdown || '').length)

const categories = computed(() => {
  return Array.from(
    new Set(
      blogs.value
        .map((b) => String(b.category || '').trim())
        .filter(Boolean)
    )
  ).sort()
})

const selectedBlog = computed(() => {
  if (!selectedBlogId.value) return null
  return blogs.value.find((b) => b.id === selectedBlogId.value) || null
})

const filteredBlogs = computed(() => {
  const query = q.value.trim().toLowerCase()

  return blogs.value.filter((b) => {
    if (!showArchived.value && (b.is_deleted || b.status === 'archived')) return false
    if (statusFilter.value !== 'all' && b.status !== statusFilter.value) return false
    if (categoryFilter.value !== 'all' && String(b.category || '') !== categoryFilter.value) return false
    if (mineOnly.value && b.author_user_id !== currentUserId.value) return false

    if (!query) return true

    const hay = [
      b.title,
      b.slug,
      b.excerpt,
      b.category,
      b.content_markdown,
      ...(b.tags || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return hay.includes(query)
  })
})

const stats = computed(() => {
  const active = blogs.value.filter((b) => !b.is_deleted && b.status !== 'archived')
  return {
    total: active.length,
    drafts: active.filter((b) => b.status === 'draft').length,
    review: active.filter((b) => b.status === 'in_review').length,
    published: active.filter((b) => b.status === 'published').length
  }
})

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error

  const uid = String(data?.user?.id || '')
  if (!uid) throw new Error('Login required')
  currentUserId.value = uid
}

async function getRoleAndProfile() {
  const res = await $fetch<RoleResponse>('/api/auth/role', {
    credentials: 'include'
  })

  role.value = res.role

  if (res.role !== 'admin' && res.role !== 'writer') {
    throw new Error('You do not have access to blog management.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, role, writer_verified, writer_no_approval_needed')
    .eq('user_id', currentUserId.value)
    .maybeSingle()

  if (error) throw error
  currentUserProfile.value = (data || null) as ProfileLite | null
}

async function loadBlogs() {
  let query = supabase
    .from('blogs')
    .select('*')
    .order('updated_at', { ascending: false })

  if (!isAdmin.value) {
    query = query.eq('author_user_id', currentUserId.value)
  }

  const { data, error } = await query
  if (error) throw error

  blogs.value = (data || []) as BlogRow[]

  const ids = blogs.value.map((b) => b.id)
  if (!ids.length) {
    assetsByBlogId.value = {}
    return
  }

  const { data: assets, error: assetsError } = await supabase
    .from('blog_assets')
    .select('*')
    .in('blog_id', ids)
    .order('sort_order', { ascending: true })

  if (assetsError) throw assetsError

  const grouped: Record<string, BlogAssetRow[]> = {}
  for (const row of (assets || []) as BlogAssetRow[]) {
    if (!grouped[row.blog_id]) grouped[row.blog_id] = []
    grouped[row.blog_id].push(row)
  }

  assetsByBlogId.value = grouped
}

async function loadRecentLogs() {
  if (!isAdmin.value) {
    recentLogs.value = []
    return
  }

  const { data, error } = await supabase
    .from('blog_activity_logs')
    .select('id, blog_id, actor_user_id, action, meta, created_at')
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) throw error
  recentLogs.value = (data || []) as BlogLogRow[]
}

async function loadProfileMap() {
  const userIds = Array.from(
    new Set([
      currentUserId.value,
      ...blogs.value.map((b) => b.author_user_id),
      ...blogs.value.map((b) => b.last_editor_user_id || ''),
      ...recentLogs.value.map((l) => l.actor_user_id || '')
    ].filter(Boolean))
  )

  if (!userIds.length) {
    profileMap.value = {}
    return
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', userIds)

  if (error) throw error

  const out: Record<string, string> = {}
  ;(data || []).forEach((row: any) => {
    out[String(row.user_id)] = String(row.display_name || 'User')
  })
  profileMap.value = out
}

async function loadAll() {
  loading.value = true
  try {
    await getCurrentUser()
    await getRoleAndProfile()
    await Promise.all([loadBlogs(), loadRecentLogs()])
    await loadProfileMap()
  } catch (e: any) {
    toast.add({
      title: 'Failed to load blogs',
      description: e?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function selectBlog(blog: BlogRow) {
  selectedBlogId.value = blog.id
  adminRejectReason.value = blog.rejection_reason || ''

  const gallery = (assetsByBlogId.value[blog.id] || [])
    .filter((x) => x.kind === 'gallery')
    .map((x) => ({
      id: x.id,
      url: x.url || '',
      path: x.path || '',
      alt: x.alt || '',
      caption: x.caption || '',
      sort_order: x.sort_order
    }))

  Object.assign(form, {
    id: blog.id,
    title: blog.title || '',
    slug: blog.slug || '',
    excerpt: blog.excerpt || '',
    cover_image_url: blog.cover_image_url || '',
    cover_image_path: blog.cover_image_path || '',
    category: blog.category || '',
    tagsText: (blog.tags || []).join(', '),
    seo_title: blog.seo_title || '',
    seo_description: blog.seo_description || '',
    seo_keywords_text: (blog.seo_keywords || []).join(', '),
    content_markdown: blog.content_markdown || defaultMarkdown(),
    status: blog.status,
    approval_required: Boolean(blog.approval_required),
    no_approval_needed: Boolean(blog.no_approval_needed),
    is_featured: Boolean(blog.is_featured),
    reading_time_minutes: Number(blog.reading_time_minutes || 5),
    scheduled_at: blog.scheduled_at ? blog.scheduled_at.slice(0, 16) : '',
    published_at: blog.published_at ? blog.published_at.slice(0, 16) : '',
    gallery
  })
}

function newBlog() {
  resetForm()
}

function addGalleryRow() {
  form.gallery.push({
    url: '',
    path: '',
    alt: '',
    caption: '',
    sort_order: (form.gallery.at(-1)?.sort_order || 0) + 10
  })
}

function removeGalleryRow(index: number) {
  form.gallery.splice(index, 1)
}

async function writeLog(blogId: string | null, action: string, meta?: Record<string, any>) {
  await supabase.from('blog_activity_logs').insert({
    blog_id: blogId,
    actor_user_id: currentUserId.value,
    action,
    meta: meta || {}
  })
}

function makeStoragePath(bucketFolder: string, file: File) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const safeName = slugify(file.name.replace(/\.[^/.]+$/, '')) || 'image'
  return `${currentUserId.value}/${bucketFolder}/${Date.now()}-${safeName}.${ext}`
}

async function uploadToBucket(bucket: string, file: File, bucketFolder: string) {
  const path = makeStoragePath(bucketFolder, file)

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return {
    path,
    url: data.publicUrl
  }
}

async function onCoverFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return

  uploadingCover.value = true
  try {
    const uploaded = await uploadToBucket(COVER_BUCKET, file, 'covers')
    form.cover_image_path = uploaded.path
    form.cover_image_url = uploaded.url

    toast.add({
      title: 'Cover uploaded',
      color: 'success'
    })
  } catch (e: any) {
    toast.add({
      title: 'Cover upload failed',
      description: e?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    uploadingCover.value = false
    input.value = ''
  }
}

async function onGalleryFileChange(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return

  form.gallery[index].uploading = true
  try {
    const uploaded = await uploadToBucket(GALLERY_BUCKET, file, 'gallery')
    form.gallery[index].path = uploaded.path
    form.gallery[index].url = uploaded.url

    toast.add({
      title: 'Gallery image uploaded',
      color: 'success'
    })
  } catch (e: any) {
    toast.add({
      title: 'Gallery upload failed',
      description: e?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    form.gallery[index].uploading = false
    input.value = ''
  }
}

function insertAtCursor(textarea: HTMLTextAreaElement, text: string) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const current = form.content_markdown || ''
  form.content_markdown = current.slice(0, start) + text + current.slice(end)

  nextTick(() => {
    textarea.focus()
    const pos = start + text.length
    textarea.setSelectionRange(pos, pos)
  })
}

function markdownWrap(textarea: HTMLTextAreaElement, before: string, after = '') {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const current = form.content_markdown || ''
  const selected = current.slice(start, end)
  const replacement = `${before}${selected}${after}`
  form.content_markdown = current.slice(0, start) + replacement + current.slice(end)

  nextTick(() => {
    textarea.focus()
    const selStart = start + before.length
    const selEnd = selStart + selected.length
    textarea.setSelectionRange(selStart, selEnd)
  })
}

function insertHeading(level: 1 | 2 | 3) {
  const textarea = document.getElementById('markdown-editor') as HTMLTextAreaElement | null
  if (!textarea) return
  const prefix = `${'#'.repeat(level)} `
  insertAtCursor(textarea, `\n${prefix}`)
}

function insertBulletList() {
  const textarea = document.getElementById('markdown-editor') as HTMLTextAreaElement | null
  if (!textarea) return
  insertAtCursor(textarea, '\n- Item 1\n- Item 2\n- Item 3\n')
}

function insertNumberList() {
  const textarea = document.getElementById('markdown-editor') as HTMLTextAreaElement | null
  if (!textarea) return
  insertAtCursor(textarea, '\n1. Item 1\n2. Item 2\n3. Item 3\n')
}

function insertQuote() {
  const textarea = document.getElementById('markdown-editor') as HTMLTextAreaElement | null
  if (!textarea) return
  insertAtCursor(textarea, '\n> Quote here\n')
}

function boldSelection() {
  const textarea = document.getElementById('markdown-editor') as HTMLTextAreaElement | null
  if (!textarea) return
  markdownWrap(textarea, '**', '**')
}

function italicSelection() {
  const textarea = document.getElementById('markdown-editor') as HTMLTextAreaElement | null
  if (!textarea) return
  markdownWrap(textarea, '*', '*')
}

function insertLink() {
  const textarea = document.getElementById('markdown-editor') as HTMLTextAreaElement | null
  if (!textarea) return
  insertAtCursor(textarea, '[Link text](https://example.com)')
}

function insertImageSyntax(url: string, alt = 'Image alt text') {
  const textarea = document.getElementById('markdown-editor') as HTMLTextAreaElement | null
  if (!textarea) return
  insertAtCursor(textarea, `\n![${alt}](${url})\n`)
}

async function onInlineImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return

  try {
    const uploaded = await uploadToBucket(GALLERY_BUCKET, file, 'inline')
    insertImageSyntax(uploaded.url, file.name.replace(/\.[^/.]+$/, '') || 'Image')

    toast.add({
      title: 'Image uploaded and inserted',
      color: 'success'
    })
  } catch (e: any) {
    toast.add({
      title: 'Inline image upload failed',
      description: e?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    input.value = ''
  }
}

async function syncGallery(blogId: string) {
  const existing = (assetsByBlogId.value[blogId] || []).filter((x) => x.kind === 'gallery')
  const existingIds = new Set(existing.map((x) => x.id))
  const nextIds = new Set(form.gallery.map((x) => x.id).filter(Boolean) as string[])

  const toDelete = existing.filter((x) => !nextIds.has(x.id))
  if (toDelete.length) {
    const { error } = await supabase
      .from('blog_assets')
      .delete()
      .in('id', toDelete.map((x) => x.id))

    if (error) throw error
  }

  for (const item of form.gallery) {
    if (!item.url.trim()) continue

    if (item.id && existingIds.has(item.id)) {
      const { error } = await supabase
        .from('blog_assets')
        .update({
          url: item.url.trim(),
          path: item.path?.trim() || null,
          alt: item.alt?.trim() || null,
          caption: item.caption?.trim() || null,
          sort_order: Number(item.sort_order || 100)
        })
        .eq('id', item.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('blog_assets')
        .insert({
          blog_id: blogId,
          kind: 'gallery',
          url: item.url.trim(),
          path: item.path?.trim() || null,
          alt: item.alt?.trim() || null,
          caption: item.caption?.trim() || null,
          sort_order: Number(item.sort_order || 100)
        })

      if (error) throw error
    }
  }
}

async function saveBlog(mode: 'draft' | 'review' | 'publish' = 'draft') {
  saving.value = true
  try {
    const tags = form.tagsText.split(',').map((x) => x.trim()).filter(Boolean)
    const seoKeywords = form.seo_keywords_text.split(',').map((x) => x.trim()).filter(Boolean)

    let nextStatus: BlogStatus = form.status || 'draft'

    if (mode === 'draft') {
      nextStatus = 'draft'
    } else if (mode === 'review') {
      nextStatus = canSkipApproval.value ? 'approved' : 'in_review'
    } else if (mode === 'publish') {
      if (!isAdmin.value && !canSkipApproval.value) {
        throw new Error('This blog still needs admin approval before publishing.')
      }
      nextStatus = 'published'
    }

    const payload = {
      title: form.title.trim(),
      slug: slugify(form.slug || form.title),
      excerpt: form.excerpt.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      cover_image_path: form.cover_image_path.trim() || null,
      category: form.category.trim() || null,
      tags,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      seo_keywords: seoKeywords,
      content_markdown: String(form.content_markdown || '').trim(),
      status: nextStatus,
      author_user_id: form.id ? undefined : currentUserId.value,
      last_editor_user_id: currentUserId.value,
      approval_required: !canSkipApproval.value,
      rejection_reason: isAdmin.value ? adminRejectReason.value.trim() || null : undefined,
      no_approval_needed: canSkipApproval.value,
      is_featured: isAdmin.value ? Boolean(form.is_featured) : false,
      reading_time_minutes: Number(form.reading_time_minutes || 5),
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      published_at:
        nextStatus === 'published'
          ? (form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString())
          : null,
      approved_by_user_id:
        nextStatus === 'approved' || nextStatus === 'published'
          ? (isAdmin.value ? currentUserId.value : null)
          : null,
      approved_at:
        nextStatus === 'approved' || nextStatus === 'published'
          ? (isAdmin.value ? new Date().toISOString() : null)
          : null
    }

    if (!payload.title) throw new Error('Title is required.')
    if (!payload.slug) throw new Error('Slug is required.')
    if (!payload.content_markdown) throw new Error('Markdown content is required.')

    let blogId = form.id
    const isEditing = Boolean(form.id)

    if (form.id) {
      const { error } = await supabase
        .from('blogs')
        .update(payload)
        .eq('id', form.id)

      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('blogs')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw error
      blogId = String((data as any)?.id || '')
      form.id = blogId
      selectedBlogId.value = blogId
    }

    if (!blogId) throw new Error('Blog save failed.')

    await syncGallery(blogId)
    await writeLog(blogId, isEditing ? 'blog_saved' : 'blog_created', {
      mode,
      status: nextStatus,
      markdown_words: markdownWordCount.value
    })

    await Promise.all([loadBlogs(), loadRecentLogs()])
    await loadProfileMap()

    const saved = blogs.value.find((b) => b.id === blogId)
    if (saved) selectBlog(saved)

    toast.add({
      title:
        mode === 'draft'
          ? 'Draft saved'
          : mode === 'review'
            ? (canSkipApproval.value ? 'Saved and approved' : 'Sent for review')
            : 'Blog published',
      color: 'success'
    })
  } catch (e: any) {
    toast.add({
      title: 'Save failed',
      description: e?.message || 'Unknown error',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

async function approveSelected() {
  if (!isAdmin.value || !form.id) return

  try {
    const { error } = await supabase
      .from('blogs')
      .update({
        status: 'approved',
        approved_by_user_id: currentUserId.value,
        approved_at: new Date().toISOString(),
        rejection_reason: null
      })
      .eq('id', form.id)

    if (error) throw error

    await writeLog(form.id, 'blog_approved')
    await Promise.all([loadBlogs(), loadRecentLogs()])
    const blog = blogs.value.find((b) => b.id === form.id)
    if (blog) selectBlog(blog)

    toast.add({ title: 'Blog approved', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Approval failed', description: e?.message || '', color: 'error' })
  }
}

async function rejectSelected() {
  if (!isAdmin.value || !form.id) return

  try {
    const reason = adminRejectReason.value.trim() || 'Needs revision'

    const { error } = await supabase
      .from('blogs')
      .update({
        status: 'rejected',
        rejection_reason: reason
      })
      .eq('id', form.id)

    if (error) throw error

    await writeLog(form.id, 'blog_rejected', { reason })
    await Promise.all([loadBlogs(), loadRecentLogs()])
    const blog = blogs.value.find((b) => b.id === form.id)
    if (blog) selectBlog(blog)

    toast.add({ title: 'Blog rejected', color: 'warning' })
  } catch (e: any) {
    toast.add({ title: 'Reject failed', description: e?.message || '', color: 'error' })
  }
}

async function archiveSelected() {
  if (!form.id) return

  deleting.value = true
  try {
    const { error } = await supabase
      .from('blogs')
      .update({
        is_deleted: true,
        status: 'archived'
      })
      .eq('id', form.id)

    if (error) throw error

    await writeLog(form.id, 'blog_archived')
    await Promise.all([loadBlogs(), loadRecentLogs()])
    resetForm()

    toast.add({ title: 'Blog archived', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Archive failed', description: e?.message || '', color: 'error' })
  } finally {
    deleting.value = false
  }
}

async function publishSelected() {
  publishing.value = true
  try {
    await saveBlog('publish')
  } finally {
    publishing.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-5 lg:p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-sm text-black/60 dark:text-white/60">Content</div>
          <h1 class="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            Blog Management
          </h1>
          <p class="mt-2 text-sm text-black/60 dark:text-white/60 max-w-3xl">
            Write in Markdown, upload images to buckets, and manage editorial approval in one place.
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <span :class="pill(isAdmin ? 'admin' : 'writer')">
              {{ isAdmin ? 'Admin' : 'Writer' }}
            </span>

            <span
              v-if="currentUserProfile?.writer_verified"
              :class="pill('verified')"
            >
              Verified writer
            </span>

            <span
              v-if="canSkipApproval && isWriter"
              :class="pill('approved')"
            >
              No approval needed further
            </span>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
            @click="loadAll"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5" />
            Refresh
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
            @click="newBlog"
          >
            <UIcon name="i-heroicons-pencil-square" class="h-5 w-5" />
            New Blog
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
        <div class="text-sm font-semibold">All Blogs</div>
        <div class="mt-3 text-3xl font-bold tabular-nums">{{ n(stats.total) }}</div>
      </div>

      <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
        <div class="text-sm font-semibold">Drafts</div>
        <div class="mt-3 text-3xl font-bold tabular-nums">{{ n(stats.drafts) }}</div>
      </div>

      <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
        <div class="text-sm font-semibold">In Review</div>
        <div class="mt-3 text-3xl font-bold tabular-nums">{{ n(stats.review) }}</div>
      </div>

      <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
        <div class="text-sm font-semibold">Published</div>
        <div class="mt-3 text-3xl font-bold tabular-nums">{{ n(stats.published) }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[390px_minmax(0,1fr)_360px] gap-4">
      <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-semibold">Blogs</div>
            <div class="text-xs text-black/60 dark:text-white/60">
              {{ isAdmin ? 'All blog entries' : 'Your own blog entries' }}
            </div>
          </div>
          <button class="text-sm hover:underline" @click="newBlog">Reset</button>
        </div>

        <div class="mt-4 grid gap-2">
          <input
            v-model="q"
            type="text"
            placeholder="Search title, slug, tag..."
            class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
          >

          <div class="grid grid-cols-2 gap-2">
            <select
              v-model="statusFilter"
              class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="in_review">In Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>

            <select
              v-model="categoryFilter"
              class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
            >
              <option value="all">All Category</option>
              <option v-for="cat in categories" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </div>

          <div class="flex flex-wrap gap-3 text-sm">
            <label class="inline-flex items-center gap-2">
              <input v-model="mineOnly" type="checkbox">
              Mine only
            </label>
            <label class="inline-flex items-center gap-2">
              <input v-model="showArchived" type="checkbox">
              Show archived
            </label>
          </div>
        </div>

        <div class="mt-4 space-y-3 max-h-[70dvh] overflow-auto pr-1">
          <div v-if="loading" class="space-y-3">
            <div
              v-for="i in 5"
              :key="i"
              class="h-24 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse"
            />
          </div>

          <button
            v-for="blog in filteredBlogs"
            :key="blog.id"
            type="button"
            class="w-full rounded-xl border p-3 text-left transition"
            :class="selectedBlogId === blog.id
              ? 'border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10'
              : 'border-black/10 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10'"
            @click="selectBlog(blog)"
          >
            <div class="flex items-start gap-3">
              <div class="h-14 w-16 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
                <img
                  v-if="blog.cover_image_url"
                  :src="blog.cover_image_url"
                  alt=""
                  class="h-full w-full object-cover"
                >
                <div v-else class="h-full w-full grid place-items-center text-[10px] opacity-60">
                  BLOG
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="font-semibold truncate">{{ blog.title }}</div>
                  <span :class="pill(blog.status)">{{ blog.status }}</span>
                </div>

                <div class="mt-1 text-xs text-black/60 dark:text-white/60 truncate">
                  /insights/{{ blog.slug }}
                </div>

                <div class="mt-2 text-[11px] text-black/50 dark:text-white/50">
                  {{ profileMap[blog.author_user_id] || 'Author' }} • Updated {{ fmtDT(blog.updated_at) }}
                </div>
              </div>
            </div>
          </button>

          <div
            v-if="!loading && filteredBlogs.length === 0"
            class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4 text-sm text-black/60 dark:text-white/60"
          >
            No blogs found.
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4 lg:p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-lg font-semibold">
              {{ form.id ? 'Edit Blog' : 'Create Blog' }}
            </div>
            <div class="text-xs text-black/60 dark:text-white/60">
              Markdown editor with live preview and bucket-based image upload.
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition disabled:opacity-60"
              :disabled="saving"
              @click="saveBlog('draft')"
            >
              Save Draft
            </button>

            <button
              class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition disabled:opacity-60"
              :disabled="saving"
              @click="saveBlog('review')"
            >
              {{ canSkipApproval ? 'Save as Approved' : 'Send for Review' }}
            </button>

            <button
              v-if="isAdmin || canSkipApproval"
              class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition disabled:opacity-60"
              :disabled="publishing"
              @click="publishSelected"
            >
              Publish
            </button>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm font-semibold">Title</label>
              <input
                v-model="form.title"
                type="text"
                class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold">Slug</label>
              <input
                v-model="form.slug"
                type="text"
                class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold">Excerpt</label>
              <textarea
                v-model="form.excerpt"
                rows="4"
                class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="mb-2 block text-sm font-semibold">Category</label>
                <input
                  v-model="form.category"
                  type="text"
                  placeholder="Game Dev, AR/VR, VFX..."
                  class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold">Reading Time</label>
                <input
                  v-model.number="form.reading_time_minutes"
                  type="number"
                  min="1"
                  class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
                >
              </div>
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold">Tags</label>
              <input
                v-model="form.tagsText"
                type="text"
                placeholder="unity, webgl, blog"
                class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold">Cover Image</label>
              <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  class="block w-full text-sm"
                  @change="onCoverFileChange"
                >
                <div class="mt-2 text-xs text-black/60 dark:text-white/60">
                  Upload goes to bucket: <span class="font-medium">{{ COVER_BUCKET }}</span>
                </div>
              </div>
            </div>

            <div v-if="form.cover_image_url" class="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
              <img :src="form.cover_image_url" alt="" class="h-48 w-full object-cover">
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm font-semibold">SEO Title</label>
              <input
                v-model="form.seo_title"
                type="text"
                class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold">SEO Description</label>
              <textarea
                v-model="form.seo_description"
                rows="4"
                class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold">SEO Keywords</label>
              <input
                v-model="form.seo_keywords_text"
                type="text"
                class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
              >
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="mb-2 block text-sm font-semibold">Schedule At</label>
                <input
                  v-model="form.scheduled_at"
                  type="datetime-local"
                  class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
                >
              </div>

              <div>
                <label class="mb-2 block text-sm font-semibold">Publish At</label>
                <input
                  v-model="form.published_at"
                  type="datetime-local"
                  class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
                >
              </div>
            </div>

            <div class="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
              <div class="text-sm font-semibold">Editor Info</div>
              <div class="mt-2 text-sm text-black/70 dark:text-white/70">
                {{ currentUserProfile?.display_name || 'User' }}
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <span :class="pill(form.status)">{{ form.status }}</span>
                <span v-if="canSkipApproval" :class="pill('approved')">Auto approved access</span>
              </div>
            </div>

            <div
              v-if="selectedBlog?.status === 'rejected' && selectedBlog?.rejection_reason"
              class="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4"
            >
              <div class="text-sm font-semibold text-rose-800 dark:text-rose-200">
                Rejection reason
              </div>
              <div class="mt-2 text-sm text-rose-900/80 dark:text-rose-100/80">
                {{ selectedBlog.rejection_reason }}
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-base font-semibold">Markdown Editor</div>
              <div class="text-xs text-black/60 dark:text-white/60">
                Easier for headings, bullet points, links, quotes, and long articles.
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-xs"
                :class="markdownMode === 'edit' ? 'bg-black/10 dark:bg-white/10' : 'bg-white dark:bg-white/5'"
                @click="markdownMode = 'edit'"
              >
                Edit
              </button>
              <button
                type="button"
                class="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-xs"
                :class="markdownMode === 'preview' ? 'bg-black/10 dark:bg-white/10' : 'bg-white dark:bg-white/5'"
                @click="markdownMode = 'preview'"
              >
                Preview
              </button>
              <button
                type="button"
                class="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-xs"
                :class="markdownMode === 'split' ? 'bg-black/10 dark:bg-white/10' : 'bg-white dark:bg-white/5'"
                @click="markdownMode = 'split'"
              >
                Split
              </button>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs" @click="insertHeading(1)">H1</button>
            <button type="button" class="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs" @click="insertHeading(2)">H2</button>
            <button type="button" class="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs" @click="insertHeading(3)">H3</button>
            <button type="button" class="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs" @click="boldSelection()">Bold</button>
            <button type="button" class="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs" @click="italicSelection()">Italic</button>
            <button type="button" class="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs" @click="insertBulletList()">Bullet List</button>
            <button type="button" class="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs" @click="insertNumberList()">Numbered List</button>
            <button type="button" class="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs" @click="insertQuote()">Quote</button>
            <button type="button" class="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs" @click="insertLink()">Link</button>
            <label class="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs cursor-pointer">
              Upload Image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                class="hidden"
                @change="onInlineImageUpload"
              >
            </label>
          </div>

          <div class="mt-3 flex flex-wrap gap-2 text-xs text-black/60 dark:text-white/60">
            <span class="rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 bg-black/5 dark:bg-white/5">
              Words: {{ n(markdownWordCount) }}
            </span>
            <span class="rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 bg-black/5 dark:bg-white/5">
              Characters: {{ n(markdownCharCount) }}
            </span>
          </div>

          <div
            class="mt-4 grid gap-4"
            :class="markdownMode === 'split' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'"
          >
            <div v-if="markdownMode === 'edit' || markdownMode === 'split'" class="min-w-0">
              <textarea
                id="markdown-editor"
                v-model="form.content_markdown"
                rows="22"
                spellcheck="false"
                class="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-neutral-950 text-white px-4 py-4 outline-none font-mono text-sm"
                placeholder="Write your article in Markdown..."
              />
            </div>

            <div v-if="markdownMode === 'preview' || markdownMode === 'split'" class="min-w-0">
              <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-5 min-h-[520px] overflow-auto">
                <div
                  class="prose prose-neutral max-w-none dark:prose-invert"
                  v-html="renderedMarkdown"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-base font-semibold">Gallery Images</div>
              <div class="text-xs text-black/60 dark:text-white/60">Upload to gallery bucket.</div>
            </div>

            <button
              type="button"
              class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
              @click="addGalleryRow"
            >
              Add Image
            </button>
          </div>

          <div class="mt-4 space-y-3">
            <div
              v-for="(img, index) in form.gallery"
              :key="img.id || index"
              class="grid grid-cols-1 lg:grid-cols-[1fr_1fr_140px_auto] gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3"
            >
              <div class="lg:col-span-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  class="block w-full text-sm"
                  @change="onGalleryFileChange(index, $event)"
                >
                <div class="mt-2 text-xs text-black/60 dark:text-white/60">
                  Bucket: <span class="font-medium">{{ GALLERY_BUCKET }}</span>
                </div>
              </div>

              <input
                v-model.number="img.sort_order"
                type="number"
                placeholder="Sort"
                class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
              >

              <button
                type="button"
                class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
                @click="removeGalleryRow(index)"
              >
                Remove
              </button>

              <input
                v-model="img.alt"
                type="text"
                placeholder="Alt text"
                class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
              >

              <input
                v-model="img.caption"
                type="text"
                placeholder="Caption"
                class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
              >

              <div class="lg:col-span-2 rounded-xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-white/5 min-h-[140px]">
                <img
                  v-if="img.url"
                  :src="img.url"
                  alt=""
                  class="h-40 w-full object-cover"
                >
                <div v-else class="h-40 w-full grid place-items-center text-xs opacity-60">
                  {{ img.uploading ? 'Uploading…' : 'No image uploaded' }}
                </div>
              </div>
            </div>

            <div v-if="form.gallery.length === 0" class="text-sm text-black/60 dark:text-white/60">
              No gallery images added yet.
            </div>
          </div>
        </div>

        <div v-if="isAdmin && form.id" class="mt-6 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4">
          <div class="text-base font-semibold">Admin Review Actions</div>
          <div class="mt-1 text-xs text-black/60 dark:text-white/60">
            Rejection reason is admin-managed only.
          </div>

          <div class="mt-4">
            <label class="mb-2 block text-sm font-semibold">Rejection Reason</label>
            <textarea
              v-model="adminRejectReason"
              rows="4"
              class="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 outline-none"
            />
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button
              class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
              @click="approveSelected"
            >
              Approve
            </button>

            <button
              class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
              @click="rejectSelected"
            >
              Reject
            </button>

            <button
              class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
              @click="publishSelected"
            >
              Publish
            </button>

            <button
              class="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition disabled:opacity-60"
              :disabled="deleting"
              @click="archiveSelected"
            >
              Archive
            </button>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
          <div class="text-base font-semibold">Quick Preview</div>

          <div class="mt-4 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-white/5">
            <div v-if="form.cover_image_url" class="aspect-[16/9]">
              <img :src="form.cover_image_url" alt="" class="h-full w-full object-cover">
            </div>
            <div v-else class="aspect-[16/9] grid place-items-center text-xs opacity-60">
              No cover image
            </div>

            <div class="p-4">
              <div class="flex flex-wrap gap-2">
                <span v-if="form.category" class="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2.5 py-1 text-xs">
                  {{ form.category }}
                </span>
                <span :class="pill(form.status)">
                  {{ form.status }}
                </span>
              </div>

              <h3 class="mt-3 text-lg font-semibold leading-tight">
                {{ form.title || 'Untitled blog' }}
              </h3>

              <p class="mt-2 text-sm text-black/70 dark:text-white/70 line-clamp-3">
                {{ form.excerpt || 'Blog excerpt will appear here.' }}
              </p>

              <div class="mt-3 text-xs text-black/50 dark:text-white/50">
                {{ form.reading_time_minutes || 5 }} min read
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
          <div class="text-base font-semibold">Markdown Help</div>
          <div class="mt-3 space-y-2 text-sm text-black/70 dark:text-white/70">
            <p><span class="font-medium"># Heading</span> for big title</p>
            <p><span class="font-medium">## Heading</span> for section title</p>
            <p><span class="font-medium">- item</span> for bullet points</p>
            <p><span class="font-medium">[Text](URL)</span> for links</p>
            <p><span class="font-medium">![Alt](URL)</span> for images</p>
            <p><span class="font-medium">&gt; Quote</span> for callout text</p>
          </div>
        </div>

        <div v-if="isAdmin" class="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4">
          <div class="text-base font-semibold">Recent Blog Activity</div>
          <div class="mt-1 text-xs text-black/60 dark:text-white/60">
            Admin only
          </div>

          <div class="mt-4 space-y-3 max-h-[50dvh] overflow-auto pr-1">
            <div
              v-for="log in recentLogs"
              :key="log.id"
              class="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="text-sm font-semibold">
                  {{ log.action }}
                </div>
                <div class="text-[11px] text-black/50 dark:text-white/50">
                  {{ fmtDT(log.created_at) }}
                </div>
              </div>

              <div class="mt-1 text-xs text-black/60 dark:text-white/60">
                {{ profileMap[log.actor_user_id || ''] || 'Unknown user' }}
              </div>

              <div
                v-if="log.meta && Object.keys(log.meta).length"
                class="mt-2 text-[11px] text-black/50 dark:text-white/50 break-all"
              >
                {{ JSON.stringify(log.meta) }}
              </div>
            </div>

            <div v-if="recentLogs.length === 0" class="text-sm text-black/60 dark:text-white/60">
              No recent activity.
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>