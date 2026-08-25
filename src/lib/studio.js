// Podcast studio — request-to-book, not instant booking.
//
// WHY this module exists: the podcast studio is a STAFFED service, not a room
// with a door. Every session needs an operator rostered, a pre-session
// questionnaire answered, and a post-session media handover. So the studio can't
// follow the meeting-room path where a member picks a slot and walks in.
//
// The mechanism is deliberately small: a studio booking is written to the SAME
// `bookings` table as everything else, but always with status 'Pending' and a
// `studio` payload carrying the questionnaire + policy acceptance. Admin
// approval flips it to 'Confirmed', which is the single event that unlocks
// door access (api/salto/room-access.js already grants only on isConfirmed),
// the confirmation + guide emails, and any charge.
//
// Dependency-free on purpose — imported by the portal, the mobile app, the
// admin app AND the serverless endpoints (api/studio-request.js).

/** Space types that are request-gated. Media studios book instantly; only the
 *  podcast studio is staff-operated. Widen this set to gate more resources. */
export const REQUEST_GATED_TYPES = ['podcast']

/** Is this space request-to-book (staffed) rather than instant? */
export const isRequestGated = (space) => REQUEST_GATED_TYPES.includes(space?.type)

/**
 * Can a meeting-room credit be spent on this resource? NO for the podcast
 * studio.
 *
 * WHY: credits are an allowance for ROOMS — space that would otherwise sit
 * empty. A studio session is a staffed service: it costs an operator's time
 * whether or not anyone's allowance has room left. Letting a member draw 3.75
 * credits an hour against it would silently convert their included meeting-room
 * hours into paid labour, and make the studio's revenue depend on how much
 * allowance happened to be left that month.
 *
 * So a studio session is always billed as cash (a Booking Fee on the month-end
 * invoice), and the member's credit balance is never touched.
 */
export const creditsAllowed = (space) => !isRequestGated(space)

/** Policy version stamped onto each acceptance. Bump when the terms change so
 *  we can tell which wording a client actually agreed to. */
export const STUDIO_POLICY_VERSION = 'v1.0'

/** Minimum bookable session, in hours. Setup + pack-down live INSIDE this. */
export const MIN_SESSION_HOURS = 1

/** How long working copies are kept before deletion (policy §Files). */
export const RETENTION_DAYS = 14

// ── Who hears about a studio request ─────────────────────────────────────────
// Both the website endpoint and the portal notifier send here, so this is the
// ONE place to change who gets told.
//
// Towhid runs the studio (DCOL Project / Olivecast), so he needs the request at
// the same moment we do — he is the person who can actually say whether the
// slot can be staffed, which is the check approval waits on. Note he is not in
// the `admins` table, so he receives the email but cannot approve in the admin
// app; add an admins row if that changes.
//
// These emails carry the requester's contact details and questionnaire, so keep
// this list to people who genuinely need them.
export const STUDIO_NOTIFY_EMAILS = [
  'eric@hexaspace.com.au',
  'info@hexaspace.com.au',
  'towhid.hussain@tutamail.com',
]

/** Target turnaround for confirming a request — used in copy, everywhere. */
export const CONFIRM_SLA = '1 business day'

// ── The time budget ──────────────────────────────────────────────────────────
// From the Olivecast Operations Guide: a 1-hour booking is ~30 min setup and
// briefing, under ~15 min of actual recording, then ~15 min transfer and reset.
// This is the single most misunderstood thing about the studio, so it is
// modelled as data and rendered on every surface rather than written as prose
// in one place and forgotten in the others.
export const SESSION_PHASES = [
  { key: 'setup', label: 'Setup & briefing', mins: 30, note: 'Studio, camera, audio and lighting checks, then seating and mic placement.' },
  { key: 'record', label: 'Recording', mins: 15, note: 'The session itself. Longer recordings need a longer booking.' },
  { key: 'pack', label: 'Transfer & reset', mins: 15, note: 'Files copied and verified, cards logged, studio reset.' },
]

/** Recording time realistically available in a booking of `hours`. The fixed
 *  overhead is setup + pack-down; everything left over is recording. */
