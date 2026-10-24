/**
 * Arabic Search & Name Normalization Utilities
 * Handles flexible matching, diacritics removal, letter unification, and typo tolerance.
 */

export function normalizeArabic(text: string): string {
  if (!text) return ''
  return text
    .trim()
    .toLowerCase()
    // Remove Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Remove tatweel (kashida)
    .replace(/\u0640/g, '')
    // Normalize Alif variants (أ, إ, آ, ٱ) -> ا
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Yaa / Alif Maksura (ى) -> ي
    .replace(/[ى]/g, 'ي')
    // Normalize Taa Marbuta (ة) -> ه
    .replace(/[ة]/g, 'ه')
    // Normalize common compound name prefixes (عبد الله -> عبدالله, أبو ... -> ابو...)
    .replace(/\bعبد\s+/g, 'عبد')
    .replace(/\bابو\s+/g, 'ابو')
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const row: number[] = []
  for (let j = 0; j <= b.length; j++) {
    row[j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      let val: number
      if (a.charAt(i - 1) === b.charAt(j - 1)) {
        val = row[j - 1]
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1)
      }
      row[j - 1] = prev
      prev = val
    }
    row[b.length] = prev
  }

  return row[b.length]
}

/**
 * Checks if two words are similar:
 * - Exact match
 * - Prefix match (starts with)
 * - Substring containment
 * - 1-edit distance for words of length >= 4 (to tolerate common single-letter omissions e.g. كرلس/كيرلس, بشوي/بيشوي)
 */
export function isWordSimilar(queryWord: string, candidateWord: string): boolean {
  if (!queryWord || !candidateWord) return false
  if (queryWord === candidateWord) return true
  if (candidateWord.startsWith(queryWord) || queryWord.startsWith(candidateWord)) return true
  if (candidateWord.includes(queryWord)) return true

  // For words with at least 4 letters, allow 1 edit distance
  if (queryWord.length >= 4 && candidateWord.length >= 4) {
    if (Math.abs(queryWord.length - candidateWord.length) <= 1) {
      if (levenshteinDistance(queryWord, candidateWord) <= 1) return true
    }
  }

  return false
}

/**
 * Checks whether a single target text matches a query using Arabic normalization and token matching.
 */
export function matchesArabic(query: string, target?: string | null): boolean {
  if (!target || !query) return false

  const normQuery = normalizeArabic(query)
  const normTarget = normalizeArabic(target)

  if (!normQuery || !normTarget) return false

  // 1. Direct normalized substring match
  if (normTarget.includes(normQuery)) {
    return true
  }

  // 2. Token / word matching
  const queryWords = normQuery.split(' ').filter(Boolean)
  const targetWords = normTarget.split(' ').filter(Boolean)

  if (queryWords.length === 0 || targetWords.length === 0) return false

  // If query is multiple words, check if all query words match target words
  if (queryWords.length > 1) {
    const allMatched = queryWords.every((qWord) =>
      targetWords.some((tWord) => isWordSimilar(qWord, tWord))
    )
    if (allMatched) return true
  }

  // If query is a single word with at least 3 characters, check word similarity
  if (queryWords.length === 1 && queryWords[0].length >= 3) {
    return targetWords.some((tWord) => isWordSimilar(queryWords[0], tWord))
  }

  return false
}

export interface MatchResult<T> {
  item: T
  score: number
}

/**
 * Checks similarity between a search query name and a candidate servantee name.
 */
export function calculateNameSimilarity(queryName: string, candidateName: string): number {
  const normQuery = normalizeArabic(queryName)
  const normCandidate = normalizeArabic(candidateName)

  if (!normQuery || normQuery.length < 2 || !normCandidate) {
    return 0
  }

  // Exact normalized match
  if (normQuery === normCandidate) {
    return 100
  }

  // Full substring match
  if (normCandidate.includes(normQuery)) {
    return 90
  }

  const queryWords = normQuery.split(' ').filter(Boolean)
  const candWords = normCandidate.split(' ').filter(Boolean)

  if (queryWords.length === 0 || candWords.length === 0) return 0

  let matchedWordsCount = 0

  for (const qWord of queryWords) {
    const matched = candWords.some((cWord) => isWordSimilar(qWord, cWord))
    if (matched) {
      matchedWordsCount++
    }
  }

  // All query words matched
  if (matchedWordsCount === queryWords.length) {
    return 70 + matchedWordsCount * 5
  }

  // Multi-word query where at least 2 words matched
  if (queryWords.length >= 2 && matchedWordsCount >= 2) {
    return 50 + matchedWordsCount * 10
  }

  // Single word query of length >= 3 that matched
  if (queryWords.length === 1 && queryWords[0].length >= 3 && matchedWordsCount === 1) {
    return 60
  }

  return 0
}

