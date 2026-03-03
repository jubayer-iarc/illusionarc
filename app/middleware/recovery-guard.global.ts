// app/middleware/recovery-guard.global.ts
export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabaseClient()

  // We mark "recovery mode" in a cookie when user lands on /update-password
  const recovery = useCookie<string | null>('ia_recovery', { sameSite: 'lax', path: '/' })

  // Allow these routes even during recovery
  const ALLOW = new Set(['/update-password', '/forget-password', '/login'])

  // If we are in recovery mode and user tries to go anywhere else -> sign out + go login
  if (recovery.value === '1' && !ALLOW.has(to.path)) {
    if (import.meta.client) {
      try {
        await supabase.auth.signOut()
      } catch {}
      recovery.value = null
    }
    return navigateTo('/login', { replace: true })
  }

  // Extra safety: if session exists AND URL says type=recovery, also lock it down
  const type = typeof to.query.type === 'string' ? to.query.type : ''
  if (type === 'recovery' && !ALLOW.has(to.path)) {
    if (import.meta.client) {
      try {
        await supabase.auth.signOut()
      } catch {}
    }
    return navigateTo('/login', { replace: true })
  }
})