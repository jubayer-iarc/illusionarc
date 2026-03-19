<template>
  <div
    class="ticker-shell"
    role="region"
    aria-label="Important notices"
  >
    <div class="ticker-live">
      <span class="ticker-live__dot" />
      <span class="ticker-live__text">LIVE UPDATE</span>
    </div>

    <div class="ticker-marquee">
      <div class="ticker-track">
        <div class="ticker-group">
          <div
            v-for="(item, index) in notices"
            :key="`first-${index}`"
            class="ticker-item"
            :class="item.themeClass"
          >
            <span class="ticker-item__type">{{ item.type }}:</span>
            <span class="ticker-item__text">{{ item.text }}</span>
          </div>
        </div>

        <div class="ticker-group" aria-hidden="true">
          <div
            v-for="(item, index) in notices"
            :key="`second-${index}`"
            class="ticker-item"
            :class="item.themeClass"
          >
            <span class="ticker-item__type">{{ item.type }}:</span>
            <span class="ticker-item__text">{{ item.text }}</span>
          </div>
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
    themeClass: 'theme-amber',
    text: 'লগ-ইন সমস্যা হলে, গেম লোড সমস্যা হলে অনুগ্রহ করে cache clear করে পুনরায় চেষ্টা করুন। ইনকগনিটো মোড বা নতুন একটি ব্রাউজারে লগ ইন করে খেলুন।'
  },
  {
    type: 'সতর্কতা',
    themeClass: 'theme-rose',
    text: 'অস্বাভাবিক activity পর্যবেক্ষণে রাখা হচ্ছে। যেকোনো exploit, device manipulation বা score manipulation শনাক্তে স্কোর রিসেট বা অংশগ্রহণ বাতিল করা হবে।'
  },
  {
    type: 'নোটিশ',
    themeClass: 'theme-green',
    text: 'prize claim-এর জন্য payment invoice ও highest score gameplay screenshot সংরক্ষণ করুন।'
  },
  {
    type: 'আপডেট',
    themeClass: 'theme-cyan',
    text: 'সহায়তার জন্য FAQ দেখুন অথবা official WhatsApp support ব্যবহার করুন।'
  }
]
</script>

<style scoped>
.ticker-shell {
  --ticker-top: 0px;
  --ticker-height: 56px;

  position: sticky;
  top: var(--ticker-top);
  z-index: 90;

  width: calc(100% - 24px);
  margin: 8px auto 0;
  height: var(--ticker-height);

  display: flex;
  align-items: center;
  gap: 0;
  padding: 6px;

  border-radius: 999px;
  overflow: hidden;

  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow:
    0 10px 30px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(16px) saturate(165%);
  -webkit-backdrop-filter: blur(16px) saturate(165%);
}

/* Live pill */
.ticker-live {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;

  height: 100%;
  display: inline-flex;
  align-items: center;
  gap: 10px;

  padding: 0 18px;
  border-radius: 999px;

  color: #ffffff;
  white-space: nowrap;
  font-weight: 800;
  letter-spacing: 0.04em;

  background: linear-gradient(135deg, #ff4d6d 0%, #ff6a00 56%, #ff9a1f 100%);
  box-shadow:
    0 10px 22px rgba(255, 106, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.ticker-live__dot {
  position: relative;
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 999px;

  background: radial-gradient(
    circle at 35% 35%,
    #ffffff 0%,
    #fff7ed 28%,
    #ffd7a3 56%,
    #ff8a00 100%
  );

  box-shadow:
    0 0 0 0 rgba(255, 138, 0, 0.55),
    0 0 12px rgba(255, 120, 0, 0.95),
    0 0 24px rgba(255, 90, 0, 0.45);

  animation: liveDotPulse 1.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}

.ticker-live__dot::before,
.ticker-live__dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.ticker-live__dot::before {
  border: 2px solid rgba(255, 166, 0, 0.45);
  animation: liveDotRing 1.5s ease-out infinite;
}

.ticker-live__dot::after {
  box-shadow: 0 0 18px rgba(255, 132, 0, 0.78);
}

.ticker-live__text {
  font-size: 0.82rem;
  font-weight: 900;
  line-height: 1;
}

/* Marquee */
.ticker-marquee {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;

  height: 100%;
  overflow: hidden;

  margin-left: -22px;
  padding-left: 30px;
  border-radius: 0 999px 999px 0;

  background: rgba(255, 255, 255, 0.36);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.52),
    inset 0 -1px 0 rgba(148, 163, 184, 0.14);
}

.ticker-marquee::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 44px;
  height: 100%;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.18) 0%,
    rgba(255, 255, 255, 0.04) 68%,
    rgba(255, 255, 255, 0) 100%
  );
}

.ticker-track {
  display: flex;
  width: max-content;
  height: 100%;
  will-change: transform;
  animation: tickerMarquee 56s linear infinite;
}

.ticker-shell:hover .ticker-track {
  animation-play-state: paused;
}

