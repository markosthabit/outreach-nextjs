import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User, UserRole } from '@/models/user.model'
import { Retreat } from '@/models/retreat.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isNonEmptyString, isValidObjectId, readJson } from '@/lib/api-utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/users/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    const { id } = await params
    if (!authUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'Invalid user id' }, { status: 400 })

    // Admins can get any user, servants only themselves
    if (authUser.role !== UserRole.ADMIN && authUser.sub !== id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const user = await User.findById(id)
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 })

    return NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error('[GET /users/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/users/:id — admins: any user; servants: only their own name/email/password
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    const { id } = await params
    if (!authUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'Invalid user id' }, { status: 400 })

    const isAdmin = authUser.role === UserRole.ADMIN
    if (!isAdmin && authUser.sub !== id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await readJson(req)
    if (!body) return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })

    // Whitelist: never let a client write _id, refreshTokenHash, timestamps, …
    const update: Record<string, unknown> = {}

    if (body.name !== undefined) {
      if (!isNonEmptyString(body.name, 100)) {
        return NextResponse.json({ message: 'Invalid name' }, { status: 400 })
      }
      update.name = body.name.trim()
    }

    if (body.email !== undefined) {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!EMAIL_RE.test(email) || email.length > 254) {
        return NextResponse.json({ message: 'البريد الإلكتروني غير صالح' }, { status: 400 })
      }
      const taken = await User.exists({ email, _id: { $ne: id } })
      if (taken) {
        return NextResponse.json({ message: 'A user with this email already exists' }, { status: 409 })
      }
      update.email = email
    }

    // Empty password = "leave unchanged" (the edit form submits it blank)
    if (typeof body.password === 'string' && body.password !== '') {
      if (body.password.length < 8 || body.password.length > 200) {
        return NextResponse.json({ message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
      }
      update.password = await bcrypt.hash(body.password, 10)
    }

    if (body.role !== undefined && body.role !== null && body.role !== '') {
      const current = await User.findById(id).select('role').lean<{ role: UserRole }>()
      if (!current) return NextResponse.json({ message: 'User not found' }, { status: 404 })

      if (body.role !== current.role) {
        if (!isAdmin) {
          return NextResponse.json({ message: 'Only admins can change roles' }, { status: 403 })
        }
        if (!Object.values(UserRole).includes(body.role)) {
          return NextResponse.json({ message: 'Invalid role' }, { status: 400 })
        }
        if (authUser.sub === id) {
          return NextResponse.json({ message: 'You cannot change your own role' }, { status: 400 })
        }
        update.role = body.role
      }
    }

    // Changing someone's password signs them out everywhere (their refresh token stops working)
    const unset = update.password && authUser.sub !== id ? { $unset: { refreshTokenHash: 1 } } : {}

    const user = await User.findByIdAndUpdate(id, { $set: update, ...unset }, { new: true, runValidators: true })
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 })

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
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'Invalid user id' }, { status: 400 })

    if (authUser.sub === id) {
      return NextResponse.json({ message: 'You cannot delete your own account' }, { status: 400 })
    }

    const user = await User.findByIdAndDelete(id)
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 })

    // Clean up references: their outreach assignments go back to the pool,
    // and they're removed from retreat servant lists.
    const [{ deletedCount }] = await Promise.all([
      OutreachAssignment.deleteMany({ servantId: user._id }),
      Retreat.updateMany({ servants: user._id }, { $pull: { servants: user._id } }),
    ])

    return NextResponse.json({ message: 'User deleted successfully', removedOutreachAssignments: deletedCount })
  } catch (error) {
    console.error('[DELETE /users/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
