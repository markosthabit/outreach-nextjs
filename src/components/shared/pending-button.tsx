'use client'

import { useState } from 'react'
import { Hourglass, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Solid "معلق" pill shown next to a servantee whose phone / details need fixing. */
export function PendingBadge({ className }: { className?: string }) {
  return (
    <span
      title="بياناته أو رقمه اتغيروا ومحتاجين مراجعة"
      className={cn(
        'inline-flex items-center gap-1 shrink-0 h-5 px-1.5 rounded-md bg-orange-500 text-white text-[11px] font-bold whitespace-nowrap',
        className
      )}
    >
      <Hourglass className="h-3 w-3" />
      معلق
    </span>
  )
}

/**
 * Marks a servantee as "معلق" (phone number or details changed, needs review),
 * or clears the mark. Any signed-in servant can use it.
 */
export function PendingButton({
  servanteeId,
  servanteeName,
  isPending,
  onChanged,
  compact = false,
  showLabel = false,
  className,
}: {
  servanteeId: string
  servanteeName?: string
  isPending?: boolean
  /** Called with the new state once the server saved it. */
  onChanged: (isPending: boolean) => void
  /** Subdued icon trigger, for dense table rows. */
  compact?: boolean
  /** Show the text label next to the icon. */
  showLabel?: boolean
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const pending = !!isPending
  const label = pending ? 'شيل علامة معلق' : 'علّمه معلق'

  const toggle = async () => {
    if (busy) return
    const next = !pending
    try {
      setBusy(true)
      await apiFetch(`/api/servantees/${servanteeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPending: next }),
      })
      toast.success(
        next
          ? `${servanteeName || 'المخدوم'} اتعلّم معلق`
          : `شيلنا علامة معلق من ${servanteeName || 'المخدوم'}`
      )
      onChanged(next)
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نحدّث حالة المخدوم')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant={compact ? 'ghost' : 'outline'}
      size={showLabel ? 'sm' : compact ? 'icon-sm' : 'icon'}
      onClick={toggle}
      disabled={busy}
      aria-pressed={pending}
      aria-label={label}
      title={pending ? 'شيل علامة معلق' : 'علّمه معلق (رقمه أو بياناته اتغيرت)'}
      className={cn(
        showLabel && 'gap-1.5 text-xs font-semibold',
        pending
          ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:text-white dark:bg-orange-500 dark:hover:bg-orange-600'
          : compact
          ? 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'
          : 'text-orange-600 border-orange-500/40 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950/30',
        className
      )}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hourglass className="w-4 h-4" />}
      {showLabel && <span>{pending ? 'معلق' : 'علّمه معلق'}</span>}
    </Button>
  )
}