export function recordingMinutesFor(hours) {
  const overhead = SESSION_PHASES.filter((p) => p.key !== 'record').reduce((s, p) => s + p.mins, 0)
  return Math.max(0, Math.round((Number(hours) || 0) * 60) - overhead)
}

// ── Questionnaire ────────────────────────────────────────────────────────────
// Guide §2 (Client Pre-Booking Checklist), asked at request time rather than
// chased over email 24 hours out. Rendered by the portal and the website form
// from this one definition so the two never drift.
export const QUESTIONNAIRE_FIELDS = [
  {
    key: 'recordingType', label: 'What are you recording?', type: 'select', required: true,
    options: ['Interview', 'Solo / monologue', 'Video podcast', 'Other'],
  },
  {
    key: 'peopleOnCamera', label: 'People on camera', type: 'number', required: true,
    // Two, hard. The room is built around two Shure SM7B microphones — a host
    // and one guest — so a third person on camera has nothing to speak into.
    // validateQuestionnaire enforces this from here, on every surface.
    min: 1, max: 2, default: 2,
    help: 'The studio is set up for a host and one guest — two microphones, two camera angles. Talk to us first if you need more.',
  },
  {
    key: 'expectedRecordingMins', label: 'Expected recording length (minutes)', type: 'number', required: true,
    min: 5, max: 480, default: 15,
    help: 'The recording itself — not including setup. We use this to check your booking is long enough.',
  },
  {
    key: 'ownCrew', label: 'Bringing your own camera / audio operator?', type: 'boolean', default: false,
    help: 'Our team operates the studio by default.',
  },
  {
    key: 'ownCards', label: 'Bringing your own SD / microSD cards?', type: 'boolean', default: false,
    help: 'If not, we record to studio cards and hand your files over at the end of the session.',
  },
  {
    key: 'transferHelp', label: 'Need help transferring the files?', type: 'boolean', default: true,
    help: 'Bring a USB drive or portable SSD if you can — it is much faster than cloud transfer.',
  },
  {
    key: 'specialRequirements', label: 'Anything else we should set up?', type: 'textarea', required: false,
    placeholder: 'Lighting, seating, remote guest dial-in, accessibility needs…',
  },
]

/** Blank questionnaire, with each field's default applied. */
export function emptyQuestionnaire() {
  const q = {}
  for (const f of QUESTIONNAIRE_FIELDS) {
    q[f.key] = f.default !== undefined ? f.default : (f.type === 'boolean' ? false : f.type === 'number' ? null : '')
  }
  // Raw footage is always what's handed over — an edited-files service is not
  // priced yet, so the form must not imply we offer one.
  q.deliverables = 'raw'
  return q
}

/**
 * Validate a questionnaire. Returns an array of human-readable problems —
 * empty means good. Shared by the portal form and the public endpoint so a
 * crafted POST can't skip what the UI enforces.
 */
export function validateQuestionnaire(q, { hours } = {}) {
  const errors = []
  const val = q ?? {}
  for (const f of QUESTIONNAIRE_FIELDS) {
    if (!f.required) continue
    const v = val[f.key]
    if (v === '' || v == null) { errors.push(`${f.label} is required.`); continue }
    if (f.type === 'number') {
      const n = Number(v)
      if (!Number.isFinite(n)) { errors.push(`${f.label} must be a number.`); continue }
      if (f.min != null && n < f.min) errors.push(`${f.label} must be at least ${f.min}.`)
      if (f.max != null && n > f.max) errors.push(`${f.label} can be at most ${f.max}.`)
    }
  }
  // The booking has to be long enough to actually hold the recording they want.
  if (hours != null) {
    const want = Number(val.expectedRecordingMins) || 0
    const have = recordingMinutesFor(hours)
    if (want > have) {
      errors.push(
        `A ${hours}-hour booking leaves about ${have} minutes of recording time once setup and file transfer are allowed for. ` +
        `You've asked for ${want} minutes — please book a longer session.`)
    }
  }
  return errors
}

