<template>
  <UApp>
    <RouteLoader />
    <Analytics />

    <!-- Maintenance Mode -->
    <div v-if="isMaintenance" class="maintenance">
      <div class="card">
        <div class="icon">🚧</div>

        <h1>রক্ষণাবেক্ষণ চলছে</h1>

        <p class="subtitle">
          সবার জন্য আরও ফেয়ার ও নির্ভরযোগ্য গেমপ্লে নিশ্চিত করতে আমরা সাময়িকভাবে সিস্টেম আপডেট করছি।
        </p>

        <p class="time">
          কোনো ধরনের <strong>bug</strong>, <strong>exploit</strong> বা <strong>unfair advantage</strong> দূর করতে আমাদের কাজ চলছে।
        </p>

        <div class="loader"></div>

        <p class="footer">
          খুব শিগগিরই নতুন আপডেটসহ আবার ফিরে আসছি।<br />
          সবাই যেন সমানভাবে খেলতে পারে — সেটাই আমাদের লক্ষ্য। ❤️
        </p>
      </div>
    </div>

    <!-- Normal App -->
    <template v-else>
      <BreakingNewsTicker />

      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>

      <LandingTournamentBanner
        image="/img/banners/salamirush.jpg"
        to="/tournaments/salami-rush-eid-tournament"
        alt="Join the Salami Rush Eid Tournament and win amazing prizes!"
        :enabled="true"
        :show-only-on-home="false"
      />
    </template>
  </UApp>
</template>

<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'
import RouteLoader from '~/components/RouteLoader.vue'
import LandingTournamentBanner from '~/components/ads/LandingTournamentBanner.vue'
import BreakingNewsTicker from '~/components/BreakingNewsTicker.vue'

// Toggle this
const isMaintenance = true
</script>

<style scoped>
.maintenance {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: radial-gradient(circle at top, #1e293b, #020617);
  color: white;
  padding: 20px;
}

.card {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 40px 30px;
  border-radius: 24px;
  text-align: center;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 25px 60px rgba(0,0,0,0.5);
  animation: fadeIn 0.8s ease;
}

.icon {
  font-size: 48px;
  margin-bottom: 10px;
  animation: bounce 1.5s infinite;
}

h1 {
  font-size: 26px;
  margin-bottom: 8px;
}

.subtitle {
  opacity: 0.85;
  margin-bottom: 12px;
  line-height: 1.6;
}

.time {
  font-size: 15px;
  margin-bottom: 20px;
  opacity: 0.9;
  line-height: 1.6;
}

.loader {
  width: 45px;
  height: 45px;
  border: 4px solid rgba(255,255,255,0.15);
  border-top: 4px solid #38bdf8;
  border-radius: 50%;
  margin: 0 auto 15px;
  animation: spin 1s linear infinite;
}

.footer {
  font-size: 13px;
  opacity: 0.75;
  line-height: 1.6;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
</style>