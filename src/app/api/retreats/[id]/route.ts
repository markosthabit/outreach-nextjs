import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Retreat } from '@/models/retreat.model'

// GET /api/retreats/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const { id } = await params

    const retreat = await Retreat.findById(id)
      .populate('attendees', 'name phone church')
      .populate('notes', 'content createdAt')

    if (!retreat) {
      return NextResponse.json({ message: 'Retreat not found' }, { status: 404 })
    }

    return NextResponse.json({ retreat })
  } catch (error) {
    console.error('[GET /retreats/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/retreats/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const { id } = await params
    const body = await req.json()

    // If either date is being updated, validate the range
    if (body.startDate || body.endDate) {
      const existing = await Retreat.findById(id)

      if (!existing) {
        return NextResponse.json({ message: 'Retreat not found' }, { status: 404 })
      }

      const startDate = new Date(body.startDate ?? existing.startDate)
      const endDate = new Date(body.endDate ?? existing.endDate)

      if (startDate > endDate) {
        return NextResponse.json(
          { message: 'startDate cannot be after endDate' },
          { status: 400 }
        )
      }
    }

    const retreat = await Retreat.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    })

    if (!retreat) {
      return NextResponse.json({ message: 'Retreat not found' }, { status: 404 })
    }

    return NextResponse.json({ retreat })
  } catch (error) {
    console.error('[PATCH /retreats/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/retreats/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const { id } = await params

    const retreat = await Retreat.findByIdAndDelete(id)

    if (!retreat) {
      return NextResponse.json({ message: 'Retreat not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Retreat deleted successfully' })
  } catch (error) {
    console.error('[DELETE /retreats/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}