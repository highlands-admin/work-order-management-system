// Builds an iCalendar meeting request (METHOD:REQUEST) for a recurring work
// order's due date, attached to its reminder emails. Outlook and Gmail place a
// request like this on the recipient's calendar on their own (as tentative)
// under their default settings, so the due item shows up at 9 AM even for
// people who never open Workflow 360.
//
// The UID is fixed per work order, so every later reminder for the same work
// order updates the one event instead of adding another. SEQUENCE must grow
// with each update, so it is the send time in minutes.

const CALENDAR_TIME_ZONE = 'America/New_York'
const EVENT_HOUR = 9
const EVENT_MINUTES = 30

type InviteInput = {
  workOrderId: string
  code: string
  title: string
  propertyName: string | null
  description: string
  dueAt: string
  url: string
  organizerEmail: string
  attendeeEmail: string
  now?: Date
}

// Calendar date (YYYY-MM-DD) of an instant in the Eastern time zone.
function easternDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

// The UTC instant for a wall-clock time in the Eastern time zone, correct
// across daylight saving changes.
function easternWallClockToUtc(date: string, hour: number): Date {
  const [y, m, d] = date.split('-').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, hour))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CALENDAR_TIME_ZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(guess)
  const shownHour = Number(parts.find((p) => p.type === 'hour')?.value ?? hour)
  return new Date(guess.getTime() + (hour - shownHour) * 3_600_000)
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function icsTime(instant: Date): string {
  return instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// RFC 5545 text escaping, then folding to 75-octet lines.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let cut = 75
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 75) cut -= 1
    out.push(rest.slice(0, cut))
    rest = ' ' + rest.slice(cut)
  }
  out.push(rest)
  return out.join('\r\n')
}

// Returns the .ics file content. An item already past due is placed on the
// next morning instead, so the event is never created in the past.
export function buildDueDateInvite(input: InviteInput): string {
  const now = input.now ?? new Date()
  const today = easternDate(now)
  const due = easternDate(new Date(input.dueAt))
  const overdue = due < today
  const eventDate = overdue ? addDays(today, 1) : due

  const start = easternWallClockToUtc(eventDate, EVENT_HOUR)
  const end = new Date(start.getTime() + EVENT_MINUTES * 60_000)
  const where = input.propertyName ? ` (${input.propertyName})` : ''
  const summary = `${overdue ? 'OVERDUE: ' : 'Due: '}${input.code} ${input.title}${where}`
  const details = [
    overdue ? `This item was due ${due} and is overdue.` : `Due ${due}.`,
    input.description,
    `Open in Workflow 360: ${input.url}`,
  ].join('\n\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Highlands//Workflow 360//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:work-order-${input.workOrderId}@workflow360`,
    `SEQUENCE:${Math.floor(now.getTime() / 60_000)}`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(details)}`,
    `URL:${input.url}`,
    `ORGANIZER;CN=Workflow 360:mailto:${input.organizerEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${input.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

// "Workflow 360 <alerts@x.com>" -> "alerts@x.com"
export function bareAddress(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return (match ? match[1] : from).trim()
}
