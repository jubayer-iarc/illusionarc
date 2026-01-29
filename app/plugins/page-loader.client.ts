export default defineNuxtPlugin((nuxtApp) => {
  const loader = usePageLoader()

  // Tune these:
  const SHOW_DELAY_MS = 250      // don’t show instantly (avoid flash)
  const MIN_VISIBLE_MS = 150     // once shown, keep for at least this long
  const MAX_VISIBLE_MS = 10000   // safety: never stuck beyond this

  let showTimer: any = null
  let progressTimer: any = null
  let maxTimer: any = null

  function clearAllTimers() {
    if (showTimer) clearTimeout(showTimer)
    if (progressTimer) clearInterval(progressTimer)
    if (maxTimer) clearTimeout(maxTimer)
    showTimer = null
    progressTimer = null
    maxTimer = null
  }

  function startFakeProgress(myToken: number) {
    // Smoothly approach 90% while loading
    loader.progress.value = 0.08

    progressTimer = setInterval(() => {
      // ignore if a new navigation started
      if (loader.token.value !== myToken) return

      const p = loader.progress.value
      if (p < 0.9) {
        // ease-out style increments
        const next = p + Math.max(0.003, (0.9 - p) * 0.06)
        loader.progress.value = Math.min(0.9, next)
      }
    }, 120)
  }

  function show(myToken: number) {
    if (loader.token.value !== myToken) return
    loader.visible.value = true
    loader.shownAt.value = Date.now()
    startFakeProgress(myToken)

    // Safety: auto-hide if something goes wrong
    maxTimer = setTimeout(() => {
      if (loader.token.value !== myToken) return
      // finish it
      loader.progress.value = 1
      loader.visible.value = false
      clearAllTimers()
      // eslint-disable-next-line no-console
      console.warn('[PageLoader] Auto-hid after MAX_VISIBLE_MS. A page may be blocking navigation.')
    }, MAX_VISIBLE_MS)
  }

  function start() {
    clearAllTimers()

    loader.token.value += 1
    const myToken = loader.token.value

    loader.startedAt.value = Date.now()
    loader.shownAt.value = 0
    loader.progress.value = 0

    // Delay the visual loader (prevents flash on fast routes)
    showTimer = setTimeout(() => show(myToken), SHOW_DELAY_MS)
  }

  async function finish() {
    const myToken = loader.token.value

    // If not even shown yet, just cancel everything quickly
    if (!loader.visible.value) {
      clearAllTimers()
      loader.progress.value = 0
      return
    }

    // Complete progress
    loader.progress.value = 1

    // ensure min-visible time
    const shownAt = loader.shownAt.value || Date.now()
    const elapsedVisible = Date.now() - shownAt
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsedVisible)

    await new Promise((r) => setTimeout(r, wait))

    // only hide if still same navigation
    if (loader.token.value === myToken) {
      loader.visible.value = false
      loader.progress.value = 0
      clearAllTimers()
    }
  }

  // ✅ Nuxt page lifecycle hooks (best signal for transitions)
  nuxtApp.hook('page:start', () => start())
  nuxtApp.hook('page:finish', () => finish())

  // ✅ In case an error happens during navigation/render
  nuxtApp.hook('app:error', () => finish())
})
