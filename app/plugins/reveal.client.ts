// app/plugins/reveal.client.ts
export default defineNuxtPlugin((nuxtApp) => {
    if (!import.meta.client) return

    const reduce =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    let io: IntersectionObserver | null = null

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
        // triple pass: DOM patch + layout + images/fonts can shift
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
        // ✅ reset observer so it doesn't hold stale nodes
        teardownObserver()

        runScanSoon()
        setTimeout(runScanSoon, 50)
        setTimeout(runScanSoon, 250)

        // ✅ failsafe so nothing stays hidden
        setTimeout(failsafeShowAll, 900)
    }

    onNuxtReady(() => {
        document.documentElement.classList.add('reveal-ready')
        onNav()
    })

    // ✅ Nuxt hooks are more reliable than router.afterEach with transitions
    nuxtApp.hook('page:finish', onNav)
    nuxtApp.hook('page:transition:finish', onNav)
    nuxtApp.hook('app:error', () => setTimeout(failsafeShowAll, 50))
})