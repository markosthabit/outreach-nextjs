'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { format } from 'date-fns'

interface ServanteeDetailsDialogProps {
  servanteeId: string
  servanteeName: string
}

export default function ServanteeDetailsDialog({ servanteeId, servanteeName }: ServanteeDetailsDialogProps) {
  const [retreats, setRetreats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleOpen = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const data: any = await apiFetch(`/retreats/servantee/${servanteeId}`)
      setRetreats(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const lastRetreat = retreats.length > 0 ? retreats[0] : null

  return (
    <Dialog  open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={handleOpen}>
          تفاصيل
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader >
          <DialogTitle> {servanteeName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="py-4">جاري التحميل...</p>
        ) : (
          <div className="space-y-3">
            <p>عدد الخلوات: <strong>{retreats.length}</strong></p>
            {lastRetreat ? (
              <p>آخر خلوة: <strong>{lastRetreat.name}</strong> ({format(new Date(lastRetreat.startDate), 'yyyy-MM-dd')})</p>
            ) : (
              <p>لم يتم الإشتراك في خلوات بعد</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
