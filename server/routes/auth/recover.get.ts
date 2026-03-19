// server/routes/auth/recover.get.ts
import { createClient } from '@supabase/supabase-js'
import {
  defineEventHandler,
  getQuery,
  sendRedirect,
  setCookie,
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

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function signPayload(payload: ResetTicketPayload, secret: string) {
  const encoded = b64url(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest()
  return `${encoded}.${b64url(sig)}`
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

  const query = getQuery(event)
  const tokenHash = String(query.token_hash || '')
  const type = String(query.type || '')
  const nextRaw = String(query.next || '/update-password')
  const next = nextRaw.startsWith('/') ? nextRaw : '/update-password'

  if (!tokenHash || type !== 'recovery') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid recovery link.'
    })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery'
  })

  if (error || !data.user?.id || !data.session?.access_token || !data.session?.refresh_token) {
    clearResetCookies(event)

    return sendRedirect(
      event,
      `/forget-password?error=${encodeURIComponent('Invalid or expired reset link.')}`,
      302
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const payload: ResetTicketPayload = {
    sub: data.user.id,
    email: data.user.email ?? null,
    iat: now,
    exp: now + 60 * 10,
    jti: crypto.randomUUID()
  }

  const ticket = signPayload(payload, resetTicketSecret)

  clearResetCookies(event)

  setCookie(event, 'ia_reset_ticket', ticket, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10
  })

  setCookie(event, 'ia_reset_access', data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10
  })

  setCookie(event, 'ia_reset_refresh', data.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10
  })

  return sendRedirect(event, next, 302)
})