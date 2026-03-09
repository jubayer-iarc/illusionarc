// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/hints',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxtjs/color-mode',
    '@nuxt/ui',
    '@vite-pwa/nuxt',
    '@nuxtjs/supabase',
    'nuxt-security'
  ],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      titleTemplate: '%s · illusion Arc',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#070A12' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' }
      ]
    },
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' }
  },

  ui: {},

  pwa: {
    registerType: 'autoUpdate',
    includeAssets: [
      '/pwa/favicon.ico',
      '/pwa/apple-touch-icon.png',
      '/pwa/android-chrome-192x192.png',
      '/pwa/android-chrome-512x512.png'
    ],
    manifest: {
      name: 'illusion Arc',
      short_name: 'iArc',
      description: 'illusion Arc - Play Free Arcade Games Online',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#402a71',
      theme_color: '#402a71',
      icons: [
        { src: '/pwa/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }
  },

  supabase: {
    useSsrCookies: true,
    redirect: false
  },

  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_KEY
    }
  },

  colorMode: {
    preference: 'system',
    fallback: 'dark',
    classSuffix: ''
  },

  security: {
    // CSP nonces + integrity
    nonce: true,
    sri: true,
    ssg: {
      meta: true,
      hashScripts: true,
      hashStyles: false,
      exportToPresets: true
    },

    corsHandler: false,

    hidePoweredBy: true,
    removeLoggers: true,

    rateLimiter: {
      tokensPerInterval: 150,
      interval: 300000, // 5 min
      headers: false,
      throwError: true
    },

    requestSizeLimiter: {
      maxRequestSizeInBytes: 2_000_000,
      maxUploadFileRequestInBytes: 8_000_000,
      throwError: true
    },

    xssValidator: {},
    csrf: false,

    headers: {
      // ✅ Keep these off unless you specifically need cross-origin isolation
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,

      /**
       * ✅ IMPORTANT:
       * Do NOT set X-Frame-Options to SAMEORIGIN globally,
       * because it will block embedding from illusionarc.com on other origins.
       * Use CSP frame-ancestors instead.
       */
      xFrameOptions: false,

      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubdomains: true,
        preload: false
      },

      referrerPolicy: 'strict-origin-when-cross-origin',

      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        'display-capture': [],
        fullscreen: ['self']
      },

      // ✅ Global CSP (strict + allows your own domains to frame)
      contentSecurityPolicy: {
        'base-uri': ["'none'"],
        'object-src': ["'none'"],

        // ✅ allow framing by your own domains (and self)
        'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com'],

        'default-src': ["'self'"],
        'connect-src': ["'self'", 'https:', 'wss:'],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", 'https:', "'unsafe-inline'"],

        'script-src': ["'self'", "'nonce-{{nonce}}'"],
        'script-src-attr': ["'none'"],

        'worker-src': ["'self'", 'blob:'],

        'form-action': ["'self'"],
        'manifest-src': ["'self'"],
        'upgrade-insecure-requests': true
      }
    }
  },

  routeRules: {
    /**
     * ✅ Embeds / Arcade / Tournaments / Games
     * - keep COOP/COEP off (iframe friendly)
     * - ensure framing is allowed (CSP frame-ancestors already global, but we keep explicit)
     * - DO NOT reintroduce X-Frame-Options
     */
    '/embed/**': {
      security: {
        headers: {
          xFrameOptions: false,
          crossOriginEmbedderPolicy: false,
          crossOriginOpenerPolicy: false,
          contentSecurityPolicy: {
            'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com']
          }
        }
      }
    },

    '/arcade/**': {
      security: {
        headers: {
          xFrameOptions: false,
          crossOriginEmbedderPolicy: false,
          crossOriginOpenerPolicy: false,
          contentSecurityPolicy: {
            'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com']
          }
        }
      }
    },

    '/tournaments/**': {
      security: {
        headers: {
          xFrameOptions: false,
          crossOriginEmbedderPolicy: false,
          crossOriginOpenerPolicy: false,
          contentSecurityPolicy: {
            'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com']
          }
        }
      }
    },

    '/games/**': {
      security: {
        headers: {
          xFrameOptions: false,
          crossOriginEmbedderPolicy: false,
          crossOriginOpenerPolicy: false,

          // Only add what games actually need; do not weaken global script policy unless required
          contentSecurityPolicy: {
            'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com'],
            'img-src': ["'self'", 'data:', 'https:', 'blob:'],
            'media-src': ["'self'", 'data:', 'https:', 'blob:'],
            'style-src': ["'self'", 'https:', "'unsafe-inline'"],

            // If your games truly load scripts from CDNs, allow those CDNs
            // Still keeps nonce for inline/SSR scripts
            'script-src': ["'self'", "'nonce-{{nonce}}'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],

            'worker-src': ["'self'", 'blob:']
          }
        }
      }
    },

    
    // Panorama needs unsafe-eval (A-Frame / three builds sometimes)
    '/apps/panorama/**': {
      security: {
        headers: {
          contentSecurityPolicy: {
            'img-src': ["'self'", 'data:', 'https:', 'blob:'],
            'media-src': ["'self'", 'data:', 'https:', 'blob:'],
            'style-src': ["'self'", 'https:', "'unsafe-inline'"],
            'script-src': ["'self'", "'nonce-{{nonce}}'", "'unsafe-eval'"]
          }
        }
      }
    },

    // Admin is client-only
    '/admin/**': { ssr: false },

    '/apps/**': {
      security: {
        headers: {
          contentSecurityPolicy: {
            'img-src': ["'self'", 'data:', 'https:', 'blob:'],
            'media-src': ["'self'", 'data:', 'https:', 'blob:'],
            'style-src': ["'self'", 'https:', "'unsafe-inline'"],
            'script-src': ["'self'", "'nonce-{{nonce}}'"]
          }
        }
      }
    }
  },

  vite: {
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (
            warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
            typeof warning.message === 'string' &&
            warning.message.includes('PostgrestError') &&
            warning.message.includes('@supabase/supabase-js')
          ) {
            return
          }
          warn(warning)
        }
      }
    }
  },

  typescript: {
    tsConfig: {
      include: ['~/types/**/*.d.ts', '~/types/**/*.ts']
    }
  }
})