// ── Policy ───────────────────────────────────────────────────────────────────
// The client-facing terms, ticked to accept at request time. Kept here (not
// only in an editable template) so the acceptance is against wording we can
// version and reproduce later — an editable template can be changed after the
// fact, which is exactly what you don't want behind a signature.
export const STUDIO_POLICY = [
  {
    title: 'Requesting a session',
    body: `The studio is staff-operated and cannot be booked instantly. Every session is a request — we confirm within ${CONFIRM_SLA}. Your slot is held while we confirm, and nothing is charged until we do.`,
  },
  {
    title: 'What your booking includes',
    body: `Minimum booking is ${MIN_SESSION_HOURS} hour. Setup, briefing and file handover happen INSIDE your booking, not before or after it — allow about 30 minutes to set up and 15 minutes to transfer files and reset. A 1-hour booking typically leaves under 15 minutes of actual recording. If you need more recording time, book a longer session.`,
  },
  {
    title: 'Arriving on time',
    body: 'Please arrive at the start of your booked time. Setup time is part of your booking, so a late arrival shortens your recording rather than extending the session.',
  },
  {
    title: 'Our team operates the equipment',
    body: 'Cameras, audio and lighting are set to documented studio presets and operated by our team. Please do not move or adjust the microphones, cameras or lights — tell the operator what you need and they will handle it.',
  },
  {
    title: 'During the recording',
    body: 'Stay seated within the marked area so you remain in frame, speak toward the microphone rather than across it, and avoid tapping the table or handling the mic stand. Phones on silent. Water is welcome at the table but must be kept away from cables and equipment.',
  },
  {
    title: 'Your files',
    body: `Recordings are copied and verified before you leave, and handed over as raw files — multi-camera video and multi-track audio. Bring a USB drive or portable SSD if you can. We keep a working copy for ${RETENTION_DAYS} days as a safety net, then delete it, so please confirm you have everything you need within that window.`,
  },
  {
    title: 'Studio hours',
    body: 'The studio operates during business hours, 9:00am – 5:00pm on weekdays, because every session needs an operator on site.',
  },
  {
    title: 'Changes and cancellations',
    body: 'Let us know as early as you can if you need to move or cancel a session — an operator is rostered for your slot. Changing the time of a confirmed session returns it to pending while we re-check operator availability.',
  },
  {
    title: 'Care of the studio',
    body: 'You are responsible for any damage to the studio or its equipment caused by you or your guests. Please leave the space as you found it.',
  },
]

// ── Melbourne time ───────────────────────────────────────────────────────────
// Booking dates/times are Melbourne-local everywhere in this platform. Comparing
// them against a UTC `new Date().toISOString()` is wrong for ~10 hours a day:
// between midnight and 10/11am Melbourne, UTC is still "yesterday", so a request
// for a date already past would be accepted.
const MELBOURNE = 'Australia/Melbourne'

/** Today in Melbourne, as YYYY-MM-DD (en-CA formats that way). */
export function melbourneToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: MELBOURNE })
}

