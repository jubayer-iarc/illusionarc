// server/api/admin/tournaments/delete.post.ts
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'

async function requireAdmin(event: any) {
  const client = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user

  if (authErr || !user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  }

  const { data: prof, error: profErr } = await client
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profErr) {
    throw createError({ statusCode: 500, statusMessage: profErr.message })
  }

  if (String((prof as any)?.role || '').toLowerCase() !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const adminDb = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const id = String(body?.id || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  // Get tournament first
  const { data: t, error: tErr } = await adminDb
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
    const { error } = await adminDb
      .from('tournament_winners')
      .delete()
      .eq('tournament_id', id)

    if (error) {
      // fallback by slug if needed
      const { error: slugErr } = await adminDb
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
    const { error } = await adminDb
      .from('tournament_scores')
      .delete()
      .eq('tournament_id', id)

    if (error) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
  }

  // 3) Delete tournament ads
  {
    const { error } = await adminDb
      .from('tournament_ads')
      .delete()
      .eq('tournament_id', id)

    if (error) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
  }

  // 4) Delete prize assignments only, NOT prize library
  {
    const { error } = await adminDb
      .from('tournament_prize_map')
      .delete()
      .eq('tournament_id', id)

    if (error) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
  }

  // 5) Delete tournament
  {
    const { error } = await adminDb
      .from('tournaments')
      .delete()
      .eq('id', id)

    if (error) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
  }

  return { ok: true }
})