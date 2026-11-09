import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { UserRole } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { readJson } from '@/lib/api-utils'
import { parseServanteeInput, type ServanteeInput } from '@/lib/servantee-input'

const MAX_ROWS = 5000

// POST /api/servantees/import — Admin only (matches the UI, which only shows import to admins)
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })
    if (authUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ message: 'المسؤولين بس اللي يقدروا يستوردوا مخدومين' }, { status: 403 })
    }

    const body = await readJson(req)
    const rows = body?.servantees
    if (!Array.isArray(rows)) {
      return NextResponse.json({ message: 'شكل البيانات غلط، المفروض تبقى قايمة مخدومين' }, { status: 400 })
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ message: `مينفعش تستورد أكتر من ${MAX_ROWS} صف مرة واحدة` }, { status: 400 })
    }

    const errors: string[] = []
    const valid: { row: number; data: ServanteeInput }[] = []

    rows.forEach((item, i) => {
      const rowNo = i + 2 // +1 for 1-based, +1 for the header row
      const parsed = parseServanteeInput(item, { partial: false })
      if (parsed.error !== undefined) {
        const label = typeof item?.name === 'string' && item.name.trim() ? ` (${item.name.trim()})` : ''
        errors.push(`الصف رقم ${rowNo}${label}: ${parsed.error}`)
      } else {
        valid.push({ row: rowNo, data: parsed.data })
      }
    })

    // One query for all existing phones instead of one per row
    const existingPhones = new Set(
      (await Servantee.find({ phone: { $in: valid.map((v) => v.data.phone) } }).select('phone').lean()).map(
        (s: any) => s.phone
      )
    )

    const seenInFile = new Set<string>()
    const toInsert: any[] = []
    for (const { row, data } of valid) {
      if (existingPhones.has(data.phone)) {
        errors.push(`الصف رقم ${row} (${data.name}): رقم التليفون ${data.phone} متسجل قبل كده`)
      } else if (seenInFile.has(data.phone!)) {
        errors.push(`الصف رقم ${row} (${data.name}): رقم التليفون ${data.phone} متكرر في الملف`)
      } else {
        seenInFile.add(data.phone!)
        toInsert.push({ ...data, createdBy: authUser.sub, updatedBy: authUser.sub })
      }
    }

    let importedCount = 0
    if (toInsert.length > 0) {
      try {
        const inserted = await Servantee.insertMany(toInsert, { ordered: false })
        importedCount = inserted.length
      } catch (err: any) {
        // ordered:false keeps going past duplicates; report what made it in
        importedCount = err?.insertedDocs?.length ?? err?.result?.insertedCount ?? 0
        errors.push(`معرفناش نحفظ ${toInsert.length - importedCount} صف عشان فيه تعارض في البيانات`)
      }
    }

    return NextResponse.json({
      importedCount,
      failedCount: rows.length - importedCount,
      errors,
    })
  } catch (error) {
    console.error('[POST /servantees/import]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}
