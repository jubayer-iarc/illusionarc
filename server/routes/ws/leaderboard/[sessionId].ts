// server/routes/ws/leaderboard/[sessionId].ts
import crypto from 'node:crypto'

type DeviceType = 'Mobile' | 'PC' | 'Emulator'

type WsTicketPayload = {
  sid: string
  nonce: string
  slug: string
  uid: string
  dt: DeviceType
  iat: number
  exp: number
}

type HelloMessage = {
  type: 'HELLO'
  sessionId: string
  sessionNonce: string
  gameSlug: string
  wsTicket: string
  wsTicketExp?: number
  deviceType?: DeviceType
}

type PingMessage = {
  type: 'PING'
  ts?: number
}

type KeepAliveMessage = {
  type: 'KEEPALIVE'
  ts?: number
}

type RunEventMessage = {
  type: 'RUN_EVENT'
  eventType: string
  value?: number
  ts?: number
}

type FinishMessage = {
  type: 'FINISH'
  ts?: number
}

type ClientMessage =
  | HelloMessage
  | PingMessage
  | KeepAliveMessage
  | RunEventMessage
  | FinishMessage

type PeerState = {
  authenticated: boolean
  sessionId: string
  sessionNonce: string
  gameSlug: string
  userId: string
  deviceType: DeviceType | null
  ticketExp: number
  authTimer: ReturnType<typeof setTimeout> | null
}

const peerStateMap = new WeakMap<any, PeerState>()

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromB64url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4
  const padded =
    pad === 2 ? normalized + '==' :
    pad === 3 ? normalized + '=' :
    pad === 1 ? normalized + '===' :
    normalized

  return Buffer.from(padded, 'base64')
}

function verifyWsTicket(ticket: string, secret: string): WsTicketPayload | null {
  try {
    const [encoded, providedSig] = String(ticket || '').split('.')
    if (!encoded || !providedSig) return null

    const expectedSig = b64url(
      crypto.createHmac('sha256', secret).update(encoded).digest()
    )

    const a = Buffer.from(providedSig, 'utf8')
    const b = Buffer.from(expectedSig, 'utf8')

    if (a.length !== b.length) return null
    if (!crypto.timingSafeEqual(a, b)) return null

    const payload = JSON.parse(fromB64url(encoded).toString('utf8')) as WsTicketPayload
    if (!payload || typeof payload !== 'object') return null
    return payload
  } catch {
    return null
  }
}

function sendJson(peer: any, payload: Record<string, any>) {
  try {
    peer.send(JSON.stringify(payload))
  } catch {}
}

function closePeer(peer: any, code = 4000, reason = 'closed') {
  try {
    peer.close(code, reason)
  } catch {
    try {
      peer.close()
    } catch {}
  }
}

function parseMessage(message: any): ClientMessage | null {
  try {
    const raw =
      typeof message?.text === 'function'
        ? message.text()
        : typeof message === 'string'
          ? message
          : typeof message?.toString === 'function'
            ? message.toString()
            : ''

    if (!raw) return null

    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    if (typeof data.type !== 'string') return null

    return data as ClientMessage
  } catch {
    return null
  }
}

function normalizeEventType(input: unknown) {
  return String(input || '').trim().slice(0, 64)
}

