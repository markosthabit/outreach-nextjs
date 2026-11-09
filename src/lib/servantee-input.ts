import { optionalString } from './api-utils'

const FIELD_LABELS = { church: 'الكنيسة', diocese: 'الإيبارشية', education: 'الكلية', year: 'الفرقة' } as const

export type ServanteeInput = {
  name?: string
  phone?: string
  church?: string | null
  diocese?: string | null
  education?: string | null
  year?: string | null
  birthDate?: Date | null
  isActive?: boolean
}

/** Excel stores dates as serial day numbers counted from 1899-12-30. */
function excelSerialToDate(n: number) {
  return new Date(Math.round((n - 25569) * 86400 * 1000))
}

function parseBirthDate(value: unknown): Date | null | undefined | false {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  let d: Date
  if (typeof value === 'number') d = value > 0 && value < 100000 ? excelSerialToDate(value) : new Date(NaN)
  else if (typeof value === 'string') d = new Date(value.trim())
  else return false
  if (Number.isNaN(d.getTime())) return false
  const year = d.getFullYear()
  return year >= 1900 && year <= new Date().getFullYear() ? d : false
}

/**
 * Validate and whitelist servantee fields from an untrusted body.
 * `partial` = true for PATCH (missing fields are left untouched).
 * Returns either { data } or { error } — never passes unknown keys through.
 */
export function parseServanteeInput(
  body: any,
  { partial }: { partial: boolean }
): { data: ServanteeInput; error?: undefined } | { error: string; data?: undefined } {
  if (!body || typeof body !== 'object') return { error: 'البيانات اللي اتبعتت غلط' }
  const data: ServanteeInput = {}

  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 150) return { error: 'اكتب الاسم' }
    data.name = name
  }

  if (body.phone !== undefined || !partial) {
    // Accept numbers too (spreadsheets often store phones as numbers)
    const phone =
      typeof body.phone === 'number' ? String(body.phone) : typeof body.phone === 'string' ? body.phone.trim() : ''
    // "/" is allowed: some records hold two numbers, e.g. "01200062480 / 01029033026"
    if (!phone || phone.length > 60 || !/^[\d\s+()/-]+$/.test(phone)) return { error: 'رقم التليفون غلط' }
    data.phone = phone
  }

  for (const key of ['church', 'diocese', 'education', 'year'] as const) {
    const raw = typeof body[key] === 'number' ? String(body[key]) : body[key]
    const v = optionalString(raw, 200)
    if (v === false) return { error: `قيمة ${FIELD_LABELS[key]} غلط` }
    if (v !== undefined) data[key] = v
  }

  const birthDate = parseBirthDate(body.birthDate)
  if (birthDate === false) return { error: 'تاريخ الميلاد غلط' }
  if (birthDate !== undefined) data.birthDate = birthDate

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') return { error: 'قيمة الحالة غلط' }
    data.isActive = body.isActive
  }

  return { data }
}
