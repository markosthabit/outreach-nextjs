import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { Retreat } from '@/models/retreat.model'
import { Note } from '@/models/note.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { UserRole } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId, readJson } from '@/lib/api-utils'
import { parseServanteeInput } from '@/lib/servantee-input'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/servantees/:id
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'Invalid servantee id' }, { status: 400 })

    const servantee = await Servantee.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean<any>()

    if (!servantee) {
      return NextResponse.json({ message: 'Servantee not found' }, { status: 404 })
    }

    servantee.retreats = await Retreat.find({ attendees: id })
      .sort({ startDate: -1, createdAt: -1 })
      .select('name location startDate endDate')
      .lean()

    return NextResponse.json({ servantee })
  } catch (error) {
    console.error('[GET /servantees/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/servantees/:id — any signed-in servant can edit servantee details
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'Invalid servantee id' }, { status: 400 })

    // Whitelisted fields only — a client can no longer overwrite createdBy, _id, etc.
    const parsed = parseServanteeInput(await readJson(req), { partial: true })
    if (parsed.error !== undefined) return NextResponse.json({ message: parsed.error }, { status: 400 })

    if (parsed.data.phone) {
      const existing = await Servantee.exists({ phone: parsed.data.phone, _id: { $ne: id } })
      if (existing) {
        return NextResponse.json({ message: 'A servantee with this phone number already exists' }, { status: 409 })
      }
    }

    const servantee = await Servantee.findByIdAndUpdate(
      id,
      { $set: { ...parsed.data, updatedBy: authUser.sub } },
      { new: true, runValidators: true }
    )
    if (!servantee) return NextResponse.json({ message: 'Servantee not found' }, { status: 404 })

    return NextResponse.json({ servantee })
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ message: 'A servantee with this phone number already exists' }, { status: 409 })
    }
    console.error('[PATCH /servantees/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/servantees/:id — Admin only
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()

    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (authUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ message: 'Only admins can delete servantees' }, { status: 403 })
    }

    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'Invalid servantee id' }, { status: 400 })

    const servantee = await Servantee.findByIdAndDelete(id)
    if (!servantee) return NextResponse.json({ message: 'Servantee not found' }, { status: 404 })

    // Remove everything that points at the deleted servantee
    const [assignments] = await Promise.all([
      OutreachAssignment.deleteMany({ servanteeId: servantee._id }),
      Retreat.updateMany({ attendees: servantee._id }, { $pull: { attendees: servantee._id } }),
      Note.deleteMany({ servanteeId: servantee._id }),
    ])

    return NextResponse.json({
      message: 'Servantee deleted successfully',
      removedOutreachAssignments: assignments.deletedCount,
    })
  } catch (error) {
    console.error('[DELETE /servantees/:id]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