function normalizeValue(input: unknown) {
  const n = Number(input ?? 0)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

function validateHelloAgainstTicket(hello: HelloMessage, secret: string) {
  const sessionId = String(hello.sessionId || '').trim()
  const sessionNonce = String(hello.sessionNonce || '').trim()
  const gameSlug = String(hello.gameSlug || '').trim()
  const wsTicket = String(hello.wsTicket || '').trim()

  const rawDeviceType = String(hello.deviceType || '').trim()
  const deviceType: DeviceType | null =
    rawDeviceType === 'Mobile' ||
    rawDeviceType === 'PC' ||
    rawDeviceType === 'Emulator'
      ? rawDeviceType
      : null

  if (!sessionId || !sessionNonce || !gameSlug || !wsTicket) {
    return { ok: false as const, reason: 'Missing hello fields' }
  }

  const payload = verifyWsTicket(wsTicket, secret)
  if (!payload) {
    return { ok: false as const, reason: 'Invalid websocket ticket' }
  }

  const nowSec = Math.floor(Date.now() / 1000)

  if (!payload.exp || nowSec >= payload.exp) {
    return { ok: false as const, reason: 'Websocket ticket expired' }
  }

  if (payload.sid !== sessionId) {
    return { ok: false as const, reason: 'Ticket session mismatch' }
  }

  if (payload.nonce !== sessionNonce) {
    return { ok: false as const, reason: 'Ticket nonce mismatch' }
  }

  if (payload.slug !== gameSlug) {
    return { ok: false as const, reason: 'Ticket game mismatch' }
  }

  if (deviceType && payload.dt && payload.dt !== deviceType) {
    return { ok: false as const, reason: 'Ticket device mismatch' }
  }

  return {
    ok: true as const,
    sessionId: payload.sid,
    sessionNonce: payload.nonce,
    gameSlug: payload.slug,
    userId: payload.uid,
    deviceType: payload.dt || deviceType || null,
    ticketExp: payload.exp
  }
}

export default defineWebSocketHandler({
  open(peer) {
    const state: PeerState = {
      authenticated: false,
      sessionId: '',
      sessionNonce: '',
      gameSlug: '',
      userId: '',
      deviceType: null,
      ticketExp: 0,
      authTimer: null
    }

    peerStateMap.set(peer, state)

    state.authTimer = setTimeout(() => {
      const current = peerStateMap.get(peer)
      if (!current?.authenticated) {
        sendJson(peer, {
          type: 'ERROR',
          code: 'AUTH_TIMEOUT',
          message: 'HELLO not received in time'
        })
        closePeer(peer, 4001, 'auth-timeout')
      }
    }, 8000)

    sendJson(peer, {
      type: 'WELCOME',
      message: 'Send HELLO to authenticate'
    })
  },

  async message(peer, message) {
    const state = peerStateMap.get(peer)
    if (!state) {
      sendJson(peer, {
        type: 'ERROR',
        code: 'NO_STATE',
        message: 'Socket state missing'
      })
      closePeer(peer, 4002, 'no-state')
      return
    }

    const data = parseMessage(message)
    if (!data) {
      sendJson(peer, {
        type: 'ERROR',
        code: 'BAD_JSON',
        message: 'Invalid websocket payload'
      })
      return
    }

    const config = useRuntimeConfig()
    const wsTicketSecret = String(
      config.wsTicketSecret ||
      config.resetTicketSecret ||
      ''
    ).trim()

    if (!wsTicketSecret) {
      sendJson(peer, {
        type: 'ERROR',
        code: 'SERVER_CONFIG_MISSING',
        message: 'Missing wsTicketSecret'
      })
      closePeer(peer, 4500, 'server-config-missing')
      return
    }

    if (!state.authenticated) {
      if (data.type !== 'HELLO') {
        sendJson(peer, {
          type: 'ERROR',
          code: 'AUTH_REQUIRED',
          message: 'First message must be HELLO'
        })
        closePeer(peer, 4003, 'auth-required')
        return
      }

      const result = validateHelloAgainstTicket(data, wsTicketSecret)

      if (!result.ok) {
        sendJson(peer, {
          type: 'ERROR',
          code: 'AUTH_FAILED',
          message: result.reason
        })
        closePeer(peer, 4004, 'auth-failed')
        return
      }

      state.authenticated = true
      state.sessionId = result.sessionId
      state.sessionNonce = result.sessionNonce
      state.gameSlug = result.gameSlug
      state.userId = result.userId
      state.deviceType = result.deviceType
      state.ticketExp = result.ticketExp

      if (state.authTimer) {
        clearTimeout(state.authTimer)
        state.authTimer = null
      }

      sendJson(peer, {
        type: 'HELLO_ACK',
        ok: true,
        sessionId: state.sessionId,
        gameSlug: state.gameSlug,
        serverTime: Date.now(),
        ticketExp: state.ticketExp
      })
      return
    }

    const nowSec = Math.floor(Date.now() / 1000)
    if (state.ticketExp && nowSec >= state.ticketExp) {
      sendJson(peer, {
        type: 'ERROR',
        code: 'TICKET_EXPIRED',
        message: 'Websocket ticket expired'
      })
      closePeer(peer, 4005, 'ticket-expired')
      return
    }

    if (data.type === 'PING') {
      sendJson(peer, { type: 'PONG', ts: Date.now() })
      return
    }

    if (data.type === 'KEEPALIVE') {
      sendJson(peer, { type: 'KEEPALIVE_ACK', ts: Date.now() })
      return
    }

    if (data.type === 'RUN_EVENT') {
      const eventType = normalizeEventType(data.eventType)
      const value = normalizeValue(data.value)

      if (!eventType) {
        sendJson(peer, {
          type: 'ERROR',
          code: 'BAD_RUN_EVENT',
          message: 'eventType is required'
        })
        return
      }

      sendJson(peer, {
        type: 'RUN_EVENT_ACK',
        eventType,
        value,
        ts: Date.now()
      })
      return
    }

    if (data.type === 'FINISH') {
      sendJson(peer, {
        type: 'FINISH_ACK',
        ts: Date.now()
      })
      closePeer(peer, 1000, 'finished')
      return
    }

    sendJson(peer, {
      type: 'ERROR',
      code: 'UNSUPPORTED_MESSAGE',
      message: `Unsupported message type: ${String((data as any).type || '')}`
    })
  },

  close(peer) {
    const state = peerStateMap.get(peer)
    if (state?.authTimer) clearTimeout(state.authTimer)
    peerStateMap.delete(peer)
  },

  error(peer, error) {
    sendJson(peer, {
      type: 'ERROR',
      code: 'SOCKET_ERROR',
      message: String(error?.message || 'Unknown websocket error')
    })
  }
})