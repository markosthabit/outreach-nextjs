import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId } from '@/lib/api-utils'
import { Note } from '@/models/note.model'

// GET /api/notes/retreats/:retreatId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ retreatId: string }> }
) {
  try {
    await connectDB()

    const { retreatId } = await params

    if (!(await getAuthUser(req))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
    if (!isValidObjectId(retreatId)) {
      return NextResponse.json({ message: 'Invalid id' }, { status: 400 })
    }

    const notes = await Note.find({ retreatId })
      .populate('retreatId', 'name location')

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('[GET /notes/retreats/:retreatId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}