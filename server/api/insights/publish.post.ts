import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  // Read directly from process.env as primary source (always current on Vercel/production).
  // Falls back to runtimeConfig for local development via .env file.
  const config = useRuntimeConfig()
  const validKey = process.env.NUXT_PUBLISHER_API_KEY
    || process.env.PUBLISHER_API_KEY
    || config.publisherApiKey

  // 1. Authentication
  const authHeader = getHeader(event, 'authorization') || ''
  const publisherKeyHeader = getHeader(event, 'x-publisher-key') || ''

  let incomingKey = publisherKeyHeader
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    incomingKey = authHeader.substring(7)
  }

  if (!incomingKey || !validKey || incomingKey !== validKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Invalid or missing Publisher API Key'
    })
  }

  // 2. Parse Payload
  const body = await readBody(event)

  if (!body.title || typeof body.title !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing or invalid "title"'
    })
  }

  if (!body.content_markdown || typeof body.content_markdown !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Missing or invalid "content_markdown"'
    })
  }

  // 3. Defaults & Data Transformation
  
  // Auto-generate slug if not provided
  let slug = body.slug
  if (!slug || typeof slug !== 'string') {
    slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
  }

  // Auto-calculate reading time if not provided (~200 words/min)
  let readingTime = body.reading_time_minutes
  if (typeof readingTime !== 'number') {
    const wordCount = body.content_markdown.trim().split(/\s+/).length
    readingTime = Math.max(1, Math.ceil(wordCount / 200))
  }

  // Status defaults to 'published'
  const validStatuses = ['published', 'draft', 'in_review', 'approved', 'archived', 'rejected']
  let status = body.status
  if (!status || !validStatuses.includes(status)) {
    status = 'published'
  }

  const payload = {
    title: body.title,
    slug: slug,
    excerpt: body.excerpt || null,
    cover_image_url: body.cover_image_url || null,
    category: body.category || null,
    tags: Array.isArray(body.tags) ? body.tags : null,
    seo_title: body.seo_title || null,
    seo_description: body.seo_description || null,
    content_markdown: body.content_markdown,
    status: status,
    reading_time_minutes: readingTime,
    published_at: body.published_at || new Date().toISOString()
  }

  // 4. Insert into Supabase using Service Role (bypass RLS)
  try {
    const supabaseService = serverSupabaseServiceRole(event)
    
    const { data, error } = await supabaseService
      .from('blogs')
      .insert([payload])
      .select('id, slug')
      .single()

    if (error) {
      throw error
    }

    return {
      success: true,
      message: 'Article successfully published.',
      article: data
    }

  } catch (error: any) {
    console.error('Publisher API Error:', error)
    
    // Check for unique constraint violation (duplicate slug)
    if (error?.code === '23505') {
       throw createError({
        statusCode: 409,
        statusMessage: 'Conflict: An article with this slug already exists.'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Could not save article to database.'
    })
  }
})
