'use client'
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useDebounce } from './use-debounce'

export function useEntityList<T>(endpoint: string, limit = 10) {
  const [data, setData] = useState<T[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 500)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(debouncedSearch ? { search: debouncedSearch } : {})
      })
      const res: any = await apiFetch(`/${endpoint}?${params}`)
      setData(res.data || res)
      setHasMore(!res.pages || page < res.pages)
    } catch (err: any) {
      setError(err.message || 'خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [endpoint, page, limit, debouncedSearch])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  return { data, loading, error, page, setPage, hasMore, searchTerm, setSearchTerm, refetch: fetchData }
}
