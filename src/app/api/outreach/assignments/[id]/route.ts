import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { User, UserRole } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId, jsonError, parseDate, readJson } from '@/lib/api-utils'
import { OUTREACH_DETAIL_POPULATE, withDeletedUserNames } from '@/lib/outreach-summary'

const MAX_NOTE_LENGTH = 2000
const CLOCK_SKEW_MS = 5 * 60 * 1000

// PATCH /api/outreach/assignments/[id] — edit the details of an outreach record.
// Body (all optional, at least one): { servantId, isCalled, calledAt, calledBy, notes }
// - Admin: everything.
// - The assigned servant: isCalled, calledAt and notes of their own assignment.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return jsonError('لازم تسجل دخول الأول', 401)
    const isAdmin = authUser.role === UserRole.ADMIN

    const { id } = await params
    if (!isValidObjectId(id)) return jsonError('معرّف التكليف غلط', 400)

    const body = await readJson(req)
    if (!body) return jsonError('مفيش حاجة تتحدث', 400)
    const { servantId, isCalled, calledAt, calledBy, notes } = body

    const hasServant = servantId !== undefined
    const hasIsCalled = isCalled !== undefined
    const hasCalledAt = calledAt !== undefined && calledAt !== null && calledAt !== ''
    const hasCalledBy = calledBy !== undefined && calledBy !== null && calledBy !== ''
    const hasNotes = notes !== undefined
    if (!hasServant && !hasIsCalled && !hasCalledAt && !hasCalledBy && !hasNotes) {
      return jsonError('مفيش حاجة تتحدث', 400)
    }

    if (hasIsCalled && typeof isCalled !== 'boolean') return jsonError('حالة الافتقاد غلط', 400)
    if (hasNotes && typeof notes !== 'string') return jsonError('الملاحظة غلط', 400)
    if (hasNotes && notes.length > MAX_NOTE_LENGTH) {
      return jsonError(`الملاحظة طويلة أوي (آخرها ${MAX_NOTE_LENGTH} حرف)`, 400)
    }
    if (hasServant && !isValidObjectId(servantId)) return jsonError('اختار خادم صحيح', 400)
    if (hasCalledBy && !isValidObjectId(calledBy)) return jsonError('اختار خادم صحيح', 400)

    let calledAtDate: Date | null = null
    if (hasCalledAt) {
      calledAtDate = parseDate(calledAt)
      if (!calledAtDate) return jsonError('تاريخ الافتقاد غلط', 400)
      if (calledAtDate.getTime() > Date.now() + CLOCK_SKEW_MS) {
        return jsonError('تاريخ الافتقاد مينفعش يبقى في المستقبل', 400)
      }
    }

    const assignment = await OutreachAssignment.findById(id)
    if (!assignment) return jsonError('التكليف مش موجود', 404)

    if (!isAdmin) {
      if (assignment.servantId.toString() !== authUser.sub) {
        return jsonError('مش مسموحلك تعدّل التكليف ده', 403)
      }
      if (hasServant || hasCalledBy) return jsonError('المسؤول بس اللي يقدر يغيّر الخادم', 403)
    }

    const userIds = [hasServant && servantId, hasCalledBy && calledBy].filter(Boolean) as string[]
    if (userIds.length > 0) {
      const unique = [...new Set(userIds)]
      const found = await User.countDocuments({ _id: { $in: unique } })
      if (found !== unique.length) return jsonError('الخادم مش موجود', 404)
    }

    if (hasServant) assignment.servantId = servantId
    if (hasNotes) assignment.notes = notes.trim()

    const nextIsCalled = hasIsCalled ? isCalled : assignment.isCalled
    if (!nextIsCalled) {
      assignment.isCalled = false
      assignment.calledAt = null
      assignment.calledBy = null
    } else {
      const wasCalled = assignment.isCalled
      assignment.isCalled = true
      if (calledAtDate) assignment.calledAt = calledAtDate
      else if (!wasCalled || !assignment.calledAt) assignment.calledAt = new Date()
      if (hasCalledBy) assignment.calledBy = calledBy
      else if (!wasCalled || !assignment.calledBy) assignment.calledBy = authUser.sub as any
    }

    await assignment.save()

    const populated = await OutreachAssignment.findById(assignment._id)
      .populate(OUTREACH_DETAIL_POPULATE)
      .lean<any>()

    return NextResponse.json({ assignment: populated && withDeletedUserNames(populated) })
  } catch (error) {
    console.error('[PATCH /api/outreach/assignments/[id]]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}
