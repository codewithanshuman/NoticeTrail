import type { PlanItem } from './taskStore';

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
  const events = await Promise.all(items.filter(item => !item.done && item.due).map(async item => {
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
