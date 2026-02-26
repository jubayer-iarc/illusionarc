export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const isLoading = useState<boolean>('route:isLoading', () => false)
  const progress = useState<number>('route:progress', () => 0)

  let timer: number | null = null
  let showDelay: number | null = null
  let safety: number | null = null

  // track both page loading and transition
  let loadDepth = 0
  let transitionDepth = 0

  // min show time to prevent flash + “late swap” feeling
  const MIN_VISIBLE_MS = 320
  const SHOW_DELAY_MS = 120
  let shownAt = 0

  function clearAll() {
    if (timer) window.clearInterval(timer)
    if (showDelay) window.clearTimeout(showDelay)
    if (safety) window.clearTimeout(safety)
    timer = null
    showDelay = null
    safety = null
  }

  function startProgress() {
    clearAll()

    // delay showing (prevents flash on instant navigations)
    showDelay = window.setTimeout(() => {
      isLoading.value = true
      shownAt = Date.now()
      progress.value = Math.max(progress.value, 0.08)

      // smooth fake progress until we finish
      timer = window.setInterval(() => {
        const p = progress.value
        progress.value = Math.min(0.92, p + (0.92 - p) * 0.12)
      }, 120)
    }, SHOW_DELAY_MS)

    // hard failsafe: never stuck forever
    safety = window.setTimeout(() => {
      forceFinish()
    }, 20000)
  }

  function maybeFinish() {
    // only finish when BOTH are done
    if (loadDepth > 0 || transitionDepth > 0) return

    // if not yet shown (still in showDelay), just cancel
    if (!isLoading.value) {
      clearAll()
      progress.value = 0
      return
    }

    const elapsed = Date.now() - shownAt
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)

    window.setTimeout(() => {
      // re-check in case a new nav started
      if (loadDepth > 0 || transitionDepth > 0) return

      clearAll()
      progress.value = 1

      window.setTimeout(() => {
        isLoading.value = false
        progress.value = 0
      }, 160)
    }, wait)
  }

  function forceFinish() {
    loadDepth = 0
    transitionDepth = 0
    if (!isLoading.value) {
      clearAll()
      progress.value = 0
      return
    }
    clearAll()
    progress.value = 1
    window.setTimeout(() => {
      isLoading.value = false
      progress.value = 0
    }, 160)
  }

  // ✅ Nuxt page loading hooks (best for asyncData/navigation)
  nuxtApp.hook('page:loading:start', () => {
    loadDepth++
    if (loadDepth + transitionDepth === 1) startProgress()
  })

  nuxtApp.hook('page:loading:end', () => {
    loadDepth = Math.max(0, loadDepth - 1)
    maybeFinish()
  })

  // ✅ Transition hooks (you use out-in transitions)
  nuxtApp.hook('page:transition:start', () => {
    transitionDepth++
    if (loadDepth + transitionDepth === 1) startProgress()
  })

  nuxtApp.hook('page:transition:finish', () => {
    transitionDepth = Math.max(0, transitionDepth - 1)
    maybeFinish()
  })

  // ✅ errors/abort shouldn't leave loader weird
  nuxtApp.hook('app:error', forceFinish)

  return {
    provide: { routeLoader: { isLoading, progress } }
  }
})