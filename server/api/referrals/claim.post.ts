// server/api/referrals/claim.post.ts
import { createError, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

type ClaimBody = {
  referralCode?: string
}

type ProfileRow = {
  user_id: string
  referral_code: string | null
  referred_by_user_id: string | null
  referral_bonus_bdt: number | null
}

function normalizeReferralCode(v: unknown) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function isDuplicateError(err: any) {
  const code = String(err?.code || '')
  const msg = String(err?.message || '').toLowerCase()
  return code === '23505' || msg.includes('duplicate key')
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

  const body = await readBody<ClaimBody>(event)
  const referralCode = normalizeReferralCode(body?.referralCode)

  if (!referralCode) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing referral code'
    })
  }

  const { data: me, error: meErr } = await sb
    .from('profiles')
    .select('user_id, referral_code, referred_by_user_id, referral_bonus_bdt')
    .eq('user_id', user.id)
    .maybeSingle<ProfileRow>()

  if (meErr) {
    throw createError({
      statusCode: 500,
      statusMessage: meErr.message
    })
  }

  if (!me) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Profile not found'
    })
  }

  if (me.referred_by_user_id) {
    return {
      ok: true,
      alreadyClaimed: true,
      message: 'Referral code already used'
    }
  }

  const myOwnCode = normalizeReferralCode(me.referral_code)
  if (myOwnCode && myOwnCode === referralCode) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You cannot use your own referral code'
    })
  }

  const { data: referrer, error: refErr } = await sb
    .from('profiles')
    .select('user_id, referral_code')
    .eq('referral_code', referralCode)
    .maybeSingle<{ user_id: string; referral_code: string | null }>()

  if (refErr) {
    throw createError({
      statusCode: 500,
      statusMessage: refErr.message
    })
  }

  if (!referrer?.user_id) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invalid referral code'
    })
  }

  if (referrer.user_id === user.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You cannot use your own referral code'
    })
  }

  const { data: existingReferral, error: existingReferralErr } = await sb
    .from('user_referrals')
    .select('id')
    .eq('referred_user_id', user.id)
    .maybeSingle<{ id: number }>()

  if (existingReferralErr) {
    throw createError({
      statusCode: 500,
      statusMessage: existingReferralErr.message
    })
  }

  if (existingReferral?.id) {
    return {
      ok: true,
      alreadyClaimed: true,
      message: 'Referral code already used'
    }
  }

  const nextBonus = Number(me.referral_bonus_bdt || 0) + 10

  const { data: updatedMe, error: updateErr } = await sb
    .from('profiles')
    .update({
      referred_by_user_id: referrer.user_id,
      referral_bonus_bdt: nextBonus,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id)
    .is('referred_by_user_id', null)
    .select('user_id')
    .maybeSingle<{ user_id: string }>()

  if (updateErr) {
    throw createError({
      statusCode: 500,
      statusMessage: updateErr.message
    })
  }

  if (!updatedMe?.user_id) {
    return {
      ok: true,
      alreadyClaimed: true,
      message: 'Referral code already used'
    }
  }

  const { error: insertErr } = await sb
    .from('user_referrals')
    .insert({
      referrer_user_id: referrer.user_id,
      referred_user_id: user.id,
      referral_code: referralCode,
      bonus_bdt: 10,
      status: 'pending'
    })

  if (insertErr) {
    if (isDuplicateError(insertErr)) {
      return {
        ok: true,
        alreadyClaimed: true,
        message: 'Referral code already used'
      }
    }

    throw createError({
      statusCode: 500,
      statusMessage: insertErr.message
    })
  }

  return {
    ok: true,
    claimed: true,
    referralCode,
    bonusAddedBdt: 10,
    message: 'Referral applied. ৳10 bonus will be used on subscription payment.'
  }
})