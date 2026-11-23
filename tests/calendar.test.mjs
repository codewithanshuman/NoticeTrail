import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDateIssue, calendarFile, validCalendarDate } from '../src/calendar.ts';

test('calendar exports only dated open tasks and preserves event identity', async () => {
  const task={id:'library-step',task:'Return books',evidence:'By June 17',notice:'Library',origin:'Confirmed',done:false,due:'2027-06-17',created:0};
  const first=await calendarFile([task,{...task,id:'closed',done:true},{...task,id:'undated',due:''}]);
  const second=await calendarFile([{...task,due:'2027-06-16'}]);
  assert.equal(first.match(/BEGIN:VEVENT/g).length,1);
  assert.match(first,/DTSTART;VALUE=DATE:20270617/);
  assert.equal(first.match(/UID:[^\r]+/)[0],second.match(/UID:[^\r]+/)[0]);
});

test('calendar dates reject invalid days, rollover, malformed values, and year zero', () => {
  for (const value of ['2027-02-29','2100-02-29','2026-04-31','2026-13-01','2026-00-10','2026-04-00','0000-01-01','2026-4-1','20261122','2026-11-22T00:00:00Z',''])
    assert.equal(validCalendarDate(value),false,value);
  for (const value of ['2028-02-29','2000-02-29','0001-01-01','9999-12-31','2026-04-30'])
    assert.equal(validCalendarDate(value),true,value);
});

test('malformed persisted dates never reach exported calendar events', async () => {
  const task={id:'invalid',task:'Return books',evidence:'By June 17',notice:'Library',origin:'Confirmed',done:false,due:'2027-02-29',created:0};
  const result=await calendarFile([task,{...task,id:'injection',due:'2027-06-17\r\nSUMMARY:unexpected'}]);
  assert.ok(!result.includes('BEGIN:VEVENT'));
});

test('calendar confirmation catches explicit month, day, year, and weekday conflicts', () => {
  assert.equal(calendarDateIssue('2026-04-17','Friday, April 17'),null);
  assert.match(calendarDateIssue('2027-04-17','Friday, April 17'),/Saturday.*year/);
  assert.match(calendarDateIssue('2026-04-18','April 17'),/April 17/);
  assert.match(calendarDateIssue('2027-04-17','April 17, 2026'),/April 17, 2026/);
  assert.match(calendarDateIssue('2026-04-17','2026-04-18'),/2026-04-18/);
  assert.equal(calendarDateIssue('2026-04-17','04/05'),null,'numeric locale is not guessed');
  assert.equal(calendarDateIssue('2026-04-17','next Friday'),null,'matching weekday does not infer a date');
  assert.equal(calendarDateIssue('2026-04-17','April 17 or April 18'),null,'multiple alternatives are not reduced to the first date');
});
test('calendar text is escaped and Unicode lines fold at valid byte boundaries', async () => {
  const result=await calendarFile([{id:'unicode',task:'Read, review; then file',evidence:'山'.repeat(80)+'\nA second line',notice:'Notice',origin:'Confirmed',done:false,due:'2027-06-17',created:0}]);
  assert.ok(result.includes('Read\\, review\\; then file'));
  assert.ok(result.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
  assert.ok(result.replace(/\r\n /g,'').includes('山'.repeat(80)+'\\nA second line'));
});