.ticker-group {
  display: flex;
  align-items: center;
  height: 100%;
  flex-shrink: 0;
}

.ticker-item {
  display: inline-flex;
  align-items: center;
  height: 100%;
  flex-shrink: 0;

  padding: 0 18px;
  white-space: nowrap;

  color: #0f172a;
  border-right: 1px solid rgba(255, 255, 255, 0.4);
}

.ticker-item__type {
  margin-right: 6px;
  font-size: 0.78rem;
  font-weight: 900;
}

.ticker-item__text {
  font-size: 0.82rem;
  font-weight: 700;
  opacity: 0.98;
}

/* Vibrant themes */
.theme-amber {
  background: linear-gradient(
    90deg,
    rgba(255, 233, 138, 0.98) 0%,
    rgba(255, 193, 7, 0.94) 100%
  );
}

.theme-rose {
  background: linear-gradient(
    90deg,
    rgba(255, 190, 200, 0.98) 0%,
    rgba(255, 99, 132, 0.92) 100%
  );
}

.theme-green {
  background: linear-gradient(
    90deg,
    rgba(134, 239, 172, 0.98) 0%,
    rgba(34, 197, 94, 0.92) 100%
  );
}

.theme-cyan {
  background: linear-gradient(
    90deg,
    rgba(125, 211, 252, 0.98) 0%,
    rgba(14, 165, 233, 0.92) 100%
  );
}

/* Animations */
@keyframes tickerMarquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@keyframes liveDotPulse {
  0% {
    transform: scale(1);
    box-shadow:
      0 0 0 0 rgba(255, 138, 0, 0.55),
      0 0 12px rgba(255, 120, 0, 0.95),
      0 0 24px rgba(255, 90, 0, 0.45);
  }
  45% {
    transform: scale(1.14);
    box-shadow:
      0 0 0 8px rgba(255, 138, 0, 0.14),
      0 0 16px rgba(255, 132, 0, 1),
      0 0 30px rgba(255, 90, 0, 0.58);
  }
  75% {
    transform: scale(1);
    box-shadow:
      0 0 0 14px rgba(255, 138, 0, 0),
      0 0 12px rgba(255, 120, 0, 0.88),
      0 0 20px rgba(255, 90, 0, 0.35);
  }
  100% {
    transform: scale(1);
    box-shadow:
      0 0 0 0 rgba(255, 138, 0, 0),
      0 0 12px rgba(255, 120, 0, 0.95),
      0 0 24px rgba(255, 90, 0, 0.45);
  }
}

@keyframes liveDotRing {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  70% {
    transform: scale(2.5);
    opacity: 0;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

/* Tablet */
@media (max-width: 992px) {
  .ticker-shell {
    --ticker-height: 50px;
    width: calc(100% - 16px);
    margin-top: 6px;
    padding: 4px;
  }

  .ticker-live {
    padding: 0 14px;
    gap: 8px;
  }

  .ticker-live__text {
    font-size: 0.72rem;
  }

  .ticker-live__dot {
    width: 9px;
    height: 9px;
  }

  .ticker-marquee {
    margin-left: -18px;
    padding-left: 24px;
  }

  .ticker-item {
    padding: 0 14px;
  }

  .ticker-item__type {
    font-size: 0.72rem;
  }

  .ticker-item__text {
    font-size: 0.76rem;
  }
}

/* Mobile */
@media (max-width: 640px) {
  .ticker-shell {
    --ticker-height: 46px;
    width: calc(100% - 10px);
    margin-top: 6px;
    padding: 4px;
    border-radius: 22px;
  }

  .ticker-live {
    gap: 7px;
    padding: 0 12px;
    max-width: fit-content;
  }

  .ticker-live__dot {
    width: 8px;
    height: 8px;
  }

  .ticker-live__text {
    font-size: 0.66rem;
    letter-spacing: 0.03em;
  }

  .ticker-marquee {
    margin-left: -14px;
    padding-left: 18px;
    border-radius: 0 18px 18px 0;
  }

  .ticker-marquee::before {
    width: 28px;
  }

  .ticker-item {
    padding: 0 12px;
  }

  .ticker-item__type {
    margin-right: 5px;
    font-size: 0.66rem;
  }

  .ticker-item__text {
    font-size: 0.7rem;
  }
}

/* Small mobile */
@media (max-width: 420px) {
  .ticker-shell {
    --ticker-height: 42px;
    width: calc(100% - 8px);
    margin-top: 4px;
    padding: 3px;
  }

  .ticker-live {
    padding: 0 10px;
    gap: 6px;
  }

  .ticker-live__text {
    font-size: 0.6rem;
  }

  .ticker-marquee {
    margin-left: -12px;
    padding-left: 16px;
  }

  .ticker-item {
    padding: 0 10px;
  }

  .ticker-item__type {
    font-size: 0.62rem;
  }

  .ticker-item__text {
    font-size: 0.66rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ticker-track,
  .ticker-live__dot,
  .ticker-live__dot::before {
    animation: none;
  }
}
</style>