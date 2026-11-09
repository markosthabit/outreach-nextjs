/** Digits-only phone for `tel:` links. */
export function telHref(phone?: string | null): string | null {
  const digits = phone?.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

/**
 * WhatsApp link for Egyptian numbers. Handles local (01xxxxxxxxx),
 * international (201xxxxxxxxx / +201… / 00201…) formats.
 */
export function whatsappHref(phone?: string | null): string | null {
  let digits = phone?.replace(/\D/g, '') || ''
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = `2${digits}`
  return `https://wa.me/${digits}`
}

/** YYYY-MM-DD in the user's local timezone (toISOString would use UTC). */
export function toLocalDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ar-EG')
}

export function formatDateTime(value?: string | Date | null, withYear = false): string {
  if (!value) return ''
  return new Date(value).toLocaleString('ar-EG', {
    ...(withYear ? { year: 'numeric' } : {}),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const pct = (called: number, total: number) => (total > 0 ? Math.round((called / total) * 100) : 0)

/**
 * Apply an updated (or removed) assignment to a report payload locally and
 * recompute every counter, so the UI updates instantly without a refetch and
 * without re-sorting rows under the user's finger.
 */
export function patchReport(report: any, assignmentId: string, updated: any | null): any {
  if (!report) return report

  const servants = report.servants
    .map((group: any) => {
      const assignments = updated
        ? group.assignments.map((a: any) => (a._id === assignmentId ? { ...a, ...updated } : a))
        : group.assignments.filter((a: any) => a._id !== assignmentId)
      const calledCount = assignments.filter((a: any) => a.isCalled).length
      return {
        ...group,
        assignments,
        assignedCount: assignments.length,
        calledCount,
        notCalledCount: assignments.length - calledCount,
        completionPercentage: pct(calledCount, assignments.length),
      }
    })
    .filter((g: any) => g.assignedCount > 0)

  const all = servants.flatMap((g: any) => g.assignments)
  const totalCalled = all.filter((a: any) => a.isCalled).length

  return {
    ...report,
    servants,
    summary: {
      totalAssigned: all.length,
      totalCalled,
      totalNotCalled: all.length - totalCalled,
      completionPercentage: pct(totalCalled, all.length),
    },
    notCalledList: all
      .filter((a: any) => !a.isCalled)
      .map((a: any) => ({ _id: a._id, servantee: a.servanteeId, servant: a.servantId, notes: a.notes })),
  }
}
