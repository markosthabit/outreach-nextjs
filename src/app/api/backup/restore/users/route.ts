import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { UserRole } from '@/models/user.model'
import { audit, isObjectId, readBackupBody, requireAdmin } from '@/lib/backup'

const MAX_ERRORS = 20
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/
const ROLES = Object.values(UserRole) as string[]

type UserRow = { _id: any; name: string; email: string; role: string; password: string }

function validate(payload: any): { errors: string[]; users: UserRow[] } {
  const errors: string[] = []
  if (!payload || typeof payload !== 'object') return { errors: ['الملف فاضي أو بايظ'], users: [] }
  if (payload.meta?.type !== 'users') {
    return {
      errors: [
        payload.meta?.type === 'data'
          ? 'ده ملف نسخة البيانات. استخدم "رجّع البيانات" بداله.'
          : 'ده مش ملف نسخة مستخدمين سليم',
      ],
      users: [],
    }
  }
  if (!Array.isArray(payload.users) || payload.users.length === 0) {
    return { errors: ['الملف مفيهوش مستخدمين'], users: [] }
  }

  const users: UserRow[] = []
  const ids = new Set<string>()
  const emails = new Set<string>()

  payload.users.forEach((u: any, i: number) => {
    if (errors.length >= MAX_ERRORS) return
    const label = `المستخدم رقم ${i + 1}${typeof u?.email === 'string' ? ` (${u.email})` : ''}`
    const email = typeof u?.email === 'string' ? u.email.trim().toLowerCase() : ''

    if (!u || typeof u !== 'object' || !isObjectId(u._id)) return void errors.push(`${label}: المعرّف غلط`)
    if (typeof u.name !== 'string' || !u.name.trim()) return void errors.push(`${label}: الاسم ناقص`)
    if (!EMAIL_RE.test(email)) return void errors.push(`${label}: الإيميل غلط`)
    if (!ROLES.includes(u.role)) return void errors.push(`${label}: الصلاحية غلط`)
    // Only bcrypt hashes are accepted — a plain-text password would let anyone log in with it
    if (typeof u.password !== 'string' || !BCRYPT_RE.test(u.password)) {
      return void errors.push(`${label}: كلمة السر مش متشفرة بصيغة bcrypt`)
    }
    if (ids.has(u._id.toHexString())) return void errors.push(`${label}: المعرّف متكرر في الملف`)
    if (emails.has(email)) return void errors.push(`${label}: الإيميل متكرر في الملف`)

    ids.add(u._id.toHexString())
    emails.add(email)
    users.push({ _id: u._id, name: u.name.trim(), email, role: u.role, password: u.password })
  })

  return { errors: errors.slice(0, MAX_ERRORS), users }
}

/**
 * POST /api/backup/restore/users — MERGES users from the file. Admin only.
 * Users in the file are created or overwritten (name, email, role, password hash);
 * users not in the file are left untouched. Restored users are signed out.
 */
export async function POST(req: NextRequest) {
  await connectDB()
  const guard = await requireAdmin(req)
  if ('response' in guard) return guard.response
  const { actor } = guard

  const parsed = await readBackupBody(req)
  if ('error' in parsed) {
    await audit(actor, 'restore.users', 'failure', { error: parsed.error })
    return NextResponse.json({ message: parsed.error }, { status: 400 })
  }

  const { errors, users } = validate(parsed.data)
  const source = {
    backupCreatedAt: parsed.data?.meta?.createdAt ?? null,
    backupCreatedBy: parsed.data?.meta?.createdBy?.email ?? null,
  }
  if (errors.length) {
    await audit(actor, 'restore.users', 'failure', { ...source, errors })
    return NextResponse.json({ message: 'الملف ده مينفعش يترجع', errors }, { status: 400 })
  }

  // Never let a restore take away the acting admin's own access
  const self = users.find((u) => u._id.toHexString() === actor.id)
  if (self && self.role !== UserRole.ADMIN) {
    const msg = 'الملف ده هيحوّل حسابك لخادم وهتخسر صلاحيات المسؤول، فلغينا الاسترجاع.'
    await audit(actor, 'restore.users', 'failure', { ...source, error: msg })
    return NextResponse.json({ message: msg }, { status: 400 })
  }

  const col = mongoose.connection.db!.collection('users')

  // Email collisions with a *different* existing account would break the unique index
  const conflicts = await col
    .find({ email: { $in: users.map((u) => u.email) } }, { projection: { _id: 1, email: 1 } })
    .toArray()
  const conflictErrors = conflicts
    .filter((c) => !users.some((u) => u.email === c.email && u._id.equals(c._id)))
    .map((c) => `الإيميل ${c.email} متسجل بالفعل على حساب تاني`)
  if (conflictErrors.length) {
    await audit(actor, 'restore.users', 'failure', { ...source, errors: conflictErrors })
    return NextResponse.json(
      { message: 'فيه إيميلات متعارضة', errors: conflictErrors.slice(0, MAX_ERRORS) },
      { status: 409 }
    )
  }

  const session = mongoose.connection.getClient().startSession()
  let created = 0
  let updated = 0
  try {
    await session.withTransaction(async () => {
      created = 0
      updated = 0
      const now = new Date()
      for (const u of users) {
        const isSelf = u._id.toHexString() === actor.id
        const res = await col.updateOne(
          { _id: u._id },
          {
            $set: { name: u.name, email: u.email, role: u.role, password: u.password, updatedAt: now },
            $setOnInsert: { createdAt: now },
            // Sign restored users out (their old sessions belong to the old password) — except yourself
            ...(isSelf ? {} : { $unset: { refreshTokenHash: '' } }),
          },
          { upsert: true, session }
        )
        if (res.upsertedCount) created++
        else updated++
      }

      if ((await col.countDocuments({ role: UserRole.ADMIN }, { session })) === 0) {
        throw new Error('NO_ADMIN_LEFT')
      }
    })

    await audit(actor, 'restore.users', 'success', { ...source, created, updated, total: users.length })
    return NextResponse.json({ message: 'المستخدمين رجعوا تمام', created, updated })
  } catch (error: any) {
    console.error('[POST /api/backup/restore/users]', error)
    const message =
      error?.message === 'NO_ADMIN_LEFT'
        ? 'الاسترجاع كان هيسيب السيستم من غير ولا مسؤول، فمفيش أي حاجة اتغيرت.'
        : 'استرجاع المستخدمين فشل ومفيش أي بيانات اتغيرت.'
    await audit(actor, 'restore.users', 'failure', { ...source, error: String(error?.message || error).slice(0, 500) })
    return NextResponse.json({ message }, { status: 500 })
  } finally {
    await session.endSession()
  }
}
