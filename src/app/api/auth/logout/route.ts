import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)

    if (authUser) {
      // Wipe the refresh token hash so old refresh tokens are invalidated
      await User.findByIdAndUpdate(authUser.sub, { refreshTokenHash: null })
    }

    const response = NextResponse.json({ message: 'Logged out successfully' })

    response.cookies.set('access_token', '', { maxAge: 0, path: '/' })
    response.cookies.set('refresh_token', '', { maxAge: 0, path: '/' })

    return response
  } catch (error) {
    console.error('[LOGOUT]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}