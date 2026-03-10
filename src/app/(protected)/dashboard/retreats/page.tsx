'use client'

import { useState, useEffect, useMemo, SetStateAction, useCallback } from 'react'
import { format } from 'date-fns'
import { EntityDialog } from '@/components/shared/entity-dialog'
import { ConfirmDeleteDialog } from '@/components/shared/delete-dialog'
import { SearchBar } from '@/components/shared/search-bar'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Pencil, CalendarDays, MapPin, Users, ChevronLeft, ChevronRight, X } from 'lucide-react'
import NotesButton from '@/components/shared/notes-button'
import GenerateMissingServantees from './generate-missing-servantees'
import { GenerateAttendeesReport } from './generate-attendees-report'

// ---------- Types ----------
type Servantee = { _id: string; name: string; phone?: string }

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
const retreatFields = [
  { name: 'name', label: 'اسم الخلوة', required: true },
  { name: 'location', label: 'مكان الخلوة', required: true },
  { name: 'startDate', label: 'تاريخ البداية', type: 'date', required: true },
  { name: 'endDate', label: 'تاريخ النهاية', type: 'date', required: true },
]

const PAGE_SIZE = 10

// ---------- AttendeePicker ----------
function AttendeePicker({ retreatId, onAdded }: { retreatId: string; onAdded: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Servantee[]>([])
  const [allServantees, setAllServantees] = useState<Servantee[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch all servantees once for client-side search
  useEffect(() => {
    apiFetch<{ servantees: Servantee[] }>('/api/servantees')
      .then((res) => setAllServantees(res.servantees ?? []))
      .catch(() => toast.error('حدث خطأ أثناء تحميل المخدومين'))
  }, [])

  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) { setResults([]); return }
    setResults(
      allServantees
        .filter((s) => s.name?.toLowerCase().includes(q) || s.phone?.includes(q))
        .slice(0, 10)
    )
  }, [query, allServantees])

  const addAttendee = async (servanteeId: string) => {
    try {
      setLoading(true)
      const res = await apiFetch<{ retreat: Retreat }>(`/api/retreats/${retreatId}`)
      const existing = (res.retreat.attendees || []).map((a: any) =>
        typeof a === 'string' ? a : a._id
      )
      if (existing.includes(servanteeId)) {
        toast.error('المخدوم مضاف بالفعل')
        return
      }
      await apiFetch(`/api/retreats/${retreatId}`, {
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
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {results.map((r) => (
            <div key={r._id} className="flex items-center justify-between border rounded-lg p-2">
              <div>
                <p className="font-medium text-sm">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.phone || '-'}</p>
              </div>
              <Button size="sm" onClick={() => addAttendee(r._id)} disabled={loading}>
                إضافة
              </Button>
            </div>
          ))}
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
      )}
    </Card>
  )
}

