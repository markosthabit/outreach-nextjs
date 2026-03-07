'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'

const servanteeSchema = z.object({
  name: z.string().min(1, 'الإسم مطلوب'),
  phone: z.string().optional(),
  church: z.string().optional(),
  education: z.string().optional(),
  year: z.string().optional(),
})

type ServanteeFormData = z.infer<typeof servanteeSchema>

export function EditServanteeDialog({
  servantee,
  onUpdated,
}: {
  servantee: any
  onUpdated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<ServanteeFormData>({
    resolver: zodResolver(servanteeSchema),
    defaultValues: {
      name: servantee.name,
      phone: servantee.phone,
      church: servantee.church,
      education: servantee.education,
      year: servantee.year,
    },
  })

  const onSubmit = async (values: ServanteeFormData) => {
    try {
      setLoading(true)
      const payload = {
        ...values
      }

      await apiFetch(`/servantees/${servantee._id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      toast.success('تم تحديث بيانات المخدوم')
      onUpdated()
      setOpen(false)
    } catch (err: any) {
      toast.error('حدث خطأ أثناء التحديث')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>

      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>تعديل بيانات المخدوم</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-8">
          {['name', 'phone', 'church', 'education', 'year'].map((key) => (
            <div key={key}>
              <Label>{{
                name: 'الإسم',
                phone: 'التليفون',
                church: 'الكنيسة',
                education: 'الدراسة',
                year: 'العمل',
              }[key]}</Label>
              {key === 'notes' ? (
                <Textarea className="mt-2" rows={2} {...form.register(key as any)} />
              ) : (
                <Input
                  className="mt-2"
                  type={key === 'birthDate' ? 'date' : 'text'}
                  {...form.register(key as any)}
                />
              )}
            </div>
          ))}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'جاري الحفظ...' : 'تحديث'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
