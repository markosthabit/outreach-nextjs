import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Note } from '@/models/note.model'

// GET /api/notes/servantees/:servanteeId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ servanteeId: string }> }
) {
  try {
    await connectDB()

    const { servanteeId } = await params

    const notes = await Note.find({ servanteeId })
      .populate('servanteeId', 'name phone')

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('[GET /notes/servantees/:servanteeId]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}