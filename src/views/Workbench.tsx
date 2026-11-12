import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Keyboard, Maximize2, Minus, Plus, Redo2, RotateCw, Search, Trash2, TriangleAlert, Undo2, X } from 'lucide-react';
import type { Live, Note, Part, PartType, Project, Rot } from '../types';
import { LED_COLORS, P, PARTS, PART_ORDER, formatOhms, isBoard, makePart, newId, pinPos, pivot, ref, toWorld } from '../parts/catalog';
import { PartArt, PartThumb } from '../parts/PartArt';

/** Change the project. `key` merges repeated edits (a drag, a slider) into one undo step; `skip` keeps it out of history. */
export type Update = (fn: (p: Project) => Project, opt?: { key?: string; skip?: boolean }) => void;

interface Props {
  project: Project;
  update: Update;
  running: boolean;
  seconds: number;
  live: Record<string, Live>;
  notes: Note[];
  voltageAt: (r: string) => number;
  onLearn: (t: PartType) => void;
  /** Changes whenever a different project is loaded, so the view can re-centre. */
  fitKey: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

interface View { x: number; y: number; k: number }
type Sel = { kind: 'part' | 'wire'; id: string } | null;

const WIRE_COLORS = ['#e5383b', '#22262e', '#f2801c', '#e9b400', '#1fa35b', '#2563eb', '#8b3fd9', '#f4f6f9'];
const RESISTORS = [100, 220, 330, 470, 1000, 2200, 4700, 10000, 100000];
const GROUPS = ['Boards', 'Basics', 'Inputs', 'Outputs', 'Sensors'] as const;
const snap = (v: number) => Math.round(v / P) * P;
const thumbPart = (t: PartType): Part => ({ id: t, type: t, x: 0, y: 0, rot: 0, props: PARTS[t].defaults });

function wirePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const sag = Math.min(34, d * 0.16);
  return `M${a.x} ${a.y}Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + sag} ${b.x} ${b.y}`;
}

