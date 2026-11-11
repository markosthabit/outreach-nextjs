import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { Retreat } from '@/models/retreat.model'
import { User } from '@/models/user.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { jsonError, monthInZone, parseTzOffset } from '@/lib/api-utils'

// GET /api/dashboard/stats?tz=<minutes>
// The home page only shows counters, so count in the database instead of
// shipping every servantee, retreat and user to the browser.
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    if (!(await getAuthUser(req))) return jsonError('لازم تسجل دخول الأول', 401)

    const tz = parseTzOffset(new URL(req.url).searchParams.get('tz'))
    const now = new Date()

    const [servantees, retreats, upcomingRetreats, servants, birthDates] = await Promise.all([
      Servantee.countDocuments(),
      Retreat.countDocuments(),
      Retreat.countDocuments({ startDate: { $gt: now } }),
      User.countDocuments(),
      Servantee.find({ birthDate: { $ne: null } }).select('birthDate -_id').lean<any[]>(),
    ])

    const thisMonth = monthInZone(now, tz)
    const birthdaysThisMonth = birthDates.filter(
      (s) => s.birthDate && monthInZone(new Date(s.birthDate), tz) === thisMonth
    ).length

    return NextResponse.json({ servantees, retreats, upcomingRetreats, servants, birthdaysThisMonth })
  } catch (error) {
    console.error('[GET /api/dashboard/stats]', error)
    return jsonError('حصلت مشكلة في السيستم، جرّب تاني', 500)
  }
}
