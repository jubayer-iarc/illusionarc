// utils/encryptLeaderboardSubmit.ts
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN[\s\S]+?-----/g, '')
    .replace(/-----END[\s\S]+?-----/g, '')
    .replace(/\s+/g, '')

  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function importRsaPublicKey(publicKeyPem: string) {
  return await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )
}

export async function encryptLeaderboardSubmitPayload(payload: Record<string, any>) {
  const { keyId, publicKey } = await $fetch<{
    keyId: string
    publicKey: string
  }>('/api/leaderboard/submit-public-key')

  const rsaKey = await importRsaPublicKey(publicKey)

  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext
  )

  const aesRaw = await crypto.subtle.exportKey('raw', aesKey)

  const encryptedKeyBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaKey,
    aesRaw
  )

  return {
    keyId,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    encryptedKey: bytesToBase64(new Uint8Array(encryptedKeyBuffer))
  }
}