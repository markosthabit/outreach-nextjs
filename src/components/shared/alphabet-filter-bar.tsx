'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ARABIC_ALPHABET } from '@/lib/servantee-filters'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react'

interface AlphabetFilterBarProps {
  selectedLetter: string | null
  onSelectLetter: (letter: string | null) => void
  letterCounts: Record<string, number>
  totalCount: number
}

export function AlphabetFilterBar({
  selectedLetter,
  onSelectLetter,
  letterCounts,
  totalCount,
}: AlphabetFilterBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Track whether more content exists on each side so we can show fade hints
  const [canScrollStart, setCanScrollStart] = useState(false)
  const [canScrollEnd, setCanScrollEnd] = useState(false)

  // Include '#' if there are items starting with non-Arabic or numbers
  const letters = [...ARABIC_ALPHABET, ...(letterCounts['#'] ? ['#'] : [])]

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    // In RTL, scrollLeft is 0 at the start and negative towards the end
    const max = el.scrollWidth - el.clientWidth
    const pos = Math.abs(el.scrollLeft)
    setCanScrollStart(pos > 4)
    setCanScrollEnd(pos < max - 4)
  }, [])

  useEffect(() => {
    updateScrollHints()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollHints, { passive: true })
    window.addEventListener('resize', updateScrollHints)
    return () => {
      el.removeEventListener('scroll', updateScrollHints)
      window.removeEventListener('resize', updateScrollHints)
    }
  }, [updateScrollHints, letters.length])

  // Keep the active letter visible (important on narrow screens)
  useEffect(() => {
    if (!selectedLetter || !scrollRef.current) return
    const btn = scrollRef.current.querySelector<HTMLElement>(`[data-letter="${selectedLetter}"]`)
    btn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedLetter])

  const scroll = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' })
  }

  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground min-w-0">
          <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate">فهرس الحروف الأبجدية</span>
          {selectedLetter && (
            <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full text-[11px] shrink-0">
              حرف {selectedLetter} ({letterCounts[selectedLetter] || 0})
            </span>
          )}
        </div>

        {/* Arrow controls: desktop only — touch users swipe */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full"
            onClick={() => scroll('right')}
            disabled={!canScrollStart}
            aria-label="تمرير لليمين"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full"
            onClick={() => scroll('left')}
            disabled={!canScrollEnd}
            aria-label="تمرير لليسار"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Scrollable letters with edge fades */}
      <div className="relative -mx-1">
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-6 z-10 bg-linear-to-l from-card to-transparent transition-opacity',
            canScrollStart ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-8 z-10 bg-linear-to-r from-card to-transparent transition-opacity',
            canScrollEnd ? 'opacity-100' : 'opacity-0'
          )}
        />

        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain py-1 px-1 scroll-smooth snap-x [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* 'All' */}
          <button
            type="button"
            onClick={() => onSelectLetter(null)}
            className={cn(
              'h-9 sm:h-7 px-3 text-xs font-medium rounded-lg shrink-0 snap-start transition-all cursor-pointer flex items-center gap-1.5',
              selectedLetter === null
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40'
            )}
          >
            <span>الكل</span>
            <span
              className={cn(
                'text-[10px] px-1 rounded-md',
                selectedLetter === null
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-background/80 text-muted-foreground'
              )}
            >
              {totalCount}
            </span>
          </button>

          <div className="h-5 sm:h-4 w-px bg-border/60 shrink-0 mx-0.5" />

          {letters.map((letter) => {
            const count = letterCounts[letter] || 0
            const isSelected = selectedLetter === letter
            const hasItems = count > 0

            return (
              <button
                key={letter}
                data-letter={letter}
                type="button"
                disabled={!hasItems}
                onClick={() => onSelectLetter(isSelected ? null : letter)}
                className={cn(
                  'h-9 min-w-9 sm:h-7 sm:min-w-7 px-2 flex items-center justify-center gap-1 rounded-lg text-sm sm:text-xs shrink-0 snap-start transition-all cursor-pointer',
                  isSelected && 'bg-primary text-primary-foreground font-bold shadow-xs ring-1 ring-primary/40',
                  !isSelected &&
                    hasItems &&
                    'bg-background hover:bg-muted text-foreground/80 hover:text-foreground border border-border/60 hover:border-primary/40 font-medium active:scale-95',
                  !hasItems && 'opacity-30 cursor-not-allowed text-muted-foreground/50 border border-transparent'
                )}
                aria-pressed={isSelected}
                title={hasItems ? `حرف ${letter} (${count} مخدوم)` : `لا يوجد مخدومين بحرف ${letter}`}
              >
                <span>{letter}</span>
                {hasItems && (
                  <span
                    className={cn(
                      'text-[10px] sm:text-[9px] font-normal px-1 rounded',
                      isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'text-muted-foreground/75'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
