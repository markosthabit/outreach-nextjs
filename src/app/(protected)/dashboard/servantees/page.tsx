'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { AddServanteeDialog } from './add-servantee-dialog'
import { ImportServanteesDialog } from './import-servantees-dialog'
import { EditServanteeDialog } from './edit-servantee-dialog'
import { ConfirmDeleteDialog } from '@/components/shared/delete-dialog'
import ServanteeDetailsDialog from './servantee-details-dialog'
import NotesButton from '@/components/shared/notes-button'
import { useAuth } from '@/contexts/AuthContext'
import { useDebounce } from '@/hooks/use-debounce'
import { Users, Search, ChevronLeft, ChevronRight, AlertTriangle, UserMinus, Gift } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { IconBrandWhatsapp } from '@tabler/icons-react'

interface Servantee {
  _id: string
  name: string
  phone: string
  church: string
  diocese?: string
  birthDate?: string | Date
  education: string
  work: string
  year: string
  isActive: boolean
  notes: string[]
  retreats?: { _id: string; startDate: string; endDate: string }[]
}

const PAGE_SIZE = 10

export default function ServanteesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [allServantees, setAllServantees] = useState<Servantee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyInactive, setShowOnlyInactive] = useState(false)
  const [showBirthdays, setShowBirthdays] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, 400)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('filter=birthdays')) {
      setShowBirthdays(true)
    }
  }, [])

  // ── Helper ─────────────────────────────────────────────────
  const isInactive = useCallback((s: Servantee) => {
    if (!s.retreats || s.retreats.length === 0) return true
    
    const latestRetreat = s.retreats.reduce((latest, current) => {
      return new Date(current.startDate) > new Date(latest.startDate) ? current : latest
    }, s.retreats[0])

    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    return new Date(latestRetreat.startDate) < threeMonthsAgo
  }, [])

  const hasBirthdayThisMonth = useCallback((s: Servantee) => {
    if (!s.birthDate) return false
    return new Date(s.birthDate).getMonth() === new Date().getMonth()
  }, [])

  // ── Fetch all servantees once ──────────────────────────────
  const fetchServantees = useCallback(async () => {
    try {
      const res = await apiFetch<{ servantees: Servantee[] }>('/api/servantees')
      setAllServantees(res.servantees ?? [])
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'حدث خطأ أثناء تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServantees()
  }, [fetchServantees])

  // ── Client-side search & filter ────────────────────────────
  const filtered = useMemo(() => {
    let result = allServantees

    if (showOnlyInactive) {
      result = result.filter(isInactive)
    }

    if (showBirthdays) {
      result = result.filter(hasBirthdayThisMonth)
    }

    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return result

    return result.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.church?.toLowerCase().includes(q)
    )
  }, [allServantees, debouncedSearch, showOnlyInactive, showBirthdays, isInactive, hasBirthdayThisMonth])

  // ── Reset page on filter change ────────────────────────────
  useEffect(() => { setPage(1) }, [debouncedSearch, showOnlyInactive, showBirthdays])

  // ── Client-side pagination ─────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Handlers ───────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/servantees/${id}`, { method: 'DELETE' })
      toast.success('تم حذف المخدوم بنجاح')
      setAllServantees((prev) => prev.filter((s) => s._id !== id))
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الحذف')
    }
  }

  // ── States ─────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground animate-pulse">جاري التحميل...</p>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-red-500">{error}</p>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-6" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">المخدومين</h1>
          <Badge variant="secondary" className="text-xs">
            {filtered.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          {isAdmin && <ImportServanteesDialog onImported={fetchServantees} />}
          <AddServanteeDialog onAdded={fetchServantees} />
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
        <div className="relative w-full lg:w-96 flex-shrink-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="ابحث بالاسم أو التليفون أو الكنيسة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9"
          />
        </div>
        <div className="flex gap-2 w-full">
          <Toggle
            pressed={showOnlyInactive}
            onPressedChange={setShowOnlyInactive}
            variant="outline"
            className="flex-1 lg:flex-none gap-2 data-[state=on]:bg-amber-100 data-[state=on]:text-amber-900 dark:data-[state=on]:bg-amber-900/30 dark:data-[state=on]:text-amber-300"
          >
            <UserMinus className="h-4 w-4" />
            المنقطعين
          </Toggle>
          <Toggle
            pressed={showBirthdays}
            onPressedChange={setShowBirthdays}
            variant="outline"
            className="flex-1 lg:flex-none gap-2 data-[state=on]:bg-pink-100 data-[state=on]:text-pink-900 dark:data-[state=on]:bg-pink-900/30 dark:data-[state=on]:text-pink-300"
          >
            <Gift className="h-4 w-4" />
            أعياد الميلاد
          </Toggle>
        </div>
      </div>

      {/* ── Table (desktop) / Cards (mobile) ── */}

      {/* Desktop Table */}
      <Card className="hidden lg:block shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-full text-right">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-right">الإسم</TableHead>
                <TableHead className="text-right">التليفون</TableHead>
                <TableHead className="text-right">الأبرشية</TableHead>
                <TableHead className="text-right">الكنيسة</TableHead>
                <TableHead className="text-right">تاريخ الميلاد</TableHead>
                <TableHead className="text-right">الكلية</TableHead>
                <TableHead className="text-right">الفرقة</TableHead>
                <TableHead className="text-right w-[140px]">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    لا يوجد مخدومين
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((s) => (
                  <TableRow key={s._id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {s.name}
                        {hasBirthdayThisMonth(s) && (
                          <span title="عيد ميلاده هذا الشهر" className="shrink-0 flex items-center">
                            <Gift className="h-4 w-4 text-pink-500" />
                          </span>
                        )}
                        {isInactive(s) && (
                          <span title="لم يحضر خلوة منذ 3 أشهر" className="shrink-0 flex items-center">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {s.phone || '-'}
                        {s.phone && (
                          <a
                            href={`https://wa.me/${s.phone.replace(/\D/g, '').replace(/^01/, '201')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-9 h-9 -ml-2 rounded-full text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors active:bg-green-500/20"
                            title="مراسلة واتساب"
                          >
                            <IconBrandWhatsapp size={20} stroke={1.5} />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{s.diocese || '-'}</TableCell>
                    <TableCell>{s.church || '-'}</TableCell>
                    <TableCell>{s.birthDate ? new Date(s.birthDate).toLocaleDateString('ar-EG') : '-'}</TableCell>
                    <TableCell>{s.education || '-'}</TableCell>
                    <TableCell>{s.year || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <ServanteeDetailsDialog servanteeId={s._id} servanteeName={s.name} />
                        <NotesButton entityId={s._id} entityType="servantee" />
                        {isAdmin && (
                          <>
                            <EditServanteeDialog
                              servantee={s}
                              onUpdated={fetchServantees}
                            />
                            <ConfirmDeleteDialog
                              onConfirm={() => handleDelete(s._id)}
                              title="حذف مخدوم"
                              description="هل أنت متأكد أنك ترغب في حذف هذا المخدوم؟ لن يمكنك استرجاع البيانات مرة أخرى."
                              triggerLabel="حذف"
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {paginated.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا يوجد مخدومين</p>
        ) : (
          paginated.map((s) => (
            <Card key={s._id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-base">{s.name}</p>
                    {hasBirthdayThisMonth(s) && (
                      <span title="عيد ميلاده هذا الشهر" className="shrink-0 flex items-center">
                        <Gift className="h-4 w-4 text-pink-500" />
                      </span>
                    )}
                    {isInactive(s) && (
                      <span title="لم يحضر خلوة منذ 3 أشهر" className="shrink-0 flex items-center">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">{s.phone || '-'}</p>
                    {s.phone && (
                      <a
                        href={`https://wa.me/${s.phone.replace(/\D/g, '').replace(/^01/, '201')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-11 h-11 -ml-3 rounded-full text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors active:bg-green-500/20"
                        title="مراسلة واتساب"
                      >
                        <IconBrandWhatsapp size={24} stroke={1.5} />
                      </a>
                    )}
                  </div>
                </div>
                {/* <Badge variant={s.isActive ? 'default' : 'secondary'} className="text-xs shrink-0">
                  {s.isActive ? 'نشط' : 'غير نشط'}
                </Badge> */}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">الأبرشية</p>
                  <p>{s.diocese || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">الكنيسة</p>
                  <p>{s.church || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">الكلية</p>
                  <p>{s.education || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">الفرقة</p>
                  <p>{s.year || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">تاريخ الميلاد</p>
                  <p>{s.birthDate ? new Date(s.birthDate).toLocaleDateString('ar-EG') : '-'}</p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap pt-1 border-t">
                <ServanteeDetailsDialog servanteeId={s._id} servanteeName={s.name} />
                <NotesButton entityId={s._id} entityType="servantee" />
                {isAdmin && (
                  <>
                    <EditServanteeDialog servantee={s} onUpdated={fetchServantees} />
                    <ConfirmDeleteDialog
                      onConfirm={() => handleDelete(s._id)}
                      title="حذف مخدوم"
                      description="هل أنت متأكد أنك ترغب في حذف هذا المخدوم؟ لن يمكنك استرجاع البيانات مرة أخرى."
                      triggerLabel="حذف"
                    />
                  </>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          <ChevronRight className="h-4 w-4 ml-1" />
          السابق
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          التالي
          <ChevronLeft className="h-4 w-4 mr-1" />
        </Button>
      </div>
    </div>
  )
}