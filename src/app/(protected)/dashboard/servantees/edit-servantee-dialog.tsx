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

const fields: { key: keyof ServanteeFormData; label: string }[] = [
  { key: 'name', label: 'الإسم' },
  { key: 'phone', label: 'التليفون' },
  { key: 'church', label: 'الكنيسة' },
  { key: 'education', label: 'الدراسة' },
  { key: 'year', label: 'الفرقة' },
]

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
      name: servantee.name ?? '',
      phone: servantee.phone ?? '',
      church: servantee.church ?? '',
      education: servantee.education ?? '',
      year: servantee.year ?? '',
    },
  })

  const onSubmit = async (values: ServanteeFormData) => {
    try {
      setLoading(true)
      await apiFetch(`/api/servantees/${servantee._id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      })
      toast.success('تم تحديث بيانات المخدوم')
      onUpdated()
      setOpen(false)
    } catch (err: any) {
      if (err?.statusCode === 409) {
        toast.error('رقم التليفون مستخدم بالفعل!')
      } else {
        toast.error(err?.message || 'حدث خطأ أثناء التحديث')
      }
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

      <DialogContent dir="rtl" className="w-[95vw] max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>تعديل بيانات المخدوم</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* 2-col grid on sm+, single col on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ key, label }) => (
              <div key={key} className={key === 'name' ? 'sm:col-span-2' : ''}>
                <Label className="text-sm">{label}</Label>
                <Input className="mt-1" {...form.register(key)} />
                {form.formState.errors[key] && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors[key]?.message}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'جاري الحفظ...' : 'تحديث'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}