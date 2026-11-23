import { useEffect, useState } from 'react';
import { BookOpen, Check, CalendarDays, CircleAlert } from 'lucide-react';
import { acceptImpact, factChanges, impacts, keepImpact, matchImpact } from './trailEngine';
import { calendarDateIssue, downloadCalendar, validCalendarDate } from './calendar';
import type { Workspace, JourneyTask } from './domain';

type Props = { workspace: Workspace; onChange: (workspace: Workspace) => void; onInspect: (id: string, versionId: string) => void };

export default function JourneyView({ workspace, onChange, onInspect }: Props) {
  const [message, setMessage] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const pending = impacts(workspace);
  const latest = workspace.versions.at(-1)!;
  const completed = workspace.tasks.filter(task => task.done && !pending.some(impact => impact.task.id === task.id)).length;
  const exportable = workspace.tasks.filter(task => !task.done && validCalendarDate(task.due) && !pending.some(impact => impact.task.id === task.id));

  useEffect(() => { setMapping({}); setMessage(''); }, [workspace.id, latest.id]);

  function update(taskId: string, fields: Partial<JourneyTask>) {
    onChange({ ...workspace, tasks: workspace.tasks.map(task => task.id === taskId ? { ...task, ...fields } : task) });
  }

  async function calendar() {
    await downloadCalendar(exportable.map(task => ({ id: task.id, task: task.title, evidence: task.quote, notice: workspace.title,
      origin: `Date confirmed in NoticeTrail · Source: ${workspace.versions.find(version => version.id === task.versionId)?.label ?? 'saved notice'}${task.reviewVersionId === latest.id ? ' · Earlier step intentionally retained after review' : ''}`,
      done: task.done, due: task.due, created: 0 })));
    setMessage(`Exported ${exportable.length} ${exportable.length === 1 ? 'step' : 'steps'} as all-day calendar events. Completed, undated, and unreviewed steps were excluded.`);
  }

  function match(taskId: string) {
    const next = matchImpact(workspace, taskId, mapping[taskId]);
    if (next === workspace) { setMessage('This match is unavailable or already belongs to another saved step. Review your selection.'); return; }
    onChange(next);
    setMessage('Source match confirmed. The updated step is open again; confirm its calendar date if needed.');
  }

  return <section className="journey-view">
    <div className="section-head"><div><span className="eyebrow">YOUR NEXT STEPS</span><h2>A journey you can follow.</h2></div>
      <button disabled={!exportable.length} onClick={() => calendar().catch(() => setMessage('Calendar export failed. Try again.'))}><CalendarDays size={16}/>Export calendar</button>
    </div>
    <div className="journey-progress"><p><strong>{completed}</strong> of {workspace.tasks.length} complete{pending.length > 0 && <span> · {pending.length} awaiting source review</span>}</p>
      <progress aria-label="Journey progress" max={Math.max(1, workspace.tasks.length)} value={completed}/>
    </div>
    {workspace.tasks.length > 0 && <p className="journey-export-note">Calendar export includes open steps with a confirmed date and no pending source review. Events are all-day; notice times remain in the source.</p>}
    {message && <p className="journey-message" role="status">{message}</p>}
    {workspace.tasks.length === 0 && <div className="empty-panel"><h3>Your journey starts with a fact.</h3><p>Select an object in the world, review its source, then save the step here.</p></div>}
    {workspace.tasks.map(task => {
      const original = workspace.versions.find(version => version.id === task.versionId);
      const node = original?.nodes.find(fact => fact.id === task.nodeId);
      const impact = pending.find(item => item.task.id === task.id);
      const candidate = impact?.next ?? latest.nodes.find(item => item.id === mapping[task.id]);
      const retained = !impact && task.reviewVersionId === latest.id && task.versionId !== latest.id;
      const dateIssue = calendarDateIssue(task.due, node?.rawDate);
      const changes = impact?.previous && impact.next ? factChanges(impact.previous, impact.next) : [];
      return <article key={task.id} className={'journey-step ' + (impact ? 'needs-review' : task.done ? 'complete' : '')}>
        <div className="step-top"><button className="completion-button" aria-pressed={task.done} disabled={Boolean(impact)}
          aria-label={(task.done ? 'Reopen ' : 'Complete ') + task.title}
          title={impact ? 'Review the source update before changing completion.' : undefined}
          onClick={() => update(task.id, { done: !task.done })}>{task.done && <Check size={18}/>}</button>
          <div><span className="eyebrow">{node?.obligation ?? 'suggested'}{node?.condition ? ' · ' + node.condition : ''}</span><h3>{task.title}</h3><small>Saved from {original?.label ?? 'earlier source'}{task.done && impact ? ' · Previous completion needs review' : ''}</small></div>
        </div>
        {retained && <p className="retained-note"><Check size={14}/>You chose to keep this earlier step after reviewing {latest.label}.</p>}
        {node?.status === 'needs_review' && <p className="source-review-note">Check the original source before relying on this extracted step.</p>}
        <button className="text-link" onClick={() => onInspect(task.nodeId, task.versionId)}><BookOpen size={14}/>Why this step?</button>
        <label className="due-control" htmlFor={'due-' + task.id}>Confirm calendar date <input id={'due-' + task.id} type="date" min="0001-01-01" max="9999-12-31" value={task.due}
          disabled={Boolean(impact)} aria-describedby={'date-note-' + task.id} aria-invalid={Boolean(task.due && !validCalendarDate(task.due))}
          onChange={event => update(task.id, { due: event.target.value })}/></label>
        <small id={'date-note-' + task.id}>{impact ? 'Resolve the source update before confirming a date.' : node?.rawDate ? 'Source date: ' + node.rawDate + '. Confirm the year; dates are never inferred.' : 'Leave empty if no deadline applies. A date you enter is your own planning choice.'}</small>
        {dateIssue && <p className="date-warning" role="status"><CircleAlert size={15}/>{dateIssue}</p>}
        {impact && <div className="impact-review"><strong>Review the source update</strong>
          <p>{impact.next ? 'The saved source has changed. Compare the evidence before choosing which version your plan should follow.' : 'No confident match was found in the latest notice. This does not mean the step was removed.'}</p>
          {changes.length > 0 && <p className="changed-fields">Changed: {changes.join(' · ')}</p>}
          <div className="quote-pair"><blockquote><small>Saved source · {original?.label ?? 'earlier notice'}</small>{task.quote}</blockquote>
            <blockquote><small>{impact.next ? 'Latest source' : 'Selected replacement'} · {latest.label}</small>{candidate?.quote ?? 'Select the corresponding fact below to preview its evidence.'}
              {candidate?.condition && <small>Condition: {candidate.condition}</small>}
              {candidate?.status === 'needs_review' && <small>This excerpt still needs checking against the original source.</small>}
            </blockquote></div>
          {impact.next ? <button className="primary" onClick={() => { onChange(acceptImpact(workspace, task.id)); setMessage('Update accepted. The step is open again and its date needs reconfirming.'); }}>Accept updated step</button> :
            <div className="match-control"><label htmlFor={'match-' + task.id}>Corresponding fact in {latest.label}</label><select id={'match-' + task.id} aria-label={'Match revised source for ' + task.title} value={mapping[task.id] ?? ''} onChange={event => setMapping({ ...mapping, [task.id]: event.target.value })}>
              <option value="">Choose a revised fact</option>{latest.nodes.filter(fact => fact.kind !== 'question' && fact.kind !== 'location').map(fact => <option key={fact.id} value={fact.id} disabled={workspace.tasks.some(other => other.id !== task.id && other.nodeId === fact.id)}>{fact.title}</option>)}
            </select><button disabled={!candidate} onClick={() => match(task.id)}>Confirm source match</button></div>}
          <button onClick={() => { onChange(keepImpact(workspace, task.id)); setMessage('Earlier step retained for this revision. A later source update will prompt a new review.'); }}>Keep saved step</button>
          <small>Accepting reopens this step and clears its calendar date. Keeping preserves your original source, date, and completion for this revision.</small>
        </div>}
        <button className="text-link danger" onClick={() => onChange({ ...workspace, tasks: workspace.tasks.filter(item => item.id !== task.id) })}>Remove step</button>
      </article>;
    })}
  </section>;
}
