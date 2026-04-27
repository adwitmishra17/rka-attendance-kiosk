import React, { useState, useEffect } from 'react'
import IdleScreen from './pages/IdleScreen'
import CameraScreen from './pages/CameraScreen'
import { supabase } from './lib/supabase'

const STATES = {
  IDLE: 'idle',
  CAPTURING: 'capturing',
}

export default function App() {
  const [state, setState] = useState(STATES.IDLE)
  const [supabaseReady, setSupabaseReady] = useState(null)
  const [now, setNow] = useState(new Date())
  const [lastCapture, setLastCapture] = useState(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

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

  function handleCaptured(captureData) {
    // Phase 2: just log it. Phase 4 will use this to do recognition + record.
    console.log('Face captured:', {
      descriptorLength: captureData.descriptor.length,
      detectionScore: captureData.detectionScore,
      hasSnapshot: !!captureData.videoSnapshot,
    })
    setLastCapture(captureData)
    // CameraScreen handles its own success UI; user clicks "Done" to return
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
          onCaptured={handleCaptured}
        />
      )}
    </div>
  )
}
