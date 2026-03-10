import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Retreat } from '@/models/retreat.model'

// GET /api/retreats
export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const retreats = await Retreat.find()
      .populate('attendees', 'name phone church')
      .populate('notes', 'content createdAt')

    return NextResponse.json({ retreats })
  } catch (error) {
    console.error('[GET /retreats]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/retreats
export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const { name, location, startDate, endDate } = body

    if (!name || !location || !startDate || !endDate) {
      return NextResponse.json(
        { message: 'Name, location, startDate and endDate are required' },
        { status: 400 }
      )
    }

    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { message: 'startDate cannot be after endDate' },
        { status: 400 }
      )
    }

    const retreat = await Retreat.create(body)

    return NextResponse.json({ retreat }, { status: 201 })
  } catch (error) {
    console.error('[POST /retreats]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}