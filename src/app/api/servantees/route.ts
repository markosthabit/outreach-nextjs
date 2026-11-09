import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { Retreat } from '@/models/retreat.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { readJson } from '@/lib/api-utils'
import { parseServanteeInput } from '@/lib/servantee-input'

// GET /api/servantees
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const [servantees, allRetreats] = await Promise.all([
      Servantee.find().populate('createdBy', 'name email').populate('updatedBy', 'name email').lean(),
      Retreat.find()
        .sort({ startDate: -1, createdAt: -1 })
        .select('name location startDate endDate attendees')
        .lean(),
    ])

    // Index retreats by attendee once (was O(servantees × retreats × attendees))
    const retreatsByServantee = new Map<string, any[]>()
    for (const r of allRetreats as any[]) {
      const { attendees, ...summary } = r
      for (const a of attendees || []) {
        const key = a.toString()
        if (!retreatsByServantee.has(key)) retreatsByServantee.set(key, [])
        retreatsByServantee.get(key)!.push({ ...summary, attendees })
      }
    }

    const servanteesWithRetreats = servantees.map((s: any) => ({
      ...s,
      retreats: retreatsByServantee.get(s._id.toString()) || [],
    }))

    return NextResponse.json({ servantees: servanteesWithRetreats })
  } catch (error) {
    console.error('[GET /servantees]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/servantees
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const parsed = parseServanteeInput(await readJson(req), { partial: false })
    if (parsed.error !== undefined) return NextResponse.json({ message: parsed.error }, { status: 400 })

    const existing = await Servantee.exists({ phone: parsed.data.phone })
    if (existing) {
      return NextResponse.json({ message: 'A servantee with this phone number already exists' }, { status: 409 })
    }

    const servantee = await Servantee.create({
      ...parsed.data,
      createdBy: authUser.sub,
      updatedBy: authUser.sub,
    })

    return NextResponse.json({ servantee }, { status: 201 })
  } catch (error: any) {
    // Unique index race: two requests with the same phone at once
    if (error?.code === 11000) {
      return NextResponse.json({ message: 'A servantee with this phone number already exists' }, { status: 409 })
    }
    console.error('[POST /servantees]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
