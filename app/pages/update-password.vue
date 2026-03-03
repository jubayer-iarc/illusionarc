<!-- app/pages/update-password.vue -->
<script setup lang="ts">
useHead({
  title: 'Set new password — illusion Arc',
  meta: [{ name: 'description', content: 'Set a new password for your illusion Arc account.' }]
})

definePageMeta({
  middleware: ['guest-only']
})

const supabase = useSupabaseClient()
const toast = useToast()
const route = useRoute()

const loading = ref(false)
const ready = ref(false)
const stage = ref<'validating' | 'form' | 'error'>('validating')
const errorText = ref('')

const password = ref('')
const confirm = ref('')
const showPass = ref(false)
const showConfirm = ref(false)

// ✅ Recovery guard cookie (used by recovery-guard.global.ts)
const recovery = useCookie<string | null>('ia_recovery', { sameSite: 'lax', path: '/' })

function isStrongEnough(p: string) {
  return String(p || '').length >= 6
}

const canSubmit = computed(() => {
  if (loading.value) return false
  if (!ready.value) return false
  if (!isStrongEnough(password.value)) return false
  if (password.value !== confirm.value) return false
  return true
})

function parseHashTokens() {
  if (!import.meta.client) return null
  const hash = window.location.hash || ''
  if (!hash.startsWith('#')) return null
  const params = new URLSearchParams(hash.slice(1))
  const access_token = params.get('access_token') || ''
  const refresh_token = params.get('refresh_token') || ''
  const type = params.get('type') || ''
  if (!access_token || !refresh_token) return null
  return { access_token, refresh_token, type }
}

function clearHash() {
  if (!import.meta.client) return
  if (!window.location.hash) return
  history.replaceState(null, '', window.location.pathname + window.location.search)
}

async function safeSignOutAndClearRecovery() {
  if (!import.meta.client) return
  try {
    await supabase.auth.signOut()
  } catch {}
  recovery.value = null
}

async function ensureSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  return session?.user ? session : null
}

/**
 * Establishes recovery session ONLY for setting password.
 * We do NOT allow this session to be used on other pages (global middleware blocks it).
 */
async function initRecovery() {
  if (!import.meta.client) return

  loading.value = true
  stage.value = 'validating'
  errorText.value = ''
  ready.value = false

  // Mark the browser as "recovery mode" immediately
  recovery.value = '1'

  try {
    // 1) Prefer hash token flow (works even when PKCE verifier missing)
    const hash = parseHashTokens()
    if (hash) {
      const { error } = await supabase.auth.setSession({
        access_token: hash.access_token,
        refresh_token: hash.refresh_token
      })
      if (error) throw error
      clearHash()
    } else {
      // 2) PKCE code flow
      const code = typeof route.query.code === 'string' ? route.query.code : ''
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) throw error
        if (!data?.session?.user) throw new Error('Invalid or expired reset link. Please request a new one.')
      }
    }

    // 3) Ensure session exists now
    const session = await ensureSession()
    if (!session) {
      throw new Error(
        'Reset session not found. Please open the reset link directly from your email, in the same browser (avoid in-app browsers).'
      )
    }

    ready.value = true
    stage.value = 'form'
  } catch (e: any) {
    const msg = String(e?.message || e?.error_description || '')

    // ✅ If PKCE verifier missing, do NOT leave any session behind
    if (msg.toLowerCase().includes('pkce') && msg.toLowerCase().includes('verifier')) {
      await safeSignOutAndClearRecovery()
      errorText.value =
        'This link was opened in a different browser/device (or storage was cleared), so it can’t be verified. Request a new reset link and open it in the same browser (avoid Gmail/Facebook in-app browsers).'
    } else {
      // Still clean up to be safe
      await safeSignOutAndClearRecovery()
      errorText.value = msg || 'Reset link is invalid. Please request a new one.'
    }

    stage.value = 'error'
    ready.value = false
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void initRecovery()
})

async function setNewPassword() {
  if (!isStrongEnough(password.value)) {
    toast.add({ title: 'Weak password', description: 'Password must be at least 6 characters.', color: 'warning' })
    return
  }
  if (password.value !== confirm.value) {
    toast.add({ title: 'Password mismatch', description: 'Both passwords must match.', color: 'warning' })
    return
  }

  loading.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: password.value })
    if (error) throw error

    toast.add({ title: 'Password updated', description: 'Please login with your new password.', color: 'success' })

    // ✅ Critical: end recovery session (prevents “logged in without password”)
    await safeSignOutAndClearRecovery()

    await navigateTo('/login', { replace: true })
  } catch (e: any) {
    const msg = String(e?.message || e?.error_description || 'Please try again.')
    toast.add({ title: 'Could not update password', description: msg, color: 'error' })
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  navigateTo('/login', { replace: true })
}

function requestNewLink() {
  const e = typeof route.query.email === 'string' ? route.query.email : ''
  const url = e ? `/forget-password?email=${encodeURIComponent(e)}` : '/forget-password'
  navigateTo(url, { replace: true })
}

