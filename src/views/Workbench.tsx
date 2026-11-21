import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Box, ChevronDown, ChevronRight, Copy, Grid2x2, Keyboard, Lightbulb, Maximize2, Minus, MousePointerClick, Plus, Redo2, RotateCw, Search, Tag, Trash2, TriangleAlert, Undo2, X, Zap } from 'lucide-react';
import type { Live, Note, Part, PartType, Project, Rot } from '../types';
import { BOARDS, CAPACITORS, LED_COLORS, P, PARTS, PART_ORDER, designators, formatFarads, formatOhms, isBoard, makePart, newId, parseSI, partBounds, partValue, pinPos, pivot, ref, toWorld, wireGeom } from '../parts/catalog';
import { PartArt, PartThumb, WireArt } from '../parts/PartArt';
import BenchMat from '../parts/BenchMat';

/** Change the project. `key` merges repeated edits (a drag, a slider) into one undo step; `skip` keeps it out of history. */
export type Update = (fn: (p: Project) => Project, opt?: { key?: string; skip?: boolean }) => void;

interface Props {
  project: Project;
  update: Update;
  running: boolean;
  seconds: number;
  live: Record<string, Live>;
  /** Current in each wire while running, amps, positive from the wire's first end to its second. */
  flow: Record<string, number>;
  notes: Note[];
  voltageAt: (r: string) => number;
  onLearn: (t: PartType) => void;
  /** Changes whenever a different project is loaded, so the view can re-centre. */
  fitKey: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToast: (text: string) => void;
  onShortcuts: () => void;
  /** A part chosen in the command palette; `n` changes each time so the same part can be added twice. */
  addRequest: { type: PartType; n: number } | null;
  /** Progress through the starter's "things to try", shown as a chip that opens the guide. */
  guide: { done: number; total: number } | null;
  onOpenGuide: () => void;
}

interface View { x: number; y: number; k: number }
type Sel = { kind: 'part' | 'wire'; id: string } | null;

const WIRE_COLORS = ['#e5383b', '#22262e', '#f2801c', '#e9b400', '#1fa35b', '#2563eb', '#8b3fd9', '#f4f6f9'];
const RESISTORS = [100, 220, 330, 470, 1000, 2200, 4700, 10000, 100000];
const GROUPS = ['Boards', 'Basics', 'Chips', 'Inputs', 'Outputs', 'Sensors', 'Instruments'] as const;
const TIME_DIVS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const VOLT_DIVS = [0.5, 1, 2, 5];
const FLOW_PREF = 'xavierlabs_show_flow';
const MAT_PREF = 'xavierlabs_show_mat';
const LABEL_PREF = 'xavierlabs_show_labels';

/** Amps as a short readable string. */
function formatAmps(a: number) {
  const m = Math.abs(a);
  if (m >= 1) return `${m.toFixed(2)} A`;
  if (m >= 0.001) return `${(m * 1000).toFixed(m >= 0.1 ? 0 : 1)} mA`;
  return `${(m * 1e6).toFixed(0)} µA`;
}

/** How fast the flow dots move: slow for a trickle, fast for a big current. Steps keep the animation steady. */
function flowSeconds(amps: number) {
  const t = Math.log10(Math.max(1e-4, Math.abs(amps)) * 1000); // −1 at 0.1 mA, 2.7 at 500 mA
  const perSecond = Math.round((0.5 + 1.3 * (t + 1)) * 4) / 4;
  return 1 / Math.max(0.25, perSecond);
}
const snap = (v: number) => Math.round(v / P) * P;
const thumbPart = (t: PartType): Part => ({ id: t, type: t, x: 0, y: 0, rot: 0, props: PARTS[t].defaults });

/**
 * Which pins are joined by wires, breadboard strips and legs pushed into holes.
 * Shown while hovering, so students can see what a breadboard column really connects.
 */
function connections(parts: Part[], wires: { from: string; to: string }[]) {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) { const n = parent.get(c)!; parent.set(c, r); c = n; }
    return r;
  };
  const join = (a: string, b: string) => { if (parent.has(a) && parent.has(b)) { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); } };
  const holes = new Map<string, string>();
  const key = (x: number, y: number) => `${Math.round(x / 4)},${Math.round(y / 4)}`;
  for (const part of parts) {
    const strips = new Map<string, string>();
    for (const pin of PARTS[part.type].pins) {
      const r = ref(part.id, pin.id);
      parent.set(r, r);
      if (pin.strip) { const first = strips.get(pin.strip); if (first) join(r, first); else strips.set(pin.strip, r); }
      if (part.type === 'breadboard') { const w = pinPos(part, pin); holes.set(key(w.x, w.y), r); }
    }
  }
  for (const part of parts) {
    if (part.type === 'breadboard') continue;
    for (const pin of PARTS[part.type].pins) {
      const w = pinPos(part, pin);
      const hole = holes.get(key(w.x, w.y));
      if (hole) join(ref(part.id, pin.id), hole);
    }
  }
  for (const w of wires) join(w.from, w.to);
  const members = new Map<string, string[]>();
  for (const r of parent.keys()) { const root = find(r); const list = members.get(root); if (list) list.push(r); else members.set(root, [r]); }
  return { group: (r: string) => (parent.has(r) ? members.get(find(r)) ?? [r] : [r]) };
}

const FG = { stroke: 'var(--fg)' } as const;

