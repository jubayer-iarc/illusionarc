// server/api/admin/tournaments/winners.update.post.ts
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'

async function requireAdmin(event: any) {
  const client = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await client.auth.getUser()
  const user = auth?.user
  if (authErr || !user?.id) throw createError({ statusCode: 401, statusMessage: 'Login required' })

  const { data: prof, error: profErr } = await client
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profErr) throw createError({ statusCode: 500, statusMessage: profErr.message })
  if (String((prof as any)?.role || '').toLowerCase() !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const adminDb = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const id = String(body?.id || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing winner row id' })

  const patch: any = {}

  // ---- existing editable fields (keep if you still use them anywhere) ----
  if (body.player_name != null) patch.player_name = String(body.player_name || '').trim() || null

  if (body.score != null) {
    const n = Number(body.score)
    patch.score = Number.isFinite(n) ? n : 0
  }

  if (body.prize_bdt != null) {
    const n = Number(body.prize_bdt)
    patch.prize_bdt = Number.isFinite(n) ? n : 0
  }

  if (body.rank != null) {
    const n = Number(body.rank)
    patch.rank = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1
  }

  // ---- NEW: reward fulfillment fields ----
  // Expected values:
  // reward_status: 'pending' | 'given'
  // reward_method: 'online' | 'offline' | null
  // reward_txn_id: string | null (required if online + given)
  if (body.reward_status != null) {
    const v = String(body.reward_status || '').trim().toLowerCase()
    patch.reward_status = v === 'given' ? 'given' : 'pending'
  }

  if (body.reward_method != null) {
    const v = String(body.reward_method || '').trim().toLowerCase()
    patch.reward_method = v ? v : null
  }

  if (body.reward_txn_id != null) {
    const v = String(body.reward_txn_id || '').trim()
    patch.reward_txn_id = v || null
  }

  // Validation: txn id required for online + given
  const finalStatus = patch.reward_status ?? null
  const finalMethod = patch.reward_method ?? null
  const finalTxn = patch.reward_txn_id ?? null
  if (finalStatus === 'given' && finalMethod === 'online' && !finalTxn) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Transaction ID required for online reward marked as given'
    })
  }

  // Optional: track time of reward
  if (patch.reward_status === 'given') {
    patch.rewarded_at = new Date().toISOString()
  }
  if (patch.reward_status === 'pending') {
    patch.rewarded_at = null
  }

  // IMPORTANT: prevent empty updates (this causes 0 rows and .single() crash)
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const { data, error } = await adminDb
    .from('tournament_winners')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle() // ✅ avoids "Cannot coerce..." when 0 rows

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Winner row not found' })

  return { ok: true, row: data }
})
