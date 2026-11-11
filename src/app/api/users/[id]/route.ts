import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User, UserRole } from '@/models/user.model'
import { Retreat } from '@/models/retreat.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isNonEmptyString, isValidObjectId, readJson } from '@/lib/api-utils'
import { OutreachCycle } from '@/models/outreach-cycle.model'
import { signAccessToken, signRefreshToken } from '@/lib/jwt'
import { setAccessCookie, setRefreshCookie } from '@/lib/auth-cookies'
import { hashToken } from '@/lib/token-hash'
import { rateLimit } from '@/lib/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/users/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    const { id } = await params
    if (!authUser) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'معرّف الحساب غلط' }, { status: 400 })

    // Admins can get any user, servants only themselves
    if (authUser.role !== UserRole.ADMIN && authUser.sub !== id) {
      return NextResponse.json({ message: 'مش مسموحلك تعمل كده' }, { status: 403 })
    }

    const user = await User.findById(id)
    if (!user) return NextResponse.json({ message: 'الحساب مش موجود' }, { status: 404 })

    return NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error('[GET /users/:id]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}

// PATCH /api/users/:id — admins: any user; servants: only their own name/email/password
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    const { id } = await params
    if (!authUser) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'معرّف الحساب غلط' }, { status: 400 })

    const isAdmin = authUser.role === UserRole.ADMIN
    if (!isAdmin && authUser.sub !== id) {
      return NextResponse.json({ message: 'مش مسموحلك تعمل كده' }, { status: 403 })
    }

    const body = await readJson(req)
    if (!body) return NextResponse.json({ message: 'البيانات اللي اتبعتت غلط' }, { status: 400 })

    // Whitelist: never let a client write _id, refreshTokenHash, timestamps, …
    const update: Record<string, unknown> = {}

    if (body.name !== undefined) {
      if (!isNonEmptyString(body.name, 100)) {
        return NextResponse.json({ message: 'الاسم غلط' }, { status: 400 })
      }
      update.name = body.name.trim()
    }

    if (body.email !== undefined) {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!EMAIL_RE.test(email) || email.length > 254) {
        return NextResponse.json({ message: 'الإيميل غلط' }, { status: 400 })
      }
      const taken = await User.exists({ email, _id: { $ne: id } })
      if (taken) {
        return NextResponse.json({ message: 'فيه حساب متسجل بالإيميل ده' }, { status: 409 })
      }
      update.email = email
    }

    // Empty password = "leave unchanged" (the edit form submits it blank)
    if (typeof body.password === 'string' && body.password !== '') {
      if (body.password.length < 8 || body.password.length > 200) {
        return NextResponse.json({ message: 'كلمة السر لازم تبقى 8 حروف على الأقل' }, { status: 400 })
      }
      // Changing your own password requires the current one, so an unlocked screen
      // or a stolen session can't be turned into a permanent account takeover.
      if (authUser.sub === id) {
        const attempts = rateLimit(`password-change:${id}`, 10, 15 * 60 * 1000)
        if (!attempts.allowed) {
          return NextResponse.json(
            { message: 'جربت كتير، استنى شوية وجرّب تاني' },
            { status: 429, headers: { 'Retry-After': String(attempts.retryAfterSeconds) } }
          )
        }
        if (typeof body.currentPassword !== 'string' || !body.currentPassword) {
          return NextResponse.json({ message: 'اكتب كلمة السر الحالية عشان تغيّرها' }, { status: 400 })
        }
        const self = await User.findById(id).select('+password')
        if (!self) return NextResponse.json({ message: 'الحساب مش موجود' }, { status: 404 })
        if (!(await bcrypt.compare(body.currentPassword, self.password))) {
          return NextResponse.json({ message: 'كلمة السر الحالية غلط' }, { status: 403 })
        }
      }
      update.password = await bcrypt.hash(body.password, 10)
    }

    if (body.role !== undefined && body.role !== null && body.role !== '') {
      const current = await User.findById(id).select('role').lean<{ role: UserRole }>()
      if (!current) return NextResponse.json({ message: 'الحساب مش موجود' }, { status: 404 })

      if (body.role !== current.role) {
        if (!isAdmin) {
          return NextResponse.json({ message: 'المسؤولين بس اللي يقدروا يغيروا الصلاحيات' }, { status: 403 })
        }
        if (!Object.values(UserRole).includes(body.role)) {
          return NextResponse.json({ message: 'الصلاحية غلط' }, { status: 400 })
        }
        if (authUser.sub === id) {
          return NextResponse.json({ message: 'مينفعش تغيّر صلاحية حسابك بنفسك' }, { status: 400 })
        }
        update.role = body.role
      }
    }

    // A password change ends every other session:
    // - someone else's password → their refresh token is revoked outright
    // - your own password → this browser gets a fresh refresh token, older ones stop working
    const changedOwnPassword = !!update.password && authUser.sub === id
    const unset = update.password && !changedOwnPassword ? { $unset: { refreshTokenHash: 1 } } : {}

    let newRefreshToken: string | null = null
    if (changedOwnPassword) {
      newRefreshToken = await signRefreshToken({ sub: id, role: authUser.role })
      update.refreshTokenHash = hashToken(newRefreshToken)
    }

    const user = await User.findByIdAndUpdate(id, { $set: update, ...unset }, { new: true, runValidators: true })
    if (!user) return NextResponse.json({ message: 'الحساب مش موجود' }, { status: 404 })

    const response = NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
    if (newRefreshToken) {
      setRefreshCookie(response, newRefreshToken)
      setAccessCookie(response, await signAccessToken({ sub: id, role: user.role }))
    }
    return response
  } catch (error) {
    console.error('[PATCH /users/:id]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}

// DELETE /api/users/:id — Admin only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    const { id } = await params

    if (authUser?.role !== UserRole.ADMIN) {
      return NextResponse.json({ message: 'مش مسموحلك تعمل كده' }, { status: 403 })
    }
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'معرّف الحساب غلط' }, { status: 400 })

    if (authUser.sub === id) {
      return NextResponse.json({ message: 'مينفعش تمسح حسابك بنفسك' }, { status: 400 })
    }

    const user = await User.findById(id).select('name')
    if (!user) return NextResponse.json({ message: 'الحساب مش موجود' }, { status: 404 })

    // Outreach history is kept. The account's name is copied onto its records first,
    // because after the delete the reference no longer resolves to a name.
    await Promise.all([
      OutreachAssignment.updateMany({ servantId: user._id }, { $set: { servantName: user.name } }),
      OutreachAssignment.updateMany({ calledBy: user._id }, { $set: { calledByName: user.name } }),
    ])

    // Only untouched work is released: servantees in a running cycle that this servant
    // never contacted and wrote no notes on go back to the pool so they can be reassigned.
    const activeCycleIds = await OutreachCycle.find({ status: 'active' }).distinct('_id')
    const [{ deletedCount }, keptOutreachRecords] = await Promise.all([
      OutreachAssignment.deleteMany({
        servantId: user._id,
        cycleId: { $in: activeCycleIds },
        isCalled: false,
        notes: { $in: ['', null] },
      }),
      Retreat.updateMany({ servants: user._id }, { $pull: { servants: user._id } }),
    ]).then(async ([released]) => [released, await OutreachAssignment.countDocuments({ servantId: user._id })] as const)

    await User.deleteOne({ _id: user._id })

    return NextResponse.json({
      message: 'الحساب اتمسح',
      releasedOutreachAssignments: deletedCount,
      keptOutreachRecords,
    })
  } catch (error) {
    console.error('[DELETE /users/:id]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}
