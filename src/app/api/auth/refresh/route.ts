import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user.model'
import { verifyRefreshToken, signAccessToken } from '@/lib/jwt'

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const refreshToken = req.cookies.get('refresh_token')?.value

    if (!refreshToken) {
      return NextResponse.json({ message: 'No refresh token' }, { status: 401 })
    }

    // Verify the token is valid
    const payload = await verifyRefreshToken(refreshToken)

    // Check the hash matches what's stored in DB
    const user = await User.findById(payload.sub).select('+refreshTokenHash')

    if (!user || !user.refreshTokenHash) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash)

    if (!isValid) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Issue a new access token
    const newAccessToken = await signAccessToken({ sub: user._id.toString(), role: user.role })

    const response = NextResponse.json({ message: 'Token refreshed' })

    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[REFRESH]', error)
    return NextResponse.json({ message: 'Invalid or expired refresh token' }, { status: 401 })
  }
}