import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Note } from '@/models/note.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isNonEmptyString, isValidObjectId, readJson } from '@/lib/api-utils'

const MAX_NOTE_LENGTH = 5000 // keep in sync with src/app/api/notes/route.ts

type Ctx = { params: Promise<{ noteId: string }> }

async function guard(req: NextRequest, params: Ctx['params']) {
  await connectDB()
  if (!(await getAuthUser(req))) return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) }
  const { noteId } = await params
  if (!isValidObjectId(noteId)) return { error: NextResponse.json({ message: 'Invalid note id' }, { status: 400 }) }
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
    if (!note) return NextResponse.json({ message: 'Note not found' }, { status: 404 })

    return NextResponse.json({ note })
  } catch (error) {
    console.error('[GET /notes/:noteId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/notes/:noteId — only the content can be edited (moving a note between records isn't a UI feature)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, params)
    if (g.error) return g.error

    const body = await readJson(req)
    if (!isNonEmptyString(body?.content, MAX_NOTE_LENGTH)) {
      return NextResponse.json({ message: 'Content is required' }, { status: 400 })
    }

    const note = await Note.findByIdAndUpdate(
      g.noteId,
      { $set: { content: body.content.trim() } },
      { new: true, runValidators: true }
    )
    if (!note) return NextResponse.json({ message: 'Note not found' }, { status: 404 })

    return NextResponse.json({ note })
  } catch (error) {
    console.error('[PATCH /notes/:noteId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/notes/:noteId
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard(req, params)
    if (g.error) return g.error

    const note = await Note.findByIdAndDelete(g.noteId)
    if (!note) return NextResponse.json({ message: 'Note not found' }, { status: 404 })

    return NextResponse.json({ message: 'Note deleted successfully' })
  } catch (error) {
    console.error('[DELETE /notes/:noteId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
