'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, ChevronLeft, ChevronRight, PhoneOff, Search, User, Users } from 'lucide-react'
import { IconBrandWhatsapp } from '@tabler/icons-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate, formatDateTime, whatsappHref } from './outreach-utils'

interface Row {
  servantee: { _id: string; name: string; phone?: string; church?: string; diocese?: string }
  assigned: boolean
  isCalled: boolean
  calledAt?: string | null
  servant?: { _id: string; name: string } | null
  calledBy?: { _id: string; name: string } | null
  round?: { _id: string; name: string } | null
  notes?: string
}

interface CycleServanteesData {
  summary: { total: number; contacted: number; notContacted: number; unassigned: number }
  rows: Row[]
  total: number
  page: number
  totalPages: number
}

const PAGE_SIZE = 20

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycle: { _id: string; name: string; status: string; startedAt: string; endedAt?: string | null } | null
}

export function CycleServanteesDialog({ open, onOpenChange, cycle }: Props) {
  const [data, setData] = useState<CycleServanteesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'contacted' | 'notContacted'>('contacted')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(searchTerm, 400)
  const listRef = useRef<HTMLDivElement>(null)

  const cycleId = cycle?._id

  // Each cycle opens on a clean first page
  useEffect(() => {
    if (!open) return
    setData(null)
    setTab('contacted')
    setSearchTerm('')
    setPage(1)
  }, [open, cycleId])

  // Only the visible page is fetched; tab, search and page all go to the server
  const query = debouncedSearch.trim()
  useEffect(() => {
    if (!open || !cycleId) return
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ status: tab, page: String(page), limit: String(PAGE_SIZE) })
    if (query) params.set('q', query)
    apiFetch<CycleServanteesData>(`/api/outreach/cycles/${cycleId}/servantees?${params}`)
      .then((res) => {
        if (cancelled) return
        setData(res)
        listRef.current?.scrollTo({ top: 0 })
      })
      .catch((err: any) => {
        if (!cancelled) toast.error(err?.message || 'معرفناش نحمّل مخدومين الدورة')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, cycleId, tab, page, query])

  const rows = data?.rows ?? []
  const totalPages = data?.totalPages ?? 1

  const tabs = [
    {
      key: 'contacted' as const,
      label: 'تم إفتقادهم',
      count: data?.summary.contacted,
      active: 'bg-emerald-600 text-white',
    },
    {
      key: 'notContacted' as const,
      label: 'لم يتم إفتقادهم',
      count: data?.summary.notContacted,
      active: 'bg-rose-600 text-white',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl h-[90dvh] sm:h-[85vh] max-h-[90dvh] flex flex-col gap-0 p-4 sm:p-6 text-right overflow-hidden"
        dir="rtl"
      >
        <DialogHeader className="border-b pb-3 pl-8 shrink-0 space-y-1">
          <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 leading-snug">
            <Users className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">{cycle?.name}</span>
          </DialogTitle>
          <DialogDescription>
            {cycle
              ? `${formatDate(cycle.startedAt)} – ${cycle.endedAt ? formatDate(cycle.endedAt) : 'لسه شغالة'}`
              : ''}
            {data ? ` · ${data.summary.total} مخدوم` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-2.5 shrink-0">
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-xl border border-border/50 text-sm">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tab === t.key}
                onClick={() => {
                  setTab(t.key)
                  setPage(1)
                }}
                className={cn(
                  'flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-all cursor-pointer',
                  tab === t.key ? cn(t.active, 'shadow-xs font-semibold') : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'text-xs px-1.5 rounded-full tabular-nums font-semibold',
                    tab === t.key ? 'bg-white/20' : 'bg-foreground/5'
                  )}
                >
                  {t.count ?? '…'}
                </span>
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="دوّر بالاسم أو التليفون أو الكنيسة أو الخادم..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="pr-9 h-10 text-base sm:text-sm"
            />
          </div>

          {tab === 'notContacted' && data && data.summary.unassigned > 0 && (
            <p className="text-xs text-muted-foreground">
              منهم {data.summary.unassigned} متوزعوش على أي خادم في الدورة دي.
            </p>
          )}
        </div>

        <div
          ref={listRef}
          className={cn('flex-1 min-h-0 overflow-y-auto -mx-1 px-1 transition-opacity', loading && data && 'opacity-60')}
        >
          {loading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              {searchTerm.trim()
                ? 'مفيش نتايج للبحث ده'
                : tab === 'contacted'
                ? 'لسه محدش تم إفتقاده في الدورة دي'
                : 'كل المخدومين تم إفتقادهم في الدورة دي'}
            </p>
          ) : (
            <ul className="divide-y border rounded-lg">
              {rows.map((r) => (
                <li
                  key={r.servantee._id}
                  className="flex flex-col min-[480px]:flex-row min-[480px]:items-center justify-between gap-1.5 min-[480px]:gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" title={r.servantee.name}>
                      {r.servantee.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                      <span dir="ltr" className="font-mono tabular-nums shrink-0">
                        {r.servantee.phone || '—'}
                      </span>
                      {r.servantee.phone && (
                        <a
                          href={whatsappHref(r.servantee.phone) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center justify-center size-6 rounded-full hover:text-green-600 hover:bg-green-500/10 transition-colors"
                          title="ابعتله واتساب"
                          aria-label={`واتساب ${r.servantee.name}`}
                        >
                          <IconBrandWhatsapp size={15} stroke={1.6} />
                        </a>
                      )}
                      {r.servantee.church && <span className="truncate">· {r.servantee.church}</span>}
                    </div>
                  </div>

                  <div className="shrink-0 min-[480px]:text-left text-xs space-y-0.5 min-[480px]:max-w-[45%]">
                    {r.assigned ? (
                      <p className="flex items-center min-[480px]:justify-end gap-1 font-medium text-foreground/90">
                        {r.isCalled ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{r.servant?.name || 'خادم ممسوح'}</span>
                      </p>
                    ) : (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground gap-1">
                        <PhoneOff className="h-3 w-3" />
                        مش متوزع
                      </Badge>
                    )}
                    {r.assigned && (
                      <p className="text-muted-foreground truncate">
                        {[r.isCalled && r.calledAt ? formatDateTime(r.calledAt, true) : null, r.round?.name]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">
              {(data.page - 1) * PAGE_SIZE + 1}–{Math.min(data.page * PAGE_SIZE, data.total)} من {data.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || data.page <= 1}
              >
                <ChevronRight className="h-4 w-4 ml-1" />
                اللي قبل
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {data.page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || data.page >= totalPages}
              >
                اللي بعد
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
