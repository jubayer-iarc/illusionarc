<template>
  <UApp>
    <Analytics />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
      <!-- Global page transition loader -->
    <!-- <PageLoader /> -->
  </UApp>
</template>

<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt';
// No additional script logic needed
</script>