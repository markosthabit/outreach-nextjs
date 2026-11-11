import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId } from '@/lib/api-utils'
import { Retreat } from '@/models/retreat.model'

// GET /api/retreats/servantee/:servanteeId
// Summary only (name, place, dates) — not every attendee and note of each retreat.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ servanteeId: string }> }
) {
  try {
    await connectDB()

    const { servanteeId } = await params

    if (!(await getAuthUser(req))) {
      return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })
    }
    if (!isValidObjectId(servanteeId)) {
      return NextResponse.json({ message: 'المعرّف غلط' }, { status: 400 })
    }

    const retreats = await Retreat.find({ attendees: servanteeId })
      .sort({ startDate: -1, createdAt: -1 })
      .select('name location startDate endDate')
      .lean()

    return NextResponse.json({ retreats })
  } catch (error) {
    console.error('[GET /retreats/servantee/:servanteeId]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}