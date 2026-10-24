'use client'

import { useState, useRef, useEffect, useMemo, forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ClusteredFilterOption, findClosestSuggestions } from '@/lib/servantee-filters'
import { cn } from '@/lib/utils'
import { Sparkles, Check, X } from 'lucide-react'

interface FuzzyAutocompleteInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  options: ClusteredFilterOption[]
  normalizer?: (val?: string | null) => string
  icon?: React.ReactNode
  labelTitle?: string
  placeholder?: string
  className?: string
}

export const FuzzyAutocompleteInput = forwardRef<HTMLInputElement, FuzzyAutocompleteInputProps>(
  (
    {
      value,
      onChange,
      options,
      normalizer,
      icon,
      labelTitle = 'الخيارات المقترحة',
      placeholder = 'اكتب أو اختر...',
      className,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState<number>(-1)
    const containerRef = useRef<HTMLDivElement>(null)

    // Compute fuzzy ranked suggestions
    const suggestions = useMemo(() => {
      return findClosestSuggestions(value || '', options, normalizer, 6)
    }, [value, options, normalizer])

    // Close on click outside
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (selectedLabel: string) => {
      onChange(selectedLabel)
      setOpen(false)
      setSelectedIndex(-1)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || suggestions.length === 0) {
        if (e.key === 'ArrowDown') {
          setOpen(true)
        }
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault()
          handleSelect(suggestions[selectedIndex].option.label)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        setSelectedIndex(-1)
      }
    }

    return (
      <div ref={containerRef} className="relative w-full">
        {/* Input with icon & clear button */}
        <div className="relative">
          <Input
            ref={ref}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              if (!open) setOpen(true)
              setSelectedIndex(-1)
            }}
            onFocus={() => {
              setOpen(true)
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn('h-10 text-sm pl-8 pr-3 transition-colors', className)}
            autoComplete="off"
            {...props}
          />

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('')
                setOpen(true)
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
              tabIndex={-1}
              aria-label="مسح النص"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {open && suggestions.length > 0 && (
          <div
            dir="rtl"
            className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover text-popover-foreground shadow-lg shadow-black/10 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {/* Header info */}
            <div className="px-3 py-1.5 bg-muted/40 border-b border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="h-3 w-3 text-primary" />
                {value.trim() ? 'أقرب النتائج المقترحة' : labelTitle}
              </span>
              <span>{suggestions.length} اقتراح</span>
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto overflow-x-hidden p-1 space-y-0.5 text-xs">
              {suggestions.map(({ option, score, isCloseMatch }, idx) => {
                const isSelected = selectedIndex === idx
                const isExactCurrent = value.trim() === option.label

                return (
                  <button
                    key={option.id}
                    type="button"
                    title={option.label}
                    onMouseDown={(e) => {
                      // Use onMouseDown so it fires before input onBlur
                      e.preventDefault()
                      handleSelect(option.label)
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'w-full flex items-start justify-between gap-2.5 px-3 py-2.5 rounded-lg text-right transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 text-primary font-medium'
                        : isExactCurrent
                        ? 'bg-muted/70 text-foreground font-medium'
                        : 'hover:bg-muted text-foreground'
                    )}
                  >
                    <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                      <div className="flex items-start gap-1.5 w-full">
                        {isExactCurrent ? (
                          <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        ) : (
                          icon && <span className="shrink-0 text-muted-foreground/80 mt-0.5">{icon}</span>
                        )}
                        <span className="whitespace-normal break-words leading-snug text-start flex-1 font-medium text-foreground">
                          {option.label}
                        </span>
                      </div>

                      {option.rawValues.length > 1 && (
                        <span className="text-[10px] text-muted-foreground/75 whitespace-normal break-words leading-tight pr-5 text-start">
                          يشمل: {option.rawValues.slice(0, 3).join('، ')}
                          {option.rawValues.length > 3 ? '...' : ''}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-start mt-0.5">
                      {isCloseMatch && value.trim() && (
                        <Badge
                          variant="outline"
                          className="h-4.5 px-1.5 text-[9px] bg-primary/10 text-primary border-primary/30 font-medium shrink-0"
                        >
                          الأقرب
                        </Badge>
                      )}
                      {option.count > 0 && (
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px] font-normal text-muted-foreground shrink-0"
                        >
                          {option.count} مخدوم
                        </Badge>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Footer helper */}
            <div className="px-3 py-1.5 bg-muted/20 border-t border-border/50 text-[10px] text-muted-foreground text-center">
              اختر من القائمة، أو تابع الكتابة لإدخال اسم جديد
            </div>
          </div>
        )}
      </div>
    )
  }
)

FuzzyAutocompleteInput.displayName = 'FuzzyAutocompleteInput'
