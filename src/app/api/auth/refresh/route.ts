import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user.model'
import { verifyRefreshToken, signAccessToken } from '@/lib/jwt'
import { clearAuthCookies, setAccessCookie } from '@/lib/auth-cookies'
import { tokenMatchesHash } from '@/lib/token-hash'

function unauthorized(message: string) {
  const res = NextResponse.json({ message }, { status: 401 })
  clearAuthCookies(res)
  return res
}

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refresh_token')?.value
  if (!refreshToken) return unauthorized('لازم تسجل دخول الأول')

  let payload
  try {
    payload = await verifyRefreshToken(refreshToken)
  } catch {
    return unauthorized('الجلسة خلصت، سجل دخول تاني')
  }

  try {
    await connectDB()

    // The token must match the hash stored at login (revoked on logout / new login)
    const user = await User.findById(payload.sub).select('+refreshTokenHash')
    if (!user || !user.refreshTokenHash) return unauthorized('لازم تسجل دخول الأول')

    if (!tokenMatchesHash(refreshToken, user.refreshTokenHash)) return unauthorized('لازم تسجل دخول الأول')

    // Role is re-read from the DB, so role changes apply on the next refresh
    const newAccessToken = await signAccessToken({ sub: user._id.toString(), role: user.role })

    const response = NextResponse.json({ message: 'الجلسة اتجددت' })
    setAccessCookie(response, newAccessToken)
    return response
  } catch (error) {
    console.error('[REFRESH]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}
