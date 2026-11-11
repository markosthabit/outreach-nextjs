import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { Retreat } from '@/models/retreat.model'
import { getAuthUser } from '@/lib/auth-helpers'
import { monthInZone, parsePaging, parseTzOffset, readJson } from '@/lib/api-utils'
import { parseServanteeInput } from '@/lib/servantee-input'
import { filterServantees } from '@/lib/arabic-search'
import { getInitialLetter, normalizeChurchName, normalizeCollegeName } from '@/lib/servantee-filters'
import { getServanteeListBase } from '@/lib/servantee-list-cache'

const LIST_FIELDS = 'name phone church diocese education year birthDate isActive'

// GET /api/servantees
//
// Three shapes, lightest first:
// - ?view=basic            every servantee, core fields only (pickers, duplicate checks, exports)
// - (no params)            every servantee + the retreats each attended (id/name/dates only)
// - ?page=1&limit=10&...   one page of the servantees screen, filtered on the server:
//     q, letter, church, college, view=inactive|birthdays, outreach=contacted|notContacted, tz
//   plus the counters and filter options the screen needs, so it never downloads the full list.
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })

    const { searchParams } = new URL(req.url)

    if (searchParams.has('page')) return await pagedList(searchParams)

    if (searchParams.get('view') === 'basic') {
      const servantees = await Servantee.find().select(LIST_FIELDS).lean()
      return NextResponse.json({ servantees })
    }

    const [servantees, allRetreats] = await Promise.all([
      Servantee.find().select(LIST_FIELDS).lean(),
      Retreat.find()
        .sort({ startDate: -1, createdAt: -1 })
        .select('name location startDate endDate attendees')
        .lean(),
    ])

    // Index retreats by attendee once. The attendee list itself is not repeated
    // on every servantee — that made this response grow quadratically.
    const retreatsByServantee = new Map<string, any[]>()
    for (const r of allRetreats as any[]) {
      const { attendees, ...summary } = r
      for (const a of attendees || []) {
        const key = a.toString()
        if (!retreatsByServantee.has(key)) retreatsByServantee.set(key, [])
        retreatsByServantee.get(key)!.push(summary)
      }
    }

    const servanteesWithRetreats = servantees.map((s: any) => ({
      ...s,
      retreats: retreatsByServantee.get(s._id.toString()) || [],
    }))

    return NextResponse.json({ servantees: servanteesWithRetreats })
  } catch (error) {
    console.error('[GET /servantees]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}

/**
 * One page of the servantees screen. The Arabic fuzzy search and the church /
 * college clustering can't be expressed as a Mongo query, so the (slim) rows are
 * filtered here in memory and only the requested page goes over the wire.
 */
async function pagedList(searchParams: URLSearchParams) {
  const { page: requestedPage, limit } = parsePaging(searchParams, 10, 100)
  const tz = parseTzOffset(searchParams.get('tz'))

  // Reloaded from the database only when something changed (see lib/servantee-list-cache.ts)
  const { rows: baseRows, facets, outreachCycle } = await getServanteeListBase()

  // "Inactive" = no retreat in the last 3 months. Both flags depend on today's
  // date / the viewer's timezone, so they are derived per request, not cached.
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const inactiveBefore = threeMonthsAgo.getTime()
  const thisMonth = monthInZone(new Date(), tz)

  const rows = baseRows.map((s) => ({
    ...s,
    isInactive: s.lastRetreatAt === null || s.lastRetreatAt < inactiveBefore,
    hasBirthdayThisMonth: !!s.birthDate && monthInZone(new Date(s.birthDate), tz) === thisMonth,
  }))

  // Counters always describe the whole list, not the filtered one
  const counts = {
    total: rows.length,
    inactive: rows.filter((r) => r.isInactive).length,
    birthdays: rows.filter((r) => r.hasBirthdayThisMonth).length,
    contacted: rows.filter((r) => r.outreach?.isCalled).length,
  }

  let result = rows
  const view = searchParams.get('view')
  if (view === 'inactive') result = result.filter((r) => r.isInactive)
  if (view === 'birthdays') result = result.filter((r) => r.hasBirthdayThisMonth)

  const outreach = searchParams.get('outreach')
  if (outreach === 'contacted' || outreach === 'notContacted') {
    const wantContacted = outreach === 'contacted'
    result = result.filter((r) => !!r.outreach?.isCalled === wantContacted)
  }

  const letter = searchParams.get('letter')
  if (letter) result = result.filter((r) => getInitialLetter(r.name) === letter)

  const church = searchParams.get('church')
  if (church) result = result.filter((r) => !!r.church && normalizeChurchName(r.church.trim()) === church)

  const college = searchParams.get('college')
  if (college) result = result.filter((r) => !!r.education && normalizeCollegeName(r.education.trim()) === college)

  const q = (searchParams.get('q') || '').trim().slice(0, 200)
  if (q) result = filterServantees(q, result)

  const total = result.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const page = Math.min(requestedPage, totalPages)

  return NextResponse.json({
    servantees: result.slice((page - 1) * limit, page * limit),
    total,
    page,
    totalPages,
    counts,
    facets,
    outreachCycle,
  })
}

// POST /api/servantees
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ message: 'لازم تسجل دخول الأول' }, { status: 401 })

    const parsed = parseServanteeInput(await readJson(req), { partial: false })
    if (parsed.error !== undefined) return NextResponse.json({ message: parsed.error }, { status: 400 })

    const existing = await Servantee.exists({ phone: parsed.data.phone })
    if (existing) {
      return NextResponse.json({ message: 'فيه مخدوم متسجل بنفس رقم التليفون ده' }, { status: 409 })
    }

    const servantee = await Servantee.create({
      ...parsed.data,
      createdBy: authUser.sub,
      updatedBy: authUser.sub,
    })

    return NextResponse.json({ servantee }, { status: 201 })
  } catch (error: any) {
    // Unique index race: two requests with the same phone at once
    if (error?.code === 11000) {
      return NextResponse.json({ message: 'فيه مخدوم متسجل بنفس رقم التليفون ده' }, { status: 409 })
    }
    console.error('[POST /servantees]', error)
    return NextResponse.json({ message: 'حصلت مشكلة في السيستم، جرّب تاني' }, { status: 500 })
  }
}
