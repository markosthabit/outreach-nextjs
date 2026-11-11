'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { apiFetch } from '@/lib/api'
import { whatsappHref } from '@/lib/phone'
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
import { Users, Search, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, UserMinus, Gift, Church, GraduationCap, RotateCcw, X, SlidersHorizontal, PhoneCall, PhoneOff, CheckCircle2, Loader2 } from 'lucide-react'
import { IconBrandWhatsapp } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { AlphabetFilterBar } from '@/components/shared/alphabet-filter-bar'
import { FilterCombobox } from '@/components/shared/filter-combobox'
import type { ClusteredFilterOption } from '@/lib/servantee-filters'

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
  /** No retreat in the last 3 months (computed on the server). */
  isInactive?: boolean
  hasBirthdayThisMonth?: boolean
  /** Outreach status in the current cycle; null when not assigned to any servant. */
  outreach?: OutreachSummary | null
}

interface OutreachSummary {
  assignmentId: string
  isCalled: boolean
  calledAt?: string | null
  servant?: { _id: string; name: string } | null
  calledBy?: { _id: string; name: string } | null
  round?: { _id: string; name: string; status: string } | null
  notes?: string
}

type OutreachFilter = 'contacted' | 'notContacted' | null

/** One page of servantees plus the counters / filter options for the whole list. */
interface ServanteesPageResponse {
  servantees: Servantee[]
  total: number
  page: number
  totalPages: number
  counts: { total: number; inactive: number; birthdays: number; contacted: number }
  facets: {
    letterCounts: Record<string, number>
    churchOptions: ClusteredFilterOption[]
    collegeOptions: ClusteredFilterOption[]
  }
  outreachCycle: { _id: string; name: string; status: string } | null
}

const NO_COUNTS = { total: 0, inactive: 0, birthdays: 0, contacted: 0 }
const NO_OPTIONS: ClusteredFilterOption[] = []
const NO_LETTERS: Record<string, number> = {}

const PAGE_SIZE = 10

const CHIP_TONES = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  neutral: 'bg-muted text-foreground border-border',
  emerald: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
  rose: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
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
        aria-label={`شيل ${label}`}
        className="shrink-0 rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

/** Outreach status pill; clickable for whoever is allowed to change it. */
function OutreachStatus({
  outreach,
  canToggle,
  busy,
  onToggle,
}: {
  outreach?: OutreachSummary | null
  canToggle: boolean
  busy: boolean
  onToggle: () => void
}) {
  const isCalled = !!outreach?.isCalled
  const label = isCalled ? 'تم إفتقاده' : outreach ? 'لم يتم إفتقاده' : 'مش متوزع'
  const pillClass = cn(
    'inline-flex items-center gap-1 h-7 px-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors',
    isCalled
      ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400'
      : outreach
      ? 'bg-rose-500/5 text-rose-700 border-rose-500/30 dark:text-rose-400'
      : 'bg-muted/60 text-muted-foreground border-border'
  )
  const icon = busy ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
  ) : isCalled ? (
    <CheckCircle2 className="h-3.5 w-3.5" />
  ) : (
    <PhoneOff className="h-3.5 w-3.5" />
  )
  const details = [
    outreach?.servant?.name,
    isCalled && outreach?.calledAt ? new Date(outreach.calledAt).toLocaleDateString('ar-EG') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col items-start gap-0.5 min-w-0">
      {canToggle ? (
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-pressed={isCalled}
          title={isCalled ? 'دوس عشان تشيل علامة الاتصال' : 'دوس عشان تسجّل إنه تم إفتقاده'}
          className={cn(pillClass, 'cursor-pointer hover:brightness-95 dark:hover:brightness-125 disabled:opacity-60')}
        >
          {icon}
          {label}
        </button>
      ) : (
        <span className={pillClass}>
          {icon}
          {label}
        </span>
      )}
      {details && (
        <span className="text-[11px] text-muted-foreground truncate max-w-full" title={details}>
          {details}
        </span>
      )}
    </div>
  )
}

