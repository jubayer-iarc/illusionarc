// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  modules: [
    '@nuxt/eslint',
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
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
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
    pageTransition: false,
    layoutTransition: false
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
        {
          src: '/pwa/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    }
  },

  image: {
    format: ['avif', 'webp'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536
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

  experimental: {
    payloadExtraction: true
  },

  security: {
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
      interval: 300000,
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
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
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

      contentSecurityPolicy: {
        'base-uri': ["'none'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com'],

        'default-src': ["'self'"],
        'connect-src': ["'self'", 'https:', 'wss:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", 'https:', "'unsafe-inline'"],
        'script-src': ["'self'", "'nonce-{{nonce}}'", 'https://va.vercel-scripts.com'],
        'script-src-attr': ["'none'"],
        'worker-src': ["'self'", 'blob:'],
        'frame-src': ["'self'", 'https:'],
        'media-src': ["'self'", 'data:', 'blob:', 'https:'],
        'form-action': ["'self'"],
        'manifest-src': ["'self'"],
        'upgrade-insecure-requests': true
      }
    }
  },

  routeRules: {
    '/': { prerender: true },
    '/about': { prerender: true },
    '/contact': { prerender: true },
    '/services': { prerender: true },
    '/privacy-policy': { prerender: true },
    '/terms': { prerender: true },

    '/works': { swr: 3600 },
    '/works/**': { swr: 3600 },

    '/arcade': { swr: 900 },

    '/tournaments': { swr: 60 },

    '/embed/**': {
      swr: 300,
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
      swr: 900,
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
      // swr: 60,
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
      headers: {
        'cache-control': 'public, max-age=31536000, immutable'
      },
      security: {
        headers: {
          xFrameOptions: false,
          crossOriginEmbedderPolicy: false,
          crossOriginOpenerPolicy: false,
          contentSecurityPolicy: {
            'frame-ancestors': ["'self'", 'https://illusionarc.com', 'https://www.illusionarc.com'],
            'img-src': ["'self'", 'data:', 'blob:', 'https:'],
            'media-src': ["'self'", 'data:', 'blob:', 'https:'],
            'style-src': ["'self'", 'https:', "'unsafe-inline'"],
            'script-src': [
              "'self'",
              "'nonce-{{nonce}}'",
              'https://cdnjs.cloudflare.com',
              'https://cdn.jsdelivr.net'
            ],
            'worker-src': ["'self'", 'blob:']
          }
        }
      }
    },

    '/apps/panorama/**': {
      security: {
        headers: {
          contentSecurityPolicy: {
            'img-src': ["'self'", 'data:', 'blob:', 'https:'],
            'media-src': ["'self'", 'data:', 'blob:', 'https:'],
            'style-src': ["'self'", 'https:', "'unsafe-inline'"],
            'script-src': ["'self'", "'nonce-{{nonce}}'", "'unsafe-eval'"]
          }
        }
      }
    },

    '/apps/**': {
      swr: 300,
      security: {
        headers: {
          contentSecurityPolicy: {
            'img-src': ["'self'", 'data:', 'blob:', 'https:'],
            'media-src': ["'self'", 'data:', 'blob:', 'https:'],
            'style-src': ["'self'", 'https:', "'unsafe-inline'"],
            'script-src': ["'self'", "'nonce-{{nonce}}'"]
          }
        }
      }
    },

    '/admin/**': {
      ssr: false,
      headers: {
        'cache-control': 'no-store'
      }
    },

    '/login': {
      headers: {
        'cache-control': 'no-store'
      }
    },

    '/update-password': {
      headers: {
        'cache-control': 'no-store'
      }
    }
  },

  vite: {
    build: {
      sourcemap: false,
      cssCodeSplit: true,
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
    typeCheck: false,
    tsConfig: {
      include: ['~/types/**/*.d.ts', '~/types/**/*.ts']
    }
  }
})