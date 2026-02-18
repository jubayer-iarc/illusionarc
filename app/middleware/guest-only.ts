// app/middleware/guest-only.ts
export default defineNuxtRouteMiddleware(async () => {
  const supabase = useSupabaseClient()

  // Always check the real session (more reliable than just useSupabaseUser() timing)
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (session?.user) {
    return navigateTo('/', { replace: true })
  }
})
