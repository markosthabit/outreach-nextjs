'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { Pencil, Church, GraduationCap } from 'lucide-react'
import { FuzzyAutocompleteInput } from '@/components/shared/fuzzy-autocomplete-input'
import {
  buildClusteredOptions,
  normalizeChurchName,
  normalizeCollegeName,
} from '@/lib/servantee-filters'

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
  { key: 'birthDate', label: 'تاريخ الميلاد' },
  { key: 'diocese', label: 'الأبرشية' },
  { key: 'year', label: 'الفرقة' },
  { key: 'church', label: 'الكنيسة' },
  { key: 'education', label: 'الدراسة' },
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
  const [existingServantees, setExistingServantees] = useState<any[]>([])

  const form = useForm<ServanteeFormData>({
    resolver: zodResolver(servanteeSchema),
    defaultValues: {
      name: servantee.name ?? '',
      phone: servantee.phone ?? '',
      diocese: servantee.diocese ?? '',
      birthDate: servantee.birthDate ? new Date(servantee.birthDate).toISOString().split('T')[0] : '',
      church: servantee.church ?? '',
      education: servantee.education ?? '',
      year: servantee.year ?? '',
    },
  })

  // Load existing servantees for suggestions
  useEffect(() => {
    if (open && existingServantees.length === 0) {
      apiFetch<{ servantees: any[] }>('/api/servantees')
        .then((res) => setExistingServantees(res.servantees ?? []))
        .catch(() => {})
    }
  }, [open, existingServantees.length])

  const churchOptions = useMemo(
    () => buildClusteredOptions(existingServantees, (s) => s.church, normalizeChurchName),
    [existingServantees]
  )

  const collegeOptions = useMemo(
    () => buildClusteredOptions(existingServantees, (s) => s.education, normalizeCollegeName),
    [existingServantees]
  )

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

      <DialogContent dir="rtl" className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>تعديل بيانات المخدوم</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* 2-col grid on sm+, single col on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ key, label }) => (
              <div key={key} className={key === 'name' || key === 'church' || key === 'education' ? 'sm:col-span-2' : ''}>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  {key === 'church' && <Church className="h-3.5 w-3.5 text-primary" />}
                  {key === 'education' && <GraduationCap className="h-3.5 w-3.5 text-primary" />}
                  {label}
                </Label>

                {key === 'church' ? (
                  <FuzzyAutocompleteInput
                    id="edit-church"
                    value={form.watch('church') || ''}
                    onChange={(val) => form.setValue('church', val, { shouldValidate: true, shouldDirty: true })}
                    options={churchOptions}
                    normalizer={normalizeChurchName}
                    icon={<Church className="h-3.5 w-3.5" />}
                    placeholder="اكتب اسم الكنيسة أو اختر..."
                    labelTitle="الكنائس المقترحة"
                    className="mt-1"
                  />
                ) : key === 'education' ? (
                  <FuzzyAutocompleteInput
                    id="edit-education"
                    value={form.watch('education') || ''}
                    onChange={(val) => form.setValue('education', val, { shouldValidate: true, shouldDirty: true })}
                    options={collegeOptions}
                    normalizer={normalizeCollegeName}
                    icon={<GraduationCap className="h-3.5 w-3.5" />}
                    placeholder="اكتب الكلية أو اختر..."
                    labelTitle="الكليات المقترحة"
                    className="mt-1"
                  />
                ) : (
                  <Input type={key === 'birthDate' ? 'date' : 'text'} className="mt-1" {...form.register(key)} />
                )}

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