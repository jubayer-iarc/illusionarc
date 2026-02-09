<!-- app/components/home/TestimonialStrip.vue -->
<script setup lang="ts">
type Testimonial = { name: string; text: string }

type TestimonialsData = {
  title: string
  subtitle: string
  items: Testimonial[]
}

/** Fallback = your current hardcoded content */
const FALLBACK: TestimonialsData = {
  title: 'Testimonials',
  subtitle: 'Dummy for now — we’ll replace with real quotes.',
  items: [
    { name: 'Client A', text: 'Polished delivery and great iteration speed.' },
    { name: 'Client B', text: 'The experience feels premium and fast.' },
    { name: 'Client C', text: 'Strong UI/UX + clean build pipeline.' }
  ]
}

/**
 * ✅ Admin-managed content
 * Table: page_sections
 * page='home', section_key='testimonials'
 */
const { data: t, refresh } = usePageSection<TestimonialsData>('home', 'testimonials', FALLBACK)

// SSR-safe fetch (if it fails, fallback stays)
await refresh()

const safeItems = computed(() => (Array.isArray(t.value?.items) ? t.value.items : FALLBACK.items))
</script>

<template>
  <section class="relative py-14">
    <UContainer>
      <div data-reveal>
        <h2 class="text-2xl md:text-3xl font-semibold text-black dark:text-white">
          {{ t.title }}
        </h2>
        <p class="mt-2 text-black/70 dark:text-white/70">
          {{ t.subtitle }}
        </p>
      </div>

      <div class="mt-8 grid gap-5 md:grid-cols-3 items-stretch" data-reveal>
        <UCard
          v-for="item in safeItems"
          :key="`${item.name}-${item.text}`"
          class="press h-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur
                 transition hover:-translate-y-0.5"
          :ui="{ body: 'p-5' }"
        >
          <p class="text-black/70 dark:text-white/70 leading-relaxed">
            “{{ item.text }}”
          </p>
          <div class="mt-4 text-sm text-black/60 dark:text-white/60">
            — {{ item.name }}
          </div>
        </UCard>
      </div>
    </UContainer>
  </section>
</template>