// ---------- FocusedRetreatCard ----------
function FocusedRetreatCard({
  retreat,
  onRemoveAttendee,
}: {
  retreat: Retreat
  onRemoveAttendee: (id: string) => void
}) {
  const [attendeePage, setAttendeePage] = useState(1)
  const attendeeLimit = 10

  const attendees = useMemo(() => {
    return ((retreat.attendees || []) as any[]).map((a) => ({
      id: typeof a === 'string' ? a : a._id,
      name: typeof a === 'string' ? a : a.name || 'غير معروف',
      phone: typeof a === 'string' ? '-' : a.phone || '-',
    }))
  }, [retreat.attendees])

  const paginated = attendees.slice((attendeePage - 1) * attendeeLimit, attendeePage * attendeeLimit)
  const totalAttendeePages = Math.max(1, Math.ceil(attendees.length / attendeeLimit))

  useEffect(() => {
    setAttendeePage((p) => (p > totalAttendeePages ? totalAttendeePages : p))
  }, [attendees.length, totalAttendeePages])

  useEffect(() => { setAttendeePage(1) }, [retreat._id])

  return (
    <Card className="p-4 space-y-4">
      {/* Retreat info */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{retreat.name}</h2>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {retreat.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {retreat.location}
            </span>
          )}
          {retreat.startDate && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(new Date(retreat.startDate), 'yyyy-MM-dd')}
              {retreat.endDate && ` — ${format(new Date(retreat.endDate), 'yyyy-MM-dd')}`}
            </span>
          )}
        </div>
        {retreat.notes?.length ? (
          <p className="text-sm mt-1">
            <strong>ملاحظات:</strong>{' '}
            {(retreat.notes as any[]).map((n) => n.content || n).join(' / ')}
          </p>
        ) : null}
      </div>

      {/* Attendees */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">المشاركين</h3>
          <Badge variant="secondary">{attendees.length}</Badge>
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block">
          <Card className="p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الإسم</TableHead>
                  <TableHead className="text-right">التليفون</TableHead>
                  <TableHead className="text-right w-[120px]">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      لا يوجد مشاركين
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.phone}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <NotesButton entityId={a.id} entityType="servantees" />
                          <ConfirmDeleteDialog
                            onConfirm={() => onRemoveAttendee(a.id)}
                            title="حذف مخدوم"
                            description="هل أنت متأكد أنك ترغب في حذف هذا المخدوم من الخلوة؟"
                            triggerLabel="حذف"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-2">
          {paginated.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">لا يوجد مشاركين</p>
          ) : (
            paginated.map((a) => (
              <Card key={a.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.phone}</p>
                </div>
                <div className="flex gap-1">
                  <NotesButton entityId={a.id} entityType="servantees" />
                  <ConfirmDeleteDialog
                    onConfirm={() => onRemoveAttendee(a.id)}
                    title="حذف مخدوم"
                    description="هل أنت متأكد أنك ترغب في حذف هذا المخدوم من الخلوة؟"
                    triggerLabel="حذف"
                  />
                </div>
              </Card>
            ))
          )}
        </div>

        {totalAttendeePages > 1 && (
          <div className="flex justify-center gap-2 mt-3">
            <Button variant="outline" size="sm" disabled={attendeePage <= 1}
              onClick={() => setAttendeePage((p) => p - 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm self-center">{attendeePage} / {totalAttendeePages}</span>
            <Button variant="outline" size="sm" disabled={attendeePage >= totalAttendeePages}
              onClick={() => setAttendeePage((p) => p + 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------- RetreatsPage ----------
export default function RetreatsPage() {
  const [page, setPage] = useState(1)
  const [allRetreats, setAllRetreats] = useState<Retreat[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRetreat, setSelectedRetreat] = useState<Retreat | null>(null)

  // Fetch all retreats once
  const fetchRetreats = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch<{ retreats: Retreat[] }>('/api/retreats')
      setAllRetreats(res.retreats ?? [])
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء تحميل الخلوات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRetreats() }, [fetchRetreats])

  // Client-side search
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return allRetreats
    return allRetreats.filter(
      (r) => r.name?.toLowerCase().includes(q) || r.location?.toLowerCase().includes(q)
    )
  }, [allRetreats, searchTerm])

  useEffect(() => { setPage(1) }, [searchTerm])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const refreshFocused = async () => {
    if (!selectedRetreat) return
    const res = await apiFetch<{ retreat: Retreat }>(`/api/retreats/${selectedRetreat._id}`)
    setSelectedRetreat(res.retreat)
  }

  const handleRemoveAttendee = async (servanteeId: string) => {
    if (!selectedRetreat) return
    const existing = (selectedRetreat.attendees || []).map((a: any) =>
      typeof a === 'string' ? a : a._id
    )
    await apiFetch(`/api/retreats/${selectedRetreat._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ attendees: existing.filter((id) => id !== servanteeId) }),
    })
    toast.success('تم حذف المخدوم من الخلوة')
    await refreshFocused()
    fetchRetreats()
  }

  return (
    <div className="p-4 lg:p-6 space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">الخلوات</h1>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <EntityDialog
          title="إضافة خلوة جديدة"
          endpoint="api/retreats"
          fields={retreatFields}
          mode="create"
          onSuccess={fetchRetreats}
        />
      </div>

      <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="ابحث عن خلوة..." />

      {/* Desktop Table */}
      <Card className="hidden lg:block p-4 shadow-sm overflow-x-auto">
        <Table className="w-full text-right">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">المكان</TableHead>
              <TableHead className="text-right">البداية</TableHead>
              <TableHead className="text-right">النهاية</TableHead>
              <TableHead className="text-right">المشاركين</TableHead>
              <TableHead className="text-right w-[140px]">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  لا يوجد خلوات
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((r) => (
                <TableRow
                  key={r._id}
                  onClick={() => setSelectedRetreat(r)}
                  className={`cursor-pointer transition-colors ${
                    selectedRetreat?._id === r._id ? 'bg-muted/30' : 'hover:bg-muted/10'
                  }`}
                >
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.location || '-'}</TableCell>
                  <TableCell>
                    {r.startDate ? format(new Date(r.startDate), 'yyyy-MM-dd') : '-'}
                  </TableCell>
                  <TableCell>
                    {r.endDate ? format(new Date(r.endDate), 'yyyy-MM-dd') : '-'}
                  </TableCell>
                  <TableCell>{(r.attendees as any[])?.length || 0}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <EntityDialog
                        title="تعديل خلوة"
                        endpoint={`api/retreats`}
                        fields={retreatFields}
                        mode="edit"
                        initialData={r}
                        onSuccess={fetchRetreats}
                        trigger={
                          <Button variant="outline" size="icon">
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
                            await apiFetch(`/api/retreats/${r._id}`, { method: 'DELETE' })
                            toast.success('تم حذف الخلوة بنجاح')
                            fetchRetreats()
                            if (selectedRetreat?._id === r._id) setSelectedRetreat(null)
                          } catch {
                            toast.error('حدث خطأ أثناء حذف الخلوة')
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
        {paginated.length === 0 && !loading ? (
          <p className="text-center text-muted-foreground py-12">لا يوجد خلوات</p>
        ) : (
          paginated.map((r) => (
            <Card
              key={r._id}
              onClick={() => setSelectedRetreat(r)}
              className={`p-4 space-y-2 cursor-pointer transition-colors ${
                selectedRetreat?._id === r._id ? 'border-primary' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <p className="font-semibold">{r.name}</p>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {(r.attendees as any[])?.length || 0} مشارك
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {r.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {r.location}
                  </span>
                )}
                {r.startDate && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {format(new Date(r.startDate), 'yyyy-MM-dd')}
                  </span>
                )}
              </div>
              <div className="flex gap-1 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                <EntityDialog
                  title="تعديل خلوة"
                  endpoint={`api/retreats`}
                  fields={retreatFields}
                  mode="edit"
                  initialData={r}
                  onSuccess={fetchRetreats}
                  trigger={
                    <Button variant="outline" size="icon">
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
                      await apiFetch(`/api/retreats/${r._id}`, { method: 'DELETE' })
                      toast.success('تم حذف الخلوة بنجاح')
                      fetchRetreats()
                      if (selectedRetreat?._id === r._id) setSelectedRetreat(null)
                    } catch {
                      toast.error('حدث خطأ أثناء حذف الخلوة')
                    }
                  }}
                />
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}>
            <ChevronRight className="h-4 w-4 ml-1" /> السابق
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}>
            التالي <ChevronLeft className="h-4 w-4 mr-1" />
          </Button>
        </div>
      )}

      {/* Selected Retreat Panel */}
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedRetreat(null)}
                className="gap-1">
                <X className="h-4 w-4" /> إلغاء التحديد
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