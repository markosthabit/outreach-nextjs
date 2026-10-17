'use client'

import { useState, useMemo, useEffect, useDeferredValue } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/api'
import { findSimilarNames } from '@/lib/arabic-search'
import { toast } from 'sonner'
import { UserPlus, Users, UserCheck, AlertCircle } from 'lucide-react'

const servanteeSchema = z.object({
  name: z.string().min(1, 'الإسم مطلوب'),
  phone: z.string().optional(),
  diocese: z.string().optional(),
  birthDate: z.string().optional(),
  church: z.string().optional(),
  education: z.string().optional(),
  year: z.string().optional(),
})

type ServanteeFormData = z.infer<typeof servanteeSchema>

const fields: { key: keyof ServanteeFormData; label: string }[] = [
  { key: 'name', label: 'الإسم' },
  { key: 'phone', label: 'التليفون' },
  { key: 'diocese', label: 'الأبرشية' },
  { key: 'birthDate', label: 'تاريخ الميلاد' },
  { key: 'church', label: 'الكنيسة' },
  { key: 'education', label: 'الدراسة' },
  { key: 'year', label: 'الفرقة' },
]

export type ServanteeResponse = {
  _id: string
  name: string
  phone?: string
  church?: string
  diocese?: string
  [key: string]: any
}

export function AddServanteeDialog({
  onAdded,
  onSelectExisting,
  existingServantees,
  selectExistingLabel = 'اختيار المخدوم',
}: {
  onAdded?: (newServantee?: ServanteeResponse) => void | Promise<void>
  onSelectExisting?: (servantee: ServanteeResponse) => void | Promise<void>
  existingServantees?: ServanteeResponse[]
  selectExistingLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [internalServantees, setInternalServantees] = useState<ServanteeResponse[]>([])

  const form = useForm<ServanteeFormData>({
    resolver: zodResolver(servanteeSchema),
    defaultValues: { name: '', phone: '', diocese: '', birthDate: '', church: '', education: '', year: '' },
  })

  // Load existing servantees if not provided via props
  useEffect(() => {
    if (open && (!existingServantees || existingServantees.length === 0)) {
      apiFetch<{ servantees: ServanteeResponse[] }>('/api/servantees')
        .then((res) => setInternalServantees(res.servantees ?? []))
        .catch(() => {})
    }
  }, [open, existingServantees])

  const servanteesList = existingServantees && existingServantees.length > 0
    ? existingServantees
    : internalServantees

  const nameValue = form.watch('name') || ''
  const deferredName = useDeferredValue(nameValue)

  const phoneValue = form.watch('phone') || ''
  const deferredPhone = useDeferredValue(phoneValue)

  // Live duplicate/similarity detection
  const similarServantees = useMemo(() => {
    if (!deferredName || deferredName.trim().length < 2) return []
    return findSimilarNames(deferredName, servanteesList, 4)
  }, [deferredName, servanteesList])

  const phoneDuplicate = useMemo(() => {
    const clean = deferredPhone.trim().replace(/\D/g, '')
    if (clean.length < 8) return null
    return servanteesList.find((s) => {
      if (!s.phone) return false
      const sClean = s.phone.replace(/\D/g, '')
      return sClean === clean
    })
  }, [deferredPhone, servanteesList])

  const handleSelectExisting = async (servantee: ServanteeResponse) => {
    setOpen(false)
    form.reset()
    if (onSelectExisting) {
      await onSelectExisting(servantee)
    }
  }

  const onSubmit = async (values: ServanteeFormData) => {
    try {
      setLoading(true)
      const res = await apiFetch<{ servantee: ServanteeResponse }>('/api/servantees', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      toast.success('تم إضافة المخدوم بنجاح ✅', {
        description: `الإسم: ${values.name}`,
        duration: 3000,
      })
      form.reset()
      setOpen(false)
      if (onAdded) {
        await onAdded(res.servantee)
      }
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
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val)
      if (!val) form.reset()
    }}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto gap-2">
          <UserPlus className="h-4 w-4" />
          إضافة مخدوم
        </Button>
      </DialogTrigger>

      <DialogContent dir="rtl" className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>إضافة مخدوم جديد</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* 2-col grid on sm+, single col on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ key, label }) => (
              <div key={key} className={key === 'name' ? 'sm:col-span-2' : ''}>
                <Label className="text-sm">{label}</Label>
                <Input
                  type={key === 'birthDate' ? 'date' : 'text'}
                  className="mt-1"
                  {...form.register(key)}
                />

                {form.formState.errors[key] && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors[key]?.message}
                  </p>
                )}

                {/* Live similar names suggestions banner under Name field */}
                {key === 'name' && similarServantees.length > 0 && (
                  <div className="mt-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-amber-900 dark:text-amber-200">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span>مخدومون بأسماء مشابهة ({similarServantees.length})</span>
                      </div>
                      <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                        قد يكون مسجلاً برقم آخر
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                      {similarServantees.map(({ item, score }) => (
                        <div
                          key={item._id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-md bg-background/95 border border-amber-200/60 dark:border-amber-900/40 shadow-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-xs text-foreground truncate">
                                {item.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-4.5 px-1.5 ${
                                  score >= 90
                                    ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {score >= 90 ? 'تطابق كبير' : 'تشابه'}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                              {item.phone && <span>📞 {item.phone}</span>}
                              {item.church && <span>⛪ {item.church}</span>}
                              {item.diocese && <span>📍 {item.diocese}</span>}
                            </div>
                          </div>

                          {onSelectExisting && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 shrink-0 gap-1 border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-950/60"
                              onClick={() => handleSelectExisting(item)}
                            >
                              <UserCheck className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                              {selectExistingLabel}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-muted-foreground pt-1 border-t border-amber-200/50 dark:border-amber-900/40">
                      💡 إذا كان شخصاً مختلفاً، تابع ملء البيانات واضغط &quot;إضافة&quot; بشكل طبيعي.
                    </p>
                  </div>
                )}

                {/* Inline phone duplicate warning */}
                {key === 'phone' && phoneDuplicate && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1.5 bg-red-50 dark:bg-red-950/40 p-2 rounded-md border border-red-200 dark:border-red-900">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      هذا الرقم مسجل بالفعل للمخدوم: <strong>{phoneDuplicate.name}</strong>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button
            type="submit"
            disabled={loading || !!phoneDuplicate}
            className="w-full"
          >
            {loading ? 'جاري الحفظ...' : phoneDuplicate ? 'رقم التليفون مسجل بالفعل' : 'إضافة'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}