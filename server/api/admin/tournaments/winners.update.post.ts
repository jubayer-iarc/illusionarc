// server/api/admin/tournaments/winners.update.post.ts
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

function asNullableTrimmedString(v: any) {
  const s = String(v || '').trim()
  return s || null
}

function asSafeInteger(v: any, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.floor(n) : fallback
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const adminDb = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const id = String(body?.id || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing winner row id' })
  }

  const patch: Record<string, any> = {}

  // Optional editable fields
  if (body.player_name != null) {
    patch.player_name = asNullableTrimmedString(body.player_name)
  }

  if (body.score != null) {
    patch.score = asSafeInteger(body.score, 0)
  }

  if (body.prize_bdt != null) {
    patch.prize_bdt = Math.max(0, asSafeInteger(body.prize_bdt, 0))
  }

  if (body.rank != null) {
    patch.rank = Math.max(1, asSafeInteger(body.rank, 1))
  }

  // Reward fulfillment fields
  if (body.reward_status != null) {
    const v = String(body.reward_status || '').trim().toLowerCase()
    patch.reward_status = v === 'given' ? 'given' : 'pending'
  }

  if (body.reward_method != null) {
    const v = String(body.reward_method || '').trim().toLowerCase()
    patch.reward_method = v === 'online' || v === 'offline' ? v : null
  }

  if (body.reward_txn_id != null) {
    patch.reward_txn_id = asNullableTrimmedString(body.reward_txn_id)
  }

  // Load existing row so validation works even for partial updates
  const { data: existing, error: existingErr } = await adminDb
    .from('tournament_winners')
    .select('id, reward_status, reward_method, reward_txn_id')
    .eq('id', id)
    .maybeSingle()

  if (existingErr) {
    throw createError({ statusCode: 400, statusMessage: existingErr.message })
  }
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Winner row not found' })
  }

  const finalStatus = patch.reward_status ?? existing.reward_status ?? 'pending'
  const finalMethod = patch.reward_method ?? existing.reward_method ?? null
  const finalTxn = patch.reward_txn_id ?? existing.reward_txn_id ?? null

  if (finalStatus === 'given' && finalMethod === 'online' && !String(finalTxn || '').trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Transaction ID required for online reward marked as given'
    })
  }

  if (patch.reward_status === 'given') {
    patch.rewarded_at = new Date().toISOString()
  } else if (patch.reward_status === 'pending') {
    patch.rewarded_at = null
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const { data, error } = await adminDb
    .from('tournament_winners')
    .update(patch)
    .eq('id', id)
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
      created_at
    `)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Winner row not found' })
  }

  return { ok: true, row: data }
})