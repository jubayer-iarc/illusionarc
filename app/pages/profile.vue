<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'

useHead({
  title: 'My Profile — illusion Arc',
  meta: [{ name: 'description', content: 'Manage your profile settings and referral sharing.' }]
})

definePageMeta({
  middleware: ['require-auth']
})

type RoleResponse = { role: 'admin' | 'user' | null; found?: boolean }

type ReferralSummary = {
  referralCode: string | null
  referralCount: number
  referralBonusBdt: number
  referralBonusUsedBdt: number
  referralBonusAvailableBdt: number
}

type CountryOpt = {
  label: string
  dial: string
  iso: string
}

const supabase = useSupabaseClient()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const user = useSupabaseUser()

const loading = ref(false)
const loadingProfile = ref(true)
const avatarUploading = ref(false)
const loadingReferral = ref(true)
const copyingReferral = ref(false)
const copyingShareMessage = ref(false)

const referral = reactive<ReferralSummary>({
  referralCode: null,
  referralCount: 0,
  referralBonusBdt: 0,
  referralBonusUsedBdt: 0,
  referralBonusAvailableBdt: 0
})

const role = ref<'admin' | 'user' | null>(null)
const isAdmin = computed(() => role.value === 'admin')

const state = reactive({
  display_name: '',
  avatar_url: '',
  phone: ''
})

const avatarInput = ref<HTMLInputElement | null>(null)

const savedAvatarUrl = ref('')
const savedPhone = ref('')

const pending = reactive({
  path: '' as string,
  url: '' as string
})

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

const selectedCountry = ref<CountryOpt>(COUNTRY_CODES.find((c) => c.iso === 'BD') || COUNTRY_CODES[0])
const phoneLocal = ref('')

