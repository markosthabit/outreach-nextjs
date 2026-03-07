'use client'
import { Button } from '@/components/ui/button'

export function PaginatedTable({
  children,
  page,
  setPage,
  hasMore,
  loading
}: {
  children: React.ReactNode
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  hasMore: boolean
  loading: boolean
}) {
  return (
    <div>
      {children}
      <div className="flex justify-center gap-4 mt-4">
        <Button
          type='button'
          variant="outline"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
        >
          ⬅️ السابق
        </Button>
        <span className="self-center font-medium">الصفحة {page}</span>
        <Button
          type='button'
          variant="outline"
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore || loading}
        >
          التالي ➡️
        </Button>
      </div>
    </div>
  )
}
