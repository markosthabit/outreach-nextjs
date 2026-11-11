'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Phone,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  Search,
  Church,
  GraduationCap,
  MessageSquare,
  Loader2,
  UserMinus,
} from 'lucide-react'
import { IconBrandWhatsapp } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { matchesArabic } from '@/lib/arabic-search'
import { formatDateTime, telHref, whatsappHref } from './outreach-utils'

interface ServantReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servantData: {
    servant: { _id: string; name: string; email: string }
    assignedCount: number
    calledCount: number
    notCalledCount: number
    completionPercentage: number
    assignments: any[]
  } | null
  roundName?: string
  onToggleAssignment?: (assignmentId: string, newState: boolean) => Promise<void>
  onRemoveAssignment?: (assignmentId: string) => Promise<void>
}

export function ServantReportDialog({
  open,
  onOpenChange,
  servantData,
  roundName,
  onToggleAssignment,
  onRemoveAssignment,
}: ServantReportDialogProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'called' | 'notCalled'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<any | null>(null)

  const servantId = servantData?.servant?._id
  // Each servant opens with a clean filter state
  useEffect(() => {
    setFilterMode('all')
    setSearchTerm('')
  }, [servantId])

  const assignments = useMemo(() => servantData?.assignments || [], [servantData])

  const filteredAssignments = useMemo(() => {
    const q = searchTerm.trim()
    return assignments.filter((a) => {
      if (filterMode === 'called' && !a.isCalled) return false
      if (filterMode === 'notCalled' && a.isCalled) return false
      if (!q) return true
      const s = a.servanteeId || {}
      return matchesArabic(q, s.name || '') || (s.phone || '').includes(q) || matchesArabic(q, s.church || '')
    })
  }, [assignments, filterMode, searchTerm])

  async function run(id: string, fn: () => Promise<void>) {
    if (busyId) return
    setBusyId(id)
    try {
      await fn()
    } finally {
      setBusyId(null)
    }
  }

  if (!servantData) return null

  const filterButtons = [
    { key: 'all' as const, label: 'الكل', count: servantData.assignedCount, active: '' },
    { key: 'notCalled' as const, label: 'لسه', count: servantData.notCalledCount, active: 'bg-rose-600 hover:bg-rose-700 text-white' },
    { key: 'called' as const, label: 'تم إفتقادهم', count: servantData.calledCount, active: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-3xl h-[90dvh] sm:h-[85vh] max-h-[90dvh] flex flex-col gap-0 p-4 sm:p-6 text-right overflow-hidden"
          dir="rtl"
        >
          <DialogHeader className="border-b pb-3 sm:pb-4 pl-8 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 leading-snug">
                  <User className="h-5 w-5 text-primary shrink-0" />
                  <span className="truncate">{servantData.servant.name}</span>
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {roundName ? `جولة: ${roundName}` : 'التكليفات وحالة الافتقاد'}
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 px-2.5 py-1 font-semibold gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  تم إفتقادهم: {servantData.calledCount}
                </Badge>
                <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 px-2.5 py-1 font-semibold gap-1">
                  <XCircle className="h-3.5 w-3.5" />
                  فاضلين: {servantData.notCalledCount}
                </Badge>
                <Badge className="px-2.5 py-1 text-xs">{servantData.completionPercentage}% إنجاز</Badge>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 sm:mt-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="دوّر بالاسم أو التليفون أو الكنيسة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-9 h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-1 bg-muted/60 p-1 rounded-lg sm:flex sm:items-center">
                {filterButtons.map((f) => (
                  <Button
                    key={f.key}
                    variant={filterMode === f.key ? 'default' : 'ghost'}
                    size="sm"
                    className={cn('h-8 sm:h-7 text-xs px-2', filterMode === f.key && f.active)}
                    onClick={() => setFilterMode(f.key)}
                    aria-pressed={filterMode === f.key}
                  >
                    {f.label} ({f.count})
                  </Button>
                ))}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1 mt-3">
            {filteredAssignments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">مفيش نتايج</div>
            ) : (
              <div className="space-y-2.5 sm:space-y-3 py-1">
                {filteredAssignments.map((assignment: any) => {
                  const s = assignment.servanteeId
                  const isCalled = assignment.isCalled
                  const isBusy = busyId === assignment._id
                  const tel = telHref(s?.phone)
                  const wa = whatsappHref(s?.phone)

                  return (
                    <div
                      key={assignment._id}
                      className={cn(
                        'p-3 sm:p-4 rounded-xl border transition-colors',
                        isCalled
                          ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/25'
                          : 'border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20'
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm sm:text-base text-foreground break-words">
                              {s?.name || 'مخدوم مش معروف'}
                            </span>
                            {isCalled ? (
                              <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                                <CheckCircle2 className="h-3 w-3" />
                                تم إفتقاده
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-600 text-white gap-1 text-[11px]">
                                <XCircle className="h-3 w-3" />
                                لسه
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap">
                            {s?.phone && (
                              <span className="flex items-center gap-1 font-mono" dir="ltr">
                                <Phone className="h-3 w-3" />
                                {s.phone}
                              </span>
                            )}
                            {s?.church && (
                              <span className="flex items-center gap-1">
                                <Church className="h-3 w-3 text-primary/70 shrink-0" />
                                {s.church}
                              </span>
                            )}
                            {s?.education && (
                              <span className="flex items-center gap-1">
                                <GraduationCap className="h-3 w-3 text-primary/70 shrink-0" />
                                {s.education}
                              </span>
                            )}
                          </div>

                          {isCalled && assignment.calledAt && (
                            <div className="pt-1 flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex-wrap">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>تم إفتقاده يوم: {formatDateTime(assignment.calledAt, true)}</span>
                              {assignment.calledBy?.name && (
                                <span className="text-muted-foreground">(كلمه: {assignment.calledBy.name})</span>
                              )}
                            </div>
                          )}

                          {assignment.notes && (
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-background/60 p-2 rounded-md mt-1 border">
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                              <span className="whitespace-pre-wrap break-words">{assignment.notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {tel && (
                            <Button variant="outline" size="sm" className="h-9 sm:h-8 gap-1 text-xs" asChild>
                              <a href={tel} aria-label="كلّمه">
                                <Phone className="h-3.5 w-3.5 text-primary" />
                                <span className="hidden sm:inline">كلّمه</span>
                              </a>
                            </Button>
                          )}
                          {wa && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 sm:h-8 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              asChild
                            >
                              <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="واتساب">
                                <IconBrandWhatsapp className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          {onRemoveAssignment && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 sm:h-8 text-muted-foreground hover:text-destructive"
                              disabled={isBusy}
                              onClick={() => setConfirmRemove(assignment)}
                              aria-label="شيل التكليف"
                              title="شيل التكليف"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {onToggleAssignment && (
                            <Button
                              variant={isCalled ? 'outline' : 'default'}
                              size="sm"
                              disabled={isBusy}
                              className={cn(
                                'h-9 sm:h-8 text-xs flex-1 sm:flex-none min-w-[96px]',
                                !isCalled && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              )}
                              onClick={() =>
                                run(assignment._id, () => onToggleAssignment(assignment._id, !isCalled))
                              }
                            >
                              {isBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : isCalled ? (
                                'شيل الاتصال'
                              ) : (
                                'كلمته'
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t mt-3 flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <span>قدامك: {filteredAssignments.length} مخدوم</span>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
              اقفل
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تشيل تكليف المخدوم؟</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{confirmRemove?.servanteeId?.name}&quot; هيتشال من مخدومين {servantData.servant.name}
              {confirmRemove?.isCalled ? ' (وتسجيل الاتصال والملاحظة هيتمسحوا)' : ''}، ويرجع لقايمة المتاحين
              للتوزيع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>رجوع</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const a = confirmRemove
                setConfirmRemove(null)
                if (a && onRemoveAssignment) run(a._id, () => onRemoveAssignment(a._id))
              }}
            >
              أيوه، شيله
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
