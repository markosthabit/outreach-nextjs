import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAccessToken } from './lib/jwt'

const PUBLIC_API_ROUTES = new Set(['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'])

async function hasValidAccessToken(token: string | undefined) {
  if (!token) return false
  try {
    await verifyAccessToken(token)
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get('access_token')?.value
  const hasRefreshToken = !!request.cookies.get('refresh_token')?.value

  // ── API Routes ──────────────────────────────────────────────
  if (pathname.startsWith('/api')) {
    if (PUBLIC_API_ROUTES.has(pathname)) return NextResponse.next()

    if (!(await hasValidAccessToken(accessToken))) {
      // 401 lets the client call /api/auth/refresh and retry
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // ── Frontend Routes ──────────────────────────────────────────
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
  const loggedIn = await hasValidAccessToken(accessToken)

  // An expired access token with a refresh token is still a session: let the page
  // load and the client will refresh (previously every reload after 15 minutes
  // of inactivity bounced the user to /login).
  if (!isAuthRoute && !loggedIn && !hasRefreshToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute && loggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo).*)'],
}
