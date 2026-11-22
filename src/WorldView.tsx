import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Focus, Minus, Plus } from 'lucide-react';
import type { Fact, Relation, Version } from './domain';
import './world.css';

type Props = {
  version: Version;
  selectedId: string | null;
  onSelect: (id: string) => void;
  completedIds: string[];
  changedIds: string[];
  connections?: boolean;
};

const PAGE_SIZE = 8;
const WIDTH = 1000;
const HEIGHT = 640;
const names: Record<Fact['kind'], string> = {
  event: 'Event', action: 'Action', deadline: 'Deadline', requirement: 'Requirement',
  location: 'Location', question: 'Open question',
};

function labelLines(title: string) {
  const words = title.split(/\s+/);
  const lines: string[] = [''];
  for (const word of words) {
    const last = lines.length - 1;
    if ((lines[last] + ' ' + word).trim().length > 29 && lines[last]) lines.push(word);
    else lines[last] = (lines[last] + ' ' + word).trim();
  }
  return lines.slice(0, 2).map((line, index) => index === 1 && lines.length > 2 ? line.slice(0, 26) + '…' : line);
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
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: WIDTH / 2, y: HEIGHT / 2 });
  const [relation, setRelation] = useState<Relation | null>(null);
  const [listOpen, setListOpen] = useState(() => window.matchMedia('(max-width:600px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width:600px)');
    const resize = () => setListOpen(media.matches);
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; centerX: number; centerY: number } | null>(null);
  const patternId = useId().replace(/:/g, '');
  const totalPages = Math.max(1, Math.ceil(version.nodes.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = version.nodes.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const positions = useMemo(() => new Map(visible.map((node, index) => {
    const columns = visible.length > 6 ? 4 : 3;
    const row = Math.floor(index / columns);
    const count = Math.min(columns, visible.length - row * columns);
    return [node.id, { x: WIDTH / (count + 1) * (index % columns + 1), y: row === 0 ? 220 : 470 }];
  })), [version, currentPage]);
  const visibleEdges = version.edges.filter(edge => positions.has(edge.source) && positions.has(edge.target));

  useEffect(() => {
    setRelation(null);
    setPage(0);
    setZoom(1);
    setCenter({ x: WIDTH / 2, y: HEIGHT / 2 });
  }, [version.id, connections]);

  useEffect(() => {
    const index = version.nodes.findIndex(node => node.id === selectedId);
    if (index >= 0) setPage(Math.floor(index / PAGE_SIZE));
  }, [selectedId, version]);

  function select(id: string) {
    setRelation(null);
    const position = positions.get(id);
    if (position) {
      setCenter(position);
      setZoom(value => Math.max(1.15, value));
    }
    onSelect(id);
  }

  function fit() {
    setZoom(1);
    setCenter({ x: WIDTH / 2, y: HEIGHT / 2 });
  }

  if (!version.nodes.length) return <div className="world-empty"><h3>No supported objects yet</h3><p>This notice has no extracted actions, events, or dates to explore. Read its original wording in the source view.</p></div>;

  return <div className={`world-view ${connections ? 'connection-view' : ''}`}>
    <div className="world-toolbar">
      <p>{version.nodes.length} objects <span>· {connections ? 'Select a connection to inspect its source' : 'Drag the open space to explore'}</span></p>
      <div className="world-camera" aria-label="World camera controls">
        <button type="button" aria-label="Zoom out" disabled={zoom <= .65} onClick={() => setZoom(value => Math.max(.65, value - .2))}><Minus size={16}/></button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + .2))}><Plus size={16}/></button>
        <button type="button" aria-label="Fit objects in view" title="Fit view" onClick={fit}><Focus size={17}/></button>
      </div>
    </div>
    <svg ref={svg} className="world-canvas" viewBox={`${center.x - WIDTH / zoom / 2} ${center.y - HEIGHT / zoom / 2} ${WIDTH / zoom} ${HEIGHT / zoom}`}
      role="group" aria-label={connections ? 'Connections between supported facts' : 'Interactive notice world'}
      onPointerDown={event => {
        if (event.button !== 0 || (event.target as Element).closest('[data-interactive]')) return;
        drag.current = { x: event.clientX, y: event.clientY, centerX: center.x, centerY: center.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!drag.current || !svg.current) return;
        const rect = svg.current.getBoundingClientRect();
        const scale = Math.max(WIDTH / zoom / rect.width, HEIGHT / zoom / rect.height);
        setCenter({ x: drag.current.centerX - (event.clientX - drag.current.x) * scale, y: drag.current.centerY - (event.clientY - drag.current.y) * scale });
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <defs><pattern id={patternId} width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#c6c7b6" opacity=".6"/></pattern></defs>
      <rect x="-3000" y="-3000" width="6000" height="6000" fill={`url(#${patternId})`}/>
      {!connections && <ellipse cx="500" cy="335" rx="440" ry="247" fill="#e7ecdf" opacity=".5"/>}
      {visibleEdges.map(edge => {
        const start = positions.get(edge.source)!;
        const end = positions.get(edge.target)!;
        const path = `M${start.x} ${start.y + 10} C${start.x} ${(start.y + end.y) / 2 + 60},${end.x} ${(start.y + end.y) / 2 + 60},${end.x} ${end.y + 10}`;
        const active = selectedId === edge.source || selectedId === edge.target || relation?.id === edge.id;
        return <g key={edge.id} className={`world-edge ${active ? 'is-active' : ''}`} data-interactive="edge" role="button" tabIndex={0} aria-label={`${edge.label}: ${version.nodes.find(node => node.id === edge.source)?.title} to ${version.nodes.find(node => node.id === edge.target)?.title}`} onClick={() => setRelation(edge)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setRelation(edge); } }}>
          <path d={path} className="world-edge-hit"/>
          <path d={path} className="world-road"/>
          <path d={path} className="world-road-center"/>
          {connections && <g transform={`translate(${(start.x + end.x) / 2},${(start.y + end.y) / 2 + 35})`}><rect x="-55" y="-13" width="110" height="26" rx="13" fill="#fffdf4"/><text textAnchor="middle" y="4" className="world-edge-label">{edge.label.replaceAll('_', ' ')}</text></g>}
          <title>{edge.label.replaceAll('_', ' ')} — {edge.quote || 'See the connected facts for source context.'}</title>
        </g>;
      })}
      {visible.map(node => {
        const position = positions.get(node.id)!;
        const completed = completedIds.includes(node.id);
        const changed = changedIds.includes(node.id);
        const selected = selectedId === node.id;
        return <g key={node.id} transform={`translate(${position.x},${position.y})`}>
          <g className={`world-object ${selected ? 'is-selected' : ''} ${completed ? 'is-complete' : ''}`} data-interactive="node" role="button" aria-pressed={selected} aria-label={`${names[node.kind]}, ${node.title}${completed ? ', completed' : ''}${changed ? ', changed in this version' : ''}`} tabIndex={0} onClick={() => select(node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(node.id); } }}>
            <title>{node.description || node.title}</title>
            {connections ? <><rect className="world-card" x="-106" y="-74" width="212" height="155" rx="12"/><g transform="translate(-65,-8) scale(.42)"><ObjectShape kind={node.kind} completed={completed}/></g></> : <><ellipse className="world-halo" cx="0" cy="13" rx="83" ry="39"/><ellipse className="world-ground" cx="0" cy="12" rx="67" ry="29"/><ObjectShape kind={node.kind} completed={completed}/></>}
            <text className="world-kind" textAnchor="middle" y={connections ? -45 : 65}>{names[node.kind]}</text>
            {labelLines(node.title).map((line, index) => <text key={index} className="world-title" textAnchor="middle" y={(connections ? 27 : 87) + index * 19}>{line}</text>)}
            {(completed || changed || node.status === 'needs_review') && <g transform={`translate(${connections ? 77 : 44},${connections ? -53 : -57})`}><circle r="12" fill={completed ? '#66856b' : '#e8b668'}/><text textAnchor="middle" y="5" fill={completed ? 'white' : '#563a18'} fontSize="15" fontWeight="700">{completed ? '✓' : changed ? '↻' : '!'}</text></g>}
          </g>
        </g>;
      })}
    </svg>
    <div className="world-bottom">
      <p><span className="world-legend-dot"/> {connections ? 'Lines show source-linked relationships.' : 'Objects represent facts from this version.'}</p>
      {totalPages > 1 && <div className="world-pages"><button type="button" aria-label="Previous objects" disabled={currentPage === 0} onClick={() => { setPage(value => value - 1); fit(); }}><ChevronLeft size={16}/></button><span>{currentPage + 1} / {totalPages}</span><button type="button" aria-label="Next objects" disabled={currentPage + 1 >= totalPages} onClick={() => { setPage(value => value + 1); fit(); }}><ChevronRight size={16}/></button></div>}
    </div>
    {relation && <div className="world-relation" role="status"><strong>{relation.label.replaceAll('_', ' ')}</strong><p>{relation.quote || 'This connection groups facts from the same source.'}</p><div><button onClick={() => select(relation.source)}>Open source object</button><button onClick={() => select(relation.target)}>Open destination object</button><button onClick={() => setRelation(null)}>Close</button></div></div>}
    <details className="world-object-list" open={listOpen} onToggle={event => setListOpen(event.currentTarget.open)}><summary>Browse all objects as a list</summary><div>{version.nodes.map(node => <button key={node.id} aria-pressed={selectedId === node.id} onClick={() => { const index = version.nodes.findIndex(item => item.id === node.id); setPage(Math.floor(index / PAGE_SIZE)); fit(); setRelation(null); onSelect(node.id); }}><span>{names[node.kind]}</span>{node.title}{completedIds.includes(node.id) && <small>Completed</small>}{changedIds.includes(node.id) && <small>Changed</small>}</button>)}</div></details>
  </div>;
}
