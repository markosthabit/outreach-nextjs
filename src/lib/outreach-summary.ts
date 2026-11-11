import { OutreachCycle } from '@/models/outreach-cycle.model'

/** Fields to populate on an assignment before passing it to `toOutreachSummary`. */
export const OUTREACH_SUMMARY_POPULATE = [
  { path: 'servantId', select: 'name' },
  { path: 'calledBy', select: 'name' },
  { path: 'roundId', select: 'name status' },
]

/** Fully populated assignment, as shown in a servantee's outreach history. */
export const OUTREACH_DETAIL_POPULATE = [
  { path: 'cycleId', select: 'name status' },
  { path: 'roundId', select: 'name startDate endDate status' },
  { path: 'servantId', select: 'name email' },
  { path: 'calledBy', select: 'name email' },
]

/**
 * The cycle that "was this servantee contacted?" refers to:
 * the active cycle, or the most recent one when none is active.
 */
export async function getCurrentOutreachCycle(): Promise<any | null> {
  return (
    (await OutreachCycle.findOne({ status: 'active' }).select('name status').lean()) ||
    (await OutreachCycle.findOne().sort({ createdAt: -1 }).select('name status').lean())
  )
}

const person = (u: any) => (u?._id ? { _id: u._id.toString(), name: u.name || '' } : null)

/** Compact outreach status shown next to a servantee in the servantees list. */
export function toOutreachSummary(a: any) {
  return {
    assignmentId: a._id.toString(),
    isCalled: !!a.isCalled,
    calledAt: a.calledAt || null,
    servant: person(a.servantId),
    calledBy: person(a.calledBy),
    round: a.roundId?._id
      ? { _id: a.roundId._id.toString(), name: a.roundId.name || '', status: a.roundId.status }
      : null,
    notes: a.notes || '',
  }
}
