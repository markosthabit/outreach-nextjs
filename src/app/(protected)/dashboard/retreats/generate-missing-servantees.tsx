"use client"

import { Button } from "@/components/ui/button"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { useState } from "react"
import { b64font } from "@/lib/fonts/amiri-font"
import * as XLSX from "xlsx"

type Props = {
  retreatId: string
  retreatName: string
}

export default function GenerateMissingServantees({ retreatId, retreatName }: Props) {
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)

 async function getMissingServantees() {
  // Fetch all servantees in one call — no pagination needed
  const res = await apiFetch<{ servantees: any[] }>('/api/servantees')
  const allServantees = res.servantees ?? []

  // Extract the retreat object correctly
  const retreatRes = await apiFetch<{ retreat: any }>(`/api/retreats/${retreatId}`)
  const attendeeIds = (retreatRes.retreat?.attendees || []).map((a: any) =>
    typeof a === 'string' ? a : a._id
  )

  return allServantees.filter((s) => !attendeeIds.includes(s._id))
}

  const handleGeneratePDF = async () => {
    try {
      setLoadingPdf(true)
      const missing = await getMissingServantees()

      if (missing.length === 0) {
        toast.info("كل المخدومين مشاركين في الخلوة 🎉")
        return
      }

      const doc = new jsPDF({ orientation: "p", unit: "pt" })
      doc.addFileToVFS("Amiri-Regular.ttf", b64font)
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal")
      doc.setFont("Amiri")
      doc.setFontSize(16)

      doc.text(`قائمة المخدومين غير المشاركين في خلوة ${retreatName}`, 550, 60, {
        align: "right",
      })

      const names = missing.map((s) => s.name || "-")
      const rows = []
      for (let i = 0; i < names.length; i += 3) {
        rows.push([names[i], names[i + 1] || "", names[i + 2] || ""])
      }

      autoTable(doc, {
        startY: 90,
        body: rows,
        styles: {
          font: "Amiri",
          fontStyle: "normal",
          halign: "right",
          textColor: [0, 0, 0],
          cellWidth: "wrap",
        },
        margin: { right: 40, left: 40 },
      })

      doc.save(`المخدومين_غير_المشاركين_${retreatName}.pdf`)
      toast.success("تم إنشاء ملف PDF بنجاح ✅")
    } catch (err) {
      console.error(err)
      toast.error("حدث خطأ أثناء إنشاء ملف PDF")
    } finally {
      setLoadingPdf(false)
    }
  }

  const handleGenerateExcel = async () => {
    try {
      setLoadingExcel(true)
      const missing = await getMissingServantees()

      if (missing.length === 0) {
        toast.info("كل المخدومين مشاركين في الخلوة 🎉")
        return
      }

      const data = missing.map((s) => ({ الاسم: s.name || "-" }))
      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Missing")

      XLSX.writeFile(workbook, `المخدومين_غير_المشاركين_${retreatName}.xlsx`)
      toast.success("تم إنشاء ملف Excel بنجاح ✅")
    } catch (err) {
      console.error(err)
      toast.error("حدث خطأ أثناء إنشاء ملف Excel")
    } finally {
      setLoadingExcel(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleGeneratePDF} disabled={loadingPdf}>
        {loadingPdf ? "جارٍ إنشاء PDF..." : "تصدير غير المشاركين PDF"}
      </Button>

      <Button onClick={handleGenerateExcel} disabled={loadingExcel}>
        {loadingExcel ? "جارٍ إنشاء Excel..." : "تصدير غير المشاركين Excel"}
      </Button>
    </div>
  )
}
