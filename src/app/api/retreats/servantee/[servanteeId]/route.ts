import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId } from '@/lib/api-utils'
import { Retreat } from '@/models/retreat.model'

// GET /api/retreats/servantee/:servanteeId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ servanteeId: string }> }
) {
  try {
    await connectDB()

    const { servanteeId } = await params

    if (!(await getAuthUser(req))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
    if (!isValidObjectId(servanteeId)) {
      return NextResponse.json({ message: 'Invalid id' }, { status: 400 })
    }

    const retreats = await Retreat.find({ attendees: servanteeId })
      .sort({ startDate: -1, createdAt: -1 })
      .populate('attendees', 'name phone church')
      .populate('notes', 'content createdAt')

    return NextResponse.json({ retreats })
  } catch (error) {
    console.error('[GET /retreats/servantee/:servanteeId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}