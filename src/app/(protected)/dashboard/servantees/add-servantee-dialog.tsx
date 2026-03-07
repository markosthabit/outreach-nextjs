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
const servanteeSchema = z.object({
  name: z.string().min(1, 'الإسم مطلوب'),
  phone: z.string().optional(),
  church: z.string().optional(),
  education: z.string().optional(),
  year: z.string().optional(),
})

type ServanteeFormData = z.infer<typeof servanteeSchema>

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

    const payload = {
      ...values,
    }

    await apiFetch('/servantees', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    toast.success('تم إضافة المخدوم بنجاح ✅', {
      description: `الإسم: ${values.name}`,
      duration: 3000,
    })

    form.reset()
    setOpen(false)
    onAdded() // refresh the table
  } catch (err: any) {
    console.error('Error adding servantee:', err)

    let message = 'حدث خطأ أثناء الإضافة'
    let statusCode = 0

    try {
      if (typeof err === 'string') {
        const parsed = JSON.parse(err)
        message = parsed.message || message
        statusCode = parsed.statusCode || 0
      } else if (err.message && err.message.startsWith('{')) {
        const parsed = JSON.parse(err.message)
        message = parsed.message || message
        statusCode = parsed.statusCode || 0
      } else if (err.statusCode) {
        message = err.message || message
        statusCode = err.statusCode
      }
    } catch {}

    if (statusCode === 409) {
      toast.error('رقم التليفون مستخدم بالفعل!')
    } else {
      toast.error(message)
    }
  } finally {
    setLoading(false)
  }
}



  return (
    
    <Dialog open={open} onOpenChange={setOpen}>

      <DialogTrigger asChild>
        <Button>إضافة مخدوم</Button>
      </DialogTrigger>

      <DialogContent dir="rtl" className="max-w-md ">
        <DialogHeader>
          <DialogTitle>إضافة مخدوم جديد</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-8">
          <div>
            <Label>الإسم</Label>
            <Input className="mt-1" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>
            )}
          </div>
<div>
  <Label>التليفون</Label>
  <Input className="mt-2" {...form.register('phone')} />
  {form.formState.errors.phone && (
    <p className="text-red-500 text-sm">{form.formState.errors.phone.message}</p>
  )}
</div>


          <div>
            <Label>الكنيسة</Label>
            <Input className="mt-2" {...form.register('church')} />
          </div>

          <div>
            <Label>الدراسة</Label>
            <Input className="mt-2" {...form.register('education')} />
          </div>

          <div>
            <Label>الفرقة</Label>
            <Input className="mt-2" {...form.register('year')} />
          </div>




          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'جاري الحفظ...' : 'إضافة'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
