'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  DatabaseBackup,
  Download,
  Upload,
  Users,
  ShieldAlert,
  History,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileJson,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Labels ───────────────────────────────────────────────────────────────

const COLLECTION_LABELS: Record<string, string> = {
  servantees: 'المخدومين',
  retreats: 'الخلوات',
  notes: 'الملاحظات',
  outreach_cycles: 'دورات الافتقاد',
  outreach_rounds: 'جولات الافتقاد',
  outreach_assignments: 'تكليفات الافتقاد',
  users: 'المستخدمين',
}

const ACTION_LABELS: Record<string, string> = {
  'backup.data.download': 'نزّل نسخة البيانات',
  'backup.users.download': 'نزّل بيانات المستخدمين',
  'restore.data': 'رجّع البيانات',
  'restore.users': 'رجّع المستخدمين',
}

const CONFIRM_WORD = 'موافق'

// ─── Helpers ──────────────────────────────────────────────────────────────

/** fetch() that refreshes an expired access token once, like apiFetch, but returns the raw Response. */
async function authedFetch(url: string, init: RequestInit = {}) {
  let res = await fetch(url, { credentials: 'include', ...init })
  if (res.status === 401) {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    if (refreshed.ok) res = await fetch(url, { credentials: 'include', ...init })
  }
  return res
}

