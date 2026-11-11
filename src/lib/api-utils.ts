import { NextResponse } from 'next/server'
import { Types } from 'mongoose'

/** True when `id` is a well-formed 24-char hex ObjectId string. */
export function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) && Types.ObjectId.isValid(id)
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status })
}

/** Parse a YYYY-MM-DD (or ISO) date string; returns null when invalid. */
export function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `page` / `limit` query params, clamped to sane bounds. */
export function parsePaging(searchParams: URLSearchParams, defaultLimit = 10, maxLimit = 100) {
  const positiveInt = (value: string | null, fallback: number) => {
    const n = Math.floor(Number(value))
    return Number.isFinite(n) && n >= 1 ? n : fallback
  }
  return {
    page: positiveInt(searchParams.get('page'), 1),
    limit: Math.min(maxLimit, positiveInt(searchParams.get('limit'), defaultLimit)),
  }
}

/**
 * The browser's `Date#getTimezoneOffset()` (minutes, UTC − local) sent as `tz`.
 * Falls back to the server's own offset when missing or nonsensical.
 */
export function parseTzOffset(value: string | null): number {
  const n = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? n : new Date().getTimezoneOffset()
}

/** Month (0–11) of `date` as seen in the timezone with the given offset. */
export function monthInZone(date: Date, tzOffsetMinutes: number): number {
  return new Date(date.getTime() - tzOffsetMinutes * 60_000).getUTCMonth()
}

/** Sort comparator by Arabic name, for populated docs that Mongo can't sort server-side. */
export function byArabicName(getName: (x: any) => string | undefined) {
  return (a: any, b: any) => (getName(a) || '').localeCompare(getName(b) || '', 'ar')
}

/**
 * Copy only whitelisted keys from an untrusted request body.
 * Prevents mass-assignment (e.g. a client setting `_id`, `createdBy`, `refreshTokenHash`).
 */
export function pick<K extends string>(body: unknown, keys: readonly K[]): Partial<Record<K, unknown>> {
  const out: Partial<Record<K, unknown>> = {}
  if (!body || typeof body !== 'object') return out
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(body, k)) out[k] = (body as any)[k]
  }
  return out
}

/** Normalise optional string fields: non-strings are rejected, strings are trimmed. */
export function optionalString(value: unknown, maxLength = 500): string | null | undefined | false {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') return false
  const v = value.trim()
  return v.length > maxLength ? false : v
}

export function isNonEmptyString(value: unknown, maxLength = 500): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

/** Read a JSON body; returns null (instead of throwing → 500) when it's malformed. */
export async function readJson(req: Request): Promise<any | null> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' ? body : null
  } catch {
    return null
  }
}
