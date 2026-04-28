import React, { useState, useEffect, useRef } from 'react'
import { loadFaceModels, detectFaceInVideo, evaluateFaceQuality } from '../lib/faceDetection'

// Tuned for Tab A7 — slower devices need more time between detections
const STABLE_LOCK_MS = 1000     // was 600 — needs more measurements at slower detection rate
const DETECT_INTERVAL_MS = 500  // was 200 — 2 detections per second instead of 5

const QUALITY_MESSAGES = {
  no_face: 'Step into frame',
  low_confidence: 'Face the camera',
  too_far: 'Move closer',
  too_close: 'Step back a little',
  off_center: 'Center your face',
  good: 'Hold still…',
}

export default function CameraScreen({ onCancel, onCaptured }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const stableSinceRef = useRef(null)
  const lastDetectionRef = useRef(null)

  const [permissionState, setPermissionState] = useState('requesting')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(null)
  const [debugInfo, setDebugInfo] = useState('')

  const [modelStatus, setModelStatus] = useState('not_loaded')
  const [modelMessage, setModelMessage] = useState('')

  const [qualityState, setQualityState] = useState({ ok: false, reason: 'no_face' })
  const [stableProgress, setStableProgress] = useState(0)
  const [captured, setCaptured] = useState(false)

  // Load face-api.js models on mount
  useEffect(() => {
    setModelStatus('loading')
    loadFaceModels((msg) => setModelMessage(msg))
      .then(() => setModelStatus('ready'))
      .catch((e) => {
        console.error('Failed to load models:', e)
        setModelStatus('error')
        setModelMessage('Failed to load face recognition: ' + e.message)
      })
  }, [])

  // Start camera
  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }

        setDebugInfo('Requesting camera...')
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })

        if (cancelled) {
          mediaStream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = mediaStream
        const video = videoRef.current
        if (!video) return
        video.srcObject = mediaStream

        const playWhenReady = async () => {
          try {
            await video.play()
            setDebugInfo(`${video.videoWidth}×${video.videoHeight}`)
            setPermissionState('granted')
          } catch (playErr) {
            console.error('video.play() failed:', playErr)
            setError('Browser blocked playback. Try clicking the page first.')
            setPermissionState('error')
          }
        }

        if (video.readyState >= 2) {
          playWhenReady()
        } else {
          video.addEventListener('loadedmetadata', playWhenReady, { once: true })
          setTimeout(() => { if (video.paused) playWhenReady() }, 500)
        }

      } catch (e) {
        if (cancelled) return
        console.error('Camera error:', e)
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setPermissionState('denied')
          setError('Camera permission denied. Please allow camera access in your browser settings.')
        } else if (e.name === 'NotFoundError') {
          setPermissionState('error')
          setError('No camera found on this device.')
        } else if (e.name === 'NotReadableError') {
          setPermissionState('error')
          setError('Camera is busy. Close other apps using the camera and try again.')
        } else {
          setPermissionState('error')
          setError('Could not access camera: ' + e.message)
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Run face detection loop once camera + models are both ready
  useEffect(() => {
    if (permissionState !== 'granted' || modelStatus !== 'ready' || captured) return

    let active = true

    async function detectLoop() {
      while (active) {
        const startTime = Date.now()
        const video = videoRef.current
        if (!video || video.paused || video.ended) {
          await new Promise(r => setTimeout(r, DETECT_INTERVAL_MS))
          continue
        }

        try {
          const detection = await detectFaceInVideo(video)
          if (!active) break

          lastDetectionRef.current = detection
          const quality = evaluateFaceQuality(detection, video)
          setQualityState(quality)

          if (quality.ok) {
            if (stableSinceRef.current === null) {
              stableSinceRef.current = Date.now()
            }
            const stableFor = Date.now() - stableSinceRef.current
            const progress = Math.min(stableFor / STABLE_LOCK_MS, 1)
            setStableProgress(progress)

            if (progress >= 1 && !captured) {
              setCaptured(true)
              if (onCaptured) {
                onCaptured({
                  descriptor: Array.from(detection.descriptor),
                  detectionScore: detection.detection.score,
                  videoSnapshot: captureSnapshot(video),
                })
              }
              break
            }
          } else {
            stableSinceRef.current = null
            setStableProgress(0)
          }
        } catch (err) {
          console.error('Detection error:', err)
        }

        // Throttle — wait until DETECT_INTERVAL_MS has elapsed since this iteration started
        const elapsed = Date.now() - startTime
        const wait = Math.max(DETECT_INTERVAL_MS - elapsed, 50)
        await new Promise(r => setTimeout(r, wait))
      }
    }

    detectLoop()

    return () => {
      active = false
    }
  }, [permissionState, modelStatus, captured, onCaptured])

  // Auto-cancel after 30 seconds (only when granted, not captured)
  useEffect(() => {
    if (permissionState !== 'granted' || captured) return
    setCountdown(30)
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c === null) return null
        if (c <= 1) {
          clearInterval(timer)
          onCancel()
          return null
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [permissionState, captured, onCancel])

  function captureSnapshot(video) {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)
      return canvas.toDataURL('image/jpeg', 0.7)
    } catch (e) {
      return null
    }
  }

  const isModelLoading = modelStatus === 'loading' || modelStatus === 'not_loaded'
  const showQualityHint = permissionState === 'granted' && modelStatus === 'ready' && !captured

  return (
    <div className="fade-in" style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '5vh 24px',
      position: 'relative',
    }}>
      {/* Cancel button */}
      <button onClick={onCancel} style={{
        position: 'absolute',
        top: 16,
        right: 16,
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 999,
        padding: '8px 16px',
        color: 'var(--text-muted)',
        fontSize: 13,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        zIndex: 10,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        Cancel
      </button>

      {/* Debug info */}
      {(debugInfo || modelMessage) && !captured && (
        <div style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(0,0,0,0.6)',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 10,
          color: 'rgba(255,255,255,0.55)',
          fontFamily: 'monospace',
          zIndex: 10,
          maxWidth: 240,
          lineHeight: 1.5,
        }}>
          {debugInfo && <div>cam: {debugInfo}</div>}
          {modelMessage && <div>ai: {modelMessage}</div>}
        </div>
      )}

      {/* Camera frame container */}
      <div style={{
        width: 'min(60vh, 80vw)',
        height: 'min(60vh, 80vw)',
        maxWidth: 480,
        maxHeight: 480,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        background: '#000',
        boxShadow: permissionState === 'granted'
          ? `0 0 60px ${qualityState.ok ? 'rgba(74,222,128,0.4)' : 'rgba(201,162,39,0.2)'},
             0 0 0 4px ${qualityState.ok ? 'rgba(74,222,128,0.5)' : 'rgba(201,162,39,0.3)'}`
          : 'none',
        display: permissionState === 'granted' ? 'block' : 'none',
        transition: 'box-shadow 0.3s',
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
          }}
        />

        {/* Stability progress ring */}
        {showQualityHint && qualityState.ok && stableProgress > 0 && (
          <svg
            viewBox="0 0 100 100"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              transform: 'rotate(-90deg)',
              pointerEvents: 'none',
            }}
          >
            <circle
              cx="50" cy="50" r="48"
              fill="none"
              stroke="#4ade80"
              strokeWidth="2"
              strokeDasharray={`${stableProgress * 301.6} 301.6`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.2s linear' }}
            />
          </svg>
        )}

        {/* Captured success overlay */}
        {captured && (
          <div className="fade-in" style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(74,222,128,0.25)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              width: 88, height: 88,
              borderRadius: '50%',
              background: '#4ade80',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0d2818" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>
        )}

        {/* Soft pulse when waiting for face */}
        {showQualityHint && !qualityState.ok && (
          <div style={{
            position: 'absolute',
            inset: -20,
            borderRadius: '50%',
            border: '2px solid rgba(201,162,39,0.4)',
            animation: 'pulseRing 2s ease-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Permission requesting */}
      {permissionState === 'requesting' && (
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{
            width: 64, height: 64,
            margin: '0 auto 20px',
            borderRadius: '50%',
            border: '3px solid rgba(201,162,39,0.2)',
            borderTopColor: 'var(--gold)',
            animation: 'spin 1s linear infinite',
          }} />
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24, fontWeight: 600,
            marginBottom: 10,
            color: 'var(--text-light)',
          }}>
            Starting camera…
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Please allow camera access if prompted
          </p>
        </div>
      )}

      {/* Permission denied / error */}
      {(permissionState === 'denied' || permissionState === 'error') && (
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{
            width: 72, height: 72,
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'var(--crimson-light)',
            border: '1px solid rgba(239,68,68,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 600,
            marginBottom: 12,
            color: 'var(--text-light)',
          }}>
            Camera unavailable
          </h2>
          <p style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            marginBottom: 24,
            lineHeight: 1.6,
          }}>
            {error}
          </p>
          <button onClick={onCancel} style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12,
            padding: '12px 28px',
            color: 'var(--text-light)',
            fontSize: 15, fontWeight: 500,
            cursor: 'pointer',
          }}>
            Back to home
          </button>
        </div>
      )}

      {/* Camera ready */}
      {permissionState === 'granted' && (
        <>
          <div style={{
            position: 'absolute',
            top: 32,
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: 5,
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'min(3vh, 24px)',
              fontWeight: 600,
              color: 'var(--text-light)',
              marginBottom: 4,
            }}>
              {captured ? 'Got it!' : isModelLoading ? 'Loading face recognition…' : 'Look at the camera'}
            </h2>
            {!captured && !isModelLoading && (
              <p style={{
                fontSize: 'min(1.8vh, 14px)',
                color: qualityState.ok ? '#4ade80' : 'var(--text-muted)',
                fontWeight: qualityState.ok ? 500 : 400,
                transition: 'color 0.3s',
              }}>
                {QUALITY_MESSAGES[qualityState.reason] || 'Searching for face…'}
              </p>
            )}
          </div>

          {!captured && (
            <div style={{
              marginTop: 32,
              padding: '14px 20px',
              background: 'rgba(201, 162, 39, 0.12)',
              border: '1px solid rgba(201, 162, 39, 0.3)',
              borderRadius: 12,
              maxWidth: 480,
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--gold-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 6,
              }}>
                Phase 2 · Face detection
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Detecting your face. Recognition (matching to a teacher) comes in Phase 4.
              </p>
            </div>
          )}

          {captured && (
            <div className="slide-up" style={{
              marginTop: 28,
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: 'min(2.2vh, 17px)',
                color: '#4ade80',
                fontWeight: 600,
                marginBottom: 14,
              }}>
                Face captured successfully
              </p>
              <p style={{
                fontSize: 'min(1.6vh, 13px)',
                color: 'var(--text-muted)',
                marginBottom: 20,
              }}>
                In the next phase, we'll match this against the teacher database.
              </p>
              <button onClick={onCancel} style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 12,
                padding: '12px 28px',
                color: 'var(--text-light)',
                fontSize: 15, fontWeight: 500,
                cursor: 'pointer',
              }}>
                Done
              </button>
            </div>
          )}

          {countdown !== null && countdown <= 10 && !captured && (
            <div style={{
              position: 'absolute',
              bottom: 24,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--text-faint)',
            }}>
              Auto-cancelling in {countdown}s
            </div>
          )}
        </>
      )}
    </div>
  )
}
