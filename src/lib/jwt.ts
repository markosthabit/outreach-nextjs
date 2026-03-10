// lib/jwt.ts
import { SignJWT, jwtVerify } from 'jose';

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signAccessToken(payload: object) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(ACCESS_SECRET);
}

export async function signRefreshToken(payload: object) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, ACCESS_SECRET);
  return payload;
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, REFRESH_SECRET);
  return payload;
}