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
import { AlertTriangle, PlusCircle } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface CycleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeCycle: any | null
  mode: 'start' | 'end'
  onSuccess: () => void
}

export function CycleDialog({ open, onOpenChange, activeCycle, mode, onSuccess }: CycleDialogProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const isStart = mode === 'start'

  useEffect(() => {
    if (open) setName('')
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isStart && !name.trim()) return toast.error('اكتب اسم الدورة')
    if (!isStart && !activeCycle?._id) return

    try {
      setLoading(true)
      await apiFetch('/api/outreach/cycles', {
        method: isStart ? 'POST' : 'PATCH',
        body: JSON.stringify(isStart ? { name: name.trim() } : { cycleId: activeCycle._id, action: 'end' }),
      })
      toast.success(isStart ? 'الدورة الجديدة بدأت' : 'الدورة الحالية خلصت')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || (isStart ? 'معرفناش نبدأ الدورة' : 'معرفناش ننهي الدورة'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md text-right" dir="rtl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              {isStart ? (
                <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
                  <PlusCircle className="h-5 w-5" />
                </div>
              ) : (
                <div className="p-2 bg-destructive/10 rounded-full text-destructive shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              )}
              <DialogTitle className="text-lg">
                {isStart ? 'ابدأ دورة افتقاد جديدة' : 'إنهي دورة الافتقاد الحالية'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed">
              {isStart
                ? 'الدورة الجديدة بترجّع كل المخدومين لقايمة المتاحين للتوزيع من الأول.'
                : `الدورة "${activeCycle?.name}" وكل جولاتها الشغالة هيتقفلوا. تقاريرها هتفضل موجودة تراجعها، بس مش هينفع تضيف عليها جولات أو تكليفات جديدة.`}
            </DialogDescription>
          </DialogHeader>

          {isStart && (
            <div className="space-y-4">
              {activeCycle && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-lg text-sm flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    فيه دورة شغالة دلوقتي ({activeCycle.name}). لو بدأت دورة جديدة هتتقفل لوحدها.
                  </span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="cycleName" className="block">اسم الدورة</Label>
                <Input
                  id="cycleName"
                  placeholder="مثال: دورة الافتقاد 2026 / 2027"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  dir="rtl"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              رجوع
            </Button>
            <Button type="submit" variant={isStart ? 'default' : 'destructive'} disabled={loading}>
              {loading ? 'ثانية واحدة...' : isStart ? 'ابدأ الدورة' : 'أيوه، إنهيها'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
