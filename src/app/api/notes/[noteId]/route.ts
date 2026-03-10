import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Note } from '@/models/note.model'

// GET /api/notes/:noteId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    await connectDB()

    const { noteId } = await params

    const note = await Note.findById(noteId)
      .populate('servanteeId', 'name phone')
      .populate('retreatId', 'name location')

    if (!note) {
      return NextResponse.json({ message: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ note })
  } catch (error) {
    console.error('[GET /notes/:noteId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/notes/:noteId
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    await connectDB()

    const { noteId } = await params
    const body = await req.json()

    // If the update is trying to change associations, re-validate
    if (body.servanteeId !== undefined || body.retreatId !== undefined) {
      const existing = await Note.findById(noteId)

      if (!existing) {
        return NextResponse.json({ message: 'Note not found' }, { status: 404 })
      }

      const servanteeId = body.servanteeId ?? existing.servanteeId
      const retreatId = body.retreatId ?? existing.retreatId

      if (!servanteeId && !retreatId) {
        return NextResponse.json(
          { message: 'A note must be associated with a servantee or a retreat.' },
          { status: 400 }
        )
      }

      if (servanteeId && retreatId) {
        return NextResponse.json(
          { message: 'A note cannot be associated with both a servantee and a retreat.' },
          { status: 400 }
        )
      }
    }

    const note = await Note.findByIdAndUpdate(noteId, body, {
      new: true,
      runValidators: true,
    })

    if (!note) {
      return NextResponse.json({ message: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ note })
  } catch (error) {
    console.error('[PATCH /notes/:noteId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/notes/:noteId
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    await connectDB()

    const { noteId } = await params

    const note = await Note.findByIdAndDelete(noteId)

    if (!note) {
      return NextResponse.json({ message: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Note deleted successfully' })
  } catch (error) {
    console.error('[DELETE /notes/:noteId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}