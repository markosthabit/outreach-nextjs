import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user.model'
import { signAccessToken, signRefreshToken } from '@/lib/jwt'

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // select: false fields must be explicitly selected
    const user = await User.findOne({ email }).select('+password +refreshTokenHash')

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const payload = { sub: user._id.toString(), role: user.role }
    const accessToken = await signAccessToken(payload)
    const refreshToken = await signRefreshToken(payload)

    // Hash and store the refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10)
    await User.findByIdAndUpdate(user._id, { refreshTokenHash })

    const response = NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })

    // Set HTTP-only cookies
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15, // 15 minutes
      path: '/',
    })

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[LOGIN]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}