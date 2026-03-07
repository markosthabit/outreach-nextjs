'use client'
import { Input } from '@/components/ui/input'

export function SearchBar({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex gap-2 w-full sm:w-1/2">
      <Input
        placeholder={placeholder || 'ابحث...'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="text"
      />
    </div>
  )
}
