<script setup lang="ts">
import { SpeedInsights } from '@vercel/speed-insights/vue';

</script>

<template>
  <div class="min-h-dvh bg-black text-white">
    <speed-insights />
    <slot />
  </div>
</template>
