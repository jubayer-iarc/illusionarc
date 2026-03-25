<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'

useHead({
  title: 'Profile — illusion Arc',
  meta: [{ name: 'description', content: 'Edit your Illusion Arc profile.' }]
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

const selectedCountry = ref<CountryOpt>(COUNTRY_CODES.find((c) => c.iso === 'BD') || COUNTRY_CODES[0])
const phoneLocal = ref('')

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
  <UContainer class="py-10 md:py-14">
    <div class="mx-auto max-w-5xl">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-black dark:text-white">
            Profile
          </h1>
          <p class="mt-2 text-sm md:text-base text-black/70 dark:text-white/70">
            Manage your display name, phone number, avatar and referral details.
          </p>
        </div>

        <div class="flex items-center gap-2">
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

      <div
        v-if="mustHavePhone"
        class="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4"
      >
        <div class="flex items-start gap-3">
          <div class="mt-0.5 h-10 w-10 rounded-2xl border border-amber-500/25 bg-amber-500/10 grid place-items-center">
            <UIcon name="i-heroicons-exclamation-triangle" class="h-5 w-5 opacity-90" />
          </div>
          <div class="min-w-0">
            <div class="font-semibold text-black dark:text-white">Phone number required</div>
            <div class="text-sm mt-1 text-black/70 dark:text-white/70">
              Please add your phone number and save changes to continue.
            </div>
          </div>
        </div>
      </div>

      <div class="mt-8 grid gap-6 lg:grid-cols-[360px_1fr] items-start">
        <UCard class="border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="font-semibold text-black dark:text-white">Avatar</div>
              <div v-if="loadingProfile" class="text-xs text-black/60 dark:text-white/60">Loading…</div>
            </div>
          </template>

          <div class="grid gap-4">
            <div class="flex items-center gap-4">
              <div class="relative h-20 w-20 rounded-full overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/30">
                <img
                  v-if="state.avatar_url"
                  :src="state.avatar_url"
                  class="h-full w-full object-cover"
                  alt="Avatar"
                  referrerpolicy="no-referrer"
                />
                <div v-else class="h-full w-full grid place-items-center font-semibold text-black/70 dark:text-white/70">
                  {{ initials(state.display_name) }}
                </div>

                <div v-if="avatarUploading" class="absolute inset-0 grid place-items-center bg-black/60">
                  <span class="i-heroicons-arrow-path-20-solid animate-spin text-xl text-white"></span>
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <div class="text-xs text-black/60 dark:text-white/60">Display name</div>
                <div class="mt-1 text-lg font-semibold text-black dark:text-white truncate">
                  {{ state.display_name || '—' }}
                </div>

                <div class="mt-2 text-xs text-black/60 dark:text-white/60">Phone</div>
                <div class="mt-1 text-sm font-medium text-black dark:text-white tabular-nums truncate">
                  {{ phonePreview || '—' }}
                </div>
              </div>
            </div>

            <input ref="avatarInput" class="hidden" type="file" accept="image/*" @change="onPickAvatar" />

            <div class="grid gap-2">
              <UButton
                variant="soft"
                icon="i-heroicons-arrow-up-tray"
                :disabled="avatarUploading || loadingProfile || loading"
                @click="openAvatarPicker"
              >
                Upload
              </UButton>

              <UButton
                v-if="state.avatar_url"
                variant="ghost"
                icon="i-heroicons-x-mark"
                :disabled="avatarUploading || loadingProfile || loading"
                @click="clearAvatar"
              >
                Clear
              </UButton>
            </div>
          </div>
        </UCard>

        <div class="grid gap-6">
          <UCard class="border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div class="font-semibold text-black dark:text-white">Referral</div>
                <div v-if="loadingReferral" class="text-xs text-black/60 dark:text-white/60">Loading…</div>
              </div>
            </template>

            <div class="grid gap-5">
              <div class="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <div class="text-xs text-black/60 dark:text-white/60">Your referral code</div>
                  <div class="mt-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] px-4 py-3">
                    <div class="text-xl font-semibold tracking-[0.18em] text-black dark:text-white">
                      {{ referral.referralCode || '—' }}
                    </div>
                  </div>
                </div>

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

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-4">
                  <div class="text-xs text-black/60 dark:text-white/60">Users subscribed with your code</div>
                  <div class="mt-2 text-2xl font-semibold text-black dark:text-white">
                    {{ successfulReferralCount }}
                  </div>
                </div>

                <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div class="text-xs text-emerald-900/80 dark:text-emerald-100/80">Total referral bonus</div>
                  <div class="mt-2 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
                    ৳{{ money(totalReferralBonusDisplay) }}
                  </div>
                </div>
              </div>

              <div class="text-xs text-black/60 dark:text-white/60 leading-relaxed">
                Share this code with new users. Your referral count and total referral bonus increase only after a user signs up with your code and successfully buys a subscription.
              </div>
            </div>
          </UCard>

          <UCard class="border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
            <template #header>
              <div class="font-semibold text-black dark:text-white">Profile details</div>
            </template>

            <div class="grid gap-5">
              <UFormGroup label="Display name" required>
                <UInput
                  v-model="state.display_name"
                  placeholder="Your display name"
                  icon="i-heroicons-user"
                  :disabled="loadingProfile || avatarUploading || loading"
                />
              </UFormGroup>

              <div class="grid gap-3 sm:grid-cols-[190px_1fr]">
                <UFormGroup :label="isAdmin ? 'Country code (optional)' : 'Country code'" :required="!isAdmin">
                  <USelectMenu
                    v-model="selectedCountry"
                    :items="COUNTRY_CODES"
                    class="w-full"
                    :ui="{ width: 'w-full' }"
                    :search-input="{ placeholder: 'Search…', icon: 'i-heroicons-magnifying-glass' }"
                    :disabled="loadingProfile || loading || avatarUploading"
                  >
                    <template #label>
                      <span class="inline-flex items-center gap-2 tabular-nums whitespace-nowrap">
                        <span class="text-base leading-none">{{ isoToFlagEmoji(selectedCountry.iso) }}</span>
                        <span class="whitespace-nowrap">{{ selectedCountry.label }}</span>
                      </span>
                    </template>

                    <template #option="{ option }">
                      <span class="inline-flex items-center gap-2 tabular-nums whitespace-nowrap">
                        <span class="text-base leading-none">{{ isoToFlagEmoji(option.iso) }}</span>
                        <span class="whitespace-nowrap">{{ option.label }}</span>
                      </span>
                    </template>
                  </USelectMenu>
                </UFormGroup>

                <UFormGroup :label="isAdmin ? 'Phone number (optional)' : 'Phone number'" :required="!isAdmin">
                  <UInput
                    v-model="phoneLocal"
                    placeholder="Phone number"
                    autocomplete="tel"
                    icon="i-heroicons-phone"
                    :disabled="loadingProfile || loading || avatarUploading"
                  />
                </UFormGroup>
              </div>

              <div
                v-if="!isAdmin && (mustCompleteBecauseRedirected || mustHavePhone)"
                class="text-xs text-amber-700 dark:text-amber-300"
              >
                Phone is mandatory to continue.
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </UContainer>
</template>