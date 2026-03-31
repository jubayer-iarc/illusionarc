export default defineEventHandler(() => {
  const publicKey = process.env.TOURNAMENT_SUBMIT_PUBLIC_KEY_PEM || ''
  const keyId = process.env.TOURNAMENT_SUBMIT_KEY_ID || 'v1'

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