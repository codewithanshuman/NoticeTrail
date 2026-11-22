import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarFile } from '../src/calendar.ts';

test('calendar exports only dated open tasks and preserves event identity', async () => {
  const task={id:'library-step',task:'Return books',evidence:'By June 17',notice:'Library',origin:'Confirmed',done:false,due:'2027-06-17',created:0};
  const first=await calendarFile([task,{...task,id:'closed',done:true},{...task,id:'undated',due:''}]);
  const second=await calendarFile([{...task,due:'2027-06-16'}]);
  assert.equal(first.match(/BEGIN:VEVENT/g).length,1);
  assert.match(first,/DTSTART;VALUE=DATE:20270617/);
  assert.equal(first.match(/UID:[^\r]+/)[0],second.match(/UID:[^\r]+/)[0]);
});
test('calendar text is escaped and Unicode lines fold at valid byte boundaries', async () => {
  const result=await calendarFile([{id:'unicode',task:'Read, review; then file',evidence:'山'.repeat(80)+'\nA second line',notice:'Notice',origin:'Confirmed',done:false,due:'2027-06-17',created:0}]);
  assert.ok(result.includes('Read\\, review\\; then file'));
  assert.ok(result.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
  assert.ok(result.replace(/\r\n /g,'').includes('山'.repeat(80)+'\\nA second line'));
});
