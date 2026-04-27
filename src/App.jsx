import React, { useState, useEffect } from 'react'
import IdleScreen from './pages/IdleScreen'
import CameraScreen from './pages/CameraScreen'
import { supabase } from './lib/supabase'

// Kiosk states
const STATES = {
  IDLE: 'idle',          // Waiting for someone to tap
  CAPTURING: 'capturing',// Camera open, capturing face
  RESULT: 'result',      // Showing welcome / error
}

export default function App() {
  const [state, setState] = useState(STATES.IDLE)
  const [supabaseReady, setSupabaseReady] = useState(null)
  const [now, setNow] = useState(new Date())

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Check Supabase connectivity on startup
  useEffect(() => {
    (async () => {
      try {
        const { error } = await supabase
          .from('reporting_time_config')
          .select('id')
          .eq('id', 1)
          .single()
        setSupabaseReady(!error)
      } catch (e) {
        setSupabaseReady(false)
      }
    })()
  }, [])

  function handleStartCapture() {
    setState(STATES.CAPTURING)
  }

  function handleCancelCapture() {
    setState(STATES.IDLE)
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {state === STATES.IDLE && (
        <IdleScreen
          now={now}
          supabaseReady={supabaseReady}
          onStart={handleStartCapture}
        />
      )}
      {state === STATES.CAPTURING && (
        <CameraScreen
          onCancel={handleCancelCapture}
        />
      )}
    </div>
  )
}
