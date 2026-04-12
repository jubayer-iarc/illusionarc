// server/api/auth/role.get.ts
import { serverSupabaseClient } from '#supabase/server'

type Role = 'admin' | 'writer' | 'user'
type RoleResponse = { role: Role | null; found: boolean }

// Explicit profile shape from DB
type ProfileRoleRow = { role: string | null }

export default defineEventHandler(async (event): Promise<RoleResponse> => {
  const supabase = await serverSupabaseClient(event)

  const { data: auth, error: userErr } = await supabase.auth.getUser()
  if (userErr) {
    console.warn('[role] getUser error:', userErr.message)
  }

  const uid = auth?.user?.id
  if (!uid) {
    return { role: null, found: false }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', uid)
    .maybeSingle()

  if (error) {
    console.warn('[role] profiles query error:', error.message)
    return { role: 'user', found: false }
  }

  const profile = data as ProfileRoleRow | null

  if (!profile) {
    return { role: 'user', found: false }
  }

  const rawRole = String(profile.role || '').toLowerCase()

  if (rawRole === 'admin') {
    return { role: 'admin', found: true }
  }

  if (rawRole === 'writer') {
    return { role: 'writer', found: true }
  }

  return { role: 'user', found: true }
})