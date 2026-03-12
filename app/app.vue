<template>
  <UApp>
    <Analytics />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <LandingTournamentBanner
    image="/img/banners/salami.png"
    to="/tournaments/salami-rush-eid-tournament"
    alt="Join the Salami Rush Eid Tournament and win amazing prizes!"
    :enabled="true"
    :show-only-on-home="false"
  />
  </UApp>
</template>

<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt';
import LandingTournamentBanner from '~/components/ads/LandingTournamentBanner.vue';
</script>