function isoToFlagEmoji(iso: string) {
  const code = String(iso || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️'
  return code.replace(/[A-Z]/g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

function onlyDigits(v: string) {
  return String(v || '').replace(/[^\d]/g, '')
}

function toE164(dial: string, local: string) {
  const d = String(dial || '').trim()
  let n = onlyDigits(local).replace(/^0+/, '')
  if (!d.startsWith('+')) return ''
  if (!n) return ''
  return `${d}${n}`
}

function validatePhoneLocal(local: string) {
  const n = onlyDigits(local).replace(/^0+/, '')
  if (n.length < 6 || n.length > 14) return 'Please enter a valid phone number.'
  return null
}

function parseE164IntoUi(e164: string) {
  const p = String(e164 || '').trim()
  if (!p.startsWith('+') || p.length < 4) return
  const list = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length)
  const found = list.find((c) => p.startsWith(c.dial))
  if (!found) return
  selectedCountry.value = found
  phoneLocal.value = p.slice(found.dial.length)
}

const phonePreview = computed(() => toE164(selectedCountry.value.dial, phoneLocal.value))

const mustHavePhone = computed(() => {
  if (isAdmin.value) return false
  return !String(savedPhone.value || '').trim()
})

const mustCompleteBecauseRedirected = computed(() => String(route.query.needPhone || '') === '1')

const successfulReferralCount = computed(() => Math.max(0, Number(referral.referralCount || 0)))
const totalReferralBonusDisplay = computed(() => successfulReferralCount.value * 10)

const appOrigin = computed(() => {
  if (import.meta.client && window?.location?.origin) return window.location.origin
  return ''
})

const signupReferralUrl = computed(() => {
  const code = String(referral.referralCode || '').trim()
  if (!code) return ''
  const origin = appOrigin.value
  const path = `/login?mode=signup&ref=${encodeURIComponent(code)}`
  return origin ? `${origin}${path}` : path
})

const shareMessage = computed(() => {
  const code = String(referral.referralCode || '').trim()
  const link = signupReferralUrl.value
  if (!code) return ''

  return [
    'ঈদের ছুটিতে একটু Gaming করে iPhone জিততে পারলে কেমন হয়? 😄🎮',
    '',
    'Salami Rush Eid Tournament-এ join করার সময় আমার referral code ব্যবহার করলে আপনি subscription-এ ৳10 bonus পাবেন 👇',
    '',
    `Referral Code: ${code}`,
    link ? `Sign up link: ${link}` : '',
    '',
    'এখনই join করুন এবং compete করুন! 🚀'
  ]
    .filter(Boolean)
    .join('\n')
})

const whatsappShareUrl = computed(() =>
  shareMessage.value ? `https://wa.me/?text=${encodeURIComponent(shareMessage.value)}` : '#'
)

const facebookShareUrl = computed(() =>
  signupReferralUrl.value
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(signupReferralUrl.value)}&quote=${encodeURIComponent(shareMessage.value)}`
    : '#'
)

const tiktokShareUrl = computed(() => signupReferralUrl.value || '#')
const instagramShareUrl = computed(() => signupReferralUrl.value || '#')

const linkedinShareUrl = computed(() =>
  signupReferralUrl.value
    ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(signupReferralUrl.value)}`
    : '#'
)

onBeforeRouteLeave(() => {
  if (mustHavePhone.value) {
    toast.add({
      title: 'Phone number required',
      description: 'Please add your phone number and Save changes to continue.',
      color: 'warning'
    })
    return false
  }
  return true
})

async function loadRole() {
  try {
    const res = await $fetch<RoleResponse>('/api/auth/role')
    role.value = res?.role ?? null
  } catch {
    role.value = null
  }
}

function normalizeDisplayName(v: string) {
  const s = String(v || '').trim().replace(/\s+/g, ' ')
  const cleaned = s.replace(/[^\p{L}\p{N} _-]/gu, '')
  return cleaned.slice(0, 24)
}

function validate() {
  const dn = normalizeDisplayName(state.display_name)
  if (!dn.trim()) return 'Please enter your display name.'
  if (dn.length < 3) return 'Display name should be at least 3 characters.'

  if (!isAdmin.value) {
    const p = phonePreview.value
    if (!p) return 'Phone number is required.'
    const pErr = validatePhoneLocal(phoneLocal.value)
    if (pErr) return pErr
  }

  return null
}

function openAvatarPicker() {
  if (avatarUploading.value) return
  avatarInput.value?.click()
}

function resetAvatarInput() {
  if (avatarInput.value) avatarInput.value.value = ''
}

function extractAvatarPathFromPublicUrl(url: string): string | null {
  const u = String(url || '').trim()
  if (!u) return null
  const marker = '/storage/v1/object/public/avatars/'
  const idx = u.indexOf(marker)
  if (idx === -1) return null
  return u.slice(idx + marker.length) || null
}

async function deleteAvatarIfOwned(urlOrPath: string, userId: string, isPath = false) {
  const path = isPath ? urlOrPath : extractAvatarPathFromPublicUrl(urlOrPath)
  if (!path) return
  if (!path.startsWith(`${userId}/`)) return
  const { error } = await supabase.storage.from('avatars').remove([path])
  if (error) console.warn('Avatar delete failed:', error.message)
}

function money(v: number) {
  return new Intl.NumberFormat('en-BD').format(Number(v || 0))
}

async function loadReferralSummary() {
  loadingReferral.value = true
  try {
    const data: any = await $fetch('/api/referrals/me')
    referral.referralCode = String(data?.referralCode || '').trim() || null
    referral.referralCount = Number(data?.referralCount || 0)
    referral.referralBonusBdt = Number(data?.referralBonusBdt || 0)
    referral.referralBonusUsedBdt = Number(data?.referralBonusUsedBdt || 0)
    referral.referralBonusAvailableBdt = Number(data?.referralBonusAvailableBdt || 0)
  } catch {
    referral.referralCode = null
    referral.referralCount = 0
    referral.referralBonusBdt = 0
    referral.referralBonusUsedBdt = 0
    referral.referralBonusAvailableBdt = 0
  } finally {
    loadingReferral.value = false
  }
}

async function copyReferralCode() {
  const code = String(referral.referralCode || '').trim()
  if (!code) {
    toast.add({
      title: 'No referral code',
      description: 'Referral code is not available yet.',
      color: 'warning'
    })
    return
  }

  try {
    copyingReferral.value = true
    await navigator.clipboard.writeText(code)
    toast.add({
      title: 'Copied',
      description: 'Referral code copied to clipboard.',
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Copy failed',
      description: 'Please copy the code manually.',
      color: 'error'
    })
  } finally {
    copyingReferral.value = false
  }
}

async function copyShareMessage() {
  if (!shareMessage.value) {
    toast.add({
      title: 'Nothing to copy',
      description: 'Referral message is not ready yet.',
      color: 'warning'
    })
    return
  }

  try {
    copyingShareMessage.value = true
    await navigator.clipboard.writeText(shareMessage.value)
    toast.add({
      title: 'Copied',
      description: 'Share message copied successfully.',
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Copy failed',
      description: 'Please copy it manually.',
      color: 'error'
    })
  } finally {
    copyingShareMessage.value = false
  }
}

async function loadProfile() {
  if (!import.meta.client) return
  loadingProfile.value = true

  try {
    await Promise.all([loadRole(), loadReferralSummary()])

    const {
      data: { user: u },
      error: authErr
    } = await supabase.auth.getUser()

    if (authErr || !u?.id) return

    const fallbackName =
      (u.user_metadata as any)?.display_name ||
      (u.user_metadata as any)?.full_name ||
      (u.email?.split?.('@')?.[0] ?? '') ||
      ''

    const fallbackAvatar = (u.user_metadata as any)?.avatar_url || ''
    const fallbackPhone = (u.user_metadata as any)?.phone || ''

    const { data } = await (supabase as any)
      .from('profiles')
      .select('display_name, avatar_url, phone')
      .eq('user_id', u.id)
      .maybeSingle()

    state.display_name = (data?.display_name || fallbackName || '').trim()
    state.avatar_url = (data?.avatar_url || fallbackAvatar || '').trim()
    state.phone = (data?.phone || fallbackPhone || '').trim()

    savedAvatarUrl.value = state.avatar_url || ''
    savedPhone.value = state.phone || ''

    if (state.phone) parseE164IntoUi(state.phone)
  } finally {
    loadingProfile.value = false
  }
}

onMounted(loadProfile)

watch(
  () => user.value?.id,
  (id) => {
    if (!id) navigateTo('/login?next=/profile', { replace: true })
  }
)

async function onPickAvatar(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  avatarUploading.value = true
  try {
    if (!file.type.startsWith('image/')) {
      toast.add({ title: 'Invalid file', description: 'Please select an image.', color: 'warning' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.add({ title: 'Too large', description: 'Max 2MB image allowed.', color: 'warning' })
      return
    }

    const {
      data: { user: u },
      error: userErr
    } = await supabase.auth.getUser()

    if (userErr || !u?.id) throw new Error('Login required')

    if (pending.path) {
      await deleteAvatarIfOwned(pending.path, u.id, true)
      pending.path = ''
      pending.url = ''
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${u.id}/pending/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) throw error
    if (!data?.path) throw new Error('Upload failed')

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(data.path)
    const url = pub?.publicUrl || ''
    if (!url) throw new Error('Could not get public URL')

    pending.path = data.path
    pending.url = url
    state.avatar_url = url
  } catch (err: any) {
    toast.add({
      title: 'Upload failed',
      description: err?.message || 'Try again.',
      color: 'error'
    })
  } finally {
    resetAvatarInput()
    setTimeout(() => {
      avatarUploading.value = false
    }, 150)
  }
}

async function save() {
  const err = validate()
  if (err) {
    toast.add({ title: 'Check the form', description: err, color: 'warning' })
    return
  }

  loading.value = true
  try {
    const {
      data: { user: u },
      error: userErr
    } = await supabase.auth.getUser()

    if (userErr || !u?.id) throw new Error('Login required')

    const displayName = normalizeDisplayName(state.display_name)
    const nextAvatarUrl = state.avatar_url.trim() || null
    const phoneE164 = isAdmin.value ? phonePreview.value.trim() || null : phonePreview.value.trim()

    const prevSavedAvatar = savedAvatarUrl.value

    const { error } = await (supabase as any)
      .from('profiles')
      .upsert(
        {
          user_id: u.id,
          display_name: displayName,
          avatar_url: nextAvatarUrl,
          phone: phoneE164,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      if ((error as any).code === '23505' || /duplicate key|unique/i.test(error.message)) {
        const m = String(error.message || '').toLowerCase()
        if (m.includes('phone')) throw new Error('This phone number is already used. Try another.')
        if (m.includes('display')) throw new Error('That display name is already taken. Try another one.')
        throw new Error('Duplicate data detected. Please try again.')
      }
      throw error
    }

    const { error: metaErr } = await supabase.auth.updateUser({
      data: { display_name: displayName, avatar_url: nextAvatarUrl, phone: phoneE164 }
    })
    if (metaErr) console.warn(metaErr.message)

    await supabase.auth.refreshSession()

    if (prevSavedAvatar && nextAvatarUrl && prevSavedAvatar !== nextAvatarUrl) {
      await deleteAvatarIfOwned(prevSavedAvatar, u.id, false)
    }

    savedAvatarUrl.value = nextAvatarUrl || ''
    savedPhone.value = (phoneE164 as any) || ''
    state.phone = (phoneE164 as any) || ''

    pending.path = ''
    pending.url = ''

    toast.add({ title: 'Saved', description: 'Profile updated successfully.', color: 'success' })

    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : ''
    if (next) return navigateTo(next, { replace: true })
  } catch (e: any) {
    toast.add({ title: 'Failed', description: e?.message || 'Try again.', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function clearAvatar() {
  if (avatarUploading.value) return
  try {
    const {
      data: { user: u }
    } = await supabase.auth.getUser()

    if (u?.id && pending.path) {
      avatarUploading.value = true
      await deleteAvatarIfOwned(pending.path, u.id, true)
      pending.path = ''
      pending.url = ''
    }
  } finally {
    state.avatar_url = ''
    setTimeout(() => {
      avatarUploading.value = false
    }, 150)
  }
}

async function cancel() {
  if (mustHavePhone.value) {
    toast.add({
      title: 'Phone number required',
      description: 'Please add your phone number and Save changes to continue.',
      color: 'warning'
    })
    return
  }

  try {
    const {
      data: { user: u }
    } = await supabase.auth.getUser()

    if (u?.id && pending.path) {
      await deleteAvatarIfOwned(pending.path, u.id, true)
      pending.path = ''
      pending.url = ''
    }
  } finally {
    router.push('/')
  }
}

function initials(name: string) {
  const s = String(name || '').trim()
  if (!s) return 'IA'
  const parts = s.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'IA'
}
</script>

<template>
  <UContainer class="py-6 md:py-8">
    <div class="mx-auto max-w-6xl space-y-5">
      <div class="rounded-[28px] border border-black/10 bg-gradient-to-br from-white via-white to-emerald-50/70 p-5 shadow-sm dark:border-white/10 dark:from-white/7 dark:via-white/5 dark:to-emerald-500/10 md:p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-center gap-4 min-w-0">
            <div class="relative h-18 w-18 md:h-20 md:w-20 overflow-hidden rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <img
                v-if="state.avatar_url"
                :src="state.avatar_url"
                class="h-full w-full object-cover"
                alt="Avatar"
                referrerpolicy="no-referrer"
              />
              <div
                v-else
                class="grid h-full w-full place-items-center text-lg md:text-xl font-bold text-black/70 dark:text-white/70"
              >
                {{ initials(state.display_name) }}
              </div>

              <div v-if="avatarUploading" class="absolute inset-0 grid place-items-center bg-black/60">
                <span class="i-heroicons-arrow-path-20-solid animate-spin text-xl text-white"></span>
              </div>
            </div>

            <div class="min-w-0">
              <div class="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-300/80">
                Profile Settings
              </div>
              <h1 class="mt-1 truncate text-2xl font-semibold text-black dark:text-white md:text-3xl">
                My Profile
              </h1>
              <p class="mt-1 text-sm text-black/65 dark:text-white/65">
                Update your profile, contact details and referral settings.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              variant="soft"
              icon="i-heroicons-arrow-left"
              :disabled="loading || avatarUploading"
              @click="cancel"
            >
              Back
            </UButton>

            <UButton
              color="primary"
              variant="solid"
              icon="i-heroicons-check-circle"
              :loading="loading"
              :disabled="loadingProfile || avatarUploading"
              @click="save"
            >
              Save changes
            </UButton>
          </div>
        </div>
      </div>

      <div
        v-if="mustHavePhone"
        class="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4"
      >
        <div class="flex items-start gap-3">
          <div class="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-amber-500/25 bg-amber-500/10">
            <UIcon name="i-heroicons-exclamation-triangle" class="h-5 w-5 opacity-90" />
          </div>
          <div class="min-w-0">
            <div class="font-semibold text-black dark:text-white">Phone number required</div>
            <div class="mt-1 text-sm text-black/70 dark:text-white/70">
              Please add your phone number and save changes to continue.
            </div>
          </div>
        </div>
      </div>

      <input ref="avatarInput" class="hidden" type="file" accept="image/*" @change="onPickAvatar" />

      <div class="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div class="space-y-5">
          <UCard class="overflow-hidden border border-black/10 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-lg font-semibold text-black dark:text-white">Account Overview</div>
                  <div class="mt-1 text-xs text-black/55 dark:text-white/55">
                    Keep your profile clean and up to date.
                  </div>
                </div>
                <div v-if="loadingProfile" class="text-xs text-black/55 dark:text-white/55">Loading…</div>
              </div>
            </template>

            <div class="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div class="rounded-3xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div class="mx-auto relative h-28 w-28 overflow-hidden rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                  <img
                    v-if="state.avatar_url"
                    :src="state.avatar_url"
                    class="h-full w-full object-cover"
                    alt="Avatar"
                    referrerpolicy="no-referrer"
                  />
                  <div
                    v-else
                    class="grid h-full w-full place-items-center text-2xl font-bold text-black/70 dark:text-white/70"
                  >
                    {{ initials(state.display_name) }}
                  </div>
                </div>

                <div class="mt-3 text-center">
                  <div class="text-xs text-black/55 dark:text-white/55">Current display name</div>
                  <div class="mt-1 truncate text-base font-semibold text-black dark:text-white">
                    {{ state.display_name || '—' }}
                  </div>
                </div>

                <div class="mt-4 grid gap-2">
                  <UButton
                    variant="soft"
                    icon="i-heroicons-arrow-up-tray"
                    :disabled="avatarUploading || loadingProfile || loading"
                    @click="openAvatarPicker"
                  >
                    Upload photo
                  </UButton>

                  <UButton
                    v-if="state.avatar_url"
                    variant="ghost"
                    icon="i-heroicons-x-mark"
                    :disabled="avatarUploading || loadingProfile || loading"
                    @click="clearAvatar"
                  >
                    Remove photo
                  </UButton>
                </div>
              </div>

              <div class="space-y-4">
                <UFormGroup label="Display name" required>
                  <UInput
                    v-model="state.display_name"
                    placeholder="Enter your display name"
                    icon="i-heroicons-user"
                    size="lg"
                    :disabled="loadingProfile || avatarUploading || loading"
                  />
                </UFormGroup>

                <div class="space-y-2">
                  <div class="text-sm font-medium text-black dark:text-white">
                    {{ isAdmin ? 'Phone number (optional)' : 'Phone number' }}
                  </div>

                  <div class="grid grid-cols-[112px_minmax(0,1fr)] gap-2 items-start sm:grid-cols-[128px_minmax(0,1fr)]">
                    <USelectMenu
                      v-model="selectedCountry"
                      :items="COUNTRY_CODES"
                      class="w-full"
                      :ui="{ width: 'w-full' }"
                      :search-input="{ placeholder: 'Search…', icon: 'i-heroicons-magnifying-glass' }"
                      :disabled="loadingProfile || loading || avatarUploading"
                    >
                      <template #label>
                        <span class="inline-flex items-center gap-2 whitespace-nowrap tabular-nums">
                          <span class="text-base leading-none">{{ isoToFlagEmoji(selectedCountry.iso) }}</span>
                          <span class="whitespace-nowrap">{{ selectedCountry.dial }}</span>
                        </span>
                      </template>

                      <template #option="{ option }">
                        <span class="inline-flex items-center gap-2 whitespace-nowrap tabular-nums">
                          <span class="text-base leading-none">{{ isoToFlagEmoji(option.iso) }}</span>
                          <span class="whitespace-nowrap">{{ option.label }}</span>
                        </span>
                      </template>
                    </USelectMenu>

                    <UInput
                      v-model="phoneLocal"
                      placeholder="Phone number"
                      autocomplete="tel"
                      icon="i-heroicons-phone"
                      size="lg"
                      :disabled="loadingProfile || loading || avatarUploading"
                    />
                  </div>

                  <div class="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                    <div class="text-[11px] text-black/55 dark:text-white/55">Stored phone format</div>
                    <div class="mt-1 font-medium tabular-nums text-black dark:text-white">
                      {{ phonePreview || '—' }}
                    </div>
                  </div>

                  <div
                    v-if="!isAdmin && (mustCompleteBecauseRedirected || mustHavePhone)"
                    class="text-xs text-amber-700 dark:text-amber-300"
                  >
                    Phone is mandatory to continue.
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <UCard class="border border-black/10 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-lg font-semibold text-black dark:text-white">Referral & Rewards</div>
                  <div class="mt-1 text-xs text-black/55 dark:text-white/55">
                    Track subscriptions from your referral code.
                  </div>
                </div>
                <div v-if="loadingReferral" class="text-xs text-black/55 dark:text-white/55">Loading…</div>
              </div>
            </template>

            <div class="space-y-4">
              <div class="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <div class="text-xs text-black/55 dark:text-white/55">Your referral code</div>
                  <div class="mt-2 rounded-2xl border border-dashed border-emerald-500/35 bg-emerald-500/10 px-4 py-3.5">
                    <div class="text-xl md:text-2xl font-bold tracking-[0.22em] text-emerald-900 dark:text-emerald-100">
                      {{ referral.referralCode || '—' }}
                    </div>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  <UButton
                    variant="soft"
                    color="primary"
                    icon="i-heroicons-clipboard-document"
                    :disabled="loadingReferral || !referral.referralCode"
                    :loading="copyingReferral"
                    @click="copyReferralCode"
                  >
                    Copy code
                  </UButton>
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-2xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div class="text-xs text-black/55 dark:text-white/55">Users subscribed with your code</div>
                  <div class="mt-1.5 text-3xl font-bold text-black dark:text-white">
                    {{ successfulReferralCount }}
                  </div>
                </div>

                <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div class="text-xs text-emerald-900/80 dark:text-emerald-100/80">Total referral bonus</div>
                  <div class="mt-1.5 text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                    ৳{{ money(totalReferralBonusDisplay) }}
                  </div>
                </div>
              </div>

              <div class="rounded-2xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div class="text-sm font-medium text-black dark:text-white">How it works</div>
                <div class="mt-1.5 text-sm leading-relaxed text-black/65 dark:text-white/65">
                  Share your code with friends. Your referral count and bonus increase only after someone signs up using your code and successfully buys a subscription.
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <div class="space-y-5">
          <UCard class="border border-black/10 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <template #header>
              <div>
                <div class="text-lg font-semibold text-black dark:text-white">Share Referral</div>
                <div class="mt-1 text-xs text-black/55 dark:text-white/55">
                  Share your referral quickly on social platforms.
                </div>
              </div>
            </template>

            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-2.5">
                <UButton
                  as="a"
                  target="_blank"
                  rel="noopener noreferrer"
                  :href="whatsappShareUrl"
                  variant="soft"
                  color="success"
                  icon="i-simple-icons-whatsapp"
                  :disabled="!referral.referralCode"
                  class="justify-center"
                >
                  WhatsApp
                </UButton>

                <UButton
                  as="a"
                  target="_blank"
                  rel="noopener noreferrer"
                  :href="facebookShareUrl"
                  variant="soft"
                  color="info"
                  icon="i-simple-icons-facebook"
                  :disabled="!referral.referralCode"
                  class="justify-center"
                >
                  Facebook
                </UButton>

                <UButton
                  as="a"
                  target="_blank"
                  rel="noopener noreferrer"
                  :href="tiktokShareUrl"
                  variant="soft"
                  color="neutral"
                  icon="i-simple-icons-tiktok"
                  :disabled="!referral.referralCode"
                  class="justify-center"
                >
                  TikTok
                </UButton>

                <UButton
                  as="a"
                  target="_blank"
                  rel="noopener noreferrer"
                  :href="instagramShareUrl"
                  variant="soft"
                  color="secondary"
                  icon="i-simple-icons-instagram"
                  :disabled="!referral.referralCode"
                  class="justify-center"
                >
                  Instagram
                </UButton>

                <UButton
                  as="a"
                  target="_blank"
                  rel="noopener noreferrer"
                  :href="linkedinShareUrl"
                  variant="soft"
                  color="primary"
                  icon="i-simple-icons-linkedin"
                  :disabled="!referral.referralCode"
                  class="col-span-2 justify-center"
                >
                  LinkedIn
                </UButton>
              </div>

              <UButton
                variant="solid"
                color="primary"
                icon="i-heroicons-document-duplicate"
                :disabled="!shareMessage"
                :loading="copyingShareMessage"
                block
                @click="copyShareMessage"
              >
                Copy share message
              </UButton>

              <div class="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm leading-relaxed text-sky-900 dark:text-sky-100">
                Facebook and LinkedIn can share the link directly. For TikTok and Instagram, open the signup link and paste the copied message in your caption, bio, or DM.
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </UContainer>
</template>