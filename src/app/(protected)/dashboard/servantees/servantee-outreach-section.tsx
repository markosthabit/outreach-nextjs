'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarDays, CheckCircle2, Loader2, MessageSquare, Pencil, PhoneCall, User, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { formatDateTime, toLocalDateInput } from '../outreach/components/outreach-utils'

interface Person {
  _id: string
  name: string
  email?: string
}

export interface OutreachRecord {
  _id: string
  isCalled: boolean
  calledAt?: string | null
  notes?: string
  cycleId?: { _id: string; name: string; status: string } | null
  roundId?: { _id: string; name: string; startDate: string; endDate: string; status: string } | null
  servantId?: Person | null
  calledBy?: Person | null
}

/** Value for <input type="datetime-local"> in the user's local timezone. */
function toLocalDateTimeInput(value?: string | Date | null): string {
  const d = value ? new Date(value) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${toLocalDateInput(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  history: OutreachRecord[]
  onRecordChange: (updated: OutreachRecord) => void
}

export function ServanteeOutreachSection({ history, onRecordChange }: Props) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'

  const [editingId, setEditingId] = useState<string | null>(null)
  const [users, setUsers] = useState<Person[] | null>(null)

  async function startEdit(id: string) {
    setEditingId(id)
    if (isAdmin && !users) {
      try {
        const res = await apiFetch<{ users: Person[] }>('/api/users')
        setUsers(res.users ?? [])
      } catch {
        toast.error('معرفناش نحمّل قايمة الخدام')
        setUsers([])
      }
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <PhoneCall className="h-4 w-4 text-primary" />
        الافتقاد
      </h3>

      {history.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-3 border rounded-lg border-dashed">
          لسه متوزعش على حد في أي دورة افتقاد
        </p>
      ) : (
        <div className="space-y-2">
          {history.map((record) => {
            const canEdit = isAdmin || (!!user && record.servantId?._id === user.id)
            return editingId === record._id ? (
              <OutreachEditForm
                key={record._id}
                record={record}
                isAdmin={isAdmin}
                users={users}
                onCancel={() => setEditingId(null)}
                onSaved={(updated) => {
                  onRecordChange(updated)
                  setEditingId(null)
                }}
              />
            ) : (
              <div key={record._id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{record.roundId?.name || 'جولة ممسوحة'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {record.cycleId?.name || 'دورة ممسوحة'}
                      {record.cycleId?.status === 'active' && ' · الدورة الشغالة'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {record.isCalled ? (
                      <Badge className="bg-emerald-600 text-white text-[11px] gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        تم إفتقاده
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-rose-600 border-rose-300 dark:border-rose-900 text-[11px] gap-1">
                        <XCircle className="h-3 w-3" />
                        لم يتم إفتقاده
                      </Badge>
                    )}
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(record._id)}
                        aria-label="عدّل بيانات الافتقاد"
                        title="عدّل بيانات الافتقاد"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">الخادم المكلف:</span>
                    <span className="font-medium truncate">{record.servantId?.name || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">تاريخ الافتقاد:</span>
                    <span className="font-medium truncate">
                      {record.isCalled && record.calledAt ? formatDateTime(record.calledAt, true) : '—'}
                    </span>
                  </div>
                  {record.isCalled && record.calledBy && record.calledBy._id !== record.servantId?._id && (
                    <div className="flex items-center gap-1.5 min-w-0 min-[400px]:col-span-2">
                      <PhoneCall className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground shrink-0">اللي سجّل الاتصال:</span>
                      <span className="font-medium truncate">{record.calledBy.name}</span>
                    </div>
                  )}
                </div>

                {record.notes && (
                  <p className="text-xs bg-muted/50 rounded-md p-2 flex gap-1.5 whitespace-pre-wrap break-words">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    {record.notes}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OutreachEditForm({
  record,
  isAdmin,
  users,
  onCancel,
  onSaved,
}: {
  record: OutreachRecord
  isAdmin: boolean
  users: Person[] | null
  onCancel: () => void
  onSaved: (updated: OutreachRecord) => void
}) {
  const [servantId, setServantId] = useState(record.servantId?._id || '')
  const [isCalled, setIsCalled] = useState(record.isCalled)
  const [calledAt, setCalledAt] = useState(toLocalDateTimeInput(record.calledAt))
  const [calledBy, setCalledBy] = useState(record.calledBy?._id || '')
  const [notes, setNotes] = useState(record.notes || '')
  const [saving, setSaving] = useState(false)

  // Keep people who are on the record selectable even before the users list loads
  const userOptions = [...(users ?? [])]
  for (const p of [record.servantId, record.calledBy]) {
    if (p && !userOptions.some((u) => u._id === p._id)) userOptions.push(p)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isAdmin && !servantId) return toast.error('اختار الخادم المكلف')
    if (isCalled && !calledAt) return toast.error('حدد تاريخ الافتقاد')
    if (isCalled && new Date(calledAt).getTime() > Date.now()) {
      return toast.error('تاريخ الافتقاد مينفعش يبقى في المستقبل')
    }

    const body: Record<string, unknown> = { isCalled, notes }
    if (isCalled) body.calledAt = new Date(calledAt).toISOString()
    if (isAdmin) {
      body.servantId = servantId
      if (isCalled && calledBy) body.calledBy = calledBy
    }

    try {
      setSaving(true)
      const res = await apiFetch<{ assignment: OutreachRecord }>(`/api/outreach/assignments/${record._id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      toast.success('بيانات الافتقاد اتحدثت')
      onSaved(res.assignment)
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نحدّث بيانات الافتقاد')
    } finally {
      setSaving(false)
    }
  }

  const fieldId = (name: string) => `outreach-${record._id}-${name}`

  return (
    <form onSubmit={handleSubmit} className="border border-primary/40 rounded-lg p-3 space-y-3 bg-primary/5">
      <p className="font-medium text-sm">
        تعديل: {record.roundId?.name || 'جولة'}
        {record.cycleId?.name ? ` · ${record.cycleId.name}` : ''}
      </p>

      {isAdmin && (
        <div className="space-y-1.5">
          <Label htmlFor={fieldId('servant')} className="text-xs">الخادم المكلف</Label>
          <Select value={servantId} onValueChange={setServantId} disabled={!users}>
            <SelectTrigger id={fieldId('servant')} className="w-full bg-background" dir="rtl">
              <SelectValue placeholder={users ? 'اختار الخادم...' : 'بنحمّل الخدام...'} />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {userOptions.map((u) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
        <Checkbox checked={isCalled} onCheckedChange={(v) => setIsCalled(v === true)} />
        تم إفتقاد المخدوم
      </label>

      {isCalled && (
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={fieldId('calledAt')} className="text-xs">تاريخ الافتقاد</Label>
            <Input
              id={fieldId('calledAt')}
              type="datetime-local"
              value={calledAt}
              max={toLocalDateTimeInput()}
              onChange={(e) => setCalledAt(e.target.value)}
              className="bg-background"
              dir="ltr"
              required
            />
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor={fieldId('calledBy')} className="text-xs">اللي سجّل الاتصال</Label>
              <Select value={calledBy} onValueChange={setCalledBy} disabled={!users}>
                <SelectTrigger id={fieldId('calledBy')} className="w-full bg-background" dir="rtl">
                  <SelectValue placeholder="إنت" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {userOptions.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={fieldId('notes')} className="text-xs">ملاحظات</Label>
        <Textarea
          id={fieldId('notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={2}
          className="bg-background"
          dir="rtl"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          رجوع
        </Button>
        <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          احفظ
        </Button>
      </div>
    </form>
  )
}
