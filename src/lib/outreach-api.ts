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

/** Sort comparator by Arabic name, for populated docs that Mongo can't sort server-side. */
export function byArabicName(getName: (x: any) => string | undefined) {
  return (a: any, b: any) => (getName(a) || '').localeCompare(getName(b) || '', 'ar')
}
