import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { BACKUP_VERSION, EJSON, audit, backupFilename, fileResponse, requireAdmin } from '@/lib/backup'

// GET /api/backup/users — user accounts incl. bcrypt password hashes. Admin only.
// Session data (refreshTokenHash) is never exported.
export async function GET(req: NextRequest) {
  await connectDB()
  const guard = await requireAdmin(req)
  if ('response' in guard) return guard.response
  const { actor } = guard

  try {
    const users = await mongoose.connection
      .db!.collection('users')
      .find({}, { projection: { name: 1, email: 1, role: 1, password: 1, createdAt: 1, updatedAt: 1 } })
      .toArray()

    const createdAt = new Date()
    const body = EJSON.stringify(
      {
        meta: {
          type: 'users',
          version: BACKUP_VERSION,
          app: 'outreach',
          createdAt,
          createdBy: { name: actor.name, email: actor.email },
          counts: { users: users.length },
          warning: 'Contains password hashes. Store this file securely and never share it.',
        },
        users,
      },
      { relaxed: true }
    )

    const filename = backupFilename('users', createdAt)
    await audit(actor, 'backup.users.download', 'success', { filename, users: users.length })
    return fileResponse(body, filename)
  } catch (error: any) {
    console.error('[GET /api/backup/users]', error)
    await audit(actor, 'backup.users.download', 'failure', { error: String(error?.message || error) })
    return NextResponse.json({ message: 'معرفناش نصدّر بيانات المستخدمين' }, { status: 500 })
  }
}
