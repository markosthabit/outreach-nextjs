import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Retreat } from '@/models/retreat.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { readJson } from '@/lib/api-utils'
import { parseRetreatInput } from '@/lib/retreat-input'
import '@/models/user.model'

// GET /api/retreats
// ?view=light — for lists: attendees stay as plain ids (no name/phone/church per
// attendee of every retreat) and notes are left out. Open one retreat via
// /api/retreats/:id to get its full details.
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    if (!(await getAuthUser(req))) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })

    if (new URL(req.url).searchParams.get('view') === 'light') {
      const retreats = await Retreat.find()
        .sort({ startDate: -1, createdAt: -1 })
        .select('-notes')
        .populate({ path: 'servants', select: 'name email role', strictPopulate: false })
        .lean()
      return NextResponse.json({ retreats })
    }

    const retreats = await Retreat.find()
      .sort({ startDate: -1, createdAt: -1 })
      .populate('attendees', 'name phone church')
      .populate({ path: 'servants', select: 'name email role', strictPopulate: false })
      .populate('notes', 'content createdAt')

    return NextResponse.json({ retreats })
  } catch (error) {
    console.error('[GET /retreats]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}

// POST /api/retreats
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    if (!(await getAuthUser(req))) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })

    // Only whitelisted fields; attendees/servants are managed via PATCH add/remove ops
    const parsed = parseRetreatInput(await readJson(req), { partial: false })
    if (parsed.error !== undefined) return NextResponse.json({ message: parsed.error }, { status: 400 })

    if (parsed.data.startDate! > parsed.data.endDate!) {
      return NextResponse.json({ message: 'تاريخ البداية لازم يبقى قبل تاريخ النهاية' }, { status: 400 })
    }

    const retreat = await Retreat.create(parsed.data)
    return NextResponse.json({ retreat }, { status: 201 })
  } catch (error) {
    console.error('[POST /retreats]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}
