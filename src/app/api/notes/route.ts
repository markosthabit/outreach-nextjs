import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Note } from '@/models/note.model'
import { Servantee } from '@/models/servantee.model'
import { Retreat } from '@/models/retreat.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isNonEmptyString, isValidObjectId, readJson } from '@/lib/api-utils'

const MAX_NOTE_LENGTH = 5000 // keep in sync with src/app/api/notes/[noteId]/route.ts

// POST /api/notes
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    if (!(await getAuthUser(req))) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const body = await readJson(req)
    const { content, servanteeId, retreatId } = body ?? {}

    if (!isNonEmptyString(content, MAX_NOTE_LENGTH)) {
      return NextResponse.json({ message: 'Content is required' }, { status: 400 })
    }
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

    const targetId = servanteeId || retreatId
    if (!isValidObjectId(targetId)) return NextResponse.json({ message: 'Invalid id' }, { status: 400 })
    const exists = servanteeId ? await Servantee.exists({ _id: targetId }) : await Retreat.exists({ _id: targetId })
    if (!exists) return NextResponse.json({ message: 'Target not found' }, { status: 404 })

    // Whitelisted fields only
    const note = await Note.create({
      content: content.trim(),
      ...(servanteeId ? { servanteeId } : { retreatId }),
    })

    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    console.error('[POST /notes]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
