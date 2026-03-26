<script setup lang="ts">
useHead({
  title: 'Login — illusion Arc',
  meta: [{ name: 'description', content: 'Login to play games on Illusion Arc.' }]
})

definePageMeta({
  middleware: [
    async () => {
      const user = useSupabaseUser()
      const supabase = useSupabaseClient()

      if (user.value) {
        return navigateTo('/', { replace: true })
      }

      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (session) {
        return navigateTo('/', { replace: true })
      }
    }
  ]
})

type RoleResponse = { role: 'admin' | 'user' | null; found?: boolean }

const route = useRoute()
const toast = useToast()

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const email = ref('')
const password = ref('')
const loading = ref(false)
const mode = ref<'signin' | 'signup'>('signin')
const showPass = ref(false)
const authRedirecting = ref(false)
const referralCode = ref('')

const DEFAULT_AVATARS = [
  '/img/avatars/a1.png',
  '/img/avatars/a2.png',
  '/img/avatars/a3.png',
  '/img/avatars/a4.png',
  '/img/avatars/a5.png'
]

function pickRandomAvatar() {
  if (!DEFAULT_AVATARS.length) return ''
  return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)]
}

type CountryOpt = {
  label: string
  dial: string
  iso: string
}

function isoToFlagEmoji(iso: string) {
  const code = String(iso || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️'
  return code.replace(/[A-Z]/g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

const COUNTRY_CODES: CountryOpt[] = [
  { label: 'US +1', dial: '+1', iso: 'US' },
  { label: 'GB +44', dial: '+44', iso: 'GB' },
  { label: 'CA +1', dial: '+1', iso: 'CA' },
  { label: 'AU +61', dial: '+61', iso: 'AU' },
  { label: 'DE +49', dial: '+49', iso: 'DE' },
  { label: 'FR +33', dial: '+33', iso: 'FR' },
  { label: 'IT +39', dial: '+39', iso: 'IT' },
  { label: 'ES +34', dial: '+34', iso: 'ES' },
  { label: 'NL +31', dial: '+31', iso: 'NL' },
  { label: 'SE +46', dial: '+46', iso: 'SE' },
  { label: 'NO +47', dial: '+47', iso: 'NO' },
  { label: 'DK +45', dial: '+45', iso: 'DK' },

  { label: 'BR +55', dial: '+55', iso: 'BR' },
  { label: 'MX +52', dial: '+52', iso: 'MX' },
  { label: 'AR +54', dial: '+54', iso: 'AR' },

  { label: 'IN +91', dial: '+91', iso: 'IN' },
  { label: 'PK +92', dial: '+92', iso: 'PK' },
  { label: 'BD +880', dial: '+880', iso: 'BD' },
  { label: 'LK +94', dial: '+94', iso: 'LK' },
  { label: 'NP +977', dial: '+977', iso: 'NP' },

  { label: 'JP +81', dial: '+81', iso: 'JP' },
  { label: 'KR +82', dial: '+82', iso: 'KR' },
  { label: 'CN +86', dial: '+86', iso: 'CN' },
  { label: 'SG +65', dial: '+65', iso: 'SG' },
  { label: 'MY +60', dial: '+60', iso: 'MY' },
  { label: 'TH +66', dial: '+66', iso: 'TH' },
  { label: 'ID +62', dial: '+62', iso: 'ID' },
  { label: 'PH +63', dial: '+63', iso: 'PH' },

  { label: 'AE +971', dial: '+971', iso: 'AE' },
  { label: 'SA +966', dial: '+966', iso: 'SA' },
  { label: 'EG +20', dial: '+20', iso: 'EG' },
  { label: 'ZA +27', dial: '+27', iso: 'ZA' }
]

const selectedCountry = ref<CountryOpt>(
  COUNTRY_CODES.find((c) => c.iso === 'BD') || COUNTRY_CODES[0]
)
const phoneLocal = ref('')

function onlyDigits(v: string) {
  return String(v || '').replace(/[^\d]/g, '')
}

function toE164(dial: string, local: string) {
  const d = String(dial || '').trim()
  let n = onlyDigits(local)
  n = n.replace(/^0+/, '')
  if (!d.startsWith('+')) return ''
  if (!n) return ''
  return `${d}${n}`
}

function validatePhoneLocal(local: string) {
  const n = onlyDigits(local).replace(/^0+/, '')
  if (n.length < 6 || n.length > 14) return 'Please enter a valid phone number.'
  return null
}

function normalizeReferralCode(v: string) {
  return String(v || '').trim().toUpperCase().replace(/\s+/g, '')
}

async function claimReferralCode(code: string) {
  const clean = normalizeReferralCode(code)
  if (!clean) return { ok: true, skipped: true }

  return await $fetch('/api/referrals/claim', {
    method: 'POST',
    body: { referralCode: clean }
  })
}

const nextUrl = computed(() => {
  const n = route.query.next
  return typeof n === 'string' && n.startsWith('/') ? n : '/arcade'
})

function isEmailValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function normalizeDisplayName(v: string) {
  const s = String(v || '').trim().replace(/\s+/g, ' ')
  const cleaned = s.replace(/[^\p{L}\p{N} _-]/gu, '')
  return cleaned.slice(0, 24)
}

function randomDisplayName() {
  const a = ['Neon', 'Turbo', 'Shadow', 'Nova', 'Pixel', 'Arc', 'Blaze', 'Frost', 'Cosmic', 'Hyper']
  const b = ['Rider', 'Knight', 'Hunter', 'Pilot', 'Ninja', 'Wizard', 'Boss', 'Runner', 'Samurai', 'Rogue']
  const n = Math.floor(1000 + Math.random() * 9000)
  return `${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}${n}`
}

const canSubmit = computed(() => {
  if (!isEmailValid(email.value)) return false
  if (password.value.length < 6) return false
  if (mode.value === 'signup') {
    const e = validatePhoneLocal(phoneLocal.value)
    if (e) return false
  }
  if (loading.value) return false
  return true
})

async function getRole(): Promise<'admin' | 'user' | null> {
  try {
    const res = await $fetch<RoleResponse>('/api/auth/role')
    return res.role
  } catch {
    return null
  }
}

function hardReloadTo(path: string) {
  if (!import.meta.client) return
  window.location.assign(path)
}

async function redirectAfterLogin() {
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session) return

  const role = await getRole()
  if (role === 'admin') return hardReloadTo('/admin')

  return navigateTo(nextUrl.value, { replace: true })
}

watch(
  () => route.query.mode,
  (q) => {
    if (String(q || '').trim().toLowerCase() === 'signup') {
      mode.value = 'signup'
    }
  },
  { immediate: true }
)

watch(
  () => route.query.ref,
  (q) => {
    const code = normalizeReferralCode(String(q || ''))
    if (code) {
      mode.value = 'signup'
      referralCode.value = code
    }
  },
  { immediate: true }
)

async function isPhoneTaken(phoneE164: string): Promise<boolean> {
  const p = String(phoneE164 || '').trim()
  if (!p) return false
  try {
    const { data, error } = await supabase.rpc('phone_exists', { p })
    if (error) return false
    return Boolean(data)
  } catch {
    return false
  }
}

async function isDisplayNameTaken(name: string): Promise<boolean> {
  const n = normalizeDisplayName(name)
  if (!n) return false

  try {
    const client: any = supabase
    const { data, error } = await client.from('profiles').select('user_id').eq('display_name', n).limit(1)
    if (error) return false
    return Array.isArray(data) && data.length > 0
  } catch {
    return false
  }
}

async function pickUniqueDisplayName(preferred: string): Promise<string> {
  let base = normalizeDisplayName(preferred) || normalizeDisplayName(randomDisplayName())
  if (!base) base = 'Player' + Math.floor(1000 + Math.random() * 9000)

  for (let i = 0; i < 7; i++) {
    const taken = await isDisplayNameTaken(base)
    if (!taken) return base
    base = `${base.slice(0, 18)}${Math.floor(10 + Math.random() * 90)}`
  }
  return `Player${Math.floor(100000 + Math.random() * 900000)}`
}

async function ensureDisplayNameAfterLogin() {
  const u: any = user.value
  if (!u?.id) return

  const md = u.user_metadata || {}
  const existing = normalizeDisplayName(md.display_name || md.full_name || md.name || '')
  if (existing) return

  const dn = await pickUniqueDisplayName('')
  const { error } = await supabase.auth.updateUser({ data: { display_name: dn } })
  if (error) return
  await supabase.auth.refreshSession()
}

async function ensureAvatarAfterLogin() {
  const u: any = user.value
  if (!u?.id) return

  const md = u.user_metadata || {}
  if (String(md.avatar_url || '').trim()) return

  const avatar = pickRandomAvatar()
  if (!avatar) return

  const { error } = await supabase.auth.updateUser({ data: { avatar_url: avatar } })
  if (error) return
  await supabase.auth.refreshSession()
}

async function upsertProfileByUserId(
  userId: string,
  dn: string,
  avatarOverride?: string | null,
  phoneOverride?: string | null
) {
  try {
    if (!userId) return

    const client: any = supabase

    const payload: any = {
      user_id: userId,
      display_name: dn,
      avatar_url: (avatarOverride ?? '').trim() || null,
      updated_at: new Date().toISOString()
    }

    const phone = (phoneOverride ?? '').trim()
    if (phone) payload.phone = phone

    const { error } = await client.from('profiles').upsert(payload, { onConflict: 'user_id' })
    if (error) console.warn('profiles upsert error:', error.message)
  } catch (e) {
    console.warn('profiles upsert exception:', e)
  }
}

async function submit() {
  if (!email.value.trim() || !password.value) {
    toast.add({ title: 'Missing fields', description: 'Email and password are required.', color: 'warning' })
    return
  }

  if (!isEmailValid(email.value)) {
    toast.add({ title: 'Invalid email', description: 'Please enter a valid email address.', color: 'warning' })
    return
  }

  if (password.value.length < 6) {
    toast.add({ title: 'Weak password', description: 'Password must be at least 6 characters.', color: 'warning' })
    return
  }

  loading.value = true
  authRedirecting.value = true

  try {
    if (mode.value === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value
      })
      if (error) throw error

      await ensureDisplayNameAfterLogin()
      await ensureAvatarAfterLogin()

      const u: any = user.value
      const md = u?.user_metadata || {}
      const dn =
        normalizeDisplayName(md.display_name || md.full_name || md.name || '') ||
        (await pickUniqueDisplayName(''))

      if (u?.id) {
        const avatar = String(md.avatar_url || '').trim() || null
        const phone = String(md.phone || '').trim() || null
        await upsertProfileByUserId(u.id, dn, avatar, phone)
      }

      toast.add({ title: 'Welcome back', description: 'Logged in successfully.', color: 'success' })
      await redirectAfterLogin()
      return
    }

    const pErr = validatePhoneLocal(phoneLocal.value)
    if (pErr) {
      toast.add({ title: 'Invalid phone', description: pErr, color: 'warning' })
      return
    }

    const dn = await pickUniqueDisplayName('')
    const avatar = pickRandomAvatar()
    const phoneE164 = toE164(selectedCountry.value.dial, phoneLocal.value).trim()
    const normalizedReferral = normalizeReferralCode(referralCode.value)

    const taken = await isPhoneTaken(phoneE164)
    if (taken) {
      toast.add({ title: 'Phone number already exists', description: 'Use a different number.', color: 'error' })
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: {
        data: {
          display_name: dn,
          avatar_url: avatar,
          phone: phoneE164
        }
      }
    })
    if (error) throw error

    if (data?.user?.id) {
      await upsertProfileByUserId(data.user.id, dn, avatar, phoneE164)
    }

    if (data?.session) {
      await supabase.auth.refreshSession()
    }

    if (data?.session && normalizedReferral) {
      try {
        const referralRes: any = await claimReferralCode(normalizedReferral)
        const msg =
          String(referralRes?.message || '').trim() ||
          'Referral applied successfully. ৳10 bonus will be used on your subscription payment.'

        toast.add({
          title: 'Referral applied',
          description: msg,
          color: 'success'
        })
      } catch (e: any) {
        const msg = String(e?.data?.statusMessage || e?.data?.message || e?.message || '').trim()
        toast.add({
          title: 'Account created',
          description: msg || 'Your account was created, but the referral code could not be applied.',
          color: 'warning'
        })
      }
    }

    toast.add({
      title: 'Account created',
      description: data?.session ? 'Welcome! Your account is ready.' : 'If email confirmation is enabled, check your inbox.',
      color: 'success'
    })

    if (data?.session) {
      await navigateTo('/arcade', { replace: true })
    }
    return
  } catch (e: any) {
    const code = String(e?.code || '')
    const msg = String(e?.message || e?.error_description || '')

    if (mode.value === 'signup') {
      const phoneE164 = toE164(selectedCountry.value.dial, phoneLocal.value).trim()
      if (phoneE164 && (code === 'unexpected_failure' || msg.includes('Database error saving new user'))) {
        const taken = await isPhoneTaken(phoneE164)
        if (taken) {
          toast.add({ title: 'Phone number already exists', description: 'Use a different number.', color: 'error' })
          return
        }
      }
    }

    const friendly =
      msg.includes('duplicate') || msg.includes('23505')
        ? 'Duplicate data detected. Please try again.'
        : msg || 'Please try again.'

    toast.add({ title: 'Auth failed', description: friendly, color: 'error' })
  } finally {
    loading.value = false
    authRedirecting.value = false
  }
}

