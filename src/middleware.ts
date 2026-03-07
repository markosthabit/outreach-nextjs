import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const { pathname } = request.nextUrl

  const isAuthRoute =
    pathname.startsWith('/login') || pathname.startsWith('/register')

  // 1️⃣ Not authenticated → redirect to login
  if (!token && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2️⃣ Authenticated but accessing login/register → redirect to dashboard
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 3️⃣ Role-based restriction (only for admin routes)
  // Adjust this array if you want to protect more routes later
  // const adminOnlyRoutes = ['/dashboard/servants']

  // if (token && adminOnlyRoutes.some((route) => pathname.startsWith(route))) {
  //   try {
  //     // Decode JWT (no verification needed for middleware)
  //     const decoded: any = jwt.decode(token)

  //     // If role is not ADMIN → redirect to dashboard
  //     if (!decoded || decoded.role !== 'Admin') {
  //       return NextResponse.redirect(new URL('/dashboard', request.url))
  //     }
  //   } catch (error) {
  //     console.error('Error decoding token:', error)
  //     return NextResponse.redirect(new URL('/login', request.url))
  //   }
  // }

  return NextResponse.next()
}

// Protect all routes except static/public ones
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|logo).*)'],
}
