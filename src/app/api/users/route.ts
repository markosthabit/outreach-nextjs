import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User, UserRole } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isNonEmptyString, readJson } from '@/lib/api-utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/users — Authenticated users
export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    if (!authUser) {
      return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })
    }

    const users = await User.find().select('name email role').sort({ name: 1 }).lean()
    return NextResponse.json({ users })
  } catch (error) {
    console.error('[GET /users]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}

// POST /api/users — Admin only
export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    if (authUser?.role !== UserRole.ADMIN) {
      return NextResponse.json({ message: 'مش مسموحلك تعمل كده' }, { status: 403 })
    }

    const body = await readJson(req)
    const { name, email, password, role } = body ?? {}

    if (!isNonEmptyString(name, 100) || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ message: 'اكتب الاسم والإيميل وكلمة السر' }, { status: 400 })
    }
    const normalizedEmail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 254) {
      return NextResponse.json({ message: 'الإيميل غلط' }, { status: 400 })
    }
    // The schema's minlength runs on the bcrypt hash (always 60 chars), so check the raw value here
    if (password.length < 8 || password.length > 200) {
      return NextResponse.json({ message: 'كلمة السر لازم تبقى 8 حروف على الأقل' }, { status: 400 })
    }
    if (role !== undefined && role !== null && role !== '' && !Object.values(UserRole).includes(role)) {
      return NextResponse.json({ message: 'الصلاحية غلط' }, { status: 400 })
    }

    const existing = await User.exists({ email: normalizedEmail })
    if (existing) {
      return NextResponse.json({ message: 'فيه حساب متسجل بالإيميل ده' }, { status: 409 })
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role: role || UserRole.SERVANT,
    })

    return NextResponse.json(
      { user: { id: user._id, name: user.name, email: user.email, role: user.role } },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /users]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}
