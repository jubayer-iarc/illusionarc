// server/api/admin/tournaments/finalize.post.ts
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

function cleanName(x: any) {
  const s = String(x || '').trim()
  return s || 'Player'
}

function cleanText(x: any) {
  const s = String(x || '').trim()
  return s || null
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const adminDb = await serverSupabaseServiceRole(event)

  const body = await readBody(event)
  const tournamentId = String(body?.tournamentId || '').trim()
  if (!tournamentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tournamentId' })
  }

  const force = Boolean(body?.force ?? false)

  // Load tournament
  const { data: t, error: tErr } = await adminDb
    .from('tournaments')
    .select('id, slug, ends_at, status, finalized')
    .eq('id', tournamentId)
    .maybeSingle()

  if (tErr) {
    throw createError({ statusCode: 400, statusMessage: tErr.message })
  }
  if (!t?.slug) {
    throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
  }

  const tournamentSlug = String((t as any).slug || '').trim()

  // Prevent finalize before end time unless force
  const endsAt = String((t as any).ends_at || '')
  const endsMs = endsAt ? new Date(endsAt).getTime() : 0
  if (endsMs && Date.now() < endsMs && !force) {
    throw createError({ statusCode: 400, statusMessage: 'Tournament has not ended yet' })
  }

  // Load selected tournament prize mapping + reusable prize catalog rows
  const { data: prizeMapRows, error: prizeErr } = await adminDb
    .from('tournament_prize_map')
    .select(`
      id,
      tournament_id,
      prize_id,
      rank,
      created_at,
      updated_at,
      prize:tournament_prizes (
        id,
        title,
        description,
        image_url,
        image_path
      )
    `)
    .eq('tournament_id', tournamentId)
    .order('rank', { ascending: true })

  if (prizeErr) {
    throw createError({ statusCode: 400, statusMessage: prizeErr.message })
  }

  const prizes = (prizeMapRows || []) as Array<{
    id: string
    tournament_id: string
    prize_id: string
    rank: number
    prize?: {
      id: string
      title: string
      description?: string | null
      image_url?: string | null
      image_path?: string | null
    } | null
  }>

  // Force clears existing winners
  if (force) {
    const { error: delErr } = await adminDb
      .from('tournament_winners')
      .delete()
      .eq('tournament_slug', tournamentSlug)

    if (delErr) {
      throw createError({ statusCode: 400, statusMessage: delErr.message })
    }
  }

  // If already finalized and not force -> stop
  const { data: existing, error: exErr } = await adminDb
    .from('tournament_winners')
    .select('id')
    .eq('tournament_slug', tournamentSlug)
    .limit(1)

  if (exErr) {
    throw createError({ statusCode: 400, statusMessage: exErr.message })
  }
  if ((existing || []).length && !force) {
    throw createError({ statusCode: 400, statusMessage: 'Already finalized. Use force=true to re-finalize.' })
  }

  // Top scores
  const { data: top, error: topErr } = await adminDb
    .from('tournament_scores')
    .select('user_id, player_name, score, created_at')
    .eq('tournament_id', tournamentId)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(500)

  if (topErr) {
    throw createError({ statusCode: 400, statusMessage: topErr.message })
  }

  // Best per unique user
  const seen = new Set<string>()
  const unique: any[] = []

  for (const r of top || []) {
    const uid = String((r as any).user_id || '').trim()
    if (!uid) continue
    if (seen.has(uid)) continue

    seen.add(uid)
    unique.push(r)
  }

  if (!unique.length) {
    return { ok: true, winners: [], message: 'No scores found; nothing to finalize.' }
  }

  // If mapped prizes exist -> finalize up to mapped prize count
  // If none -> fallback to top 3 without prize mapping
  const maxWinners = prizes.length > 0 ? prizes.length : 3
  const finalists = unique.slice(0, maxWinners)

  const rows = finalists.map((r, idx) => {
    const rank = idx + 1
    const mapped = prizes.find((p) => Number(p.rank) === rank)
    const prize = mapped?.prize || null

    return {
      tournament_id: tournamentId,
      tournament_slug: tournamentSlug,
      rank,
      user_id: String((r as any).user_id || '').trim() || null,
      player_name: cleanName((r as any).player_name),
      score: Number((r as any).score || 0),

      prize_id: mapped?.prize_id || null,
      prize_label: cleanText(prize?.title),
      prize: cleanText(prize?.title)
    }
  })

  // Requires UNIQUE(tournament_slug, rank)
  const { data: inserted, error: insErr } = await adminDb
    .from('tournament_winners')
    .upsert(rows, { onConflict: 'tournament_slug,rank' })
    .select('id, tournament_id, tournament_slug, rank, user_id, player_name, score, prize_id, prize, prize_label, created_at')

  if (insErr) {
    throw createError({ statusCode: 400, statusMessage: insErr.message })
  }

  const derivedTournamentStatus =
    endsMs && Date.now() >= endsMs ? 'ended' : String((t as any).status || 'scheduled')

  const { error: updErr } = await adminDb
    .from('tournaments')
    .update({
      finalized: true,
      updated_at: new Date().toISOString(),
      status: derivedTournamentStatus
    })
    .eq('id', tournamentId)

  if (updErr) {
    throw createError({ statusCode: 400, statusMessage: updErr.message })
  }

  return {
    ok: true,
    winners: inserted || [],
    tournament: {
      id: tournamentId,
      slug: tournamentSlug
    }
  }
})