import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAccessToken } from './lib/jwt'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isApiRoute = pathname.startsWith('/api')
  const isPublicApiRoute = pathname === '/api/auth/login'

  // ── API Routes ──────────────────────────────────────────────
  if (isApiRoute) {
    if (isPublicApiRoute) return NextResponse.next()

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    try {
      await verifyAccessToken(token)
      return NextResponse.next()
    } catch {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 })
    }
  }

  // ── Frontend Routes ──────────────────────────────────────────
  if (!token && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo).*)'],
}