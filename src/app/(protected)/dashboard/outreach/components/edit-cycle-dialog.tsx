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
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { toLocalDateInput } from './outreach-utils'

interface EditCycleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycle: { _id: string; name: string; status: string; startedAt: string; endedAt?: string | null } | null
  onSuccess: () => void
}

export function EditCycleDialog({ open, onOpenChange, cycle, onSuccess }: EditCycleDialogProps) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const isCompleted = cycle?.status === 'completed'
  const initialStart = cycle?.startedAt ? toLocalDateInput(new Date(cycle.startedAt)) : ''
  const initialEnd = cycle?.endedAt ? toLocalDateInput(new Date(cycle.endedAt)) : ''

  useEffect(() => {
    if (!open || !cycle) return
    setName(cycle.name)
    setStartDate(initialStart)
    setEndDate(initialEnd)
  }, [open, cycle, initialStart, initialEnd])

  const today = toLocalDateInput(new Date())
  const dateError =
    startDate && isCompleted && endDate && startDate > endDate
      ? 'تاريخ البداية لازم يبقى قبل تاريخ النهاية'
      : startDate > today || (isCompleted && endDate > today)
      ? 'التاريخ مينفعش يبقى في المستقبل'
      : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cycle) return
    if (!name.trim()) return toast.error('اكتب اسم الدورة')
    if (!startDate || (isCompleted && !endDate)) return toast.error('حدد تاريخ الدورة')
    if (dateError) return toast.error(dateError)

    // Only send a date the user actually changed, so the original time of day is kept otherwise
    const body: Record<string, unknown> = { cycleId: cycle._id, action: 'update', name: name.trim() }
    if (startDate !== initialStart) body.startedAt = new Date(`${startDate}T00:00:00`).toISOString()
    if (isCompleted && endDate !== initialEnd) {
      const endOfDay = new Date(`${endDate}T23:59:59`).getTime()
      body.endedAt = new Date(Math.min(endOfDay, Date.now())).toISOString()
    }

    try {
      setLoading(true)
      await apiFetch('/api/outreach/cycles', { method: 'PATCH', body: JSON.stringify(body) })
      toast.success('بيانات الدورة اتحدثت')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نحدّث الدورة')
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
                <Pencil className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg">تعديل دورة الافتقاد</DialogTitle>
            </div>
            <DialogDescription className="text-sm">
              {isCompleted
                ? 'غيّر اسم الدورة أو تاريخ بدايتها ونهايتها.'
                : 'غيّر اسم الدورة أو تاريخ بدايتها. تاريخ النهاية بيتسجل لما الدورة تخلص.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="cycleName" className="block">اسم الدورة</Label>
              <Input
                id="cycleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                autoFocus
                dir="rtl"
              />
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cycleStart" className="block">تاريخ البداية</Label>
                <Input
                  id="cycleStart"
                  type="date"
                  value={startDate}
                  max={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  dir="ltr"
                  required
                />
              </div>
              {isCompleted && (
                <div className="space-y-2">
                  <Label htmlFor="cycleEnd" className="block">تاريخ النهاية</Label>
                  <Input
                    id="cycleEnd"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    max={today}
                    onChange={(e) => setEndDate(e.target.value)}
                    dir="ltr"
                    required
                    aria-invalid={!!dateError}
                  />
                </div>
              )}
            </div>
            {dateError && <p className="text-xs text-destructive">{dateError}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              رجوع
            </Button>
            <Button type="submit" disabled={loading || !!dateError}>
              {loading ? 'بنحفظ...' : 'احفظ التعديل'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
