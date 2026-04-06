// server/api/admin/works/save.post.ts
import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { createError, defineEventHandler, getHeader, readBody } from 'h3'

type Body = {
  id: string | null
  draftId: string

  pendingHeroPath: string | null
  pendingGalleryPaths: string[]
  heroAlt: string | null

  title: string
  category: string
  short_description: string | null
  year: number | null
  role: string | null
  tools: string[]
  tags: string[]
  highlights: string[]
  outcome: string | null
  cta: string | null
  is_active: boolean
  sort_order: number
}

function getBearerToken(event: any): string | null {
  const h = getHeader(event, 'authorization') || getHeader(event, 'Authorization')
  if (!h) return null
  const m = String(h).match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

function asUuidOrNull(v: any): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s === 'undefined' || s === 'null') return null
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  return ok ? s : null
}

function asStringOrNull(v: any): string | null {
  const s = String(v ?? '').trim()
  if (!s || s === 'undefined' || s === 'null') return null
  return s
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

async function generateUniqueSlug(db: any, title: string) {
  const base = baseSlugFromTitle(title)
  if (!base) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required.' })
  }

  const { data, error } = await db
    .from('works')
    .select('slug')
    .ilike('slug', `${base}%`)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const slugs = (data || []).map((r: any) => String(r.slug))
  if (!slugs.includes(base)) return base

  let max = 1
  for (const s of slugs) {
    const m = s.match(new RegExp(`^${base}-(\\d+)$`))
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n >= max) max = n + 1
    }
  }

  return `${base}-${max}`
}

function extFromPath(path: string) {
  const m = String(path).match(/\.([a-zA-Z0-9]+)$/)
  return m ? m[1].toLowerCase() : 'png'
}

