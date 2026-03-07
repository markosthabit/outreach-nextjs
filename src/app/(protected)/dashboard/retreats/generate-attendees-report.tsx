import { Button } from '@/components/ui/button'
import { b64font } from '@/lib/fonts/amiri-font'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'

// In FocusedRetreatCard, add this component
export function GenerateAttendeesReport({ retreat }: { retreat: any }) {
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)

  const attendees = useMemo(() => {
    const arr = (retreat.attendees || []) as any[]
    return arr.map(a => ({
      name: typeof a === 'string' ? 'غير معروف' : a.name || 'غير معروف',
      phone: typeof a === 'string' ? '-' : a.phone || '-',
    }))
  }, [retreat.attendees])

  const handlePDF = async () => {
    try {
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

      doc.text(`قائمة المشاركين في ${retreat.name}`, 540, 40, { align: "right" })

      const rows = attendees.map(a => [a.phone, a.name])

      ;(doc as any).autoTable({
        body: rows,
        styles: { font: "Amiri", halign: "right" },
        margin: { right: 40, left: 40 },
        startY: 70
      })

      doc.save(`مشاركين_${retreat.name}.pdf`)
      toast.success("تم إنشاء PDF")
    } catch {
      toast.error("خطأ في PDF")
    } finally {
      setLoadingPdf(false)
    }
  }

  const handleExcel = async () => {
    try {
      setLoadingExcel(true)
      const XLSX = await import('xlsx')
      const data  = attendees.map(a => ({ الاسم: a.name, الموبايل: a.phone }))
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Attendees")
      XLSX.writeFile(wb, `مشاركين_${retreat.name}.xlsx`)
      toast.success("تم إنشاء Excel")
    } catch {
      toast.error("خطأ في Excel")
    } finally {
      setLoadingExcel(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handlePDF} disabled={loadingPdf}>
        {loadingPdf ? "PDF..." : " تصدير المشاركين PDF"}
      </Button>
      <Button onClick={handleExcel} disabled={loadingExcel}>
        {loadingExcel ? "Excel..." : "تصدير المشاركين Excel"}
      </Button>
    </div>
  )
}
