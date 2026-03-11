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

  // Load tournament first
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

  // Block delete if winners exist
  const { data: winners, error: wErr } = await adminDb
    .from('tournament_winners')
    .select('id')
    .or(`tournament_id.eq.${id},tournament_slug.eq.${tournamentSlug}`)
    .limit(1)

  if (wErr) {
    throw createError({ statusCode: 400, statusMessage: wErr.message })
  }

  if ((winners || []).length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete: winners exist (finalized)'
    })
  }

  // Delete child rows that belong only to this tournament
  const { error: mapErr } = await adminDb
    .from('tournament_prize_map')
    .delete()
    .eq('tournament_id', id)

  if (mapErr) {
    throw createError({ statusCode: 400, statusMessage: mapErr.message })
  }

  const { error: adsErr } = await adminDb
    .from('tournament_ads')
    .delete()
    .eq('tournament_id', id)

  if (adsErr) {
    throw createError({ statusCode: 400, statusMessage: adsErr.message })
  }

  const { error: scoresErr } = await adminDb
    .from('tournament_scores')
    .delete()
    .eq('tournament_id', id)

  if (scoresErr) {
    throw createError({ statusCode: 400, statusMessage: scoresErr.message })
  }

  // Do NOT delete reusable prize library rows from tournament_prizes

  const { error: delErr } = await adminDb
    .from('tournaments')
    .delete()
    .eq('id', id)

  if (delErr) {
    throw createError({ statusCode: 400, statusMessage: delErr.message })
  }

  return { ok: true }
})