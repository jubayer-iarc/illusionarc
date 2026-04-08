// server/api/leaderboard/submit-public-key.get.ts
import { createError } from 'h3'

export default defineEventHandler(() => {
  const publicKey = process.env.LEADERBOARD_SUBMIT_PUBLIC_KEY_PEM || ''
  const keyId = process.env.LEADERBOARD_SUBMIT_KEY_ID || 'v1'

  if (!publicKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing public submit key'
    })
  }

  return {
    keyId,
    publicKey
  }
})