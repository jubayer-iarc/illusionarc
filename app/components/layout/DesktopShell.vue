<!-- app/components/layout/DesktopShell.vue -->
<script setup lang="ts">
import UserMenu from '@/components/nav/UserMenu.vue'
import LiveTournamentBanner from '~/components/tournaments/LiveTournamentBanner.vue'

/* ---------------- Admin-managed site settings ---------------- */
type NavItem = { label: string; to: string; enabled?: boolean }
type LinkItem = { label: string; to: string }
type SocialItem = {
  label: string
  href: string
  icon: string
}

const { settings } = useSiteSettings()

/** filter enabled + remove contact from nav (we show it as CTA) */
function normalizeNav(list: any): NavItem[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((x) => x && typeof x.label === 'string' && typeof x.to === 'string')
    .filter((x) => x.enabled !== false)
    .filter((x) => x.to !== '/contact')
}

const desktopNav = computed(() => normalizeNav((settings.value as any).header_nav))

const footerLinks = computed<LinkItem[]>(() => {
  const list: any = (settings.value as any).footer_links
  return Array.isArray(list) ? list.filter((x) => x?.label && x?.to) : []
})

const footerLegal = computed<LinkItem[]>(() => {
  const list: any = (settings.value as any).footer_legal
  return Array.isArray(list) ? list.filter((x) => x?.label && x?.to) : []
})

const contactLabel = computed(() => 'Contact')

/* ---------------- Social links ---------------- */
const socialLinks = computed<SocialItem[]>(() => [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/17K9xtee2q/',
    icon: 'i-simple-icons-facebook'
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@illusion-arc?si=podQGcpqI3r3D1ir',
    icon: 'i-simple-icons-youtube'
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/illusion-arc/',
    icon: 'i-simple-icons-linkedin'
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@illusion.arc?_r=1&_t=ZS-950K0vw8ob3',
    icon: 'i-simple-icons-tiktok'
  }
])

/* ---------------- Color mode logic ---------------- */
const colorMode = useColorMode()

type Mode = 'system' | 'light' | 'dark'
const order: Mode[] = ['system', 'light', 'dark']

