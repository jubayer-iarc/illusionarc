// app/middleware/guest-only.ts
export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabaseClient()

  // ✅ Allow auth utility pages even if a temporary session exists (reset link flow)
  const ALLOW_WITH_SESSION = new Set(['/forget-password', '/update-password'])

  if (ALLOW_WITH_SESSION.has(to.path)) {
    return
  }

  // Always check the real session (more reliable than just useSupabaseUser() timing)
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (session?.user) {
    return navigateTo('/', { replace: true })
  }
})