'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, CalendarDays, UserCog } from 'lucide-react'
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
  })
  const [loading, setLoading] = useState(true)

async function fetchDashboardData() {
  try {
    setLoading(true)

    // Ask for all records (huge limit to bypass pagination)
    const [servanteesRes, retreatsRes, usersRes] = await Promise.all([
      apiFetch('/servantees?page=1&limit=9999'),
      apiFetch('/retreats?page=1&limit=9999'),
      apiFetch('/users?page=1&limit=9999'),
    ])

    // Extract .data if paginated, otherwise use directly (safe with unknown)
    const servantees = Array.isArray((servanteesRes as any)?.data)
      ? (servanteesRes as any).data
      : Array.isArray(servanteesRes)
      ? (servanteesRes as any)
      : []
    const retreats = Array.isArray((retreatsRes as any)?.data)
      ? (retreatsRes as any).data
      : Array.isArray(retreatsRes)
      ? (retreatsRes as any)
      : []
    const users = Array.isArray((usersRes as any)?.data)
      ? (usersRes as any).data
      : Array.isArray(usersRes)
      ? (usersRes as any)
      : []

    // Count upcoming retreats
    const now = new Date()
    const upcoming = retreats.filter(
      (r: any) => r.startDate && new Date(r.startDate) > now
    ).length

    setStats({
      servantees: servantees.length,
      retreats: retreats.length,
      upcomingRetreats: upcoming,
      servants: users.length,
    })
  } catch (err) {
    console.error('Dashboard fetch failed:', err)
    toast.error('فشل تحميل البيانات 😢')
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
          نظرة سريعة على نشاط الخدمة
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
                : `${stats.upcomingRetreats} خلوة قادمة`}
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
      </section>

      {/* Call to Action */}
      <section className="mt-8">
        <Card className="p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">جاهز للخدمة؟</h2>
            <p className="text-sm text-muted-foreground">
              ابدأ بإضافة مخدومين أو تنظيم خلوة جديدة.
            </p>
          </div>
          <div className="flex gap-2">
  <Button onClick={() => router.push('dashboard/servantees')}>
    إضافة مخدوم
  </Button>
  <Button onClick={() => router.push('dashboard/retreats')}>
    إضافة خلوة
  </Button>
</div>

        </Card>
      </section>
    </div>
  )
}
