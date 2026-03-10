'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/api'
import { format } from 'date-fns'
import { CalendarDays, MapPin, Info } from 'lucide-react'

interface ServanteeDetailsDialogProps {
  servanteeId: string
  servanteeName: string
}

export default function ServanteeDetailsDialog({
  servanteeId,
  servanteeName,
}: ServanteeDetailsDialogProps) {
  const [retreats, setRetreats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleOpen = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const data = await apiFetch<{ retreats: any[] }>(
        `/api/retreats/servantee/${servanteeId}`
      )
      // Sort by most recent first
      const sorted = (data.retreats ?? []).sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      )
      setRetreats(sorted)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const lastRetreat = retreats[0] ?? null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleOpen} className="gap-1">
          <Info className="h-3.5 w-3.5" />
          تفاصيل
        </Button>
      </DialogTrigger>

      <DialogContent dir="rtl" className="w-[95vw] max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{servanteeName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-muted-foreground animate-pulse">
            جاري التحميل...
          </p>
        ) : (
          <div className="space-y-5 mt-2">

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{retreats.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">عدد الخلوات</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">
                  {lastRetreat
                    ? format(new Date(lastRetreat.startDate), 'yyyy')
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">آخر خلوة</p>
              </div>
            </div>

            {/* Retreat list */}
            {retreats.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                لم يتم الاشتراك في خلوات بعد
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {retreats.map((r) => (
                  <div
                    key={r._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-lg p-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{r.name}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {format(new Date(r.startDate), 'yyyy-MM-dd')}
                        </span>
                        {r.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {r.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0 self-start sm:self-center">
                      {format(new Date(r.startDate), 'yyyy')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}