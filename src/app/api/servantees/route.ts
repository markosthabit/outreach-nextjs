import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/servantees
export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const servantees = await Servantee.find()
      .populate('retreats', 'name location startDate endDate')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')

    return NextResponse.json({ servantees })
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