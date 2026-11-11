import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Note } from '@/models/note.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { UserRole } from '@/models/user.model'
import { isNonEmptyString, isValidObjectId, readJson } from '@/lib/api-utils'

const MAX_NOTE_LENGTH = 5000 // keep in sync with src/app/api/notes/route.ts

type Ctx = { params: Promise<{ noteId: string }> }

async function guard(req: NextRequest, params: Ctx['params'], adminOnly = false) {
  await connectDB()
  const authUser = await getAuthUser(req)
  if (!authUser) return { error: NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 }) }
  if (adminOnly && authUser.role !== UserRole.ADMIN) {
    return { error: NextResponse.json({ message: 'المسؤولين بس اللي يقدروا يمسحوا' }, { status: 403 }) }
  }
  const { noteId } = await params
  if (!isValidObjectId(noteId)) return { error: NextResponse.json({ message: 'معرّف الملاحظة غلط' }, { status: 400 }) }
  return { noteId }
}

// GET /api/notes/:noteId
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, params)
    if (g.error) return g.error

    const note = await Note.findById(g.noteId)
      .populate('servanteeId', 'name phone')
      .populate('retreatId', 'name location')
    if (!note) return NextResponse.json({ message: 'الملاحظة مش موجودة' }, { status: 404 })

    return NextResponse.json({ note })
  } catch (error) {
    console.error('[GET /notes/:noteId]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}

// PATCH /api/notes/:noteId — only the content can be edited (moving a note between records isn't a UI feature)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, params)
    if (g.error) return g.error

    const body = await readJson(req)
    if (!isNonEmptyString(body?.content, MAX_NOTE_LENGTH)) {
      return NextResponse.json({ message: 'اكتب الملاحظة الأول' }, { status: 400 })
    }

    const note = await Note.findByIdAndUpdate(
      g.noteId,
      { $set: { content: body.content.trim() } },
      { new: true, runValidators: true }
    )
    if (!note) return NextResponse.json({ message: 'الملاحظة مش موجودة' }, { status: 404 })

    return NextResponse.json({ note })
  } catch (error) {
    console.error('[PATCH /notes/:noteId]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}

// DELETE /api/notes/:noteId — Admin only
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, params, true)
    if (g.error) return g.error

    const note = await Note.findByIdAndDelete(g.noteId)
    if (!note) return NextResponse.json({ message: 'الملاحظة مش موجودة' }, { status: 404 })

    return NextResponse.json({ message: 'الملاحظة اتمسحت' })
  } catch (error) {
    console.error('[DELETE /notes/:noteId]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}
