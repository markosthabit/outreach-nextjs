import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user.model'
import { signAccessToken, signRefreshToken } from '@/lib/jwt'
import { setAccessCookie, setRefreshCookie } from '@/lib/auth-cookies'
import { readJson } from '@/lib/api-utils'
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit'
import { hashToken } from '@/lib/token-hash'

const MAX_ATTEMPTS = 10
// X-Forwarded-For is client-controlled unless a trusted proxy overwrites it, so the
// per-IP limit alone can be dodged by sending a new header value on every request.
// This second limit counts attempts against the account itself, whatever the IP.
const MAX_ATTEMPTS_PER_ACCOUNT = 30
const WINDOW_MS = 15 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req)
    const email = body?.email
    const password = body?.password

    // Strict types: an object like {"$ne": null} must never reach the Mongo query
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json({ message: 'اكتب الإيميل وكلمة السر' }, { status: 400 })
    }
    if (email.length > 254 || password.length > 200) {
      return NextResponse.json({ message: 'الإيميل أو كلمة السر غلط' }, { status: 401 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const limiterKey = `login:${clientIp(req)}:${normalizedEmail}`
    const accountKey = `login-account:${normalizedEmail}`
    const accountLimit = rateLimit(accountKey, MAX_ATTEMPTS_PER_ACCOUNT, WINDOW_MS)
    const ipLimit = rateLimit(limiterKey, MAX_ATTEMPTS, WINDOW_MS)
    const limit = accountLimit.allowed ? ipLimit : accountLimit
    if (!limit.allowed) {
      return NextResponse.json(
        { message: 'جربت تدخل كتير، استنى شوية وجرّب تاني' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      )
    }

    await connectDB()

    // select: false fields must be explicitly selected
    const user = await User.findOne({ email: normalizedEmail }).select('+password')

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ message: 'الإيميل أو كلمة السر غلط' }, { status: 401 })
    }

    resetRateLimit(limiterKey)
    resetRateLimit(accountKey)

    const payload = { sub: user._id.toString(), role: user.role }
    const accessToken = await signAccessToken(payload)
    const refreshToken = await signRefreshToken(payload)

    // Store only a digest of the refresh token (see lib/token-hash.ts for why not bcrypt)
    await User.findByIdAndUpdate(user._id, { refreshTokenHash: hashToken(refreshToken) })

    const response = NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
    setAccessCookie(response, accessToken)
    setRefreshCookie(response, refreshToken)
    return response
  } catch (error) {
    console.error('[LOGIN]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'الطريقة دي مش مسموحة' },
    { status: 405 }
  )
}