async function downloadBackup(kind: 'data' | 'users') {
  const res = await authedFetch(`/api/backup/${kind}`)
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message || 'التنزيل فشل')
  }
  const disposition = res.headers.get('content-disposition') || ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || `backup-${kind}.json`
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatDateTime(v?: string | { $date: string } | null) {
  const raw = typeof v === 'object' && v ? v.$date : v
  if (!raw) return '-'
  const d = new Date(raw)
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Preview = {
  file: File
  text: string
  type: 'data' | 'users'
  createdAt: string
  createdBy?: string
  counts: Record<string, number>
}

async function readPreview(file: File, expected: 'data' | 'users'): Promise<Preview> {
  if (file.size > 50 * 1024 * 1024) throw new Error('الملف أكبر من 50 ميجا')
  const text = await file.text()
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('الملف ده مش JSON سليم')
  }
  const type = json?.meta?.type
  if (type !== expected) {
    if (type === 'data') throw new Error('ده ملف نسخة البيانات، استخدم "رجّع البيانات"')
    if (type === 'users') throw new Error('ده ملف المستخدمين، استخدم "رجّع المستخدمين"')
    throw new Error('ده مش ملف نسخة احتياطية من السيستم ده')
  }
  const counts: Record<string, number> =
    expected === 'data'
      ? Object.fromEntries(
          Object.entries(json.collections || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
        )
      : { users: Array.isArray(json.users) ? json.users.length : 0 }
  return {
    file,
    text,
    type,
    createdAt: formatDateTime(json.meta.createdAt),
    createdBy: json.meta.createdBy?.name || json.meta.createdBy?.email,
    counts,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function BackupPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'

  const [downloading, setDownloading] = useState<'data' | 'users' | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<{ ok: boolean; title: string; lines: string[] } | null>(null)

  const [logs, setLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  const dataInput = useRef<HTMLInputElement>(null)
  const usersInput = useRef<HTMLInputElement>(null)

  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true)
      const res = await apiFetch<{ logs: any[] }>('/api/backup/audit?limit=100')
      setLogs(res.logs || [])
    } catch {
      toast.error('معرفناش نجيب سجل العمليات')
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) fetchLogs()
  }, [isAdmin, fetchLogs])

  async function handleDownload(kind: 'data' | 'users') {
    try {
      setDownloading(kind)
      const filename = await downloadBackup(kind)
      toast.success(`نزّلنا ${filename}`)
    } catch (err: any) {
      toast.error(err?.message || 'التنزيل فشل')
    } finally {
      setDownloading(null)
      fetchLogs()
    }
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>, expected: 'data' | 'users') {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    try {
      setRestoreResult(null)
      setConfirmText('')
      setPreview(await readPreview(file, expected))
    } catch (err: any) {
      toast.error(err?.message || 'معرفناش نقرا الملف')
    }
  }

  async function handleRestore() {
    if (!preview) return
    const kind = preview.type
    try {
      setRestoring(true)

      // Safety net: data restore wipes current data, so save a copy of it first
      if (kind === 'data') {
        toast.info('بننزّلك نسخة أمان من البيانات الحالية الأول...')
        await downloadBackup('data')
      }

      const res = await authedFetch(`/api/backup/restore/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: preview.text,
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        setRestoreResult({ ok: false, title: body.message || 'الاسترجاع فشل', lines: body.errors || [] })
        toast.error(body.message || 'الاسترجاع فشل')
        return
      }

      const lines =
        kind === 'data'
          ? Object.entries(body.restored || {}).map(
              ([k, v]) => `${COLLECTION_LABELS[k] || k}: ${v} (كانوا ${body.before?.[k] ?? 0})`
            )
          : [`اتعمل ${body.created} حساب جديد`, `اتحدّث ${body.updated} حساب`]
      setRestoreResult({ ok: true, title: body.message, lines })
      toast.success(body.message)
      setPreview(null)
    } catch (err: any) {
      toast.error(err?.message || 'الاسترجاع فشل')
    } finally {
      setRestoring(false)
      fetchLogs()
    }
  }

  // ── Access guard ──
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground animate-pulse">بنحمّل...</p>
      </div>
    )
  }
  if (!isAdmin) {
    return (
      <Card className="p-6 max-w-md mx-auto mt-20 text-center shadow-sm">
        <h2 className="text-xl font-semibold mb-2">مش مسموحلك تدخل هنا</h2>
        <p className="text-muted-foreground">الصفحة دي للمسؤولين بس.</p>
      </Card>
    )
  }

  const confirmMatches = confirmText.trim() === CONFIRM_WORD

  return (
    <div className="p-4 lg:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
          <DatabaseBackup className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">النسخ الاحتياطي</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            نزّل نسخة من بيانات السيستم أو رجّعها. أي حاجة بتتعمل هنا بتتسجل في السجل اللي تحت.
          </p>
        </div>
      </div>

      {/* Downloads */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              نسخة البيانات
            </CardTitle>
            <CardDescription>
              المخدومين والخلوات والملاحظات وكل بيانات الافتقاد، <strong>من غير</strong> حسابات المستخدمين وكلمات السر.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => handleDownload('data')} disabled={!!downloading} className="w-full sm:w-auto gap-2">
              {downloading === 'data' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              نزّل نسخة البيانات
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-4 border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600" />
              بيانات المستخدمين
            </CardTitle>
            <CardDescription>
              الأسامي والإيميلات والصلاحيات وكلمات السر <strong>متشفرة</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5 bg-amber-500/10 rounded-md p-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-px" />
              الملف ده حساس: احفظه في مكان أمان وماتبعتهوش لحد.
            </p>
            <Button
              variant="outline"
              onClick={() => handleDownload('users')}
              disabled={!!downloading}
              className="w-full sm:w-auto gap-2"
            >
              {downloading === 'users' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              نزّل بيانات المستخدمين
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Restores */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="gap-4 border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-destructive" />
              رجّع البيانات
            </CardTitle>
            <CardDescription>
              <strong>هتمسح</strong> كل البيانات اللي موجودة دلوقتي (ما عدا المستخدمين) وتحط مكانها اللي في الملف. قبلها
              هننزّلك نسخة أمان من البيانات الحالية أوتوماتيك، ولو حصل أي غلط مش هيتغير أي حاجة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={dataInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleFilePicked(e, 'data')}
            />
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => dataInput.current?.click()}
              disabled={restoring}
            >
              <FileJson className="h-4 w-4" />
              اختار ملف نسخة البيانات
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-4 border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-destructive" />
              رجّع المستخدمين
            </CardTitle>
            <CardDescription>
              <strong>هتضيف</strong> الحسابات اللي في الملف ومش موجودة، وتحدّث الموجودة (الاسم والإيميل والصلاحية
              وكلمة السر). مش هيتمسح أي حساب، واللي هيترجعوا هيحتاجوا يسجلوا دخول تاني.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={usersInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleFilePicked(e, 'users')}
            />
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => usersInput.current?.click()}
              disabled={restoring}
            >
              <FileJson className="h-4 w-4" />
              اختار ملف المستخدمين
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Result of last restore */}
      {restoreResult && (
        <div
          className={cn(
            'rounded-xl border p-4 text-sm space-y-2',
            restoreResult.ok
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          )}
          role="status"
        >
          <p className="font-semibold flex items-center gap-2">
            {restoreResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {restoreResult.title}
          </p>
          {restoreResult.lines.length > 0 && (
            <ul className="list-disc pr-5 space-y-0.5 text-xs">
              {restoreResult.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Audit trail */}
      <Card className="gap-0 py-0 overflow-hidden">
        <CardHeader className="p-4 sm:p-6 flex flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              سجل العمليات
            </CardTitle>
            <CardDescription>آخر 100 عملية نسخ أو استرجاع، حتى اللي فشلت.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loadingLogs} className="gap-1.5 shrink-0">
            <RefreshCw className={cn('h-4 w-4', loadingLogs && 'animate-spin')} />
            <span className="hidden sm:inline">حدّث</span>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loadingLogs && logs.length === 0 ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">لسه مفيش أي عمليات متسجلة.</p>
          ) : (
            <Table className="text-right" dir="rtl">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-right">العملية</TableHead>
                  <TableHead className="text-right">مين عملها</TableHead>
                  <TableHead className="text-right hidden md:table-cell">التفاصيل</TableHead>
                  <TableHead className="text-right">إمتى</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell className="text-right whitespace-normal">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-label="نجحت" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive shrink-0" aria-label="فشلت" />
                        )}
                        <span className="font-medium text-sm">{ACTION_LABELS[log.action] || log.action}</span>
                        {log.status === 'failure' && (
                          <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">
                            فشلت
                          </Badge>
                        )}
                      </div>
                      <div className="md:hidden text-[11px] text-muted-foreground mt-0.5">{summarize(log)}</div>
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-normal">
                      <div className="font-medium">{log.actorName || '-'}</div>
                      <div className="text-muted-foreground hidden sm:block" dir="ltr">
                        {log.ip}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground hidden md:table-cell whitespace-normal max-w-[360px]">
                      {summarize(log)}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Restore confirmation */}
      <AlertDialog open={!!preview} onOpenChange={(o) => !o && !restoring && setPreview(null)}>
        <AlertDialogContent dir="rtl" className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {preview?.type === 'data' ? 'هتمسح كل البيانات الحالية؟' : 'هترجّع حسابات المستخدمين؟'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {preview && (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-foreground">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">الملف</span>
                      <span className="font-mono truncate" dir="ltr">
                        {preview.file.name} ({formatBytes(preview.file.size)})
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">تاريخ النسخة</span>
                      <span>{preview.createdAt}</span>
                    </div>
                    {preview.createdBy && (
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">اتعملت بواسطة</span>
                        <span>{preview.createdBy}</span>
                      </div>
                    )}
                    <div className="border-t pt-1.5 mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {Object.entries(preview.counts).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{COLLECTION_LABELS[k] || k}</span>
                          <span className="font-semibold tabular-nums">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p>
                  {preview?.type === 'data'
                    ? 'كل المخدومين والخلوات والملاحظات وبيانات الافتقاد اللي موجودة دلوقتي هتتمسح ويتحط مكانها اللي في الملف. هننزّلك نسخة أمان من البيانات الحالية الأول.'
                    : 'الحسابات اللي في الملف هتتضاف أو تتحدث، ومعاها كلمات السر. الحسابات اللي مش في الملف مش هتتأثر.'}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmRestore" className="text-foreground">
                    عشان تأكد، اكتب كلمة <strong>{CONFIRM_WORD}</strong>
                  </Label>
                  <Input
                    id="confirmRestore"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoComplete="off"
                    dir="rtl"
                    disabled={restoring}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={restoring}>إلغاء</AlertDialogCancel>
            <Button variant="destructive" onClick={handleRestore} disabled={!confirmMatches || restoring} className="gap-2">
              {restoring && <Loader2 className="h-4 w-4 animate-spin" />}
              {restoring ? 'بنرجّع البيانات...' : 'أيوه، رجّعها'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function summarize(log: any): string {
  const d = log.details || {}
  if (log.status === 'failure') {
    return d.error || (Array.isArray(d.errors) ? d.errors.slice(0, 2).join(' · ') : 'العملية فشلت')
  }
  switch (log.action) {
    case 'backup.data.download':
      return d.counts
        ? Object.entries(d.counts)
            .map(([k, v]) => `${COLLECTION_LABELS[k] || k}: ${v}`)
            .join(' · ')
        : d.filename || ''
    case 'backup.users.download':
      return `${d.users ?? 0} مستخدم`
    case 'restore.data':
      return [
        d.backupCreatedAt ? `نسخة ${formatDateTime(d.backupCreatedAt)}` : '',
        d.restored
          ? Object.entries(d.restored)
              .map(([k, v]) => `${COLLECTION_LABELS[k] || k}: ${v}`)
              .join(' · ')
          : '',
      ]
        .filter(Boolean)
        .join(' — ')
    case 'restore.users':
      return `اتعمل ${d.created ?? 0} · اتحدّث ${d.updated ?? 0}`
    default:
      return ''
  }
}
