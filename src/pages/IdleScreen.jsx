import React from 'react'

export default function IdleScreen({ now, supabaseReady, onStart }) {
  // Determine if it's morning (suggest IN) or afternoon (suggest OUT)
  const hour = now.getHours()
  const isAfternoon = hour >= 12
  const suggestedAction = isAfternoon ? 'OUT' : 'IN'

  // Format date/time
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return (
    <div className="fade-in" style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '5vh 24px',
      textAlign: 'center',
      position: 'relative',
    }}>
      {/* Top: status indicator */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 999,
        fontSize: 11,
        color: 'var(--text-muted)',
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: supabaseReady === true ? '#4ade80' : supabaseReady === false ? '#ef4444' : '#fbbf24',
        }} />
        {supabaseReady === true ? 'Online' : supabaseReady === false ? 'Offline' : 'Connecting…'}
      </div>

      {/* Banner (replaces round crest + school-name block) */}
      <img src="/banner.png" alt="Radhakrishna Academy" style={{
        width: 'min(70vw, 480px)',
        height: 'auto',
        maxHeight: '22vh',
        objectFit: 'contain',
        filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))',
        marginBottom: 14,
      }} />

      {/* Attendance Portal label */}
      <div style={{
        fontSize: 'min(1.4vh, 11px)',
        color: 'var(--text-faint)',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight: 600,
        marginBottom: 'min(5vh, 36px)',
      }}>
        Attendance Portal
      </div>

      {/* Date + Time */}
      <div style={{
        fontSize: 'min(2.2vh, 16px)',
        color: 'var(--text-muted)',
        marginBottom: 6,
      }}>
        {dateStr}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'min(7vh, 56px)',
        fontWeight: 700,
        color: 'var(--gold-light)',
        letterSpacing: '2px',
        marginBottom: 'min(6vh, 48px)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {timeStr}
      </div>

      {/* Tap button */}
      <button
        onClick={onStart}
        style={{
          background: 'linear-gradient(135deg, var(--gold) 0%, #b58c1a 100%)',
          color: '#1a1a1a',
          border: 'none',
          borderRadius: 16,
          padding: 'min(2.4vh, 22px) min(8vh, 64px)',
          fontSize: 'min(2.6vh, 22px)',
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.5px',
          fontFamily: 'var(--font-body)',
          animation: 'pulseGlow 2.4s ease-in-out infinite',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          minWidth: 'min(45vh, 280px)',
          position: 'relative',
        }}
      >
        Tap to mark {suggestedAction}
      </button>

      <div style={{
        marginTop: 18,
        fontSize: 'min(1.6vh, 12px)',
        color: 'var(--text-faint)',
        maxWidth: 320,
        lineHeight: 1.5,
      }}>
        Look at the camera when prompted.<br/>
        We'll recognise you automatically.
      </div>

      {/* Bottom info bar */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        fontSize: 10,
        color: 'var(--text-faint)',
        letterSpacing: '0.05em',
      }}>
        <span>v0.1 · kiosk</span>
        <span>Need help? Contact admin</span>
      </div>
    </div>
  )
}
