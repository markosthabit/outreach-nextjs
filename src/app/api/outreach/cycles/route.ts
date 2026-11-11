import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { OutreachCycle } from '@/models/outreach-cycle.model'
import { OutreachRound } from '@/models/outreach-round.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { isValidObjectId, jsonError, parseDate, readJson } from '@/lib/api-utils'

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

// PATCH /api/outreach/cycles (Admin only)
// - { cycleId, action: 'end' }: end an active cycle
// - { cycleId, action: 'update', name?, startedAt?, endedAt? }: edit a cycle's details
//   (endedAt only applies to a finished cycle)
export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser || authUser.role !== 'Admin') return jsonError('مش مسموحلك تعمل كده', 403)

    const body = await readJson(req)
    const { cycleId, action } = body ?? {}
    if (!isValidObjectId(cycleId)) return jsonError('معرّف الدورة غلط', 400)

    if (action === 'update') {
      const { name, startedAt, endedAt } = body
      const cycle = await OutreachCycle.findById(cycleId)
      if (!cycle) return jsonError('الدورة مش موجودة', 404)

      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) return jsonError('اكتب اسم الدورة', 400)
        if (name.trim().length > 200) return jsonError('اسم الدورة طويل أوي', 400)
        cycle.name = name.trim()
      }
      if (startedAt !== undefined) {
        const d = parseDate(startedAt)
        if (!d) return jsonError('تاريخ البداية غلط', 400)
        cycle.startedAt = d
      }
      if (endedAt !== undefined) {
        if (cycle.status !== 'completed') {
          return jsonError('الدورة لسه شغالة، إنهيها الأول عشان يبقى ليها تاريخ نهاية', 400)
        }
        const d = parseDate(endedAt)
        if (!d) return jsonError('تاريخ النهاية غلط', 400)
        cycle.endedAt = d
      }
      if (cycle.endedAt && cycle.startedAt > cycle.endedAt) {
        return jsonError('تاريخ البداية لازم يبقى قبل تاريخ النهاية', 400)
      }

      await cycle.save()
      return NextResponse.json({ cycle })
    }

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
