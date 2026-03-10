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
import { UserPlus } from 'lucide-react'

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

export function AddServanteeDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<ServanteeFormData>({
    resolver: zodResolver(servanteeSchema),
    defaultValues: { name: '', phone: '', church: '', education: '', year: '' },
  })

  const onSubmit = async (values: ServanteeFormData) => {
    try {
      setLoading(true)
      await apiFetch('/api/servantees', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      toast.success('تم إضافة المخدوم بنجاح ✅', {
        description: `الإسم: ${values.name}`,
        duration: 3000,
      })
      form.reset()
      setOpen(false)
      onAdded()
    } catch (err: any) {
      if (err?.statusCode === 409) {
        toast.error('رقم التليفون مستخدم بالفعل!')
      } else {
        toast.error(err?.message || 'حدث خطأ أثناء الإضافة')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto gap-2">
          <UserPlus className="h-4 w-4" />
          إضافة مخدوم
        </Button>
      </DialogTrigger>

      <DialogContent dir="rtl" className="w-[95vw] max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>إضافة مخدوم جديد</DialogTitle>
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
            {loading ? 'جاري الحفظ...' : 'إضافة'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}