import { supabaseAdmin } from './supabase'

const KIOSK_ID_KEY = 'rka_kiosk_device_id'
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function getKioskDeviceId() {
  let id = localStorage.getItem(KIOSK_ID_KEY)
  if (!id) {
    const random = Math.random().toString(36).slice(2, 10)
    id = 'kiosk-' + random
    localStorage.setItem(KIOSK_ID_KEY, id)
  }
  return id
}

function getDayOfWeek(date = new Date()) {
  return DAYS[date.getDay()]
}

function formatTime(date = new Date()) {
  // HH:MM:SS — for "time without time zone" columns
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatDate(date = new Date()) {
  // YYYY-MM-DD in local time
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0
  const parts = timeStr.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0')
}

/**
 * Pre-flight check before allowing recognition.
 * Returns { allowed: bool, reason?, message? }
 */
export async function checkAvailability(date = new Date()) {
  const dateStr = formatDate(date)
  const dayName = getDayOfWeek(date)

  // Holiday check
  const { data: holiday } = await supabaseAdmin
    .from('holidays')
    .select('name')
    .eq('date', dateStr)
    .maybeSingle()

  if (holiday) {
    return {
      allowed: false,
      reason: 'holiday',
      message: `Holiday today: ${holiday.name}`,
    }
  }

  // Sunday-closed check
  if (dayName === 'sunday') {
    const { data: rt } = await supabaseAdmin
      .from('reporting_time')
      .select('sunday_closed')
      .eq('id', 1)
      .maybeSingle()

    if (rt?.sunday_closed) {
      return {
        allowed: false,
        reason: 'sunday_closed',
        message: 'School is closed on Sundays',
      }
    }
  }

  return { allowed: true }
}

/**
 * Record an attendance event for a matched employee.
 * Decides IN vs OUT based on existing daily record.
 */
export async function recordAttendance(employee, matchResult) {
  const now = new Date()
  const dateStr = formatDate(now)
  const timeStr = formatTime(now)
  const dayName = getDayOfWeek(now)
  const kioskId = getKioskDeviceId()

  // Get reporting_time config
  const { data: rt } = await supabaseAdmin
    .from('reporting_time')
    .select('default_in_time, default_out_time, default_grace_minutes')
    .eq('id', 1)
    .maybeSingle()

  const expectedIn = rt?.default_in_time || '08:00:00'
  const expectedOut = rt?.default_out_time || '15:00:00'
  const graceMinutes = rt?.default_grace_minutes ?? 10

  // Check today's daily row
  const { data: existing } = await supabaseAdmin
    .from('attendance_daily')
    .select('id, in_time, out_time, status')
    .eq('employee_id', employee.id)
    .eq('date', dateStr)
    .maybeSingle()

  // Decide IN vs OUT
  let event_type
  let was_already_out = false
  if (!existing || !existing.in_time) {
    event_type = 'in'
  } else if (existing.in_time && !existing.out_time) {
    event_type = 'out'
  } else {
    // Both already exist — allow updating OUT (teacher came back, leaving again)
    event_type = 'out'
    was_already_out = true
  }

  // 1. Append to attendance_events (immutable log)
  const { error: evErr } = await supabaseAdmin.from('attendance_events').insert({
    employee_id: employee.id,
    event_time: now.toISOString(),
    event_type,
    identification_method: 'face',
    face_confidence: matchResult.confidence,
    face_snapshot_url: null,
    kiosk_device_id: kioskId,
    synced_from_offline: false,
  })
  if (evErr) throw new Error('Failed to log event: ' + evErr.message)

  // 2. Compute late_minutes / early_leave_minutes
  const nowMinutes = timeStringToMinutes(timeStr)
  const expectedInMinutes = timeStringToMinutes(expectedIn)
  const expectedOutMinutes = timeStringToMinutes(expectedOut)

  let late_minutes = existing?.late_minutes || 0
  let early_leave_minutes = existing?.early_leave_minutes || 0
  let status = existing?.status || 'present'

  if (event_type === 'in') {
    late_minutes = Math.max(0, nowMinutes - (expectedInMinutes + graceMinutes))
    status = late_minutes > 0 ? 'late' : 'present'
  } else {
    // OUT — recompute early_leave based on actual exit time
    early_leave_minutes = Math.max(0, expectedOutMinutes - nowMinutes)
    // status preserved from IN (present/late)
    if (existing?.in_time) {
      const inMinutes = timeStringToMinutes(existing.in_time)
      const inLate = Math.max(0, inMinutes - (expectedInMinutes + graceMinutes))
      status = inLate > 0 ? 'late' : 'present'
    }
  }

  // 3. Upsert attendance_daily
  const dailyRow = {
    employee_id: employee.id,
    date: dateStr,
    day_of_week: dayName,
    expected_in_time: expectedIn,
    expected_out_time: expectedOut,
    grace_minutes: graceMinutes,
    status,
    source: 'kiosk',
    updated_at: now.toISOString(),
    updated_by: 'kiosk:' + kioskId,
  }

  if (event_type === 'in') {
    dailyRow.in_time = timeStr
    dailyRow.late_minutes = late_minutes
  } else {
    dailyRow.out_time = timeStr
    dailyRow.early_leave_minutes = early_leave_minutes
  }

  if (existing) {
    const { error: upErr } = await supabaseAdmin
      .from('attendance_daily')
      .update(dailyRow)
      .eq('id', existing.id)
    if (upErr) throw new Error('Failed to update daily: ' + upErr.message)
  } else {
    dailyRow.created_at = now.toISOString()
    const { error: insErr } = await supabaseAdmin
      .from('attendance_daily')
      .insert(dailyRow)
    if (insErr) throw new Error('Failed to insert daily: ' + insErr.message)
  }

  return {
    event_type,
    status,
    late_minutes,
    early_leave_minutes,
    time: timeStr,
    was_already_out,
  }
}
