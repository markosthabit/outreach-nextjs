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
import { Users, Search, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, UserMinus, Gift, Church, GraduationCap, RotateCcw, X, SlidersHorizontal } from 'lucide-react'
import { IconBrandWhatsapp } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { filterServantees } from '@/lib/arabic-search'
import { AlphabetFilterBar } from '@/components/shared/alphabet-filter-bar'
import { FilterCombobox } from '@/components/shared/filter-combobox'
import {
  normalizeChurchName,
  normalizeCollegeName,
  getInitialLetter,
  buildClusteredOptions,
  computeLetterCounts,
} from '@/lib/servantee-filters'

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

const CHIP_TONES = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  neutral: 'bg-muted text-foreground border-border',
  amber: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
  pink: 'bg-pink-100 text-pink-900 border-pink-300 dark:bg-pink-950 dark:text-pink-200 dark:border-pink-800',
} as const

/** Removable chip for the active-filters strip. */
function FilterChip({
  label,
  onRemove,
  tone = 'primary',
}: {
  label: string
  onRemove: () => void
  tone?: keyof typeof CHIP_TONES
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 shrink-0 max-w-[220px] h-8 sm:h-7 pr-2.5 pl-1 rounded-lg border text-xs font-medium',
        CHIP_TONES[tone]
      )}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`إزالة ${label}`}
        className="shrink-0 rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

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
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [selectedChurch, setSelectedChurch] = useState<string | null>(null)
  const [selectedCollege, setSelectedCollege] = useState<string | null>(null)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)

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

  const inactiveCount = useMemo(() => allServantees.filter(isInactive).length, [allServantees, isInactive])
  const birthdayCount = useMemo(() => allServantees.filter(hasBirthdayThisMonth).length, [allServantees, hasBirthdayThisMonth])

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

  // ── Smart Dynamic Clustering for Unstandardized Fields ──────
  const letterCounts = useMemo(() => computeLetterCounts(allServantees), [allServantees])

  const churchOptions = useMemo(
    () => buildClusteredOptions(allServantees, (s) => s.church, normalizeChurchName),
    [allServantees]
  )

  const collegeOptions = useMemo(
    () => buildClusteredOptions(allServantees, (s) => s.education, normalizeCollegeName),
    [allServantees]
  )

  // ── Client-side multi-layer search & filter ────────────────
  const filtered = useMemo(() => {
    let result = allServantees

    if (showOnlyInactive) {
      result = result.filter(isInactive)
    }

    if (showBirthdays) {
      result = result.filter(hasBirthdayThisMonth)
    }

    // 1. Initial Letter filter
    if (selectedLetter) {
      result = result.filter((s) => getInitialLetter(s.name) === selectedLetter)
    }

    // 2. Church cluster filter
    if (selectedChurch) {
      const opt = churchOptions.find((o) => o.id === selectedChurch)
      if (opt) {
        const rawSet = new Set(opt.rawValues)
        result = result.filter(
          (s) =>
            (s.church && rawSet.has(s.church)) ||
            normalizeChurchName(s.church) === selectedChurch
        )
      }
    }

    // 3. College/Education cluster filter
    if (selectedCollege) {
      const opt = collegeOptions.find((o) => o.id === selectedCollege)
      if (opt) {
        const rawSet = new Set(opt.rawValues)
        result = result.filter(
          (s) =>
            (s.education && rawSet.has(s.education)) ||
            normalizeCollegeName(s.education) === selectedCollege
        )
      }
    }

    // 4. Free text search (Name, Phone, Church, Diocese)
    if (debouncedSearch.trim()) {
      result = filterServantees(debouncedSearch, result)
    }

    return result
  }, [
    allServantees,
    debouncedSearch,
    showOnlyInactive,
    showBirthdays,
    selectedLetter,
    selectedChurch,
    selectedCollege,
    churchOptions,
    collegeOptions,
    isInactive,
    hasBirthdayThisMonth,
  ])

  // ── Reset page on filter change ────────────────────────────
  useEffect(() => {
    setPage(1)
  }, [
    debouncedSearch,
    showOnlyInactive,
    showBirthdays,
    selectedLetter,
    selectedChurch,
    selectedCollege,
  ])

  // ── Clear all active filters ───────────────────────────────
  const resetAllFilters = () => {
    setSearchTerm('')
    setSelectedLetter(null)
    setSelectedChurch(null)
    setSelectedCollege(null)
    setShowOnlyInactive(false)
    setShowBirthdays(false)
  }

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      selectedLetter !== null ||
      selectedChurch !== null ||
      selectedCollege !== null ||
      showOnlyInactive ||
      showBirthdays
  )

  const activeChurchLabel = useMemo(
    () => churchOptions.find((o) => o.id === selectedChurch)?.label,
    [churchOptions, selectedChurch]
  )

  const activeCollegeLabel = useMemo(
    () => collegeOptions.find((o) => o.id === selectedCollege)?.label,
    [collegeOptions, selectedCollege]
  )

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
    <div className="px-3 py-4 sm:p-4 lg:p-6 space-y-4 sm:space-y-6" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-semibold">المخدومين</h1>
          <Badge variant="secondary" className="text-xs">
            {filtered.length}
          </Badge>
        </div>
        <div className="flex gap-2 *:flex-1 sm:*:flex-none">
          {isAdmin && <ImportServanteesDialog onImported={fetchServantees} />}
          <AddServanteeDialog
            existingServantees={allServantees}
            selectExistingLabel="عرض المخدوم"
            onAdded={fetchServantees}
            onSelectExisting={(existingServantee) => {
              setSearchTerm(existingServantee.name)
              toast.info(`تم تصفية القائمة لعرض: ${existingServantee.name}`)
            }}
          />
        </div>
      </div>

      {/* ── 1. Primary Search & Quick View Toolbar ── */}
      <div className="bg-card border border-border/80 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        {/* Row 1: Search input + View segmented tabs + Filter toggle */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 justify-between">
          {/* Main search bar */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="search"
              enterKeyHint="search"
              placeholder="ابحث بالاسم، التليفون، الكنيسة، الأبرشية..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              // text-base (16px) on mobile prevents iOS Safari from zooming on focus
              className="pr-10 pl-10 h-11 sm:h-10 text-base sm:text-sm bg-background/80 border-input rounded-xl focus-visible:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2 cursor-pointer"
                aria-label="مسح البحث"
              >
                <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Views Segmented Tabs & Advanced Filter Toggle */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            {/* Segmented status buttons: 3-col grid on mobile, inline on desktop */}
            <div className="grid grid-cols-3 sm:inline-flex sm:items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/50 text-xs">
              <button
                type="button"
                aria-pressed={!showOnlyInactive && !showBirthdays}
                onClick={() => {
                  setShowOnlyInactive(false)
                  setShowBirthdays(false)
                }}
                className={cn(
                  'flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 sm:px-3 py-1.5 min-h-12 sm:min-h-0 rounded-lg font-medium transition-all cursor-pointer',
                  !showOnlyInactive && !showBirthdays
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="whitespace-nowrap">الكل</span>
                <span className="text-[10px] px-1.5 rounded-full bg-foreground/5 text-muted-foreground font-semibold">
                  {allServantees.length}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={showOnlyInactive}
                onClick={() => {
                  setShowOnlyInactive((prev) => !prev)
                  if (!showOnlyInactive) setShowBirthdays(false)
                }}
                className={cn(
                  'flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 sm:px-3 py-1.5 min-h-12 sm:min-h-0 rounded-lg font-medium transition-all cursor-pointer',
                  showOnlyInactive
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <UserMinus className="h-3.5 w-3.5 max-[379px]:hidden" />
                  المنقطعين
                </span>
                <span className="text-[10px] px-1.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                  {inactiveCount}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={showBirthdays}
                onClick={() => {
                  setShowBirthdays((prev) => !prev)
                  if (!showBirthdays) setShowOnlyInactive(false)
                }}
                className={cn(
                  'flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 sm:px-3 py-1.5 min-h-12 sm:min-h-0 rounded-lg font-medium transition-all cursor-pointer',
                  showBirthdays
                    ? 'bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200 shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Gift className="h-3.5 w-3.5 max-[379px]:hidden" />
                  أعياد الميلاد
                </span>
                <span className="text-[10px] px-1.5 rounded-full bg-pink-500/15 text-pink-700 dark:text-pink-300 font-semibold">
                  {birthdayCount}
                </span>
              </button>
            </div>

            {/* Toggle advanced filter dropdowns button */}
            <Button
              type="button"
              aria-expanded={isFilterPanelOpen}
              variant={isFilterPanelOpen || selectedChurch || selectedCollege ? 'secondary' : 'outline'}
              onClick={() => setIsFilterPanelOpen((prev) => !prev)}
              className={cn(
                'h-11 sm:h-10 w-full sm:w-auto justify-center px-3 text-sm sm:text-xs gap-1.5 rounded-xl transition-all cursor-pointer',
                (selectedChurch || selectedCollege) && 'border-primary/50 text-primary font-semibold'
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>تصفية مخصصة</span>
              {(selectedChurch || selectedCollege) && (
                <Badge variant="default" className="h-4.5 px-1.5 text-[10px] rounded-full">
                  {(selectedChurch ? 1 : 0) + (selectedCollege ? 1 : 0)}
                </Badge>
              )}
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform duration-200', isFilterPanelOpen && 'rotate-180')}
              />
            </Button>
          </div>
        </div>

        {/* Row 2: Faceted Filter Selectors (Church & College) */}
        {(isFilterPanelOpen || selectedChurch || selectedCollege) && (
          <div className="pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end animate-in fade-in-0 duration-200">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Church className="h-3.5 w-3.5 text-primary" />
                الكنيسة
              </label>
              <FilterCombobox
                label="الكنيسة"
                placeholder="اختر كنيسة..."
                searchPlaceholder="ابحث عن اسم الكنيسة..."
                options={churchOptions}
                value={selectedChurch}
                onChange={setSelectedChurch}
                icon={<Church className="h-4 w-4 text-primary/70" />}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                الكلية / الدراسة
              </label>
              <FilterCombobox
                label="الكلية / الدراسة"
                placeholder="اختر كلية أو تخصص..."
                searchPlaceholder="ابحث عن الكلية أو التخصص..."
                options={collegeOptions}
                value={selectedCollege}
                onChange={setSelectedCollege}
                icon={<GraduationCap className="h-4 w-4 text-primary/70" />}
              />
            </div>

            {(selectedChurch || selectedCollege) && (
              <div className="sm:col-span-2 lg:col-span-1 flex items-center pb-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedChurch(null)
                    setSelectedCollege(null)
                  }}
                  className="h-10 md:h-9.5 w-full sm:w-auto justify-center px-3 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  إعادة ضبط الكنيسة والكلية
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Directory Alphabetical Bar ── */}
      <div className="bg-card border border-border/80 rounded-2xl p-3 shadow-xs">
        <AlphabetFilterBar
          selectedLetter={selectedLetter}
          onSelectLetter={setSelectedLetter}
          letterCounts={letterCounts}
          totalCount={allServantees.length}
        />
      </div>

      {/* ── 3. Active Filters Strip & Results Count ── */}
      {hasActiveFilters && (
        <div className="space-y-2 px-1 text-xs">
          {/* Result count + reset */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-muted-foreground font-medium">
              تم العثور على <span className="text-foreground font-semibold">{filtered.length}</span> من أصل{' '}
              {allServantees.length}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-8 sm:h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              إعادة ضبط الكل
            </Button>
          </div>

          {/* Chips: single swipeable row on mobile, wrapping on desktop */}
          <div className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-1 px-1 pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            <span className="hidden sm:inline text-muted-foreground font-medium ml-1">الفلاتر النشطة:</span>
            {selectedLetter && (
              <FilterChip label={`حرف: ${selectedLetter}`} onRemove={() => setSelectedLetter(null)} />
            )}
            {selectedChurch && (
              <FilterChip
                label={`كنيسة: ${activeChurchLabel || selectedChurch}`}
                onRemove={() => setSelectedChurch(null)}
              />
            )}
            {selectedCollege && (
              <FilterChip
                label={`الكلية: ${activeCollegeLabel || selectedCollege}`}
                onRemove={() => setSelectedCollege(null)}
              />
            )}
            {searchTerm.trim() && (
              <FilterChip tone="neutral" label={`بحث: "${searchTerm.trim()}"`} onRemove={() => setSearchTerm('')} />
            )}
            {showOnlyInactive && (
              <FilterChip tone="amber" label="المنقطعين" onRemove={() => setShowOnlyInactive(false)} />
            )}
            {showBirthdays && (
              <FilterChip tone="pink" label="أعياد الميلاد" onRemove={() => setShowBirthdays(false)} />
            )}
          </div>
        </div>
      )}

      {/* ── Table (desktop) / Cards (mobile) ── */}

      {/* Desktop Table */}
      <Card className="hidden lg:block shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[920px] text-right table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-right w-[22%] min-w-[170px] max-w-[240px]">الإسم</TableHead>
                <TableHead className="text-right w-[15%] min-w-[130px] whitespace-nowrap">التليفون</TableHead>
                <TableHead className="text-right w-[25%] min-w-[190px] max-w-[290px]">الكنيسة / الأبرشية</TableHead>
                <TableHead className="text-right w-[11%] min-w-[95px] whitespace-nowrap">تاريخ الميلاد</TableHead>
                <TableHead className="text-right w-[22%] min-w-[170px] max-w-[260px]">الكلية / الفرقة</TableHead>
                <TableHead className="text-left w-[220px] min-w-[220px] shrink-0">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    لا يوجد مخدومين
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((s) => (
                  <TableRow key={s._id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium max-w-[240px] overflow-hidden py-2.5">
                      <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                        <span className="truncate font-semibold text-foreground text-sm" title={s.name}>
                          {s.name}
                        </span>
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
                    <TableCell className="text-muted-foreground whitespace-nowrap overflow-hidden py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span dir="ltr" className="font-mono text-xs text-foreground/90">{s.phone || '-'}</span>
                        {s.phone && (
                          <a
                            href={`https://wa.me/${s.phone.replace(/\D/g, '').replace(/^01/, '201')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors active:bg-green-500/20"
                            title="مراسلة واتساب"
                          >
                            <IconBrandWhatsapp size={18} stroke={1.5} />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[290px] overflow-hidden py-2.5">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span
                          className="truncate font-semibold text-foreground text-xs sm:text-sm block"
                          title={s.church || undefined}
                        >
                          {s.church || '-'}
                        </span>
                        {s.diocese ? (
                          <span
                            className="text-[11px] text-muted-foreground truncate block"
                            title={s.diocese}
                          >
                            {s.diocese}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs overflow-hidden py-2.5">
                      {s.birthDate ? new Date(s.birthDate).toLocaleDateString('ar-EG') : '-'}
                    </TableCell>
                    <TableCell className="max-w-[260px] overflow-hidden py-2.5">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span
                          className="truncate font-medium text-foreground text-xs sm:text-sm block"
                          title={s.education || undefined}
                        >
                          {s.education || '-'}
                        </span>
                        {s.year ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[11px] text-muted-foreground shrink-0">الفرقة:</span>
                            <Badge
                              variant="secondary"
                              className="h-4.5 px-1.5 text-[10px] font-medium bg-muted/80 text-foreground border border-border/50 shrink-0"
                            >
                              {s.year}
                            </Badge>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap w-[220px] min-w-[220px] shrink-0 py-2.5">
                      <div className="flex items-center gap-1.5 justify-end">
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
                              size="icon"
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-semibold text-base truncate" title={s.name}>{s.name}</p>
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
                <div className="col-span-2 min-w-0">
                  <p className="text-muted-foreground text-xs">الكنيسة / الأبرشية</p>
                  <p className="truncate font-medium text-foreground/90" title={[s.church, s.diocese].filter(Boolean).join(' - ') || undefined}>
                    {[s.church, s.diocese].filter(Boolean).join(' - ') || '-'}
                  </p>
                </div>
                <div className="col-span-2 min-w-0">
                  <p className="text-muted-foreground text-xs">الكلية / الفرقة</p>
                  <p className="truncate" title={[s.education, s.year].filter(Boolean).join(' - ') || undefined}>
                    {[s.education, s.year].filter(Boolean).join(' - ') || '-'}
                  </p>
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
                      size="icon"
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