/**
 * Filters a list of items having a name property, returning those with similar names sorted by score.
 */
export function findSimilarNames<T extends { name?: string; _id?: string }>(
  queryName: string,
  candidates: T[],
  maxResults = 5
): MatchResult<T>[] {
  const q = queryName.trim()
  if (q.length < 2) return []

  const results: MatchResult<T>[] = []

  for (const candidate of candidates) {
    if (!candidate.name) continue
    const score = calculateNameSimilarity(q, candidate.name)
    if (score > 0) {
      results.push({ item: candidate, score })
    }
  }

  // Sort highest score first, break ties alphabetically
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (a.item.name || '').localeCompare(b.item.name || '')
  })

  return results.slice(0, maxResults)
}

/**
 * Searches and filters a list of servantees by name, phone, church, or diocese using Arabic normalization.
 * Returns results ranked with best matches first.
 */
export function filterServantees<
  T extends { name?: string; phone?: string; church?: string; diocese?: string }
>(query: string, items: T[]): T[] {
  const q = query.trim()
  if (!q) return items

  const isNumeric = /^\d+$/.test(q.replace(/\s+/g, ''))
  const cleanNum = q.replace(/\D/g, '')

  // If query is purely numeric (phone search)
  if (isNumeric && cleanNum.length > 0) {
    return items.filter((item) => {
      if (!item.phone) return false
      const phoneDigits = item.phone.replace(/\D/g, '')
      return phoneDigits.includes(cleanNum)
    })
  }

  // Otherwise, score and match each item
  type ScoredItem = { item: T; score: number }
  const scored: ScoredItem[] = []

  for (const item of items) {
    let bestScore = 0

    // Check name with similarity scoring
    if (item.name) {
      const nameScore = calculateNameSimilarity(q, item.name)
      if (nameScore > bestScore) {
        bestScore = nameScore
      } else if (matchesArabic(q, item.name) && bestScore < 60) {
        bestScore = 60
      }
    }

    // Check church
    if (item.church && matchesArabic(q, item.church)) {
      if (bestScore < 40) bestScore = 40
    }

    // Check diocese
    if (item.diocese && matchesArabic(q, item.diocese)) {
      if (bestScore < 30) bestScore = 30
    }

    // Check phone (in case query contains numbers)
    if (item.phone && cleanNum.length >= 3 && item.phone.includes(cleanNum)) {
      if (bestScore < 50) bestScore = 50
    }

    if (bestScore > 0) {
      scored.push({ item, score: bestScore })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.item)
}

/**
 * Searches and filters a list of retreats by name or location using Arabic normalization.
 * Sorts retreats with newest first (by startDate descending).
 */
export function filterRetreats<
  T extends { name?: string; location?: string; startDate?: string | Date }
>(query: string, items: T[]): T[] {
  const sortByDateDesc = (a: T, b: T) => {
    const timeA = a.startDate ? new Date(a.startDate).getTime() : 0
    const timeB = b.startDate ? new Date(b.startDate).getTime() : 0
    return timeB - timeA
  }

  const q = query.trim()
  if (!q) {
    return [...items].sort(sortByDateDesc)
  }

  type ScoredItem = { item: T; score: number }
  const scored: ScoredItem[] = []

  for (const item of items) {
    let score = 0
    if (item.name) {
      if (matchesArabic(q, item.name)) {
        score = 80
      } else {
        const sim = calculateNameSimilarity(q, item.name)
        if (sim > 0) score = sim
      }
    }
    if (item.location && matchesArabic(q, item.location)) {
      score = Math.max(score, 50)
    }

    if (score > 0) {
      scored.push({ item, score })
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return sortByDateDesc(a.item, b.item)
  })
  return scored.map((s) => s.item)
}

