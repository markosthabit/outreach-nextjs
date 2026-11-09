import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId, jsonError } from '@/lib/outreach-api'

const MAX_NOTE_LENGTH = 2000

// PATCH /api/outreach/assignments/[id]/toggle
// Body: { isCalled?: boolean, notes?: string } — at least one is required.
// Only the fields sent are changed (sending just `notes` never flips the call state).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return jsonError('Unauthorized', 401)

    const { id } = await params
    if (!isValidObjectId(id)) return jsonError('معرّف التكليف غير صالح', 400)

    const { isCalled, notes } = await req.json()
    const hasIsCalled = typeof isCalled === 'boolean'
    const hasNotes = typeof notes === 'string'
    if (!hasIsCalled && !hasNotes) return jsonError('لا توجد بيانات للتحديث', 400)
    if (hasNotes && notes.length > MAX_NOTE_LENGTH) {
      return jsonError(`الملاحظة طويلة جداً (الحد الأقصى ${MAX_NOTE_LENGTH} حرف)`, 400)
    }

    const assignment = await OutreachAssignment.findById(id)
    if (!assignment) return jsonError('التكليف غير موجود', 404)

    // Either an Admin or the assigned Servant
    if (authUser.role !== 'Admin' && assignment.servantId.toString() !== authUser.sub) {
      return jsonError('غير مصرح لك بتعديل هذا التكليف', 403)
    }

    if (hasIsCalled && isCalled !== assignment.isCalled) {
      assignment.isCalled = isCalled
      assignment.calledAt = isCalled ? new Date() : null
      assignment.calledBy = isCalled ? (authUser.sub as any) : null
    }

    if (hasNotes) assignment.notes = notes.trim()

    await assignment.save()

    const populated = await OutreachAssignment.findById(assignment._id)
      .populate('servanteeId', 'name phone church diocese education year birthDate notes')
      .populate('servantId', 'name email')
      .populate('calledBy', 'name email')
      .lean()

    return NextResponse.json({ assignment: populated })
  } catch (error) {
    console.error('[PATCH /api/outreach/assignments/[id]/toggle]', error)
    return jsonError('حدث خطأ في الخادم', 500)
  }
}
