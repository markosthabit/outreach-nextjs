import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { UserRole } from '@/models/user.model'

// GET /api/users — Admin only
export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)

    if (authUser?.role !== UserRole.ADMIN) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const users = await User.find()

    return NextResponse.json({ users })
  } catch (error) {
    console.error('[GET /users]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/users — Admin only
export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)

    if (authUser?.role !== UserRole.ADMIN) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { name, email, password, role } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Name, email and password are required' },
        { status: 400 }
      )
    }

    const existing = await User.findOne({ email })

    if (existing) {
      return NextResponse.json(
        { message: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role ?? UserRole.SERVANT,
    })

    return NextResponse.json(
      { user: { id: user._id, name: user.name, email: user.email, role: user.role } },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /users]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}