import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { OutreachRound } from '@/models/outreach-round.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId, jsonError } from '@/lib/outreach-api'

// GET /api/outreach/report?roundId=...
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser || authUser.role !== 'Admin') {
      return jsonError('غير مصرح لك بهذا الإجراء', 403)
    }

    const { searchParams } = new URL(req.url)
    const roundId = searchParams.get('roundId')

    if (!isValidObjectId(roundId)) return jsonError('معرّف الجولة غير صالح', 400)

    const round = await OutreachRound.findById(roundId)
      .populate('cycleId', 'name')
      .lean()

    if (!round) {
      return jsonError('الجولة غير موجودة', 404)
    }

    const assignments = await OutreachAssignment.find({ roundId })
      .populate('servanteeId', 'name phone church diocese education year birthDate')
      .populate('servantId', 'name email')
      .populate('calledBy', 'name email')
      .lean()

    const totalAssigned = assignments.length
    const totalCalled = assignments.filter((a) => a.isCalled).length
    const totalNotCalled = totalAssigned - totalCalled
    const completionPercentage =
      totalAssigned > 0 ? Math.round((totalCalled / totalAssigned) * 100) : 0

    // Group assignments by servant
    const servantMap = new Map<string, any>()

    for (const a of assignments) {
      const sId = (a.servantId as any)?._id?.toString() || a.servantId?.toString()
      if (!sId) continue

      if (!servantMap.has(sId)) {
        servantMap.set(sId, {
          servant: a.servantId,
          assignedCount: 0,
          calledCount: 0,
          notCalledCount: 0,
          completionPercentage: 0,
          assignments: [],
        })
      }

      const group = servantMap.get(sId)
      group.assignedCount += 1
      if (a.isCalled) {
        group.calledCount += 1
      } else {
        group.notCalledCount += 1
      }
      group.assignments.push(a)
    }

    // Compute percentages and sort assignments within each servant (called first or uncalled first)
    const servants = Array.from(servantMap.values()).map((item) => {
      item.completionPercentage =
        item.assignedCount > 0 ? Math.round((item.calledCount / item.assignedCount) * 100) : 0
      // Sort assignments: not called first, or called first
      item.assignments.sort((x: any, y: any) => {
        if (x.isCalled === y.isCalled) {
          return (x.servanteeId?.name || '').localeCompare(y.servanteeId?.name || '', 'ar')
        }
        return x.isCalled ? 1 : -1 // Not called first
      })
      return item
    })

    // Sort servants by name
    servants.sort((a, b) => (a.servant?.name || '').localeCompare(b.servant?.name || '', 'ar'))

    const notCalledList = assignments
      .filter((a) => !a.isCalled)
      .sort((x: any, y: any) =>
        (x.servanteeId?.name || '').localeCompare(y.servanteeId?.name || '', 'ar')
      )
      .map((a) => ({
        _id: a._id,
        servantee: a.servanteeId,
        servant: a.servantId,
        notes: a.notes,
      }))

    return NextResponse.json({
      round,
      summary: {
        totalAssigned,
        totalCalled,
        totalNotCalled,
        completionPercentage,
      },
      servants,
      notCalledList,
    })
  } catch (error) {
    console.error('[GET /api/outreach/report]', error)
    return jsonError('حدث خطأ في الخادم', 500)
  }
}