export default function Workbench(props: Props) {
  const { project, update, running, seconds, live, flow, notes, voltageAt, onLearn, fitKey, canUndo, canRedo, onUndo, onRedo, onToast, onShortcuts, addRequest, guide, onOpenGuide } = props;
  const { parts, wires } = project;
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 1 });
  const [sel, setSel] = useState<Sel>(null);
  const [wiring, setWiring] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ type: PartType; x: number; y: number; over: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const [hoverWire, setHoverWire] = useState<{ id: string; x: number; y: number } | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(true);
  const [showFlow, setShowFlow] = useState(() => { try { return localStorage.getItem(FLOW_PREF) !== '0'; } catch { return true; } });
  const [showMat, setShowMat] = useState(() => { try { return localStorage.getItem(MAT_PREF) !== '0'; } catch { return true; } });
  const [showLabels, setShowLabels] = useState(() => { try { return localStorage.getItem(LABEL_PREF) !== '0'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem(FLOW_PREF, showFlow ? '1' : '0'); } catch { /* ignore */ } }, [showFlow]);
  useEffect(() => { try { localStorage.setItem(MAT_PREF, showMat ? '1' : '0'); } catch { /* ignore */ } }, [showMat]);
  useEffect(() => { try { localStorage.setItem(LABEL_PREF, showLabels ? '1' : '0'); } catch { /* ignore */ } }, [showLabels]);
  const dragSeq = useRef(0);
  const drag = useRef<
    | { kind: 'part'; id: string; dx: number; dy: number; key: string }
    | { kind: 'bend'; id: string; base: { x: number; y: number }; key: string }
    | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
    | { kind: 'press'; id: string }
    | null
  >(null);

  const pinMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number; name: string; kind: string; part: Part }>();
    for (const part of parts) for (const p of PARTS[part.type].pins) m.set(ref(part.id, p.id), { ...pinPos(part, p), name: p.name, kind: p.kind, part });
    return m;
  }, [parts]);

  const nets = useMemo(() => connections(parts, wires), [parts, wires]);

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
    const pad = 72;
    const k = Math.min(1.8, Math.max(0.3, Math.min((width - pad * 2) / (x1 - x0), (height - pad * 2) / (y1 - y0))));
    setView({ k, x: (width - (x1 + x0) * k) / 2, y: (height - (y1 + y0) * k) / 2 });
  }, [parts]);

  // Re-centre when another project is opened.
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useLayoutEffect(() => { fitRef.current(); setSel(null); setWiring(null); setHoverWire(null); }, [fitKey]);
  useEffect(() => { if (running) { setWiring(null); setIssuesOpen(true); } }, [running]);
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

  const duplicateSel = useCallback(() => {
    if (!sel || sel.kind !== 'part' || running) return;
    const src = parts.find(p => p.id === sel.id);
    if (!src || isBoard(src.type)) return;
    const copy = { ...makePart(src.type, src.x + 24, src.y + 24, src.props), rot: src.rot };
    update(p => ({ ...p, parts: [...p.parts, copy] }));
    setSel({ kind: 'part', id: copy.id });
  }, [sel, running, parts, update]);

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
      const dropped = wires.filter(w => (mine(w.from) && !ok.has(w.from)) || (mine(w.to) && !ok.has(w.to))).length;
      if (existing.type !== type) onToast(`Swapped the board for an ${PARTS[type].name}.${dropped ? ` Removed ${dropped} wire${dropped === 1 ? '' : 's'} to pins it doesn’t have.` : ''}`);
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

  // Parts picked in the command palette arrive here.
  const addRef = useRef(addPart);
  addRef.current = addPart;
  const lastAdd = useRef<number | null>(null);
  useEffect(() => {
    if (!addRequest || addRequest.n === lastAdd.current) return;
    lastAdd.current = addRequest.n;
    addRef.current(addRequest.type);
  }, [addRequest]);

  /** Drag a part out of the library onto the workplane. A plain click adds it in the middle. */
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
    const t = (e.target as Element).closest<SVGElement>('[data-bend],[data-pin],[data-wire],[data-part]');
    const w = toWorldPt(e.clientX, e.clientY);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (e.button === 1 || !t) {
      if (e.button === 0) { setSel(null); setWiring(null); }
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      return;
    }
    if (t.dataset.bend && !running) {
      const wire = wires.find(x => x.id === t.dataset.bend);
      if (wire) {
        const a = pinMap.get(wire.from), b = pinMap.get(wire.to);
        if (a && b) {
          setSel({ kind: 'wire', id: wire.id });
          drag.current = { kind: 'bend', id: wire.id, base: wireGeom(a, b).mid, key: `bend:${++dragSeq.current}` };
        }
      }
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
      if (part.type === 'switch') setProp(part.id, 'pos', part.props.pos ? 0 : 1);
      return;
    }
    drag.current = { kind: 'part', id: part.id, dx: w.x - part.x, dy: w.y - part.y, key: `move:${++dragSeq.current}` };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (hoverWire && running) { const r = wrap.current!.getBoundingClientRect(); setHoverWire({ ...hoverWire, x: e.clientX - r.left, y: e.clientY - r.top }); }
    if (wiring) setMouse(toWorldPt(e.clientX, e.clientY));
    if (!d) return;
    if (d.kind === 'pan') setView(v => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
    if (d.kind === 'part') {
      const w = toWorldPt(e.clientX, e.clientY);
      const x = snap(w.x - d.dx), y = snap(w.y - d.dy);
      update(p => (p.parts.some(q => q.id === d.id && (q.x !== x || q.y !== y)) ? { ...p, parts: p.parts.map(q => (q.id === d.id ? { ...q, x, y } : q)) } : p), { key: d.key });
    }
    if (d.kind === 'bend') {
      const w = toWorldPt(e.clientX, e.clientY);
      const bx = Math.round(w.x - d.base.x), by = Math.round(w.y - d.base.y);
      const bend: [number, number] | undefined = Math.hypot(bx, by) < 4 ? undefined : [bx, by];
      update(p => ({ ...p, wires: p.wires.map(q => (q.id === d.id ? { ...q, bend } : q)) }), { key: d.key });
    }
  };

  const onUp = () => {
    const d = drag.current;
    if (d?.kind === 'press') setProp(d.id, 'pressed', 0, { skip: true });
    drag.current = null;
  };

  const onOver = (e: React.PointerEvent) => {
    const el = e.target as SVGElement;
    setHover(el.dataset?.pin ?? null);
    const wire = el.closest<SVGElement>('[data-wire]')?.dataset.wire;
    if (!wire) { if (hoverWire) setHoverWire(null); return; }
    const r = wrap.current!.getBoundingClientRect();
    setHoverWire({ id: wire, x: e.clientX - r.left, y: e.clientY - r.top });
  };

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
      setHoverWire(null);
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { setWiring(null); setSel(null); }
      if (e.key === 'Delete' || e.key === 'Backspace') removeSel();
      if (e.key === 'r' || e.key === 'R') rotateSel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeSel, rotateSel, duplicateSel]);

  const zoomButton = (f: number) => { const r = wrap.current!.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, f); };
  const zoomReset = () => { const r = wrap.current!.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / view.k); };

  const selPart = sel?.kind === 'part' ? parts.find(p => p.id === sel.id) : undefined;
  const selWire = sel?.kind === 'wire' ? wires.find(w => w.id === sel.id) : undefined;
  const refs = useMemo(() => designators(parts), [parts]);
  const mat = useMemo(() => {
    let x0 = -180, y0 = -140, x1 = 1720, y1 = 860;
    for (const p of parts) {
      const b = partBounds(p);
      x0 = Math.min(x0, Math.floor((b.x0 - 180) / 60) * 60);
      y0 = Math.min(y0, Math.floor((b.y0 - 140) / 60) * 60);
      x1 = Math.max(x1, Math.ceil((b.x1 + 180) / 60) * 60);
      y1 = Math.max(y1, Math.ceil((b.y1 + 320) / 60) * 60);
    }
    return { x0, y0, x1: Math.max(x1, x0 + 1900), y1: Math.max(y1, y0 + 960) };
  }, [parts]);
  const noted = new Set(notes.map(n => n.partId));
  const hoverPin = hover ? pinMap.get(hover) : undefined;
  const joined = hover ? nets.group(hover).filter(r => r !== hover) : [];
  const joinedParts = joined.filter(r => pinMap.get(r)?.part.type !== 'breadboard');
  const joinedText = !hoverPin ? '' : joinedParts.length
    ? `Joined to ${joinedParts.slice(0, 3).map(r => { const q = pinMap.get(r)!; return `${PARTS[q.part.type].name} ${q.name}`; }).join(', ')}${joinedParts.length > 3 ? ` and ${joinedParts.length - 3} more` : ''}`
    : joined.length ? `Joined to ${joined.length} other hole${joined.length === 1 ? '' : 's'}` : 'Not connected to anything';
  const board = parts.find(p => isBoard(p.type));
  let dot = 24 * view.k;
  while (dot < 12) dot *= 2;

  const q = query.trim().toLowerCase();
  const matches = PART_ORDER.filter(t => !q || PARTS[t].name.toLowerCase().includes(q) || PARTS[t].blurb.toLowerCase().includes(q));

  const hint = running
    ? 'Click buttons and switches. Hover a pin for its voltage, a wire for its current.'
    : wiring ? 'Click another pin to finish the wire. Esc cancels.'
    : selPart ? 'Drag to move. R rotates, Delete removes.'
    : selWire ? 'Pick a color, or press Delete to remove the wire.'
    : 'Drag parts in from the library. Click any pin to start a wire.';

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* ---------- Parts library ---------- */}
      <aside className="flex shrink-0 flex-col border-b border-line bg-surface md:w-[252px] md:border-r md:border-b-0" aria-label="Parts library">
        <div className="hidden h-10 shrink-0 items-center justify-between border-b border-line px-3 md:flex">
          <h2 className="text-[13px] font-semibold">Parts</h2>
          <span className="text-[12px] text-fg-3 tabular-nums">{PART_ORDER.length}</span>
        </div>
        <div className="hidden p-2.5 md:block">
          <label className="relative block">
            <span className="sr-only">Search parts</span>
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-3" aria-hidden="true" />
            <input className="input pl-8" placeholder="Search parts" value={query} onChange={e => setQuery(e.target.value)} />
          </label>
        </div>
        <div className="scroll flex gap-1 overflow-auto p-2 md:block md:flex-1 md:px-2.5 md:pt-0 md:pb-3">
          {running && <p className="mb-2 hidden rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[12px] text-fg-2 md:block">Stop the simulation to add or move parts.</p>}
          {GROUPS.map(g => {
            const list = matches.filter(t => PARTS[t].group === g);
            if (!list.length) return null;
            const isClosed = closed.includes(g) && !q;
            return (
              <section key={g} className="flex shrink-0 gap-1 md:mb-1 md:block">
                <button className="hidden h-8 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-[12px] font-semibold text-fg-2 hover:text-fg md:flex"
                  onClick={() => setClosed(c => (c.includes(g) ? c.filter(x => x !== g) : [...c, g]))} aria-expanded={!isClosed}>
                  {isClosed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span className="flex-1">{g}</span>
                  <span className="font-normal text-fg-3 tabular-nums">{list.length}</span>
                </button>
                {!isClosed && (
                  <div className="flex gap-1 md:grid md:grid-cols-3 md:gap-0.5 md:pb-1">
                    {list.map(t => (
                      <button key={t} className="tile w-[72px] shrink-0 md:w-auto" disabled={running} data-tip={PARTS[t].name}
                        onPointerDown={e => startNew(e, t)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addPart(t); } }}
                        aria-label={`Add ${PARTS[t].name}`}>
                        <span className="tile-art pointer-events-none"><PartThumb part={thumbPart(t)} size={40} /></span>
                        <span className="pointer-events-none line-clamp-2 w-full">{PARTS[t].name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {!matches.length && <p className="px-2 py-4 text-center text-fg-3">No parts match “{query}”.</p>}
        </div>
      </aside>

      {/* ---------- Canvas column ---------- */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-surface px-2" role="toolbar" aria-label="Edit">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onUndo} disabled={!canUndo || running} aria-label="Undo" data-tip="Undo  Ctrl Z"><Undo2 size={15} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onRedo} disabled={!canRedo || running} aria-label="Redo" data-tip="Redo  Ctrl Shift Z"><Redo2 size={15} /></button>
          <span className="divider-v mx-1" />
          <button className="btn btn-ghost btn-sm btn-icon" onClick={rotateSel} disabled={!selPart || running} aria-label="Rotate" data-tip="Rotate  R"><RotateCw size={15} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={duplicateSel} disabled={!selPart || isBoard(selPart.type) || running} aria-label="Duplicate" data-tip="Duplicate  Ctrl D"><Copy size={14} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={removeSel} disabled={!sel || running} aria-label="Delete" data-tip="Delete  Del"><Trash2 size={15} /></button>
          {(selPart || selWire) && <span className="chip ml-1.5 hidden sm:inline-flex">{selPart ? PARTS[selPart.type].name : 'Wire'}</span>}
          <span className="flex-1" />
          <button className="btn btn-ghost btn-sm" onClick={() => setShowMat(m => !m)} aria-pressed={showMat} data-tip="Toggle anti-static reference mat">
            <Grid2x2 size={14} aria-hidden="true" /> <span className="hidden lg:inline">Mat</span>
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowLabels(l => !l)} aria-pressed={showLabels} data-tip="Show part designators and values">
            <Tag size={14} aria-hidden="true" /> <span className="hidden lg:inline">Labels</span>
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowFlow(f => !f)} aria-pressed={showFlow} data-tip="Show current flowing while running">
            <Zap size={14} aria-hidden="true" /> <span className="hidden lg:inline">Current</span>
          </button>
          <span className="divider-v mx-1" />
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => zoomButton(1 / 1.25)} aria-label="Zoom out" data-tip="Zoom out"><Minus size={15} /></button>
          <button className="btn btn-ghost btn-sm w-14 font-mono text-[11.5px] tabular-nums" onClick={zoomReset} data-tip="Reset zoom">{Math.round(view.k * 100)}%</button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => zoomButton(1.25)} aria-label="Zoom in" data-tip="Zoom in"><Plus size={15} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={fit} aria-label="Fit to screen" data-tip="Fit to screen" data-tip-pos="left"><Maximize2 size={14} /></button>
        </div>

        {/* Workplane */}
        <div ref={wrap} className="workplane relative min-h-0 flex-1 overflow-hidden"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--grid) 1px, transparent 1.3px)',
            backgroundSize: `${dot}px ${dot}px`,
            backgroundPosition: `${view.x - dot / 2}px ${view.y - dot / 2}px`,
            cursor: wiring ? 'crosshair' : 'default',
            boxShadow: ghost?.over ? 'inset 0 0 0 2px var(--fg-3)' : undefined,
          }}>
          <svg className="absolute inset-0 h-full w-full" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerOver={onOver}
            onPointerLeave={() => { setHover(null); setHoverWire(null); }}
            role="application" aria-label="Circuit workplane">
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {showMat && <BenchMat x0={mat.x0} y0={mat.y0} x1={mat.x1} y1={mat.y1} />}
              {parts.map(part => {
                const [cx, cy] = pivot(part.type);
                const [x0, y0, x1, y1] = PARTS[part.type].box;
                return (
                  <g key={part.id} filter={part.type === 'breadboard' ? undefined : 'url(#xl-lift)'}>
                    <g data-part={part.id} transform={`translate(${part.x} ${part.y}) rotate(${part.rot} ${cx} ${cy})`}
                      style={{ cursor: running ? (part.type === 'button' || part.type === 'switch' ? 'pointer' : 'default') : 'grab' }}>
                      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="transparent" />
                      <PartArt part={part} live={running ? live[part.id] : undefined} running={running} />
                      {sel?.id === part.id && (
                        <rect x={x0 - 5} y={y0 - 5} width={x1 - x0 + 10} height={y1 - y0 + 10} rx={6} fill="none" style={FG} strokeWidth={1.5 / view.k} strokeDasharray={`${5 / view.k} ${4 / view.k}`} pointerEvents="none" />
                      )}
                      {noted.has(part.id) && (
                        <g transform={`translate(${x1} ${y0})`} pointerEvents="none">
                          <circle r={8} style={{ fill: 'var(--warn)', stroke: 'var(--canvas)' }} strokeWidth={2} />
                          <text y={3.8} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: '#0a0a0c', fontFamily: 'Geist, sans-serif' }}>!</text>
                        </g>
                      )}
                    </g>
                  </g>
                );
              })}

              {showLabels && parts.map(part => {
                if (part.type === 'breadboard') return null;
                const b = partBounds(part);
                const tag = refs.get(part.id) ?? '';
                const val = part.type === 'resistor' || part.type === 'capacitor' ? ` ${partValue(part)}` : '';
                return (
                  <text key={`lbl-${part.id}`} x={(b.x0 + b.x1) / 2} y={b.y0 - 5} textAnchor="middle" pointerEvents="none"
                    style={{ fontSize: 8.5, fontWeight: 600, fontFamily: '"Geist Mono", monospace', fill: 'var(--fg-2)' }}>
                    {tag}{val}
                  </text>
                );
              })}

              {wires.map(w => {
                const a = pinMap.get(w.from), b = pinMap.get(w.to);
                if (!a || !b) return null;
                const g = wireGeom(a, b, w.bend);
                const on = sel?.id === w.id;
                return (
                  <g key={w.id} data-wire={w.id} style={{ cursor: 'pointer' }}>
                    <path d={g.d} stroke="transparent" strokeWidth={12} fill="none" />
                    <WireArt a={a} b={b} bend={w.bend} color={w.color} selected={on} />
                    {on && !running && (
                      <circle data-bend={w.id} cx={g.mid.x} cy={g.mid.y} r={5.5 / view.k}
                        style={{ fill: 'var(--surface)', stroke: 'var(--fg)', cursor: 'move' }} strokeWidth={1.6 / view.k} />
                    )}
                  </g>
                );
              })}

              {running && showFlow && wires.map(w => {
                const amps = flow[w.id] ?? 0;
                if (Math.abs(amps) < 1e-4) return null;
                const a = pinMap.get(w.from), b = pinMap.get(w.to);
                if (!a || !b) return null;
                const d = wireGeom(a, b, w.bend).d;
                const style = { animationDuration: `${flowSeconds(amps).toFixed(2)}s`, animationDirection: amps > 0 ? 'normal' : 'reverse' } as const;
                return (
                  <g key={`flow-${w.id}`} pointerEvents="none">
                    <path d={d} className="xl-flow" stroke="rgb(0 0 0 / 0.45)" strokeWidth={3.2} strokeDasharray="2.6 9.4" strokeLinecap="round" fill="none" style={style} />
                    <path d={d} className="xl-flow" stroke="#fff" strokeWidth={1.8} strokeDasharray="2.6 9.4" strokeLinecap="round" fill="none" style={style} />
                  </g>
                );
              })}

              {wiring && pinMap.get(wiring) && (
                <path d={wireGeom(pinMap.get(wiring)!, mouse).d} style={FG} strokeWidth={2.5} strokeDasharray="6 5" fill="none" strokeLinecap="round" pointerEvents="none" />
              )}

              {/* Pin targets sit on top so a wire can start anywhere */}
              <g style={{ cursor: running ? 'help' : 'crosshair' }}>
                {[...pinMap].map(([r, p]) => <circle key={r} data-pin={r} cx={p.x} cy={p.y} r={5} fill="transparent" />)}
              </g>
              {joined.map(r => { const pp = pinMap.get(r); return pp ? <circle key={r} cx={pp.x} cy={pp.y} r={4.6} style={{ fill: 'color-mix(in srgb, var(--canvas) 45%, transparent)', stroke: 'var(--fg)' }} strokeWidth={1.6} pointerEvents="none" /> : null; })}
              {hoverPin && <circle cx={hoverPin.x} cy={hoverPin.y} r={5.5} style={{ fill: 'color-mix(in srgb, var(--fg) 18%, transparent)', stroke: 'var(--fg)' }} strokeWidth={1.4} pointerEvents="none" />}
            </g>
          </svg>

          {/* Pin tooltip, with a voltage reading while running */}
          {hoverPin && (
            <div className="popover pointer-events-none absolute z-10 max-w-80 -translate-x-1/2 -translate-y-full px-2.5 py-1.5 text-[12px]"
              style={{ left: hoverPin.x * view.k + view.x, top: hoverPin.y * view.k + view.y - 12 }}>
              <span className="flex items-baseline gap-2 font-medium whitespace-nowrap">
                {PARTS[hoverPin.part.type].name}: {hoverPin.name}
                {running && <span className="font-mono text-fg">{voltageAt(hover!).toFixed(2)} V</span>}
              </span>
              <span className="block text-fg-3">{joinedText}</span>
            </div>
          )}

          {running && hoverWire && !hoverPin && !drag.current && (() => {
            const w = wires.find(x => x.id === hoverWire.id);
            if (!w) return null;
            const amps = flow[w.id] ?? 0;
            const a = pinMap.get(w.from), b = pinMap.get(w.to);
            const name = (pp?: { name: string; part: Part }) => (pp ? `${PARTS[pp.part.type].name} ${pp.name}` : '');
            const [src, dst] = amps >= 0 ? [a, b] : [b, a];
            return (
              <div className="popover pointer-events-none absolute z-10 max-w-72 -translate-x-1/2 -translate-y-full px-2.5 py-1.5 text-[12px]"
                style={{ left: hoverWire.x, top: hoverWire.y - 14 }}>
                <span className="block font-mono font-medium">{Math.abs(amps) < 1e-5 ? 'No current' : formatAmps(amps)}</span>
                {Math.abs(amps) >= 1e-5 && <span className="block text-fg-3">from {name(src)} to {name(dst)}</span>}
              </div>
            );
          })()}

          {!parts.length && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
              <div className="max-w-xs">
                <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface text-fg-2"><MousePointerClick size={18} /></span>
                <p className="text-[15px] font-semibold">Start with a board</p>
                <p className="mt-1 text-fg-2">Drag an Arduino Uno and a breadboard in from the library, or press Ctrl K to search.</p>
              </div>
            </div>
          )}

          {wiring && <div className="popover absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 text-[12.5px] whitespace-nowrap">Click another pin to finish the wire <span className="kbd ml-2">Esc</span></div>}

          {/* Bottom left: issues while running, otherwise the guide chip */}
          {running && notes.length > 0 ? (
            <div className="popover absolute bottom-3 left-3 w-[360px] max-w-[calc(100%-1.5rem)] overflow-hidden" aria-live="polite">
              <button className="flex h-9 w-full items-center gap-2 px-3 text-left text-[12.5px] font-semibold" onClick={() => setIssuesOpen(o => !o)} aria-expanded={issuesOpen}>
                <TriangleAlert size={14} className="text-warn" aria-hidden="true" />
                <span className="flex-1">{notes.length} {notes.length === 1 ? 'issue' : 'issues'} to check</span>
                <ChevronDown size={14} className={`text-fg-3 transition-transform ${issuesOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
              </button>
              {issuesOpen && (
                <ul className="scroll max-h-56 overflow-auto border-t border-line">
                  {notes.slice(0, 6).map((n, i) => (
                    <li key={i} className="border-b border-line px-3 py-2 text-[12.5px] leading-relaxed text-fg-2 last:border-b-0">{n.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : guide && !wiring ? (
            <button className="popover absolute bottom-3 left-3 flex h-9 items-center gap-2 px-3 text-[12.5px] font-medium hover:bg-surface-2" onClick={onOpenGuide}>
              <Lightbulb size={14} className="text-fg-2" aria-hidden="true" />
              Things to try
              <span className="font-mono text-[11.5px] text-fg-3">{guide.done}/{guide.total}</span>
              <ChevronRight size={14} className="text-fg-3" aria-hidden="true" />
            </button>
          ) : null}

          {selPart && (
            <Inspector key={selPart.id} part={selPart} designator={refs.get(selPart.id) ?? ''} running={running} live={live[selPart.id]} notes={notes.filter(n => n.partId === selPart.id)}
              volts={voltageAt} setProp={(k, v, opt) => setProp(selPart.id, k, v, opt)} onLearn={() => onLearn(selPart.type)} onClose={() => setSel(null)} />
          )}
          {selWire && !running && (
            <div className="popover absolute top-3 right-3 z-20 w-[272px] overflow-hidden">
              <div className="flex h-11 items-center justify-between border-b border-line px-3">
                <h3 className="text-[13px] font-semibold">Wire</h3>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSel(null)} aria-label="Close"><X size={15} /></button>
              </div>
              <div className="space-y-3 p-3">
                <div>
                  <span className="label">Color</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WIRE_COLORS.map(c => (
                      <button key={c} aria-label={`Wire color ${c}`} aria-pressed={selWire.color === c}
                        onClick={() => update(p => ({ ...p, wires: p.wires.map(w => (w.id === selWire.id ? { ...w, color: c } : w)) }))}
                        className="h-6 w-6 rounded-full" style={{ background: c, boxShadow: selWire.color === c ? '0 0 0 2px var(--surface), 0 0 0 4px var(--fg)' : 'inset 0 0 0 1px rgb(0 0 0 / 0.25)' }} />
                    ))}
                  </div>
                </div>
                <p className="text-[12px] leading-relaxed text-fg-3">Drag the handle in the middle of the wire to bend it around parts. Red for power and black for ground keeps a circuit easy to read.</p>
                {selWire.bend && (
                  <button className="btn btn-sm w-full" onClick={() => update(p => ({ ...p, wires: p.wires.map(w => (w.id === selWire.id ? { ...w, bend: undefined } : w)) }))}>
                    Reset curve
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex h-7 shrink-0 items-center gap-3 border-t border-line bg-surface px-3 text-[11.5px] text-fg-2">
          <span className="flex shrink-0 items-center gap-1.5 font-medium text-fg">
            <span className={`h-1.5 w-1.5 rounded-full ${running ? 'pulse-dot bg-ok' : 'bg-fg-3'}`} aria-hidden="true" />
            {running ? <>Running <span className="font-mono text-fg-2 tabular-nums">{seconds.toFixed(1)} s</span></> : 'Ready'}
          </span>
          <span className="hidden shrink-0 sm:inline">{board ? PARTS[board.type].name : 'No board'}{board ? ` · ${BOARDS[board.type as 'uno' | 'esp32'].vcc} V logic` : ''}</span>
          {running && notes.length > 0 && (
            <button className="flex shrink-0 items-center gap-1 font-medium text-warn" onClick={() => setIssuesOpen(true)}>
              <TriangleAlert size={12} aria-hidden="true" />{notes.length}
            </button>
          )}
          <span className="hidden min-w-0 flex-1 truncate text-fg-3 md:inline">{hint}</span>
          <span className="flex-1 md:hidden" />
          <span className="hidden shrink-0 tabular-nums sm:inline">{parts.length} parts</span>
          <span className="hidden shrink-0 tabular-nums sm:inline">{wires.length} wires</span>
          <button className="flex shrink-0 items-center gap-1 rounded px-1 hover:text-fg" onClick={onShortcuts} data-tip="Keyboard shortcuts" data-tip-pos="top">
            <Keyboard size={13} aria-hidden="true" /><span className="sr-only">Keyboard shortcuts</span>
          </button>
        </div>
      </div>

      {ghost && (
        <div className="popover pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 p-2" style={{ left: ghost.x, top: ghost.y }}>
          <PartThumb part={thumbPart(ghost.type)} size={60} />
        </div>
      )}
    </div>
  );
}

// ---------- Inspector ----------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[88px_1fr] items-center gap-2">
      <span className="label">{label}</span>
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function Slider({ label, value, min, max, step = 1, show, onChange }: { label: string; value: number; min: number; max: number; step?: number; show: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between"><span className="label">{label}</span><span className="font-mono text-[11.5px] text-fg tabular-nums">{show}</span></span>
      <input type="range" className="mt-1.5" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </label>
  );
}

function ValueInput({ value, format, parse, disabled, onCommit, placeholder }: {
  value: number; format: (n: number) => string; parse: (s: string) => number | null; disabled: boolean; onCommit: (n: number) => void; placeholder: string;
}) {
  const [text, setText] = useState(() => format(value));
  useEffect(() => setText(format(value)), [value, format]);
  const commit = () => {
    const n = parse(text);
    if (n !== null) onCommit(n);
    else setText(format(value));
  };
  return (
    <input className="input font-mono text-[12px]" value={text} disabled={disabled} placeholder={placeholder}
      onChange={e => setText(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }} />
  );
}

function Inspector({ part, designator, running, live, notes, volts, setProp, onLearn, onClose }: {
  part: Part; designator: string; running: boolean; live?: Live; notes: Note[]; volts: (r: string) => number;
  setProp: (k: string, v: number | string, opt?: { key?: string; skip?: boolean }) => void; onLearn: () => void; onClose: () => void;
}) {
  const spec = PARTS[part.type];
  const v = (pin: string) => volts(ref(part.id, pin));
  const slide = (k: string) => (x: number) => setProp(k, x, { key: `prop:${part.id}:${k}` });
  const readout: string | null = !running ? null
    : part.type === 'led' ? `Brightness ${Math.round((live?.b ?? 0) * 100)}%, ${(live?.ma ?? 0).toFixed(1)} mA`
    : part.type === 'capacitor' ? `Charged to ${(live?.volts ?? 0).toFixed(2)} V`
    : part.type === 'diode' ? ((live?.ma ?? 0) > 0.01 ? `Conducting ${(live?.ma ?? 0).toFixed(1)} mA` : 'Blocking, no current')
    : part.type === 'npn' ? (live?.state === 'off' || !live ? 'Off, no current into the base' : `${live.state === 'on' ? 'Fully on' : 'Partly on'}: ${live.ma?.toFixed(1)} mA through, ${live.base?.toFixed(2)} mA into the base`)
    : part.type === 'motor' ? (live?.rps ? `${Math.abs(live.ma ?? 0).toFixed(0)} mA, spinning ${live.rps > 0 ? 'clockwise' : 'anticlockwise'}` : 'Stopped, not enough current to turn')
    : part.type === 'seg7' ? `${(live?.segs ?? []).filter(b => b > 0.05).length} segments lit`
    : part.type === 'multimeter' ? (live?.reading ? `${live.reading.value} ${live.reading.unit}` : null)
    : part.type === 'scope' ? (live?.scope ? `${live.scope.f ? `${Math.round(live.scope.f)} Hz, ${Math.round((live.scope.duty ?? 0) * 100)}% on, ` : ''}average ${live.scope.avg.toFixed(2)} V` : null)
    : part.type === 'potentiometer' ? `Middle pin at ${v('W').toFixed(2)} V`
    : part.type === 'resistor' ? `${Math.abs(v('1') - v('2')).toFixed(2)} V across it`
    : part.type === 'ldr' ? `${Math.abs(v('1') - v('2')).toFixed(2)} V across it`
    : part.type === 'servo' ? (live?.angle !== undefined ? `Arm at ${Math.round(live.angle)}°` : 'Waiting for a signal')
    : part.type === 'buzzer' ? (live?.hz ? `Playing ${Math.round(live.hz)} Hz` : 'Silent')
    : part.type === 'relay' ? (live?.on ? 'Switch closed' : 'Switch open')
    : part.type === 'ne555' ? (!live?.on ? 'No power (wire VCC and GND)' : `Output ${live.state === 'on' ? 'HIGH' : 'LOW'} (${(live.volts ?? 0).toFixed(1)} V)`)
    : part.type === 'battery' ? `${(v('+') - v('-')).toFixed(2)} V at the terminals`
    : null;
  const mode = String(part.props.mode || 'V');

  return (
    <div className="popover absolute top-3 right-3 z-20 flex max-h-[calc(100%-1.5rem)] w-[288px] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-3 py-2.5">
        <span className="tile-art h-10 w-10 shrink-0"><PartThumb part={part} size={32} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[13px] font-semibold">{spec.name}</h3>
            {designator && <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-fg-2">{designator}</span>}
          </div>
          <p className="truncate text-[11.5px] text-fg-3">{spec.group}</p>
        </div>
        <button className="btn btn-ghost btn-sm btn-icon shrink-0" onClick={onClose} aria-label="Close inspector"><X size={15} /></button>
      </div>

      <div className="scroll min-h-0 flex-1 space-y-3.5 overflow-auto p-3">
        <p className="text-[12.5px] leading-relaxed text-fg-2">{spec.blurb}</p>

        {part.type !== 'breadboard' && (
          <Row label="Label">
            <input className="input font-mono text-[12px]" value={String(part.props.label ?? '')} placeholder={designator} disabled={running}
              onChange={e => setProp('label', e.target.value, { key: `prop:${part.id}:label` })} />
          </Row>
        )}
        {part.type === 'resistor' && (
          <div className="space-y-1.5">
            <Row label="Resistance">
              <ValueInput value={+part.props.ohms || 220} format={formatOhms} disabled={running} placeholder="e.g. 4k7, 220R"
                parse={s => { const n = parseSI(s); return n !== null && n >= 1 && n <= 10e6 ? n : null; }}
                onCommit={n => setProp('ohms', n)} />
            </Row>
            <div className="flex flex-wrap gap-1 pl-[96px]">
              {RESISTORS.map(o => (
                <button key={o} disabled={running} onClick={() => setProp('ohms', o)}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10.5px] ${+part.props.ohms === o ? 'bg-fg text-on-fg' : 'bg-surface-2 text-fg-2 hover:text-fg'}`}>
                  {formatOhms(o)}
                </button>
              ))}
            </div>
          </div>
        )}
        {part.type === 'capacitor' && (
          <div className="space-y-1.5">
            <Row label="Capacitance">
              <ValueInput value={+part.props.uf || 100} format={formatFarads} disabled={running} placeholder="e.g. 100u, 10n"
                parse={s => {
                  const n = parseSI(s);
                  if (n === null) return null;
                  const uf = n < 0.05 ? n * 1e6 : n;
                  return uf >= 0.001 && uf <= 10000 ? uf : null;
                }}
                onCommit={n => setProp('uf', n)} />
            </Row>
            <div className="flex flex-wrap gap-1 pl-[96px]">
              {CAPACITORS.map(c => (
                <button key={c} disabled={running} onClick={() => setProp('uf', c)}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10.5px] ${+part.props.uf === c ? 'bg-fg text-on-fg' : 'bg-surface-2 text-fg-2 hover:text-fg'}`}>
                  {formatFarads(c)}
                </button>
              ))}
            </div>
          </div>
        )}
        {part.type === 'led' && (
          <div className="grid grid-cols-[88px_1fr] items-center gap-2">
            <span className="label">Color</span>
            <div className="flex gap-2">
              {Object.entries(LED_COLORS).map(([name, c]) => (
                <button key={name} aria-label={name} data-tip={name} aria-pressed={part.props.color === name} disabled={running} onClick={() => setProp('color', name)}
                  className="h-5 w-5 rounded-full" style={{ background: c.hex, boxShadow: part.props.color === name ? '0 0 0 2px var(--surface), 0 0 0 4px var(--fg)' : 'inset 0 0 0 1px rgb(0 0 0 / 0.25)' }} />
              ))}
            </div>
          </div>
        )}
        {part.type === 'potentiometer' && <Slider label="Knob position" value={+part.props.pos} min={0} max={1} step={0.01} show={`${Math.round(+part.props.pos * 100)}%`} onChange={slide('pos')} />}
        {part.type === 'ldr' && <Slider label="Light on the sensor" value={+part.props.lux} min={0} max={1000} step={5} show={+part.props.lux < 50 ? 'Dark' : +part.props.lux > 700 ? 'Bright' : 'Dim'} onChange={slide('lux')} />}
        {part.type === 'ultrasonic' && <Slider label="Object distance" value={+part.props.cm} min={2} max={200} show={`${part.props.cm} cm`} onChange={slide('cm')} />}
        {part.type === 'dht11' && (
          <>
            <Slider label="Temperature" value={+part.props.temp} min={0} max={50} show={`${part.props.temp} °C`} onChange={slide('temp')} />
            <Slider label="Humidity" value={+part.props.hum} min={20} max={90} show={`${part.props.hum}%`} onChange={slide('hum')} />
          </>
        )}
        {part.type === 'button' && <p className="rounded-md bg-surface-2 px-2.5 py-2 text-[12.5px] text-fg-2">{running ? 'Press and hold it on the workplane.' : 'Start the simulation, then press and hold it.'}</p>}
        {part.type === 'switch' && (
          <div className="grid grid-cols-[88px_1fr] items-center gap-2">
            <span className="label">Position</span>
            <div className="seg w-fit" role="radiogroup" aria-label="Switch position">
              <button role="radio" aria-checked={!part.props.pos} onClick={() => setProp('pos', 0)}>Left</button>
              <button role="radio" aria-checked={!!part.props.pos} onClick={() => setProp('pos', 1)}>Right</button>
            </div>
          </div>
        )}
        {part.type === 'multimeter' && (
          <div className="space-y-2">
            <div className="grid grid-cols-[88px_1fr] items-center gap-2">
              <span className="label">Measure</span>
              <div className="seg w-fit" role="radiogroup" aria-label="Meter mode">
                {([['V', 'Volts'], ['A', 'mA'], ['Ω', 'Ohms']] as const).map(([m, label]) => (
                  <button key={m} role="radio" aria-checked={mode === m} onClick={() => setProp('mode', m)}>{label}</button>
                ))}
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-fg-3">
              {mode === 'V' ? 'Wire it across the part: red jack to the + side, COM to the − side.'
                : mode === 'A' ? 'Put it in the path of the current, so everything flows through the meter.'
                : 'Measure parts with no power on them, or the reading will be wrong.'}
            </p>
          </div>
        )}
        {part.type === 'scope' && (
          <>
            <Row label="Time / div">
              <select className="input" value={+part.props.tdiv} onChange={e => setProp('tdiv', +e.target.value)}>
                {TIME_DIVS.map(t => <option key={t} value={t}>{t < 1 ? `${t * 1000} µs` : t >= 1000 ? `${t / 1000} s` : `${t} ms`}</option>)}
              </select>
            </Row>
            <Row label="Volts / div">
              <select className="input" value={+part.props.vdiv} onChange={e => setProp('vdiv', +e.target.value)}>
                {VOLT_DIVS.map(x => <option key={x} value={x}>{x} V</option>)}
              </select>
            </Row>
          </>
        )}

        {readout && (
          <div className="rounded-md border border-line bg-surface-2 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-fg-3"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />Live</p>
            <p className="mt-0.5 font-mono text-[12.5px] leading-relaxed text-fg tabular-nums">{readout}</p>
          </div>
        )}
        {notes.map((n, i) => (
          <p key={i} className="flex gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[12.5px] leading-relaxed text-fg-2">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />{n.text}
          </p>
        ))}
      </div>

      <div className="shrink-0 border-t border-line p-1.5">
        <button className="btn btn-ghost w-full justify-start" onClick={onLearn}><Box size={14} /> See inside, in 3D <ArrowRight size={14} className="ml-auto" /></button>
      </div>
    </div>
  );
}
