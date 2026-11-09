import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { BACKUP_VERSION, DATA_COLLECTIONS, EJSON, audit, backupFilename, fileResponse, requireAdmin } from '@/lib/backup'

// GET /api/backup/data — full data backup (no users / passwords). Admin only.
export async function GET(req: NextRequest) {
  await connectDB()
  const guard = await requireAdmin(req)
  if ('response' in guard) return guard.response
  const { actor } = guard

  try {
    const db = mongoose.connection.db!
    const collections: Record<string, unknown[]> = {}
    const counts: Record<string, number> = {}

    for (const name of DATA_COLLECTIONS) {
      collections[name] = await db.collection(name).find({}).toArray()
      counts[name] = collections[name].length
    }

    const createdAt = new Date()
    const body = EJSON.stringify(
      {
        meta: {
          type: 'data',
          version: BACKUP_VERSION,
          app: 'outreach',
          createdAt,
          createdBy: { name: actor.name, email: actor.email },
          counts,
          note: 'Users are not included. Use the users backup to back up accounts.',
        },
        collections,
      },
      { relaxed: true }
    )

    const filename = backupFilename('data', createdAt)
    await audit(actor, 'backup.data.download', 'success', { filename, counts, bytes: body.length })
    return fileResponse(body, filename)
  } catch (error: any) {
    console.error('[GET /api/backup/data]', error)
    await audit(actor, 'backup.data.download', 'failure', { error: String(error?.message || error) })
    return NextResponse.json({ message: 'معرفناش نعمل النسخة الاحتياطية' }, { status: 500 })
  }
}
