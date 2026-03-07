'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

export function EntityDialog({
  title,
  endpoint,
  fields,
  mode,
  initialData,
  onSuccess,
  trigger,
}: {
  title: string
  endpoint: string
  fields: {
    name: string
    label: string
    type?: string
    options?: { value: string; label: string }[]
  }[]
  mode: 'create' | 'edit'
  initialData?: any
  onSuccess?: () => void
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, reset, setValue, watch } = useForm()

  // ✅ Reset form when dialog opens or initialData changes
  useEffect(() => {
    if (open) {
      const prefilled = { ...initialData }
      fields.forEach((f) => {
        if (f.type === 'date' && prefilled?.[f.name]) {
          prefilled[f.name] = new Date(prefilled[f.name]).toISOString().split('T')[0]
        }
      })
      reset(prefilled || {})
    }
  }, [open, initialData, fields, reset])

  const onSubmit = async (data: any) => {
    try {
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const url = mode === 'create' ? `/${endpoint}` : `/${endpoint}/${initialData._id}`
      const formattedData = { ...data }

      // Clean unwanted fields
      delete formattedData._id
      delete formattedData.createdAt
      delete formattedData.updatedAt
      delete formattedData.__v

      // Convert date strings to ISO
      fields.forEach((f) => {
        if (f.type === 'date' && formattedData[f.name]) {
          formattedData[f.name] = new Date(formattedData[f.name]).toISOString()
        }
      })

      await apiFetch(url, { method, body: JSON.stringify(formattedData) })

      toast.success(mode === 'create' ? 'تمت الإضافة بنجاح' : 'تم التعديل بنجاح')
      setOpen(false)
      onSuccess?.()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={mode === 'edit' ? 'outline' : 'default'}>
            {mode === 'edit' ? 'تعديل' : 'إضافة'}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              <Label className="pb-2 pt-4 block" htmlFor={field.name}>
                {field.label}
              </Label>

              {/* 🟢 Handle Select Fields */}
              {field.type === 'select' && field.options ? (
                <Select
                  onValueChange={(value) => setValue(field.name, value)}
                  defaultValue={initialData?.[field.name] ?? ''}
                >
                  <SelectTrigger id={field.name}>
                    <SelectValue placeholder="اختر..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.name}
                  type={field.type || 'text'}
                  defaultValue={
                    field.type === 'date' && initialData?.[field.name]
                      ? new Date(initialData[field.name]).toISOString().split('T')[0]
                      : initialData?.[field.name] ?? ''
                  }
                  {...register(field.name)}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit">{mode === 'create' ? 'إضافة' : 'حفظ التعديلات'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
