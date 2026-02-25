<!-- app/components/home/HeroSection.vue -->
<script setup lang="ts">
const route = useRoute()
type HeroCTA = {
  label: string
  to: string
  variant?: 'solid' | 'outline' | 'ghost'
  color?: string
}

type HeroStat = { k: string; v: string }

type HeroData = {
  headline: string
  subhead: string
  ctas: HeroCTA[]
  stats: HeroStat[]
}

/** Fallback = same as your current hardcoded content */
const FALLBACK: HeroData = {
  headline: 'We build games & immersive realities.',
  subhead: 'From web to VR — interactive experiences that feel alive.',
  ctas: [
    { label: 'Start a Project', to: '/contact', variant: 'solid', color: 'primary' },
    { label: 'View Work', to: '/work', variant: 'outline' },
    { label: 'Play Games', to: '/arcade', variant: 'ghost' }
  ],
  stats: [
    { k: '60fps feel', v: 'Micro-interactions' },
    { k: 'Web → VR', v: 'Cross-platform builds' },
    { k: 'Embeddable', v: 'Game portal system' }
  ]
}

/**
 * ✅ Admin-managed content
 * Table: page_sections
 * page='home', section_key='hero'
 */
const { data: hero, refresh } = usePageSection<HeroData>('home', 'hero', FALLBACK)

// SSR-safe fetch (will use Supabase on server; if it fails, fallback stays)
await refresh()

function btnProps(cta: HeroCTA) {
  if (cta.variant === 'outline') return { variant: 'outline' as const }
  if (cta.variant === 'ghost') return { variant: 'ghost' as const }
  // solid/default
  return { color: (cta.color as any) || 'primary' }
}
</script>

<template>
  <section class="relative overflow-hidden">
    <GlowBackdrop />

    <!-- Animated gradient wash (inline style, theme-aware via opacity classes) -->
    <div
      aria-hidden="true"
      class="absolute inset-[-40%] blur-[14px] pointer-events-none animate-[heroDrift_10s_ease-in-out_infinite_alternate]
             opacity-40 dark:opacity-55"
      :style="{
        background: `
          radial-gradient(600px 320px at 30% 20%, rgba(124,58,237,.28), transparent 60%),
          radial-gradient(520px 300px at 70% 30%, rgba(34,211,238,.18), transparent 60%),
          radial-gradient(520px 320px at 50% 80%, rgba(34,197,94,.14), transparent 60%)
        `
      }"
    />

    <!-- Particles -->
    <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
      <span
        v-for="i in 18"
        :key="i"
        class="absolute h-[6px] w-[6px] rounded-full blur-[0.4px]
               bg-black/20 dark:bg-white/35
               opacity-10 dark:opacity-18
               animate-[heroFloat_6s_ease-in-out_infinite]"
        :style="{
          left: `calc(${i} * 7% - 10%)`,
          top: `calc(${i} * 5% - 20%)`,
          animationDelay: `${i * -120}ms`
        }"
      />
    </div>

    <UContainer class="py-16 md:py-24">
      <div class="flex flex-col gap-10 md:grid md:grid-cols-2 md:items-center">
        <!-- ORB -->
        <div class="relative order-1 md:order-2 min-w-0" data-reveal>
          <ClientOnly>
            <HeroOrb :key="route.fullPath" />
          </ClientOnly>

          <!-- Glow edge -->
          <div
            aria-hidden="true"
            class="absolute -inset-6 -z-10 blur-2xl opacity-20 dark:opacity-30"
            :style="{
              background: `
                radial-gradient(circle at 30% 30%, rgba(124,58,237,.55), transparent 55%),
                radial-gradient(circle at 70% 40%, rgba(34,211,238,.45), transparent 55%)
              `
            }"
          />
        </div>

        <!-- TEXT -->
        <div class="max-w-xl order-2 md:order-1 min-w-0" data-reveal>
          <h1 class="text-4xl md:text-6xl font-semibold tracking-tight text-black dark:text-white">
            {{ hero.headline }}
          </h1>

          <p class="mt-4 text-lg md:text-xl text-black/70 dark:text-white/80">
            {{ hero.subhead }}
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <UButton
              v-for="c in hero.ctas"
              :key="`${c.label}-${c.to}`"
              class="press"
              :to="c.to"
              v-bind="btnProps(c)"
            >
              {{ c.label }}
            </UButton>
          </div>

          <div class="mt-10 grid gap-3 sm:grid-cols-3">
            <UCard
              v-for="s in hero.stats"
              :key="s.k"
              class="press border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur"
            >
              <div class="text-sm text-black/60 dark:text-white/70">{{ s.v }}</div>
              <div class="mt-1 font-semibold text-black dark:text-white">{{ s.k }}</div>
            </UCard>
          </div>
        </div>
      </div>
    </UContainer>
  </section>
</template>

<style>
@keyframes heroDrift {
  from {
    transform: translate3d(-1%, -1%, 0) scale(1.02);
  }
  to {
    transform: translate3d(1%, 1%, 0) scale(1.06);
  }
}
@keyframes heroFloat {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0.12;
  }
  50% {
    transform: translateY(-18px) translateX(10px) scale(1.15);
    opacity: 0.22;
  }
  100% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0.12;
  }
}
</style>
