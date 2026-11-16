import { Note } from '@/models/note.model'

/**
 * Ids (as strings) of the servantees / retreats that have at least one note.
 * Pass `ids` to only check those records; omit it to check the whole collection.
 * Used to light up the notes icon without loading the notes themselves.
 */
export async function idsWithNotes(field: 'servanteeId' | 'retreatId', ids?: unknown[]): Promise<Set<string>> {
  if (ids && ids.length === 0) return new Set()
  const found = await Note.distinct(field, { [field]: ids ? { $in: ids } : { $ne: null } })
  return new Set(found.map((id: unknown) => String(id)))
}
