<template>
  <div class="space-y-0">
    <!-- Keep hero fully immediate -->
    <HomeHeroSection />

    <!-- Keep top tournament banner immediate if it may be visible early / live-sensitive -->
    <UContainer class="py-6">
      <TournamentAdBanner slot="home_top" />
    </UContainer>

    <!-- Below-the-fold sections: delay hydration -->
    <LazyHomeServicesHighlights hydrate-on-visible />

    <!-- Mid banner: keep normal for now -->
    <UContainer class="py-6">
      <TournamentAdBanner slot="home_mid" />
    </UContainer>

    <LazyHomeFeaturedWorkReel :hydrate-on-visible="{ rootMargin: '200px' }" />

    <!-- Bottom banner: can stay normal now -->
    <UContainer class="py-6">
      <TournamentAdBanner slot="home_bottom" />
    </UContainer>

    <LazyHomeTestimonialsStrip hydrate-on-visible />
    <LazyHomeMiniArcadeTeaser :hydrate-on-visible="{ rootMargin: '200px' }" />
  </div>
</template>

<script setup lang="ts">
import TournamentAdBanner from '~/components/tournaments/TournamentAdBanner.vue'

useHead({
  title: 'Home',
  meta: [
    {
      name: 'description',
      content:
        'illusion Arc — Games, AR/VR, VFX/CGI, and animation. Play our arcade games and explore our work.'
    }
  ]
})
</script>