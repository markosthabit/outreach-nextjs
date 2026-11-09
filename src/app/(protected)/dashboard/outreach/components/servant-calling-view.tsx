'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Phone,
  CheckCircle2,
  XCircle,
  Calendar,
  Search,
  Church,
  GraduationCap,
  MessageSquare,
  HeartHandshake,
  Clock,
  Loader2,
} from 'lucide-react'
import { IconBrandWhatsapp } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { matchesArabic } from '@/lib/arabic-search'
import { formatDate, formatDateTime, telHref, whatsappHref } from './outreach-utils'

const MAX_NOTE_LENGTH = 2000

interface ServantCallingViewProps {
  assignments: any[]
  loading: boolean
  activeRound: any | null
  activeCycle: any | null
  /** Called with the server's updated assignment so the parent can patch it in place. */
  onAssignmentChange: (updated: any) => void
}

export function ServantCallingView({
  assignments,
  loading,
  activeRound,
  activeCycle,
  onAssignmentChange,
}: ServantCallingViewProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'called' | 'notCalled'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Note dialog state
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [currentAssignment, setCurrentAssignment] = useState<any | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const total = assignments.length
  const calledCount = assignments.filter((a) => a.isCalled).length
  const notCalledCount = total - calledCount
  const completionRate = total > 0 ? Math.round((calledCount / total) * 100) : 0

  const filtered = useMemo(() => {
    const q = searchTerm.trim()
    return assignments.filter((a) => {
      if (filterMode === 'called' && !a.isCalled) return false
      if (filterMode === 'notCalled' && a.isCalled) return false
      if (!q) return true
      const s = a.servanteeId || {}
      return (
        matchesArabic(q, s.name || '') ||
        (s.phone || '').includes(q) ||
        matchesArabic(q, s.church || '')
      )
    })
  }, [assignments, filterMode, searchTerm])

  async function handleToggle(assignment: any) {
    if (togglingId) return
    const nextCalledState = !assignment.isCalled
    try {
      setTogglingId(assignment._id)
      const res = await apiFetch<{ assignment: any }>(
        `/api/outreach/assignments/${assignment._id}/toggle`,
        { method: 'PATCH', body: JSON.stringify({ isCalled: nextCalledState }) }
      )
      onAssignmentChange(res.assignment)
      if (nextCalledState) {
        toast.success(`اتسجل إنك كلمت ${assignment.servanteeId?.name || 'المخدوم'}`)
      } else {
        toast.info('شيلنا علامة الاتصال')
      }
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نحدّث حالة الاتصال')
    } finally {
      setTogglingId(null)
    }
  }

  function openNoteDialog(assignment: any) {
    setCurrentAssignment(assignment)
    setNoteText(assignment.notes || '')
    setNoteDialogOpen(true)
  }

  async function handleSaveNote(e?: React.FormEvent) {
    e?.preventDefault()
    if (!currentAssignment) return
    try {
      setSavingNote(true)
      const res = await apiFetch<{ assignment: any }>(
        `/api/outreach/assignments/${currentAssignment._id}/toggle`,
        { method: 'PATCH', body: JSON.stringify({ notes: noteText }) }
      )
      onAssignmentChange(res.assignment)
      toast.success('الملاحظة اتحفظت')
      setNoteDialogOpen(false)
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نحفظ الملاحظة')
    } finally {
      setSavingNote(false)
    }
  }

  const filterButtons = [
    { key: 'all' as const, label: 'الكل', count: total, active: '' },
    { key: 'notCalled' as const, label: 'لسه', count: notCalledCount, active: 'bg-rose-600 hover:bg-rose-700 text-white' },
    { key: 'called' as const, label: 'اتكلموا', count: calledCount, active: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header & Progress Banner */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 shadow-sm overflow-hidden py-0">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <HeartHandshake className="h-5 w-5 text-primary shrink-0" />
                <span className="text-xs font-semibold text-primary">خدمة الافتقاد</span>
                {activeCycle && (
                  <Badge variant="outline" className="text-xs">
                    {activeCycle.name}
                  </Badge>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
                {activeRound?.name || 'جولة الافتقاد الحالية'}
              </h2>
              {activeRound?.startDate && activeRound?.endDate && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  من {formatDate(activeRound.startDate)} إلى {formatDate(activeRound.endDate)}
                </p>
              )}
            </div>

            {/* Progress summary stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:flex md:items-center">
              {[
                { value: calledCount, label: 'اتكلموا', cls: 'text-emerald-600 dark:text-emerald-400' },
                { value: notCalledCount, label: 'فاضلين', cls: 'text-rose-600 dark:text-rose-400' },
                { value: `${completionRate}%`, label: 'الإنجاز', cls: 'text-primary' },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-2.5 sm:p-3 bg-card rounded-xl border shadow-xs md:min-w-[84px]">
                  <div className={cn('text-xl sm:text-2xl font-black tabular-nums', stat.cls)}>{stat.value}</div>
                  <div className="text-[11px] font-medium text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 sm:mt-5 space-y-1.5">
            <div
              className="w-full h-2.5 sm:h-3 bg-muted rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={completionRate}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-gradient-to-l from-emerald-500 to-primary transition-all duration-500 ease-out rounded-full"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>{calledCount} من {total} مخدوم</span>
              <span className="text-left">
                {total > 0 && completionRate === 100
                  ? 'خلصت كل الافتقاد! ربنا يباركك يا خادم'
                  : `فاضل ${notCalledCount} مخدوم`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Filter & Search Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="دوّر بالاسم أو التليفون أو الكنيسة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9 bg-background"
          />
        </div>

        <div className="grid grid-cols-3 gap-1 bg-muted/60 p-1 rounded-xl sm:flex sm:items-center">
          {filterButtons.map((f) => (
            <Button
              key={f.key}
              variant={filterMode === f.key ? 'default' : 'ghost'}
              size="sm"
              className={cn('text-xs h-9 sm:h-8 px-2', filterMode === f.key && f.active)}
              onClick={() => setFilterMode(f.key)}
              aria-pressed={filterMode === f.key}
            >
              {f.label} ({f.count})
            </Button>
          ))}
        </div>
      </div>

      {/* 3. Cards Grid */}
      {loading && total === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12 sm:py-16 text-muted-foreground">
          <CardContent className="space-y-2">
            <HeartHandshake className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="font-semibold text-foreground">
              {total === 0 ? 'مفيش مخدومين متوزعين عليك' : 'مفيش نتايج هنا'}
            </p>
            <p className="text-xs">
              {!activeCycle
                ? 'مفيش دورة افتقاد شغالة دلوقتي.'
                : total === 0
                ? 'لسه متوزعش عليك مخدومين في الجولة دي. كلّم المسؤول.'
                : 'جرّب تغيّر البحث أو الفلتر اللي فوق.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((assignment) => {
            const s = assignment.servanteeId
            const isCalled = assignment.isCalled
            const isBusy = togglingId === assignment._id
            const tel = telHref(s?.phone)
            const wa = whatsappHref(s?.phone)

            return (
              <Card
                key={assignment._id}
                className={cn(
                  'transition-colors duration-200 border-2 flex flex-col justify-between overflow-hidden shadow-xs py-0 gap-0',
                  isCalled
                    ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20'
                    : 'border-border bg-card'
                )}
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base sm:text-lg text-foreground leading-tight break-words min-w-0">
                      {s?.name || 'مخدوم'}
                    </h3>

                    {isCalled ? (
                      <Badge className="bg-emerald-600 text-white gap-1 shrink-0 text-xs py-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        اتكلم
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-rose-600 border-rose-400/40 bg-rose-50 dark:bg-rose-950/30 gap-1 shrink-0 text-xs py-0.5">
                        <Clock className="h-3 w-3" />
                        لسه
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    {s?.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                        <span className="font-mono" dir="ltr">{s.phone}</span>
                      </div>
                    )}
                    {s?.church && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Church className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                        <span className="truncate">{s.church}</span>
                      </div>
                    )}
                    {s?.education && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GraduationCap className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                        <span className="truncate">{s.education}</span>
                      </div>
                    )}
                    {isCalled && assignment.calledAt && (
                      <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-medium pt-1">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>اتكلم: {formatDateTime(assignment.calledAt)}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3">
                  {assignment.notes && (
                    <button
                      type="button"
                      onClick={() => openNoteDialog(assignment)}
                      className="w-full text-right text-xs p-2.5 rounded-lg bg-background/80 border text-foreground/80 flex items-start gap-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                      <span className="line-clamp-2">{assignment.notes}</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    {tel && (
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs font-semibold h-10 sm:h-9" asChild>
                        <a href={tel}>
                          <Phone className="h-4 w-4 text-primary" />
                          <span>كلّمه</span>
                        </a>
                      </Button>
                    )}
                    {wa && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        asChild
                      >
                        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="ابعتله واتساب" title="ابعتله واتساب">
                          <IconBrandWhatsapp className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        'h-10 w-10 sm:h-9 sm:w-9 shrink-0',
                        assignment.notes ? 'text-primary border-primary/30' : 'text-muted-foreground'
                      )}
                      onClick={() => openNoteDialog(assignment)}
                      aria-label={assignment.notes ? 'عدّل الملاحظة' : 'ضيف ملاحظة'}
                      title={assignment.notes ? 'عدّل الملاحظة' : 'ضيف ملاحظة'}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button
                    onClick={() => handleToggle(assignment)}
                    disabled={isBusy}
                    variant={isCalled ? 'outline' : 'default'}
                    className={cn(
                      'w-full font-semibold h-10 sm:h-9 transition-colors text-sm sm:text-xs gap-1.5',
                      isCalled
                        ? 'text-muted-foreground hover:text-destructive hover:border-destructive/30'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    )}
                  >
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCalled ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {isCalled ? 'شيل علامة الاتصال' : 'كلمته'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={(o) => !savingNote && setNoteDialogOpen(o)}>
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
          <form onSubmit={handleSaveNote} className="space-y-4">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-lg">ملاحظة الافتقاد</DialogTitle>
              <DialogDescription className="text-sm">
                ملاحظة على مكالمة: {currentAssignment?.servanteeId?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="callNote" className="block">الملاحظة أو طلبة الصلاة</Label>
              <Textarea
                id="callNote"
                placeholder="مثلاً: عايز نصليله عشان امتحاناته، وهيحضر الخلوة الجاية..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                maxLength={MAX_NOTE_LENGTH}
                dir="rtl"
              />
              <p className="text-[11px] text-muted-foreground text-left tabular-nums">
                {noteText.length}/{MAX_NOTE_LENGTH}
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setNoteDialogOpen(false)} disabled={savingNote}>
                رجوع
              </Button>
              <Button type="submit" disabled={savingNote || noteText.trim() === (currentAssignment?.notes || '')}>
                {savingNote ? 'بنحفظ...' : 'احفظ الملاحظة'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
