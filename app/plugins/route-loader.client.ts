export default defineNuxtPlugin(() => {
    const isLoading = useState<boolean>('route:isLoading', () => false)
    const progress = useState<number>('route:progress', () => 0)

    let interval: number | null = null
    let safety: number | null = null

    // increments on each nav so old timers can't "win"
    let navId = 0

    function clearAll() {
        if (interval) window.clearInterval(interval)
        if (safety) window.clearTimeout(safety)
        interval = null
        safety = null
    }

    function startLoading() {
        navId++
        const myNav = navId

        clearAll()
        isLoading.value = true
        progress.value = 0.08

        // fake smooth progress up to ~92%
        interval = window.setInterval(() => {
            if (myNav !== navId) return
            const p = progress.value
            progress.value = Math.min(0.92, p + (0.92 - p) * 0.12)
        }, 120)

        // ✅ failsafe: even if events don't fire, never stay stuck forever
        safety = window.setTimeout(() => {
            if (myNav !== navId) return
            finishLoading()
        }, 15000) // 15s max
    }

    function finishLoading() {
        navId++
        const myNav = navId

        clearAll()
        progress.value = 1

        window.setTimeout(() => {
            // if another nav started, don't hide
            if (myNav !== navId) return
            isLoading.value = false
            progress.value = 0
        }, 180)
    }

    const nuxtApp = useNuxtApp()

    // ✅ Nuxt v4 recommended hooks
    nuxtApp.hook('page:loading:start', startLoading) // when new page setup starts
    nuxtApp.hook('page:loading:end', finishLoading)  // after page resolved :contentReference[oaicite:1]{index=1}
    nuxtApp.hook('page:transition:finish', finishLoading) // after leave transition :contentReference[oaicite:2]{index=2}
    nuxtApp.hook('app:error', finishLoading) // don’t get stuck on errors :contentReference[oaicite:3]{index=3}

    // ✅ Extra fallback: router afterEach (covers odd cases)
    const router = useRouter()
    router.afterEach((_to, _from, failure) => {
        if (!failure) finishLoading()
    })

    return {
        provide: {
            routeLoader: { isLoading, progress }
        }
    }
})