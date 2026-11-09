import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { OutreachCycle } from '@/models/outreach-cycle.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { Servantee } from '@/models/servantee.model'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/outreach/eligible-servantees
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser || authUser.role !== 'Admin') {
      return NextResponse.json({ message: 'غير مصرح لك بهذا الإجراء' }, { status: 403 })
    }

    const activeCycle = await OutreachCycle.findOne({ status: 'active' }).lean()
    if (!activeCycle) {
      return NextResponse.json({
        servantees: [],
        message: 'No active cycle found. Please start a cycle first.',
        activeCycle: null,
      })
    }

    // Get all servantee IDs assigned anywhere in the current active cycle
    const assignedIds = await OutreachAssignment.distinct('servanteeId', {
      cycleId: activeCycle._id,
    })

    // Fetch active servantees who have NOT been assigned in this cycle
    const eligibleServantees = await Servantee.find({
      _id: { $nin: assignedIds },
      isActive: { $ne: false },
    })
      .select('name phone church diocese education year birthDate')
      .lean()

    // Arabic-aware name ordering (Mongo's default collation sorts Arabic poorly)
    eligibleServantees.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'ar'))

    return NextResponse.json({
      servantees: eligibleServantees,
      totalEligible: eligibleServantees.length,
      assignedCountInCycle: assignedIds.length,
      activeCycle,
    })
  } catch (error) {
    console.error('[GET /api/outreach/eligible-servantees]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
