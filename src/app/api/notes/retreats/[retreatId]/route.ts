import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Note } from '@/models/note.model'

// GET /api/notes/retreats/:retreatId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ retreatId: string }> }
) {
  try {
    await connectDB()

    const { retreatId } = await params

    const notes = await Note.find({ retreatId })
      .populate('retreatId', 'name location')

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('[GET /notes/retreats/:retreatId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}