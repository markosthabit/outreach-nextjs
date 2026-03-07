'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { AddServanteeDialog } from './add-servantee-dialog'
import { EditServanteeDialog } from './edit-servantee-dialog'
import { ConfirmDeleteDialog } from '@/components/shared/delete-dialog'
import ServanteeDetailsDialog from './servantee-details-dialog'
import NotesButton from '@/components/shared/notes-button'
import { useAuth } from '@/contexts/AuthContext'
import { useDebounce } from '@/hooks/use-debounce'

interface Servantee {
  _id: string
  name: string
  phone: string
  church: string
  education: string
  work: string
  year: string
  isActive: boolean
  notes: string[]
}

export default function ServanteesPage() {
   const { user } = useAuth();
  const isAdmin = user!.role==='Admin';
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [servantees, setServantees] = useState<Servantee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [hasMore, setHasMore] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
const [totalResults, setTotalResults] = useState(0)

  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  // Focus management - focus after search completes
  useEffect(() => {
    if (!loading && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [loading])

  // Fetch data when page or debouncedSearchTerm changes
  const fetchServantees = useCallback(async (pageNumber = page, search = debouncedSearchTerm) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pageNumber.toString(),
        limit: limit.toString(),
        ...(search ? { search } : {})
      })

      const data: any = await apiFetch(`/servantees?${params.toString()}`)
      setServantees(data.data || data)
      setHasMore(!data.pages || pageNumber < data.pages)
      setTotalResults(data.total || 0) 

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'حدث خطأ أثناء تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearchTerm])

  useEffect(() => {
    fetchServantees(page, debouncedSearchTerm)
  }, [page, debouncedSearchTerm, fetchServantees])

  // Reset page to 1 when search changes
  useEffect(() => {
    setPage(1)
  }, [debouncedSearchTerm])

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/servantees/${id}`, { method: 'DELETE' })
      toast.success('تم حذف المخدوم بنجاح')
      fetchServantees(page, debouncedSearchTerm)
    } catch (err: any) {
      console.error(err)
      toast.error('حدث خطأ أثناء الحذف')
    }
  }

  // Handle search input change without causing full re-render
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // The search is already handled by the useEffect with debouncedSearchTerm
  }

  if (loading && servantees.length === 0) return <p className="p-4">جاري التحميل...</p>
  if (error) return <p className="p-4 text-red-500">{error}</p>

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">المخدومين</h1>
        <AddServanteeDialog onAdded={() => fetchServantees(1, debouncedSearchTerm)} />
      </div>

      {/* Search - Prevent default form behavior */}
      <form onSubmit={handleSearchSubmit} className="flex gap-3 sm:w-1/2">
        <Input
          ref={searchInputRef}
          placeholder="🔍 ابحث بالاسم أو التليفون أو الكنيسة..."
          value={searchTerm}
          onChange={handleSearchChange}
          type="text"
        />
      </form>

      {/* Loading state without replacing entire table */}
      {loading && servantees.length > 0 && (
        <div className="flex justify-center py-4">
          <p>جاري التحميل...</p>
        </div>
      )}

      {/* Table */}
      <Card className="p-4 shadow-sm overflow-x-auto">
        <Table className="min-w-full text-right border-collapse">
          <TableCaption>
            {servantees.length === 0 && !loading
              ? 'لا يوجد مخدومين'
              : `عدد النتائج: ${totalResults}`}
          </TableCaption>

          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">الإسم</TableHead>
              <TableHead className="text-right">التليفون</TableHead>
              <TableHead className="text-right">الكنيسة</TableHead>
              <TableHead className="text-right">الكلية</TableHead>
              <TableHead className="text-right">الفرقة</TableHead>
              <TableHead className="text-right w-[100px]">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {servantees.map((s) => (
              <TableRow key={s._id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.phone || '-'}</TableCell>
                <TableCell>{s.church || '-'}</TableCell>
                <TableCell>{s.education || '-'}</TableCell>
                <TableCell>
                  {s.year }
                </TableCell>

                <TableCell className="flex gap-2 justify-end">
                    <ServanteeDetailsDialog servanteeId={s._id} servanteeName={s.name} />
                  <NotesButton entityId={s._id} entityType="servantee" />
                  {isAdmin ? (
                    <><EditServanteeDialog servantee={s} onUpdated={() => fetchServantees(page, debouncedSearchTerm)} /><ConfirmDeleteDialog
                      onConfirm={() => handleDelete(s._id)}
                      title="حذف مخدوم"
                      description="هل أنت متأكد أنك ترغب في حذف هذا المخدوم؟ لن يمكنك استرجاع البيانات مرة أخرى."
                      triggerLabel="حذف" /></>
                  ) : (<></>)}
                    
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination Controls */}
      <div className="flex justify-center gap-4 mt-4">
        <Button
          type='button'
          variant="outline"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
        >
          ⬅️ السابق
        </Button>
        <span className="self-center font-medium">الصفحة {page}</span>
        <Button
          type='button'
          variant="outline"
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore || loading}
        >
          التالي ➡️
        </Button>
      </div>
    </div>
  )
}