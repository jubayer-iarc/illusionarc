<!-- app/components/home/FeaturedWorkReel.vue -->
<script setup lang="ts">
import { PLACEHOLDER_IMG } from '~/constants/media'

const { works, worksPending, worksError, refreshWorks } = useContent()

// ✅ Ensure works loads on first landing (SSR + client)
await refreshWorks()

const featured = computed(() => (works.value || []).slice(0, 8))
</script>

<template>
  <section class="relative py-14">
    <UContainer>
      <div class="flex items-end justify-between gap-4" data-reveal>
        <div>
          <h2 class="text-2xl md:text-3xl font-semibold text-black dark:text-white">
            Featured Work
          </h2>
          <p class="mt-2 text-black/70 dark:text-white/70">
            A quick reel of case studies.
          </p>
        </div>

        <UButton class="press hidden sm:inline-flex" variant="outline" to="/work">
          View All
        </UButton>
      </div>

      <!-- ✅ Error state -->
      <div
          v-if="worksError"
          class="mt-8 rounded-[18px] border border-red-500/20 bg-red-500/10 p-5"
          data-reveal
      >
        <div class="font-semibold text-black dark:text-white">Couldn’t load featured work</div>
        <div class="mt-1 text-sm text-black/70 dark:text-white/70">
          {{ String((worksError as any)?.message || worksError) }}
        </div>
        <UButton class="mt-3" variant="soft" @click="refreshWorks()">
          Retry
        </UButton>
      </div>

      <!-- ✅ Loading skeleton reel -->
      <div
          v-else-if="worksPending"
          class="mt-8 grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-[14px] overflow-x-auto pb-2 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]"
          data-reveal
      >
        <div
            v-for="i in 6"
            :key="i"
            class="snap-start rounded-[18px] p-[14px]
                 border border-black/10 dark:border-white/10
                 bg-white/70 dark:bg-white/5"
        >
          <div
              class="h-[172px] w-full rounded-[14px]
                   border border-black/10 dark:border-white/10
                   bg-black/5 dark:bg-black/30 animate-pulse"
          />
          <div class="mt-3 flex items-center justify-between gap-3">
            <div class="h-4 w-40 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
            <div class="h-5 w-16 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
          </div>
          <div class="mt-2 h-3 w-full rounded bg-black/10 dark:bg-white/10 animate-pulse" />
          <div class="mt-2 h-3 w-5/6 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
          <div class="mt-4 flex gap-2">
            <div class="h-6 w-16 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
            <div class="h-6 w-20 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
            <div class="h-6 w-14 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
          </div>
          <div class="mt-6 h-3 w-28 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
        </div>
      </div>

      <!-- ✅ Empty (only after load) -->
      <div
          v-else-if="featured.length === 0"
          class="mt-8 rounded-[18px] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-6"
          data-reveal
      >
        <div class="font-semibold text-black dark:text-white">No work yet</div>
        <div class="mt-1 text-sm text-black/70 dark:text-white/70">
          Add items from Admin → Works.
        </div>
      </div>

      <!-- ✅ Real reel -->
      <div
          v-else
          class="mt-8 grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-[14px] overflow-x-auto pb-2 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]"
          data-reveal
      >
        <NuxtLink
            v-for="w in featured"
            :key="w.slug"
            :to="`/work/${w.slug}`"
            class="press block snap-start rounded-[18px] p-[14px]
                 border border-black/10 dark:border-white/10
                 bg-white/70 dark:bg-white/5
                 hover:bg-white/90 dark:hover:bg-white/10
                 transition"
        >
          <NuxtImg
              :src="w.hero?.src || PLACEHOLDER_IMG"
              :alt="w.hero?.alt || w.title"
              width="1600"
              height="900"
              sizes="(max-width: 768px) 78vw, 360px"
              class="h-[172px] w-full object-cover rounded-[14px]
                   border border-black/10 dark:border-white/10
                   bg-black/5 dark:bg-black/30"
              loading="lazy"
          />

          <div class="mt-3 flex items-center justify-between gap-3">
            <div class="font-semibold line-clamp-1 text-black dark:text-white">
              {{ w.title }}
            </div>
            <UBadge variant="subtle">{{ w.category }}</UBadge>
          </div>

          <div class="mt-2 text-sm text-black/70 dark:text-white/70 line-clamp-2">
            {{ w.shortDescription }}
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UBadge v-for="t in (w.tags || []).slice(0, 3)" :key="t" variant="outline">
              {{ t }}
            </UBadge>
          </div>

          <div class="mt-6 text-sm text-black/60 dark:text-white/60">
            {{ w.year }} • {{ w.role }}
          </div>
        </NuxtLink>
      </div>
    </UContainer>
  </section>
</template>