<script setup lang="ts">
useHead({
  title: 'Account Deletion — AR-Wall | Illusion Arc.',
  meta: [
    {
      name: 'description',
      content:
        'Learn how to permanently delete your AR-Wall account and associated data. Understand what data is deleted, retained, and the retention period.'
    }
  ]
})

import { ref } from 'vue'

const effectiveDate = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

const emailAdmin = 'admin@illusionarc.com'
const emailSupport = 'support@illusionarc.com'
const websiteUrl = 'https://illusionarc.com'
</script>

<template>
  <UContainer class="py-12">
    <div class="mx-auto w-full max-w-4xl">
      <!-- Header -->
      <header class="mb-8">
        <h1 class="text-3xl md:text-5xl font-semibold text-black dark:text-white">
          AR-Wall Account Deletion Policy
        </h1>
        <p class="mt-2 text-black/70 dark:text-white/70">
          Effective Date: <span class="font-medium">{{ effectiveDate }}</span>
        </p>
      </header>

      <div class="space-y-8 text-black/75 dark:text-white/75 leading-relaxed text-left md:text-justify">
        <!-- Introduction -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <p>
            AR-Wall respects your privacy and gives users full control over their account data. You may request permanent deletion of your account and associated data at any time.
          </p>
        </section>

        <!-- How to Request -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">How to Request Account Deletion</h2>
          <p class="mt-3">
            To request deletion of your AR-Wall account:
          </p>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Email: 
              <a :href="`mailto:${emailAdmin}`" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ emailAdmin }}</a>
            </li>
            <li>Subject: Delete AR-Wall Account</li>
            <li>Please include:
              <ul class="mt-1 list-disc pl-5 space-y-1">
                <li>The email address used to sign in</li>
                <li>Your registered display name (if applicable)</li>
              </ul>
            </li>
          </ul>
          <p class="mt-3">
            Our team will verify the request and process deletion accordingly.
          </p>
        </section>

        <!-- Data to be Deleted -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">What Data Will Be Deleted</h2>
          <p class="mt-3">
            When your account deletion request is processed, the following data will be permanently removed:
          </p>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>User profile (Firebase Authentication account)</li>
            <li>Favorites and saved wallpapers</li>
            <li>Download history</li>
            <li>User preferences and settings</li>
            <li>Any user-linked identifiers</li>
          </ul>
        </section>

        <!-- Data Retention -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">What Data May Be Retained</h2>
          <p class="mt-3">
            Certain non-personally identifiable data may be retained for operational and analytics purposes:
          </p>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Anonymous usage analytics</li>
            <li>Aggregated download counters (not linked to any individual user)</li>
            <li>Security logs (if required for fraud prevention)</li>
          </ul>
          <p class="mt-3">
            This retained data cannot be used to identify you.
          </p>
        </section>

        <!-- Retention Period -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">Retention Period</h2>
          <p class="mt-3">
            All personal account data is permanently deleted within 30 days of verified request submission.
          </p>
        </section>

        <!-- Important Notes -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">Important Notes</h2>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Account deletion is permanent and cannot be undone.</li>
            <li>Once deleted, your favorites, preferences, and history cannot be recovered.</li>
            <li>If you signed in using Google OAuth, your AR-Wall app account will be deleted, but your Google account will remain unaffected.</li>
          </ul>
        </section>

        <!-- Contact -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">Contact</h2>
          <p class="mt-3">
            For questions related to data privacy or account deletion, please contact us:
          </p>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Email: 
              <a :href="`mailto:${emailAdmin}`" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ emailAdmin }}</a>
            </li>
            <li>Email: 
              <a :href="`mailto:${emailSupport}`" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ emailSupport }}</a>
            </li>
            <li>Website: 
              <a :href="websiteUrl" target="_blank" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ websiteUrl }}</a>
            </li>
          </ul>
        </section>

        <div class="pt-2 text-xs text-black/50 dark:text-white/50">
          Effective Date: {{ effectiveDate }}
        </div>
      </div>
    </div>
  </UContainer>
</template>
