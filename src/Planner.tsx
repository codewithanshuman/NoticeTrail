import { useState } from 'react';
import { Bookmark, CalendarDays, Check, Trash2 } from 'lucide-react';
import { downloadCalendar } from './calendar';
import { deleteTask, updateTask, type PlanInput, type PlanItem } from './taskStore';

type Props = { items: PlanItem[]; refresh: () => Promise<void>; save: (input: PlanInput) => Promise<boolean>; report: (message: string) => void };

export default function Planner({ items, refresh, save, report }: Props) {
  const [filter, setFilter] = useState('Open');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const dated = items.filter(item => !item.done && item.due);
  const visible = items.filter(item => (filter === 'All' || item.done === (filter === 'Completed')) &&
    [item.task, item.notice, item.evidence].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.created - a.created);

  async function mutate(operation: Promise<void>) {
    try { await operation; await refresh(); }
    catch { report('Could not update this item. Check browser storage and try again.'); }
  }

  return <div className="planner input-card">
    <div className="plan-head"><div><Bookmark size={20}/><h3>My action plan</h3></div><button className="text-button" disabled={!dated.length} onClick={() => downloadCalendar(items).catch(() => report('Could not export your calendar.'))}><CalendarDays size={16}/> Export open deadlines ({dated.length})</button></div>
    <p>Saved in this browser. Choose a due date to include a step in your calendar as an all-day event.</p>
    <form className="task-entry" onSubmit={async e => { e.preventDefault(); const task = draft.trim(); if (task && await save({task, notice: 'Personal task', origin: 'Added by you', evidence: ''})) setDraft(current => current.trim() === task ? '' : current); }}>
      <input aria-label="New task" placeholder="Add a task of your own" maxLength={300} value={draft} onChange={e => setDraft(e.target.value)}/>
      <button type="submit" disabled={!draft.trim()}>Add task</button></form>
    <div className="plan-tools"><div>{['Open', 'Completed', 'All'].map(value => <button key={value} aria-pressed={value === filter} onClick={() => setFilter(value)}>{value} ({items.filter(item => value === 'All' || item.done === (value === 'Completed')).length})</button>)}</div>
    <input type="search" aria-label="Search tasks" placeholder="Search tasks or notices" value={query} onChange={e => setQuery(e.target.value)}/></div>
    {visible.length ? <ul className="plan-list">{visible.map(item => <li key={item.id}>
      <button className={'plan-check' + (item.done ? ' completed' : '')} aria-pressed={item.done} aria-label={'Complete ' + item.task} onClick={() => mutate(updateTask(item.id, {done: !item.done}))}>{item.done && <Check size={15}/>}</button>
      <div><strong>{item.task}</strong><small>{item.notice} · {item.origin}</small>{item.evidence && <details><summary>Source excerpt</summary><blockquote>{item.evidence}</blockquote></details>}</div>
      <label>Due date<input type="date" value={item.due} onChange={e => mutate(updateTask(item.id, {due: e.target.value}))}/></label>
      <button className="icon-button" aria-label={'Remove ' + item.task} onClick={() => mutate(deleteTask(item.id))}><Trash2 size={16}/></button>
    </li>)}</ul> : <p className="plan-empty">{items.length ? 'No matching tasks in this view.' : 'Save a step from a brief or comparison, or add your first task above.'}</p>}
  </div>;
}
