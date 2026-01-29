// server/api/tournaments/by-slug.get.ts
import { serverSupabaseClient } from '#supabase/server'
import { createError, getQuery } from 'h3'

function computeStatus(t: any, nowMs = Date.now()) {
  const dbStatus = String(t?.status || 'scheduled').toLowerCase()
  if (dbStatus === 'canceled') return 'canceled'

  const s = Date.parse(String(t?.starts_at || ''))
  const e = Date.parse(String(t?.ends_at || ''))

  const hasS = Number.isFinite(s)
  const hasE = Number.isFinite(e)

  if (hasE && nowMs >= e) return 'ended'
  if (hasS && nowMs >= s && (!hasE || nowMs < e)) return 'live'
  return 'scheduled'
}

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)
  const query = getQuery(event)
  const slug = String(query.slug || '').trim()

  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })

  // ✅ Safe: never breaks if you add/remove columns
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) return { tournament: null }

  const nowMs = Date.now()
  const effective = computeStatus(data, nowMs)

  return {
    tournament: {
      ...data,
      effective_status: effective
    }
  }
})
