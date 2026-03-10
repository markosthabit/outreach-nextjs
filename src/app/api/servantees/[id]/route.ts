import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/servantees/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const { id } = await params

    const servantee = await Servantee.findById(id)
      .populate('retreats', 'name location startDate endDate')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')

    if (!servantee) {
      return NextResponse.json({ message: 'Servantee not found' }, { status: 404 })
    }

    return NextResponse.json({ servantee })
  } catch (error) {
    console.error('[GET /servantees/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/servantees/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    const { id } = await params
    const body = await req.json()

    // Prevent phone being changed to one that already exists
    if (body.phone) {
      const existing = await Servantee.findOne({
        phone: body.phone,
        _id: { $ne: id },
      })

      if (existing) {
        return NextResponse.json(
          { message: 'A servantee with this phone number already exists' },
          { status: 409 }
        )
      }
    }

    const servantee = await Servantee.findByIdAndUpdate(
      id,
      { ...body, updatedBy: authUser?.sub },
      { new: true, runValidators: true }
    )

    if (!servantee) {
      return NextResponse.json({ message: 'Servantee not found' }, { status: 404 })
    }

    return NextResponse.json({ servantee })
  } catch (error) {
    console.error('[PATCH /servantees/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/servantees/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const { id } = await params

    const servantee = await Servantee.findByIdAndDelete(id)

    if (!servantee) {
      return NextResponse.json({ message: 'Servantee not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Servantee deleted successfully' })
  } catch (error) {
    console.error('[DELETE /servantees/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}