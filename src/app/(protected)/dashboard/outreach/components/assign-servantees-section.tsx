'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  UserCheck,
  Search,
  RotateCcw,
  Sparkles,
  Church,
  GraduationCap,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { matchesArabic } from '@/lib/arabic-search'
import { AlphabetFilterBar } from '@/components/shared/alphabet-filter-bar'
import { FilterCombobox } from '@/components/shared/filter-combobox'
import { cn } from '@/lib/utils'
import {
  normalizeChurchName,
  normalizeCollegeName,
  getInitialLetter,
  buildClusteredOptions,
  computeLetterCounts,
} from '@/lib/servantee-filters'

/** Rows rendered per "show more" step — rendering 1000+ checkbox rows at once is slow on phones. */
const RENDER_STEP = 100

interface AssignServanteesSectionProps {
  rounds: any[]
  activeRoundId: string | null
  servants: any[]
  hasActiveCycle: boolean
  onSuccess: () => void
}

export function AssignServanteesSection({
  rounds,
  activeRoundId,
  servants,
  hasActiveCycle,
  onSuccess,
}: AssignServanteesSectionProps) {
  // Only active rounds can receive new assignments
  const assignableRounds = useMemo(() => rounds.filter((r) => r.status === 'active'), [rounds])

  const [selectedRoundId, setSelectedRoundId] = useState<string>('')
  const [selectedServantId, setSelectedServantId] = useState<string>('')
  const [quotaInput, setQuotaInput] = useState<string>('30')

  const [eligibleServantees, setEligibleServantees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [selectedChurch, setSelectedChurch] = useState<string | null>(null)
  const [selectedCollege, setSelectedCollege] = useState<string | null>(null)
  const [renderLimit, setRenderLimit] = useState(RENDER_STEP)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Keep the target round valid: prefer the page's selected round, else the first active one
  useEffect(() => {
    if (assignableRounds.some((r) => r._id === selectedRoundId)) return
    const preferred = assignableRounds.find((r) => r._id === activeRoundId) || assignableRounds[0]
    setSelectedRoundId(preferred?._id || '')
  }, [assignableRounds, activeRoundId, selectedRoundId])

  const sortedServants = useMemo(
    () => [...servants].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar')),
    [servants]
  )

  const fetchEligibleServantees = useCallback(async () => {
    if (!hasActiveCycle) {
      setEligibleServantees([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await apiFetch<{ servantees: any[] }>('/api/outreach/eligible-servantees')
      setEligibleServantees(res.servantees ?? [])
    } catch {
      toast.error('فشل تحميل قائمة المخدومين المتاحين للافتقاد')
    } finally {
      setLoading(false)
    }
  }, [hasActiveCycle])

  useEffect(() => {
    fetchEligibleServantees()
  }, [fetchEligibleServantees])

  const churchOptions = useMemo(
    () => buildClusteredOptions(eligibleServantees, (s) => s.church, normalizeChurchName),
    [eligibleServantees]
  )
  const collegeOptions = useMemo(
    () => buildClusteredOptions(eligibleServantees, (s) => s.education, normalizeCollegeName),
    [eligibleServantees]
  )

  // All filters except the letter — used both for the list and for the letter counts
  const filteredExceptLetter = useMemo(() => {
    const q = searchQuery.trim()
    const churchOpt = selectedChurch ? churchOptions.find((o) => o.id === selectedChurch) : null
    const churchSet = churchOpt ? new Set(churchOpt.rawValues.map(normalizeChurchName)) : null
    const collegeOpt = selectedCollege ? collegeOptions.find((o) => o.id === selectedCollege) : null
    const collegeSet = collegeOpt ? new Set(collegeOpt.rawValues.map(normalizeCollegeName)) : null

    return eligibleServantees.filter((s) => {
      if (selectedChurch && (!churchSet || !churchSet.has(normalizeChurchName(s.church)))) return false
      if (selectedCollege && (!collegeSet || !collegeSet.has(normalizeCollegeName(s.education)))) return false
      if (q) {
        return matchesArabic(q, s.name || '') || (s.phone || '').includes(q) || matchesArabic(q, s.church || '')
      }
      return true
    })
  }, [eligibleServantees, searchQuery, selectedChurch, selectedCollege, churchOptions, collegeOptions])

  const filteredServantees = useMemo(
    () =>
      selectedLetter === null
        ? filteredExceptLetter
        : filteredExceptLetter.filter((s) => getInitialLetter(s.name) === selectedLetter),
    [filteredExceptLetter, selectedLetter]
  )

  const letterCounts = useMemo(() => computeLetterCounts(filteredExceptLetter), [filteredExceptLetter])

  // Reset the render window whenever the visible list changes
  useEffect(() => {
    setRenderLimit(RENDER_STEP)
  }, [filteredServantees])

  const visibleRows = filteredServantees.slice(0, renderLimit)
  const quota = Math.max(1, Math.min(1000, parseInt(quotaInput, 10) || 0))

  function handleQuickSelect() {
    const candidates = filteredServantees.filter((s) => !selectedIds.has(s._id)).slice(0, quota)
    if (candidates.length === 0) {
      toast.info('كل المخدومين المعروضين محددون بالفعل')
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      candidates.forEach((s) => next.add(s._id))
      return next
    })
    toast.info(`تم تحديد ${candidates.length} مخدوم إضافي`)
  }

  function handleToggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allFilteredSelected =
    filteredServantees.length > 0 && filteredServantees.every((s) => selectedIds.has(s._id))

  function handleSelectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredServantees.forEach((s) => next.delete(s._id))
      else filteredServantees.forEach((s) => next.add(s._id))
      return next
    })
  }

  function handleResetFilters() {
    setSearchQuery('')
    setSelectedLetter(null)
    setSelectedChurch(null)
    setSelectedCollege(null)
  }

  async function handleAssignSubmit() {
    if (!selectedRoundId) return toast.error('يرجى اختيار الجولة المستهدفة')
    if (!selectedServantId) return toast.error('يرجى اختيار الخادم المكلف')
    if (selectedIds.size === 0) return toast.error('يرجى تحديد مخدوم واحد على الأقل')

    try {
      setAssigning(true)
      const res = await apiFetch<{ message: string; upsertedCount: number; skippedCount: number }>(
        '/api/outreach/assignments',
        {
          method: 'POST',
          body: JSON.stringify({
            roundId: selectedRoundId,
            servantId: selectedServantId,
            servanteeIds: Array.from(selectedIds),
          }),
        }
      )
      if (res.skippedCount > 0) toast.warning(res.message)
      else toast.success(res.message)
      setSelectedIds(new Set())
      fetchEligibleServantees()
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'فشل إسناد المخدومين')
    } finally {
      setAssigning(false)
    }
  }

  const selectedServant = servants.find((s) => s._id === selectedServantId)
  const hasFilters = !!(selectedLetter || selectedChurch || selectedCollege || searchQuery)

  // ---------- Blocking states ----------
  if (!hasActiveCycle || assignableRounds.length === 0) {
    return (
      <Card className="text-center py-12 text-muted-foreground">
        <CardContent className="space-y-2">
          <AlertCircle className="h-10 w-10 mx-auto text-amber-500/60" />
          <p className="font-semibold text-foreground">
            {!hasActiveCycle ? 'لا توجد دورة افتقاد نشطة' : 'لا توجد جولة نشطة لإسناد المخدومين إليها'}
          </p>
          <p className="text-xs">
            {!hasActiveCycle
              ? 'ابدأ دورة جديدة من الأعلى أولاً، ثم أنشئ جولة.'
              : 'أنشئ جولة جديدة أو أعد تنشيط جولة من تبويب "الجولات والدورات".'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const assignButton = (
    <Button
      onClick={handleAssignSubmit}
      disabled={assigning || selectedIds.size === 0 || !selectedServantId || !selectedRoundId}
      className="gap-2 font-semibold shadow-sm min-w-0"
    >
      {assigning ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <UserCheck className="h-4 w-4 shrink-0" />}
      <span className="truncate">
        {assigning
          ? 'جاري الإسناد...'
          : selectedServant
          ? `إسناد ${selectedIds.size} لـ ${selectedServant.name}`
          : 'اختر الخادم أولاً'}
      </span>
    </Button>
  )

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-0" dir="rtl">
      {/* 1. Target configuration card */}
      <Card className="border-primary/20 shadow-sm bg-gradient-to-l from-card to-primary/5 gap-4 py-4 sm:py-6">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary shrink-0" />
            <span>وجهة التكليف</span>
          </CardTitle>
          <CardDescription>اختر الجولة والخادم، ثم حدد المخدومين من القائمة.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold block">الجولة المستهدفة</Label>
              <Select value={selectedRoundId} onValueChange={setSelectedRoundId}>
                <SelectTrigger className="w-full bg-background" dir="rtl">
                  <SelectValue placeholder="اختر جولة الافتقاد..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {assignableRounds.map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold block">الخادم المكلف</Label>
              <Select value={selectedServantId} onValueChange={setSelectedServantId}>
                <SelectTrigger className="w-full bg-background" dir="rtl">
                  <SelectValue placeholder="اختر الخادم..." />
                </SelectTrigger>
                <SelectContent dir="rtl" className="max-h-72">
                  {sortedServants.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                      {s.role === 'Admin' && <span className="text-muted-foreground text-xs"> (مسؤول)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="quota" className="text-xs font-semibold block">تحديد سريع لعدد</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="quota"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(e.target.value)}
                  onBlur={() => setQuotaInput(String(quota))}
                  className="w-20 bg-background text-center"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1 flex-1 text-xs"
                  onClick={handleQuickSelect}
                  disabled={filteredServantees.length === 0}
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>حدد {quota} من المعروض</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Alphabet Bar */}
      <AlphabetFilterBar
        selectedLetter={selectedLetter}
        onSelectLetter={setSelectedLetter}
        letterCounts={letterCounts}
        totalCount={filteredExceptLetter.length}
      />

      {/* 3. Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="بحث بالاسم أو الهاتف أو الكنيسة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <FilterCombobox
            label="الكنيسة"
            placeholder="كل الكنائس"
            options={churchOptions}
            value={selectedChurch}
            onChange={setSelectedChurch}
            icon={<Church className="h-4 w-4" />}
          />
          <FilterCombobox
            label="الكلية"
            placeholder="كل الكليات"
            options={collegeOptions}
            value={selectedCollege}
            onChange={setSelectedCollege}
            icon={<GraduationCap className="h-4 w-4" />}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="gap-1 text-xs text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              مسح الفلاتر
            </Button>
          )}
        </div>
      </div>

      {/* 4. Selection Action Bar (desktop / tablet) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSelectAllFiltered} disabled={filteredServantees.length === 0} className="text-xs">
            {allFilteredSelected ? 'إلغاء تحديد المعروض' : `تحديد كل المعروض (${filteredServantees.length})`}
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-xs text-destructive hover:text-destructive">
              مسح التحديد
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            المعروض <strong className="tabular-nums">{filteredServantees.length}</strong> من{' '}
            <strong className="tabular-nums">{eligibleServantees.length}</strong> متاح
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-3 min-w-0">
          <Badge variant="secondary" className="font-bold text-primary px-2 tabular-nums shrink-0">
            {selectedIds.size} محدد
          </Badge>
          {assignButton}
        </div>
      </div>

      {/* 5. Servantees Table */}
      <Card className="overflow-hidden border shadow-sm py-0 gap-0">
        <Table className="w-full text-right" dir="rtl">
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 sm:w-12 text-center">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={handleSelectAllFiltered}
                  aria-label="تحديد كل المعروض"
                  disabled={filteredServantees.length === 0}
                />
              </TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right hidden sm:table-cell">الهاتف</TableHead>
              <TableHead className="text-right hidden md:table-cell">الكنيسة</TableHead>
              <TableHead className="text-right hidden lg:table-cell">الكلية / التعليم</TableHead>
              <TableHead className="text-right hidden xl:table-cell">الإيبارشية</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  جاري تحميل المخدومين المتاحين...
                </TableCell>
              </TableRow>
            ) : filteredServantees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground whitespace-normal">
                  {eligibleServantees.length === 0
                    ? 'تم تكليف كافة المخدومين في هذه الدورة!'
                    : 'لا توجد نتائج تطابق الفلاتر المحددة.'}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((s) => {
                const isChecked = selectedIds.has(s._id)
                return (
                  <TableRow
                    key={s._id}
                    data-state={isChecked ? 'selected' : undefined}
                    className={cn('cursor-pointer transition-colors', isChecked && 'bg-primary/5 hover:bg-primary/10')}
                    onClick={() => handleToggleRow(s._id)}
                  >
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleRow(s._id)}
                        aria-label={`تحديد ${s.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-normal py-2.5">
                      <div className="font-semibold text-foreground">{s.name}</div>
                      {/* Secondary details collapse under the name on small screens */}
                      <div className="sm:hidden text-[11px] text-muted-foreground font-mono" dir="ltr">
                        {s.phone}
                      </div>
                      <div className="md:hidden text-[11px] text-muted-foreground truncate max-w-[60vw]">
                        {[s.church, s.education].filter(Boolean).join(' · ')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs hidden sm:table-cell" dir="ltr">
                      {s.phone}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground hidden md:table-cell">{s.church || '-'}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground hidden lg:table-cell">{s.education || '-'}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground hidden xl:table-cell">{s.diocese || '-'}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        {!loading && filteredServantees.length > renderLimit && (
          <div className="p-3 border-t text-center">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setRenderLimit((n) => n + RENDER_STEP * 2)}>
              عرض المزيد ({filteredServantees.length - renderLimit} متبقي)
            </Button>
          </div>
        )}
      </Card>

      {/* Mobile sticky action bar */}
      {selectedIds.size > 0 && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-bold text-primary px-2 tabular-nums shrink-0">
              {selectedIds.size}
            </Badge>
            <div className="flex-1 min-w-0 [&>button]:w-full">{assignButton}</div>
          </div>
        </div>
      )}
    </div>
  )
}