export default function Workbench(props: Props) {
  const { project, update, running, seconds, live, notes, voltageAt, onLearn, fitKey, canUndo, canRedo, onUndo, onRedo } = props;
  const { parts, wires } = project;
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 1 });
  const [sel, setSel] = useState<Sel>(null);
  const [wiring, setWiring] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ type: PartType; x: number; y: number; over: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [help, setHelp] = useState(false);
  const dragSeq = useRef(0);
  const drag = useRef<
    | { kind: 'part'; id: string; dx: number; dy: number; key: string }
    | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
    | { kind: 'press'; id: string }
    | null
  >(null);

  const pinMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number; name: string; kind: string; part: Part }>();
    for (const part of parts) for (const p of PARTS[part.type].pins) m.set(ref(part.id, p.id), { ...pinPos(part, p), name: p.name, kind: p.kind, part });
    return m;
  }, [parts]);

  const toWorldPt = useCallback((cx: number, cy: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  }, [view]);

  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (!parts.length) { setView({ x: width / 2 - 200, y: height / 2 - 100, k: 1 }); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const part of parts) {
      const [bx0, by0, bx1, by1] = PARTS[part.type].box;
      for (const [lx, ly] of [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]]) {
        const w = toWorld(part, lx, ly);
        x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y);
      }
    }
    const pad = 64;
    const k = Math.min(1.8, Math.max(0.3, Math.min((width - pad * 2) / (x1 - x0), (height - pad * 2) / (y1 - y0))));
    setView({ k, x: (width - (x1 + x0) * k) / 2, y: (height - (y1 + y0) * k) / 2 });
  }, [parts]);

  // Re-centre when another project is opened.
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useLayoutEffect(() => { fitRef.current(); setSel(null); setWiring(null); }, [fitKey]);
  useEffect(() => { if (running) setWiring(null); }, [running]);
  // Forget a selection whose part or wire was removed (for example by undo).
  useEffect(() => {
    if (sel && !(sel.kind === 'part' ? parts.some(p => p.id === sel.id) : wires.some(w => w.id === sel.id))) setSel(null);
  }, [sel, parts, wires]);

  // ---- editing ----
  const removeSel = useCallback(() => {
    if (!sel || running) return;
    update(p => sel.kind === 'wire'
      ? { ...p, wires: p.wires.filter(w => w.id !== sel.id) }
      : { ...p, parts: p.parts.filter(x => x.id !== sel.id), wires: p.wires.filter(w => !w.from.startsWith(sel.id + ':') && !w.to.startsWith(sel.id + ':')) });
    setSel(null);
  }, [sel, running, update]);

  const rotateSel = useCallback(() => {
    if (!sel || sel.kind !== 'part' || running) return;
    update(p => ({ ...p, parts: p.parts.map(x => (x.id === sel.id ? { ...x, rot: ((x.rot + 90) % 360) as Rot } : x)) }));
  }, [sel, running, update]);

  const setProp = (id: string, key: string, value: number | string, opt?: { key?: string; skip?: boolean }) =>
    update(p => ({ ...p, parts: p.parts.map(x => (x.id === id ? { ...x, props: { ...x.props, [key]: value } } : x)) }), opt);

  /** Add a part with its centre at `at` (world coordinates), or in the middle of the view. */
  const addPart = (type: PartType, at?: { x: number; y: number }) => {
    if (running) return;
    const existing = parts.find(x => isBoard(x.type));
    if (isBoard(type) && existing) {
      // One board per project: swap it and drop wires to pins the new board lacks.
      const ok = new Set(PARTS[type].pins.map(q => ref(existing.id, q.id)));
      const mine = (r: string) => r.startsWith(existing.id + ':');
      update(p => ({
        ...p,
        parts: p.parts.map(x => (x.id === existing.id ? { ...x, type } : x)),
        wires: p.wires.filter(w => (!mine(w.from) || ok.has(w.from)) && (!mine(w.to) || ok.has(w.to))),
      }));
      setSel({ kind: 'part', id: existing.id });
      return;
    }
    const el = wrap.current!.getBoundingClientRect();
    const n = at ? 0 : parts.length % 5;
    const c = at ?? { x: (el.width / 2 - view.x) / view.k, y: (el.height / 2 - view.y) / view.k };
    const [px, py] = pivot(type);
    const part = makePart(type, snap(c.x - px + n * 24), snap(c.y - py + n * 24));
    update(p => ({ ...p, parts: [...p.parts, part] }));
    setSel({ kind: 'part', id: part.id });
  };

  /** Drag a part out of the drawer onto the workplane. A plain click adds it in the middle. */
  const startNew = (e: React.PointerEvent, type: PartType) => {
    if (running || e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const inside = (x: number, y: number) => { const r = wrap.current!.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
    const done = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', done);
      setGhost(null);
    };
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      moved = true;
      setGhost({ type, x: ev.clientX, y: ev.clientY, over: inside(ev.clientX, ev.clientY) });
    };
    const up = (ev: PointerEvent) => {
      done();
      if (!moved) addPart(type);
      else if (inside(ev.clientX, ev.clientY)) addPart(type, toWorldPt(ev.clientX, ev.clientY));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', done);
  };

  const finishWire = (to: string) => {
    const from = wiring!;
    setWiring(null);
    if (from === to) return;
    const a = pinMap.get(from), b = pinMap.get(to);
    if (!a || !b) return;
    const kind = (id: string, k: string) => (k === 'power' || /:(tp|bp)\d+$/.test(id) ? 'power' : k === 'ground' || /:(tn|bn)\d+$/.test(id) ? 'ground' : '');
    const kinds = [kind(from, a.kind), kind(to, b.kind)];
    const id = newId('w');
    update(p => {
      if (p.wires.some(w => (w.from === from && w.to === to) || (w.from === to && w.to === from))) return p;
      const color = kinds.includes('power') ? WIRE_COLORS[0] : kinds.includes('ground') ? WIRE_COLORS[1] : WIRE_COLORS[2 + (p.wires.length % 5)];
      return { ...p, wires: [...p.wires, { id, from, to, color }] };
    });
  };

  // ---- pointer handling ----
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const t = (e.target as Element).closest<SVGElement>('[data-pin],[data-wire],[data-part]');
    const w = toWorldPt(e.clientX, e.clientY);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (e.button === 1 || !t) {
      if (e.button === 0) { setSel(null); setWiring(null); }
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      return;
    }
    if (t.dataset.pin && !running) {
      if (wiring) finishWire(t.dataset.pin); else { setWiring(t.dataset.pin); setMouse(w); setSel(null); }
      return;
    }
    if (t.dataset.wire) { setSel({ kind: 'wire', id: t.dataset.wire }); setWiring(null); return; }
    const part = t.dataset.pin ? pinMap.get(t.dataset.pin)!.part : parts.find(p => p.id === t.dataset.part)!;
    setSel({ kind: 'part', id: part.id });
    setWiring(null);
    if (running) {
      if (part.type === 'button') { setProp(part.id, 'pressed', 1, { skip: true }); drag.current = { kind: 'press', id: part.id }; }
      return;
    }
    drag.current = { kind: 'part', id: part.id, dx: w.x - part.x, dy: w.y - part.y, key: `move:${++dragSeq.current}` };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (wiring) setMouse(toWorldPt(e.clientX, e.clientY));
    if (!d) return;
    if (d.kind === 'pan') setView(v => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
    if (d.kind === 'part') {
      const w = toWorldPt(e.clientX, e.clientY);
      const x = snap(w.x - d.dx), y = snap(w.y - d.dy);
      update(p => (p.parts.some(q => q.id === d.id && (q.x !== x || q.y !== y)) ? { ...p, parts: p.parts.map(q => (q.id === d.id ? { ...q, x, y } : q)) } : p), { key: d.key });
    }
  };

  const onUp = () => {
    const d = drag.current;
    if (d?.kind === 'press') setProp(d.id, 'pressed', 0, { skip: true });
    drag.current = null;
  };

  const onOver = (e: React.PointerEvent) => setHover((e.target as SVGElement).dataset?.pin ?? null);

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    setView(v => {
      const k = Math.min(4, Math.max(0.25, v.k * factor));
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) };
    });
  }, []);

  useEffect(() => {
    const el = wrap.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { setWiring(null); setSel(null); setHelp(false); }
      if (e.key === 'Delete' || e.key === 'Backspace') removeSel();
      if (e.key === 'r' || e.key === 'R') rotateSel();
      if (e.key === '?') setHelp(h => !h);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeSel, rotateSel]);

  const zoomButton = (f: number) => { const r = wrap.current!.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, f); };
  const zoomReset = () => { const r = wrap.current!.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / view.k); };

  const selPart = sel?.kind === 'part' ? parts.find(p => p.id === sel.id) : undefined;
  const selWire = sel?.kind === 'wire' ? wires.find(w => w.id === sel.id) : undefined;
  const noted = new Set(notes.map(n => n.partId));
  const hoverPin = hover ? pinMap.get(hover) : undefined;
  let dot = 24 * view.k;
  while (dot < 12) dot *= 2;

  const q = query.trim().toLowerCase();
  const matches = PART_ORDER.filter(t => !q || PARTS[t].name.toLowerCase().includes(q) || PARTS[t].blurb.toLowerCase().includes(q));

  const hint = running
    ? 'Press buttons on the workplane and move sliders in the inspector. Hover any pin to measure its voltage.'
    : wiring ? 'Click another pin to finish the wire. Esc cancels.'
    : selPart ? 'Drag to move. R rotates. Delete removes.'
    : selWire ? 'Pick a color in the inspector, or press Delete to remove the wire.'
    : 'Drag parts onto the workplane. Click any pin to start a wire.';

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* ---------- Parts drawer ---------- */}
      <aside className="flex shrink-0 flex-col border-b border-line bg-panel md:w-60 md:border-r md:border-b-0" aria-label="Parts">
        <div className="hidden p-3 pb-1 md:block">
          <label className="relative block">
            <span className="sr-only">Search parts</span>
            <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input className="field pl-8" placeholder="Search parts" value={query} onChange={e => setQuery(e.target.value)} />
          </label>
          <p className="mt-2 text-xs leading-relaxed text-muted">{running ? 'Stop the simulation to add parts.' : 'Drag a part onto the workplane, or click it to drop it in the middle.'}</p>
        </div>
        <div className="scroll-thin flex gap-1 overflow-auto p-2 md:block md:flex-1 md:px-3 md:pt-0 md:pb-3">
          {GROUPS.map(g => {
            const list = matches.filter(t => PARTS[t].group === g);
            if (!list.length) return null;
            return (
              <section key={g} className="flex shrink-0 gap-1 md:mt-3 md:block">
                <h2 className="mb-1 hidden px-1 font-sans text-xs font-semibold text-muted md:block">{g}</h2>
                <div className="flex gap-1 md:grid md:grid-cols-2">
                  {list.map(t => (
                    <button key={t} className="tile w-20 shrink-0 md:w-auto" disabled={running} title={PARTS[t].blurb}
                      onPointerDown={e => startNew(e, t)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addPart(t); } }}
                      aria-label={`Add ${PARTS[t].name}`}>
                      <span className="pointer-events-none grid h-12 w-full place-items-center"><PartThumb part={thumbPart(t)} size={44} /></span>
                      <span className="pointer-events-none">{PARTS[t].name}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          {!matches.length && <p className="p-2 text-sm text-muted">No parts match “{query}”.</p>}
        </div>
      </aside>

      {/* ---------- Workplane column ---------- */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex h-11 shrink-0 items-center gap-0.5 border-b border-line bg-panel px-2" role="toolbar" aria-label="Edit">
          <button className="tool" onClick={onUndo} disabled={!canUndo || running} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 size={17} /></button>
          <button className="tool" onClick={onRedo} disabled={!canRedo || running} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Redo2 size={17} /></button>
          <span className="mx-1.5 h-5 w-px bg-line" />
          <button className="tool" onClick={rotateSel} disabled={!selPart || running} aria-label="Rotate selected part" title="Rotate (R)"><RotateCw size={17} /></button>
          <button className="tool" onClick={removeSel} disabled={!sel || running} aria-label="Delete selection" title="Delete (Del)"><Trash2 size={17} /></button>
          <span className="ml-2 min-w-0 truncate text-sm text-muted">{selPart ? PARTS[selPart.type].name : selWire ? 'Wire' : ''}</span>
          <span className="flex-1" />
          <button className="tool" onClick={() => zoomButton(1 / 1.25)} aria-label="Zoom out" title="Zoom out"><Minus size={17} /></button>
          <button className="h-8 w-14 rounded-md text-center text-xs tabular-nums hover:bg-paper" onClick={zoomReset} title="Reset zoom to 100%">{Math.round(view.k * 100)}%</button>
          <button className="tool" onClick={() => zoomButton(1.25)} aria-label="Zoom in" title="Zoom in"><Plus size={17} /></button>
          <button className="tool" onClick={fit} aria-label="Fit circuit to screen" title="Fit to screen"><Maximize2 size={16} /></button>
        </div>

        {/* Workplane */}
        <div ref={wrap} className="workplane relative min-h-0 flex-1 overflow-hidden"
          style={{
            backgroundImage: 'radial-gradient(circle, #d4d4d8 1px, transparent 1.3px)',
            backgroundSize: `${dot}px ${dot}px`,
            backgroundPosition: `${view.x - dot / 2}px ${view.y - dot / 2}px`,
            cursor: wiring ? 'crosshair' : 'default',
            outline: ghost?.over ? '2px dashed #09090b' : undefined,
            outlineOffset: -6,
          }}>
          <svg className="absolute inset-0 h-full w-full" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerOver={onOver}
            role="application" aria-label="Circuit workplane">
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {parts.map(part => {
                const [cx, cy] = pivot(part.type);
                const [x0, y0, x1, y1] = PARTS[part.type].box;
                return (
                  <g key={part.id} data-part={part.id} transform={`translate(${part.x} ${part.y}) rotate(${part.rot} ${cx} ${cy})`}
                    style={{ cursor: running ? (part.type === 'button' ? 'pointer' : 'default') : 'grab' }}>
                    <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="transparent" />
                    <PartArt part={part} live={running ? live[part.id] : undefined} running={running} />
                    {sel?.id === part.id && (
                      <rect x={x0 - 5} y={y0 - 5} width={x1 - x0 + 10} height={y1 - y0 + 10} rx={6} fill="none" stroke="#09090b" strokeWidth={1.5 / view.k} strokeDasharray={`${5 / view.k} ${4 / view.k}`} pointerEvents="none" />
                    )}
                    {noted.has(part.id) && (
                      <g transform={`translate(${x1} ${y0})`} pointerEvents="none">
                        <circle r={8} fill="#09090b" stroke="#fff" strokeWidth={1.5} />
                        <text y={3.6} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: '#fff' }}>!</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {wires.map(w => {
                const a = pinMap.get(w.from), b = pinMap.get(w.to);
                if (!a || !b) return null;
                const d = wirePath(a, b);
                const on = sel?.id === w.id;
                return (
                  <g key={w.id} data-wire={w.id} style={{ cursor: 'pointer' }}>
                    <path d={d} stroke="transparent" strokeWidth={12} fill="none" />
                    <path d={d} stroke={on ? '#09090b' : 'rgb(0 0 0 / 0.35)'} strokeWidth={on ? 7 : 4.6} fill="none" strokeLinecap="round" />
                    <path d={d} stroke={w.color} strokeWidth={3.2} fill="none" strokeLinecap="round" />
                    <circle cx={a.x} cy={a.y} r={2.6} fill={w.color} stroke="rgb(0 0 0 / 0.5)" strokeWidth={0.8} />
                    <circle cx={b.x} cy={b.y} r={2.6} fill={w.color} stroke="rgb(0 0 0 / 0.5)" strokeWidth={0.8} />
                  </g>
                );
              })}

              {wiring && pinMap.get(wiring) && (
                <path d={wirePath(pinMap.get(wiring)!, mouse)} stroke="#09090b" strokeWidth={3} strokeDasharray="6 5" fill="none" strokeLinecap="round" pointerEvents="none" />
              )}

              {/* Pin targets sit on top so a wire can start anywhere */}
              <g style={{ cursor: running ? 'help' : 'crosshair' }}>
                {[...pinMap].map(([r, p]) => <circle key={r} data-pin={r} cx={p.x} cy={p.y} r={5} fill="transparent" />)}
              </g>
              {hoverPin && <circle cx={hoverPin.x} cy={hoverPin.y} r={5.5} fill="rgb(0 0 0 / 0.12)" stroke="#09090b" strokeWidth={1.4} pointerEvents="none" />}
            </g>
          </svg>

          {/* Pin tooltip, with a voltage reading while running */}
          {hoverPin && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white"
              style={{ left: hoverPin.x * view.k + view.x, top: hoverPin.y * view.k + view.y - 10 }}>
              {PARTS[hoverPin.part.type].name}: {hoverPin.name}
              {running && <span className="ml-2 font-mono font-semibold">{voltageAt(hover!).toFixed(2)} V</span>}
            </div>
          )}

          {!parts.length && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <p className="font-display text-2xl font-semibold">Start with a board</p>
                <p className="mt-1 text-sm text-muted">Drag an Arduino Uno and a breadboard in from the parts list.</p>
              </div>
            </div>
          )}

          {wiring && <div className="float absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 text-sm whitespace-nowrap">Click another pin to finish the wire</div>}

          {/* Things to check */}
          {running && notes.length > 0 && (
            <ul className="absolute bottom-3 left-3 flex max-w-sm flex-col gap-2" aria-live="polite">
              {notes.slice(0, 3).map((n, i) => (
                <li key={i} className="float flex gap-2 border-ink p-2.5 text-sm">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{n.text}</span>
                </li>
              ))}
            </ul>
          )}

          {selPart && (
            <Inspector part={selPart} running={running} live={live[selPart.id]} notes={notes.filter(n => n.partId === selPart.id)}
              volts={voltageAt} setProp={(k, v, opt) => setProp(selPart.id, k, v, opt)} onLearn={() => onLearn(selPart.type)} onClose={() => setSel(null)} />
          )}
          {selWire && !running && (
            <div className="float absolute top-3 right-3 w-64 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold">Wire</h3>
                <button className="tool -mt-1 -mr-1" onClick={() => setSel(null)} aria-label="Close"><X size={16} /></button>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">Color doesn’t change how it works. Red for power and black for ground keeps a circuit easy to read.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {WIRE_COLORS.map(c => (
                  <button key={c} aria-label={`Wire color ${c}`} aria-pressed={selWire.color === c}
                    onClick={() => update(p => ({ ...p, wires: p.wires.map(w => (w.id === selWire.id ? { ...w, color: c } : w)) }))}
                    className="h-7 w-7 rounded-full border border-line" style={{ background: c, outline: selWire.color === c ? '2px solid #09090b' : undefined, outlineOffset: 2 }} />
                ))}
              </div>
            </div>
          )}

          {help && <Shortcuts onClose={() => setHelp(false)} />}
        </div>

        {/* Status bar */}
        <div className="flex h-9 shrink-0 items-center gap-3 border-t border-line bg-panel px-3 text-xs">
          <span className="flex shrink-0 items-center gap-1.5 font-medium">
            <span className={`h-2 w-2 rounded-full ${running ? 'animate-pulse bg-ink' : 'border border-ink'}`} aria-hidden="true" />
            {running ? <>Running <span className="tabular-nums text-muted">{seconds.toFixed(1)} s</span></> : 'Editing'}
          </span>
          {running && notes.length > 0 && <span className="shrink-0 font-medium">{notes.length} {notes.length === 1 ? 'warning' : 'warnings'}</span>}
          <span className="min-w-0 flex-1 truncate text-muted">{hint}</span>
          <span className="hidden shrink-0 text-muted tabular-nums sm:inline">{parts.length} parts, {wires.length} wires</span>
          <button className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-muted hover:bg-paper hover:text-ink" onClick={() => setHelp(h => !h)} aria-expanded={help}>
            <Keyboard size={14} aria-hidden="true" /> <span className="hidden sm:inline">Shortcuts</span>
          </button>
        </div>
      </div>

      {ghost && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink bg-white/90 p-2 shadow-lg" style={{ left: ghost.x, top: ghost.y }}>
          <PartThumb part={thumbPart(ghost.type)} size={64} />
        </div>
      )}
    </div>
  );
}

function Shortcuts({ onClose }: { onClose: () => void }) {
  const rows: [string[], string][] = [
    [['Ctrl', 'Enter'], 'Start or stop the simulation'],
    [['Ctrl', 'Z'], 'Undo'],
    [['Ctrl', 'Shift', 'Z'], 'Redo'],
    [['R'], 'Rotate the selected part'],
    [['Del'], 'Delete the selection'],
    [['Esc'], 'Cancel a wire or clear the selection'],
    [['Scroll'], 'Zoom'],
    [['Drag'], 'Pan, from an empty spot'],
    [['?'], 'Show or hide this list'],
  ];
  return (
    <div className="float absolute right-3 bottom-3 z-20 w-80 p-4" role="dialog" aria-label="Keyboard shortcuts">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Keyboard shortcuts</h3>
        <button className="tool -mr-1" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <dl className="mt-2 flex flex-col gap-1.5 text-sm">
        {rows.map(([keys, what]) => (
          <div key={what} className="flex items-center justify-between gap-3">
            <dt className="text-muted">{what}</dt>
            <dd className="flex shrink-0 gap-1">{keys.map(k => <kbd key={k} className="kbd">{k}</kbd>)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, show, onChange }: { label: string; value: number; min: number; max: number; step?: number; show: string; onChange: (v: number) => void }) {
  return (
    <label className="mt-3 block text-sm">
      <span className="flex justify-between"><span className="font-medium">{label}</span><span className="tabular-nums text-muted">{show}</span></span>
      <input type="range" className="mt-1" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </label>
  );
}

function Inspector({ part, running, live, notes, volts, setProp, onLearn, onClose }: {
  part: Part; running: boolean; live?: Live; notes: Note[]; volts: (r: string) => number;
  setProp: (k: string, v: number | string, opt?: { key?: string; skip?: boolean }) => void; onLearn: () => void; onClose: () => void;
}) {
  const spec = PARTS[part.type];
  const v = (pin: string) => volts(ref(part.id, pin));
  const slide = (k: string) => (x: number) => setProp(k, x, { key: `prop:${part.id}:${k}` });
  const readout: string | null = !running ? null
    : part.type === 'led' ? `Brightness ${Math.round((live?.b ?? 0) * 100)}%`
    : part.type === 'potentiometer' ? `Middle pin ${v('W').toFixed(2)} V`
    : part.type === 'resistor' ? `${formatOhms(+part.props.ohms)}, ${Math.abs(v('1') - v('2')).toFixed(2)} V across it`
    : part.type === 'ldr' ? `${Math.abs(v('1') - v('2')).toFixed(2)} V across it`
    : part.type === 'servo' ? (live?.angle !== undefined ? `Arm at ${Math.round(live.angle)}°` : 'Waiting for a signal')
    : part.type === 'buzzer' ? (live?.hz ? `Playing ${Math.round(live.hz)} Hz` : 'Silent')
    : part.type === 'relay' ? (live?.on ? 'Switch closed' : 'Switch open')
    : part.type === 'battery' ? `${(v('+') - v('-')).toFixed(2)} V at the terminals`
    : null;

  return (
    <div className="float scroll-thin absolute top-3 right-3 max-h-[calc(100%-1.5rem)] w-72 overflow-auto p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-paper"><PartThumb part={part} size={40} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base leading-tight font-semibold">{spec.name}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{spec.blurb}</p>
        </div>
        <button className="tool -mt-1 -mr-1 shrink-0" onClick={onClose} aria-label="Close inspector"><X size={16} /></button>
      </div>

      {part.type === 'resistor' && !running && (
        <label className="mt-3 block text-sm font-medium">Resistance
          <select className="field mt-1 font-normal" value={+part.props.ohms} disabled={running} onChange={e => setProp('ohms', +e.target.value)}>
            {RESISTORS.map(o => <option key={o} value={o}>{formatOhms(o)}</option>)}
          </select>
        </label>
      )}
      {part.type === 'led' && !running && (
        <div className="mt-3 text-sm font-medium">Color
          <div className="mt-1.5 flex gap-2">
            {Object.entries(LED_COLORS).map(([name, c]) => (
              <button key={name} aria-label={name} title={name} aria-pressed={part.props.color === name} disabled={running} onClick={() => setProp('color', name)}
                className="h-7 w-7 rounded-full border border-line" style={{ background: c.hex, outline: part.props.color === name ? '2px solid #09090b' : undefined, outlineOffset: 2 }} />
            ))}
          </div>
        </div>
      )}
      {part.type === 'potentiometer' && <Slider label="Knob" value={+part.props.pos} min={0} max={1} step={0.01} show={`${Math.round(+part.props.pos * 100)}%`} onChange={slide('pos')} />}
      {part.type === 'ldr' && <Slider label="Light on the sensor" value={+part.props.lux} min={0} max={1000} step={5} show={+part.props.lux < 50 ? 'Dark' : +part.props.lux > 700 ? 'Bright' : 'Dim'} onChange={slide('lux')} />}
      {part.type === 'ultrasonic' && <Slider label="Object distance" value={+part.props.cm} min={2} max={200} show={`${part.props.cm} cm`} onChange={slide('cm')} />}
      {part.type === 'dht11' && (
        <>
          <Slider label="Temperature" value={+part.props.temp} min={0} max={50} show={`${part.props.temp} °C`} onChange={slide('temp')} />
          <Slider label="Humidity" value={+part.props.hum} min={20} max={90} show={`${part.props.hum}%`} onChange={slide('hum')} />
        </>
      )}
      {part.type === 'button' && <p className="mt-3 text-sm">{running ? 'Press and hold it on the workplane.' : 'Start the simulation, then press and hold it.'}</p>}

      {readout && <p className="mt-3 rounded-lg bg-paper px-3 py-2 font-mono text-sm font-medium tabular-nums">{readout}</p>}
      {notes.map((n, i) => (
        <p key={i} className="mt-3 flex gap-2 rounded-lg border border-ink px-3 py-2 text-sm"><TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{n.text}</p>
      ))}

      <button className="btn mt-4 w-full justify-center" onClick={onLearn}><Box size={15} /> See inside, in 3D</button>
    </div>
  );
}
