import * as faceapi from '@vladmandic/face-api'

// Track loading state across the app
let modelsLoaded = false
let loadingPromise = null

/**
 * Load all required face-api.js models.
 * Returns a promise that resolves when models are ready.
 * Safe to call multiple times — only loads once.
 */
export async function loadFaceModels(onProgress) {
  if (modelsLoaded) return
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const MODEL_URL = '/models'
    onProgress?.('Loading face detector…')

    // Tiny detector — small, fast, accurate enough for our use
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
    onProgress?.('Loading landmarks…')

    // Landmarks — used to verify face quality (eyes visible etc)
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
    onProgress?.('Loading recognition net…')

    // Recognition — produces the 128-dim embedding for matching
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    onProgress?.('Models ready')

    modelsLoaded = true
  })()

  return loadingPromise
}

export function areModelsLoaded() {
  return modelsLoaded
}

/**
 * Detect a face in the given video element.
 * Returns null if no face, or the detection object with descriptor.
 */
export async function detectFaceInVideo(videoEl) {
  if (!modelsLoaded || !videoEl || videoEl.paused || videoEl.ended) return null

  // Use TinyFaceDetector — fast and good for live video
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,        // 320 is a good balance for tablets
    scoreThreshold: 0.5,   // detection confidence
  })

  const result = await faceapi
    .detectSingleFace(videoEl, options)
    .withFaceLandmarks()
    .withFaceDescriptor()

  return result || null
}

/**
 * Quality check: is this face good enough to use?
 * Returns { ok: boolean, reason: string }
 */
export function evaluateFaceQuality(detection, videoEl) {
  if (!detection) return { ok: false, reason: 'no_face' }

  const { box, score } = detection.detection
  const videoW = videoEl.videoWidth
  const videoH = videoEl.videoHeight

  // 1. Detection confidence
  if (score < 0.6) return { ok: false, reason: 'low_confidence' }

  // 2. Face must be reasonably large (not too far away)
  const faceArea = box.width * box.height
  const frameArea = videoW * videoH
  const faceRatio = faceArea / frameArea
  if (faceRatio < 0.05) return { ok: false, reason: 'too_far' }
  if (faceRatio > 0.6) return { ok: false, reason: 'too_close' }

  // 3. Face must be roughly centered (within middle 70% of frame)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const offX = Math.abs(cx - videoW / 2) / videoW
  const offY = Math.abs(cy - videoH / 2) / videoH
  if (offX > 0.25 || offY > 0.25) return { ok: false, reason: 'off_center' }

  return { ok: true, reason: 'good' }
}

/**
 * Convert a Float32Array embedding to a regular array for storage.
 */
export function embeddingToArray(descriptor) {
  return Array.from(descriptor)
}

/**
 * Calculate cosine similarity between two embeddings.
 * Returns 0..1 where 1 is identical, 0 is orthogonal.
 */
export function cosineSimilarity(a, b) {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Calculate Euclidean distance between two embeddings.
 * face-api.js uses this typically; lower = more similar.
 * Standard threshold: < 0.6 = same person.
 */
export function euclideanDistance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}
