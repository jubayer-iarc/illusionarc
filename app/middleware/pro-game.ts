export default defineNuxtRouteMiddleware(async (to) => {
  const slug = String(to.params.slug || '')

  const { GAMES } = await import('@/data/games')
  const game = GAMES.find(g => g.slug === slug)

  if (!game?.pro) return

  const headers = import.meta.server
    ? useRequestHeaders(['cookie'])
    : undefined

  try {
    const state = await $fetch<{ user: any; active: boolean }>(
      '/api/subscriptions/me',
      {
        credentials: 'include',
        headers,
        cache: 'no-store'
      }
    )

    if (!state?.user || !state.active) {
      return navigateTo(`/subscribe?redirect=${encodeURIComponent(to.fullPath)}`)
    }
  } catch {
    return navigateTo(`/subscribe?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
