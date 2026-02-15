<script setup lang="ts">
useHead({
  title: 'Privacy Policy — AR-Wallpaper | Illusion Arc.',
  meta: [
    {
      name: 'description',
      content: 'Learn how AR-Wallpaper collects, uses, stores, and protects your data. Includes account deletion and privacy rights.'
    }
  ]
})

import { ref } from 'vue'

const launchDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
const lastUpdated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

const publisherName = 'Illusion Arc'
const legalEntity = 'Creatibuzz LLC'
const businessAddress = '7901 4th St N STE 300, St. Petersburg, Florida 3370, United States'
const websiteUrl = 'https://illusionarc.com'
const supportEmail = 'support@illusionarc.com'
const developerEmail = 'jubayer.ael@akijresource.com'
const phone = '+8801329662037'
</script>

<template>
  <UContainer class="py-12">
    <div class="mx-auto w-full max-w-5xl">
      <!-- Header -->
      <header class="mb-8">
        <h1 class="text-3xl md:text-5xl font-semibold text-black dark:text-white">
          Privacy Policy:  AR-Wallpaper
        </h1>
        <p class="mt-2 text-black/70 dark:text-white/70">
          Effective Date: <span class="font-medium">{{ launchDate }}</span> | Last Updated: <span class="font-medium">{{ lastUpdated }}</span>
        </p>
      </header>

      <div class="space-y-8 text-black/75 dark:text-white/75 leading-relaxed text-left md:text-justify">
        <!-- 1. Developer & Publisher -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">1. Developer & Publisher Information</h2>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Publisher Name: {{ publisherName }}</li>
            <li>Legal Entity: {{ legalEntity }}</li>
            <li>Business Address: {{ businessAddress }}</li>
            <li>Website: 
              <a :href="websiteUrl" target="_blank" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ websiteUrl }}</a>
            </li>
            <li>Support Email: 
              <a :href="`mailto:${supportEmail}`" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ supportEmail }}</a>
            </li>
            <li>Developer Contact: 
              <a :href="`mailto:${developerEmail}`" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ developerEmail }}</a>
            </li>
            <li>Phone: {{ phone }}</li>
          </ul>
        </section>

        <!-- 2. Overview -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">2. Overview</h2>
          <p class="mt-3">
            AR-Wall is a personalized wallpaper application that allows users to:
          </p>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Browse branded and curated wallpapers</li>
            <li>Save favorites</li>
            <li>Download wallpapers</li>
            <li>Set wallpapers (home, lock, or both)</li>
            <li>Access offline wallpaper packs</li>
            <li>Sign in using Google (optional)</li>
          </ul>
          <p class="mt-3">We are committed to protecting your privacy and handling your data transparently.</p>
        </section>

        <!-- 3. Information We Collect -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">3. Information We Collect</h2>
          <h3 class="mt-3 font-semibold text-black dark:text-white">A. Personal Information (If You Sign In)</h3>
          <p class="mt-2">
            If you sign in using Google OAuth via Firebase Authentication, we collect:
          </p>
          <ul class="mt-2 list-disc pl-6 space-y-1">
            <li>Email address</li>
            <li>Firebase User ID</li>
          </ul>
          <p class="mt-2">Used solely to authenticate your account, save favorites, maintain download history, and sync preferences. We do not collect passwords.</p>

          <h3 class="mt-3 font-semibold text-black dark:text-white">B. Non-Personal Information</h3>
          <ul class="mt-2 list-disc pl-6 space-y-1">
            <li>Anonymous app usage data</li>
            <li>Download counters (not linked to personal identity)</li>
            <li>Crash logs (if enabled via Firebase)</li>
            <li>Basic performance diagnostics</li>
          </ul>
          <p class="mt-2">Used to improve app stability and performance.</p>
        </section>

        <!-- 4. Information We Do NOT Collect -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">4. Information We Do NOT Collect</h2>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Precise location</li>
            <li>Contacts, SMS, call logs</li>
            <li>Camera or microphone data</li>
            <li>Files, photos, or media from your gallery</li>
            <li>Financial information</li>
          </ul>
          <p class="mt-2">The app only downloads wallpapers publicly hosted or included offline within the app package.</p>
        </section>

        <!-- 5. How We Use Information -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">5. How We Use Information</h2>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>App functionality</li>
            <li>Account authentication</li>
            <li>Saving favorites and preferences</li>
            <li>Improving performance and reliability</li>
            <li>Preventing abuse and ensuring security</li>
          </ul>
          <p class="mt-2">We do not sell user data.</p>
        </section>

        <!-- 6. Data Sharing -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">6. Data Sharing</h2>
          <p class="mt-3">
            We do not sell or rent personal data. Limited processing may occur via trusted service providers:
          </p>
          <ul class="mt-2 list-disc pl-6 space-y-1">
            <li>Google Firebase (Authentication, Firestore, Storage)</li>
            <li>Google Cloud Infrastructure</li>
          </ul>
          <p class="mt-2">These services process data solely to operate the app.</p>
        </section>

        <!-- 7. Data Storage & Security -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">7. Data Storage & Security</h2>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Data transmitted over HTTPS encryption</li>
            <li>Firebase applies industry-standard security</li>
            <li>Access restricted to authorized personnel</li>
            <li>Download counters stored anonymously</li>
          </ul>
        </section>

        <!-- 8. Data Retention -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">8. Data Retention</h2>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Personal data retained while account is active</li>
            <li>Deletion requests processed within 30 days</li>
            <li>Anonymous analytics may be retained for performance improvement</li>
          </ul>
        </section>

        <!-- 9. Account Deletion -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">9. Account Deletion</h2>
          <p class="mt-2">
            Users may request deletion at any time via email: 
            <a :href="`mailto:${supportEmail}`" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ supportEmail }}</a> 
            with subject "Delete AR-Wall Account".
          </p>
          <p class="mt-2 font-semibold">Data deleted:</p>
          <ul class="mt-2 list-disc pl-6 space-y-1">
            <li>Firebase Authentication account</li>
            <li>Favorites</li>
            <li>Download history</li>
            <li>User preferences</li>
          </ul>
          <p class="mt-2 font-semibold">Data retained:</p>
          <ul class="mt-2 list-disc pl-6 space-y-1">
            <li>Anonymous analytics (non-identifiable)</li>
            <li>Aggregated download counters</li>
          </ul>
          <p class="mt-2">All personal data is permanently removed within 30 days.</p>
        </section>

        <!-- 10. Children’s Privacy -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">10. Children’s Privacy</h2>
          <p class="mt-2">
            AR-Wall is not directed toward children under 13. We do not knowingly collect personal information from children.
          </p>
        </section>

        <!-- 11. Third-Party Services -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">11. Third-Party Services</h2>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Google Firebase Authentication</li>
            <li>Google Cloud Storage</li>
            <li>Google Firestore</li>
          </ul>
          <p class="mt-2">These services may collect technical data as described in their own policies.</p>
        </section>

        <!-- 12. Permissions Used -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">12. Permissions Used</h2>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Internet access (for downloading wallpapers)</li>
            <li>Storage access (for saving wallpapers locally, if required)</li>
            <li>Wallpaper setting permission</li>
          </ul>
          <p class="mt-2">The app does not access personal files.</p>
        </section>

        <!-- 13. International Users -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">13. International Users</h2>
          <p class="mt-2">
            By using AR-Wall, you consent to data processing in the United States and other regions where our infrastructure operates.
          </p>
        </section>

        <!-- 14. Changes to Policy -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">14. Changes to This Policy</h2>
          <p class="mt-2">
            We may update this Privacy Policy periodically. Updates will be posted at:
            <a :href="websiteUrl + '/privacy/ar-wall'" target="_blank" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ websiteUrl }}/privacy/ar-wall</a>
          </p>
        </section>

        <!-- 15. Contact Us -->
        <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur p-5">
          <h2 class="text-xl font-semibold text-black dark:text-white">15. Contact Us</h2>
          <ul class="mt-3 list-disc pl-6 space-y-1">
            <li>Email: 
              <a :href="`mailto:${supportEmail}`" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ supportEmail }}</a>
            </li>
            <li>Developer: 
              <a :href="`mailto:${developerEmail}`" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ developerEmail }}</a>
            </li>
            <li>Phone: {{ phone }}</li>
            <li>Website: 
              <a :href="websiteUrl" target="_blank" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ websiteUrl }}</a>
            </li>
          </ul>
        </section>

        <div class="pt-2 text-xs text-black/50 dark:text-white/50">
          Effective Date: {{ launchDate }} | Last Updated: {{ lastUpdated }}
        </div>
      </div>
    </div>
  </UContainer>
</template>