function nextGalleryIndexFromExisting(paths: string[]) {
  let max = 0
  for (const p of paths) {
    const m = String(p).match(/gallery-(\d{3})\./)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

function ensureCleanPath(path: string | null, fieldName: string): string | null {
  if (!path) return null
  const p = String(path).trim().replace(/^\/+/, '')
  if (!p) return null
  if (p.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} is invalid` })
  }
  return p
}

async function createAuthedSupabase(event: any) {
  const runtime = useRuntimeConfig()
  const supabaseUrl = runtime.public.supabaseUrl || process.env.SUPABASE_URL
  const anonKey = runtime.public.supabaseAnonKey || process.env.SUPABASE_KEY

  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Missing SUPABASE_URL' })
  }

  if (!anonKey) {
    throw createError({ statusCode: 500, statusMessage: 'Missing SUPABASE_KEY' })
  }

  let user = await serverSupabaseUser(event)
  let db: any = await serverSupabaseClient(event)

  if (!user?.id) {
    const token = getBearerToken(event)
    if (!token) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    db = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data, error } = await db.auth.getUser()
    if (error || !data?.user?.id) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    user = data.user
  }

  return { db, user }
}

async function moveObjectOrThrow(db: any, bucket: string, from: string, to: string) {
  if (from === to) return

  const { error } = await db.storage.from(bucket).move(from, to)
  if (error) {
    throw createError({
      statusCode: 403,
      statusMessage: `Storage move failed: ${error.message}`
    })
  }
}

async function removeObjectIfExists(db: any, bucket: string, path: string | null | undefined) {
  if (!path) return
  try {
    await db.storage.from(bucket).remove([path])
  } catch {
    // ignore cleanup errors
  }
}

export default defineEventHandler(async (event) => {
  const { db, user } = await createAuthedSupabase(event)
  const bucket = 'works'

  // --- admin check ---
  const { data: prof, error: pErr } = await db
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (pErr) {
    throw createError({ statusCode: 403, statusMessage: pErr.message })
  }

  if (prof?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }

  // --- normalize body ---
  const raw = (await readBody(event)) as any

  const body: Body = {
    id: asUuidOrNull(raw?.id),
    draftId: String(raw?.draftId || '').trim(),

    pendingHeroPath: ensureCleanPath(asStringOrNull(raw?.pendingHeroPath), 'pendingHeroPath'),
    pendingGalleryPaths: Array.isArray(raw?.pendingGalleryPaths)
      ? raw.pendingGalleryPaths
          .filter((x: any) => typeof x === 'string')
          .map((s: string) => ensureCleanPath(s, 'pendingGalleryPaths'))
          .filter((s: string | null): s is string => !!s)
      : [],
    heroAlt: asStringOrNull(raw?.heroAlt),

    title: String(raw?.title || '').trim(),
    category: String(raw?.category || '').trim(),
    short_description: asStringOrNull(raw?.short_description),
    year: raw?.year == null || raw?.year === '' ? null : Number(raw.year),
    role: asStringOrNull(raw?.role),
    tools: Array.isArray(raw?.tools) ? raw.tools.map((x: any) => String(x).trim()).filter(Boolean) : [],
    tags: Array.isArray(raw?.tags) ? raw.tags.map((x: any) => String(x).trim()).filter(Boolean) : [],
    highlights: Array.isArray(raw?.highlights)
      ? raw.highlights.map((x: any) => String(x).trim()).filter(Boolean)
      : [],
    outcome: asStringOrNull(raw?.outcome),
    cta: asStringOrNull(raw?.cta),
    is_active: !!raw?.is_active,
    sort_order: Number(raw?.sort_order ?? 100)
  }

  if (!body.title) {
    throw createError({ statusCode: 400, statusMessage: 'Title required' })
  }

  if (!body.category) {
    throw createError({ statusCode: 400, statusMessage: 'Category required' })
  }

  if (!body.draftId) {
    throw createError({ statusCode: 400, statusMessage: 'draftId required' })
  }

  if (body.year !== null && !Number.isFinite(body.year)) {
    throw createError({ statusCode: 400, statusMessage: 'year must be a number' })
  }

  if (!Number.isFinite(body.sort_order)) {
    body.sort_order = 100
  }

  // Important safety guard:
  // pending files should stay inside this draft folder.
  const draftPrefix = `_tmp/${body.draftId}/`

  if (body.pendingHeroPath && !body.pendingHeroPath.startsWith(draftPrefix)) {
    throw createError({ statusCode: 400, statusMessage: 'pendingHeroPath is outside draft folder' })
  }

  for (const p of body.pendingGalleryPaths) {
    if (!p.startsWith(draftPrefix)) {
      throw createError({ statusCode: 400, statusMessage: 'A gallery file is outside draft folder' })
    }
  }

  // --- determine final slug ---
  let workId = body.id
  let finalSlug: string

  if (workId) {
    const { data: existing, error } = await db
      .from('works')
      .select('slug')
      .eq('id', workId)
      .single()

    if (error) {
      throw createError({ statusCode: 403, statusMessage: error.message })
    }

    finalSlug = String(existing.slug)
  } else {
    finalSlug = await generateUniqueSlug(db, body.title)
  }

  // --- upsert works row ---
  const payload = {
    slug: finalSlug,
    title: body.title,
    category: body.category,
    short_description: body.short_description,
    year: body.year,
    role: body.role,
    tools: body.tools,
    tags: body.tags,
    highlights: body.highlights,
    outcome: body.outcome,
    cta: body.cta,
    is_active: body.is_active,
    sort_order: body.sort_order,
    updated_at: new Date().toISOString()
  }

  if (workId) {
    const { error } = await db
      .from('works')
      .update(payload)
      .eq('id', workId)

    if (error) {
      throw createError({ statusCode: 403, statusMessage: error.message })
    }
  } else {
    const { data, error } = await db
      .from('works')
      .insert(payload)
      .select('id')
      .single()

    if (error) {
      throw createError({ statusCode: 403, statusMessage: error.message })
    }

    workId = asUuidOrNull(data?.id)
    if (!workId) {
      throw createError({ statusCode: 500, statusMessage: 'Insert returned invalid id' })
    }
  }

  // --- finalize hero ---
  if (body.pendingHeroPath) {
    const ext = extFromPath(body.pendingHeroPath)
    const finalPath = `${finalSlug}/hero.${ext}`

    const { data: oldHero, error: oldHeroErr } = await db
      .from('work_media')
      .select('id, path')
      .eq('work_id', workId)
      .eq('kind', 'hero')
      .maybeSingle()

    if (oldHeroErr) {
      throw createError({ statusCode: 403, statusMessage: oldHeroErr.message })
    }

    if (oldHero?.path && oldHero.path !== finalPath) {
      await removeObjectIfExists(db, bucket, oldHero.path)
    }

    await moveObjectOrThrow(db, bucket, body.pendingHeroPath, finalPath)

    if (oldHero?.id) {
      const { error } = await db
        .from('work_media')
        .update({
          path: finalPath,
          alt: body.heroAlt || null,
          sort_order: 0
        })
        .eq('id', oldHero.id)

      if (error) {
        throw createError({ statusCode: 403, statusMessage: error.message })
      }
    } else {
      const { error } = await db
        .from('work_media')
        .insert({
          work_id: workId,
          kind: 'hero',
          path: finalPath,
          alt: body.heroAlt || null,
          sort_order: 0
        })

      if (error) {
        throw createError({ statusCode: 403, statusMessage: error.message })
      }
    }
  }

  // --- finalize gallery (append after existing max) ---
  if (body.pendingGalleryPaths.length) {
    const { data: existingGallery, error: existingGalleryErr } = await db
      .from('work_media')
      .select('path')
      .eq('work_id', workId)
      .eq('kind', 'gallery')

    if (existingGalleryErr) {
      throw createError({ statusCode: 403, statusMessage: existingGalleryErr.message })
    }

    const existingPaths = (existingGallery || []).map((r: any) => String(r.path))
    let idx = nextGalleryIndexFromExisting(existingPaths)

    for (const tmpPath of body.pendingGalleryPaths) {
      const ext = extFromPath(tmpPath)
      const finalPath = `${finalSlug}/gallery-${String(idx).padStart(3, '0')}.${ext}`
      const sortOrder = idx * 10
      idx += 1

      await moveObjectOrThrow(db, bucket, tmpPath, finalPath)

      const { error } = await db
        .from('work_media')
        .insert({
          work_id: workId,
          kind: 'gallery',
          path: finalPath,
          alt: null,
          sort_order: sortOrder
        })

      if (error) {
        throw createError({ statusCode: 403, statusMessage: error.message })
      }
    }
  }

  // --- cleanup tmp folder best-effort ---
  try {
    const prefix = `_tmp/${body.draftId}`
    const { data: objects } = await db.storage.from(bucket).list(prefix, { limit: 200 })

    if (objects?.length) {
      const paths = objects.map((o: any) => `${prefix}/${o.name}`)
      await db.storage.from(bucket).remove(paths)
    }
  } catch {
    // ignore cleanup errors
  }

  // --- return saved work + media ---
  const { data: work, error: wErr } = await db
    .from('works')
    .select(`
      id,
      title,
      slug,
      category,
      short_description,
      year,
      role,
      tools,
      tags,
      highlights,
      outcome,
      cta,
      is_active,
      sort_order,
      created_at,
      updated_at,
      work_media (
        id,
        kind,
        path,
        alt,
        sort_order,
        created_at
      )
    `)
    .eq('id', workId)
    .single()

  if (wErr) {
    throw createError({ statusCode: 403, statusMessage: wErr.message })
  }

  return work
})