import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)

    if (!authUser) {
      return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })
    }

    const user = await User.findById(authUser.sub)

    if (!user) {
      return NextResponse.json({ message: 'الحساب مش موجود' }, { status: 404 })
    }

    return NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error('[PROFILE]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}