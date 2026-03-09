<!-- app/pages/forget-password.vue -->
<script setup lang="ts">
useHead({
  title: 'Reset password — illusion Arc',
  meta: [{ name: 'description', content: 'Request a password reset link for your illusion Arc account.' }]
})

definePageMeta({
  middleware: ['guest-only']
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()
const toast = useToast()

const loading = ref(false)
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')

const sent = ref(false)
const lastSentAt = ref<number | null>(null)

function isEmailValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())
}

const canSubmit = computed(() => {
  if (!isEmailValid(email.value)) return false
  if (loading.value) return false
  if (lastSentAt.value && Date.now() - lastSentAt.value < 8000) return false
  return true
})

async function sendResetLink() {
  const e = email.value.trim()

  if (!e) {
    toast.add({
      title: 'Missing email',
      description: 'Please enter your email address.',
      color: 'warning'
    })
    return
  }

  if (!isEmailValid(e)) {
    toast.add({
      title: 'Invalid email',
      description: 'Please enter a valid email address.',
      color: 'warning'
    })
    return
  }

  loading.value = true
  try {
    let rt = ''
    if (import.meta.client) {
      rt = `${window.location.origin}/update-password`
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      e,
      rt ? { redirectTo: rt } : undefined
    )
    if (error) throw error

    sent.value = true
    lastSentAt.value = Date.now()

    toast.add({
      title: 'Reset link sent',
      description: 'Check your inbox (and spam) for the password reset email.',
      color: 'success'
    })
  } catch (err: any) {
    const msg = String(err?.message || err?.error_description || 'Please try again.')
    toast.add({
      title: 'Could not send reset email',
      description: msg,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function backToLogin() {
  navigateTo('/login', { replace: true })
}

function openMailHint() {
  const e = email.value.trim()
  if (!e || !import.meta.client) return
  window.location.href = `mailto:${encodeURIComponent(e)}`
}

watch(
  () => user.value?.id,
  (id) => {
    if (id) navigateTo('/arcade', { replace: true })
  },
  { immediate: true }
)
</script>

<template>
  <div class="authPage">
    <div class="bg" aria-hidden="true" />
    <div class="wash" aria-hidden="true" />
    <div class="noise" aria-hidden="true" />

    <div class="orb orbA" aria-hidden="true" />
    <div class="orb orbB" aria-hidden="true" />
    <div class="orb orbC" aria-hidden="true" />

    <UContainer class="relative py-10 md:py-14">
      <div class="grid gap-8 lg:grid-cols-2 items-start">
        <div class="order-2 lg:order-1 max-w-xl">
          <div class="badge">
            <UIcon name="i-heroicons-key" class="w-4 h-4" />
            Password reset
          </div>

          <h1 class="mt-4 text-4xl md:text-6xl font-semibold tracking-tight">
            Recover your <span class="grad">account</span>
          </h1>

          <p class="mt-4 text-sm md:text-base opacity-80 leading-relaxed max-w-lg">
            Enter your email and we’ll send you a secure link to reset your password.
          </p>

          <div class="mt-6 grid gap-3 sm:grid-cols-2 max-w-lg">
            <div class="feature">
              <UIcon name="i-heroicons-shield-check" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Secure link</div>
                <div class="text-xs opacity-70">One-time token, time-limited</div>
              </div>
            </div>

            <div class="feature">
              <UIcon name="i-heroicons-inbox" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Inbox check</div>
                <div class="text-xs opacity-70">Also check spam / promotions</div>
              </div>
            </div>

            <div class="feature">
              <UIcon name="i-heroicons-device-phone-mobile" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Mobile-friendly</div>
                <div class="text-xs opacity-70">Works on phones too</div>
              </div>
            </div>

            <div class="feature">
              <UIcon name="i-heroicons-sparkles" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Fast</div>
                <div class="text-xs opacity-70">Typically arrives in seconds</div>
              </div>
            </div>
          </div>

          <div class="mt-6 text-xs opacity-60">
            Remembered your password?
            <button class="linkBtn" type="button" @click="backToLogin">Go back to login</button>
          </div>
        </div>

        <div class="order-1 lg:order-2 lg:justify-self-end w-full max-w-xl">
          <div class="card">
            <div class="cardHead">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-lg font-semibold">Reset password</div>
                  <div class="text-xs opacity-70 mt-1">
                    {{ sent ? 'We sent you an email with a reset link.' : 'We will email you a reset link.' }}
                  </div>
                </div>

                <UButton type="button" size="xs" variant="ghost" @click="backToLogin">
                  <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
                  Back
                </UButton>
              </div>
            </div>

            <div class="cardBody">
              <form class="grid gap-4" @submit.prevent="sendResetLink">
                <UFormField label="Email" required>
                  <UInput
                    v-model="email"
                    class="w-full"
                    placeholder="you@email.com"
                    autocomplete="email"
                    icon="i-heroicons-envelope"
                    :disabled="loading"
                  />
                </UFormField>

                <UButton
                  type="submit"
                  class="w-full"
                  color="primary"
                  variant="solid"
                  size="lg"
                  :loading="loading"
                  :disabled="!canSubmit"
                >
                  <UIcon name="i-heroicons-paper-airplane" class="w-5 h-5" />
                  Send reset link
                </UButton>

                <div v-if="sent" class="hintBox">
                  <div class="hintTitle">
                    <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
                    Email sent
                  </div>
                  <div class="hintText">
                    If you don’t see it, check <span class="opacity-100">Spam</span> /
                    <span class="opacity-100">Promotions</span>. Then open the link to set a new password.
                  </div>

                  <div class="mt-3 grid gap-2 sm:grid-cols-2">
                    <UButton type="button" variant="soft" size="md" class="w-full" @click="sendResetLink">
                      <UIcon name="i-heroicons-arrow-path" class="w-5 h-5" />
                      Resend
                    </UButton>
                    <UButton type="button" variant="soft" size="md" class="w-full" @click="openMailHint">
                      <UIcon name="i-heroicons-inbox" class="w-5 h-5" />
                      Open mail app
                    </UButton>
                  </div>
                </div>

                <div class="divider">
                  <span class="text-xs opacity-60">illusion Arc</span>
                </div>

                <div class="text-xs opacity-70 leading-relaxed">
                  Security tip: If you didn’t request this, you can ignore the email.
                </div>
              </form>
            </div>
          </div>

          <div class="mt-4 text-xs opacity-60 text-center">
            Need help? Contact support from the main site.
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>
.authPage { position: relative; min-height: calc(100dvh - 64px); overflow: hidden; color: var(--app-fg); }
.bg { position: absolute; inset: 0; background: var(--app-bg); }
.wash { position: absolute; inset: 0; background: radial-gradient(900px 600px at 15% 20%, var(--wash-b), transparent 60%), radial-gradient(900px 600px at 85% 30%, var(--wash-a), transparent 60%), radial-gradient(900px 700px at 55% 90%, rgba(34, 197, 94, 0.10), transparent 60%), linear-gradient(to bottom, rgba(255, 255, 255, 0.05), transparent 35%, rgba(255, 255, 255, 0.03)); opacity: 0.9; }
.noise { position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E"); opacity: 0.1; mix-blend-mode: overlay; }
.orb { position: absolute; border-radius: 9999px; filter: blur(24px); opacity: 0.55; transform: translateZ(0); animation: float 9s ease-in-out infinite; }
.orbA { width: 280px; height: 280px; left: -90px; top: 80px; background: radial-gradient(circle at 30% 30%, rgba(34, 211, 238, 0.35), rgba(34, 211, 238, 0.06) 60%, transparent 70%); }
.orbB { width: 320px; height: 320px; right: -120px; top: 120px; background: radial-gradient(circle at 30% 30%, rgba(124, 58, 237, 0.35), rgba(124, 58, 237, 0.06) 60%, transparent 70%); animation-delay: -2s; }
.orbC { width: 360px; height: 360px; left: 40%; bottom: -180px; background: radial-gradient(circle at 30% 30%, rgba(34, 197, 94, 0.25), rgba(34, 197, 94, 0.05) 60%, transparent 70%); animation-delay: -4s; }
@keyframes float { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-14px) scale(1.02); } }
.grad { background: linear-gradient(90deg, rgba(34, 211, 238, 1), rgba(124, 58, 237, 1), rgba(34, 197, 94, 1)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.badge { display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); padding: 0.25rem 0.75rem; font-size: 0.75rem; }
.feature { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.85rem; border-radius: 1.25rem; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease; }
.feature:hover { transform: translateY(-2px); border-color: rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.06); }
.card { border-radius: 1.5rem; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.06); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.22); overflow: hidden; backdrop-filter: blur(10px); }
.cardHead { padding: 1.1rem 1.1rem 0.9rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: rgba(0, 0, 0, 0.1); }
.cardBody { padding: 1.1rem; }
.divider { position: relative; padding: 0.6rem 0; display: flex; justify-content: center; }
.divider::before { content: ''; position: absolute; inset: 50% 0 auto; height: 1px; background: rgba(255, 255, 255, 0.1); }
.divider span { position: relative; padding: 0 0.75rem; background: rgba(0, 0, 0, 0.1); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 9999px; }

.linkBtn {
  margin-left: 0.35rem;
  font-size: 0.75rem;
  opacity: 0.85;
  text-decoration: none;
  padding: 0.25rem 0.45rem;
  border-radius: 0.75rem;
  transition: opacity 0.16s ease, background 0.16s ease, transform 0.16s ease;
}
.linkBtn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.06);
  transform: translateY(-1px);
}

.hintBox {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 1.25rem;
  padding: 0.9rem;
}
.hintTitle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}
.hintText {
  margin-top: 0.35rem;
  font-size: 0.85rem;
  opacity: 0.8;
  line-height: 1.4;
}
</style>