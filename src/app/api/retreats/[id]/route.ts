import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Retreat } from '@/models/retreat.model'
import { Note } from '@/models/note.model'
import { Servantee } from '@/models/servantee.model'
import { User } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId, readJson } from '@/lib/api-utils'
import { parseRetreatInput } from '@/lib/retreat-input'

type Ctx = { params: Promise<{ id: string }> }

function populated(query: any) {
  return query
    .populate('attendees', 'name phone church')
    .populate({ path: 'servants', select: 'name email role', strictPopulate: false })
    .populate('notes', 'content createdAt')
}

/** Validate an optional list of ids from the body; returns null when absent, false when invalid. */
function idList(value: unknown): string[] | null | false {
  if (value === undefined) return null
  const list = Array.isArray(value) ? value : [value]
  if (list.length === 0 || list.length > 500 || !list.every(isValidObjectId)) return false
  return [...new Set(list as string[])]
}

// GET /api/retreats/:id
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()
    if (!(await getAuthUser(req))) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })

    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'معرّف الخلوة غلط' }, { status: 400 })

    const retreat = await populated(Retreat.findById(id))
    if (!retreat) return NextResponse.json({ message: 'الخلوة مش موجودة' }, { status: 404 })

    return NextResponse.json({ retreat })
  } catch (error) {
    console.error('[GET /retreats/:id]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}

/**
 * PATCH /api/retreats/:id
 * Scalar fields: name, location, startDate, endDate, hours, contents, exercises.
 * Membership ops (atomic, so two people editing at once don't overwrite each other):
 *   addAttendees / removeAttendees / addServants / removeServants — an id or array of ids.
 * Full `attendees` / `servants` arrays are ignored: the edit form re-sends stale copies of them.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()
    if (!(await getAuthUser(req))) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })

    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'معرّف الخلوة غلط' }, { status: 400 })

    const body = await readJson(req)
    const parsed = parseRetreatInput(body, { partial: true })
    if (parsed.error !== undefined) return NextResponse.json({ message: parsed.error }, { status: 400 })

    const ops = {
      addAttendees: idList(body.addAttendees),
      removeAttendees: idList(body.removeAttendees),
      addServants: idList(body.addServants),
      removeServants: idList(body.removeServants),
    }
    if (Object.values(ops).some((v) => v === false)) {
      return NextResponse.json({ message: 'فيه معرّفات غلط في القايمة' }, { status: 400 })
    }

    const existing = await Retreat.findById(id).select('startDate endDate').lean<any>()
    if (!existing) return NextResponse.json({ message: 'الخلوة مش موجودة' }, { status: 404 })

    const startDate = parsed.data.startDate ?? existing.startDate
    const endDate = parsed.data.endDate ?? existing.endDate
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ message: 'تاريخ البداية لازم يبقى قبل تاريخ النهاية' }, { status: 400 })
    }

    // Only link documents that actually exist
    if (ops.addAttendees && (await Servantee.countDocuments({ _id: { $in: ops.addAttendees } })) !== ops.addAttendees.length) {
      return NextResponse.json({ message: 'فيه مخدومين مش موجودين' }, { status: 404 })
    }
    if (ops.addServants && (await User.countDocuments({ _id: { $in: ops.addServants } })) !== ops.addServants.length) {
      return NextResponse.json({ message: 'فيه خدام مش موجودين' }, { status: 404 })
    }

    // $addToSet and $pull can't target the same path in one update, so apply adds then removes
    const addUpdate: any = {}
    if (Object.keys(parsed.data).length) addUpdate.$set = parsed.data
    const addToSet: any = {}
    if (ops.addAttendees) addToSet.attendees = { $each: ops.addAttendees }
    if (ops.addServants) addToSet.servants = { $each: ops.addServants }
    if (Object.keys(addToSet).length) addUpdate.$addToSet = addToSet
    if (Object.keys(addUpdate).length) {
      await Retreat.updateOne({ _id: id }, addUpdate, { runValidators: true })
    }

    const pull: any = {}
    if (ops.removeAttendees) pull.attendees = { $in: ops.removeAttendees }
    if (ops.removeServants) pull.servants = { $in: ops.removeServants }
    if (Object.keys(pull).length) await Retreat.updateOne({ _id: id }, { $pull: pull })

    const retreat = await populated(Retreat.findById(id))
    return NextResponse.json({ retreat })
  } catch (error) {
    console.error('[PATCH /retreats/:id]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}

// DELETE /api/retreats/:id
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()
    if (!(await getAuthUser(req))) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })

    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ message: 'معرّف الخلوة غلط' }, { status: 400 })

    const retreat = await Retreat.findByIdAndDelete(id)
    if (!retreat) return NextResponse.json({ message: 'الخلوة مش موجودة' }, { status: 404 })

    // Notes attached to the retreat would otherwise be orphaned
    await Note.deleteMany({ retreatId: retreat._id })

    return NextResponse.json({ message: 'الخلوة اتمسحت' })
  } catch (error) {
    console.error('[DELETE /retreats/:id]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}
