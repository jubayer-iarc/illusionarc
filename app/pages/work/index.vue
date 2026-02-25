<script setup lang="ts">
import { PLACEHOLDER_IMG } from '~/constants/media'

useHead({ title: 'Work' })

const { works, worksPending, worksError, refreshWorks } = useContent()

// ✅ Ensure the request is triggered on first entry (SSR + client nav)
await refreshWorks()

function imageSrc(w: any) {
  const src = String(w?.hero?.src || '').trim()
  return src || PLACEHOLDER_IMG
}
</script>

<template>
  <UContainer class="py-16">
    <div class="flex items-end justify-between gap-4" data-reveal>
      <div>
        <h1 class="text-3xl font-semibold">Work</h1>
        <p class="mt-2 opacity-80">Case studies across Games, AR/VR, VFX/CGI, and Animation.</p>
      </div>
    </div>

    <!-- ✅ Error state (otherwise errors look like empty DB) -->
    <div
        v-if="worksError"
        class="mt-10 rounded-3xl border border-red-500/20 bg-red-500/10 p-8"
        data-reveal
    >
      <div class="text-lg font-semibold">Couldn’t load works</div>
      <div class="mt-2 text-sm opacity-80">
        {{ String((worksError as any)?.message || worksError) }}
      </div>
      <UButton class="mt-4" variant="soft" @click="refreshWorks()">
        Retry
      </UButton>
    </div>

    <!-- ✅ Loading skeleton -->
    <div v-else-if="worksPending" class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
      <div
          v-for="i in 6"
          :key="i"
          class="rounded-3xl border border-white/10 bg-white/5 p-4"
      >
        <div class="h-44 w-full rounded-xl border border-white/10 bg-white/10 animate-pulse" />
        <div class="mt-4 h-4 w-2/3 rounded bg-white/10 animate-pulse" />
        <div class="mt-2 h-3 w-full rounded bg-white/10 animate-pulse" />
        <div class="mt-2 h-3 w-5/6 rounded bg-white/10 animate-pulse" />
      </div>
    </div>

    <!-- ✅ Empty state only after loading finished -->
    <div
        v-else-if="(works?.length || 0) === 0"
        class="mt-10 rounded-3xl border border-white/10 bg-white/5 p-10 text-center"
        data-reveal
    >
      <div class="text-lg font-semibold">No work yet</div>
      <div class="mt-2 text-sm opacity-70">Add items from Admin → Works.</div>
    </div>

    <!-- ✅ Real grid -->
    <div v-else class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
      <NuxtLink
          v-for="w in works"
          :key="w.slug"
          :to="`/work/${w.slug}`"
          class="block"
      >
        <UCard class="press bg-white/5 border-white/10 hover:border-white/20 transition overflow-hidden">
          <NuxtImg
              :src="imageSrc(w)"
              :alt="w?.hero?.alt || w?.title || 'Work'"
              width="1600"
              height="900"
              sizes="(max-width: 768px) 100vw, 360px"
              class="h-44 w-full object-cover rounded-xl border border-white/10 mb-3 bg-white/5"
              loading="lazy"
          />

          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="font-semibold line-clamp-1">{{ w.title }}</div>
              <UBadge variant="subtle">{{ w.category }}</UBadge>
            </div>
          </template>

          <div class="text-sm opacity-80 line-clamp-2">
            {{ w.shortDescription }}
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UBadge v-for="t in (w.tags || []).slice(0, 4)" :key="t" variant="outline">
              {{ t }}
            </UBadge>
          </div>

          <template #footer>
            <div class="flex items-center justify-between">
              <div class="text-sm opacity-70">{{ w.year }}</div>
              <span class="text-sm opacity-70">View →</span>
            </div>
          </template>
        </UCard>
      </NuxtLink>
    </div>
  </UContainer>
</template>