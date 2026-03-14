// app/middleware/guest-only.ts
export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabaseClient()

  // allow guest auth pages, including reset flow destination
  const ALLOW_WITH_SESSION = new Set([
    '/forget-password',
    '/update-password',
    '/login'
  ])

  if (ALLOW_WITH_SESSION.has(to.path)) {
    return
  }

  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (session?.user) {
    return navigateTo('/', { replace: true })
  }
})