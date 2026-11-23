import type { PlanItem } from './taskStore';

export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

// Check only explicit, unambiguous source components. Relative dates and
// numeric dates with an unknown locale are deliberately not interpreted.
export function calendarDateIssue(value: string, rawDate?: string): string | null {
  if (!value) return null;
  if (!validCalendarDate(value)) return 'Choose a valid calendar date, including a four-digit year.';
  if (!rawDate) return null;
  const [year, month, day] = value.split('-').map(Number);
  const iso = [...rawDate.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)];
  if (iso.length === 1 && validCalendarDate(iso[0][0]) && iso[0][0] !== value)
    return `The source says ${iso[0][0]}. Check that your chosen date is intentional.`;
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const sourceDates = [...rawDate.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi)];
  if (sourceDates.length === 1) {
    const date = sourceDates[0];
    if (monthNames.indexOf(date[1].toLowerCase()) + 1 !== month || Number(date[2]) !== day || (date[3] && Number(date[3]) !== year))
      return `The source says ${date[0]}. Check that your chosen date is intentional.`;
  }
  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const sourceDays = [...rawDate.matchAll(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/gi)];
  if (sourceDays.length === 1) {
    const chosenDay = weekdays[new Date(value + 'T12:00:00Z').getUTCDay()];
    if (sourceDays[0][0].toLowerCase() !== chosenDay.toLowerCase())
      return `The source says ${sourceDays[0][0]}, but your chosen date is a ${chosenDay}. Check the year.`;
  }
  return null;
}

function escapeValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function fold(line: string) {
  const bytes = new TextEncoder();
  let length = 0;
  let result = '';
  for (const character of line) {
    const size = bytes.encode(character).length;
    if (length + size > 75) { result += '\r\n '; length = 1; }
    result += character;
    length += size;
  }
  return result;
}

export async function calendarFile(items: PlanItem[]) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = await Promise.all(items.filter(item => !item.done && validCalendarDate(item.due)).map(async item => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(item.id));
    const uid = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    return ['BEGIN:VEVENT', 'UID:' + uid + '@noticetrail', 'DTSTAMP:' + timestamp,
      'DTSTART;VALUE=DATE:' + item.due.replaceAll('-', ''), 'SUMMARY:' + escapeValue(item.task),
      'DESCRIPTION:' + escapeValue([item.notice, item.origin, item.evidence].join('\n')), 'END:VEVENT'];
  }));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NoticeTrail//Planner//EN', ...events.flat(), 'END:VCALENDAR', ''].map(fold).join('\r\n');
}

export async function downloadCalendar(items: PlanItem[]) {
  const data = await calendarFile(items);
  const url = URL.createObjectURL(new Blob([data], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'noticetrail-deadlines.ics';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
