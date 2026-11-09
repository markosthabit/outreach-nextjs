// lib/jwt.ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

type TokenType = 'access' | 'refresh'

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET
  // Without this check a missing env var silently signs tokens with the string "undefined"
  if (!value || value.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters')
  }
  return new TextEncoder().encode(value)
}

function sign(payload: object, typ: TokenType, expiresIn: string) {
  return new SignJWT({ ...payload, typ })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret())
}

async function verify(token: string, typ: TokenType): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
  // Access and refresh tokens share a key, so the type claim is what stops a
  // 7-day refresh token from being replayed as an access token.
  if (payload.typ !== typ || typeof payload.sub !== 'string') {
    throw new Error(`Invalid ${typ} token`)
  }
  return payload
}

export const signAccessToken = (payload: object) => sign(payload, 'access', '15m')
export const signRefreshToken = (payload: object) => sign(payload, 'refresh', '7d')
export const verifyAccessToken = (token: string) => verify(token, 'access')
export const verifyRefreshToken = (token: string) => verify(token, 'refresh')
