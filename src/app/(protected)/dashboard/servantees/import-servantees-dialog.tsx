'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import * as xlsx from 'xlsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ImportServanteesDialogProps {
  onImported: () => void
}

export function ImportServanteesDialog({ onImported }: ImportServanteesDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setImportResult(null)
    
    try {
      const data = await file.arrayBuffer()
      const workbook = xlsx.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      
      // Convert to JSON array
      const rawJson = xlsx.utils.sheet_to_json<any>(worksheet)
      
      // Map Arabic/English headers to our schema
      const mappedData = rawJson.map((row) => {
        return {
          name: row['الإسم'] || row['الاسم'] || row['اسم'] || row['Name'] || row['name'] || '',
          phone: row['التليفون'] || row['رقم الهاتف'] || row['الموبايل'] || row['Phone'] || row['phone'] || '',
          church: row['الكنيسة'] || row['كنيسة'] || row['Church'] || row['church'] || '',
          diocese: row['الأبرشية'] || row['الابرشية'] || row['الإيبارشية'] || row['الايبارشية'] || row['Diocese'] || '',
          birthDate: row['تاريخ الميلاد'] || row['ميلاد'] || row['BirthDate'] || row['birthDate'] || null,
          education: row['الكلية'] || row['الجامعة'] || row['Education'] || row['education'] || '',
          year: row['الفرقة'] || row['السنة'] || row['Year'] || row['year'] || ''
        }
      })

      // Send to backend
      const res = await apiFetch<any>('/api/servantees/import', {
        method: 'POST',
        body: JSON.stringify({ servantees: mappedData }),
      })

      setImportResult({
        imported: res.importedCount,
        failed: res.failedCount,
        errors: res.errors
      })

      if (res.importedCount > 0) {
        toast.success(`تم استيراد ${res.importedCount} مخدوم بنجاح`)
        onImported()
      }

      if (res.failedCount > 0) {
        toast.error(`تعذر استيراد ${res.failedCount} مخدوم. يرجى مراجعة التقرير أدناه.`, { duration: 5000 })
      }
      
    } catch (err: any) {
      console.error(err)
      toast.error('حدث خطأ أثناء قراءة الملف أو استيراد البيانات')
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val)
      if (!val) setImportResult(null)
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          استيراد من إكسيل
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>استيراد المخدومين من ملف إكسيل</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            <p>يجب أن يحتوي ملف الإكسيل على أعمدة بالعناوين التالية (أو مشابهة):</p>
            <ul className="list-disc list-inside mt-2 text-right">
              <li>الإسم (مطلوب)</li>
              <li>التليفون (مطلوب)</li>
              <li>الكنيسة</li>
              <li>الأبرشية</li>
              <li>تاريخ الميلاد (بصيغة صالحة YYYY-MM-DD أو تاريخ إكسيل)</li>
              <li>الكلية</li>
              <li>الفرقة</li>
            </ul>
          </div>

          <div className="flex justify-center border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={loading}
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {loading ? 'جاري الاستيراد...' : 'اختر ملف الإكسيل'}
            </Button>
          </div>

          {importResult && (
            <div className="space-y-3 mt-4">
              <div className="flex gap-4 items-center">
                <Badge variant="outline" className="bg-green-100 text-green-800 gap-1 text-sm py-1">
                  <CheckCircle2 className="h-4 w-4" />
                  تمت الإضافة: {importResult.imported}
                </Badge>
                {importResult.failed > 0 && (
                  <Badge variant="outline" className="bg-red-100 text-red-800 gap-1 text-sm py-1">
                    <AlertCircle className="h-4 w-4" />
                    فشل: {importResult.failed}
                  </Badge>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <Alert variant="destructive" className="max-h-40 overflow-y-auto">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>أخطاء الاستيراد</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 text-xs">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Ensure Badge is imported, we can mock it here or import it
import { Badge } from '@/components/ui/badge'
