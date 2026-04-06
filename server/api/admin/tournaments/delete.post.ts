// server/api/admin/tournaments/delete.post.ts
import { createClient } from '@supabase/supabase-js'
import {
  serverSupabaseClient,
  serverSupabaseSession,
  serverSupabaseUser
} from '#supabase/server'
import { createError, defineEventHandler, getHeader, readBody } from 'h3'

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

  const cookieClient = await serverSupabaseClient(event)
  const cookieUser = await serverSupabaseUser(event)
  const cookieSession = await serverSupabaseSession(event)

  if (cookieUser?.id && cookieSession?.access_token) {
    return {
      db: cookieClient,
      user: cookieUser
    }
  }

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
      user: data.user
    }
  }

  throw createError({
    statusCode: 401,
    statusMessage: 'Login required'
  })
}

async function requireAdmin(event: any) {
  const { db, user } = await createAuthedSupabase(event)

  const { data: prof, error: profErr } = await db
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profErr) {
    throw createError({
      statusCode: 500,
      statusMessage: profErr.message
    })
  }

  if (String((prof as any)?.role || '').toLowerCase() !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin only'
    })
  }

  return db
}

export default defineEventHandler(async (event) => {
  const db = await requireAdmin(event)
  const body = await readBody(event)

  const id = String(body?.id || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const { data: t, error: tErr } = await db
    .from('tournaments')
    .select('id, slug')
    .eq('id', id)
    .maybeSingle()

  if (tErr) {
    throw createError({ statusCode: 400, statusMessage: tErr.message })
  }

  if (!t?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
  }

  const tournamentSlug = String((t as any).slug || '').trim()

  // 1) Delete winners linked to this tournament
  {
    const { error } = await db
      .from('tournament_winners')
      .delete()
      .eq('tournament_id', id)

    if (error) {
      const { error: slugErr } = await db
        .from('tournament_winners')
        .delete()
        .eq('tournament_slug', tournamentSlug)

      if (slugErr) {
        throw createError({ statusCode: 400, statusMessage: slugErr.message })
      }
    }
  }

  // 2) Delete tournament scores
  {
    const { error } = await db
      .from('tournament_scores')
      .delete()
      .eq('tournament_id', id)

    if (error) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
  }

  // 3) Delete tournament ads
  {
    const { error } = await db
      .from('tournament_ads')
      .delete()
      .eq('tournament_id', id)

    if (error) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
  }

  // 4) Delete prize assignments only, NOT prize library
  {
    const { error } = await db
      .from('tournament_prize_map')
      .delete()
      .eq('tournament_id', id)

    if (error) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
  }

  // 5) Delete tournament
  {
    const { error } = await db
      .from('tournaments')
      .delete()
      .eq('id', id)

    if (error) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
  }

  return { ok: true }
})