export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const isLoading = useState<boolean>('route:isLoading', () => false)
  const progress = useState<number>('route:progress', () => 0)

  let timer: number | null = null
  let showDelay: number | null = null
  let safety: number | null = null
  let finishTimer: number | null = null

  let loadDepth = 0
  let transitionDepth = 0

  const MIN_VISIBLE_MS = 80
  const SHOW_DELAY_MS = 0
  let shownAt = 0

  function isTournamentEmbedRoute() {
    return window.location.pathname.startsWith('/tournaments/embed/')
  }

  function isArcadeChildRoute() {
    return window.location.pathname.startsWith('/arcade/')
  }

  function shouldDisableLoader() {
    return isTournamentEmbedRoute() || isArcadeChildRoute()
  }

  function clearAll() {
    if (timer) window.clearInterval(timer)
    if (showDelay) window.clearTimeout(showDelay)
    if (safety) window.clearTimeout(safety)
    if (finishTimer) window.clearTimeout(finishTimer)

    timer = null
    showDelay = null
    safety = null
    finishTimer = null
  }

  function hardReset() {
    clearAll()
    isLoading.value = false
    progress.value = 0
    loadDepth = 0
    transitionDepth = 0
  }

  function startProgress() {
    if (shouldDisableLoader()) {
      hardReset()
      return
    }

    clearAll()

    showDelay = window.setTimeout(() => {
      if (shouldDisableLoader()) {
        hardReset()
        return
      }

      isLoading.value = true
      shownAt = Date.now()
      progress.value = Math.max(progress.value, 0.12)

      timer = window.setInterval(() => {
        if (shouldDisableLoader()) {
          hardReset()
          return
        }

        const p = progress.value
        progress.value = Math.min(0.94, p + (0.94 - p) * 0.18)
      }, 90)
    }, SHOW_DELAY_MS)

    safety = window.setTimeout(() => {
      forceFinish()
    }, 20000)
  }

  function maybeFinish() {
    if (loadDepth > 0 || transitionDepth > 0) return

    if (!isLoading.value) {
      clearAll()
      progress.value = 0
      return
    }

    const elapsed = Date.now() - shownAt
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)

    finishTimer = window.setTimeout(() => {
      if (loadDepth > 0 || transitionDepth > 0) return

      if (shouldDisableLoader()) {
        hardReset()
        return
      }

      clearAll()
      progress.value = 1

      finishTimer = window.setTimeout(() => {
        isLoading.value = false
        progress.value = 0
      }, 40)
    }, wait)
  }

  function forceFinish() {
    loadDepth = 0
    transitionDepth = 0

    if (!shouldDisableLoader() && isLoading.value) {
      clearAll()
      progress.value = 1

      finishTimer = window.setTimeout(() => {
        isLoading.value = false
        progress.value = 0
      }, 40)

      return
    }

    hardReset()
  }

  nuxtApp.hook('page:loading:start', () => {
    if (shouldDisableLoader()) {
      hardReset()
      return
    }

    loadDepth++
    if (loadDepth + transitionDepth === 1) startProgress()
  })

  nuxtApp.hook('page:loading:end', () => {
    loadDepth = Math.max(0, loadDepth - 1)
    maybeFinish()
  })

  nuxtApp.hook('page:transition:start', () => {
    if (shouldDisableLoader()) {
      hardReset()
      return
    }

    transitionDepth++
    if (loadDepth + transitionDepth === 1) startProgress()
  })

  nuxtApp.hook('page:transition:finish', () => {
    transitionDepth = Math.max(0, transitionDepth - 1)
    maybeFinish()
  })

  nuxtApp.hook('app:error', forceFinish)

  return {
    provide: {
      routeLoader: { isLoading, progress }
    }
  }
})