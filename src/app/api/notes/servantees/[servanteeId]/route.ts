import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId } from '@/lib/api-utils'
import { Note } from '@/models/note.model'

// GET /api/notes/servantees/:servanteeId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ servanteeId: string }> }
) {
  try {
    await connectDB()

    const { servanteeId } = await params

    if (!(await getAuthUser(req))) {
      return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })
    }
    if (!isValidObjectId(servanteeId)) {
      return NextResponse.json({ message: 'المعرّف غلط' }, { status: 400 })
    }

    const notes = await Note.find({ servanteeId })
      .populate('servanteeId', 'name phone')

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('[GET /notes/servantees/:servanteeId]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}