import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user.model'
import { verifyRefreshToken, signAccessToken } from '@/lib/jwt'
import { clearAuthCookies, setAccessCookie } from '@/lib/auth-cookies'

function unauthorized(message: string) {
  const res = NextResponse.json({ message }, { status: 401 })
  clearAuthCookies(res)
  return res
}

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refresh_token')?.value
  if (!refreshToken) return unauthorized('No refresh token')

  let payload
  try {
    payload = await verifyRefreshToken(refreshToken)
  } catch {
    return unauthorized('Invalid or expired refresh token')
  }

  try {
    await connectDB()

    // The token must match the hash stored at login (revoked on logout / new login)
    const user = await User.findById(payload.sub).select('+refreshTokenHash')
    if (!user || !user.refreshTokenHash) return unauthorized('Unauthorized')

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash)
    if (!isValid) return unauthorized('Unauthorized')

    // Role is re-read from the DB, so role changes apply on the next refresh
    const newAccessToken = await signAccessToken({ sub: user._id.toString(), role: user.role })

    const response = NextResponse.json({ message: 'Token refreshed' })
    setAccessCookie(response, newAccessToken)
    return response
  } catch (error) {
    console.error('[REFRESH]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
