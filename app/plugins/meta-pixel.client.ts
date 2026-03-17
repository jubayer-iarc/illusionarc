export default defineNuxtPlugin(() => {
  const route = useRoute()
  const { proxy } = useScriptMetaPixel()

  watch(
    () => route.fullPath,
    () => {
      proxy.fbq('track', 'PageView')

      const path = route.path

      if (path.startsWith('/tournaments/')) {
        proxy.fbq('track', 'ViewContent', {
          content_type: 'tournament',
          content_name: String(route.params.tournamentSlug || '')
        })
      }

      if (path.startsWith('/arcade/')) {
        proxy.fbq('track', 'ViewContent', {
          content_type: 'game',
          content_name: String(route.params.slug || '')
        })
      }

      if (path === '/contact') {
        proxy.fbq('track', 'ViewContent', {
          content_name: 'Contact Page'
        })
      }
    },
    { immediate: true }
  )
})