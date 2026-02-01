<template>
  <div class="space-y-0">
    <!-- HERO (full-bleed section but content is container inside it) -->
    <HomeHeroSection />

    <!-- ✅ HOME TOP banner (right after hero) -->
    <UContainer class="py-6">
      <TournamentAdBanner slot="home_top" />
    </UContainer>

    <HomeServicesHighlights />

    <!-- ✅ HOME MID banner (between services + work) -->
    <UContainer class="py-6">
      <TournamentAdBanner slot="home_mid" />
    </UContainer>

    <HomeFeaturedWorkReel />

    <!-- ✅ HOME BOTTOM banner (after featured work) -->
    <UContainer class="py-6">
      <TournamentAdBanner slot="home_bottom" />
    </UContainer>

    <HomeTestimonialsStrip />
    <HomeMiniArcadeTeaser />
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
