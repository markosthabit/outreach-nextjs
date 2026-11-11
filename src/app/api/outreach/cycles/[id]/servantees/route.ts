import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { OutreachCycle } from '@/models/outreach-cycle.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { Servantee } from '@/models/servantee.model'
import { UserRole } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { byArabicName, isValidObjectId, jsonError } from '@/lib/api-utils'

const SERVANTEE_FIELDS = 'name phone church diocese education year'

// GET /api/outreach/cycles/:id/servantees (Admin only)
// Who was contacted in this cycle and who wasn't. "Not contacted" covers both
// servantees assigned to a servant but not called yet, and servantees that were
// never assigned in the cycle.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser || authUser.role !== UserRole.ADMIN) return jsonError('مش مسموحلك تعمل كده', 403)

    const { id } = await params
    if (!isValidObjectId(id)) return jsonError('معرّف الدورة غلط', 400)

    const cycle = await OutreachCycle.findById(id).select('name status startedAt endedAt').lean<any>()
    if (!cycle) return jsonError('الدورة مش موجودة', 404)

    const assignments = await OutreachAssignment.find({ cycleId: cycle._id })
      .populate('servanteeId', SERVANTEE_FIELDS)
      .populate('servantId', 'name')
      .populate('calledBy', 'name')
      .populate('roundId', 'name')
      .lean<any[]>()

    const rows = assignments
      .filter((a) => a.servanteeId?._id) // skip records whose servantee was deleted
      .map((a) => ({
        servantee: a.servanteeId,
        assigned: true,
        isCalled: !!a.isCalled,
        calledAt: a.calledAt || null,
        servant: a.servantId || null,
        calledBy: a.calledBy || null,
        round: a.roundId || null,
        notes: a.notes || '',
      }))

    // Never assigned in this cycle. For a finished cycle, leave out servantees
    // that were only added after it ended — they could not have been contacted in it.
    const unassignedQuery: Record<string, unknown> = {
      _id: { $nin: rows.map((r) => r.servantee._id) },
      isActive: { $ne: false },
    }
    if (cycle.status === 'completed' && cycle.endedAt) {
      unassignedQuery.createdAt = { $lte: cycle.endedAt }
    }
    const unassigned = await Servantee.find(unassignedQuery).select(SERVANTEE_FIELDS).lean<any[]>()

    const byName = byArabicName((r) => r.servantee?.name)
    const contacted = rows.filter((r) => r.isCalled).sort(byName)
    const notContacted = [
      ...rows.filter((r) => !r.isCalled),
      ...unassigned.map((s) => ({
        servantee: s,
        assigned: false,
        isCalled: false,
        calledAt: null,
        servant: null,
        calledBy: null,
        round: null,
        notes: '',
      })),
    ].sort(byName)

    return NextResponse.json({
      cycle,
      summary: {
        total: contacted.length + notContacted.length,
        contacted: contacted.length,
        notContacted: notContacted.length,
        unassigned: unassigned.length,
      },
      contacted,
      notContacted,
    })
  } catch (error) {
    console.error('[GET /api/outreach/cycles/[id]/servantees]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}