/** Current Melbourne time as HH:mm. */
export function melbourneNowTime() {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: MELBOURNE, hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/** Is this date a weekday? Parsed as a plain local date, no timezone shift. */
export function isWeekday(dateStr) {
  const dow = new Date(`${dateStr}T00:00:00`).getDay()
  return dow !== 0 && dow !== 6
}

/**
 * Shared slot validation for a studio request — the SAME rules on the portal,
 * the website endpoint and anywhere else, so a form can never accept something
 * the server then rejects (or the reverse). Returns an array of problems.
 */
export function validateStudioSlot({ date, startTime, hours }) {
  const errors = []
  const h = Number(hours) || 0
  if (!date) return ['Please choose a date.']
  if (!startTime) return ['Please choose a start time.']

  const [sh, sm] = String(startTime).split(':').map(Number)
  const startDec = (sh || 0) + (sm || 0) / 60
  const endDec = startDec + h

  if (h <= 0) errors.push('Please choose how long you need the studio.')
  if (startDec < 9) errors.push('The studio opens at 9:00 am.')
  if (endDec > 17) errors.push('The studio closes at 5:00 pm — please pick an earlier start or a shorter session.')
  if (!isWeekday(date)) errors.push('The studio operates on weekdays. Please choose a weekday.')

  const today = melbourneToday()
  if (date < today) errors.push('Please choose a date in the future.')
  else if (date === today && startTime <= melbourneNowTime()) {
    errors.push('That time has already passed today — please choose a later time or another day.')
  }
  return errors
}

// ── Booking payload ──────────────────────────────────────────────────────────

/** Crypto-strength token for public status links. Mirrors src/lib/token.js but
 *  inlined so this module stays importable from the serverless functions. */
export function studioToken() {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build the `studio` object that hangs off booking.data. One shape, written
 * identically by the portal, the app, the website endpoint and the admin form.
 */
export function buildStudioPayload({ questionnaire, acceptedBy, contact = null, source = 'Portal' }) {
  return {
    requestToken: studioToken(),
    requestedAt: new Date().toISOString(),
    requestSource: source,
    questionnaire: { ...emptyQuestionnaire(), ...(questionnaire ?? {}) },
    policyAccepted: {
      at: new Date().toISOString(),
      name: acceptedBy || '',
      version: STUDIO_POLICY_VERSION,
    },
    ...(contact ? { contact } : {}),
    guideSentAt: null,
    approval: null,
    // Filled by the operator after the session — the media golden rule made
    // into a record rather than a slide (see docs/sops/bookings/podcast-studio-operations.md).
    media: {
      cardSet: null,            // 'STUDIO' | 'CLIENT'
      transferVerifiedAt: null, // both copies verified
      handedOverAt: null,
      retentionUntil: null,
    },
  }
}

// ── Request status ───────────────────────────────────────────────────────────
// Derived from the booking's own status + studio payload rather than stored
// separately, so there is only ever one source of truth.

/** 'pending' | 'approved' | 'declined' | 'cancelled' */
export function studioRequestState(booking) {
  if (!booking) return 'pending'
  if (booking.status === 'Cancelled') {
    return booking.studio?.approval?.declinedAt ? 'declined' : 'cancelled'
  }
  if (booking.status === 'Confirmed') return 'approved'
  return 'pending'
}

export const STUDIO_STATE_STYLE = {
  pending: { label: 'Awaiting confirmation', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Confirmed', cls: 'bg-green-100 text-green-800' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600' },
}

/** Studio bookings still waiting on an admin decision, oldest request first. */
export function pendingStudioRequests(bookings, spaces) {
  const gated = new Set((spaces ?? []).filter(isRequestGated).map((s) => s.id))
  return (bookings ?? [])
    .filter((b) => gated.has(b.resourceId) && b.status === 'Pending')
    .sort((a, b) => String(a.studio?.requestedAt ?? a.createdAt ?? '').localeCompare(String(b.studio?.requestedAt ?? b.createdAt ?? '')))
}

/** Requests nobody has answered for `hours` — these are the ones that rot. */
export function staleRequests(bookings, spaces, hours = 48) {
  const cutoff = Date.now() - hours * 3600_000
  return pendingStudioRequests(bookings, spaces).filter((b) => {
    const t = Date.parse(b.studio?.requestedAt ?? b.createdAt ?? '')
    return Number.isFinite(t) && t < cutoff
  })
}

// ── Formatting helpers shared across surfaces ────────────────────────────────
export const studioTo12 = (t) => {
  let [h, m] = String(t || '0:0').split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')}${ap}`
}
export const studioDmy = (d) => String(d || '').split('-').reverse().join('/')

/** Human summary of a questionnaire, for emails and the admin drawer. */
export function questionnaireRows(q) {
  if (!q) return []
  const yn = (v) => (v ? 'Yes' : 'No')
  return [
    ['Recording type', q.recordingType || '—'],
    ['People on camera', q.peopleOnCamera != null ? String(q.peopleOnCamera) : '—'],
    ['Expected recording', q.expectedRecordingMins ? `${q.expectedRecordingMins} minutes` : '—'],
    ['Own crew', yn(q.ownCrew)],
    ['Own cards', yn(q.ownCards)],
    ['Needs transfer help', yn(q.transferHelp)],
    ['Files', 'Raw footage handed over on the day'],
    ['Special requirements', q.specialRequirements || '—'],
  ]
}
