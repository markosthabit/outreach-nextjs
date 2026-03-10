'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCaption, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, UserCog } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import { EntityDialog } from '@/components/shared/entity-dialog'
import { ConfirmDeleteDialog } from '@/components/shared/delete-dialog'
import { useAuth } from '@/contexts/AuthContext'

const servantFields = [
  { name: 'name', label: 'الإسم', type: 'text', required: true },
  { name: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
  { name: 'password', label: 'كلمة المرور', type: 'password', required: true },
  {
    name: 'role', label: 'الدور', type: 'select',
    options: [
      { value: 'Admin', label: 'مسؤول' },
      { value: 'Servant', label: 'خادم' },
    ],
  },
]

export default function ServantsPage() {
  const { user } = useAuth()
  const [servants, setServants] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const isAdmin = user?.role === 'Admin'

  async function fetchServants() {
    try {
      setLoading(true)
      const res = await apiFetch<{ users: any[] }>('/api/users')
      setServants(res.users ?? [])
    } catch {
      toast.error('فشل تحميل قائمة الخدام')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) fetchServants()
  }, [isAdmin])

  // ── Access guard ────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground animate-pulse">جارٍ التحميل...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <Card className="p-6 max-w-md mx-auto mt-20 text-center shadow-sm">
        <h2 className="text-xl font-semibold mb-2">غير مسموح بالوصول</h2>
        <p className="text-muted-foreground">هذه الصفحة متاحة فقط للمسؤولين.</p>
      </Card>
    )
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <UserCog className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">الخدام</h1>
          <Badge variant="secondary">{servants.length}</Badge>
        </div>
        <EntityDialog
          title="إضافة خادم جديد"
          endpoint="api/users"
          fields={servantFields}
          mode="create"
          onSuccess={fetchServants}
          trigger={
            <Button className="w-full lg:w-auto gap-2">
              <Plus className="w-4 h-4" /> إضافة خادم
            </Button>
          }
        />
      </div>

      {/* Desktop Table */}
      <Card className="hidden lg:block p-4 shadow-sm overflow-x-auto">
        <Table className="min-w-full text-right">
          <TableCaption>
            {servants.length === 0 && !loading ? 'لا يوجد خدام' : `عدد الخدام: ${servants.length}`}
          </TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">الإسم</TableHead>
              <TableHead className="text-right">البريد الإلكتروني</TableHead>
              <TableHead className="text-right">الدور</TableHead>
              <TableHead className="text-right w-[140px]">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12 animate-pulse">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : servants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  لا يوجد خدام
                </TableCell>
              </TableRow>
            ) : (
              servants.map((s) => (
                <TableRow key={s._id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email}</TableCell>
                  <TableCell>
                    <Badge variant={s.role === 'Admin' ? 'default' : 'secondary'}>
                      {s.role === 'Admin' ? 'مسؤول' : 'خادم'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <EntityDialog
                        title="تعديل بيانات الخادم"
                        endpoint={`api/users`}
                        fields={servantFields}
                        mode="edit"
                        initialData={s}
                        onSuccess={fetchServants}
                        trigger={
                          <Button variant="outline" size="icon">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        }
                      />
                      <ConfirmDeleteDialog
                        title="حذف خادم"
                        description={`هل أنت متأكد أنك ترغب في حذف الخادم "${s.name}"؟`}
                        onConfirm={async () => {
                          try {
                            await apiFetch(`/api/users/${s._id}`, { method: 'DELETE' })
                            toast.success('تم حذف الخادم بنجاح')
                            fetchServants()
                          } catch {
                            toast.error('حدث خطأ أثناء حذف الخادم')
                          }
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground animate-pulse py-12">جاري التحميل...</p>
        ) : servants.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا يوجد خدام</p>
        ) : (
          servants.map((s) => (
            <Card key={s._id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.email}</p>
                </div>
                <Badge variant={s.role === 'Admin' ? 'default' : 'secondary'} className="shrink-0">
                  {s.role === 'Admin' ? 'مسؤول' : 'خادم'}
                </Badge>
              </div>
              <div className="flex gap-2 pt-1 border-t">
                <EntityDialog
                  title="تعديل بيانات الخادم"
                  endpoint={`api/users`}
                  fields={servantFields}
                  mode="edit"
                  initialData={s}
                  onSuccess={fetchServants}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-1">
                      <Pencil className="w-3.5 h-3.5" /> تعديل
                    </Button>
                  }
                />
                <ConfirmDeleteDialog
                  title="حذف خادم"
                  description={`هل أنت متأكد أنك ترغب في حذف الخادم "${s.name}"؟`}
                  onConfirm={async () => {
                    try {
                      await apiFetch(`/api/users/${s._id}`, { method: 'DELETE' })
                      toast.success('تم حذف الخادم بنجاح')
                      fetchServants()
                    } catch {
                      toast.error('حدث خطأ أثناء حذف الخادم')
                    }
                  }}
                />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}