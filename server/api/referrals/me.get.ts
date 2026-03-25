// server/api/referrals/me.get.ts
import { createError } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

type ProfileRow = {
  user_id: string
  referral_code: string | null
  referral_bonus_bdt: number | null
  referral_bonus_used_bdt: number | null
}

export default defineEventHandler(async (event) => {
  const sb = await serverSupabaseClient(event)

  const { data: auth, error: authErr } = await sb.auth.getUser()
  const user = auth?.user

  if (authErr || !user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Login required'
    })
  }

  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('user_id, referral_code, referral_bonus_bdt, referral_bonus_used_bdt')
    .eq('user_id', user.id)
    .maybeSingle<ProfileRow>()

  if (profileErr) {
    throw createError({
      statusCode: 500,
      statusMessage: `profiles query failed: ${profileErr.message}`
    })
  }

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found'
    })
  }

  const { data: referrals, error: referralsErr } = await sb
    .from('user_referrals')
    .select('id')
    .eq('referrer_user_id', user.id)
    .in('status', ['earned', 'used'])

  if (referralsErr) {
    throw createError({
      statusCode: 500,
      statusMessage: `user_referrals query failed: ${referralsErr.message}`
    })
  }

  const referralCount = Array.isArray(referrals) ? referrals.length : 0

  const referralBonusBdt = Number(profile.referral_bonus_bdt || 0)
  const referralBonusUsedBdt = Number(profile.referral_bonus_used_bdt || 0)
  const referralBonusAvailableBdt = Math.max(0, referralBonusBdt - referralBonusUsedBdt)

  return {
    ok: true,
    referralCode: String(profile.referral_code || '').trim() || null,
    referralCount,
    referralBonusBdt,
    referralBonusUsedBdt,
    referralBonusAvailableBdt
  }
})