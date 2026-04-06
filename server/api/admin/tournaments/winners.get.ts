// server/api/admin/tournaments/winners.get.ts
import { createClient } from '@supabase/supabase-js'
import {
  serverSupabaseClient,
  serverSupabaseSession,
  serverSupabaseUser
} from '#supabase/server'
import { createError, defineEventHandler, getHeader, getQuery } from 'h3'

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

  const query = getQuery(event)
  const tournamentId = String(query.tournamentId || '').trim()
  const tournamentSlugFromQuery = String(query.tournamentSlug || '').trim()

  if (!tournamentId && !tournamentSlugFromQuery) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing tournamentId or tournamentSlug'
    })
  }

  let tournamentSlug = tournamentSlugFromQuery
  let resolvedTournamentId = tournamentId

  if (tournamentId) {
    const { data: t, error: tErr } = await db
      .from('tournaments')
      .select('id, slug')
      .eq('id', tournamentId)
      .maybeSingle()

    if (tErr) {
      throw createError({
        statusCode: 400,
        statusMessage: tErr.message
      })
    }

    if (!t?.slug) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    tournamentSlug = String((t as any).slug || '').trim()
    resolvedTournamentId = String((t as any).id || '').trim()
  } else if (tournamentSlugFromQuery) {
    const { data: t, error: tErr } = await db
      .from('tournaments')
      .select('id, slug')
      .eq('slug', tournamentSlugFromQuery)
      .maybeSingle()

    if (tErr) {
      throw createError({
        statusCode: 400,
        statusMessage: tErr.message
      })
    }

    if (!t?.id) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }

    tournamentSlug = String((t as any).slug || '').trim()
    resolvedTournamentId = String((t as any).id || '').trim()
  }

  const { data, error } = await db
    .from('tournament_winners')
    .select(`
      id,
      tournament_id,
      tournament_slug,
      rank,
      user_id,
      player_name,
      score,
      prize_id,
      prize,
      prize_label,
      prize_bdt,
      reward_status,
      reward_method,
      reward_txn_id,
      rewarded_at,
      created_at,
      tournament_prize:tournament_prizes (
        id,
        rank,
        title,
        description,
        image_url,
        image_path
      )
    `)
    .eq('tournament_slug', tournamentSlug)
    .order('rank', { ascending: true })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  const rows = (data || []).map((r: any) => ({
    ...r,
    tournament_id: r.tournament_id || resolvedTournamentId
  }))

  return { rows }
})