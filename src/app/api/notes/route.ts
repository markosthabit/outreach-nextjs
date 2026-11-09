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
    if (!(await getAuthUser(req))) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })

    const body = await readJson(req)
    const { content, servanteeId, retreatId } = body ?? {}

    if (!isNonEmptyString(content, MAX_NOTE_LENGTH)) {
      return NextResponse.json({ message: 'اكتب الملاحظة الأول' }, { status: 400 })
    }
    if (!servanteeId && !retreatId) {
      return NextResponse.json(
        { message: 'الملاحظة لازم تبقى على مخدوم أو خلوة' },
        { status: 400 }
      )
    }
    if (servanteeId && retreatId) {
      return NextResponse.json(
        { message: 'الملاحظة مينفعش تبقى على مخدوم وخلوة في نفس الوقت' },
        { status: 400 }
      )
    }

    const targetId = servanteeId || retreatId
    if (!isValidObjectId(targetId)) return NextResponse.json({ message: 'المعرّف غلط' }, { status: 400 })
    const exists = servanteeId ? await Servantee.exists({ _id: targetId }) : await Retreat.exists({ _id: targetId })
    if (!exists) return NextResponse.json({ message: 'المكان اللي عايز تضيف عليه الملاحظة مش موجود' }, { status: 404 })

    // Whitelisted fields only
    const note = await Note.create({
      content: content.trim(),
      ...(servanteeId ? { servanteeId } : { retreatId }),
    })

    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    console.error('[POST /notes]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}
