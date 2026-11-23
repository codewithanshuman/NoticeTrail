import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Focus, Minus, Plus } from 'lucide-react';
import type { Fact, Version } from './domain';
import './world.css';

type Props = {
  version: Version;
  selectedId: string | null;
  onSelect: (id: string) => void;
  completedIds: string[];
  changedIds: string[];
  connections?: boolean;
};

const HEIGHT = 640;
const MIN_ZOOM = .8;
const MAX_ZOOM = 2;
const kindOrder: Record<Fact['kind'], number> = { event: 0, action: 1, deadline: 2, requirement: 3, location: 4, question: 5 };
const names: Record<Fact['kind'], string> = {
  event: 'Event', action: 'Action', deadline: 'Deadline', requirement: 'Requirement',
  location: 'Location', question: 'Open question',
};

function labelLines(title: string, limit = 24) {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [''];
  for (const word of words) {
    const last = lines.length - 1;
    if ((lines[last] + ' ' + word).trim().length > limit && lines[last]) lines.push(word);
    else lines[last] = (lines[last] + ' ' + word).trim();
  }
  return lines.slice(0, 2).map((line, index) => line.length > limit || (index === 1 && lines.length > 2) ? line.slice(0, limit - 1) + '…' : line);
}

function ObjectShape({ kind, completed }: { kind: Fact['kind']; completed: boolean }) {
  if (kind === 'event' || kind === 'location') return <g className="world-building">
    <path d="M-55 7 0-20 55 7 0 36Z" fill="#c7c7b4"/>
    <path d="M-45 0V-55L0-30V26Z" fill="#e4cfac" stroke="#7b765e" strokeWidth="1.5"/>
    <path d="M0-30 45-55V0L0 26Z" fill="#f7ead2" stroke="#7b765e" strokeWidth="1.5"/>
    <path d="M-53-54-7-85 53-54 0-24Z" fill="#a35b43" stroke="#814631" strokeWidth="2"/>
    <path d="M-53-54 0-24 53-54" fill="none" stroke="#d48b67" strokeWidth="3"/>
    <path d="M14 18V-8L29-16V10" fill="#6b8078" stroke="#5c7067" strokeWidth="2"/>
    <path d="M-33-39-20-32V-15L-33-22Z" fill="#6d8b98"/>
    <path d="M-16-29-7-24V-7L-16-12Z" fill="#6d8b98"/>
    <path d="M34-32 40-35V-20L34-17Z" fill="#a6c1be"/>
  </g>;
  if (kind === 'deadline') return <g>
    <path d="M-12 18 0 11 14 18 1 25Z" fill="#baab89"/>
    <path d="M-3 17V-18H5V17" fill="#85836b"/>
    <circle cy="-43" r="31" fill="#d5ad65" stroke="#8f7044" strokeWidth="2"/>
    <circle cy="-43" r="25" fill="#fff9e9"/>
    <path d="M0-59V-43L13-36" fill="none" stroke="#76563c" strokeWidth="3" strokeLinecap="round"/>
    <path d="M0-65V-61M0-25V-21M-22-43H-18M18-43H22" stroke="#8a6a4b" strokeWidth="2"/>
  </g>;
  if (kind === 'requirement') return <g>
    <path d="M-24 13 1 1 30 14 4 27Z" fill="#c7c7b4"/>
    <path d="M-11-45V-58Q0-70 11-58V-45" fill="none" stroke="#6e8070" strokeWidth="6"/>
    <path d="M-27-39Q-27-51-15-51H17Q29-51 29-38L33 7Q33 17 21 19H-18Q-30 17-30 6Z" fill="#8a9e7e" stroke="#66775d" strokeWidth="2"/>
    <path d="M-26-33Q0-21 28-33" fill="none" stroke="#c6d2b2" strokeWidth="3"/>
    <rect x="-19" y="-17" width="39" height="27" rx="6" fill="#b5bd8f" stroke="#6e805f"/>
    <path d="M-13-9H14" stroke="#76825f" strokeWidth="2"/>
    <path d="M0-42V-23" stroke="#d6bd79" strokeWidth="5"/>
  </g>;
  if (kind === 'question') return <g>
    <path d="M-4 23V-23H4V23" fill="#a1977b"/>
    <path d="M-32-62H21L36-46 21-30H-32Z" fill="#b7cbd2" stroke="#6c8998" strokeWidth="2"/>
    <text x="-2" y="-39" textAnchor="middle" fill="#426270" fontSize="26" fontWeight="700">?</text>
  </g>;
  return <g>
    <path d="M-29 13 0-2 31 13 1 29Z" fill="#d8ccab" stroke="#b9aa89"/>
    <path d="M-11 16V-66" stroke="#77765c" strokeWidth="5" strokeLinecap="round"/>
    <path d="M-8-65H34L24-49 34-32H-8Z" fill={completed ? '#759579' : '#c47752'} stroke={completed ? '#57785e' : '#9d5637'} strokeWidth="2"/>
    {completed ? <path d="m1-48 7 7 13-15" stroke="#fff8e8" strokeWidth="3" fill="none"/> : <path d="M2-54H20M2-45H15" stroke="#f8d5af" strokeWidth="3"/>}
  </g>;
}

