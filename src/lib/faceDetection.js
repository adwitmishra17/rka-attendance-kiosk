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

export async function detectFaceInVideo(videoEl) {
  if (!modelsLoaded || !videoEl || videoEl.paused || videoEl.ended) return null

  // Reduced from 320 to 224 for faster detection on slower hardware (Tab A7)
  // 224×224 = ~50,000 pixels analyzed (vs 102,400 at 320)
  // Roughly 50% less compute per detection
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5,
  })

  const result = await faceapi
    .detectSingleFace(videoEl, options)
    .withFaceLandmarks()
    .withFaceDescriptor()

  return result || null
}

export function evaluateFaceQuality(detection, videoEl) {
  if (!detection) return { ok: false, reason: 'no_face' }

  const { box, score } = detection.detection
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
