<template>
  <div class="ticker" role="region" aria-label="Important notices">
    <div class="ticker__track">
      <div class="ticker__group">
        <div
          v-for="(item, index) in notices"
          :key="`first-${index}`"
          class="ticker__item"
          :class="item.themeClass"
        >
          <span class="ticker__type">{{ item.type }}:</span>
          <span class="ticker__text">{{ item.text }}</span>
        </div>
      </div>

      <div class="ticker__group" aria-hidden="true">
        <div
          v-for="(item, index) in notices"
          :key="`second-${index}`"
          class="ticker__item"
          :class="item.themeClass"
        >
          <span class="ticker__type">{{ item.type }}:</span>
          <span class="ticker__text">{{ item.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type NoticeItem = {
  type: string
  text: string
  themeClass: string
}

const notices: NoticeItem[] = [
  {
    type: 'গুরুত্বপূর্ণ নোটিশ',
    themeClass: 'theme-yellow',
    text: 'লগ-ইন সমস্যা হলে, গেম লোড সমস্যা হলে অনুগ্রহ করে cache clear করে পুনরায় চেষ্টা করুন। ইনকগনিটো মোড বা নতুন একটি ব্রাউজারে লগ ইন করে খেলুন।'
  },
  {
    type: 'সতর্কতা',
    themeClass: 'theme-red',
    text: 'অস্বাভাবিক activity পর্যবেক্ষণে রাখা হচ্ছে। যেকোনো exploit, device manipulation বা score manipulation শনাক্তে স্কোর রিসেট বা অংশগ্রহণ বাতিল করা হবে।'
  },
  {
    type: 'নোটিশ',
    themeClass: 'theme-green',
    text: 'prize claim-এর জন্য payment invoice, highest score gameplay screenshot ও short screen-record সংরক্ষণ করুন।'
  },
  {
    type: 'আপডেট',
    themeClass: 'theme-cyan',
    text: 'সহায়তার জন্য FAQ দেখুন অথবা official WhatsApp support ব্যবহার করুন।'
  }
]
</script>

<style scoped>
.ticker {
  position: sticky;
  top: 0;
  z-index: 70;
  width: 100%;
  height: 28px;
  overflow: hidden;
  line-height: 1;
}

.ticker__track {
  display: flex;
  width: max-content;
  height: 100%;
  will-change: transform;
  animation: ticker-marquee 42s linear infinite;
}

.ticker:hover .ticker__track {
  animation-play-state: paused;
}

.ticker__group {
  display: flex;
  height: 100%;
  flex-shrink: 0;
}

.ticker__item {
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding: 0 10px;
  margin: 0;
  white-space: nowrap;
  flex-shrink: 0;
  color: #fff;
}

.ticker__type {
  font-size: 0.64rem;
  font-weight: 800;
  margin-right: 6px;
}

.ticker__text {
  font-size: 0.7rem;
  font-weight: 600;
}

.theme-yellow {
  background: #eab308;
}

.theme-red {
  background: #ef4444;
}

.theme-green {
  background: #22c55e;
}

.theme-cyan {
  background: #06b6d4;
}

@keyframes ticker-marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@media (max-width: 768px) {
  .ticker {
    height: 24px;
  }

  .ticker__item {
    padding: 0 8px;
  }

  .ticker__type {
    font-size: 0.58rem;
    margin-right: 5px;
  }

  .ticker__text {
    font-size: 0.62rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ticker__track {
    animation: none;
  }
}
</style>