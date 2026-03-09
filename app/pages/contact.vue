<!-- app/pages/contact.vue -->
<script setup lang="ts">
useHead({
  title: 'Contact — illusion Arc',
  meta: [
    {
      name: 'description',
      content: 'Contact Illusion Arc for game development, AR/VR, VFX, animation, and interactive web projects.'
    }
  ]
})

type ProjectType =
  | 'Game Development'
  | 'AR/VR'
  | 'VFX/CGI'
  | 'Animation'
  | 'Interactive Web'
  | 'Other'

type BudgetType =
  | 'Under $500'
  | '$500–$2k'
  | '$2k–$5k'
  | '$5k–$10k'
  | '$10k+'

type FormState = {
  name: string
  email: string
  projectType: ProjectType
  budget: BudgetType
  message: string
  website: string // honeypot
}

const toast = useToast()
const loading = ref(false)

const state = reactive<FormState>({
  name: '',
  email: '',
  projectType: 'Game Development',
  budget: '$500–$2k',
  message: '',
  website: ''
})

const projectTypeOptions: ProjectType[] = [
  'Game Development',
  'AR/VR',
  'VFX/CGI',
  'Animation',
  'Interactive Web',
  'Other'
]

const budgetOptions: BudgetType[] = [
  'Under $500',
  '$500–$2k',
  '$2k–$5k',
  '$5k–$10k',
  '$10k+'
]

function isEmailValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function validate(): string | null {
  if (!state.name.trim()) return 'Please enter your name.'
  if (!state.email.trim() || !isEmailValid(state.email)) return 'Please enter a valid email.'
  if (!state.message.trim() || state.message.trim().length < 10) {
    return 'Please write a short project message (10+ chars).'
  }
  return null
}

function resetForm() {
  state.name = ''
  state.email = ''
  state.projectType = 'Game Development'
  state.budget = '$500–$2k'
  state.message = ''
  state.website = ''
}

