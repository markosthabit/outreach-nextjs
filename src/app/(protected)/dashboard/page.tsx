'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, CalendarDays, UserCog, Gift } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    servantees: 0,
    retreats: 0,
    upcomingRetreats: 0,
    servants: 0,
    birthdaysThisMonth: 0,
  })
  const [loading, setLoading] = useState(true)

  async function fetchDashboardData() {
    try {
      setLoading(true)

      // Counted on the server — the page no longer downloads every record
      const res = await apiFetch<typeof stats>(
        `/api/dashboard/stats?tz=${new Date().getTimezoneOffset()}`
      )
      setStats({
        servantees: res.servantees ?? 0,
        retreats: res.retreats ?? 0,
        upcomingRetreats: res.upcomingRetreats ?? 0,
        servants: res.servants ?? 0,
        birthdaysThisMonth: res.birthdaysThisMonth ?? 0,
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
        <Card className="p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">جاهز تخدم؟</h2>
            <p className="text-sm text-muted-foreground">
              ابدأ ضيف مخدومين أو نظّم خلوة جديدة.
            </p>
          </div>
          <div className="flex gap-2">
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
