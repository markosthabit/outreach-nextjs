import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { verifyRefreshToken } from '@/lib/jwt'
import { clearAuthCookies } from '@/lib/auth-cookies'

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ message: 'Logged out successfully' })
  // Always clear cookies, even if revoking server-side fails
  clearAuthCookies(response)

  try {
    await connectDB()

    // Identify the user from the access token, or from the refresh token when the
    // access token has already expired — otherwise the refresh token stays valid.
    let userId = (await getAuthUser(req))?.sub as string | undefined
    if (!userId) {
      const refreshToken = req.cookies.get('refresh_token')?.value
      if (refreshToken) {
        try {
          userId = (await verifyRefreshToken(refreshToken)).sub
        } catch {
          // expired / invalid — nothing to revoke
        }
      }
    }

    if (userId) {
      await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } })
    }
  } catch (error) {
    console.error('[LOGOUT]', error)
  }

  return response
}
