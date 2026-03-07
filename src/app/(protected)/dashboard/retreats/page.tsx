'use client'

import { useState, useEffect, useMemo, SetStateAction } from 'react'
import { format } from 'date-fns'
import {EntityDialog} from '@/components/shared/entity-dialog'
import { ConfirmDeleteDialog } from '@/components/shared/delete-dialog'
import { SearchBar } from '@/components/shared/search-bar'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import NotesButton from '@/components/shared/notes-button'
import GenerateMissingServantees from './generate-missing-servantees'
import { GenerateAttendeesReport } from './generate-attendees-report'
// ---------- Types ----------
type Servantee = {
  _id: string
  name: string
  phone?: string
}

type Retreat = {
  _id: string
  name: string
  startDate?: string
  endDate?: string
  location?: string
  notes?: Array<{ _id?: string; content?: string }>
  attendees?: Servantee[] | string[]
}

// ---------- Fields ----------
const retreatFields= [
  { name: 'name', label: 'اسم الخلوة', required: true },
  { name: 'location', label: 'مكان الخلوة', required: true },
  { name: 'startDate', label: 'تاريخ البداية', type: 'date', required: true },
  { name: 'endDate', label: 'تاريخ النهاية', type: 'date', required: true },
]

// ---------- AttendeePicker ----------
function AttendeePicker({ retreatId, onAdded }: { retreatId: string; onAdded: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Servantee[]>([])
  const [loading, setLoading] = useState(false)

  const search = async (q: string) => {
    if (!q || q.trim().length < 1) {
      setResults([])
      return
    }
    try {
      setLoading(true)
      const params = new URLSearchParams({ search: q, limit: '10' })
      const res: any = await apiFetch(`/servantees?${params.toString()}`)
      setResults(res.data || res)
    } catch {
      toast.error('حدث خطأ أثناء البحث')
    } finally {
      setLoading(false)
    }
  }

  const addAttendee = async (servanteeId: string) => {
    try {
      setLoading(true)
      const retreat: Retreat = await apiFetch(`/retreats/${retreatId}`)
      const existing = (retreat.attendees || []).map((a: any) => (typeof a === 'string' ? a : a._id))
      if (existing.includes(servanteeId)) {
        toast.error('المخدوم مضاف بالفعل')
        return
      }
      await apiFetch(`/retreats/${retreatId}`, {
        method: 'PATCH',
        body: JSON.stringify({ attendees: [...existing, servanteeId] }),
      })
      toast.success('تمت إضافة المخدوم')
      onAdded()
      setQuery('')
      setResults([])
    } catch {
      toast.error('حدث خطأ أثناء الإضافة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="ابحث عن مخدوم..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            search(e.target.value)
          }}
        />
        <Button onClick={() => search(query)} disabled={loading || !query.trim()}>
          بحث
        </Button>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">النتائج:</p>
        <div className="mt-2 space-y-2">
          {results.length === 0 && <p className="text-sm text-muted-foreground">لا توجد نتائج</p>}
          {results.map((r) => (
            <div key={r._id} className="flex items-center justify-between border rounded p-2">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-muted-foreground">{r.phone || '-'}</div>
              </div>
              <Button size="sm" onClick={() => addAttendee(r._id)} disabled={loading}>
                إضافة
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ---------- FocusedRetreatCard ----------
function FocusedRetreatCard({
  retreat,
  onRemoveAttendee,
}: {
  retreat: Retreat
  onRemoveAttendee: (servanteeId: string) => void
}) {
  const [attendeePage, setAttendeePage] = useState(1)
  const attendeeLimit = 10

  const attendees = useMemo(() => {
    const arr = (retreat.attendees || []) as any[]
    return arr.map(a => ({
      id: typeof a === 'string' ? a : a._id,
      name: typeof a === 'string' ? a : a.name || 'غير معروف',
      phone: typeof a === 'string' ? '-' : a.phone || '-',
    }))
  }, [retreat.attendees])

  const paginated = attendees.slice((attendeePage - 1) * attendeeLimit, attendeePage * attendeeLimit)
  const totalAttendeePages = Math.ceil(attendees.length / attendeeLimit)
useEffect(() => {
  const maxPage = Math.ceil(attendees.length / attendeeLimit) || 1
  setAttendeePage(prev => prev > maxPage ? maxPage : prev)
}, [retreat._id, attendees.length])
  useEffect(() => {
    setAttendeePage(1)
  }, [retreat._id])

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{retreat.name}</h2>
          <p className="text-sm text-muted-foreground">
            {retreat.startDate ? format(new Date(retreat.startDate), 'yyyy-MM-dd') : '-'} —{' '}
            {retreat.endDate ? format(new Date(retreat.endDate), 'yyyy-MM-dd') : '-'}
          </p>
          <p className="mt-2">{retreat.location || '-'}</p>
          {retreat.notes?.length ? (
            <div className="mt-3 text-sm">
              <strong>ملاحظات:</strong>{' '}
              {(retreat.notes as any[]).map((n) => n.content || n).join(' / ')}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-medium mb-2">المشاركين ({attendees.length})</h3>
        <Card className="p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='text-right'>الإسم</TableHead>
                <TableHead className='text-right'>التليفون</TableHead>
                <TableHead className="text-right w-[140px]">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>لا يوجد مشاركين</TableCell>
                </TableRow>
              ) : (
                paginated.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.phone}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <NotesButton entityId={a.id} entityType="servantee" />
                      <ConfirmDeleteDialog
                        onConfirm={() => onRemoveAttendee(a.id)}
                        title="حذف مخدوم"
                        description="هل أنت متأكد أنك ترغب في حذف هذا المخدوم من الخلوة؟"
                        triggerLabel="حذف"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalAttendeePages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={attendeePage <= 1}
                onClick={() => setAttendeePage(p => p - 1)}
              >
                السابق
              </Button>
              <span className="text-sm self-center">
                صفحة {attendeePage} من {totalAttendeePages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={attendeePage >= totalAttendeePages}
                onClick={() => setAttendeePage(p => p + 1)}
              >
                التالي
              </Button>
            </div>
          )}
        </Card>
      </div>
    </Card>
  )
}

// ---------- RetreatsPage (Main) ----------
export default function RetreatsPage() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [retreats, setRetreats] = useState<Retreat[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRetreat, setSelectedRetreat] = useState<Retreat | null>(null)

  const fetchRetreats = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(searchTerm ? { search: searchTerm } : {}),
      })
      const res:any = await apiFetch(`/retreats?${params.toString()}`)
      setRetreats(res.data || res)
      setTotal(res.total || res.data?.length || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRetreats()
  }, [page, searchTerm])

  const totalPages = Math.ceil(total / limit)

  const refreshFocused = async () => {
    if (!selectedRetreat) return
    const refreshed: SetStateAction<Retreat | null> = await apiFetch(`/retreats/${selectedRetreat._id}`)
    setSelectedRetreat(refreshed)
  }

  const handleRemoveAttendee = async (servanteeId: string) => {
    if (!selectedRetreat) return
    const existing = (selectedRetreat.attendees || []).map((a: any) =>
      typeof a === 'string' ? a : a._id
    )
    await apiFetch(`/retreats/${selectedRetreat._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ attendees: existing.filter((id) => id !== servanteeId) }),
    })
    toast.success('تم حذف المخدوم من الخلوة')
    await refreshFocused()
    fetchRetreats()
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">الخلوات</h1>
        <EntityDialog
          title="إضافة خلوة جديدة"
          endpoint="retreats"
          fields={retreatFields}
          mode="create"
          onSuccess={fetchRetreats}
        />
      </div>

      <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="ابحث عن خلوة..." />

      <Card className="p-4 shadow-sm overflow-x-auto">
        <Table className="w-full border-separate border-spacing-0 text-right">
          <TableCaption className="text-sm text-muted-foreground">
            {retreats.length === 0 && !loading
              ? 'لا يوجد خلوات'
              : `الصفحة ${page} من ${totalPages}`}
          </TableCaption>

          <TableHeader>
            <TableRow className="bg-muted/50 text-right">
              <TableHead className="text-right font-semibold">الاسم</TableHead>
              <TableHead className="text-right font-semibold">المكان</TableHead>
              <TableHead className="text-right font-semibold">البداية</TableHead>
              <TableHead className="text-right font-semibold">النهاية</TableHead>
              <TableHead className="text-right font-semibold">المشاركين</TableHead>
              <TableHead className="text-right font-semibold w-[140px]">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {retreats.map((r) => (
              <TableRow
                key={r._id}
                onClick={() => setSelectedRetreat(r)}
                className={`cursor-pointer transition-colors ${
                  selectedRetreat?._id === r._id ? 'bg-muted/30' : 'hover:bg-muted/10'
                }`}
              >
                <TableCell className="py-3">{r.name}</TableCell>
                <TableCell className="py-3">{r.location}</TableCell>
                <TableCell className="py-3">
                  {r.startDate ? format(new Date(r.startDate), 'yyyy-MM-dd') : '-'}
                </TableCell>
                <TableCell className="py-3">
                  {r.endDate ? format(new Date(r.endDate), 'yyyy-MM-dd') : '-'}
                </TableCell>
                <TableCell className="py-3">
                  {(r.attendees && (r.attendees as any[]).length) || 0}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center justify-end gap-2">
                    <EntityDialog
                      title="تعديل خلوة"
                      endpoint="retreats"
                      fields={retreatFields}
                      mode="edit"
                      initialData={r}
                      onSuccess={fetchRetreats}
                      trigger={
                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                          <Pencil className="w-4 h-4" />
                        </Button>
                      }
                    />
                    <NotesButton entityId={r._id} entityType="retreat" />  

                    <ConfirmDeleteDialog
                      title="حذف الخلوة"
                      description={`هل أنت متأكد أنك ترغب في حذف الخلوة "${r.name}"؟`}
                      onConfirm={async () => {
                        try {
                          await apiFetch(`/retreats/${r._id}`, { method: 'DELETE' })
                          toast.success('تم حذف الخلوة بنجاح')
                          fetchRetreats()
                          if (selectedRetreat?._id === r._id) setSelectedRetreat(null)
                        } catch (err) {
                          console.error(err)
                          toast.error('حدث خطأ أثناء حذف الخلوة')
                        }
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>
          <span className="px-2 py-1 text-sm">
            الصفحة {page} من {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            التالي
          </Button>
        </div>
      )}

      {selectedRetreat && (
        <div className="grid md:grid-cols-2 gap-4">
          <FocusedRetreatCard
            retreat={selectedRetreat}
            onRemoveAttendee={handleRemoveAttendee}
          />
          <div className="space-y-4">
            <AttendeePicker
              retreatId={selectedRetreat._id}
              onAdded={async () => {
                await refreshFocused()
                fetchRetreats()
              }}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedRetreat(null)}>
                إلغاء التحديد
              </Button>
              <GenerateAttendeesReport retreat={selectedRetreat} />

              <GenerateMissingServantees
                retreatId={selectedRetreat._id}
                retreatName={selectedRetreat.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}