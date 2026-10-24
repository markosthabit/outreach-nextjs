'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ClusteredFilterOption } from '@/lib/servantee-filters'
import { matchesArabic } from '@/lib/arabic-search'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { ChevronDown, Search, X, Check } from 'lucide-react'

interface FilterComboboxProps {
  label: string
  placeholder: string
  searchPlaceholder?: string
  options: ClusteredFilterOption[]
  value: string | null
  onChange: (value: string | null) => void
  icon?: React.ReactNode
  className?: string
}

/**
 * Searchable single-select filter.
 * - Desktop: anchored popover.
 * - Mobile (< 768px): bottom sheet (Drawer) with large touch targets.
 */
export function FilterCombobox({
  label,
  placeholder,
  searchPlaceholder = 'ابحث...',
  options,
  value,
  onChange,
  icon,
  className,
}: FilterComboboxProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedOption = useMemo(() => {
    if (!value) return null
    return options.find((opt) => opt.id === value) || null
  }, [value, options])

  // Desktop only: close on outside click / Escape, autofocus search
  useEffect(() => {
    if (!open || isMobile) return

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    const t = setTimeout(() => searchInputRef.current?.focus(), 50)

    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, isMobile])

  const filteredOptions = useMemo(() => {
    const q = query.trim()
    if (!q) return options
    return options.filter(
      (opt) => matchesArabic(q, opt.label) || opt.rawValues.some((raw) => matchesArabic(q, raw))
    )
  }, [options, query])

  const select = (id: string | null) => {
    onChange(id)
    setOpen(false)
  }

  // ── Shared pieces ─────────────────────────────────────────
  const searchField = (
    <div className="relative">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={searchInputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        // text-base on mobile prevents iOS Safari auto-zoom on focus
        className="h-11 md:h-8 pr-9 pl-9 text-base md:text-xs bg-background rounded-lg"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 p-2 md:p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="مسح البحث"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  const optionsList = (
    <div className="space-y-0.5 text-sm md:text-xs">
      <button
        type="button"
        onClick={() => select(null)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-3 md:px-2.5 md:py-1.5 rounded-lg text-right transition-colors cursor-pointer',
          value === null
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-muted active:bg-muted text-muted-foreground hover:text-foreground'
        )}
      >
        <span>الكل (عرض جميع الخيارات)</span>
        {value === null && <Check className="h-4 w-4 md:h-3.5 md:w-3.5 text-primary" />}
      </button>

      {filteredOptions.length === 0 ? (
        <div className="py-8 md:py-6 text-center text-muted-foreground">
          لا توجد نتائج مطابقة لـ &quot;{query}&quot;
        </div>
      ) : (
        filteredOptions.map((opt) => {
          const isSelected = value === opt.id
          const hasMultipleVariants = opt.rawValues.length > 1

          return (
            <button
              key={opt.id}
              type="button"
              title={opt.label}
              onClick={() => select(isSelected ? null : opt.id)}
              className={cn(
                'w-full flex items-start justify-between gap-3 px-3 py-3 md:px-2.5 md:py-2 rounded-lg text-right transition-colors cursor-pointer',
                isSelected
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted active:bg-muted text-foreground'
              )}
            >
              <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                <div className="flex items-start gap-1.5 min-w-0 w-full">
                  {isSelected && <Check className="h-4 w-4 md:h-3.5 md:w-3.5 text-primary shrink-0 mt-0.5" />}
                  <span className="whitespace-normal break-words leading-snug text-start flex-1 font-medium">{opt.label}</span>
                </div>
                {hasMultipleVariants && (
                  <span className="text-[11px] md:text-[10px] text-muted-foreground/75 whitespace-normal break-words leading-tight text-start pr-5">
                    يشمل {opt.rawValues.length} صيغ مختلفة
                  </span>
                )}
              </div>

              <Badge
                variant="secondary"
                className={cn(
                  'h-6 md:h-5 px-2 md:px-1.5 text-[11px] md:text-[10px] shrink-0 font-normal self-start mt-0.5',
                  isSelected ? 'bg-primary/20 text-primary font-medium' : 'text-muted-foreground'
                )}
              >
                {opt.count}
              </Badge>
            </button>
          )
        })
      )}
    </div>
  )

  return (
    <div ref={containerRef} className={cn('relative w-full text-right', className)}>
      {/* Trigger */}
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev)
          setQuery('')
        }}
        className={cn(
          'w-full h-11 md:h-9.5 justify-between gap-2 px-3 text-sm font-normal rounded-lg transition-all border-input bg-background/80 hover:bg-muted/40',
          value
            ? 'border-primary/60 bg-primary/5 text-primary font-medium hover:bg-primary/10'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedOption ? (
            <>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-primary/15 text-primary font-semibold">
                {selectedOption.count}
              </Badge>
              <span
                role="button"
                tabIndex={0}
                aria-label={`إلغاء تصفية ${label}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange(null)
                  }
                }}
                className="p-1.5 md:p-0.5 -my-1 rounded-full hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            </>
          ) : (
            <ChevronDown
              className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
            />
          )}
        </div>
      </Button>

      {/* Mobile: bottom sheet */}
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent dir="rtl" className="max-h-[85vh]">
            <DrawerHeader className="text-right pb-2">
              <DrawerTitle className="flex items-center gap-2 text-base">
                {icon}
                {label}
              </DrawerTitle>
              <DrawerDescription className="text-xs">
                {options.length} قيمة مجمّعة · تم دمج الأسماء المتشابهة تلقائياً
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-4 pb-3">{searchField}</div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {optionsList}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        /* Desktop: anchored popover */
        open && (
          <div
            dir="rtl"
            className="absolute z-50 mt-1.5 w-full min-w-[280px] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl shadow-black/10 animate-in fade-in-0 zoom-in-95 duration-150 right-0"
          >
            <div className="p-2.5 border-b border-border/80 space-y-2 bg-muted/30 rounded-t-xl">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {icon}
                  {label}
                </span>
                <span className="text-[11px] text-muted-foreground">({options.length} قيمة مجمّعة)</span>
              </div>
              {searchField}
            </div>

            <div className="max-h-60 overflow-y-auto p-1.5">{optionsList}</div>

            <div className="p-2 border-t border-border/80 text-[10px] text-muted-foreground bg-muted/20 text-center rounded-b-xl">
              تم دمج وتوحيد الأسماء المتشابهة تلقائياً
            </div>
          </div>
        )
      )}
    </div>
  )
}