async function submit() {
  if (state.website.trim()) {
    resetForm()
    return
  }

  const err = validate()
  if (err) {
    toast.add({ title: 'Check the form', description: err, color: 'warning' })
    return
  }

  loading.value = true
  try {
    await $fetch('/api/contact/submit', {
      method: 'POST',
      body: {
        name: state.name,
        email: state.email,
        projectType: state.projectType,
        budget: state.budget,
        message: state.message,
        website: state.website
      }
    })

    toast.add({
      title: 'Sent!',
      description: 'We received your message. We’ll reply soon.',
      color: 'success'
    })
    resetForm()
  } catch (e: any) {
    toast.add({
      title: 'Failed',
      description: e?.data?.statusMessage || e?.data?.message || e?.message || 'Please try again.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UContainer class="py-10 md:py-14">
    <!-- HERO -->
    <div class="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 md:p-10">
      <!-- glow blobs -->
      <div class="pointer-events-none absolute inset-0 opacity-70">
        <div class="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/12 blur-3xl" />
        <div class="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/12 blur-3xl" />
        <div class="absolute top-10 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div class="relative">
        <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs">
          <UIcon name="i-heroicons-sparkles" class="w-4 h-4" />
          <span class="opacity-80">Let’s build something playable</span>
        </div>

        <h1 class="mt-4 text-3xl md:text-5xl font-semibold tracking-tight">Contact</h1>
        <p class="mt-3 max-w-2xl text-sm md:text-base opacity-80 leading-relaxed">
          Tell us what you want to build — game, XR, VFX, animation, or interactive web.
          We’ll respond with next steps and a clear plan.
        </p>

        <!-- Quick contact buttons -->
        <div class="mt-6 flex flex-wrap gap-2">
          <UButton variant="soft" icon="i-heroicons-envelope" to="mailto:admin@illusionarc.com">
            Email
          </UButton>

          <UButton
            variant="soft"
            icon="i-heroicons-chat-bubble-left-right"
            to="https://wa.me/8801329662037"
            target="_blank"
          >
            WhatsApp
          </UButton>

          <UButton variant="ghost" icon="i-heroicons-briefcase" to="/work">
            View Work
          </UButton>
        </div>
      </div>
    </div>

    <!-- MAIN GRID -->
    <div class="mt-8 grid gap-6 lg:grid-cols-3">
      <!-- FORM -->
      <UCard class="lg:col-span-2 bg-white/5 border-white/10 overflow-hidden">
        <template #header>
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-lg font-semibold">Project inquiry</div>
              <div class="mt-1 text-sm opacity-70">
                Share a few details — we’ll reply with scope, timeline and next steps.
              </div>
              <div class="mt-3 text-xs opacity-70">
                Helpful: platform, reference links, must-have features, timeline.
              </div>
            </div>

            <div class="hidden sm:flex items-center gap-2 text-xs">
              <span class="px-2 py-1 rounded-full bg-black/20 border border-white/10">24–48h reply</span>
              <span class="px-2 py-1 rounded-full bg-black/20 border border-white/10">Free estimate</span>
            </div>
          </div>
        </template>

        <form class="p-1" @submit.prevent="submit">
          <div class="grid gap-4 md:grid-cols-2">
            <UFormField label="Name" required>
              <UInput
                v-model="state.name"
                placeholder="Your name"
                autocomplete="name"
                size="lg"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Email" required>
              <UInput
                v-model="state.email"
                placeholder="you@email.com"
                autocomplete="email"
                inputmode="email"
                size="lg"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Project type" required>
              <USelect
                v-model="state.projectType"
                :items="projectTypeOptions"
                placeholder="Select project type"
                size="lg"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Budget range" required>
              <USelect
                v-model="state.budget"
                :items="budgetOptions"
                placeholder="Select budget"
                size="lg"
                class="w-full"
              />
            </UFormField>

            <!-- FULL WIDTH MESSAGE -->
            <div class="md:col-span-2">
              <UFormField
                label="Message"
                required
                help="Minimum 10 characters. You can paste links too."
              >
                <UTextarea
                  v-model="state.message"
                  :rows="8"
                  size="lg"
                  class="w-full"
                  placeholder="What are you building? Platform? Any links? Timeline?"
                />
              </UFormField>
            </div>

            <!-- honeypot -->
            <input v-model="state.website" class="hidden" tabindex="-1" autocomplete="off" />
          </div>

          <div class="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="text-xs opacity-70">
              We’ll never share your details. (Add privacy page later if needed.)
            </div>

            <div class="flex items-center gap-2">
              <UButton type="button" variant="ghost" @click="resetForm" :disabled="loading">
                Reset
              </UButton>

              <UButton color="primary" variant="solid" :loading="loading" type="submit" size="lg">
                <UIcon name="i-heroicons-paper-airplane" class="w-5 h-5" />
                Send message
              </UButton>
            </div>
          </div>
        </form>
      </UCard>

      <!-- SIDEBAR -->
      <div class="space-y-6">
        <UCard class="bg-white/5 border-white/10">
          <template #header>
            <div class="text-lg font-semibold">What happens next</div>
          </template>

          <div class="space-y-3 text-sm opacity-80">
            <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div class="font-semibold opacity-100">1) Quick reply</div>
              <div class="mt-1 opacity-75">Usually within 24–48 hours.</div>
            </div>

            <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div class="font-semibold opacity-100">2) Scope call (optional)</div>
              <div class="mt-1 opacity-75">We clarify features, timeline and platform.</div>
            </div>

            <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div class="font-semibold opacity-100">3) Plan + estimate</div>
              <div class="mt-1 opacity-75">You get a clear roadmap + cost estimate.</div>
            </div>
          </div>
        </UCard>

        <UCard class="bg-white/5 border-white/10">
          <template #header>
            <div class="text-lg font-semibold">What helps most</div>
          </template>

          <ul class="text-sm opacity-80 space-y-2">
            <li class="flex gap-2">
              <UIcon name="i-heroicons-device-phone-mobile" class="w-5 h-5 opacity-70" />
              <span>Platform (Mobile / Web / VR / PC)</span>
            </li>
            <li class="flex gap-2">
              <UIcon name="i-heroicons-link" class="w-5 h-5 opacity-70" />
              <span>Reference links / inspiration</span>
            </li>
            <li class="flex gap-2">
              <UIcon name="i-heroicons-calendar-days" class="w-5 h-5 opacity-70" />
              <span>Deadline + must-have features</span>
            </li>
          </ul>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>