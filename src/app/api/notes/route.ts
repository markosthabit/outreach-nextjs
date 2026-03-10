import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Note } from '@/models/note.model'

// POST /api/notes
export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const { content, servanteeId, retreatId } = body

    if (!content) {
      return NextResponse.json(
        { message: 'Content is required' },
        { status: 400 }
      )
    }

    // Validation we moved from the pre-save hook
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

    const note = await Note.create(body)

    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    console.error('[POST /notes]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}