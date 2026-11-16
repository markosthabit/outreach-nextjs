import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { Retreat } from '@/models/retreat.model'
import { User } from '@/models/user.model'
import { OutreachAssignment } from '@/models/outreach-assignment.model'
import { getCurrentOutreachRound } from '@/lib/outreach-summary'
import { getAuthUser } from '@/lib/auth-helpers'
import { jsonError, monthInZone, parseTzOffset } from '@/lib/api-utils'

// GET /api/dashboard/stats?tz=<minutes>
// The home page only shows counters, so count in the database instead of
// shipping every servantee, retreat and user to the browser.
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return jsonError('لازم تسجل دخول الأول', 401)

    const tz = parseTzOffset(new URL(req.url).searchParams.get('tz'))
    const now = new Date()

    const [servantees, retreats, upcomingRetreats, servants, birthDates, outreach] = await Promise.all([
      Servantee.countDocuments(),
      Retreat.countDocuments(),
      Retreat.countDocuments({ startDate: { $gt: now } }),
      User.countDocuments(),
      Servantee.find({ birthDate: { $ne: null } }).select('birthDate -_id').lean<any[]>(),
      outreachStats(authUser),
    ])

    const thisMonth = monthInZone(now, tz)
    const birthdaysThisMonth = birthDates.filter(
      (s) => s.birthDate && monthInZone(new Date(s.birthDate), tz) === thisMonth
    ).length

    return NextResponse.json({ servantees, retreats, upcomingRetreats, servants, birthdaysThisMonth, outreach })
  } catch (error) {
    console.error('[GET /api/dashboard/stats]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}

/**
 * Progress of the current outreach round: an admin sees the whole round,
 * a servant only the servantees assigned to them. Null when nothing is running.
 */
async function outreachStats(authUser: { sub?: string; role?: unknown }) {
  const current = await getCurrentOutreachRound()
  if (!current) return null

  const mine = authUser.role !== 'Admin'
  const filter: Record<string, unknown> = { roundId: current.round._id }
  if (mine) filter.servantId = authUser.sub

  const [total, called] = await Promise.all([
    OutreachAssignment.countDocuments(filter),
    OutreachAssignment.countDocuments({ ...filter, isCalled: true }),
  ])

  return { cycleName: current.cycle.name, roundName: current.round.name, total, called, mine }
}
