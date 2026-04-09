import { serverSupabaseClient } from '#supabase/server'
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

  return { client, user }
}

function asNullableTrimmedString(v: any) {
  const s = String(v || '').trim()
  return s || null
}

function asSafeInteger(v: any, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.floor(n) : fallback
}

function asNullableBoolean(v: any): boolean | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'boolean') return v

  const s = String(v).trim().toLowerCase()
  if (s === 'true' || s === '1') return true
  if (s === 'false' || s === '0') return false

  return null
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  const { client: adminDb } = await requireAdmin(event)
  const body = await readBody(event)

  const id = String(body?.id || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing winner row id' })
  }

  // First: verify row is selectable
  const { data: existing, error: existingErr } = await adminDb
    .from('tournament_winners')
    .select(`
      id,
      reward_status,
      reward_method,
      reward_txn_id,
      is_verified,
      verified_link
    `)
    .eq('id', id)
    .maybeSingle()

  if (existingErr) {
    throw createError({ statusCode: 400, statusMessage: existingErr.message })
  }

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Winner row not found or not readable by current RLS policy'
    })
  }

  const patch: Record<string, any> = {}

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

  if (body.is_verified !== undefined) {
    patch.is_verified = asNullableBoolean(body.is_verified)
  }

  if (body.verified_link !== undefined) {
    patch.verified_link = asNullableTrimmedString(body.verified_link)
  }

  const finalStatus = patch.reward_status ?? existing.reward_status ?? 'pending'
  const finalMethod = patch.reward_method ?? existing.reward_method ?? null
  const finalTxn = patch.reward_txn_id ?? existing.reward_txn_id ?? null
  const finalIsVerified = patch.is_verified ?? existing.is_verified ?? null
  const finalVerifiedLink = patch.verified_link ?? existing.verified_link ?? null

  if (finalStatus === 'given' && finalMethod === 'online' && !String(finalTxn || '').trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Transaction ID required for online reward marked as given'
    })
  }

  if (finalIsVerified === true) {
    const link = String(finalVerifiedLink || '').trim()

    if (!link) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Verification link required when winner is marked as verified'
      })
    }

    if (!isValidUrl(link)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Verification link must be a valid http/https URL'
      })
    }

    patch.verified_link = link
  }

  if (patch.is_verified === false) {
    patch.verified_link = null
  }

  if (patch.is_verified === null && body.verified_link === undefined) {
    patch.verified_link = null
  }

  if (patch.reward_status === 'given') {
    patch.rewarded_at = new Date().toISOString()
  } else if (patch.reward_status === 'pending') {
    patch.rewarded_at = null
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  // Second: do update WITHOUT select so we can detect permission issues better
  const { error: updateErr, count } = await adminDb
    .from('tournament_winners')
    .update(patch, { count: 'exact' })
    .eq('id', id)

  if (updateErr) {
    throw createError({ statusCode: 400, statusMessage: updateErr.message })
  }

  if (!count) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Update blocked by RLS policy or row is not updatable'
    })
  }

  // Third: re-read updated row
  const { data: updated, error: readBackErr } = await adminDb
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
      is_verified,
      verified_link,
      created_at
    `)
    .eq('id', id)
    .maybeSingle()

  if (readBackErr) {
    throw createError({ statusCode: 400, statusMessage: readBackErr.message })
  }

  if (!updated) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Updated, but row is not readable by current RLS policy'
    })
  }

  return { ok: true, row: updated }
})