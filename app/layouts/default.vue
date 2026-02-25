<script setup lang="ts">
import { SpeedInsights } from '@vercel/speed-insights/vue'
import DesktopShell from '~/components/layout/DesktopShell.vue'
import MobileAppShell from '~/components/layout/MobileAppShell.vue'

const { refresh } = useSiteSettings()
await refresh()

const { kind, ready } = useDeviceKind(768)
</script>

<template>
  <SpeedInsights />

  <!-- SSR fallback: render desktop shell to avoid blank HTML -->
  <DesktopShell v-if="!ready">
    <slot />
  </DesktopShell>

  <!-- Client: render based on detected device -->
  <MobileAppShell v-else-if="kind === 'mobile'">
    <slot />
  </MobileAppShell>

  <DesktopShell v-else>
    <slot />
  </DesktopShell>

  <InstallPwaButton />
</template>