import { isNonEmptyString, optionalString, parseDate } from './api-utils'

export type RetreatInput = {
  name?: string
  location?: string
  startDate?: Date
  endDate?: Date
  hours?: number | null
  contents?: string | null
  exercises?: string | null
}

/** Whitelist + validate retreat scalar fields. `partial` for PATCH. */
export function parseRetreatInput(
  body: any,
  { partial }: { partial: boolean }
): { data: RetreatInput; error?: undefined } | { error: string; data?: undefined } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' }
  const data: RetreatInput = {}

  for (const key of ['name', 'location'] as const) {
    if (body[key] !== undefined || !partial) {
      if (!isNonEmptyString(body[key], 200)) return { error: `${key} is required` }
      data[key] = body[key].trim()
    }
  }

  for (const key of ['startDate', 'endDate'] as const) {
    if (body[key] !== undefined || !partial) {
      const d = parseDate(body[key])
      if (!d) return { error: `Invalid ${key}` }
      data[key] = d
    }
  }

  if (body.hours !== undefined) {
    if (body.hours === null || body.hours === '') data.hours = null
    else if (typeof body.hours === 'number' && Number.isFinite(body.hours) && body.hours >= 0 && body.hours <= 10000)
      data.hours = body.hours
    else return { error: 'Invalid hours' }
  }

  for (const key of ['contents', 'exercises'] as const) {
    const v = optionalString(body[key], 10000)
    if (v === false) return { error: `Invalid ${key}` }
    if (v !== undefined) data[key] = v
  }

  return { data }
}
