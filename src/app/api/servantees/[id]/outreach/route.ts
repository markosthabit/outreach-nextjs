import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { OutreachRound } from '@/models/outreach-round.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { UserRole } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId, jsonError, readJson } from '@/lib/api-utils'
import {
  OUTREACH_DETAIL_POPULATE,
  OUTREACH_SUMMARY_POPULATE,
  getCurrentOutreachCycle,
  toOutreachSummary,
} from '@/lib/outreach-summary'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/servantees/:id/outreach — the servantee's outreach history across all cycles
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return jsonError('لازم تسجل دخول الأول', 401)

    const { id } = await params
    if (!isValidObjectId(id)) return jsonError('معرّف المخدوم غلط', 400)

    const history = await OutreachAssignment.find({ servanteeId: id })
      .populate(OUTREACH_DETAIL_POPULATE)
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ history })
  } catch (error) {
    console.error('[GET /servantees/:id/outreach]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}

// POST /api/servantees/:id/outreach — mark the servantee contacted / not contacted
// in the current cycle. Body: { isCalled: boolean }
// - Already assigned in the cycle: an Admin or the assigned servant flips the state.
// - Not assigned yet: an Admin marking them contacted records it under their own
//   name in the newest active round (the servant and date can be edited afterwards).
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return jsonError('لازم تسجل دخول الأول', 401)
    const isAdmin = authUser.role === UserRole.ADMIN

    const { id } = await params
    if (!isValidObjectId(id)) return jsonError('معرّف المخدوم غلط', 400)

    const body = await readJson(req)
    const isCalled = body?.isCalled
    if (typeof isCalled !== 'boolean') return jsonError('حدد حالة الافتقاد', 400)

    const cycle = await getCurrentOutreachCycle()
    if (!cycle) return jsonError('مفيش دورة افتقاد، ابدأ دورة الأول', 400)

    let assignment = await OutreachAssignment.findOne({ cycleId: cycle._id, servanteeId: id })

    if (assignment) {
      if (!isAdmin && assignment.servantId.toString() !== authUser.sub) {
        return jsonError('المخدوم ده مش متوزع عليك', 403)
      }
      if (isCalled !== assignment.isCalled) {
        assignment.isCalled = isCalled
        assignment.calledAt = isCalled ? new Date() : null
        assignment.calledBy = isCalled ? (authUser.sub as any) : null
        await assignment.save()
      }
    } else {
      if (!isCalled) return NextResponse.json({ outreach: null })
      if (!isAdmin) return jsonError('المخدوم ده مش متوزع عليك', 403)
      if (cycle.status !== 'active') return jsonError('مفيش دورة شغالة، ابدأ دورة الأول', 400)

      const round = await OutreachRound.findOne({ cycleId: cycle._id, status: 'active' })
        .sort({ createdAt: -1 })
        .select('_id')
        .lean<any>()
      if (!round) return jsonError('مفيش جولة شغالة في الدورة، اعمل جولة الأول', 400)

      if (!(await Servantee.exists({ _id: id }))) return jsonError('المخدوم مش موجود', 404)

      try {
        assignment = await OutreachAssignment.create({
          cycleId: cycle._id,
          roundId: round._id,
          servantId: authUser.sub,
          servanteeId: id,
          isCalled: true,
          calledAt: new Date(),
          calledBy: authUser.sub,
        })
      } catch (error: any) {
        // Someone assigned this servantee at the same moment — don't overwrite their record
        if (error?.code === 11000) return jsonError('المخدوم اتوزع دلوقتي حالاً، حدّث الصفحة', 409)
        throw error
      }
    }

    const populated = await OutreachAssignment.findById(assignment._id)
      .populate(OUTREACH_SUMMARY_POPULATE)
      .lean()

    return NextResponse.json({ outreach: populated ? toOutreachSummary(populated) : null })
  } catch (error) {
    console.error('[POST /servantees/:id/outreach]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}
