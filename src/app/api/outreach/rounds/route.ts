import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { OutreachCycle } from '@/models/outreach-cycle.model'
import { OutreachRound } from '@/models/outreach-round.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId, jsonError, parseDate } from '@/lib/api-utils'

// GET /api/outreach/rounds?cycleId=...
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return jsonError('Unauthorized', 401)

    const { searchParams } = new URL(req.url)
    let cycleId = searchParams.get('cycleId')

    if (cycleId && !isValidObjectId(cycleId)) return jsonError('معرّف الدورة غير صالح', 400)

    if (!cycleId) {
      const activeCycle = await OutreachCycle.findOne({ status: 'active' }).lean()
      if (!activeCycle) return NextResponse.json({ rounds: [] })
      cycleId = activeCycle._id.toString()
    }

    const rounds = await OutreachRound.find({ cycleId })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    // One aggregation for all round stats instead of 2 queries per round
    const stats = await OutreachAssignment.aggregate([
      { $match: { roundId: { $in: rounds.map((r: any) => r._id) } } },
      {
        $group: {
          _id: '$roundId',
          totalAssigned: { $sum: 1 },
          totalCalled: { $sum: { $cond: ['$isCalled', 1, 0] } },
        },
      },
    ])
    const statsById = new Map(stats.map((s: any) => [s._id.toString(), s]))

    const roundsWithStats = rounds.map((round: any) => {
      const s = statsById.get(round._id.toString())
      const totalAssigned = s?.totalAssigned ?? 0
      const totalCalled = s?.totalCalled ?? 0
      return {
        ...round,
        totalAssigned,
        totalCalled,
        totalNotCalled: totalAssigned - totalCalled,
        completionPercentage: totalAssigned > 0 ? Math.round((totalCalled / totalAssigned) * 100) : 0,
      }
    })

    return NextResponse.json({ rounds: roundsWithStats })
  } catch (error) {
    console.error('[GET /api/outreach/rounds]', error)
    return jsonError('حدث خطأ في الخادم', 500)
  }
}

// POST /api/outreach/rounds - Create new round (Admin only)
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser || authUser.role !== 'Admin') return jsonError('غير مصرح لك بهذا الإجراء', 403)

    const { cycleId, name, startDate, endDate } = await req.json()

    if (!name || typeof name !== 'string' || !name.trim()) {
      return jsonError('اسم الجولة مطلوب', 400)
    }
    const start = parseDate(startDate)
    const end = parseDate(endDate)
    if (!start || !end) return jsonError('يرجى تحديد تاريخ بداية ونهاية صالحين', 400)
    if (start > end) return jsonError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 400)

    if (cycleId && !isValidObjectId(cycleId)) return jsonError('معرّف الدورة غير صالح', 400)

    const cycle = cycleId
      ? await OutreachCycle.findById(cycleId)
      : await OutreachCycle.findOne({ status: 'active' })
    if (!cycle) return jsonError('لا توجد دورة نشطة. يرجى بدء دورة أولاً.', 400)
    if (cycle.status !== 'active') return jsonError('لا يمكن إضافة جولة لدورة منتهية', 400)

    const newRound = await OutreachRound.create({
      cycleId: cycle._id,
      name: name.trim(),
      startDate: start,
      endDate: end,
      status: 'active',
      createdBy: authUser.sub,
    })

    return NextResponse.json({ round: newRound }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/outreach/rounds]', error)
    return jsonError('حدث خطأ في الخادم', 500)
  }
}

// PATCH /api/outreach/rounds - Update round status or dates (Admin only)
export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser || authUser.role !== 'Admin') return jsonError('غير مصرح لك بهذا الإجراء', 403)

    const { roundId, status, name, startDate, endDate } = await req.json()
    if (!isValidObjectId(roundId)) return jsonError('معرّف الجولة غير صالح', 400)

    const round = await OutreachRound.findById(roundId)
    if (!round) return jsonError('الجولة غير موجودة', 404)

    if (status !== undefined) {
      if (!['active', 'completed'].includes(status)) return jsonError('حالة غير صالحة', 400)
      if (status === 'active') {
        const cycle = await OutreachCycle.findById(round.cycleId).lean()
        if (!cycle || (cycle as any).status !== 'active') {
          return jsonError('لا يمكن إعادة تنشيط جولة في دورة منتهية', 400)
        }
      }
      round.status = status
    }
    if (typeof name === 'string' && name.trim()) round.name = name.trim()
    if (startDate !== undefined) {
      const d = parseDate(startDate)
      if (!d) return jsonError('تاريخ البداية غير صالح', 400)
      round.startDate = d
    }
    if (endDate !== undefined) {
      const d = parseDate(endDate)
      if (!d) return jsonError('تاريخ النهاية غير صالح', 400)
      round.endDate = d
    }
    if (round.startDate > round.endDate) {
      return jsonError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 400)
    }

    await round.save()
    return NextResponse.json({ round })
  } catch (error) {
    console.error('[PATCH /api/outreach/rounds]', error)
    return jsonError('حدث خطأ في الخادم', 500)
  }
}

