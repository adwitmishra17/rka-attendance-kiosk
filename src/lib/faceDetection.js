import * as faceapi from '@vladmandic/face-api'

let modelsLoaded = false
let loadingPromise = null

export async function loadFaceModels(onProgress) {
  if (modelsLoaded) return
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const MODEL_URL = '/models'
    onProgress?.('Loading face detector…')
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
    // Note: we still load landmarks because we may use it once we're locking in
    // the capture, even though we skip it during the live loop for speed.
    onProgress?.('Loading landmarks…')
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
    onProgress?.('Loading recognition net…')
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
 * FAST detection — just bounding box, no landmarks, no embedding.
 * Used in the live loop. Roughly 3-4x faster than the full pipeline.
 */
export async function detectFaceFast(videoEl) {
  if (!modelsLoaded || !videoEl || videoEl.paused || videoEl.ended) return null

  // 160 input — minimum useful size for face-api.js TinyFaceDetector.
  // 160×160 = 25,600 pixels vs 224×224 = 50,176 (50% less compute)
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 160,
    scoreThreshold: 0.5,
  })

  // detectSingleFace alone — no .withFaceLandmarks(), no .withFaceDescriptor()
  const result = await faceapi.detectSingleFace(videoEl, options)
  return result || null
}

/**
 * SLOW but complete detection — runs landmarks + embedding.
 * Only called once at capture time, not per-frame.
 */
export async function detectFaceFull(videoEl) {
  if (!modelsLoaded || !videoEl || videoEl.paused || videoEl.ended) return null

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,  // higher resolution for the final capture for better embedding quality
    scoreThreshold: 0.5,
  })

  const result = await faceapi
    .detectSingleFace(videoEl, options)
    .withFaceLandmarks()
    .withFaceDescriptor()

  return result || null
}

/**
 * Quality check using just the bounding box (no landmarks needed).
 * Returns { ok: boolean, reason: string }
 */
export function evaluateFaceQuality(detection, videoEl) {
  if (!detection) return { ok: false, reason: 'no_face' }

  // Detection from fast path has .box and .score directly
  // Detection from full path nests it under .detection
  const box = detection.box || detection.detection?.box
  const score = detection.score ?? detection.detection?.score

  if (!box) return { ok: false, reason: 'no_face' }

  const videoW = videoEl.videoWidth
  const videoH = videoEl.videoHeight

  if (score < 0.6) return { ok: false, reason: 'low_confidence' }

  const faceArea = box.width * box.height
  const frameArea = videoW * videoH
  const faceRatio = faceArea / frameArea
  if (faceRatio < 0.05) return { ok: false, reason: 'too_far' }
  if (faceRatio > 0.6) return { ok: false, reason: 'too_close' }

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const offX = Math.abs(cx - videoW / 2) / videoW
  const offY = Math.abs(cy - videoH / 2) / videoH
  if (offX > 0.25 || offY > 0.25) return { ok: false, reason: 'off_center' }

  return { ok: true, reason: 'good' }
}

export function embeddingToArray(descriptor) {
  return Array.from(descriptor)
}

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

export function euclideanDistance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}
