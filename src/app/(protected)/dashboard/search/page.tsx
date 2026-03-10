'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiFetch } from '@/lib/api'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Search, FileDown } from 'lucide-react'
import { b64font } from '@/lib/fonts/amiri-font'

interface Retreat {
  _id: string
  name: string
  startDate: string
  endDate: string
  attendees: any[]
}

interface Servantee {
  _id: string
  name: string
  phone: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAttendeeIds(retreat: Retreat): string[] {
  if (!retreat?.attendees) return []
  return retreat.attendees.map((a) => (typeof a === 'string' ? a : a._id))
}

/**
 * Parse a date string as LOCAL midnight to avoid UTC-offset shifting.
 * e.g. "2025-06-01T00:00:00.000Z" in UTC+2 would shift to May 31 —
 * this function always returns June 1 regardless of timezone.
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

const PAGE_SIZE = 10

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [retreats, setRetreats] = useState<Retreat[]>([])
  const [servantees, setServantees] = useState<Servantee[]>([])
  const [startRetreatId, setStartRetreatId] = useState<string | null>(null)
  const [endRetreatId, setEndRetreatId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'attended' | 'notAttended'>('attended')
  const [filtered, setFiltered] = useState<Servantee[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [page, setPage] = useState(1)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [retreatsRes, servanteesRes] = await Promise.all([
          apiFetch<{ retreats: Retreat[] }>('/api/retreats'),
          apiFetch<{ servantees: Servantee[] }>('/api/servantees'),
        ])

        const sorted = (retreatsRes.retreats ?? []).sort(
          (a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime()
        )
        setRetreats(sorted)
        setServantees(servanteesRes.servantees ?? [])
      } catch {
        toast.error('حدث خطأ أثناء تحميل البيانات')
      }
    }
    load()
  }, [])

  // ── Search ──────────────────────────────────────────────────────────────────
  function handleSearch() {
    if (!startRetreatId || !endRetreatId) {
      toast.info('يرجى اختيار خلوة البداية والنهاية')
      return
    }

    const startRetreat = retreats.find((r) => r._id === startRetreatId)
    const endRetreat = retreats.find((r) => r._id === endRetreatId)

    if (!startRetreat || !endRetreat) return

    // Build date range — use local midnight to avoid timezone shifting
    const fromDate = new Date(
      Math.min(
        parseLocalDate(startRetreat.startDate).getTime(),
        parseLocalDate(endRetreat.startDate).getTime()
      )
    )

    // Set toDate to end of day so single-day retreats (startDate === endDate) are included
    const toDate = new Date(
      Math.max(
        parseLocalDate(startRetreat.endDate).getTime(),
        parseLocalDate(endRetreat.endDate).getTime()
      )
    )
    toDate.setHours(23, 59, 59, 999)

    // Find all retreats that overlap with the range
    const range = retreats.filter((r) => {
      const rStart = parseLocalDate(r.startDate)
      const rEnd = parseLocalDate(r.endDate)
      // A retreat overlaps if it starts before toDate AND ends after fromDate
      // For single-day retreats rStart === rEnd, so rEnd >= fromDate handles it
      return rStart <= toDate && rEnd >= fromDate
    })

    // Collect all unique attendee IDs across the range
    const allAttendeeIds = new Set<string>()
    range.forEach((r) => getAttendeeIds(r).forEach((id) => allAttendeeIds.add(id)))

    const result =
      filterType === 'attended'
        ? servantees.filter((s) => allAttendeeIds.has(s._id))
        : servantees.filter((s) => !allAttendeeIds.has(s._id))

    setFiltered(result)
    setHasSearched(true)
    setPage(1)
  }

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Export PDF ──────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (filtered.length === 0) { toast.info('لا يوجد بيانات للتصدير'); return }
    try {
      setLoadingPdf(true)
      const [{ default: jsPDF }, { default: autoTable, applyPlugin }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      applyPlugin(jsPDF)
      const doc = new jsPDF({ orientation: 'p', unit: 'pt' })
      doc.addFileToVFS('Amiri-Regular.ttf', b64font)
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal')
      doc.setFont('Amiri')
      doc.setFontSize(16)
      doc.text('نتائج البحث عن المخدومين', 540, 40, { align: 'right' })
      ;(doc as any).autoTable({
        body: filtered.map((s) => [s.phone, s.name]),
        styles: { font: 'Amiri', halign: 'right' },
        margin: { right: 40, left: 40 },
        startY: 70,
      })
      doc.save('نتائج_البحث.pdf')
      toast.success('تم إنشاء ملف PDF بنجاح ✅')
    } catch {
      toast.error('حدث خطأ أثناء إنشاء ملف PDF')
    } finally {
      setLoadingPdf(false)
    }
  }

  // ── Export Excel ────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    if (filtered.length === 0) { toast.info('لا يوجد بيانات للتصدير'); return }
    try {
      setLoadingExcel(true)
      const XLSX = await import('xlsx')
      const worksheet = XLSX.utils.json_to_sheet(
        filtered.map((s) => ({ الموبايل: s.phone, الاسم: s.name }))
      )
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Results')
      XLSX.writeFile(workbook, 'نتائج_البحث.xlsx')
      toast.success('تم إنشاء ملف Excel بنجاح ✅')
    } catch {
      toast.error('حدث خطأ أثناء إنشاء ملف Excel')
    } finally {
      setLoadingExcel(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <Search className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">بحث الحضور في الخلوات</h1>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        {/* 3-col grid on md+, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">من خلوة</label>
            <Select onValueChange={setStartRetreatId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر البداية" />
              </SelectTrigger>
              <SelectContent>
                {retreats.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.name} ({format(parseLocalDate(r.startDate), 'yyyy-MM-dd')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">إلى خلوة</label>
            <Select onValueChange={setEndRetreatId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر النهاية" />
              </SelectTrigger>
              <SelectContent>
                {retreats.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.name} ({format(parseLocalDate(r.startDate), 'yyyy-MM-dd')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">نوع البحث</label>
            <Select
              value={filterType}
              onValueChange={(v) => setFilterType(v as 'attended' | 'notAttended')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attended">حضر</SelectItem>
                <SelectItem value="notAttended">لم يحضر</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button className="w-full lg:w-auto gap-2" onClick={handleSearch}>
          <Search className="h-4 w-4" />
          بحث
        </Button>
      </Card>

      {/* Results summary + export */}
      {hasSearched && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">نتائج البحث</span>
            <Badge variant="secondary">{filtered.length}</Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={loadingPdf}
              className="gap-1"
            >
              <FileDown className="h-4 w-4" />
              {loadingPdf ? 'جارٍ إنشاء PDF...' : 'PDF'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={loadingExcel}
              className="gap-1"
            >
              <FileDown className="h-4 w-4" />
              {loadingExcel ? 'جارٍ إنشاء Excel...' : 'Excel'}
            </Button>
          </div>
        </div>
      )}

      {/* Results Table (desktop) */}
      {hasSearched && (
        <>
          <Card className="hidden lg:block p-4 shadow-sm overflow-x-auto">
            <Table className="min-w-full text-right">
              <TableCaption>
                {filtered.length === 0
                  ? 'لا يوجد نتائج'
                  : `عرض ${paginated.length} من ${filtered.length} — صفحة ${page} / ${totalPages}`}
              </TableCaption>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الموبايل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-12">
                      لا يوجد نتائج
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((s, i) => (
                    <TableRow key={s._id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {(page - 1) * PAGE_SIZE + i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.phone}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Results Cards (mobile) */}
          <div className="lg:hidden space-y-2">
            {paginated.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">لا يوجد نتائج</p>
            ) : (
              paginated.map((s, i) => (
                <Card key={s._id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.phone}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </span>
                </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronRight className="h-4 w-4 ml-1" /> السابق
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                التالي <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}