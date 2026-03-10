import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User, UserRole } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/users/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    const { id } = await params

    // Admins can get any user, servants can only get themselves
    if (authUser?.role !== UserRole.ADMIN && authUser?.sub !== id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const user = await User.findById(id)

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error('[GET /users/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/users/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    const { id } = await params

    // Admins can update any user, servants can only update themselves
    if (authUser?.role !== UserRole.ADMIN && authUser?.sub !== id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()

    // Prevent non-admins from escalating their own role
    if (body.role && authUser?.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { message: 'Only admins can change roles' },
        { status: 403 }
      )
    }

    // If password is being updated, hash it
    if (body.password) {
      body.password = await bcrypt.hash(body.password, 10)
    }

    const user = await User.findByIdAndUpdate(id, body, { new: true, runValidators: true })

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error('[PATCH /users/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/users/:id — Admin only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    const { id } = await params

    if (authUser?.role !== UserRole.ADMIN) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    // Prevent admin from deleting themselves
    if (authUser?.sub === id) {
      return NextResponse.json(
        { message: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    const user = await User.findByIdAndDelete(id)

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('[DELETE /users/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}