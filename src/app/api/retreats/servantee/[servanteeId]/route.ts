import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Retreat } from '@/models/retreat.model'

// GET /api/retreats/servantee/:servanteeId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ servanteeId: string }> }
) {
  try {
    await connectDB()

    const { servanteeId } = await params

    const retreats = await Retreat.find({ attendees: servanteeId })
      .populate('attendees', 'name phone church')
      .populate('notes', 'content createdAt')

    return NextResponse.json({ retreats })
  } catch (error) {
    console.error('[GET /retreats/servantee/:servanteeId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}