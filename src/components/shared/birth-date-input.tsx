'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const MIN_YEAR = 1900

/** ٠-٩ / ۰-۹ → 0-9, so dates typed on an Arabic keyboard work too. */
function toLatinDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
}

/**
 * Tidy what the user typed into `day/month/year` as they go: digits only, the
 * slashes are added for them ("25122001" → "25/12/2001"), and "5/3/2001" is
 * left alone.
 */
export function formatBirthDateText(raw: string): string {
  const cleaned = toLatinDigits(raw)
    .replace(/[.\-\s\\]/g, '/')
    .replace(/[^\d/]/g, '')
  const queue = cleaned.split('/')
  const parts: string[] = []
  while (queue.length && parts.length < 3) {
    let part = queue.shift()!
    const max = parts.length === 2 ? 4 : 2
    if (part.length > max) {
      // Typed without a slash: the extra digits start the next part
      if (queue.length === 0 && parts.length < 2) queue.unshift(part.slice(max))
      part = part.slice(0, max)
    }
    parts.push(part)
  }
  return parts.join('/')
}

/**
 * `day/month/year` → `YYYY-MM-DD` for the API.
 * Returns '' for an empty field and null when the text isn't a real date.
 */
export function birthDateTextToIso(text: string | undefined | null): string | null {
  const value = toLatinDigits(text ?? '').trim()
  if (!value) return ''
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (!m) return null
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(year, month - 1, day))
  // Rejects things like 31/02 that Date would silently roll over
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  if (year < MIN_YEAR || d.getTime() > Date.now()) return null
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** A stored birth date → the `day/month/year` text shown in the field. */
export function birthDateToText(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

export const BIRTH_DATE_ERROR = 'اكتب التاريخ يوم/شهر/سنة، مثلاً 25/12/2001'

/**
 * Birth date as a plain typed field (day/month/year) instead of the browser's
 * calendar popup, which makes picking a year two decades back slow.
 */
export function BirthDateInput({
  value,
  onChange,
  className,
  ...props
}: {
  value: string
  onChange: (value: string) => void
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'>) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      dir="ltr"
      placeholder="يوم/شهر/سنة"
      maxLength={10}
      value={value}
      onChange={(e) => onChange(formatBirthDateText(e.target.value))}
      className={cn('text-right placeholder:text-right tabular-nums', className)}
      {...props}
    />
  )
}