export default function ServanteesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [list, setList] = useState<ServanteesPageResponse | null>(null)
  const [fetching, setFetching] = useState(false)
  const requestRef = useRef(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageState, setPageState] = useState({ key: '', page: 1 })
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyInactive, setShowOnlyInactive] = useState(false)
  const [showBirthdays, setShowBirthdays] = useState(false)
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [selectedChurch, setSelectedChurch] = useState<string | null>(null)
  const [selectedCollege, setSelectedCollege] = useState<string | null>(null)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [outreachFilter, setOutreachFilter] = useState<OutreachFilter>(null)
  const [togglingOutreachId, setTogglingOutreachId] = useState<string | null>(null)

  const debouncedSearch = useDebounce(searchTerm, 400)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('filter=birthdays')) {
      setShowBirthdays(true)
    }
  }, [])

  // ── Server-side filtering & pagination ────────────────────
  // Every filter goes to the server and only one page of rows comes back.
  const filtersKey = useMemo(() => {
    const params = new URLSearchParams()
    const q = debouncedSearch.trim()
    if (q) params.set('q', q)
    if (showOnlyInactive) params.set('view', 'inactive')
    else if (showBirthdays) params.set('view', 'birthdays')
    if (outreachFilter) params.set('outreach', outreachFilter)
    if (selectedLetter) params.set('letter', selectedLetter)
    if (selectedChurch) params.set('church', selectedChurch)
    if (selectedCollege) params.set('college', selectedCollege)
    return params.toString()
  }, [
    debouncedSearch,
    showOnlyInactive,
    showBirthdays,
    outreachFilter,
    selectedLetter,
    selectedChurch,
    selectedCollege,
  ])

  // The page number only counts for the filters it was chosen under, so changing
  // any filter lands on page 1 without a second request.
  const page = pageState.key === filtersKey ? pageState.page : 1
  const setPage = (update: (p: number) => number) =>
    setPageState((prev) => ({ key: filtersKey, page: update(prev.key === filtersKey ? prev.page : 1) }))

  const fetchServantees = useCallback(async () => {
    const requestId = ++requestRef.current
    setFetching(true)
    try {
      const params = new URLSearchParams(filtersKey)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      params.set('tz', String(new Date().getTimezoneOffset()))
      const res = await apiFetch<ServanteesPageResponse>(`/api/servantees?${params}`)
      // A newer request (the user kept typing / paging) supersedes this one
      if (requestId !== requestRef.current) return
      setList(res)
      setError(null)
      // The server clamps the page, e.g. after the last row of the last page is deleted
      if (res.page !== page) setPageState({ key: filtersKey, page: res.page })
    } catch (err: any) {
      if (requestId !== requestRef.current) return
      console.error(err)
      const message = err?.message || 'حصلت مشكلة وإحنا بنحمّل البيانات'
      setError(message)
      toast.error(message)
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false)
        setFetching(false)
      }
    }
  }, [filtersKey, page])

  useEffect(() => {
    fetchServantees()
  }, [fetchServantees])

  const servantees = list?.servantees ?? []
  const total = list?.total ?? 0
  const totalPages = list?.totalPages ?? 1
  const counts = list?.counts ?? NO_COUNTS
  const letterCounts = list?.facets.letterCounts ?? NO_LETTERS
  const churchOptions = list?.facets.churchOptions ?? NO_OPTIONS
  const collegeOptions = list?.facets.collegeOptions ?? NO_OPTIONS
  const outreachCycle = list?.outreachCycle ?? null

  // ── Clear all active filters ───────────────────────────────
  const resetAllFilters = () => {
    setSearchTerm('')
    setSelectedLetter(null)
    setSelectedChurch(null)
    setSelectedCollege(null)
    setShowOnlyInactive(false)
    setShowBirthdays(false)
    setOutreachFilter(null)
  }

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      selectedLetter !== null ||
      selectedChurch !== null ||
      selectedCollege !== null ||
      showOnlyInactive ||
      showBirthdays ||
      outreachFilter !== null
  )

  const activeChurchLabel = useMemo(
    () => churchOptions.find((o) => o.id === selectedChurch)?.label,
    [churchOptions, selectedChurch]
  )

  const activeCollegeLabel = useMemo(
    () => collegeOptions.find((o) => o.id === selectedCollege)?.label,
    [collegeOptions, selectedCollege]
  )

  // ── Handlers ───────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/servantees/${id}`, { method: 'DELETE' })
      toast.success('المخدوم اتمسح')
      fetchServantees()
    } catch (err: any) {
      toast.error('حصلت مشكلة وإحنا بنمسح')
    }
  }

  const canToggleOutreach = (s: Servantee) =>
    isAdmin || (!!user && !!s.outreach && s.outreach.servant?._id === user.id)

  const handleToggleOutreach = async (s: Servantee) => {
    const next = !s.outreach?.isCalled
    if (!next && !window.confirm(`تشيل علامة الاتصال من ${s.name}؟ تاريخ الاتصال هيتمسح.`)) return
    try {
      setTogglingOutreachId(s._id)
      const res = await apiFetch<{ outreach: OutreachSummary | null }>(`/api/servantees/${s._id}/outreach`, {
        method: 'POST',
        body: JSON.stringify({ isCalled: next }),
      })
      // Update the row right away, then refresh so the counters (and any outreach filter) follow
      setList(
        (prev) =>
          prev && {
            ...prev,
            servantees: prev.servantees.map((x) => (x._id === s._id ? { ...x, outreach: res.outreach } : x)),
          }
      )
      fetchServantees()
      toast.success(next ? 'اتسجل إن المخدوم تم إفتقاده' : 'شيلنا علامة الاتصال')
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نحدّث حالة الافتقاد')
    } finally {
      setTogglingOutreachId(null)
    }
  }

  // ── States ─────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground animate-pulse">بنحمّل...</p>
    </div>
  )

  if (error && !list) return (
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
            {total}
          </Badge>
        </div>
        <div className="flex gap-2 *:flex-1 sm:*:flex-none">
          {isAdmin && <ImportServanteesDialog onImported={fetchServantees} />}
          <AddServanteeDialog
            selectExistingLabel="وريني المخدوم"
            onAdded={fetchServantees}
            onSelectExisting={(existingServantee) => {
              setSearchTerm(existingServantee.name)
              toast.info(`القايمة بتعرض دلوقتي: ${existingServantee.name}`)
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
              placeholder="دوّر بالاسم أو التليفون أو الكنيسة أو الإيبارشية..."
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
                aria-label="امسح البحث"
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
                  {counts.total}
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
                  {counts.inactive}
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
                  {counts.birthdays}
                </span>
              </button>
            </div>

            {/* Outreach status in the current cycle */}
            <div
              className="grid grid-cols-2 sm:inline-flex sm:items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/50 text-xs"
              role="group"
              aria-label="فلتر الافتقاد"
              title={outreachCycle ? `حالة الافتقاد في دورة: ${outreachCycle.name}` : 'مفيش دورة افتقاد لسه'}
            >
              <button
                type="button"
                aria-pressed={outreachFilter === 'contacted'}
                onClick={() => setOutreachFilter((prev) => (prev === 'contacted' ? null : 'contacted'))}
                className={cn(
                  'flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 sm:px-3 py-1.5 min-h-12 sm:min-h-0 rounded-lg font-medium transition-all cursor-pointer',
                  outreachFilter === 'contacted'
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <PhoneCall className="h-3.5 w-3.5 max-[379px]:hidden" />
                  تم إفتقادهم
                </span>
                <span className="text-[10px] px-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
                  {counts.contacted}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={outreachFilter === 'notContacted'}
                onClick={() => setOutreachFilter((prev) => (prev === 'notContacted' ? null : 'notContacted'))}
                className={cn(
                  'flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 sm:px-3 py-1.5 min-h-12 sm:min-h-0 rounded-lg font-medium transition-all cursor-pointer',
                  outreachFilter === 'notContacted'
                    ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <PhoneOff className="h-3.5 w-3.5 max-[379px]:hidden" />
                  لم يتم إفتقادهم
                </span>
                <span className="text-[10px] px-1.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold">
                  {counts.total - counts.contacted}
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
              <span>فلترة على مزاجك</span>
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
                placeholder="اختار كنيسة..."
                searchPlaceholder="دوّر على اسم الكنيسة..."
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
                placeholder="اختار كلية أو تخصص..."
                searchPlaceholder="دوّر على الكلية أو التخصص..."
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
                  رجّع الكنيسة والكلية زي ما كانوا
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
          totalCount={counts.total}
        />
      </div>

      {/* ── 3. Active Filters Strip & Results Count ── */}
      {hasActiveFilters && (
        <div className="space-y-2 px-1 text-xs">
          {/* Result count + reset */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-muted-foreground font-medium">
              لقينا <span className="text-foreground font-semibold">{total}</span> من{' '}
              {counts.total}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-8 sm:h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              رجّع كله زي ما كان
            </Button>
          </div>

          {/* Chips: single swipeable row on mobile, wrapping on desktop */}
          <div className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-1 px-1 pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            <span className="hidden sm:inline text-muted-foreground font-medium ml-1">الفلاتر الشغالة:</span>
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
            {outreachFilter && (
              <FilterChip
                tone={outreachFilter === 'contacted' ? 'emerald' : 'rose'}
                label={outreachFilter === 'contacted' ? 'الافتقاد: تم إفتقادهم' : 'الافتقاد: لم يتم إفتقادهم'}
                onRemove={() => setOutreachFilter(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Table (desktop) / Cards (mobile) ── */}

      {/* Table — shown once the content area (not the viewport) is wide enough,
          so it also adapts when the sidebar is open or collapsed */}
      <Card
        className={cn(
          'hidden @5xl/main:block gap-0 py-0 shadow-xs overflow-hidden rounded-2xl transition-opacity',
          fetching && 'opacity-60'
        )}
        aria-busy={fetching}
      >
        <Table className="w-full text-right table-fixed">
          <colgroup>
            <col />
            <col className="w-[20%]" />
            <col className="w-[18%]" />
            <col className="w-[96px]" />
            <col className="w-[150px]" />
            <col className={isAdmin ? 'w-[150px]' : 'w-[84px]'} />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
              <TableHead className="text-right h-11 pr-5 pl-3 font-medium text-muted-foreground">المخدوم</TableHead>
              <TableHead className="text-right h-11 px-3 font-medium text-muted-foreground">الكنيسة</TableHead>
              <TableHead className="text-right h-11 px-3 font-medium text-muted-foreground">الدراسة</TableHead>
              <TableHead className="text-right h-11 px-3 font-medium text-muted-foreground">تاريخ الميلاد</TableHead>
              <TableHead
                className="text-right h-11 px-3 font-medium text-muted-foreground"
                title={outreachCycle ? `دورة: ${outreachCycle.name}` : undefined}
              >
                الافتقاد
              </TableHead>
              <TableHead className="h-11 pl-3 pr-1">
                <span className="sr-only">خيارات</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servantees.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="text-center text-muted-foreground py-16">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  مفيش مخدومين
                </TableCell>
              </TableRow>
            ) : (
              servantees.map((s) => (
                <TableRow key={s._id} className="group hover:bg-muted/30">
                  {/* Who: name + status icons, phone underneath */}
                  <TableCell className="py-3 pr-5 pl-3 overflow-hidden">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate font-semibold text-foreground" title={s.name}>
                        {s.name}
                      </span>
                      {s.hasBirthdayThisMonth && (
                        <span title="عيد ميلاده الشهر ده" className="shrink-0 flex items-center">
                          <Gift className="h-3.5 w-3.5 text-pink-500" />
                        </span>
                      )}
                      {s.isInactive && (
                        <span title="مجاش خلوة من 3 شهور" className="shrink-0 flex items-center">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 h-6">
                      <span dir="ltr" className="font-mono text-xs text-muted-foreground tabular-nums">
                        {s.phone || '—'}
                      </span>
                      {s.phone && (
                        <a
                          href={whatsappHref(s.phone) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center size-6 rounded-full text-muted-foreground/70 hover:text-green-600 hover:bg-green-500/10 transition-colors"
                          title="ابعتله واتساب"
                          aria-label={`واتساب ${s.name}`}
                        >
                          <IconBrandWhatsapp size={15} stroke={1.6} />
                        </a>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="py-3 px-3 overflow-hidden">
                    <span className="truncate block text-foreground" title={s.church || undefined}>
                      {s.church || <span className="text-muted-foreground">—</span>}
                    </span>
                    {s.diocese && (
                      <span className="truncate block text-xs text-muted-foreground mt-0.5" title={s.diocese}>
                        {s.diocese}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="py-3 px-3 overflow-hidden">
                    <span className="truncate block text-foreground" title={s.education || undefined}>
                      {s.education || <span className="text-muted-foreground">—</span>}
                    </span>
                    {s.year && (
                      <span className="truncate block text-xs text-muted-foreground mt-0.5" title={s.year}>
                        الفرقة: {s.year}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="py-3 px-3 text-xs text-muted-foreground tabular-nums">
                    {s.birthDate ? new Date(s.birthDate).toLocaleDateString('ar-EG') : '—'}
                  </TableCell>

                  <TableCell className="py-3 px-3 overflow-hidden">
                    <OutreachStatus
                      outreach={s.outreach}
                      canToggle={canToggleOutreach(s)}
                      busy={togglingOutreachId === s._id}
                      onToggle={() => handleToggleOutreach(s)}
                    />
                  </TableCell>

                  <TableCell className="py-3 pl-3 pr-1">
                    <div className="flex items-center gap-0.5 justify-end">
                      <ServanteeDetailsDialog
                        servanteeId={s._id}
                        servanteeName={s.name}
                        onOutreachChanged={fetchServantees}
                        compact
                      />
                      <NotesButton entityId={s._id} entityType="servantee" compact />
                      {isAdmin && (
                        <>
                          <EditServanteeDialog servantee={s} onUpdated={fetchServantees} compact />
                          <ConfirmDeleteDialog
                            onConfirm={() => handleDelete(s._id)}
                            title="تمسح المخدوم؟"
                            description="متأكد إنك عايز تمسح المخدوم ده؟ مش هتقدر ترجّع بياناته تاني."
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
      </Card>

      {/* Cards — one column on phones, two when the content area has room */}
      <div
        className={cn(
          '@5xl/main:hidden grid grid-cols-1 @3xl/main:grid-cols-2 gap-3 transition-opacity',
          fetching && 'opacity-60'
        )}
        aria-busy={fetching}
      >
        {servantees.length === 0 ? (
          <p className="col-span-full text-center text-muted-foreground py-12">مفيش مخدومين</p>
        ) : (
          servantees.map((s) => (
            <Card key={s._id} className="p-4 gap-0 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-semibold text-base truncate" title={s.name}>{s.name}</p>
                    {s.hasBirthdayThisMonth && (
                      <span title="عيد ميلاده الشهر ده" className="shrink-0 flex items-center">
                        <Gift className="h-4 w-4 text-pink-500" />
                      </span>
                    )}
                    {s.isInactive && (
                      <span title="مجاش خلوة من 3 شهور" className="shrink-0 flex items-center">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">{s.phone || '-'}</p>
                    {s.phone && (
                      <a
                        href={whatsappHref(s.phone) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-11 h-11 -ml-3 rounded-full text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors active:bg-green-500/20"
                        title="ابعتله واتساب"
                      >
                        <IconBrandWhatsapp size={24} stroke={1.5} />
                      </a>
                    )}
                  </div>
                </div>
                {/* <Badge variant={s.isActive ? 'default' : 'secondary'} className="text-xs shrink-0">
                  {s.isActive ? 'منتظم' : 'منقطع'}
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
                <div>
                  <p className="text-muted-foreground text-xs">تاريخ الميلاد</p>
                  <p>{s.birthDate ? new Date(s.birthDate).toLocaleDateString('ar-EG') : '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs mb-0.5">الافتقاد</p>
                  <OutreachStatus
                    outreach={s.outreach}
                    canToggle={canToggleOutreach(s)}
                    busy={togglingOutreachId === s._id}
                    onToggle={() => handleToggleOutreach(s)}
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap pt-1 border-t">
                <ServanteeDetailsDialog servanteeId={s._id} servanteeName={s.name} onOutreachChanged={fetchServantees} />
                <NotesButton entityId={s._id} entityType="servantee" />
                {isAdmin && (
                  <>
                    <EditServanteeDialog servantee={s} onUpdated={fetchServantees} />
                    <ConfirmDeleteDialog
                      onConfirm={() => handleDelete(s._id)}
                      title="تمسح المخدوم؟"
                      description="متأكد إنك عايز تمسح المخدوم ده؟ مش هتقدر ترجّع بياناته تاني."
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
          اللي قبل
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
          اللي بعد
          <ChevronLeft className="h-4 w-4 mr-1" />
        </Button>
      </div>
    </div>
  )
}