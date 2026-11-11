import { Servantee } from '@/models/servantee.model'
import { Retreat } from '@/models/retreat.model'
import { User } from '@/models/user.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { OutreachCycle } from '@/models/outreach-cycle.model'
import { OutreachRound } from '@/models/outreach-round.model'
import {
  buildClusteredOptions,
  computeLetterCounts,
  normalizeChurchName,
  normalizeCollegeName,
  type ClusteredFilterOption,
} from '@/lib/servantee-filters'
import {
  OUTREACH_SUMMARY_POPULATE,
  getCurrentOutreachCycle,
  toOutreachSummary,
} from '@/lib/outreach-summary'

const LIST_FIELDS = 'name phone church diocese education year birthDate isActive'

export interface ServanteeListRow {
  _id: string
  name: string
  phone?: string
  church?: string
  diocese?: string
  education?: string
  year?: string
  birthDate?: Date | null
  isActive?: boolean
  /** Start of the latest retreat attended (ms), or null if none. */
  lastRetreatAt: number | null
  outreach: ReturnType<typeof toOutreachSummary> | null
}

export interface ServanteeListBase {
  rows: ServanteeListRow[]
  facets: {
    letterCounts: Record<string, number>
    churchOptions: ClusteredFilterOption[]
    collegeOptions: ClusteredFilterOption[]
  }
  outreachCycle: any | null
}

let cached: { fingerprint: string; base: ServanteeListBase } | null = null

/**
 * A cheap signature of everything the servantees list is built from: document
 * count and newest `updatedAt` of each collection involved. Any create, update
 * or delete changes it, so the cache is never stale — on any server instance —
 * while an unchanged database costs six tiny queries instead of loading every
 * servantee, retreat and assignment again.
 */
async function fingerprint(): Promise<string> {
  const models = [Servantee, Retreat, OutreachAssignment, OutreachCycle, OutreachRound, User]
  const parts = await Promise.all(
    models.map(async (model) => {
      const [r] = await model.aggregate([{ $group: { _id: null, n: { $sum: 1 }, m: { $max: '$updatedAt' } } }])
      return `${r?.n ?? 0}:${r?.m ? new Date(r.m).getTime() : 0}`
    })
  )
  return parts.join('|')
}

async function load(): Promise<ServanteeListBase> {
  const [servantees, retreats, outreachCycle] = await Promise.all([
    Servantee.find().select(LIST_FIELDS).lean<any[]>(),
    Retreat.find().select('startDate attendees').lean<any[]>(),
    getCurrentOutreachCycle(),
  ])

  const lastRetreatAt = new Map<string, number>()
  for (const r of retreats) {
    const start = r.startDate ? new Date(r.startDate).getTime() : 0
    for (const a of r.attendees || []) {
      const key = a.toString()
      if (start > (lastRetreatAt.get(key) ?? -1)) lastRetreatAt.set(key, start)
    }
  }

  // Outreach status in the current cycle (one assignment per servantee per cycle)
  const outreachByServantee = new Map<string, ReturnType<typeof toOutreachSummary>>()
  if (outreachCycle) {
    const assignments = await OutreachAssignment.find({ cycleId: outreachCycle._id })
      .populate(OUTREACH_SUMMARY_POPULATE)
      .lean<any[]>()
    for (const a of assignments) outreachByServantee.set(a.servanteeId.toString(), toOutreachSummary(a))
  }

  const rows: ServanteeListRow[] = servantees.map((s) => {
    const id = s._id.toString()
    return {
      ...s,
      _id: id,
      lastRetreatAt: lastRetreatAt.get(id) ?? null,
      outreach: outreachByServantee.get(id) || null,
    }
  })

  return {
    rows,
    facets: {
      letterCounts: computeLetterCounts(rows),
      churchOptions: buildClusteredOptions(rows, (s) => s.church, normalizeChurchName),
      collegeOptions: buildClusteredOptions(rows, (s) => s.education, normalizeCollegeName),
    },
    outreachCycle,
  }
}

/** The data behind the servantees screen, reloaded only when something actually changed. */
export async function getServanteeListBase(): Promise<ServanteeListBase> {
  // Signature first: a write that lands while loading just makes the next request reload
  const current = await fingerprint()
  if (cached && cached.fingerprint === current) return cached.base

  const base = await load()
  cached = { fingerprint: current, base }
  return base
}

/** For writes that bypass Mongoose (e.g. a backup restore replacing whole collections). */
export function invalidateServanteeListCache() {
  cached = null
}
