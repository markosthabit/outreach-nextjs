import type { NextResponse } from 'next/server'

const base = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export const ACCESS_TOKEN_MAX_AGE = 60 * 15 // 15 minutes
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function setAccessCookie(res: NextResponse, token: string) {
  res.cookies.set('access_token', token, { ...base, maxAge: ACCESS_TOKEN_MAX_AGE })
}

export function setRefreshCookie(res: NextResponse, token: string) {
  res.cookies.set('refresh_token', token, { ...base, maxAge: REFRESH_TOKEN_MAX_AGE })
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set('access_token', '', { ...base, maxAge: 0 })
  res.cookies.set('refresh_token', '', { ...base, maxAge: 0 })
}
