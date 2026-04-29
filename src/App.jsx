import React, { useState, useEffect } from 'react'
import IdleScreen from './pages/IdleScreen'
import CameraScreen from './pages/CameraScreen'
import RecognitionResult from './pages/RecognitionResult'
import { matchFace, loadEmbeddings } from './lib/recognition'
import { checkAvailability, recordAttendance } from './lib/attendance'

// view: 'idle' | 'capturing' | 'processing' | 'result'
export default function App() {
  const [view, setView] = useState('idle')
  const [resultData, setResultData] = useState(null)
  const [now, setNow] = useState(new Date())

  // Live clock - tick every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Pre-warm embeddings cache when app loads (so first recognition is fast)
  useEffect(() => {
    loadEmbeddings().catch(err => {
      console.warn('Failed to pre-warm embeddings cache:', err)
    })
  }, [])

  async function handleTap() {
    // Check availability (holiday / Sunday closed)
    try {
      const check = await checkAvailability()
      if (!check.allowed) {
        setResultData({
          type: 'blocked',
          message: check.message,
          reason: check.reason,
        })
        setView('result')
        return
      }
    } catch (e) {
      console.warn('Availability check failed:', e)
      // Don't block on check failure — proceed to camera
    }
    setView('capturing')
  }

  async function handleCaptured(captureData) {
    setView('processing')
    try {
      const match = await matchFace(captureData.descriptor)
      if (!match.matched) {
        setResultData({ type: 'not_matched', match })
        setView('result')
        return
      }
      const attendance = await recordAttendance(match.employee, match)
      setResultData({
        type: attendance.event_type === 'in' ? 'matched_in' : 'matched_out',
        employee: match.employee,
        attendance,
      })
      setView('result')
    } catch (e) {
      console.error('Recognition/attendance failed:', e)
      setResultData({ type: 'error', message: e.message })
      setView('result')
    }
  }

  function handleDismiss() {
    setResultData(null)
    setView('idle')
  }

  function handleCancel() {
    setView('idle')
  }

  if (view === 'result') {
    return <RecognitionResult result={resultData} onDismiss={handleDismiss} />
  }

  if (view === 'processing') {
    return <ProcessingScreen />
  }

  if (view === 'capturing') {
    return <CameraScreen onCancel={handleCancel} onCaptured={handleCaptured} />
  }

  return <IdleScreen onStart={handleTap} now={now} />
}

function ProcessingScreen() {
  return (
    <div className="fade-in" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 28,
    }}>
      <div style={{
        width: 84, height: 84,
        borderRadius: '50%',
        border: '3px solid rgba(201,162,39,0.2)',
        borderTopColor: 'var(--gold)',
        animation: 'spin 0.9s linear infinite',
      }} />
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 600,
          color: 'var(--text-light)',
          marginBottom: 6,
        }}>
          Recognizing…
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Just a moment
        </p>
      </div>
    </div>
  )
}
