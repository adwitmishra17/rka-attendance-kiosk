import { supabaseAdmin } from './supabase'

// Distance below this = match. Industry standard for face-api.js Euclidean.
const MATCH_THRESHOLD = 0.6

let cachedEmbeddings = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

/**
 * Load all enrolled faces from Supabase, grouped by employee.
 * Cached for 5 minutes since enrollments don't change often.
 */
export async function loadEmbeddings(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && cachedEmbeddings && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedEmbeddings
  }

  const { data: embs, error: e1 } = await supabaseAdmin
    .from('face_embeddings')
    .select('employee_id, embedding')
    .eq('is_active', true)
  if (e1) throw new Error('Failed to load embeddings: ' + e1.message)

  const { data: emps, error: e2 } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, employee_code, biometric_code, email')
    .eq('is_active', true)
  if (e2) throw new Error('Failed to load employees: ' + e2.message)

  const empMap = new Map()
  for (const e of emps) empMap.set(e.id, e)

  const grouped = new Map()
  for (const emb of embs) {
    const emp = empMap.get(emb.employee_id)
    if (!emp) continue
    if (!grouped.has(emb.employee_id)) {
      grouped.set(emb.employee_id, { employee: emp, embeddings: [] })
    }
    grouped.get(emb.employee_id).embeddings.push(emb.embedding)
  }

  cachedEmbeddings = Array.from(grouped.values())
  cacheTimestamp = now
  console.log(`[recognition] Loaded ${cachedEmbeddings.length} enrolled employees, ${embs.length} embeddings total`)
  return cachedEmbeddings
}

export function clearEmbeddingCache() {
  cachedEmbeddings = null
  cacheTimestamp = 0
}

function euclideanDistance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

/**
 * Match a captured face embedding against enrolled faces.
 * Returns { matched, employee?, distance?, confidence?, reason? }
 */
export async function matchFace(capturedEmbedding) {
  const enrolled = await loadEmbeddings()
  if (enrolled.length === 0) {
    return { matched: false, reason: 'no_enrolled_faces' }
  }

  let bestMatch = null
  let bestDistance = Infinity

  for (const { employee, embeddings } of enrolled) {
    // Use the closest of the 5 angle-embeddings for this employee
    let employeeBest = Infinity
    for (const emb of embeddings) {
      const d = euclideanDistance(capturedEmbedding, emb)
      if (d < employeeBest) employeeBest = d
    }
    if (employeeBest < bestDistance) {
      bestDistance = employeeBest
      bestMatch = employee
    }
  }

  const confidence = Math.max(0, Math.min(1, 1 - bestDistance))

  console.log(`[recognition] Best match: ${bestMatch?.full_name} (distance: ${bestDistance.toFixed(3)}, threshold: ${MATCH_THRESHOLD})`)

  if (bestDistance < MATCH_THRESHOLD) {
    return {
      matched: true,
      employee: bestMatch,
      distance: bestDistance,
      confidence,
    }
  }

  return {
    matched: false,
    reason: 'no_match',
    closestEmployee: bestMatch,
    closestDistance: bestDistance,
    confidence,
  }
}
