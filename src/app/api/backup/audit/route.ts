import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AuditLog } from '@/models/audit-log.model'
import { requireAdmin } from '@/lib/backup'

// GET /api/backup/audit?limit=100 — most recent backup/restore events. Admin only.
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const guard = await requireAdmin(req)
    if ('response' in guard) return guard.response

    const requested = Number(new URL(req.url).searchParams.get('limit'))
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 500) : 100

    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean()
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[GET /api/backup/audit]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}