async function cancelRecovery() {
  await safeSignOutAndClearRecovery()
  await navigateTo('/login', { replace: true })
}
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
        <!-- LEFT -->
        <div class="order-2 lg:order-1 max-w-xl">
          <div class="badge">
            <UIcon name="i-heroicons-lock-closed" class="w-4 h-4" />
            Password reset
          </div>

          <h1 class="mt-4 text-4xl md:text-6xl font-semibold tracking-tight">
            Set a <span class="grad">new password</span>
          </h1>

          <p class="mt-4 text-sm md:text-base opacity-80 leading-relaxed max-w-lg">
            Reset links create a temporary recovery session only to change password. After saving, you must login again.
          </p>

          <div class="mt-6 text-xs opacity-60">
            Cancel reset?
            <button class="linkBtn" type="button" @click="cancelRecovery">Back to login</button>
          </div>
        </div>

        <!-- CARD -->
        <div class="order-1 lg:order-2 lg:justify-self-end w-full max-w-xl">
          <div class="card">
            <div class="cardHead">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-lg font-semibold">Update password</div>
                  <div class="text-xs opacity-70 mt-1">
                    {{
                      stage === 'validating'
                        ? 'Validating reset link…'
                        : stage === 'error'
                          ? 'Reset link problem'
                          : 'Enter and confirm your new password.'
                    }}
                  </div>
                </div>

                <UButton type="button" size="xs" variant="ghost" @click="cancelRecovery">
                  <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                  Cancel
                </UButton>
              </div>
            </div>

            <div class="cardBody">
              <!-- ERROR -->
              <div v-if="stage === 'error'" class="errorBox">
                <div class="errorTitle">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
                  Reset link error
                </div>
                <div class="errorText">{{ errorText }}</div>

                <div class="mt-4 grid gap-2 sm:grid-cols-2">
                  <UButton type="button" class="w-full" color="primary" variant="solid" @click="requestNewLink">
                    <UIcon name="i-heroicons-paper-airplane" class="w-5 h-5" />
                    Request new link
                  </UButton>

                  <UButton type="button" class="w-full" variant="soft" @click="goToLogin">
                    <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
                    Back to login
                  </UButton>
                </div>
              </div>

              <!-- FORM -->
              <form v-else class="grid gap-4" @submit.prevent="setNewPassword">
                <UFormGroup label="New password" required>
                  <UInput
                    v-model="password"
                    class="w-full"
                    :type="showPass ? 'text' : 'password'"
                    placeholder="••••••••"
                    autocomplete="new-password"
                    icon="i-heroicons-key"
                    :disabled="loading || !ready"
                  />
                  <div class="mt-2 flex items-center justify-between">
                    <UButton type="button" size="xs" variant="ghost" :disabled="loading || !ready" @click="showPass = !showPass">
                      <UIcon :name="showPass ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-4 h-4" />
                      {{ showPass ? 'Hide' : 'Show' }}
                    </UButton>
                    <div class="text-xs opacity-60">Min 6 chars</div>
                  </div>
                </UFormGroup>

                <UFormGroup label="Confirm password" required>
                  <UInput
                    v-model="confirm"
                    class="w-full"
                    :type="showConfirm ? 'text' : 'password'"
                    placeholder="••••••••"
                    autocomplete="new-password"
                    icon="i-heroicons-check-badge"
                    :disabled="loading || !ready"
                  />
                  <div class="mt-2 flex items-center justify-between">
                    <UButton type="button" size="xs" variant="ghost" :disabled="loading || !ready" @click="showConfirm = !showConfirm">
                      <UIcon :name="showConfirm ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-4 h-4" />
                      {{ showConfirm ? 'Hide' : 'Show' }}
                    </UButton>
                    <div class="text-xs opacity-60">
                      {{ confirm && password !== confirm ? 'Does not match' : ' ' }}
                    </div>
                  </div>
                </UFormGroup>

                <UButton
                  type="submit"
                  class="w-full"
                  color="primary"
                  variant="solid"
                  size="lg"
                  :loading="loading"
                  :disabled="!canSubmit"
                >
                  <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
                  Save new password
                </UButton>

                <div class="divider">
                  <span class="text-xs opacity-60">illusion Arc</span>
                </div>

                <div class="text-xs opacity-70 leading-relaxed">
                  If you opened this in Gmail/Facebook in-app browser, use “Open in Safari/Chrome”.
                </div>
              </form>
            </div>
          </div>

          <div class="mt-4 text-xs opacity-60 text-center">
            After saving, you’ll login again with your new password.
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>
/* keep your existing styling system */
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
.card { border-radius: 1.5rem; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.06); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.22); overflow: hidden; backdrop-filter: blur(10px); }
.cardHead { padding: 1.1rem 1.1rem 0.9rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: rgba(0, 0, 0, 0.1); }
.cardBody { padding: 1.1rem; }
.divider { position: relative; padding: 0.6rem 0; display: flex; justify-content: center; }
.divider::before { content: ''; position: absolute; inset: 50% 0 auto; height: 1px; background: rgba(255, 255, 255, 0.1); }
.divider span { position: relative; padding: 0 0.75rem; background: rgba(0, 0, 0, 0.1); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 9999px; }

.linkBtn { margin-left: 0.35rem; font-size: 0.75rem; opacity: 0.85; padding: 0.25rem 0.45rem; border-radius: 0.75rem; transition: opacity 0.16s ease, background 0.16s ease, transform 0.16s ease; }
.linkBtn:hover { opacity: 1; background: rgba(255, 255, 255, 0.06); transform: translateY(-1px); }

.errorBox { border: 1px solid rgba(255, 80, 80, 0.25); background: rgba(255, 80, 80, 0.06); border-radius: 1.25rem; padding: 0.9rem; }
.errorTitle { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; }
.errorText { margin-top: 0.4rem; font-size: 0.85rem; opacity: 0.85; line-height: 1.45; }
</style>