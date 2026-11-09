'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { toLocalDateInput } from './outreach-utils'

interface CreateRoundDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeCycleId: string | null
  onSuccess: () => void
}

function defaults() {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30)
  const month = now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })
  return { name: `جولة ${month}`, startDate: toLocalDateInput(now), endDate: toLocalDateInput(end) }
}

export function CreateRoundDialog({ open, onOpenChange, activeCycleId, onSuccess }: CreateRoundDialogProps) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  // Fresh defaults every time the dialog opens
  useEffect(() => {
    if (!open) return
    const d = defaults()
    setName(d.name)
    setStartDate(d.startDate)
    setEndDate(d.endDate)
  }, [open])

  const dateError = startDate && endDate && startDate > endDate ? 'تاريخ البداية لازم يبقى قبل تاريخ النهاية' : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('اكتب اسم الجولة')
    if (!startDate || !endDate) return toast.error('حدد فترة الجولة')
    if (dateError) return toast.error(dateError)

    try {
      setLoading(true)
      await apiFetch('/api/outreach/rounds', {
        method: 'POST',
        body: JSON.stringify({ cycleId: activeCycleId, name: name.trim(), startDate, endDate }),
      })
      toast.success('الجولة اتعملت')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نعمل الجولة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
                <Plus className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg">جولة افتقاد جديدة</DialogTitle>
            </div>
            <DialogDescription className="text-sm">
              اكتب اسم الجولة والفترة اللي الخدام هيفتقدوا فيها.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="roundName" className="block">اسم الجولة</Label>
              <Input id="roundName" value={name} onChange={(e) => setName(e.target.value)} autoFocus dir="rtl" />
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="block">من تاريخ</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="block">إلى تاريخ</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  dir="ltr"
                  required
                  aria-invalid={!!dateError}
                />
              </div>
            </div>
            {dateError && <p className="text-xs text-destructive">{dateError}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              رجوع
            </Button>
            <Button type="submit" disabled={loading || !!dateError}>
              {loading ? 'بنعمل الجولة...' : 'اعمل الجولة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
