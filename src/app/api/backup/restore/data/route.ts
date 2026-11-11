import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { DATA_COLLECTIONS, audit, isObjectId, readBackupBody, requireAdmin } from '@/lib/backup'
import { invalidateServanteeListCache } from '@/lib/servantee-list-cache'

const MAX_ERRORS = 20

/** Structural checks so a wrong or tampered file is rejected before anything is deleted. */
function validate(payload: any): { errors: string[]; collections: Record<string, any[]> } {
  const errors: string[] = []
  const collections: Record<string, any[]> = {}

  if (!payload || typeof payload !== 'object') return { errors: ['الملف فاضي أو بايظ'], collections }
  if (payload.meta?.type !== 'data') {
    return {
      errors: [
        payload.meta?.type === 'users'
          ? 'ده ملف نسخة المستخدمين. استخدم "رجّع المستخدمين" بداله.'
          : 'ده مش ملف نسخة بيانات سليم',
      ],
      collections,
    }
  }
  if (!payload.collections || typeof payload.collections !== 'object') {
    return { errors: ['الملف مفيهوش بيانات'], collections }
  }

  const unknown = Object.keys(payload.collections).filter((k) => !(DATA_COLLECTIONS as readonly string[]).includes(k))
  if (unknown.length) errors.push(`فيه أجزاء مش معروفة في الملف: ${unknown.join(', ')}`)

  for (const name of DATA_COLLECTIONS) {
    const docs = payload.collections[name]
    if (!Array.isArray(docs)) {
      errors.push(`الجزء ${name} مش موجود في الملف`)
      continue
    }
    const seen = new Set<string>()
    docs.forEach((doc, i) => {
      if (errors.length >= MAX_ERRORS) return
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        errors.push(`${name}[${i}]: سجل بايظ`)
      } else if (!isObjectId(doc._id)) {
        errors.push(`${name}[${i}]: المعرّف (_id) غلط`)
      } else if (seen.has(doc._id.toHexString())) {
        errors.push(`${name}[${i}]: المعرّف ${doc._id.toHexString()} متكرر`)
      } else if (Object.keys(doc).some((k) => k.startsWith('$'))) {
        errors.push(`${name}[${i}]: فيه حقول مش مسموح بيها`)
      } else {
        seen.add(doc._id.toHexString())
      }
    })
    collections[name] = docs
  }

  return { errors: errors.slice(0, MAX_ERRORS), collections }
}

// POST /api/backup/restore/data — REPLACES all data collections with the file's contents. Admin only.
export async function POST(req: NextRequest) {
  await connectDB()
  const guard = await requireAdmin(req)
  if ('response' in guard) return guard.response
  const { actor } = guard

  const parsed = await readBackupBody(req)
  if ('error' in parsed) {
    await audit(actor, 'restore.data', 'failure', { error: parsed.error })
    return NextResponse.json({ message: parsed.error }, { status: 400 })
  }

  const { errors, collections } = validate(parsed.data)
  const source = {
    backupCreatedAt: parsed.data?.meta?.createdAt ?? null,
    backupCreatedBy: parsed.data?.meta?.createdBy?.email ?? null,
  }
  if (errors.length) {
    await audit(actor, 'restore.data', 'failure', { ...source, errors })
    return NextResponse.json({ message: 'الملف ده مينفعش يترجع', errors }, { status: 400 })
  }

  const db = mongoose.connection.db!
  const session = mongoose.connection.getClient().startSession()
  const before: Record<string, number> = {}
  const restored: Record<string, number> = {}

  try {
    // All-or-nothing: if any insert fails (e.g. duplicate phone), every collection is rolled back
    await session.withTransaction(async () => {
      for (const name of DATA_COLLECTIONS) {
        const col = db.collection(name)
        before[name] = await col.countDocuments({}, { session })
        await col.deleteMany({}, { session })
        if (collections[name].length) {
          await col.insertMany(collections[name], { session, ordered: true })
        }
        restored[name] = collections[name].length
      }
    })

    // The restore writes straight to the collections, bypassing Mongoose timestamps
    invalidateServanteeListCache()
    await audit(actor, 'restore.data', 'success', { ...source, before, restored })
    return NextResponse.json({ message: 'البيانات رجعت تمام', before, restored })
  } catch (error: any) {
    console.error('[POST /api/backup/restore/data]', error)
    const message =
      error?.code === 11000
        ? 'الاسترجاع فشل: الملف فيه بيانات متكررة (زي رقم تليفون متكرر). مفيش أي حاجة اتغيرت.'
        : 'الاسترجاع فشل ومفيش أي بيانات اتغيرت.'
    await audit(actor, 'restore.data', 'failure', { ...source, error: String(error?.message || error).slice(0, 500) })
    return NextResponse.json({ message }, { status: 500 })
  } finally {
    await session.endSession()
  }
}