function toggleAuthMode() {
  mode.value = mode.value === 'signin' ? 'signup' : 'signin'
}

function goToForgotPassword() {
  const e = email.value.trim()
  const url = e ? `/forget-password?email=${encodeURIComponent(e)}` : '/forget-password'
  navigateTo(url, { replace: true })
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
        <div class="order-2 lg:order-1 max-w-xl">
          <div class="badge">
            <UIcon name="i-heroicons-lock-closed" class="w-4 h-4" />
            Login required to play games
          </div>

          <h1 class="mt-4 text-4xl md:text-6xl font-semibold tracking-tight">
            Enter the <span class="grad">Arcade</span>
          </h1>

          <p class="mt-4 text-sm md:text-base opacity-80 leading-relaxed max-w-lg">
            Sign in to save scores, show up on leaderboards, and continue your runs across devices.
          </p>

          <div class="mt-6 grid gap-3 sm:grid-cols-2 max-w-lg">
            <div class="feature">
              <UIcon name="i-heroicons-trophy" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Leaderboard</div>
                <div class="text-xs opacity-70">Compete on top scores</div>
              </div>
            </div>

            <div class="feature">
              <UIcon name="i-heroicons-sparkles" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Micro-interactions</div>
                <div class="text-xs opacity-70">Fast, playful UI</div>
              </div>
            </div>

            <div class="feature">
              <UIcon name="i-heroicons-shield-check" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Secure</div>
                <div class="text-xs opacity-70">Supabase authentication</div>
              </div>
            </div>

            <div class="feature">
              <UIcon name="i-heroicons-device-phone-mobile" class="w-5 h-5" />
              <div>
                <div class="text-sm font-semibold">Mobile-first</div>
                <div class="text-xs opacity-70">Works on phones too</div>
              </div>
            </div>
          </div>

          <div class="mt-6 text-xs opacity-60">
            After login you’ll return to:
            <span class="opacity-100">{{ nextUrl }}</span>
          </div>
        </div>

        <div class="order-1 lg:order-2 lg:justify-self-end w-full max-w-xl">
          <div class="card">
            <div class="cardHead">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-lg font-semibold">
                    {{ mode === 'signin' ? 'Sign in' : 'Create account' }}
                  </div>
                  <div class="text-xs opacity-70 mt-1">
                    {{
                      mode === 'signin'
                        ? 'Login to play games and save scores.'
                        : 'Create an account to join the leaderboard.'
                    }}
                  </div>
                </div>

                <div class="toggle">
                  <button class="pill" :class="{ on: mode === 'signin' }" type="button" @click="mode = 'signin'">
                    Login
                  </button>
                  <button class="pill" :class="{ on: mode === 'signup' }" type="button" @click="mode = 'signup'">
                    Sign up
                  </button>
                </div>
              </div>
            </div>

            <div class="cardBody">
              <form class="grid gap-4" @submit.prevent="submit">
                <UFormField label="Email" required>
                  <UInput
                    v-model="email"
                    class="w-full"
                    placeholder="you@email.com"
                    autocomplete="email"
                    icon="i-heroicons-envelope"
                  />
                </UFormField>

                <div v-if="mode === 'signup'" class="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)] items-end">
                  <UFormField label="Code" required>
                    <USelectMenu
                      v-model="selectedCountry"
                      :items="COUNTRY_CODES"
                      class="w-full"
                      :ui="{ width: 'w-full' }"
                      :search-input="{ placeholder: 'Search…', icon: 'i-heroicons-magnifying-glass' }"
                    >
                      <template #label>
                        <span class="inline-flex items-center gap-2 tabular-nums whitespace-nowrap">
                          <span class="text-base leading-none">{{ isoToFlagEmoji(selectedCountry.iso) }}</span>
                          <span class="whitespace-nowrap">{{ selectedCountry.dial }}</span>
                        </span>
                      </template>

                      <template #option="{ option }">
                        <span class="inline-flex items-center gap-2 tabular-nums whitespace-nowrap">
                          <span class="text-base leading-none">{{ isoToFlagEmoji(option.iso) }}</span>
                          <span class="whitespace-nowrap">{{ option.label }}</span>
                        </span>
                      </template>
                    </USelectMenu>
                  </UFormField>

                  <UFormField label="Phone" required>
                    <UInput
                      v-model="phoneLocal"
                      class="w-full"
                      placeholder="Phone number"
                      autocomplete="tel"
                      icon="i-heroicons-phone"
                    />
                    <div class="mt-1 text-xs opacity-60">
                      Stored as:
                      <span class="opacity-100 tabular-nums">{{ toE164(selectedCountry.dial, phoneLocal) || '—' }}</span>
                    </div>
                  </UFormField>
                </div>

                <UFormField v-if="mode === 'signup'" label="Referral code (optional)">
                  <UInput
                    v-model="referralCode"
                    class="w-full"
                    placeholder="Enter referral code"
                    autocomplete="off"
                    icon="i-heroicons-gift"
                  />
                  <div class="mt-1 text-xs opacity-60 leading-relaxed">
                    Use a friend’s code now and get ৳10 referral bonus on your subscription payment.
                  </div>
                </UFormField>

                <UFormField label="Password" required>
                  <UInput
                    v-model="password"
                    class="w-full"
                    :type="showPass ? 'text' : 'password'"
                    placeholder="••••••••"
                    :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
                    icon="i-heroicons-key"
                  />
                  <div class="mt-2 flex items-center justify-between">
                    <UButton type="button" size="xs" variant="ghost" @click="showPass = !showPass">
                      <UIcon :name="showPass ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-4 h-4" />
                      {{ showPass ? 'Hide' : 'Show' }}
                    </UButton>

                    <button
                      v-if="mode === 'signin'"
                      type="button"
                      class="forgotLink"
                      @click="goToForgotPassword"
                    >
                      Forgot password?
                    </button>
                    <div v-else class="text-xs opacity-60">Min 6 chars</div>
                  </div>
                </UFormField>

                <div class="grid gap-2 sm:grid-cols-2">
                  <UButton
                    type="submit"
                    class="w-full"
                    color="primary"
                    variant="solid"
                    size="lg"
                    :loading="loading"
                    :disabled="!canSubmit"
                  >
                    <UIcon name="i-heroicons-arrow-right-circle" class="w-5 h-5" />
                    {{ mode === 'signin' ? 'Login' : 'Create account' }}
                  </UButton>

                  <UButton
                    type="button"
                    class="w-full"
                    variant="solid"
                    color="secondary"
                    size="lg"
                    @click="toggleAuthMode"
                  >
                    <UIcon
                      :name="mode === 'signin' ? 'i-heroicons-user-plus' : 'i-heroicons-arrow-left-circle'"
                      class="w-5 h-5"
                    />
                    {{ mode === 'signin' ? 'Sign Up' : 'Back to Login' }}
                  </UButton>
                </div>

                <div class="divider">
                  <span class="text-xs opacity-60">illusion Arc</span>
                </div>

                <div class="text-xs opacity-70 leading-relaxed">
                  By continuing, you agree to basic fair-use rules for the Arcade.
                </div>
              </form>
            </div>
          </div>

          <div class="mt-4 text-xs opacity-60 text-center">
            Tip: Use the same account to keep scores across games.
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>
.authPage {
  position: relative;
  min-height: calc(100dvh - 64px);
  overflow: hidden;
  color: var(--app-fg);
}
.bg {
  position: absolute;
  inset: 0;
  background: var(--app-bg);
}
.wash {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(900px 600px at 15% 20%, var(--wash-b), transparent 60%),
    radial-gradient(900px 600px at 85% 30%, var(--wash-a), transparent 60%),
    radial-gradient(900px 700px at 55% 90%, rgba(34, 197, 94, 0.1), transparent 60%),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.05), transparent 35%, rgba(255, 255, 255, 0.03));
  opacity: 0.9;
}
.noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E");
  opacity: 0.1;
  mix-blend-mode: overlay;
}
.orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(24px);
  opacity: 0.55;
  transform: translateZ(0);
  animation: float 9s ease-in-out infinite;
}
.orbA {
  width: 280px;
  height: 280px;
  left: -90px;
  top: 80px;
  background: radial-gradient(circle at 30% 30%, rgba(34, 211, 238, 0.35), rgba(34, 211, 238, 0.06) 60%, transparent 70%);
}
.orbB {
  width: 320px;
  height: 320px;
  right: -120px;
  top: 120px;
  background: radial-gradient(circle at 30% 30%, rgba(124, 58, 237, 0.35), rgba(124, 58, 237, 0.06) 60%, transparent 70%);
  animation-delay: -2s;
}
.orbC {
  width: 360px;
  height: 360px;
  left: 40%;
  bottom: -180px;
  background: radial-gradient(circle at 30% 30%, rgba(34, 197, 94, 0.25), rgba(34, 197, 94, 0.05) 60%, transparent 70%);
  animation-delay: -4s;
}
@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-14px) scale(1.02); }
}
.grad {
  background: linear-gradient(90deg, rgba(34, 211, 238, 1), rgba(124, 58, 237, 1), rgba(34, 197, 94, 1));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
}
.feature {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.85rem;
  border-radius: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}
