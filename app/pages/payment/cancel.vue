<script setup lang="ts">
useHead({ title: 'Payment Cancelled' })
const route = useRoute()
const tranId = computed(() => String(route.query.tran_id || ''))
</script>

<template>
  <UContainer class="py-10">
    <div class="rounded-3xl border border-white/10 bg-white/5 p-7">
      <h1 class="text-2xl font-semibold">Payment cancelled ⚠️</h1>
      <p class="mt-2 text-sm opacity-75">
        Transaction: <span class="font-mono">{{ tranId }}</span>
      </p>
      <p class="mt-3 text-sm opacity-80">
        You cancelled the payment. No charges were made.
      </p>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <UButton class="!rounded-full" to="/subscribe">Back to passes</UButton>
        <UButton class="!rounded-full" variant="soft" to="/">Go home</UButton>
      </div>
    </div>
  </UContainer>
</template>
