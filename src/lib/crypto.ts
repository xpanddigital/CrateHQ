/**
 * Field-level encryption for sensitive credentials stored in the database.
 *
 * Uses AES-256-GCM with a per-value random IV. The encryption key is derived
 * from the CREDENTIALS_ENCRYPTION_KEY env var (or falls back to
 * SUPABASE_SERVICE_ROLE_KEY as a seed — not ideal but better than plaintext).
 *
 * Format: base64(iv + authTag + ciphertext)
 * - IV: 12 bytes
 * - Auth tag: 16 bytes
 * - Ciphertext: variable length
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

/**
 * Derive a 32-byte key from the configured secret.
 * Uses SHA-256 so any length secret works.
 */
function getKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('No encryption key available (set CREDENTIALS_ENCRYPTION_KEY)')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypt a plaintext string. Returns a base64-encoded string
 * containing IV + authTag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  // Pack: iv (12) + tag (16) + ciphertext
  const packed = Buffer.concat([iv, tag, encrypted])
  return packed.toString('base64')
}

/**
 * Decrypt a base64-encoded encrypted string produced by encrypt().
 */
export function decrypt(encoded: string): string {
  const key = getKey()
  const packed = Buffer.from(encoded, 'base64')

  if (packed.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted data (too short)')
  }

  const iv = packed.subarray(0, IV_LENGTH)
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

/**
 * Check if a string looks like it's already encrypted (base64 with minimum length).
 * Used to avoid double-encryption.
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 40) return false
  // Check if it's valid base64 and decodes to at least IV + tag + 1 byte
  try {
    const buf = Buffer.from(value, 'base64')
    return buf.length >= IV_LENGTH + TAG_LENGTH + 1 && value === buf.toString('base64')
  } catch {
    return false
  }
}
