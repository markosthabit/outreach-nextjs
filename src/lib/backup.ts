import mongoose from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from './auth-helpers'
import { clientIp } from './rate-limit'
import { User, UserRole } from '@/models/user.model'
import { AuditLog, type AuditAction } from '@/models/audit-log.model'

export const BACKUP_VERSION = 1

/**
 * Collections included in a data backup / replaced by a data restore.
 * `users` is backed up separately (it holds password hashes) and `audit_logs`
 * is never restored, so restoring can't wipe the record of who restored.
 */
export const DATA_COLLECTIONS = [
  'servantees',
  'retreats',
  'notes',
  'outreach_cycles',
  'outreach_rounds',
  'outreach_assignments',
] as const

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const EJSON = mongoose.mongo.BSON.EJSON
export const ObjectId = mongoose.mongo.ObjectId

export type Actor = { id: string; name: string; email: string; ip: string }

/**
 * Backup endpoints are admin-only. The role is re-checked against the database
 * (not just the 15-minute token) because these operations expose or overwrite everything.
 */
export async function requireAdmin(req: NextRequest): Promise<{ actor: Actor } | { response: NextResponse }> {
  const auth = await getAuthUser(req)
  if (!auth?.sub) return { response: NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 }) }

  const user = await User.findById(auth.sub).select('name email role').lean<any>()
  if (!user || user.role !== UserRole.ADMIN) {
    return { response: NextResponse.json({ message: 'العملية دي للمسؤولين بس' }, { status: 403 }) }
  }
  return { actor: { id: String(user._id), name: user.name, email: user.email, ip: clientIp(req) } }
}

export async function audit(
  actor: Actor,
  action: AuditAction,
  status: 'success' | 'failure',
  details: Record<string, unknown> = {}
) {
  try {
    await AuditLog.create({
      action,
      status,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      ip: actor.ip,
      details,
    })
  } catch (err) {
    // Never let audit logging break the operation itself, but make it visible
    console.error('[AUDIT] failed to write audit log', action, err)
  }
}

export function backupFilename(kind: 'data' | 'users', date = new Date()) {
  const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `${kind === 'data' ? 'backup-data' : 'backup-users'}-${stamp}.json`
}

export function fileResponse(body: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** Read and EJSON-parse an uploaded backup, enforcing the size limit. */
export async function readBackupBody(req: NextRequest): Promise<{ data: any } | { error: string }> {
  const declared = Number(req.headers.get('content-length') || 0)
  if (declared > MAX_UPLOAD_BYTES) return { error: 'الملف أكبر من المسموح (50 ميجا)' }

  const text = await req.text()
  if (text.length > MAX_UPLOAD_BYTES) return { error: 'الملف أكبر من المسموح (50 ميجا)' }

  try {
    // relaxed:false keeps ObjectIds and Dates as real BSON types
    return { data: EJSON.parse(text, { relaxed: false }) }
  } catch {
    return { error: 'الملف ده مش نسخة احتياطية سليمة (JSON بايظ)' }
  }
}

export const isObjectId = (v: unknown) => v instanceof ObjectId
