import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { connectDB } from '@/lib/db'
import { OutreachCycle } from '@/models/outreach-cycle.model'
import { OutreachRound } from '@/models/outreach-round.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { User } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { byArabicName, isValidObjectId, jsonError } from '@/lib/api-utils'

const MAX_ASSIGN_BATCH = 1000

// GET /api/outreach/assignments?roundId=...&servantId=...
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return jsonError('لازم تسجل دخول الأول', 401)

    const { searchParams } = new URL(req.url)
    const roundId = searchParams.get('roundId')
    const requestedServantId = searchParams.get('servantId')

    if (roundId && !isValidObjectId(roundId)) return jsonError('معرّف الجولة غلط', 400)
    if (requestedServantId && !isValidObjectId(requestedServantId)) {
      return jsonError('معرّف الخادم غلط', 400)
    }

    const query: Record<string, unknown> = {}

    if (roundId) {
      query.roundId = roundId
    } else {
      // Default: newest active round of the active cycle (falls back to its newest round).
      // Without a round there is nothing to show — never return assignments from every cycle.
      const activeCycle = await OutreachCycle.findOne({ status: 'active' }).select('_id').lean()
      if (!activeCycle) return NextResponse.json({ assignments: [] })
      const round =
        (await OutreachRound.findOne({ cycleId: activeCycle._id, status: 'active' })
          .sort({ createdAt: -1 })
          .select('_id')
          .lean()) ||
        (await OutreachRound.findOne({ cycleId: activeCycle._id })
          .sort({ createdAt: -1 })
          .select('_id')
          .lean())
      if (!round) return NextResponse.json({ assignments: [] })
      query.roundId = round._id
    }

    // Servants only ever see their own assignments
    if (authUser.role !== 'Admin') {
      query.servantId = authUser.sub
    } else if (requestedServantId) {
      query.servantId = requestedServantId
    }

    const assignments = await OutreachAssignment.find(query)
      .populate('servanteeId', 'name phone church diocese education year birthDate notes')
      .populate('servantId', 'name email')
      .populate('calledBy', 'name email')
      .lean()

    // Mongo can't sort on a populated field, so sort here: not-called first, then by name
    assignments.sort((a: any, b: any) => {
      if (a.isCalled !== b.isCalled) return a.isCalled ? 1 : -1
      return byArabicName((x) => x.servanteeId?.name)(a, b)
    })

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('[GET /api/outreach/assignments]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}

// POST /api/outreach/assignments - Assign servantees to a servant (Admin only)
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser || authUser.role !== 'Admin') return jsonError('مش مسموحلك تعمل كده', 403)

    const { roundId, servantId, servanteeIds } = await req.json()

    if (!isValidObjectId(roundId)) return jsonError('اختار جولة صحيحة', 400)
    if (!isValidObjectId(servantId)) return jsonError('اختار خادم صحيح', 400)
    if (!Array.isArray(servanteeIds) || servanteeIds.length === 0) {
      return jsonError('حدد مخدوم واحد على الأقل', 400)
    }
    if (servanteeIds.length > MAX_ASSIGN_BATCH) {
      return jsonError(`مينفعش توزع أكتر من ${MAX_ASSIGN_BATCH} مخدوم مرة واحدة`, 400)
    }
    const uniqueIds = [...new Set(servanteeIds)]
    if (!uniqueIds.every(isValidObjectId)) return jsonError('قايمة المخدومين فيها معرّفات غلط', 400)

    const round = await OutreachRound.findById(roundId)
    if (!round) return jsonError('الجولة مش موجودة', 404)
    if (round.status !== 'active') return jsonError('مينفعش توزع على جولة خلصت', 400)

    const cycle = await OutreachCycle.findById(round.cycleId).select('status').lean()
    if (!cycle || (cycle as any).status !== 'active') {
      return jsonError('مينفعش توزع على جولة في دورة خلصت', 400)
    }

    const servantExists = await User.exists({ _id: servantId })
    if (!servantExists) return jsonError('الخادم مش موجود', 404)

    const cycleId = round.cycleId

    // Insert assignments, skipping servantees already assigned in this cycle
    const operations = uniqueIds.map((id) => ({
      updateOne: {
        filter: { cycleId, servanteeId: new Types.ObjectId(id) },
        update: {
          $setOnInsert: {
            cycleId,
            roundId: round._id,
            servantId: new Types.ObjectId(servantId),
            servanteeId: new Types.ObjectId(id),
            isCalled: false,
            calledAt: null,
            calledBy: null,
            notes: '',
          },
        },
        upsert: true,
      },
    }))

    const result = await OutreachAssignment.bulkWrite(operations, { ordered: false })
    const assigned = result.upsertedCount
    const skipped = uniqueIds.length - assigned

    return NextResponse.json({
      message:
        skipped > 0
          ? `اتوزع ${assigned} مخدوم، واتساب ${skipped} عشان متوزعين أصلاً في الدورة دي`
          : `اتوزع ${assigned} مخدوم`,
      upsertedCount: assigned,
      skippedCount: skipped,
    })
  } catch (error) {
    console.error('[POST /api/outreach/assignments]', error)
    return jsonError('التوزيع فشل، جرّب تاني', 500)
  }
}

// DELETE /api/outreach/assignments?assignmentId=... (Admin only)
export async function DELETE(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser || authUser.role !== 'Admin') return jsonError('مش مسموحلك تعمل كده', 403)

    const assignmentId = new URL(req.url).searchParams.get('assignmentId')
    if (!isValidObjectId(assignmentId)) return jsonError('معرّف التكليف غلط', 400)

    const deleted = await OutreachAssignment.findByIdAndDelete(assignmentId)
    if (!deleted) return jsonError('التكليف مش موجود', 404)

    return NextResponse.json({ message: 'التكليف اتلغى والمخدوم رجع لقايمة المتاحين' })
  } catch (error) {
    console.error('[DELETE /api/outreach/assignments]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}