.feature:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
}
.card {
  border-radius: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  backdrop-filter: blur(10px);
}
.cardHead {
  padding: 1.1rem 1.1rem 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.1);
}
.cardBody {
  padding: 1.1rem;
}
.toggle {
  display: flex;
  gap: 0.35rem;
  padding: 0.25rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}
.pill {
  padding: 0.45rem 0.75rem;
  font-size: 0.85rem;
  border-radius: 9999px;
  color: inherit;
  opacity: 0.75;
  transition: background 0.16s ease, opacity 0.16s ease, transform 0.16s ease;
}
.pill:hover {
  transform: translateY(-1px);
  opacity: 1;
}
.pill.on {
  background: rgba(255, 255, 255, 0.12);
  opacity: 1;
}
.divider {
  position: relative;
  padding: 0.6rem 0;
  display: flex;
  justify-content: center;
}
.divider::before {
  content: '';
  position: absolute;
  inset: 50% 0 auto;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}
.divider span {
  position: relative;
  padding: 0 0.75rem;
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
}
.forgotLink {
  font-size: 0.75rem;
  opacity: 0.82;
  padding: 0.25rem 0.45rem;
  border-radius: 0.75rem;
  transition: opacity 0.16s ease, background 0.16s ease, transform 0.16s ease;
}
.forgotLink:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.06);
  transform: translateY(-1px);
}
</style>