import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { OutreachCycle } from '@/models/outreach-cycle.model'
import { OutreachRound } from '@/models/outreach-round.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId, jsonError } from '@/lib/api-utils'

// GET /api/outreach/cycles
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return jsonError('لازم تسجل دخول الأول', 401)

    const allCycles = await OutreachCycle.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    const activeCycle = allCycles.find((c: any) => c.status === 'active') || null

    return NextResponse.json({ activeCycle, cycles: allCycles })
  } catch (error) {
    console.error('[GET /api/outreach/cycles]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}

// POST /api/outreach/cycles - Start a new cycle (Admin only)
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser || authUser.role !== 'Admin') return jsonError('مش مسموحلك تعمل كده', 403)

    const { name } = await req.json()
    if (!name || typeof name !== 'string' || !name.trim()) {
      return jsonError('اكتب اسم الدورة', 400)
    }

    // Close any previously active cycle together with its rounds
    const previous = await OutreachCycle.find({ status: 'active' }).select('_id').lean()
    if (previous.length > 0) {
      const ids = previous.map((c: any) => c._id)
      const now = new Date()
      await OutreachCycle.updateMany({ _id: { $in: ids } }, { $set: { status: 'completed', endedAt: now } })
      await OutreachRound.updateMany({ cycleId: { $in: ids }, status: 'active' }, { $set: { status: 'completed' } })
    }

    const newCycle = await OutreachCycle.create({
      name: name.trim(),
      status: 'active',
      startedAt: new Date(),
      createdBy: authUser.sub,
    })

    return NextResponse.json({ cycle: newCycle }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/outreach/cycles]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}

// PATCH /api/outreach/cycles - End an active cycle (Admin only)
export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser || authUser.role !== 'Admin') return jsonError('مش مسموحلك تعمل كده', 403)

    const { cycleId, action } = await req.json()
    if (!isValidObjectId(cycleId)) return jsonError('معرّف الدورة غلط', 400)
    if (action !== 'end') return jsonError('العملية دي مش مفهومة', 400)

    const updated = await OutreachCycle.findByIdAndUpdate(
      cycleId,
      { status: 'completed', endedAt: new Date() },
      { new: true }
    )
    if (!updated) return jsonError('الدورة مش موجودة', 404)

    // Rounds of a closed cycle are closed too
    await OutreachRound.updateMany({ cycleId, status: 'active' }, { $set: { status: 'completed' } })

    return NextResponse.json({ cycle: updated })
  } catch (error) {
    console.error('[PATCH /api/outreach/cycles]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}
