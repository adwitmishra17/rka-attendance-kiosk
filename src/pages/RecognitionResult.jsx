import React, { useEffect, useState } from 'react'

function formatTimeForDisplay(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${m} ${ampm}`
}

const VARIANTS = {
  matched_in: {
    bg: 'linear-gradient(135deg, #0d3b1f 0%, #1a5f31 100%)',
    icon: 'check',
    accent: '#4ade80',
  },
  matched_out: {
    bg: 'linear-gradient(135deg, #0d2f3b 0%, #1a4a5f 100%)',
    icon: 'wave',
    accent: '#60a5fa',
  },
  not_matched: {
    bg: 'linear-gradient(135deg, #3b1d1d 0%, #5f2a2a 100%)',
    icon: 'cross',
    accent: '#f87171',
  },
  blocked: {
    bg: 'linear-gradient(135deg, #3b321d 0%, #5f4f2a 100%)',
    icon: 'info',
    accent: '#fbbf24',
  },
  error: {
    bg: 'linear-gradient(135deg, #3b1d1d 0%, #5f2a2a 100%)',
    icon: 'cross',
    accent: '#f87171',
  },
}

export default function RecognitionResult({ result, onDismiss }) {
  const [secondsLeft, setSecondsLeft] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timer)
          onDismiss()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onDismiss])

  const v = VARIANTS[result.type] || VARIANTS.error

  const firstName = result.employee?.full_name?.split(' ')[0] || ''
  const att = result.attendance

  let title, subtitle, meta
  if (result.type === 'matched_in') {
    title = `Welcome, ${firstName}!`
    subtitle = `Marked IN at ${formatTimeForDisplay(att?.time)}`
    meta = att?.late_minutes > 0
      ? `${att.late_minutes} ${att.late_minutes === 1 ? 'minute' : 'minutes'} late`
      : 'On time'
  } else if (result.type === 'matched_out') {
    title = `Goodbye, ${firstName}!`
    subtitle = att?.was_already_out
      ? `OUT time updated to ${formatTimeForDisplay(att?.time)}`
      : `Marked OUT at ${formatTimeForDisplay(att?.time)}`
    meta = att?.early_leave_minutes > 0
      ? `${att.early_leave_minutes} ${att.early_leave_minutes === 1 ? 'minute' : 'minutes'} early`
      : 'Have a good day'
  } else if (result.type === 'not_matched') {
    title = 'Not recognized'
    subtitle = 'Please contact the admin to register your face'
    meta = ''
  } else if (result.type === 'blocked') {
    title = result.message || 'Closed today'
    subtitle = 'Attendance is not being recorded'
    meta = ''
  } else {
    title = 'Something went wrong'
    subtitle = result.message || 'Please try again'
    meta = ''
  }

  return (
    <div className="fade-in" style={{
      width: '100%',
      height: '100%',
      background: v.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '5vh 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative ring */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80vh',
        height: '80vh',
        maxWidth: '90vw',
        maxHeight: '90vw',
        borderRadius: '50%',
        border: `1px solid ${v.accent}22`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '60vh',
        height: '60vh',
        maxWidth: '70vw',
        maxHeight: '70vw',
        borderRadius: '50%',
        border: `1px solid ${v.accent}11`,
        pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div className="slide-up" style={{
        width: 'min(20vh, 140px)',
        height: 'min(20vh, 140px)',
        borderRadius: '50%',
        background: v.accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        boxShadow: `0 0 80px ${v.accent}66, 0 0 0 8px ${v.accent}22`,
        position: 'relative',
        zIndex: 2,
      }}>
        {v.icon === 'check' && (
          <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none" stroke="#0a1c10" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
        {v.icon === 'cross' && (
          <svg width="48%" height="48%" viewBox="0 0 24 24" fill="none" stroke="#1c0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        )}
        {v.icon === 'info' && (
          <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none" stroke="#1c170a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
        {v.icon === 'wave' && (
          <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none" stroke="#0a162e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
          </svg>
        )}
      </div>

      {/* Text */}
      <div className="slide-up" style={{ textAlign: 'center', maxWidth: 600, position: 'relative', zIndex: 2 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'min(6vh, 44px)',
          fontWeight: 600,
          color: 'var(--text-light)',
          marginBottom: 12,
          lineHeight: 1.15,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontSize: 'min(2.4vh, 19px)',
            color: 'rgba(255,255,255,0.85)',
            marginBottom: 16,
            fontWeight: 300,
          }}>
            {subtitle}
          </p>
        )}
        {meta && (
          <div style={{
            display: 'inline-block',
            padding: '7px 18px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.1)',
            border: `1px solid ${v.accent}55`,
            fontSize: 'min(1.7vh, 14px)',
            color: 'rgba(255,255,255,0.95)',
            fontWeight: 500,
          }}>
            {meta}
          </div>
        )}
      </div>

      {/* Auto-dismiss countdown + dismiss button */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        left: 0, right: 0,
        textAlign: 'center',
        zIndex: 2,
      }}>
        <button onClick={onDismiss} style={{
          padding: '10px 22px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 999,
          color: 'var(--text-light)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          marginBottom: 10,
        }}>
          Done
        </button>
        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
        }}>
          Returning to home in {secondsLeft}s
        </div>
      </div>
    </div>
  )
}
