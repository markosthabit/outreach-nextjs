'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, CalendarDays, UserCog, Gift, HeartHandshake } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

/** Progress of the current outreach round; `mine` = only the signed-in servant's servantees. */
interface OutreachStats {
  cycleName: string
  roundName: string
  total: number
  called: number
  mine: boolean
}

interface DashboardStats {
  servantees: number
  retreats: number
  upcomingRetreats: number
  servants: number
  birthdaysThisMonth: number
  outreach: OutreachStats | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    servantees: 0,
    retreats: 0,
    upcomingRetreats: 0,
    servants: 0,
    birthdaysThisMonth: 0,
    outreach: null,
  })
  const [loading, setLoading] = useState(true)

  async function fetchDashboardData() {
    try {
      setLoading(true)

      // Counted on the server — the page no longer downloads every record
      const res = await apiFetch<Partial<DashboardStats>>(
        `/api/dashboard/stats?tz=${new Date().getTimezoneOffset()}`
      )
      setStats({
        servantees: res.servantees ?? 0,
        retreats: res.retreats ?? 0,
        upcomingRetreats: res.upcomingRetreats ?? 0,
        servants: res.servants ?? 0,
        birthdaysThisMonth: res.birthdaysThisMonth ?? 0,
        outreach: res.outreach ?? null,
      })
    } catch (err) {
      console.error('Dashboard fetch failed:', err)
      toast.error('معرفناش نحمّل البيانات 😢')
    } finally {
      setLoading(false)
    }
  }



  useEffect(() => {
    fetchDashboardData()
  }, [])

  const outreach = stats.outreach
  const outreachLeft = outreach ? outreach.total - outreach.called : 0
  const outreachRate = outreach && outreach.total > 0 ? Math.round((outreach.called / outreach.total) * 100) : 0

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">
          سلام ونعمة 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          بص بسرعة على الخدمة ماشية إزاي
        </p>
      </section>

      {/* Stats Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Servantees */}
        <Card
          className="hover:bg-accent/30 transition cursor-pointer"
          onClick={() => router.push('/dashboard/servantees')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المخدومين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.servantees}
            </div>
            <p className="text-xs text-muted-foreground">عدد المخدومين</p>
          </CardContent>
        </Card>

        {/* Outreach */}
        <Card
          className="hover:bg-accent/30 transition cursor-pointer"
          onClick={() => router.push('/dashboard/outreach')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الافتقاد</CardTitle>
            <HeartHandshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold">...</div>
            ) : !outreach ? (
              <>
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground">مفيش جولة افتقاد شغالة دلوقتي</p>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-emerald-600 tabular-nums">{outreach.called}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">من {outreach.total}</span>
                </div>
                <div
                  className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={outreachRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${outreachRate}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2 truncate" title={outreach.roundName}>
                  {outreach.total === 0
                    ? outreach.mine
                      ? 'لسه متوزعش عليك مخدومين'
                      : 'لسه متوزعش مخدومين في الجولة'
                    : outreachLeft === 0
                    ? `كل المخدومين تم افتقادهم · ${outreach.roundName}`
                    : outreach.mine
                    ? `فاضلك ${outreachLeft} مخدوم تكلمهم · ${outreach.roundName}`
                    : `فاضل ${outreachLeft} مخدوم · ${outreach.roundName}`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Retreats */}
        <Card
          className="hover:bg-accent/30 transition cursor-pointer"
          onClick={() => router.push('dashboard/retreats')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الخلوات</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.retreats}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading
                ? ''
                : `${stats.upcomingRetreats} خلوة جاية`}
            </p>
          </CardContent>
        </Card>

        {/* Servants */}
        <Card
          className="hover:bg-accent/30 transition cursor-pointer"
          onClick={() => router.push('dashboard/servants')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الخدام</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.servants}
            </div>
            <p className="text-xs text-muted-foreground">عدد الخدام</p>
          </CardContent>
        </Card>

        {/* Birthdays */}
        <Card
          className="hover:bg-accent/30 transition cursor-pointer"
          onClick={() => router.push('dashboard/servantees?filter=birthdays')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أعياد الميلاد</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {loading ? '...' : stats.birthdaysThisMonth}
            </div>
            <p className="text-xs text-muted-foreground">عيد ميلاد</p>
          </CardContent>
        </Card>
      </section>

      {/* Call to Action */}
      <section className="mt-8">
        <Card className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">جاهز تخدم؟</h2>
            <p className="text-sm text-muted-foreground">
              افتقد مخدومينك، ضيف مخدومين، أو نظّم خلوة جديدة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push('/dashboard/outreach')}>
              الافتقاد
            </Button>
            <Button onClick={() => router.push('dashboard/servantees')}>
              ضيف مخدوم
            </Button>
            <Button onClick={() => router.push('dashboard/retreats')}>
              ضيف خلوة
            </Button>
          </div>

        </Card>
      </section>
    </div>
  )
}
