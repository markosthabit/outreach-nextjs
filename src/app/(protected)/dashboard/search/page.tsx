'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiFetch } from '@/lib/api'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { b64font } from '@/lib/fonts/amiri-font'

interface Retreat {
  _id: string
  name: string
  startDate: string
  endDate: string
  attendees: string[]
}

interface Servantee {
  _id: string
  name: string
  phone: string
}

function getAttendeeIds(retreat: Retreat): string[] {
  if (!retreat?.attendees) return []
  return (retreat.attendees as any[]).map(a => (typeof a === 'string' ? a : a._id))
}

async function fetchAllServantees(): Promise<Servantee[]> {
  let page = 1
  const limit = 100
  let all: Servantee[] = []
  let hasMore = true

  while (hasMore) {
    const res: any = await apiFetch(`/servantees?page=${page}&limit=${limit}`)
    if (!res.data || res.data.length === 0) break
    all = [...all, ...res.data]
    hasMore = res.pages && page < res.pages
    page++
  }
  return all
}

export default function SearchPage() {
  const [retreats, setRetreats] = useState<Retreat[]>([])
  const [servantees, setServantees] = useState<Servantee[]>([])
  const [startRetreatId, setStartRetreatId] = useState<string | null>(null)
  const [endRetreatId, setEndRetreatId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'attended' | 'notAttended'>('attended')
  const [filtered, setFiltered] = useState<Servantee[]>([])
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)

  useEffect(() => {
    fetchRetreats()
    fetchAllServantees().then(setServantees)
  }, [])

  async function fetchRetreats() {
    const res: any = await apiFetch('/retreats')
    const sorted = res.data.sort((a: Retreat, b: Retreat) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    setRetreats(sorted)
  }

 function handleSearch() {
  if (!startRetreatId || !endRetreatId) {
    setFiltered([])
    setPage(1)
    return
  }

  const startRetreat = retreats.find(r => r._id === startRetreatId)
  const endRetreat   = retreats.find(r => r._id === endRetreatId)

  if (!startRetreat || !endRetreat) {
    setFiltered([])
    setPage(1)
    return
  }

  const fromDate = new Date(
    Math.min(
      new Date(startRetreat.startDate).getTime(),
      new Date(endRetreat.startDate).getTime()
    )
  )

  const toDate = new Date(
    Math.max(
      new Date(startRetreat.endDate).getTime(),
      new Date(endRetreat.endDate).getTime()
    )
  )

  const range = retreats.filter(r => {
    const rStart = new Date(r.startDate)
    const rEnd   = new Date(r.endDate)

    return rStart <= toDate && rEnd >= fromDate
  })

  const allAttendeeIds = new Set<string>()
  range.forEach(r => getAttendeeIds(r).forEach(id => allAttendeeIds.add(id)))

  const result =
    filterType === 'attended'
      ? servantees.filter(s => allAttendeeIds.has(s._id))
      : servantees.filter(s => !allAttendeeIds.has(s._id))

  setFiltered(result)
  setPage(1)
}


  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)

  const handleExportPDF = async () => {
    try {
      if (filtered.length === 0) {
        toast.info("لا يوجد بيانات للتصدير")
        return
      }

      setLoadingPdf(true)

      const [{ default: jsPDF }, { default: autoTable, applyPlugin }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ])
      applyPlugin(jsPDF)

      const doc = new jsPDF({ orientation: "p", unit: "pt" })
      doc.addFileToVFS("Amiri-Regular.ttf", b64font)
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal")
      doc.setFont("Amiri")
      doc.setFontSize(16)

      doc.text("نتائج البحث عن المخدومين", 540, 40, { align: "right" })

      const rows = filtered.map(s => [s.phone, s.name])

      ;(doc as any).autoTable({
        body: rows,
        styles: { font: "Amiri", halign: "right" },
        margin: { right: 40, left: 40 },
        startY: 70
      })

      doc.save(`نتائج_البحث.pdf`)
      toast.success("تم إنشاء ملف PDF بنجاح ✅")
    } catch {
      toast.error("حدث خطأ أثناء إنشاء ملف PDF")
    } finally {
      setLoadingPdf(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      if (filtered.length === 0) {
        toast.info("لا يوجد بيانات للتصدير")
        return
      }

      setLoadingExcel(true)

      const XLSX = await import('xlsx')

      const data = filtered.map(s => ({
        الموبايل: s.phone,
        الاسم: s.name
      }))

      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results")
      XLSX.writeFile(workbook, "نتائج_البحث.xlsx")
      toast.success("تم إنشاء ملف Excel بنجاح ✅")
    } catch {
      toast.error("حدث خطأ أثناء إنشاء ملف Excel")
    } finally {
      setLoadingExcel(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-right">بحث الحضور في الخلوات</h1>

      <Card className="p-4 flex flex-row items-start justify-start gap-4">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 text-right">من خلوة</label>
          <Select onValueChange={setStartRetreatId}>
            <SelectTrigger><SelectValue placeholder="اختر البداية" /></SelectTrigger>
            <SelectContent>
              {retreats.map(r => (
                <SelectItem key={r._id} value={r._id}>
                  {r.name} ({format(new Date(r.startDate), "yyyy-MM-dd")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 text-right">إلى خلوة</label>
          <Select onValueChange={setEndRetreatId}>
            <SelectTrigger><SelectValue placeholder="اختر النهاية" /></SelectTrigger>
            <SelectContent>
              {retreats.map(r => (
                <SelectItem key={r._id} value={r._id}>
                  {r.name} ({format(new Date(r.startDate), "yyyy-MM-dd")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 text-right">نوع البحث</label>
          <Select value={filterType} onValueChange={v => setFilterType(v as "attended" | "notAttended")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="attended">حضر</SelectItem>
              <SelectItem value="notAttended">لم يحضر</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button className="self-end" onClick={handleSearch}>
          بحث
        </Button>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleExportPDF} disabled={loadingPdf}>
          {loadingPdf ? "جارٍ إنشاء PDF..." : "تصدير PDF"}
        </Button>
        <Button onClick={handleExportExcel} disabled={loadingExcel}>
          {loadingExcel ? "جارٍ إنشاء Excel..." : "تصدير Excel"}
        </Button>
      </div>

      <Card className="p-4 shadow-sm overflow-x-auto">
        <Table className="min-w-full text-right">
          <TableCaption>
            {filtered.length === 0 ? 'لا يوجد نتائج' : `عرض ${paginated.length} من ${filtered.length} (صفحة ${page}/${totalPages})`}
          </TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className='text-right'>الاسم</TableHead>
              <TableHead className='text-right'>الموبايل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(s => (
              <TableRow key={s._id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.phone}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm">صفحة {page} من {totalPages}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}