import { normalizeArabic, levenshteinDistance, isWordSimilar } from './arabic-search'

export interface ClusteredFilterOption {
  id: string
  label: string
  rawValues: string[]
  count: number
}

export const ARABIC_ALPHABET = [
  'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش',
  'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'
] as const

/**
 * Normalizes church names to eliminate typical variations:
 * - Removes church/monastery titles ("كنيسة", "كاتدرائية", "مطرانية", "دير", "مزار")
 * - Removes saint honorifics ("القديس", "الشهيد", "العظيم", "الانبا", "ابونا", "سيدة", "السيدة")
 * - Unifies compound names ("مار جرجس" -> "مارجرجس", "العذراء مريم" -> "العذراء")
 * - Strips English titles ("St.", "Saint", "Church")
 * - Normalizes punctuation and spacing
 */
export function normalizeChurchName(text?: string | null): string {
  if (!text) return ''
  let cleaned = normalizeArabic(text)

  // Remove English titles
  cleaned = cleaned.replace(/\b(st\.|st|saint|church of|church)\b/gi, '')

  // Remove common ecclesiastical prefixes
  cleaned = cleaned.replace(/\b(كنيسه|كاتدرائيه|مطرانيه|ايبارشيه|ابارشيه|دير|مزار)\b/g, '')

  // Remove saint and veneration titles
  cleaned = cleaned.replace(/\b(القديس|القديسه|الشهيد|العظيم|الانبا|انبا|ابونا|السيده|سيده)\b/g, '')

  // Unify "مار " -> "مار"
  cleaned = cleaned.replace(/\bمار\s+/g, 'مار')

  // Unify "العذراء مريم" -> "العذراء"
  cleaned = cleaned.replace(/\bالعذراء\s+مريم\b/g, 'العذراء')

  // Remove punctuation
  cleaned = cleaned.replace(/[-_/,.:\\()]/g, ' ')

  // Strip location prefix "بـ" (e.g. بسبورتنج -> سبورتنج) if followed by at least 4 letters
  cleaned = cleaned.replace(/\bب([ء-ي]{4,})\b/g, '$1')

  // Clean extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned || normalizeArabic(text)
}

/**
 * Normalizes college/education names to group similar variants:
 * - Removes prefixes like "كلية", "جامعة", "معهد", "المعهد العالي", "اكاديمية"
 * - Unifies "حاسبات و معلومات" -> "حاسبات ومعلومات"
 * - Removes punctuation and collapses whitespace
 */
export function normalizeCollegeName(text?: string | null): string {
  if (!text) return ''
  let cleaned = normalizeArabic(text)

  // Remove common education prefixes
  cleaned = cleaned.replace(/\b(المعهد العالي|كليه|جامعه|اكاديميه|معهد)\b/g, '')

  // Unify common field names
  cleaned = cleaned.replace(/\bحاسبات\s+و\s*معلومات\b/g, 'حاسبات ومعلومات')

  // Remove punctuation
  cleaned = cleaned.replace(/[-_/,.:\\()]/g, ' ')

  // Strip leading "ال" from common major names to group (الهندسة -> هندسة)
  cleaned = cleaned.replace(/\bال(هندسه|طب|صيدله|تجاره|حقوق|اداب|تربيه|علوم|حاسبات|زراعه|تمريض|اعلام|فنون)\b/g, '$1')

  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned || normalizeArabic(text)
}

/**
 * Extracts the initial letter of a servantee's name in a normalized fashion.
 * Handles Alif variants (أ/إ/آ -> ا), compound names, and Latin alphabet.
 */
export function getInitialLetter(name?: string | null): string {
  if (!name) return ''
  const norm = normalizeArabic(name)
  if (!norm) return ''

  const firstChar = norm.charAt(0)

  // If it's an Arabic letter
  if (/[\u0600-\u06FF]/.test(firstChar)) {
    return firstChar
  }

  // If Latin alphabet
  if (/[a-zA-Z]/.test(firstChar)) {
    return firstChar.toUpperCase()
  }

  return '#'
}

/**
 * Builds clustered filter options from a list of items for unstandardized fields
 * like church or education.
 */
