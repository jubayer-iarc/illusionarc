// app/plugins/reveal.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const reduce =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  let io: IntersectionObserver | null = null
  let timers: number[] = []

  const clearTimers = () => {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
  }

  const teardownObserver = () => {
    if (io) {
      io.disconnect()
      io = null
    }
  }

  const ensureObserver = () => {
    if (io || reduce) return

    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            ;(e.target as HTMLElement).classList.add('revealed')
            io?.unobserve(e.target)
          }
        }
      },
      { threshold: 0.01, rootMargin: '80px 0px 80px 0px' }
    )
  }

  const scan = () => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))

    if (reduce) {
      els.forEach((el) => el.classList.add('revealed'))
      return
    }

    ensureObserver()
    els.forEach((el) => {
      if (!el.classList.contains('revealed')) io?.observe(el)
    })
  }

  const runScanSoon = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scan()
      })
    })
  }

  const failsafeShowAll = () => {
    document
      .querySelectorAll<HTMLElement>('[data-reveal]:not(.revealed)')
      .forEach((el) => el.classList.add('revealed'))
  }

  const onNav = () => {
    clearTimers()
    teardownObserver()

    runScanSoon()
    timers.push(window.setTimeout(runScanSoon, 50))
    timers.push(window.setTimeout(runScanSoon, 250))
    timers.push(window.setTimeout(failsafeShowAll, 500))
  }

  onNuxtReady(() => {
    document.documentElement.classList.add('reveal-ready')
    onNav()
  })

  nuxtApp.hook('page:finish', onNav)
  nuxtApp.hook('page:transition:finish', onNav)
  nuxtApp.hook('page:loading:end', onNav)
  nuxtApp.hook('app:error', failsafeShowAll)
  nuxtApp.hook('vue:error', failsafeShowAll)
})