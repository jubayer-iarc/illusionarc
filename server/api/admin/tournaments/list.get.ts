// server/api/admin/tournaments/list.get.ts
import { createClient } from '@supabase/supabase-js'
import {
  serverSupabaseClient,
  serverSupabaseSession,
  serverSupabaseUser
} from '#supabase/server'
import {
  createError,
  defineEventHandler,
  getHeader,
  getQuery
} from 'h3'

function getBearerToken(event: any): string | null {
  const authHeader =
    getHeader(event, 'authorization') ||
    getHeader(event, 'Authorization')

  if (!authHeader) return null

  const match = String(authHeader).match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

async function createAuthedSupabase(event: any) {
  const runtime = useRuntimeConfig()

  const supabaseUrl =
    runtime.public.supabaseUrl || process.env.SUPABASE_URL
  const supabaseAnonKey =
    runtime.public.supabaseAnonKey || process.env.SUPABASE_KEY

  if (!supabaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing SUPABASE_URL'
    })
  }

  if (!supabaseAnonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing SUPABASE_KEY'
    })
  }

  // 1) First try the normal Nuxt Supabase server client/session
  const cookieClient = await serverSupabaseClient(event)
  const cookieUser = await serverSupabaseUser(event)
  const cookieSession = await serverSupabaseSession(event)

  if (cookieUser?.id && cookieSession?.access_token) {
    return {
      db: cookieClient,
      user: cookieUser,
      accessToken: cookieSession.access_token
    }
  }

  // 2) Then try explicit Bearer token fallback
  const bearer = getBearerToken(event)
  if (bearer) {
    const bearerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${bearer}`
        }
      }
    })

    const { data, error } = await bearerClient.auth.getUser()

    if (error || !data?.user?.id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Login required'
      })
    }

    return {
      db: bearerClient,
      user: data.user,
      accessToken: bearer
    }
  }

  throw createError({
    statusCode: 401,
    statusMessage: 'Login required'
  })
}

async function requireAdmin(event: any) {
  const { db, user } = await createAuthedSupabase(event)

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    throw createError({
      statusCode: 500,
      statusMessage: profileError.message
    })
  }

  if (String(profile?.role || '').toLowerCase() !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin only'
    })
  }

  return db
}

export default defineEventHandler(async (event) => {
  const db = await requireAdmin(event)
  const query = getQuery(event)

  const q = String(query.q || '').trim()

  const statusRaw = String(query.status ?? '').trim()
  const status = statusRaw && statusRaw !== 'all' ? statusRaw : ''

  const gameRaw = String((query.gameSlug ?? query.game) ?? '').trim()
  const game = gameRaw && gameRaw !== 'all' ? gameRaw : ''

  let req = db
    .from('tournaments')
    .select([
      'id',
      'slug',
      'title',
      'description',
      'game_slug',
      'starts_at',
      'ends_at',
      'status',
      'finalized',
      'created_at',
      'updated_at',
      'thumbnail_url',
      'thumbnail_path',
      'promo_video_type',
      'promo_video_url',
      'promo_video_path',
      'promo_video_youtube_id',
      'promo_video_title'
    ].join(','))
    .order('starts_at', { ascending: false })

  if (q) {
    const safeQ = q.replace(/[,%]/g, ' ').trim()
    req = req.or(`title.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`)
  }

  if (status) {
    req = req.eq('status', status)
  }

  if (game) {
    req = req.eq('game_slug', game)
  }

  const { data, error } = await req

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  return {
    rows: data || []
  }
})