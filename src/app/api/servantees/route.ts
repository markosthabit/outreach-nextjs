import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/servantees
export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const servantees = await Servantee.find()
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean()

    const { Retreat } = await import('@/models/retreat.model')
    const allRetreats = await Retreat.find().select('name location startDate endDate attendees').lean()

    const servanteesWithRetreats = servantees.map((s: any) => {
      const sId = s._id.toString()
      const attended = allRetreats.filter((r: any) => 
        r.attendees && r.attendees.some((a: any) => a.toString() === sId)
      )
      return { ...s, retreats: attended }
    })

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
    const body = await req.json()

    const { phone, name } = body

    if (!phone || !name) {
      return NextResponse.json(
        { message: 'Phone and name are required' },
        { status: 400 }
      )
    }

    const existing = await Servantee.findOne({ phone })

    if (existing) {
      return NextResponse.json(
        { message: 'A servantee with this phone number already exists' },
        { status: 409 }
      )
    }

    const servantee = await Servantee.create({
      ...body,
      createdBy: authUser?.sub,
      updatedBy: authUser?.sub,
    })

    return NextResponse.json({ servantee }, { status: 201 })
  } catch (error) {
    console.error('[POST /servantees]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}