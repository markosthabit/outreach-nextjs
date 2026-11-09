import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user.model'
import { signAccessToken, signRefreshToken } from '@/lib/jwt'
import { setAccessCookie, setRefreshCookie } from '@/lib/auth-cookies'
import { readJson } from '@/lib/api-utils'
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit'

const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req)
    const email = body?.email
    const password = body?.password

    // Strict types: an object like {"$ne": null} must never reach the Mongo query
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 })
    }
    if (email.length > 254 || password.length > 200) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const limiterKey = `login:${clientIp(req)}:${normalizedEmail}`
    const limit = rateLimit(limiterKey, MAX_ATTEMPTS, WINDOW_MS)
    if (!limit.allowed) {
      return NextResponse.json(
        { message: 'محاولات تسجيل دخول كثيرة. حاول مرة أخرى بعد قليل.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      )
    }

    await connectDB()

    // select: false fields must be explicitly selected
    const user = await User.findOne({ email: normalizedEmail }).select('+password')

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 })
    }

    resetRateLimit(limiterKey)

    const payload = { sub: user._id.toString(), role: user.role }
    const accessToken = await signAccessToken(payload)
    const refreshToken = await signRefreshToken(payload)

    // Store only a hash of the refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10)
    await User.findByIdAndUpdate(user._id, { refreshTokenHash })

    const response = NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
    setAccessCookie(response, accessToken)
    setRefreshCookie(response, refreshToken)
    return response
  } catch (error) {
    console.error('[LOGIN]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Method Not Allowed. Login credentials must be sent via POST.' },
    { status: 405 }
  )
}
