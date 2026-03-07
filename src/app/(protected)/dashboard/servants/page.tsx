'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

import { Plus, Pencil, ShieldAlert } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import { EntityDialog } from '@/components/shared/entity-dialog'
import { ConfirmDeleteDialog } from '@/components/shared/delete-dialog'
import { useAuth } from '@/contexts/AuthContext'

// 🧠 Define the fields used in the dialog (for both create & edit)
const servantFields = [
    { name: 'name', label: 'الإسم', type: 'text', required: true },
  { name: 'email', label: 'البريد الإلكتروني', type: 'email', required: true },
  { name: 'password', label: 'كلمة المرور', type: 'password', required: true },
  { name: 'role', label: 'الدور', type: 'select', options: [
    { value: 'Admin', label: 'مسؤول' },
    { value: 'Servant', label: 'خادم' },
  ] },
]

export default function ServantsPage() {
  const { user } = useAuth();

// While loading or no user yet
  if (!user) {
    return <p className="text-center mt-10 text-muted-foreground">جارٍ التحميل...</p>;
  }

  // Check for admin role
    const isAdmin = user.role==='Admin';

  if (!isAdmin) {
    return (
      <Card className="p-6 max-w-md mx-auto mt-20 text-center shadow-sm">
        <h2 className="text-xl font-semibold mb-2">غير مسموح بالوصول</h2>
        <p className="text-muted-foreground">
          هذه الصفحة متاحة فقط للمسؤولين (Admins).
        </p>
      </Card>
    );
  }

  const [servants, setServants] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedServant, setSelectedServant] = useState<any | null>(null)

  async function fetchServants() {
    try {
      setLoading(true)
      const data: any = await apiFetch('/users')
      setServants(data)
    } catch (err) {
      console.error(err)
      toast.error('فشل تحميل قائمة الخدام')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServants()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-right">الخدام</h1>
        <EntityDialog
          title="إضافة خادم جديد"
          endpoint="users"
          fields={servantFields}
          mode="create"
          onSuccess={fetchServants}
          trigger={
            <Button>
              <Plus className="w-4 h-4 ml-2" /> إضافة خادم
            </Button>
          }
        />
      </div>

      {/* Table */}
      <Card className="p-4 shadow-sm overflow-x-auto">
        <Table className="min-w-full text-right">
          <TableCaption>
            {servants.length === 0 && !loading && 'لا يوجد خدام'}
          </TableCaption>

          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className='text-right'>الإسم</TableHead>
              <TableHead className='text-right'>البريد الإلكتروني</TableHead>

              <TableHead className='text-right'>الدور</TableHead>
              <TableHead className="w-[160px] text-center">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {servants.map((s) => (
              <TableRow
                key={s._id}
                onClick={() => setSelectedServant(s)}
                className={`cursor-pointer ${selectedServant?._id === s._id ? 'bg-muted/30' : ''}`}
              >
                 <TableCell>{s.name}</TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell>{s.role === 'Admin' ? 'مسؤول' : 'خادم'}</TableCell>
                <TableCell className="flex gap-2 justify-end">
                  <EntityDialog
                    title="تعديل بيانات الخادم"
                    endpoint="users"
                    // fields={servantFields.filter(f => f.name !== 'password')} // don't edit password here
                    fields={servantFields} // allow editing passwords
                    mode="edit"
                    initialData={s}
                    onSuccess={fetchServants}
                    trigger={<Button variant="outline" size="sm"><Pencil className="w-4 h-4" /></Button>}
                  />
                  <ConfirmDeleteDialog
                    title="حذف خادم"
                    description={`هل أنت متأكد أنك ترغب في حذف الخادم "${s.name}"؟`}
                    onConfirm={async () => {
                      try {
                        await apiFetch(`/users/${s._id}`, { method: 'DELETE' })
                        toast.success('تم حذف الخادم بنجاح')
                        fetchServants()
                        if (selectedServant?._id === s._id) setSelectedServant(null)
                      } catch (err) {
                        console.error(err)
                        toast.error('حدث خطأ أثناء حذف الخادم')
                      }
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
