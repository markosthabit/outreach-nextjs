/**
 * Some records hold two numbers ("01200062480 / 01029033026").
 * Links must use one of them — stripping non-digits would glue both together.
 */
export function primaryPhone(phone?: string | null): string {
  return (phone || '').split(/[\/,،]| - /)[0].trim()
}

/** `tel:` link for the primary number. */
export function telHref(phone?: string | null): string | null {
  const digits = primaryPhone(phone).replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

/**
 * WhatsApp link for Egyptian numbers. Handles local (01xxxxxxxxx) and
 * international (201… / +201… / 00201…) formats.
 */
export function whatsappHref(phone?: string | null): string | null {
  let digits = primaryPhone(phone).replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = `2${digits}`
  return `https://wa.me/${digits}`
}