export default function WorldView({ version, selectedId, onSelect, completedIds, changedIds, connections = false }: Props) {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width:600px)').matches);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 500, y: HEIGHT / 2 });
  const [relationId, setRelationId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(compact);
  const svg = useRef<SVGSVGElement>(null);
  const relationPanel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; centerX: number; centerY: number } | null>(null);
  const instanceId = useId().replace(/:/g, '');
  const width = compact ? 600 : 1000;
  const pageSize = compact ? 4 : 6;
  const columns = compact ? 2 : 3;
  // Model response ordering must not reshuffle unchanged facts in the same version.
  const ordered = useMemo(() => [...version.nodes].sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.id.localeCompare(b.id)), [version.nodes]);
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = ordered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const positions = new Map(visible.map((node, index) => {
    const row = Math.floor(index / columns);
    const count = Math.min(columns, visible.length - row * columns);
    const margin = compact ? 150 : 170;
    const x = count === 1 ? width / 2 : margin + (width - 2 * margin) / (count - 1) * (index % columns);
    return [node.id, { x, y: visible.length <= columns ? 305 : row === 0 ? 200 : 470 }];
  }));
  const nodesById = new Map(version.nodes.map(node => [node.id, node]));
  const edges = version.edges.filter(edge => nodesById.has(edge.source) && nodesById.has(edge.target));
  const visibleEdges = edges.filter(edge => positions.has(edge.source) && positions.has(edge.target));
  const activeEdge = (edge: (typeof edges)[number]) => selectedId === edge.source || selectedId === edge.target || relationId === edge.id;
  const renderedEdges = [...visibleEdges].sort((a, b) => Number(activeEdge(b)) - Number(activeEdge(a)) || a.id.localeCompare(b.id));
  const labelBoxes: { left: number; right: number; top: number; bottom: number }[] = [];
  const relation = edges.find(edge => edge.id === relationId);
  const selectedIndex = ordered.findIndex(node => node.id === selectedId);
  const offPageConnections = edges.length - visibleEdges.length;

  function constrain(position: { x: number; y: number }, nextZoom = zoom) {
    // Keep the scene within reach even after repeated dragging or keyboard panning.
    const xRange = Math.max(0, (width - width / nextZoom) / 2) + 64;
    const yRange = Math.max(0, (HEIGHT - HEIGHT / nextZoom) / 2) + 64;
    return { x: Math.max(width / 2 - xRange, Math.min(width / 2 + xRange, position.x)),
      y: Math.max(HEIGHT / 2 - yRange, Math.min(HEIGHT / 2 + yRange, position.y)) };
  }

  function fit() {
    setZoom(1);
    setCenter({ x: width / 2, y: HEIGHT / 2 });
    drag.current = null;
  }

  function changeZoom(amount: number) {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round((zoom + amount) * 10) / 10));
    setZoom(next);
    setCenter(value => constrain(value, next));
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width:600px)');
    const resize = () => { setCompact(media.matches); setListOpen(media.matches); };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);

  useEffect(() => {
    setRelationId(null);
    setPage(selectedIndex < 0 ? 0 : Math.floor(selectedIndex / pageSize));
    fit();
  }, [version.id, connections, compact]);

  useEffect(() => {
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize));
  }, [selectedId, selectedIndex, pageSize]);

  useEffect(() => {
    if (relationId) relationPanel.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [relationId]);

  function select(id: string) {
    const index = ordered.findIndex(node => node.id === id);
    if (index < 0) return;
    const nextPage = Math.floor(index / pageSize);
    if (nextPage !== currentPage) { setPage(nextPage); fit(); }
    setRelationId(null);
    onSelect(id);
  }

  function revealFocusedObject(id: string) {
    const position = positions.get(id);
    if (!position) return;
    const halfWidth = width / zoom / 2;
    const halfHeight = HEIGHT / zoom / 2;
    // A keyboard user must never focus an object that the camera has clipped.
    if (position.x - 132 < center.x - halfWidth || position.x + 132 > center.x + halfWidth ||
        position.y - 104 < center.y - halfHeight || position.y + 130 > center.y + halfHeight) {
      setCenter(constrain(position));
    }
  }

  if (!version.nodes.length) return <div className="world-empty"><h3>No supported objects yet</h3><p>This notice has no extracted actions, events, or dates to explore. Read its original wording in the source view.</p></div>;

  return <div className={`world-view ${connections ? 'connection-view' : ''}`}>
    <div className="world-toolbar">
      <p>{connections ? `${edges.length} ${edges.length === 1 ? 'connection' : 'connections'}` : `${version.nodes.length} objects`}<span>{connections ? 'Trace a relationship to its source.' : 'Select an object to read its evidence.'}</span></p>
      <div className="world-camera" aria-label="World camera controls">
        <button type="button" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(-.2)}><Minus size={17}/></button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => changeZoom(.2)}><Plus size={17}/></button>
        <button type="button" aria-label="Fit objects in view" title="Fit view" onClick={fit}><Focus size={18}/></button>
      </div>
    </div>
    <svg ref={svg} className={`world-canvas ${zoom > 1 ? 'is-zoomed' : ''}`} viewBox={`${center.x - width / zoom / 2} ${center.y - HEIGHT / zoom / 2} ${width / zoom} ${HEIGHT / zoom}`}
      role="group" tabIndex={0} aria-label={connections ? 'Connections between supported facts' : 'Interactive notice world'} aria-describedby={`${instanceId}-help`}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const amount = 60 / zoom;
        const directions: Record<string, { x: number; y: number }> = {
          ArrowLeft: { x: -amount, y: 0 }, ArrowRight: { x: amount, y: 0 },
          ArrowUp: { x: 0, y: -amount }, ArrowDown: { x: 0, y: amount },
        };
        const direction = directions[event.key];
        if (direction) { event.preventDefault(); setCenter(value => constrain({ x: value.x + direction.x, y: value.y + direction.y })); }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(.2); }
        if (event.key === '-') { event.preventDefault(); changeZoom(-.2); }
        if (event.key === '0' || event.key === 'Home') { event.preventDefault(); fit(); }
      }}
      onPointerDown={event => {
        if (event.button !== 0 || drag.current || (event.target as Element).closest('[data-interactive]')) return;
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, centerX: center.x, centerY: center.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId || !svg.current) return;
        const rect = svg.current.getBoundingClientRect();
        const scale = Math.max(width / zoom / rect.width, HEIGHT / zoom / rect.height);
        setCenter(constrain({ x: drag.current.centerX - (event.clientX - drag.current.x) * scale,
          y: drag.current.centerY - (event.clientY - drag.current.y) * scale }));
      }}
      onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      <defs><pattern id={`${instanceId}-grid`} width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#c8cbd2" opacity=".6"/></pattern></defs>
      <rect x="-3000" y="-3000" width="6000" height="6000" fill={`url(#${instanceId}-grid)`}/>
      {!connections && <ellipse cx={width / 2} cy="330" rx={width / 2 - 30} ry="242" fill="#fff1df" opacity=".45"/>}
      {renderedEdges.map((edge, edgeIndex) => {
        const start = positions.get(edge.source)!;
        const end = positions.get(edge.target)!;
        const sameRow = start.y === end.y;
        const top = start.y < end.y;
        const startY = start.y + (sameRow || top ? 105 : -90);
        const endY = end.y + (sameRow || !top ? 105 : -90);
        const bend = sameRow ? start.y + 170 + (edgeIndex % 2) * 18 : (startY + endY) / 2;
        const path = `M${start.x} ${startY} C${start.x} ${bend},${end.x} ${bend},${end.x} ${endY}`;
        const active = activeEdge(edge);
        const label = edge.label.replaceAll('_', ' ');
        const labelWidth = Math.min(230, Math.max(100, label.length * 8 + 22));
        // Try several points on the actual curve. A crowded label stays in the
        // accessible connection list instead of covering another label or fact.
        const labelPosition = connections && (visibleEdges.length <= 5 || active) ? [.5, .68, .32, .82, .18].map(t => {
          const curveX = 3 * t * t - 2 * t * t * t;
          return { x: start.x + (end.x - start.x) * curveX,
            y: (1 - t) ** 3 * startY + 3 * (1 - t) * t * bend + t ** 3 * endY };
        }).find(point => {
          const box = { left: point.x - labelWidth / 2 - 5, right: point.x + labelWidth / 2 + 5, top: point.y - 20, bottom: point.y + 20 };
          const overlaps = (other: typeof box) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top;
          if (box.left < 10 || box.right > width - 10 || box.top < 10 || box.bottom > HEIGHT - 10 || labelBoxes.some(overlaps)) return false;
          if ([...positions.values()].some(position => overlaps({ left: position.x - 132, right: position.x + 132, top: position.y - 92, bottom: position.y + 106 }))) return false;
          labelBoxes.push(box);
          return true;
        }) : undefined;
        return <g key={edge.id} className={`world-edge ${active ? 'is-active' : ''} ${relationId === edge.id ? 'is-selected' : ''}`} data-interactive="edge" role="button" tabIndex={0} aria-pressed={relationId === edge.id}
          aria-label={`${label}: ${nodesById.get(edge.source)?.title} to ${nodesById.get(edge.target)?.title}. Read supporting passage.`}
          onFocus={() => { if (zoom > 1) fit(); }} onClick={() => setRelationId(edge.id)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setRelationId(edge.id); } }}>
          <path d={path} className="world-edge-hit"/><path d={path} className="world-road"/><path d={path} className="world-road-center"/>
          {labelPosition && <g transform={`translate(${labelPosition.x},${labelPosition.y})`}><rect x={-labelWidth / 2} y="-16" width={labelWidth} height="32" rx="8" className="world-edge-label-bg"/><text textAnchor="middle" y="5" className="world-edge-label">{label.length > 26 ? label.slice(0, 25) + '…' : label}</text></g>}
          <title>{label} — {edge.quote || 'See the connected facts for source context.'}</title>
        </g>;
      })}
      {visible.map(node => {
        const position = positions.get(node.id)!;
        const completed = completedIds.includes(node.id);
        const changed = changedIds.includes(node.id);
        const needsReview = node.status === 'needs_review';
        const selected = selectedId === node.id;
        return <g key={node.id} transform={`translate(${position.x},${position.y})`}>
          <g className={`world-object ${selected ? 'is-selected' : ''} ${completed ? 'is-complete' : ''}`} data-interactive="node" role="button" aria-pressed={selected}
            aria-label={`${names[node.kind]}, ${node.title}${needsReview ? ', evidence needs review' : ''}${completed ? ', completed' : ''}${changed ? ', new or changed in this version' : ''}`}
            tabIndex={0} onFocus={() => revealFocusedObject(node.id)} onClick={() => select(node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(node.id); } }}>
            <title>{node.title}{node.description ? ` — ${node.description}` : ''}</title>
            <rect x="-132" y="-100" width="264" height="235" fill="transparent"/>
            {connections ? <><rect className="world-card" x="-126" y="-86" width="252" height="186" rx="14"/><g transform="translate(-86,-31) scale(.42)"><ObjectShape kind={node.kind} completed={completed}/></g></> : <><ellipse className="world-halo" cx="0" cy="13" rx="83" ry="39"/><ellipse className="world-ground" cx="0" cy="12" rx="67" ry="29"/><ObjectShape kind={node.kind} completed={completed}/></>}
            <text className="world-kind" textAnchor="middle" x={connections ? 12 : 0} y={connections ? -44 : 65}>{names[node.kind]}</text>
            {labelLines(node.title, compact ? 21 : 23).map((line, index) => <text key={index} className="world-title" textAnchor="middle" y={(connections ? 18 : 92) + index * 25}>{line}</text>)}
            {(completed || changed || needsReview) && <g transform={`translate(${connections ? 103 : 44},${connections ? -74 : -57})`}><circle r="13" fill={needsReview || changed ? '#ffce79' : '#397449'}/><text textAnchor="middle" y="5" fill={needsReview || changed ? '#70410b' : 'white'} fontSize="16" fontWeight="700">{needsReview ? '!' : changed ? '↻' : '✓'}</text></g>}
          </g>
        </g>;
      })}
    </svg>
    <div className="world-bottom">
      <p id={`${instanceId}-help`}>{compact ? 'Swipe sideways to explore. Zoom for detail.' : 'Drag to pan · Arrow keys to move · 0 to fit'}</p>
      {totalPages > 1 && <div className="world-pages"><button type="button" aria-label="Previous objects" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setRelationId(null); fit(); }}><ChevronLeft size={17}/></button><span aria-live="polite">{currentPage + 1} / {totalPages}</span><button type="button" aria-label="Next objects" disabled={currentPage + 1 >= totalPages} onClick={() => { setPage(currentPage + 1); setRelationId(null); fit(); }}><ChevronRight size={17}/></button></div>}
    </div>
    {relation && <div ref={relationPanel} className="world-relation" role="status"><span className="world-relation-caption">CONNECTION EVIDENCE</span><strong>{relation.label.replaceAll('_', ' ')}</strong><p>{relation.quote || 'This connection groups facts from the same source.'}</p><div><button aria-label={`Inspect ${nodesById.get(relation.source)!.title}`} onClick={() => select(relation.source)}>Inspect first object</button><button aria-label={`Inspect ${nodesById.get(relation.target)!.title}`} onClick={() => select(relation.target)}>Inspect second object</button><button onClick={() => setRelationId(null)}>Close evidence</button></div></div>}
    {connections && <details className="world-connection-list">
      <summary>{edges.length ? `Read all ${edges.length} ${edges.length === 1 ? 'connection' : 'connections'}` : 'No supported connections in this version'}{offPageConnections > 0 && <small>{offPageConnections} outside this view</small>}</summary>
      {edges.length === 0 ? <p>Objects can be explored on their own. A connecting line appears only when the notice supports a relationship.</p> : <div>{edges.map(edge => <button key={edge.id} aria-pressed={relationId === edge.id} onClick={() => setRelationId(edge.id)}><strong>{edge.label.replaceAll('_', ' ')}</strong><span>{nodesById.get(edge.source)?.title}</span><span className="connection-target">{nodesById.get(edge.target)?.title}</span></button>)}</div>}
    </details>}
    <details className="world-object-list" open={listOpen} onToggle={event => setListOpen(event.currentTarget.open)}><summary>Browse all {version.nodes.length} objects</summary><div>{ordered.map(node => <button key={node.id} aria-pressed={selectedId === node.id} onClick={() => { select(node.id); fit(); }}><span className="object-list-kind">{names[node.kind]}</span><strong>{node.title}</strong><span className="object-list-meta">{node.status === 'needs_review' && <small className="needs-review">Evidence needs review</small>}{completedIds.includes(node.id) && <small>Completed</small>}{changedIds.includes(node.id) && <small>New or changed</small>}</span></button>)}</div></details>
  </div>;
}
