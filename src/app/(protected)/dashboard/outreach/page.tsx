'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  PhoneCall,
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  FileSpreadsheet,
  Users,
  UserCheck,
  TrendingUp,
  Settings2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { CycleDialog } from './components/cycle-dialog'
import { CreateRoundDialog } from './components/create-round-dialog'
import { ServantReportDialog } from './components/servant-report-dialog'
import { AssignServanteesSection } from './components/assign-servantees-section'
import { ServantCallingView } from './components/servant-calling-view'
import { formatDate, patchReport } from './components/outreach-utils'
import { cn } from '@/lib/utils'

export default function OutreachPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'

  // Cycles & rounds
  const [initialLoading, setInitialLoading] = useState(true)
  const [activeCycle, setActiveCycle] = useState<any | null>(null)
  const [cycles, setCycles] = useState<any[]>([])
  const [rounds, setRounds] = useState<any[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string>('')
  const [servants, setServants] = useState<any[]>([])

  // Admin report
  const [reportData, setReportData] = useState<any | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const reportRequestRef = useRef(0)
  const [selectedServantIdForDetail, setSelectedServantIdForDetail] = useState<string | null>(null)
  const [togglingRoundId, setTogglingRoundId] = useState<string | null>(null)

  // Servant's own assignments
  const [servantAssignments, setServantAssignments] = useState<any[]>([])
  const [loadingServantData, setLoadingServantData] = useState(true)

  // Dialogs
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false)
  const [cycleDialogMode, setCycleDialogMode] = useState<'start' | 'end'>('start')
  const [createRoundOpen, setCreateRoundOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const cyclesRes = await apiFetch<{ activeCycle: any; cycles: any[] }>('/api/outreach/cycles')
      setActiveCycle(cyclesRes.activeCycle || null)
      setCycles(cyclesRes.cycles || [])

      if (cyclesRes.activeCycle) {
        const roundsRes = await apiFetch<{ rounds: any[] }>(
          `/api/outreach/rounds?cycleId=${cyclesRes.activeCycle._id}`
        )
        const roundList = roundsRes.rounds || []
        setRounds(roundList)
        setSelectedRoundId((prev) => {
          if (prev && roundList.some((r) => r._id === prev)) return prev
          const activeR = roundList.find((r) => r.status === 'active')
          return activeR?._id || roundList[0]?._id || ''
        })
      } else {
        setRounds([])
        setSelectedRoundId('')
      }
    } catch (err) {
      console.error('Failed to load outreach data:', err)
      toast.error('معرفناش نحمّل بيانات الافتقاد')
    } finally {
      setInitialLoading(false)
    }
  }, [])

  const fetchServants = useCallback(async () => {
    if (!isAdmin) return
    try {
      const usersRes = await apiFetch<{ users: any[] }>('/api/users')
      setServants(usersRes.users || [])
    } catch {
      toast.error('معرفناش نحمّل قايمة الخدام')
    }
  }, [isAdmin])

  const fetchReport = useCallback(async () => {
    if (!isAdmin) return
    if (!selectedRoundId) {
      setReportData(null)
      return
    }
    const requestId = ++reportRequestRef.current
    try {
      setLoadingReport(true)
      const res = await apiFetch<any>(`/api/outreach/report?roundId=${selectedRoundId}`)
      // Ignore responses for a round the user has already switched away from
      if (requestId === reportRequestRef.current) setReportData(res)
    } catch (err) {
      console.error('Failed to load report:', err)
      if (requestId === reportRequestRef.current) toast.error('معرفناش نحمّل تقرير الجولة')
    } finally {
      if (requestId === reportRequestRef.current) setLoadingReport(false)
    }
  }, [isAdmin, selectedRoundId])

  const fetchServantAssignments = useCallback(async () => {
    if (isAdmin) return
    try {
      setLoadingServantData(true)
      const res = await apiFetch<{ assignments: any[] }>('/api/outreach/assignments')
      setServantAssignments(res.assignments || [])
    } catch (err) {
      console.error('Failed to load assignments:', err)
      toast.error('معرفناش نحمّل تكليفات الافتقاد')
    } finally {
      setLoadingServantData(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!user) return
    fetchData()
    fetchServants()
  }, [user, fetchData, fetchServants])

  useEffect(() => {
    if (!user) return
    if (isAdmin) fetchReport()
    else fetchServantAssignments()
  }, [user, isAdmin, fetchReport, fetchServantAssignments])

  const selectedServantData = useMemo(() => {
    if (!selectedServantIdForDetail || !reportData?.servants) return null
    return reportData.servants.find((s: any) => s.servant?._id === selectedServantIdForDetail) || null
  }, [selectedServantIdForDetail, reportData])

  // Close the detail dialog if its servant no longer has assignments (e.g. last one removed)
  useEffect(() => {
    if (selectedServantIdForDetail && reportData && !selectedServantData) {
      setSelectedServantIdForDetail(null)
    }
  }, [selectedServantIdForDetail, reportData, selectedServantData])

  async function handleAdminToggleAssignment(assignmentId: string, newState: boolean) {
    try {
      const res = await apiFetch<{ assignment: any }>(`/api/outreach/assignments/${assignmentId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isCalled: newState }),
      })
      setReportData((prev: any) => patchReport(prev, assignmentId, res.assignment))
      toast.success(newState ? 'اتسجل إن المخدوم اتكلم' : 'شيلنا علامة الاتصال')
      fetchData() // refresh round stats in the background
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نحدّث الحالة')
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/outreach/assignments?assignmentId=${assignmentId}`,
        { method: 'DELETE' }
      )
      setReportData((prev: any) => patchReport(prev, assignmentId, null))
      toast.success(res.message || 'التكليف اتشال')
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نشيل التكليف')
    }
  }

  function handleServantAssignmentChange(updated: any) {
    setServantAssignments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))
  }

  async function handleToggleRoundStatus(roundId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'active' ? 'completed' : 'active'
    try {
      setTogglingRoundId(roundId)
      await apiFetch('/api/outreach/rounds', {
        method: 'PATCH',
        body: JSON.stringify({ roundId, status: nextStatus }),
      })
      toast.success(nextStatus === 'active' ? 'الجولة رجعت تشتغل' : 'الجولة خلصت')
      await fetchData()
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نغيّر حالة الجولة')
    } finally {
      setTogglingRoundId(null)
    }
  }

  async function handleExportExcel() {
    if (!reportData) return
    try {
      const XLSX = await import('xlsx')

      const servantsSummaryData = reportData.servants.map((s: any) => ({
        'اسم الخادم': s.servant?.name || '',
        'البريد الإلكتروني': s.servant?.email || '',
        'عدد المكلفين': s.assignedCount,
        'اتكلموا': s.calledCount,
        'لسه متكلموش': s.notCalledCount,
        'نسبة الإنجاز': `${s.completionPercentage}%`,
      }))

      const uncalledData = reportData.notCalledList.map((item: any) => ({
        'اسم المخدوم': item.servantee?.name || '',
        'رقم الهاتف': item.servantee?.phone || '',
        'الكنيسة': item.servantee?.church || '',
        'الكلية / التعليم': item.servantee?.education || '',
        'الخادم المكلف': item.servant?.name || '',
        'ملاحظات': item.notes || '',
      }))

      const allData = reportData.servants.flatMap((s: any) =>
        s.assignments.map((a: any) => ({
          'الخادم المكلف': s.servant?.name || '',
          'اسم المخدوم': a.servanteeId?.name || '',
          'رقم الهاتف': a.servanteeId?.phone || '',
          'الكنيسة': a.servanteeId?.church || '',
          'التعليم': a.servanteeId?.education || '',
          'حالة الافتقاد': a.isCalled ? 'اتكلم' : 'لسه متكلمش',
          'تاريخ الاتصال': a.calledAt ? new Date(a.calledAt).toLocaleString('ar-EG') : '-',
          'المتصل': a.calledBy?.name || '-',
          'ملاحظات': a.notes || '',
        }))
      )

      const wb = XLSX.utils.book_new()
      wb.Workbook = { Views: [{ RTL: true }] }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(servantsSummaryData), 'ملخص الخدام')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(uncalledData), 'لسه متكلموش')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allData), 'كل التكليفات')

      // Strip characters that are invalid in file names
      const roundName = (reportData.round?.name || 'جولة_الافتقاد').replace(/[\\/:*?"<>|]/g, '-')
      XLSX.writeFile(wb, `تقرير_الافتقاد_${roundName}.xlsx`)
      toast.success('ملف الإكسيل نزل')
    } catch (err) {
      console.error(err)
      toast.error('معرفناش نطلّع ملف الإكسيل')
    }
  }

  const selectedRound = rounds.find((r) => r._id === selectedRoundId)

  // ---------- Loading skeleton ----------
  if (initialLoading) {
    return (
      <div className="space-y-4 sm:space-y-6" dir="rtl">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-10 w-full sm:w-96 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">خدمة الافتقاد</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {activeCycle ? (
                <>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    الدورة الشغالة:
                  </span>
                  <Badge variant="secondary" className="font-bold text-xs">
                    {activeCycle.name}
                  </Badge>
                </>
              ) : (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  مفيش دورة شغالة دلوقتي
                  {isAdmin ? '. ابدأ دورة جديدة عشان تبدأ.' : '.'}
                </span>
              )}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            {activeCycle ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-rose-600 border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950/30"
                  onClick={() => {
                    setCycleDialogMode('end')
                    setCycleDialogOpen(true)
                  }}
                >
                  إنهي الدورة
                </Button>
                <Button size="sm" className="gap-1.5 text-xs shadow-xs" onClick={() => setCreateRoundOpen(true)}>
                  <Plus className="h-4 w-4" />
                  جولة جديدة
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 text-xs shadow-xs col-span-2"
                onClick={() => {
                  setCycleDialogMode('start')
                  setCycleDialogOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                ابدأ دورة افتقاد جديدة
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 2. Admin vs Servant */}
      {isAdmin ? (
        <Tabs defaultValue="report" className="space-y-4 sm:space-y-6" dir="rtl">
          <TabsList className="bg-muted/80 p-1 rounded-xl grid grid-cols-3 w-full sm:inline-flex sm:w-fit h-auto">
            <TabsTrigger value="report" className="gap-1.5 text-xs sm:text-sm py-2 flex-col min-[400px]:flex-row">
              <TrendingUp className="h-4 w-4" />
              المتابعة
            </TabsTrigger>
            <TabsTrigger value="assign" className="gap-1.5 text-xs sm:text-sm py-2 flex-col min-[400px]:flex-row">
              <UserCheck className="h-4 w-4" />
              التوزيع
            </TabsTrigger>
            <TabsTrigger value="manage" className="gap-1.5 text-xs sm:text-sm py-2 flex-col min-[400px]:flex-row">
              <Settings2 className="h-4 w-4" />
              الجولات والدورات
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Monitoring & Report */}
          <TabsContent value="report" className="space-y-4 sm:space-y-6">
            {rounds.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-10 w-10 mx-auto text-muted-foreground/40" />}
                title={activeCycle ? 'لسه مفيش جولات في الدورة دي' : 'مفيش دورة شغالة'}
                description={
                  activeCycle ? 'اعمل جولة افتقاد جديدة عشان تبدأ توزع المخدومين.' : 'ابدأ دورة افتقاد جديدة الأول.'
                }
                action={
                  activeCycle ? (
                    <Button size="sm" className="gap-1.5" onClick={() => setCreateRoundOpen(true)}>
                      <Plus className="h-4 w-4" />
                      جولة جديدة
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setCycleDialogMode('start')
                        setCycleDialogOpen(true)
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      ابدأ دورة
                    </Button>
                  )
                }
              />
            ) : (
              <>
                {/* Round selector & export */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3 sm:p-4 rounded-xl border">
                  <div className="flex flex-col min-[480px]:flex-row min-[480px]:items-center gap-2 sm:gap-3 min-w-0">
                    <span className="text-sm font-semibold shrink-0">تقرير الجولة:</span>
                    <Select value={selectedRoundId} onValueChange={setSelectedRoundId}>
                      <SelectTrigger className="w-full min-[480px]:w-[240px] bg-background" dir="rtl">
                        <SelectValue placeholder="اختار الجولة..." />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {rounds.map((r) => (
                          <SelectItem key={r._id} value={r._id}>
                            {r.name} {r.status === 'active' ? '(شغالة)' : '(خلصت)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedRound && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {formatDate(selectedRound.startDate)} – {formatDate(selectedRound.endDate)}
                      </span>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    disabled={!reportData || reportData.summary?.totalAssigned === 0}
                    className="gap-2 text-xs font-semibold bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/20 shrink-0"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    نزّل Excel
                  </Button>
                </div>

                {/* Summary metrics */}
                {reportData ? (
                  <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4', loadingReport && 'opacity-60')}>
                    <MetricCard label="عدد المكلفين" value={reportData.summary.totalAssigned} hint="في الجولة دي" />
                    <MetricCard
                      label="اتكلموا"
                      value={reportData.summary.totalCalled}
                      hint="مكالمات متسجلة"
                      tone="emerald"
                    />
                    <MetricCard
                      label="لسه متكلموش"
                      value={reportData.summary.totalNotCalled}
                      hint="فاضل نفتقدهم"
                      tone="rose"
                    />
                    <MetricCard
                      label="نسبة الإنجاز"
                      value={`${reportData.summary.completionPercentage}%`}
                      hint="قد إيه خلصنا"
                      tone="primary"
                    />
                  </div>
                ) : (
                  loadingReport && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 sm:h-28 rounded-xl" />
                      ))}
                    </div>
                  )
                )}

                {/* Servants grid */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-bold text-base sm:text-lg text-foreground">أداء الخدام في الجولة</h3>
                    <p className="text-xs text-muted-foreground">دوس على كارت الخادم عشان تشوف مخدومينه وتحدّث حالتهم.</p>
                  </div>

                  {loadingReport && !reportData ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-36 rounded-xl" />
                      ))}
                    </div>
                  ) : !reportData || reportData.servants.length === 0 ? (
                    <EmptyState
                      icon={<Users className="h-10 w-10 mx-auto text-muted-foreground/40" />}
                      title="لسه مفيش تكليفات في الجولة دي"
                      description='روح لتبويب "التوزيع" عشان توزع مخدومين على الخدام.'
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {reportData.servants.map((sGroup: any) => {
                        const servant = sGroup.servant
                        const percent = sGroup.completionPercentage
                        return (
                          <button
                            type="button"
                            key={servant._id}
                            onClick={() => setSelectedServantIdForDetail(servant._id)}
                            className="text-right rounded-xl border bg-card shadow-xs p-4 space-y-3 transition-all hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
                                  {servant.name}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate" dir="ltr">
                                  {servant.email}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'font-bold text-xs px-2 shrink-0 tabular-nums',
                                  percent === 100
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                    : percent >= 50
                                    ? 'bg-primary/10 text-primary border-primary/30'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {percent}%
                              </Badge>
                            </div>

                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-l from-emerald-500 to-primary rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t text-xs">
                              <span className="text-muted-foreground">المكلفين: {sGroup.assignedCount}</span>
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {sGroup.calledCount}
                                </span>
                                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                                  <XCircle className="h-3.5 w-3.5" />
                                  {sGroup.notCalledCount}
                                </span>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* TAB 2: Assign */}
          <TabsContent value="assign">
            <AssignServanteesSection
              rounds={rounds}
              activeRoundId={selectedRoundId}
              servants={servants}
              hasActiveCycle={!!activeCycle}
              onSuccess={() => {
                fetchReport()
                fetchData()
              }}
            />
          </TabsContent>

          {/* TAB 3: Manage rounds & cycles */}
          <TabsContent value="manage" className="space-y-4 sm:space-y-6">
            <Card className="border shadow-xs gap-0 py-0 overflow-hidden">
              <CardHeader className="p-4 sm:p-6 flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base sm:text-lg">جولات الدورة الحالية</CardTitle>
                  <CardDescription>مواعيد الجولات وحالتها وقد إيه خلصت.</CardDescription>
                </div>
                <Button size="sm" onClick={() => setCreateRoundOpen(true)} disabled={!activeCycle} className="gap-1.5 text-xs shrink-0">
                  <Plus className="h-4 w-4" />
                  جولة جديدة
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="w-full text-right" dir="rtl">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-right">الجولة</TableHead>
                      <TableHead className="text-right hidden md:table-cell">من</TableHead>
                      <TableHead className="text-right hidden md:table-cell">إلى</TableHead>
                      <TableHead className="text-right">الإنجاز</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">الحالة</TableHead>
                      <TableHead className="text-right w-px" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rounds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          لسه مفيش جولات في الدورة دي.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rounds.map((r) => (
                        <TableRow key={r._id}>
                          <TableCell className="text-right whitespace-normal">
                            <div className="font-semibold">{r.name}</div>
                            <div className="md:hidden text-[11px] text-muted-foreground">
                              {formatDate(r.startDate)} – {formatDate(r.endDate)}
                            </div>
                            <div className="sm:hidden mt-1">
                              <RoundStatusBadge status={r.status} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs hidden md:table-cell">{formatDate(r.startDate)}</TableCell>
                          <TableCell className="text-right text-xs hidden md:table-cell">{formatDate(r.endDate)}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            <span className="text-emerald-600 font-semibold">{r.totalCalled || 0}</span>
                            <span className="text-muted-foreground"> / {r.totalAssigned || 0}</span>
                          </TableCell>
                          <TableCell className="text-right hidden sm:table-cell">
                            <RoundStatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8"
                              disabled={togglingRoundId === r._id}
                              onClick={() => handleToggleRoundStatus(r._id, r.status)}
                            >
                              {togglingRoundId === r._id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : r.status === 'active' ? (
                                'إنهيها'
                              ) : (
                                'رجّعها'
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border shadow-xs gap-0 py-0 overflow-hidden">
              <CardHeader className="p-4 sm:p-6 space-y-1">
                <CardTitle className="text-base sm:text-lg">سجل دورات الافتقاد</CardTitle>
                <CardDescription>كل الدورات اللي فاتت واللي شغالة.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="w-full text-right" dir="rtl">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-right">الدورة</TableHead>
                      <TableHead className="text-right">البدء</TableHead>
                      <TableHead className="text-right">الانتهاء</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          لسه مفيش دورات متسجلة.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cycles.map((c) => (
                        <TableRow key={c._id}>
                          <TableCell className="text-right font-semibold whitespace-normal">{c.name}</TableCell>
                          <TableCell className="text-right text-xs">{formatDate(c.startedAt)}</TableCell>
                          <TableCell className="text-right text-xs">
                            {c.endedAt ? (
                              formatDate(c.endedAt)
                            ) : (
                              <span className="text-emerald-600 font-medium">لسه شغالة</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right hidden sm:table-cell">
                            {c.status === 'active' ? (
                              <Badge className="bg-emerald-600 text-white text-xs">شغالة</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">خلصت</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <ServantCallingView
          assignments={servantAssignments}
          loading={loadingServantData}
          activeRound={selectedRound}
          activeCycle={activeCycle}
          onAssignmentChange={handleServantAssignmentChange}
        />
      )}

      {/* Dialogs */}
      <CycleDialog
        open={cycleDialogOpen}
        onOpenChange={setCycleDialogOpen}
        activeCycle={activeCycle}
        mode={cycleDialogMode}
        onSuccess={fetchData}
      />

      <CreateRoundDialog
        open={createRoundOpen}
        onOpenChange={setCreateRoundOpen}
        activeCycleId={activeCycle?._id || null}
        onSuccess={fetchData}
      />

      {isAdmin && (
        <ServantReportDialog
          open={!!selectedServantData}
          onOpenChange={(open) => {
            if (!open) setSelectedServantIdForDetail(null)
          }}
          servantData={selectedServantData}
          roundName={selectedRound?.name}
          onToggleAssignment={handleAdminToggleAssignment}
          onRemoveAssignment={handleRemoveAssignment}
        />
      )}
    </div>
  )
}

function RoundStatusBadge({ status }: { status: string }) {
  return status === 'active' ? (
    <Badge className="bg-emerald-600 text-white text-[11px]">شغالة</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground text-[11px]">خلصت</Badge>
  )
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number | string
  hint: string
  tone?: 'emerald' | 'rose' | 'primary'
}) {
  const tones = {
    emerald: {
      card: 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20',
      label: 'text-emerald-700 dark:text-emerald-400',
      value: 'text-emerald-600 dark:text-emerald-400',
    },
    rose: {
      card: 'border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/20',
      label: 'text-rose-700 dark:text-rose-400',
      value: 'text-rose-600 dark:text-rose-400',
    },
    primary: { card: 'border-primary/20 bg-primary/5', label: 'text-primary', value: 'text-primary' },
  }
  const t = tone ? tones[tone] : { card: '', label: 'text-muted-foreground', value: 'text-foreground' }
  return (
    <div className={cn('rounded-xl border bg-card shadow-xs p-3 sm:p-4 space-y-1', t.card)}>
      <p className={cn('text-xs font-medium', t.label)}>{label}</p>
      <p className={cn('text-2xl sm:text-3xl font-black tabular-nums', t.value)}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="text-center py-12 sm:py-16 px-4 rounded-xl border bg-card text-muted-foreground space-y-2">
      {icon}
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-xs">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}
