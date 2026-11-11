import { createHash, timingSafeEqual } from 'crypto'

/**
 * Refresh tokens are stored as a SHA-256 digest, not a bcrypt hash.
 *
 * bcrypt only reads the first 72 bytes of its input, and those bytes (the JWT
 * header plus the start of the payload) are identical for every token issued to
 * the same user — so a bcrypt comparison accepted *any* of that user's old
 * refresh tokens, which made logout / password-reset revocation ineffective.
 * The token is already a long random-looking signed value, so a fast digest is
 * the right tool here; a slow password hash adds nothing.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time check of a token against a stored digest. Legacy (bcrypt) values never match. */
export function tokenMatchesHash(token: string, storedHash: unknown): boolean {
  if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/.test(storedHash)) return false
  return timingSafeEqual(Buffer.from(hashToken(token), 'hex'), Buffer.from(storedHash, 'hex'))
}
