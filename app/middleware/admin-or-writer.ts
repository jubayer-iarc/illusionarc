// app/middleware/admin-or-writer.ts
type RoleResponse = {
  role: 'admin' | 'writer' | 'user' | null
  found: boolean
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return

  const supabase = useSupabaseClient()

  // Session is the first truth for client-side access
  const { data, error } = await supabase.auth.getSession()
  const session = data?.session || null

  if (error) {
    console.warn('admin-or-writer middleware getSession error:', error.message)
  }

  if (!session) {
    return navigateTo(
      { path: '/login', query: { next: to.fullPath } },
      { replace: true }
    )
  }

  try {
    const res = await $fetch<RoleResponse>('/api/auth/role', {
      credentials: 'include'
    })

    if (res.role !== 'admin' && res.role !== 'writer') {
      return navigateTo('/', { replace: true })
    }
  } catch (err: any) {
    console.warn('admin-or-writer middleware role fetch error:', err?.message || err)
    return navigateTo('/', { replace: true })
  }
})