function normalizeMode(v: unknown): Mode {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

const pref = computed<Mode>(() => normalizeMode((colorMode as any).preference))
const effective = computed<'light' | 'dark'>(() => ((colorMode as any).value === 'dark' ? 'dark' : 'light'))

const themeIcon = computed(() => (effective.value === 'dark' ? 'i-heroicons-moon' : 'i-heroicons-sun'))
const themeLabel = computed(() => {
  if (pref.value === 'system') return `System (${effective.value})`
  return pref.value === 'dark' ? 'Dark' : 'Light'
})

function cycleTheme() {
  const i = order.indexOf(pref.value)
  const next = order[(i + 1) % order.length]
  ;(colorMode as any).preference = next
}

/* ---------------- Preload important routes ---------------- */
onMounted(() => {
  if (!import.meta.client) return

  const preload = () => {
    preloadRouteComponents('/tournaments')
    preloadRouteComponents('/arcade')
  }

  if ('requestIdleCallback' in window) {
    ;(window as Window & {
      requestIdleCallback: (cb: () => void) => number
    }).requestIdleCallback(preload)
  } else {
    window.setTimeout(preload, 250)
  }
})

/* ✅ Avoid new Date() in template (SSR hydration-safe) */
const year = new Date().getFullYear()
</script>

<template>
  <!-- Desktop only -->
  <div class="md:flex min-h-dvh flex-col bg-[var(--app-bg)] text-[var(--app-fg)]">
    <!-- Header -->
    <header
      class="sticky top-0 z-50 backdrop-blur
             border-b border-black/10 dark:border-white/5
             bg-white/70 dark:bg-black/25"
    >
      <UContainer class="py-3">
        <LiveTournamentBanner class="mb-3" />

        <div class="flex items-center justify-between gap-3">
          <NuxtLink to="/" class="flex items-center gap-2 min-w-0">
            <img
              :src="settings.brand_logo_url || '/android-chrome-512x512.png'"
              :alt="`${settings.brand_name || 'illusion Arc'} Logo`"
              class="h-8 w-8 object-contain"
            />
            <span class="font-semibold tracking-wide truncate">
              {{ settings.brand_name || 'illusion Arc' }}
            </span>
          </NuxtLink>

          <!-- Desktop nav -->
          <nav class="flex items-center gap-1">
            <UButton
              v-for="n in desktopNav"
              :key="n.label + n.to"
              variant="ghost"
              :to="n.to"
              :prefetch="true"
              prefetch-on="interaction"
            >
              {{ n.label }}
            </UButton>
          </nav>

          <div class="flex items-center gap-2">
            <UButton color="primary" to="/contact">
              {{ contactLabel }}
            </UButton>

            <UserMenu />
          </div>
        </div>
      </UContainer>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-black/10 dark:border-white/5 bg-white/50 dark:bg-black/10">
      <UContainer class="py-10 grid gap-8 md:grid-cols-4">
        <div>
          <div class="font-semibold text-black dark:text-white">
            {{ settings.brand_name || 'illusion Arc' }}
          </div>
          <div class="text-sm text-black/60 dark:text-white/60 mt-2">
            {{ settings.footer_tagline || 'Games • AR/VR • VFX/CGI • Animation' }}
          </div>

          <div class="mt-4">
            <div class="text-black/60 dark:text-white/60 mb-3 text-sm">Follow us</div>
            <div class="flex items-center gap-3">
              <a
                v-for="item in socialLinks"
                :key="item.label"
                :href="item.href"
                :aria-label="item.label"
                :title="item.label"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-10 w-10 items-center justify-center rounded-full
                       border border-black/10 dark:border-white/10
                       bg-white/70 dark:bg-white/5
                       text-black/75 dark:text-white/75
                       hover:text-black dark:hover:text-white
                       hover:bg-white dark:hover:bg-white/10
                       transition"
              >
                <UIcon :name="item.icon" class="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div class="text-sm">
          <div class="text-black/60 dark:text-white/60 mb-2">Links</div>
          <div class="flex flex-col gap-1">
            <NuxtLink
              v-for="l in footerLinks"
              :key="l.label + l.to"
              :to="l.to"
              class="text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
            >
              {{ l.label }}
            </NuxtLink>

            <NuxtLink
              v-if="footerLinks.length === 0"
              to="/"
              class="text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
            >
              Home
            </NuxtLink>
          </div>
        </div>

        <div class="text-sm">
          <div class="text-black/60 dark:text-white/60 mb-2">Legal</div>
          <div class="flex flex-col gap-1">
            <NuxtLink
              v-for="l in footerLegal"
              :key="l.label + l.to"
              :to="l.to"
              class="text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
            >
              {{ l.label }}
            </NuxtLink>

            <NuxtLink
              v-if="footerLegal.length === 0"
              to="/privacy-policy"
              class="text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
            >
              Privacy Policy
            </NuxtLink>
          </div>
        </div>

        <div class="text-sm">
          <div class="text-black/60 dark:text-white/60 mb-2">Social</div>
          <div class="flex flex-col gap-2">
            <a
              v-for="item in socialLinks"
              :key="`${item.label}-text`"
              :href="item.href"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
            >
              <UIcon :name="item.icon" class="h-4 w-4" />
              <span>{{ item.label }}</span>
            </a>
          </div>
        </div>
      </UContainer>

      <UContainer
        class="py-4 border-t border-black/10 dark:border-white/5
               flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div class="text-xs text-black/50 dark:text-white/50">
          © {{ year }} {{ settings.brand_name || 'illusion Arc' }}
        </div>

        <ClientOnly>
          <UButton
            variant="soft"
            size="sm"
            class="rounded-full"
            :title="`Theme: ${themeLabel} (click to change)`"
            @click="cycleTheme"
          >
            <UIcon :name="themeIcon" class="w-5 h-5" />
            <span class="ml-2">Theme: {{ themeLabel }}</span>
          </UButton>
        </ClientOnly>
      </UContainer>
    </footer>
  </div>
</template>