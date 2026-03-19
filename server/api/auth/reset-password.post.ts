// server/api/auth/reset-password.post.ts
import { createClient } from '@supabase/supabase-js'
import {
  defineEventHandler,
  readBody,
  getCookie,
  deleteCookie,
  createError
} from 'h3'
import crypto from 'node:crypto'

type ResetTicketPayload = {
  sub: string
  email?: string | null
  exp: number
  iat: number
  jti: string
}

type ResetPasswordBody = {
  password?: string
  confirm?: string
}

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function b64urlToBuffer(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : ''
  return Buffer.from(normalized + pad, 'base64')
}

function verifyTicket(token: string, secret: string): ResetTicketPayload | null {
  const [encoded, sig] = String(token || '').split('.')
  if (!encoded || !sig) return null

  const expected = b64url(
    crypto.createHmac('sha256', secret).update(encoded).digest()
  )

  const sigBuf = b64urlToBuffer(sig)
  const expBuf = b64urlToBuffer(expected)

  if (sigBuf.length !== expBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

  try {
    const payload = JSON.parse(b64urlToBuffer(encoded).toString('utf8')) as ResetTicketPayload
    const now = Math.floor(Date.now() / 1000)

    if (!payload?.sub || !payload?.exp || payload.exp < now) return null
    return payload
  } catch {
    return null
  }
}

function isStrongEnough(password: string) {
  return String(password || '').length >= 6
}

function clearResetCookies(event: Parameters<typeof defineEventHandler>[0]) {
  const names = [
    'ia_reset_ticket',
    'ia_reset_access',
    'ia_reset_refresh'
  ]

  for (const name of names) {
    deleteCookie(event, name, { path: '/' })
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  const supabaseUrl = config.public.supabaseUrl as string
  const supabaseAnonKey = config.public.supabaseAnonKey as string
  const resetTicketSecret = config.resetTicketSecret as string

  if (!supabaseUrl || !supabaseAnonKey || !resetTicketSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server auth configuration is incomplete.'
    })
  }

  const body = await readBody<ResetPasswordBody>(event)
  const password = String(body?.password || '')
  const confirm = String(body?.confirm || '')

  if (!isStrongEnough(password)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 6 characters.'
    })
  }

  if (password !== confirm) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Passwords do not match.'
    })
  }

  const ticket = getCookie(event, 'ia_reset_ticket')
  const accessToken = getCookie(event, 'ia_reset_access')
  const refreshToken = getCookie(event, 'ia_reset_refresh')

  const payload = verifyTicket(ticket || '', resetTicketSecret)

  if (!payload?.sub || !accessToken || !refreshToken) {
    clearResetCookies(event)

    throw createError({
      statusCode: 401,
      statusMessage: 'Reset session expired or invalid. Please request a new reset link.'
    })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  })

  if (sessionError || !sessionData.user?.id) {
    clearResetCookies(event)

    throw createError({
      statusCode: 401,
      statusMessage: 'Recovery session not found. Please open the reset link again.'
    })
  }

  if (sessionData.user.id !== payload.sub) {
    clearResetCookies(event)

    throw createError({
      statusCode: 403,
      statusMessage: 'Reset session does not match the requested user.'
    })
  }

  const { error } = await supabase.auth.updateUser({
    password
  })

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message || 'Could not update password.'
    })
  }

  clearResetCookies(event)

  return {
    ok: true,
    message: 'Password updated successfully.'
  }
})