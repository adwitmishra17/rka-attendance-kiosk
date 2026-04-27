import React, { useState, useEffect, useRef } from 'react'

export default function CameraScreen({ onCancel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [permissionState, setPermissionState] = useState('requesting')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(null)
  const [debugInfo, setDebugInfo] = useState('')

  // Start camera
  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        // Stop any previous stream first (handles React strict mode double-mount)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }

        setDebugInfo('Requesting camera...')

        // Request with relaxed constraints — let browser pick what works
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            // No specific resolution — browser picks the best available
          },
          audio: false,
        })

        if (cancelled) {
          mediaStream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = mediaStream
        setDebugInfo(`Stream got: ${mediaStream.getVideoTracks().length} video tracks`)

        const video = videoRef.current
        if (!video) {
          setDebugInfo('Video element not found')
          return
        }

        // Attach stream
        video.srcObject = mediaStream
        setDebugInfo('Stream attached, waiting for metadata...')

        // Wait for video to be ready, then explicitly play
        const playWhenReady = async () => {
          try {
            setDebugInfo(`Playing... ${video.videoWidth}x${video.videoHeight}`)
            await video.play()
            setDebugInfo(`Playing OK ${video.videoWidth}x${video.videoHeight}`)
            setPermissionState('granted')
          } catch (playErr) {
            console.error('video.play() failed:', playErr)
            setDebugInfo('Play failed: ' + playErr.message)
            setError('Browser blocked video playback. Try clicking the page first.')
            setPermissionState('error')
          }
        }

        // Two paths: video may already have metadata, or we wait for the event
        if (video.readyState >= 2) {
          playWhenReady()
        } else {
          video.addEventListener('loadedmetadata', playWhenReady, { once: true })
          // Safety net — try playing after 500ms even if event didn't fire
          setTimeout(() => {
            if (video.paused) playWhenReady()
          }, 500)
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

  // Auto-cancel after 30 seconds (only when granted)
  useEffect(() => {
    if (permissionState !== 'granted') return
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
  }, [permissionState, onCancel])

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
      {/* Cancel button — top right */}
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

      {/* Debug info — visible during dev */}
      {debugInfo && (
        <div style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(0,0,0,0.6)',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 10,
          color: 'rgba(255,255,255,0.6)',
          fontFamily: 'monospace',
          zIndex: 10,
        }}>
          {debugInfo}
        </div>
      )}

      {/* Always render the video element so the ref is stable.
          We just hide it visually until permission is granted. */}
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
          ? '0 0 60px rgba(201,162,39,0.2), 0 0 0 4px rgba(201,162,39,0.3)'
          : 'none',
        display: permissionState === 'granted' ? 'block' : 'none',
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
        {/* Pulse ring */}
        <div style={{
          position: 'absolute',
          inset: -20,
          borderRadius: '50%',
          border: '2px solid rgba(201,162,39,0.4)',
          animation: 'pulseRing 2s ease-out infinite',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Permission requesting state */}
      {permissionState === 'requesting' && (
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{
            width: 64,
            height: 64,
            margin: '0 auto 20px',
            borderRadius: '50%',
            border: '3px solid rgba(201,162,39,0.2)',
            borderTopColor: 'var(--gold)',
            animation: 'spin 1s linear infinite',
          }} />
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            fontWeight: 600,
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

      {/* Permission denied / error state */}
      {(permissionState === 'denied' || permissionState === 'error') && (
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{
            width: 72,
            height: 72,
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
            fontSize: 22,
            fontWeight: 600,
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
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
          }}>
            Back to home
          </button>
        </div>
      )}

      {/* Camera granted - title and status */}
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
              Look at the camera
            </h2>
            <p style={{ fontSize: 'min(1.6vh, 13px)', color: 'var(--text-muted)' }}>
              Stay still while we recognise you
            </p>
          </div>

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
              Phase 1 · Camera test
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Camera is live. Face recognition will be added in the next phase.
            </p>
          </div>

          {countdown !== null && countdown <= 10 && (
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