export function buildClusteredOptions<T>(
  items: T[],
  getValue: (item: T) => string | undefined | null,
  normalizer: (val?: string | null) => string
): ClusteredFilterOption[] {
  const clusterMap = new Map<
    string,
    {
      key: string
      rawCounts: Map<string, number>
      totalCount: number
    }
  >()

  for (const item of items) {
    const raw = getValue(item)?.trim()
    if (!raw) continue

    const key = normalizer(raw)
    if (!key) continue

    let cluster = clusterMap.get(key)
    if (!cluster) {
      cluster = {
        key,
        rawCounts: new Map<string, number>(),
        totalCount: 0,
      }
      clusterMap.set(key, cluster)
    }

    cluster.totalCount += 1
    cluster.rawCounts.set(raw, (cluster.rawCounts.get(raw) || 0) + 1)
  }

  const options: ClusteredFilterOption[] = []

  for (const [key, cluster] of clusterMap.entries()) {
    // Pick the most common raw value as the display label, cleaned of unnecessary punctuation
    let bestRaw = ''
    let maxCount = -1
    for (const [raw, count] of cluster.rawCounts.entries()) {
      if (count > maxCount || (count === maxCount && raw.length < bestRaw.length)) {
        bestRaw = raw
        maxCount = count
      }
    }

    // Clean label: remove double spaces or leading/trailing dashes
    const cleanLabel = bestRaw.replace(/^[-\s]+|[-\s]+$/g, '').trim() || key

    options.push({
      id: key,
      label: cleanLabel,
      rawValues: Array.from(cluster.rawCounts.keys()),
      count: cluster.totalCount,
    })
  }

  // Sort primarily by count descending, then alphabetically by label
  options.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.label.localeCompare(b.label, 'ar')
  })

  return options
}

/**
 * Computes letter counts across all servantees for the alphabet filter bar.
 */
export function computeLetterCounts<T extends { name?: string }>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const item of items) {
    const letter = getInitialLetter(item.name)
    if (letter) {
      counts[letter] = (counts[letter] || 0) + 1
    }
  }

  return counts
}

/**
 * Scores how closely a query matches a candidate text using Arabic normalization,
 * prefix matching, token similarity, and edit distance.
 */
export function scoreSuggestion(
  query: string,
  candidate: string,
  normalizer?: (text?: string | null) => string
): number {
  if (!query?.trim() || !candidate?.trim()) return 0

  const normQuery = normalizer ? normalizer(query) : normalizeArabic(query)
  const normCand = normalizer ? normalizer(candidate) : normalizeArabic(candidate)

  if (!normQuery || !normCand) return 0

  // 1. Exact match
  if (normQuery === normCand) return 100

  // 2. Starts with (strong prefix match)
  if (normCand.startsWith(normQuery)) return 92

  // 3. Substring match
  if (normCand.includes(normQuery)) return 85

  // 4. Reverse substring
  if (normQuery.includes(normCand)) return 78

  // 5. Token / word matching
  const qWords = normQuery.split(' ').filter(Boolean)
  const cWords = normCand.split(' ').filter(Boolean)
  if (qWords.length > 0 && cWords.length > 0) {
    let matchedCount = 0
    for (const qw of qWords) {
      if (cWords.some((cw) => isWordSimilar(qw, cw))) {
        matchedCount++
      }
    }
    if (matchedCount === qWords.length) {
      return 80
    }
    if (matchedCount > 0) {
      return 50 + (matchedCount / qWords.length) * 25
    }
  }

  // 6. Typo tolerance (Levenshtein distance <= 2 for words of length >= 4)
  if (normQuery.length >= 4 && normCand.length >= 4) {
    const dist = levenshteinDistance(normQuery, normCand)
    const maxLen = Math.max(normQuery.length, normCand.length)
    if (dist <= 2 && dist / maxLen <= 0.3) {
      return 65 - dist * 10
    }
  }

  return 0
}

export interface ScoredSuggestion {
  option: ClusteredFilterOption
  score: number
  isExact: boolean
  isCloseMatch: boolean
}

/**
 * Finds and ranks the closest suggestions from a list of clustered options.
 * If query is empty, returns the most frequent options (highest count).
 */
export function findClosestSuggestions(
  query: string,
  options: ClusteredFilterOption[],
  normalizer?: (val?: string | null) => string,
  maxResults = 5
): ScoredSuggestion[] {
  const trimmed = query.trim()

  if (!trimmed) {
    // Return top popular items
    return options.slice(0, maxResults).map((option) => ({
      option,
      score: 0,
      isExact: false,
      isCloseMatch: false,
    }))
  }

  const scored: ScoredSuggestion[] = []

  for (const option of options) {
    // Check label
    let bestScore = scoreSuggestion(trimmed, option.label, normalizer)

    // Check raw values
    for (const raw of option.rawValues) {
      const s = scoreSuggestion(trimmed, raw, normalizer)
      if (s > bestScore) bestScore = s
    }

    if (bestScore > 0) {
      scored.push({
        option,
        score: bestScore,
        isExact: bestScore >= 95,
        isCloseMatch: bestScore >= 78,
      })
    }
  }

  // Sort by score desc, then count desc, then label length asc
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.option.count !== a.option.count) return b.option.count - a.option.count
    return a.option.label.length - b.option.label.length
  })

  return scored.slice(0, maxResults)
}

