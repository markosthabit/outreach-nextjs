import { NextRequest } from 'next/server'
import { verifyAccessToken } from './jwt'

export async function getAuthUser(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value

  if (!token) return null

  try {
    const payload = await verifyAccessToken(token)
    return payload
  } catch {
    return null
  }
}