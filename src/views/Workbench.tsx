import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical,
  AlignVerticalDistributeCenter, ArrowRight, Box, BoxSelect, Camera, ChevronDown, ChevronRight, CircleAlert, CircleCheck, ClipboardPaste, Copy, Download, FileCode,
  Grid2x2, Hand, Image as ImageIcon, Info, Keyboard, Lightbulb, Map as MapIcon, Maximize2, Minus, MousePointer2, MousePointerClick, Plus, Redo2, Rotate3d, RotateCw,
  Scissors, Search, ShieldCheck, Tag, Trash2, TriangleAlert, Undo2, X, Zap,
} from 'lucide-react';
import type { Live, Note, Part, PartType, Project, Rot, Wire } from '../types';
import { BOARDS, CAPACITORS, LED_COLORS, P, PARTS, PART_ORDER, designators, formatFarads, formatOhms, isBoard, makePart, MM_PER_UNIT, newId, parseSI, partBounds, partValue, pinPos, pivot, ref, wireGeom } from '../parts/catalog';
import { PartArt, PartThumb, WireArt } from '../parts/PartArt';
import BenchMat from '../parts/BenchMat';
import { buildNets } from '../sim/nets';
import { checkCircuit, netlist } from '../sim/check';
import type { Issue } from '../sim/check';
import type { ViewPreset } from './Bench3D';

const Bench3D = lazy(() => import('./Bench3D'));

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
  /** Dark theme, for the 3D bench. */
  dark: boolean;
}

interface View { x: number; y: number; k: number }
type Sel = { kind: 'parts'; ids: string[] } | { kind: 'wire'; id: string } | null;

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

const FG = { stroke: 'var(--fg)' } as const;
const MODE_PREF = 'xavierlabs_bench_mode';
const EXPORT_VARS = ['--fg', '--fg-2', '--fg-3', '--canvas', '--surface', '--surface-2', '--surface-3', '--line', '--line-2', '--mat', '--mat-line', '--mat-ink', '--mat-ink-2', '--mat-edge', '--warn', '--ok', '--bad', '--grid', '--pop', '--seg-on', '--app', '--inverse'];

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileName = (s: string) => (s.trim() || 'circuit').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase();

interface Clip { parts: Part[]; wires: Wire[] }
type Drag =
  | { kind: 'parts'; ids: string[]; start: Map<string, { x: number; y: number }>; ox: number; oy: number; key: string }
  | { kind: 'bend'; id: string; base: { x: number; y: number }; key: string }
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'press'; id: string }
  | { kind: 'marquee'; add: boolean; base: string[] }
  | null;

export default function Workbench(props: Props) {
  const { project, update, running, seconds, live, flow, notes, voltageAt, onLearn, fitKey, canUndo, canRedo, onUndo, onRedo, onToast, onShortcuts, addRequest, guide, onOpenGuide, dark } = props;
  const { parts, wires } = project;
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 1 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [sel, setSel] = useState<Sel>(null);
  const [wiring, setWiring] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ type: PartType; x: number; y: number; over: boolean; wx: number; wy: number } | null>(null);
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const [hoverWire, setHoverWire] = useState<{ id: string; x: number; y: number } | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(true);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; on: 'part' | 'wire' | 'canvas' } | null>(null);
  const [panel, setPanel] = useState<'check' | 'export' | null>(null);
  const [tool, setTool] = useState<'select' | 'pan'>('select');
  const [space, setSpace] = useState(false);
  const [mode, setMode] = useState<'2d' | '3d'>(() => { try { return localStorage.getItem(MODE_PREF) === '3d' ? '3d' : '2d'; } catch { return '2d'; } });
  const [preset, setPreset] = useState<{ name: ViewPreset; n: number }>({ name: 'iso', n: 0 });
  const [showFlow, setShowFlow] = useState(() => { try { return localStorage.getItem(FLOW_PREF) !== '0'; } catch { return true; } });
  const [showMat, setShowMat] = useState(() => { try { return localStorage.getItem(MAT_PREF) !== '0'; } catch { return true; } });
  const [showLabels, setShowLabels] = useState(() => { try { return localStorage.getItem(LABEL_PREF) !== '0'; } catch { return true; } });
  const [showMap, setShowMap] = useState(true);
  useEffect(() => { try { localStorage.setItem(FLOW_PREF, showFlow ? '1' : '0'); } catch { /* ignore */ } }, [showFlow]);
  useEffect(() => { try { localStorage.setItem(MAT_PREF, showMat ? '1' : '0'); } catch { /* ignore */ } }, [showMat]);
  useEffect(() => { try { localStorage.setItem(LABEL_PREF, showLabels ? '1' : '0'); } catch { /* ignore */ } }, [showLabels]);
  useEffect(() => { try { localStorage.setItem(MODE_PREF, mode); } catch { /* ignore */ } }, [mode]);
  const dragSeq = useRef(0);
  const pasteN = useRef(0);
  const clip = useRef<Clip | null>(null);
  const drag = useRef<Drag>(null);

  const selIds = useMemo(() => (sel?.kind === 'parts' ? sel.ids : []), [sel]);
  const selSet = useMemo(() => new Set(selIds), [selIds]);
  const selectParts = useCallback((ids: string[]) => setSel(ids.length ? { kind: 'parts', ids } : null), []);

  const pinMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number; name: string; kind: string; part: Part }>();
    for (const part of parts) for (const p of PARTS[part.type].pins) m.set(ref(part.id, p.id), { ...pinPos(part, p), name: p.name, kind: p.kind, part });
    return m;
  }, [parts]);

  const nets = useMemo(() => buildNets(parts, wires), [parts, wires]);
  const issues = useMemo(() => checkCircuit(project), [project]);
  const issueParts = useMemo(() => {
    const m = new Map<string, Issue['level']>();
    for (const i of issues) for (const id of i.parts) if (!m.has(id) || i.level === 'error') m.set(id, i.level);
    return m;
  }, [issues]);
  const issueCount = issues.filter(i => i.level !== 'info').length;

  const toWorldPt = useCallback((cx: number, cy: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  }, [view]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSize({ w: r.width, h: r.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (mode === '3d') { setPreset(p => ({ name: 'iso', n: p.n + 1 })); return; }
    const el = wrap.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (!parts.length) { setView({ x: width / 2 - 200, y: height / 2 - 100, k: 1 }); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const part of parts) {
      const b = partBounds(part);
      x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
    }
    const pad = 72;
    const k = Math.min(1.8, Math.max(0.3, Math.min((width - pad * 2) / (x1 - x0), (height - pad * 2) / (y1 - y0))));
    setView({ k, x: (width - (x1 + x0) * k) / 2, y: (height - (y1 + y0) * k) / 2 });
  }, [parts, mode]);

  // Re-centre when another project is opened.
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useLayoutEffect(() => { fitRef.current(); setSel(null); setWiring(null); setHoverWire(null); }, [fitKey]);
  useEffect(() => { if (running) { setWiring(null); setIssuesOpen(true); setMenu(null); } }, [running]);
  // Forget selected things that were removed (for example by undo).
  useEffect(() => {
    if (!sel) return;
    if (sel.kind === 'wire') { if (!wires.some(w => w.id === sel.id)) setSel(null); return; }
    const keep = sel.ids.filter(id => parts.some(p => p.id === id));
    if (keep.length !== sel.ids.length) selectParts(keep);
  }, [sel, parts, wires, selectParts]);

  // ---- editing ----
  const removeSel = useCallback(() => {
    if (!sel || running) return;
    if (sel.kind === 'wire') update(p => ({ ...p, wires: p.wires.filter(w => w.id !== sel.id) }));
    else {
      const gone = new Set(sel.ids);
      const owner = (r: string) => gone.has(r.slice(0, r.indexOf(':')));
      update(p => ({ ...p, parts: p.parts.filter(x => !gone.has(x.id)), wires: p.wires.filter(w => !owner(w.from) && !owner(w.to)) }));
    }
    setSel(null);
  }, [sel, running, update]);

  /** Rotate one part in place, or a group of parts together around their middle. */
  const rotateSel = useCallback(() => {
    if (!selIds.length || running) return;
    const chosen = parts.filter(p => selSet.has(p.id));
    if (chosen.length === 1) {
      update(p => ({ ...p, parts: p.parts.map(x => (x.id === chosen[0].id ? { ...x, rot: ((x.rot + 90) % 360) as Rot } : x)) }));
      return;
    }
    const piv = chosen.map(p => { const [px, py] = pivot(p.type); return { id: p.id, px, py, x: p.x + px, y: p.y + py }; });
    const cx = snap(piv.reduce((s, q) => s + q.x, 0) / piv.length), cy = snap(piv.reduce((s, q) => s + q.y, 0) / piv.length);
    const next = new Map(piv.map(q => [q.id, { x: snap(cx - (q.y - cy) - q.px), y: snap(cy + (q.x - cx) - q.py) }]));
    update(p => ({ ...p, parts: p.parts.map(x => { const n = next.get(x.id); return n ? { ...x, ...n, rot: ((x.rot + 90) % 360) as Rot } : x; }) }));
  }, [selIds, selSet, parts, running, update]);

  /** The selected parts and the wires that run between them. Boards stay put: a project has one. */
  const gather = useCallback((): Clip | null => {
    const chosen = parts.filter(p => selSet.has(p.id) && !isBoard(p.type));
    if (!chosen.length) return null;
    const ids = new Set(chosen.map(p => p.id));
    const inside = (r: string) => ids.has(r.slice(0, r.indexOf(':')));
    return { parts: chosen, wires: wires.filter(w => inside(w.from) && inside(w.to)) };
  }, [parts, wires, selSet]);

  const place = useCallback((c: Clip, at?: { x: number; y: number }) => {
    if (running) return;
    const b = c.parts.map(partBounds).reduce((a, q) => ({ x0: Math.min(a.x0, q.x0), y0: Math.min(a.y0, q.y0), x1: Math.max(a.x1, q.x1), y1: Math.max(a.y1, q.y1) }));
    let dx: number, dy: number;
    if (at) { dx = snap(at.x - (b.x0 + b.x1) / 2); dy = snap(at.y - (b.y0 + b.y1) / 2); }
    else { pasteN.current += 1; dx = dy = 24 * pasteN.current; }
    const ids = new Map<string, string>();
    const made = c.parts.map(p => { const id = newId(p.type[0]); ids.set(p.id, id); return { ...p, id, x: p.x + dx, y: p.y + dy, props: { ...p.props, label: '' } }; });
    const re = (r: string) => { const i = r.indexOf(':'); return `${ids.get(r.slice(0, i))}${r.slice(i)}`; };
    const madeWires = c.wires.map(w => ({ ...w, id: newId('w'), from: re(w.from), to: re(w.to) }));
    update(p => ({ ...p, parts: [...p.parts, ...made], wires: [...p.wires, ...madeWires] }));
    selectParts(made.map(p => p.id));
  }, [running, update, selectParts]);

  const copySel = useCallback((quiet = false) => {
    const c = gather();
    if (!c) return false;
    clip.current = JSON.parse(JSON.stringify(c)) as Clip;
    pasteN.current = 0;
    if (!quiet) onToast(`Copied ${c.parts.length} part${c.parts.length === 1 ? '' : 's'}${c.wires.length ? ` and ${c.wires.length} wire${c.wires.length === 1 ? '' : 's'}` : ''}`);
    return true;
  }, [gather, onToast]);
  const cutSel = useCallback(() => { if (!running && copySel(true)) removeSel(); }, [copySel, removeSel, running]);
  const paste = useCallback((at?: { x: number; y: number }) => { if (clip.current) place(clip.current, at); }, [place]);
  const duplicateSel = useCallback(() => {
    const c = gather();
    if (!c) return;
    const b = c.parts.map(partBounds).reduce((a, q) => ({ x0: Math.min(a.x0, q.x0), y0: Math.min(a.y0, q.y0), x1: Math.max(a.x1, q.x1), y1: Math.max(a.y1, q.y1) }));
    place(c, { x: (b.x0 + b.x1) / 2 + 24, y: (b.y0 + b.y1) / 2 + 24 });
  }, [gather, place]);
  const selectAll = useCallback(() => selectParts(parts.map(p => p.id)), [parts, selectParts]);

  const nudge = useCallback((dx: number, dy: number) => {
    if (!selIds.length || running) return;
    update(p => ({ ...p, parts: p.parts.map(x => (selSet.has(x.id) ? { ...x, x: x.x + dx, y: x.y + dy } : x)) }), { key: `nudge:${selIds.join(',')}` });
  }, [selIds, selSet, running, update]);

  /** Line up the selected parts by their outlines, or space them evenly, like a drawing program. */
  const align = useCallback((how: 'left' | 'cx' | 'right' | 'top' | 'cy' | 'bottom' | 'dx' | 'dy') => {
    const chosen = parts.filter(p => selSet.has(p.id));
    if (chosen.length < 2 || running) return;
    const b = new Map(chosen.map(p => [p.id, partBounds(p)]));
    const all = [...b.values()];
    const x0 = Math.min(...all.map(q => q.x0)), x1 = Math.max(...all.map(q => q.x1));
    const y0 = Math.min(...all.map(q => q.y0)), y1 = Math.max(...all.map(q => q.y1));
    const move = new Map<string, { dx: number; dy: number }>();
    if (how === 'dx' || how === 'dy') {
      const h = how === 'dx';
      const order = [...chosen].sort((p, q) => (h ? b.get(p.id)!.x0 - b.get(q.id)!.x0 : b.get(p.id)!.y0 - b.get(q.id)!.y0));
      const span = order.reduce((s, p) => s + (h ? b.get(p.id)!.x1 - b.get(p.id)!.x0 : b.get(p.id)!.y1 - b.get(p.id)!.y0), 0);
      const gap = ((h ? x1 - x0 : y1 - y0) - span) / (order.length - 1);
      let at = h ? x0 : y0;
      for (const p of order) {
        const q = b.get(p.id)!;
        move.set(p.id, h ? { dx: snap(at - q.x0), dy: 0 } : { dx: 0, dy: snap(at - q.y0) });
        at += (h ? q.x1 - q.x0 : q.y1 - q.y0) + gap;
      }
    } else {
      for (const p of chosen) {
        const q = b.get(p.id)!;
        const dx = how === 'left' ? x0 - q.x0 : how === 'right' ? x1 - q.x1 : how === 'cx' ? (x0 + x1) / 2 - (q.x0 + q.x1) / 2 : 0;
        const dy = how === 'top' ? y0 - q.y0 : how === 'bottom' ? y1 - q.y1 : how === 'cy' ? (y0 + y1) / 2 - (q.y0 + q.y1) / 2 : 0;
        move.set(p.id, { dx: snap(dx), dy: snap(dy) });
      }
    }
    update(p => ({ ...p, parts: p.parts.map(x => { const m = move.get(x.id); return m ? { ...x, x: x.x + m.dx, y: x.y + m.dy } : x; }) }));
  }, [parts, selSet, running, update]);

  const setProp = (id: string, key: string, value: number | string, opt?: { key?: string; skip?: boolean }) =>
    update(p => ({ ...p, parts: p.parts.map(x => (x.id === id ? { ...x, props: { ...x.props, [key]: value } } : x)) }), opt);

  /** Where a new part lands if dropped with its centre at `c`. */
  const dropAt = (type: PartType, c: { x: number; y: number }) => { const [px, py] = pivot(type); return { x: snap(c.x - px), y: snap(c.y - py) }; };

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
      selectParts([existing.id]);
      return;
    }
    const n = at ? 0 : parts.length % 5;
    const c = at ?? { x: (size.w / 2 - view.x) / view.k + n * 24, y: (size.h / 2 - view.y) / view.k + n * 24 };
    const pos = dropAt(type, c);
    const part = makePart(type, pos.x, pos.y);
    update(p => ({ ...p, parts: [...p.parts, part] }));
    selectParts([part.id]);
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

  /** Drag a part out of the library onto the workplane, with a live preview of where it lands. A plain click adds it in the middle. */
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
      const w = dropAt(type, toWorldPt(ev.clientX, ev.clientY));
      setGhost({ type, x: ev.clientX, y: ev.clientY, over: inside(ev.clientX, ev.clientY), wx: w.x, wy: w.y });
    };
    const up = (ev: PointerEvent) => {
      done();
      if (!moved) addPart(type);
      else if (inside(ev.clientX, ev.clientY)) addPart(type, mode === '3d' ? undefined : toWorldPt(ev.clientX, ev.clientY));
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

  /** While wiring, the pin nearest the cursor (within reach) is where the wire will land. */
  const magnet = useMemo(() => {
    if (!wiring) return null;
    let best: string | null = null, bd = 14 / Math.min(1.5, view.k);
    for (const [r, p] of pinMap) {
      if (r === wiring) continue;
      const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }, [wiring, mouse, pinMap, view.k]);

  // ---- pointer handling ----
  const onDown = (e: React.PointerEvent) => {
    setMenu(null);
    setPanel(null);
    if (e.button !== 0 && e.button !== 1) return;
    const t = (e.target as Element).closest<SVGElement>('[data-bend],[data-pin],[data-wire],[data-part]');
    const w = toWorldPt(e.clientX, e.clientY);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (e.button === 1 || tool === 'pan' || space) {
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      return;
    }
    if (wiring && magnet && (!t || !t.dataset.pin)) { finishWire(magnet); return; }
    if (!t) {
      setWiring(null);
      const add = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!add) setSel(null);
      drag.current = { kind: 'marquee', add, base: add ? selIds : [] };
      setMarquee({ x0: w.x, y0: w.y, x1: w.x, y1: w.y });
      return;
    }
    if (t.dataset.bend && !running) {
      const wire = wires.find(x => x.id === t.dataset.bend);
      const a = wire && pinMap.get(wire.from), b = wire && pinMap.get(wire.to);
      if (wire && a && b) {
        setSel({ kind: 'wire', id: wire.id });
        drag.current = { kind: 'bend', id: wire.id, base: wireGeom(a, b).mid, key: `bend:${++dragSeq.current}` };
      }
      return;
    }
    if (t.dataset.pin && !running && !e.shiftKey) {
      if (wiring) finishWire(t.dataset.pin); else { setWiring(t.dataset.pin); setMouse(w); setSel(null); }
      return;
    }
    if (t.dataset.wire) { setSel({ kind: 'wire', id: t.dataset.wire }); setWiring(null); return; }
    const part = t.dataset.pin ? pinMap.get(t.dataset.pin)!.part : parts.find(p => p.id === t.dataset.part);
    if (!part) return;
    setWiring(null);
    if (running) {
      selectParts([part.id]);
      if (part.type === 'button') { setProp(part.id, 'pressed', 1, { skip: true }); drag.current = { kind: 'press', id: part.id }; }
      if (part.type === 'switch') setProp(part.id, 'pos', part.props.pos ? 0 : 1);
      return;
    }
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      selectParts(selSet.has(part.id) ? selIds.filter(id => id !== part.id) : [...selIds, part.id]);
      return;
    }
    // Dragging a part that is already selected moves the whole selection.
    const ids = selSet.has(part.id) ? selIds : [part.id];
    if (!selSet.has(part.id)) selectParts(ids);
    const start = new Map(parts.filter(p => ids.includes(p.id)).map(p => [p.id, { x: p.x, y: p.y }]));
    drag.current = { kind: 'parts', ids, start, ox: w.x, oy: w.y, key: `move:${++dragSeq.current}` };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const w = toWorldPt(e.clientX, e.clientY);
    if (coordRef.current) coordRef.current.textContent = `X ${(w.x * MM_PER_UNIT).toFixed(1)}  Y ${(w.y * MM_PER_UNIT).toFixed(1)} mm`;
    if (hoverWire && running) { const r = wrap.current!.getBoundingClientRect(); setHoverWire({ ...hoverWire, x: e.clientX - r.left, y: e.clientY - r.top }); }
    if (wiring) setMouse(w);
    if (!d) return;
    if (d.kind === 'pan') setView(v => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
    if (d.kind === 'marquee') setMarquee(m => (m ? { ...m, x1: w.x, y1: w.y } : m));
    if (d.kind === 'parts') {
      const dx = snap(w.x - d.ox), dy = snap(w.y - d.oy);
      update(p => {
        const first = p.parts.find(q => q.id === d.ids[0]);
        const s0 = d.start.get(d.ids[0]);
        if (!first || !s0 || (first.x === s0.x + dx && first.y === s0.y + dy)) return p;
        return { ...p, parts: p.parts.map(q => { const s = d.start.get(q.id); return s ? { ...q, x: s.x + dx, y: s.y + dy } : q; }) };
      }, { key: d.key });
    }
    if (d.kind === 'bend') {
      const bx = Math.round(w.x - d.base.x), by = Math.round(w.y - d.base.y);
      const bend: [number, number] | undefined = Math.hypot(bx, by) < 4 ? undefined : [bx, by];
      update(p => ({ ...p, wires: p.wires.map(q => (q.id === d.id ? { ...q, bend } : q)) }), { key: d.key });
    }
  };

  const onUp = () => {
    const d = drag.current;
    if (d?.kind === 'press') setProp(d.id, 'pressed', 0, { skip: true });
    if (d?.kind === 'marquee' && marquee) {
      const { x0, y0, x1, y1 } = marquee;
      if (Math.abs(x1 - x0) * view.k > 3 || Math.abs(y1 - y0) * view.k > 3) {
        // Drag right: parts fully inside. Drag left: anything the box touches (except the boards under everything).
        const window_ = x1 >= x0;
        const r = { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
        const hit = parts.filter(p => {
          const b = partBounds(p);
          const inside = b.x0 >= r.x0 && b.x1 <= r.x1 && b.y0 >= r.y0 && b.y1 <= r.y1;
          if (window_ || inside) return inside;
          if (p.type === 'breadboard' || isBoard(p.type)) return false;
          return b.x1 >= r.x0 && b.x0 <= r.x1 && b.y1 >= r.y0 && b.y0 <= r.y1;
        }).map(p => p.id);
        selectParts([...new Set([...d.base, ...hit])]);
      }
      setMarquee(null);
    }
    drag.current = null;
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    if (running) return;
    setWiring(null);
    const r = wrap.current!.getBoundingClientRect();
    const t = (e.target as Element).closest<SVGElement>('[data-wire],[data-part],[data-pin]');
    const partId = t?.dataset.part ?? (t?.dataset.pin ? pinMap.get(t.dataset.pin)?.part.id : undefined);
    let on: 'part' | 'wire' | 'canvas' = 'canvas';
    if (t?.dataset.wire) { setSel({ kind: 'wire', id: t.dataset.wire }); on = 'wire'; }
    else if (partId) { if (!selSet.has(partId)) selectParts([partId]); on = 'part'; }
    mouseAtMenu.current = toWorldPt(e.clientX, e.clientY);
    setMenu({ x: Math.min(e.clientX - r.left, r.width - 230), y: Math.min(e.clientY - r.top, r.height - 330), on });
  };
  const mouseAtMenu = useRef({ x: 0, y: 0 });

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
      const k = Math.min(4, Math.max(0.2, v.k * factor));
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) };
    });
  }, []);

  useEffect(() => {
    const el = wrap.current!;
    const onWheel = (e: WheelEvent) => {
      if (mode === '3d') return;
      e.preventDefault();
      setHoverWire(null);
      const r = el.getBoundingClientRect();
      // Pinch and Ctrl+wheel zoom; a plain two-finger trackpad scroll pans.
      if (!e.ctrlKey && Math.abs(e.deltaX) > 0 && Math.abs(e.deltaY) < 40 && e.deltaMode === 0 && !Number.isInteger(e.deltaY)) {
        setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
        return;
      }
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === 'd') { e.preventDefault(); duplicateSel(); }
        else if (k === 'c' && selIds.length) { e.preventDefault(); copySel(); }
        else if (k === 'x' && selIds.length) { e.preventDefault(); cutSel(); }
        else if (k === 'v' && clip.current) { e.preventDefault(); paste(); }
        else if (k === 'a') { e.preventDefault(); selectAll(); }
        return;
      }
      if (e.altKey) return;
      if (e.key === ' ' && mode === '2d') { e.preventDefault(); setSpace(true); return; }
      if (e.key === 'Escape') { setWiring(null); setSel(null); setMenu(null); setPanel(null); }
      if (e.key === 'Delete' || e.key === 'Backspace') removeSel();
      if (k === 'r') rotateSel();
      if (k === 'v') setTool('select');
      if (k === 'h') setTool('pan');
      if (k === 'f') fit();
      if (e.key.startsWith('Arrow') && selIds.length) {
        e.preventDefault();
        const s = e.shiftKey ? P * 5 : P;
        nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') setSpace(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [removeSel, rotateSel, duplicateSel, copySel, cutSel, paste, selectAll, nudge, fit, selIds, mode]);

  const zoomButton = (f: number) => zoomAt(size.w / 2, size.h / 2, f);
  const zoomReset = () => zoomAt(size.w / 2, size.h / 2, 1 / view.k);

  const selPart = selIds.length === 1 ? parts.find(p => p.id === selIds[0]) : undefined;
  const selWire = sel?.kind === 'wire' ? wires.find(w => w.id === sel.id) : undefined;
  const multi = selIds.length > 1;
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
  const selBox = useMemo(() => {
    if (!multi) return null;
    const bs = parts.filter(p => selSet.has(p.id)).map(partBounds);
    if (!bs.length) return null;
    return { x0: Math.min(...bs.map(b => b.x0)), y0: Math.min(...bs.map(b => b.y0)), x1: Math.max(...bs.map(b => b.x1)), y1: Math.max(...bs.map(b => b.y1)) };
  }, [multi, parts, selSet]);
  const noted = new Set(notes.map(n => n.partId));
  const hoverPin = hover ? pinMap.get(hover) : undefined;
  const joined = hover ? nets.group(hover).filter(r => r !== hover) : [];
  const joinedParts = joined.filter(r => pinMap.get(r)?.part.type !== 'breadboard');
  const joinedText = !hoverPin ? '' : joinedParts.length
    ? `Joined to ${joinedParts.slice(0, 3).map(r => { const q = pinMap.get(r)!; return `${refs.get(q.part.id) ?? PARTS[q.part.type].name} ${q.name}`; }).join(', ')}${joinedParts.length > 3 ? ` and ${joinedParts.length - 3} more` : ''}`
    : joined.length ? `Joined to ${joined.length} other hole${joined.length === 1 ? '' : 's'}` : 'Not connected to anything';
  const board = parts.find(p => isBoard(p.type));
  let dot = 24 * view.k;
  while (dot < 12) dot *= 2;

  const q = query.trim().toLowerCase();
  const matches = PART_ORDER.filter(t => !q || PARTS[t].name.toLowerCase().includes(q) || PARTS[t].blurb.toLowerCase().includes(q));

  const hint = running
    ? (mode === '3d' ? 'Drag to orbit, right-drag to pan. Click buttons and switches to use them.' : 'Click buttons and switches. Hover a pin for its voltage, a wire for its current.')
    : mode === '3d' ? 'Drag to orbit, right-drag to pan, scroll to zoom. Click a part to inspect it.'
    : wiring ? 'Click a pin to finish the wire. It snaps to the nearest pin. Esc cancels.'
    : multi ? `${selIds.length} selected. Drag to move together, R rotates, arrows nudge, Ctrl C copies.`
    : selPart ? 'Drag to move. R rotates, arrows nudge, Delete removes. Shift-click adds to the selection.'
    : selWire ? 'Drag the handle to bend it. Pick a color, or press Delete.'
    : 'Drag right to select parts inside a box, left to select anything it touches. Space-drag pans.';

  // ---- export ----
  const exportImage = async (kind: 'svg' | 'png') => {
    setPanel(null);
    const name = fileName(project.name);
    if (mode === '3d') {
      const canvas = wrap.current?.querySelector<HTMLCanvasElement>('[data-bench3d] canvas');
      if (!canvas) return;
      canvas.toBlob(b => { if (b) download(`${name}-3d.png`, b); });
      onToast('Saved a 3D snapshot');
      return;
    }
    const svg = svgRef.current;
    if (!svg || !parts.length) return;
    const b = showMat ? mat : parts.map(partBounds).reduce((a, x) => ({ x0: Math.min(a.x0, x.x0 - 40), y0: Math.min(a.y0, x.y0 - 40), x1: Math.max(a.x1, x.x1 + 40), y1: Math.max(a.y1, x.y1 + 40) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    const w = Math.ceil(b.x1 - b.x0 + 24), h = Math.ceil(b.y1 - b.y0 + 24);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('[data-noexport]').forEach(n => n.remove());
    clone.querySelector('[data-world]')?.setAttribute('transform', `translate(${12 - b.x0} ${12 - b.y0})`);
    clone.removeAttribute('class');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const css = getComputedStyle(document.documentElement);
    const vars = EXPORT_VARS.map(v => `${v}:${css.getPropertyValue(v).trim()}`).join(';');
    const defs = document.getElementById('xl-defs')?.innerHTML ?? '';
    clone.insertAdjacentHTML('afterbegin', `<style>svg{${vars}}</style>${defs}<rect width="100%" height="100%" fill="${css.getPropertyValue('--canvas').trim()}"/>`);
    const text = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([text], { type: 'image/svg+xml' });
    if (kind === 'svg') { download(`${name}.svg`, blob); onToast('Exported the drawing as SVG'); return; }
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const scale = Math.min(3, 6000 / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      const ctx = c.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(pb => { if (pb) download(`${name}.png`, pb); });
      onToast('Exported the drawing as PNG');
    };
    img.src = url;
  };
  const exportNetlist = () => {
    setPanel(null);
    download(`${fileName(project.name)}.cir`, new Blob([netlist(project)], { type: 'text/plain' }));
    onToast('Exported a SPICE netlist (.cir)');
  };

  const focusIssue = (i: Issue) => {
    if (i.wire) setSel({ kind: 'wire', id: i.wire });
    else if (i.parts.length) selectParts(i.parts);
  };

  // ---- minimap ----
  const MAP_W = 176, MAP_H = 112;
  const mapScale = Math.min(MAP_W / (mat.x1 - mat.x0), MAP_H / (mat.y1 - mat.y0));
  const mapOx = (MAP_W - (mat.x1 - mat.x0) * mapScale) / 2, mapOy = (MAP_H - (mat.y1 - mat.y0) * mapScale) / 2;
  const mapTo = (e: React.PointerEvent) => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    const wx = (e.clientX - r.left - mapOx) / mapScale + mat.x0, wy = (e.clientY - r.top - mapOy) / mapScale + mat.y0;
    setView(v => ({ ...v, x: size.w / 2 - wx * v.k, y: size.h / 2 - wy * v.k }));
  };

  const can = { edit: !running, sel: selIds.length > 0 && !running };
  const menuItem = (label: string, icon: React.ReactNode, run: () => void, keys?: string, disabled = false) => (
    <button key={label} role="menuitem" disabled={disabled} className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[12.5px] hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent"
      onClick={() => { setMenu(null); run(); }}>
      <span className="grid w-4 place-items-center text-fg-2">{icon}</span>
      <span className="flex-1">{label}</span>
      {keys && <span className="font-mono text-[10.5px] text-fg-3">{keys}</span>}
    </button>
  );
  const alignBar = (
    <div className="flex flex-wrap items-center gap-0.5">
      {([
        ['left', AlignStartVertical, 'Align left'], ['cx', AlignCenterVertical, 'Align centres'], ['right', AlignEndVertical, 'Align right'],
        ['top', AlignStartHorizontal, 'Align top'], ['cy', AlignCenterHorizontal, 'Align middles'], ['bottom', AlignEndHorizontal, 'Align bottom'],
        ['dx', AlignHorizontalDistributeCenter, 'Space evenly across'], ['dy', AlignVerticalDistributeCenter, 'Space evenly down'],
      ] as const).map(([how, Icon, label]) => (
        <button key={how} className="btn btn-ghost btn-sm btn-icon" aria-label={label} data-tip={label} disabled={running || ((how === 'dx' || how === 'dy') && selIds.length < 3)} onClick={() => align(how)}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  );

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
          <div className="seg mr-1" role="radiogroup" aria-label="View">
            <button role="radio" aria-checked={mode === '2d'} onClick={() => setMode('2d')} data-tip="Flat drawing, for building">2D</button>
            <button role="radio" aria-checked={mode === '3d'} onClick={() => { setMode('3d'); setWiring(null); }} data-tip="See it built, in 3D">3D</button>
          </div>
          {mode === '2d' && (
            <>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setTool('select')} aria-pressed={tool === 'select'} aria-label="Select tool" data-tip="Select  V"><MousePointer2 size={15} /></button>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setTool('pan')} aria-pressed={tool === 'pan'} aria-label="Pan tool" data-tip="Pan  H (or hold Space)"><Hand size={15} /></button>
            </>
          )}
          <span className="divider-v mx-1" />
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onUndo} disabled={!canUndo || running} aria-label="Undo" data-tip="Undo  Ctrl Z"><Undo2 size={15} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onRedo} disabled={!canRedo || running} aria-label="Redo" data-tip="Redo  Ctrl Shift Z"><Redo2 size={15} /></button>
          <span className="divider-v mx-1" />
          <button className="btn btn-ghost btn-sm btn-icon" onClick={rotateSel} disabled={!can.sel} aria-label="Rotate" data-tip="Rotate  R"><RotateCw size={15} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={duplicateSel} disabled={!can.sel || !gather()} aria-label="Duplicate" data-tip="Duplicate  Ctrl D"><Copy size={14} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={removeSel} disabled={!sel || running} aria-label="Delete" data-tip="Delete  Del"><Trash2 size={15} /></button>
          {(selPart || selWire || multi) && <span className="chip ml-1.5 hidden whitespace-nowrap sm:inline-flex">{multi ? `${selIds.length} parts` : selPart ? (refs.get(selPart.id) ?? PARTS[selPart.type].name) : 'Wire'}</span>}
          <span className="flex-1" />
          <div className="relative">
            <button className="btn btn-ghost btn-sm" onClick={() => setPanel(p => (p === 'check' ? null : 'check'))} aria-expanded={panel === 'check'} data-tip="Check the circuit for mistakes">
              {issueCount ? <TriangleAlert size={14} className={issues.some(i => i.level === 'error') ? 'text-bad' : 'text-warn'} aria-hidden="true" /> : <ShieldCheck size={14} className="text-ok" aria-hidden="true" />}
              <span className="hidden lg:inline">Check</span>
              {issueCount > 0 && <span className="font-mono text-[11px] tabular-nums">{issueCount}</span>}
            </button>
            {panel === 'check' && (
              <div className="popover absolute top-9 right-0 z-30 w-[340px] overflow-hidden" role="dialog" aria-label="Circuit check">
                <div className="flex h-10 items-center justify-between border-b border-line px-3">
                  <h3 className="text-[13px] font-semibold">Circuit check</h3>
                  <span className="text-[11.5px] text-fg-3">{issues.length ? `${issues.length} found` : 'All clear'}</span>
                </div>
                {issues.length ? (
                  <ul className="scroll max-h-80 overflow-auto p-1">
                    {issues.map((i, n) => (
                      <li key={n}>
                        <button className="flex w-full gap-2.5 rounded-md px-2 py-2 text-left hover:bg-surface-2" onClick={() => focusIssue(i)}>
                          {i.level === 'error' ? <CircleAlert size={15} className="mt-0.5 shrink-0 text-bad" /> : i.level === 'warn' ? <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" /> : <Info size={15} className="mt-0.5 shrink-0 text-fg-3" />}
                          <span className="min-w-0">
                            <span className="block text-[12.5px] font-semibold">{i.title}</span>
                            <span className="block text-[12px] leading-relaxed text-fg-2">{i.text}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-2 px-3 py-4 text-[12.5px] text-fg-2"><CircleCheck size={15} className="text-ok" />No shorts, loose legs or backwards parts found.</p>
                )}
              </div>
            )}
          </div>
          {mode === '2d' ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMat(m => !m)} aria-pressed={showMat} data-tip="Anti-static reference mat">
                <Grid2x2 size={14} aria-hidden="true" /> <span className="hidden xl:inline">Mat</span>
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowLabels(l => !l)} aria-pressed={showLabels} data-tip="Part designators and values">
                <Tag size={14} aria-hidden="true" /> <span className="hidden xl:inline">Labels</span>
              </button>
            </>
          ) : (
            <div className="seg" role="group" aria-label="Camera">
              {(['iso', 'top', 'front'] as const).map(n => (
                <button key={n} aria-checked={preset.name === n} role="radio" onClick={() => setPreset(p => ({ name: n, n: p.n + 1 }))}>{n === 'iso' ? 'Iso' : n === 'top' ? 'Top' : 'Front'}</button>
              ))}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowFlow(f => !f)} aria-pressed={showFlow} data-tip="Show current flowing while running">
            <Zap size={14} aria-hidden="true" /> <span className="hidden xl:inline">Current</span>
          </button>
          <div className="relative">
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setPanel(p => (p === 'export' ? null : 'export'))} aria-expanded={panel === 'export'} aria-label="Export" data-tip="Export" data-tip-pos="left"><Download size={15} /></button>
            {panel === 'export' && (
              <div className="popover absolute top-9 right-0 z-30 w-[244px] p-1" role="menu">
                {mode === '3d'
                  ? menuItem('3D snapshot (PNG)', <Camera size={14} />, () => exportImage('png'))
                  : <>{menuItem('Image (PNG)', <ImageIcon size={14} />, () => exportImage('png'), undefined, !parts.length)}{menuItem('Drawing (SVG)', <ImageIcon size={14} />, () => exportImage('svg'), undefined, !parts.length)}</>}
                {menuItem('SPICE netlist (.cir)', <FileCode size={14} />, exportNetlist, undefined, !parts.length)}
              </div>
            )}
          </div>
          {mode === '2d' && (
            <>
              <span className="divider-v mx-1" />
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => zoomButton(1 / 1.25)} aria-label="Zoom out" data-tip="Zoom out"><Minus size={15} /></button>
              <button className="btn btn-ghost btn-sm w-14 font-mono text-[11.5px] tabular-nums" onClick={zoomReset} data-tip="Reset zoom">{Math.round(view.k * 100)}%</button>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => zoomButton(1.25)} aria-label="Zoom in" data-tip="Zoom in"><Plus size={15} /></button>
            </>
          )}
          <button className="btn btn-ghost btn-sm btn-icon" onClick={fit} aria-label="Fit to screen" data-tip="Fit to screen  F" data-tip-pos="left"><Maximize2 size={14} /></button>
        </div>

        {/* Workplane */}
        <div ref={wrap} className="workplane relative min-h-0 flex-1 overflow-hidden"
          style={mode === '3d' ? undefined : {
            backgroundImage: 'radial-gradient(circle, var(--grid) 1px, transparent 1.3px)',
            backgroundSize: `${dot}px ${dot}px`,
            backgroundPosition: `${view.x - dot / 2}px ${view.y - dot / 2}px`,
            cursor: drag.current?.kind === 'pan' ? 'grabbing' : tool === 'pan' || space ? 'grab' : wiring ? 'crosshair' : 'default',
            boxShadow: ghost?.over ? 'inset 0 0 0 2px var(--fg-3)' : undefined,
          }}>
          {mode === '3d' ? (
            <Suspense fallback={<p className="absolute inset-0 grid place-items-center text-fg-3">Building the 3D bench…</p>}>
              <Bench3D parts={parts} wires={wires} live={live} running={running} flow={showFlow ? flow : {}} dark={dark} selected={selIds} preset={preset}
                onSelect={id => (id ? selectParts([id]) : setSel(null))}
                onPress={(id, down) => setProp(id, 'pressed', down ? 1 : 0, { skip: true })}
                onToggle={id => { const p = parts.find(x => x.id === id); if (p) setProp(id, 'pos', p.props.pos ? 0 : 1); }} />
            </Suspense>
          ) : (
          <svg ref={svgRef} className="absolute inset-0 h-full w-full" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerOver={onOver}
            onContextMenu={onContext}
            onPointerLeave={() => { setHover(null); setHoverWire(null); if (coordRef.current) coordRef.current.textContent = ''; }}
            role="application" aria-label="Circuit workplane">
            <g data-world="" transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {showMat && <BenchMat x0={mat.x0} y0={mat.y0} x1={mat.x1} y1={mat.y1} />}
              {parts.map(part => {
                const [cx, cy] = pivot(part.type);
                const [x0, y0, x1, y1] = PARTS[part.type].box;
                const lvl = panel === 'check' ? issueParts.get(part.id) : undefined;
                return (
                  <g key={part.id} filter={part.type === 'breadboard' ? undefined : 'url(#xl-lift)'}>
                    <g data-part={part.id} transform={`translate(${part.x} ${part.y}) rotate(${part.rot} ${cx} ${cy})`}
                      style={{ cursor: running ? (part.type === 'button' || part.type === 'switch' ? 'pointer' : 'default') : tool === 'pan' || space ? 'inherit' : 'grab' }}>
                      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="transparent" />
                      <PartArt part={part} live={running ? live[part.id] : undefined} running={running} />
                      {selSet.has(part.id) && (
                        <rect data-noexport="" x={x0 - 5} y={y0 - 5} width={x1 - x0 + 10} height={y1 - y0 + 10} rx={6} fill="none" style={FG} strokeWidth={1.5 / view.k} strokeDasharray={`${5 / view.k} ${4 / view.k}`} pointerEvents="none" />
                      )}
                      {lvl && (
                        <rect data-noexport="" x={x0 - 8} y={y0 - 8} width={x1 - x0 + 16} height={y1 - y0 + 16} rx={8} fill="none" style={{ stroke: lvl === 'error' ? 'var(--bad)' : lvl === 'warn' ? 'var(--warn)' : 'var(--fg-3)' }} strokeWidth={2 / view.k} pointerEvents="none" />
                      )}
                      {noted.has(part.id) && (
                        <g data-noexport="" transform={`translate(${x1} ${y0})`} pointerEvents="none">
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
                const on = sel?.kind === 'wire' && sel.id === w.id;
                const flagged = panel === 'check' && issues.some(i => i.wire === w.id);
                return (
                  <g key={w.id} data-wire={w.id} style={{ cursor: 'pointer' }}>
                    <path d={g.d} stroke="transparent" strokeWidth={12} fill="none" />
                    {flagged && <path data-noexport="" d={g.d} style={{ stroke: 'var(--warn)' }} strokeWidth={9} strokeOpacity={0.45} fill="none" strokeLinecap="round" />}
                    <WireArt a={a} b={b} bend={w.bend} color={w.color} selected={on} />
                    {on && !running && (
                      <circle data-bend={w.id} data-noexport="" cx={g.mid.x} cy={g.mid.y} r={5.5 / view.k}
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

              {/* Insertion preview: exactly where the part will land */}
              {ghost?.over && (
                <g data-noexport="" opacity={0.6} pointerEvents="none" transform={`translate(${ghost.wx} ${ghost.wy})`}>
                  <PartArt part={{ ...thumbPart(ghost.type), x: ghost.wx, y: ghost.wy }} />
                </g>
              )}

              {wiring && pinMap.get(wiring) && (() => {
                const end = magnet ? pinMap.get(magnet)! : mouse;
                return (
                  <g data-noexport="" pointerEvents="none">
                    <path d={wireGeom(pinMap.get(wiring)!, end).d} style={FG} strokeWidth={2.5} strokeDasharray="6 5" fill="none" strokeLinecap="round" />
                    {magnet && <circle cx={end.x} cy={end.y} r={7} fill="none" style={FG} strokeWidth={2} />}
                  </g>
                );
              })()}

              {/* Pin targets sit on top so a wire can start anywhere */}
              <g data-noexport="" style={{ cursor: running ? 'help' : 'crosshair' }}>
                {[...pinMap].map(([r, p]) => <circle key={r} data-pin={r} cx={p.x} cy={p.y} r={5} fill="transparent" />)}
              </g>
              <g data-noexport="">
                {joined.map(r => { const pp = pinMap.get(r); return pp ? <circle key={r} cx={pp.x} cy={pp.y} r={4.6} style={{ fill: 'color-mix(in srgb, var(--canvas) 45%, transparent)', stroke: 'var(--fg)' }} strokeWidth={1.6} pointerEvents="none" /> : null; })}
                {hoverPin && <circle cx={hoverPin.x} cy={hoverPin.y} r={5.5} style={{ fill: 'color-mix(in srgb, var(--fg) 18%, transparent)', stroke: 'var(--fg)' }} strokeWidth={1.4} pointerEvents="none" />}
                {selBox && (
                  <rect x={selBox.x0 - 10} y={selBox.y0 - 10} width={selBox.x1 - selBox.x0 + 20} height={selBox.y1 - selBox.y0 + 20} rx={4} fill="none"
                    style={FG} strokeOpacity={0.5} strokeWidth={1 / view.k} pointerEvents="none" />
                )}
                {marquee && (() => {
                  const right = marquee.x1 >= marquee.x0;
                  return (
                    <rect x={Math.min(marquee.x0, marquee.x1)} y={Math.min(marquee.y0, marquee.y1)} width={Math.abs(marquee.x1 - marquee.x0)} height={Math.abs(marquee.y1 - marquee.y0)}
                      style={{ fill: right ? 'color-mix(in srgb, var(--fg) 8%, transparent)' : 'color-mix(in srgb, var(--ok) 10%, transparent)', stroke: right ? 'var(--fg)' : 'var(--ok)' }}
                      strokeWidth={1 / view.k} strokeDasharray={right ? undefined : `${4 / view.k} ${3 / view.k}`} pointerEvents="none" />
                  );
                })()}
              </g>
            </g>
          </svg>
          )}

          {/* Pin tooltip, with a voltage reading while running */}
          {mode === '2d' && hoverPin && !marquee && (
            <div className="popover pointer-events-none absolute z-10 max-w-80 -translate-x-1/2 -translate-y-full px-2.5 py-1.5 text-[12px]"
              style={{ left: hoverPin.x * view.k + view.x, top: hoverPin.y * view.k + view.y - 12 }}>
              <span className="flex items-baseline gap-2 font-medium whitespace-nowrap">
                {refs.get(hoverPin.part.id) ?? PARTS[hoverPin.part.type].name} · {hoverPin.name}
                {running && <span className="font-mono text-fg">{voltageAt(hover!).toFixed(2)} V</span>}
              </span>
              <span className="block text-fg-3">{joinedText}</span>
            </div>
          )}

          {mode === '2d' && running && hoverWire && !hoverPin && !drag.current && (() => {
            const w = wires.find(x => x.id === hoverWire.id);
            if (!w) return null;
            const amps = flow[w.id] ?? 0;
            const a = pinMap.get(w.from), b = pinMap.get(w.to);
            const name = (pp?: { name: string; part: Part }) => (pp ? `${refs.get(pp.part.id) ?? PARTS[pp.part.type].name} ${pp.name}` : '');
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

          {wiring && <div className="popover absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 text-[12.5px] whitespace-nowrap">Click a pin to finish the wire <span className="kbd ml-2">Esc</span></div>}

          {/* Right-click menu */}
          {menu && (
            <div className="popover absolute z-40 w-[224px] p-1" role="menu" style={{ left: menu.x, top: menu.y }} onPointerDown={e => e.stopPropagation()}>
              {menu.on === 'part' && <>
                {menuItem('Rotate', <RotateCw size={14} />, rotateSel, 'R', !can.sel)}
                {menuItem('Duplicate', <Copy size={14} />, duplicateSel, 'Ctrl D', !gather())}
                {menuItem('Copy', <Copy size={14} />, () => copySel(), 'Ctrl C', !gather())}
                {menuItem('Cut', <Scissors size={14} />, cutSel, 'Ctrl X', !gather())}
                {multi && <div className="border-t border-line px-1 pt-1 pb-0.5">{alignBar}</div>}
                {selPart && <>
                  <div className="my-1 border-t border-line" />
                  {menuItem('See inside, in 3D', <Box size={14} />, () => onLearn(selPart.type))}
                </>}
                <div className="my-1 border-t border-line" />
                {menuItem('Delete', <Trash2 size={14} />, removeSel, 'Del')}
              </>}
              {menu.on === 'wire' && <>
                {selWire?.bend && menuItem('Straighten', <Minus size={14} />, () => update(p => ({ ...p, wires: p.wires.map(w => (w.id === selWire.id ? { ...w, bend: undefined } : w)) })))}
                {menuItem('Delete wire', <Trash2 size={14} />, removeSel, 'Del')}
              </>}
              {menu.on === 'canvas' && <>
                {menuItem('Paste here', <ClipboardPaste size={14} />, () => paste(mouseAtMenu.current), 'Ctrl V', !clip.current)}
                {menuItem('Select all', <BoxSelect size={14} />, selectAll, 'Ctrl A', !parts.length)}
                <div className="my-1 border-t border-line" />
                {menuItem('Fit to screen', <Maximize2 size={14} />, fit, 'F')}
                {menuItem(showMat ? 'Hide the mat' : 'Show the mat', <Grid2x2 size={14} />, () => setShowMat(m => !m))}
                {menuItem(showMap ? 'Hide the minimap' : 'Show the minimap', <MapIcon size={14} />, () => setShowMap(m => !m))}
                {menuItem('View in 3D', <Rotate3d size={14} />, () => setMode('3d'))}
              </>}
            </div>
          )}

          {/* Several parts selected: the group panel */}
          {multi && !running && (
            <div className="popover absolute top-3 right-3 z-20 w-[288px] overflow-hidden">
              <div className="flex h-11 items-center justify-between border-b border-line px-3">
                <h3 className="text-[13px] font-semibold">{selIds.length} parts selected</h3>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSel(null)} aria-label="Clear selection"><X size={15} /></button>
              </div>
              <div className="space-y-3 p-3">
                <div><span className="label">Align and space</span><div className="mt-1.5">{alignBar}</div></div>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-fg-2">
                  {parts.filter(p => selSet.has(p.id)).slice(0, 12).map(p => <span key={p.id} className="chip">{refs.get(p.id) ?? PARTS[p.type].name}</span>)}
                  {selIds.length > 12 && <span className="chip">+{selIds.length - 12}</span>}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button className="btn btn-sm" onClick={rotateSel}><RotateCw size={13} /> Rotate</button>
                  <button className="btn btn-sm" onClick={duplicateSel} disabled={!gather()}><Copy size={13} /> Copy</button>
                  <button className="btn btn-sm" onClick={removeSel}><Trash2 size={13} /> Delete</button>
                </div>
              </div>
            </div>
          )}

          {/* Minimap */}
          {mode === '2d' && showMap && parts.length > 0 && (
            <div className="popover absolute right-3 bottom-3 z-10 hidden overflow-hidden p-0 md:block" data-noexport="">
              <svg width={MAP_W} height={MAP_H} className="block cursor-pointer" aria-label="Minimap"
                onPointerDown={e => { (e.currentTarget as Element).setPointerCapture(e.pointerId); mapTo(e); }}
                onPointerMove={e => { if (e.buttons & 1) mapTo(e); }}>
                <g transform={`translate(${mapOx} ${mapOy}) scale(${mapScale}) translate(${-mat.x0} ${-mat.y0})`}>
                  <rect x={mat.x0} y={mat.y0} width={mat.x1 - mat.x0} height={mat.y1 - mat.y0} rx={28} style={{ fill: 'var(--surface-2)' }} />
                  {parts.map(p => { const b = partBounds(p); return <rect key={p.id} x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} rx={6} style={{ fill: selSet.has(p.id) ? 'var(--fg)' : p.type === 'breadboard' ? 'var(--line-2)' : 'var(--fg-3)' }} />; })}
                  {wires.map(w => { const a = pinMap.get(w.from), b = pinMap.get(w.to); return a && b ? <line key={w.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={w.color} strokeWidth={6} /> : null; })}
                  <rect x={-view.x / view.k} y={-view.y / view.k} width={size.w / view.k} height={size.h / view.k} fill="none" style={FG} strokeWidth={2 / mapScale} />
                </g>
              </svg>
            </div>
          )}

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

          {selPart && !multi && (
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
                {(() => {
                  const a = pinMap.get(selWire.from), b = pinMap.get(selWire.to);
                  const g = a && b ? wireGeom(a, b, selWire.bend) : null;
                  const nm = (pp?: { name: string; part: Part }) => (pp ? `${refs.get(pp.part.id) ?? PARTS[pp.part.type].name} ${pp.name}` : '?');
                  return (
                    <dl className="grid grid-cols-[52px_1fr] gap-x-2 gap-y-1 text-[12px]">
                      <dt className="text-fg-3">From</dt><dd className="truncate font-mono">{nm(a)}</dd>
                      <dt className="text-fg-3">To</dt><dd className="truncate font-mono">{nm(b)}</dd>
                      {g && <><dt className="text-fg-3">Length</dt><dd className="font-mono">{Math.round(g.len * MM_PER_UNIT)} mm jumper</dd></>}
                    </dl>
                  );
                })()}
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
          {mode === '2d' && <span ref={coordRef} className="hidden w-[150px] shrink-0 font-mono text-[11px] text-fg-3 tabular-nums lg:inline" />}
          <span className="hidden shrink-0 tabular-nums sm:inline">{parts.length} parts</span>
          <span className="hidden shrink-0 tabular-nums sm:inline">{wires.length} wires</span>
          <button className="flex shrink-0 items-center gap-1 rounded px-1 hover:text-fg" onClick={onShortcuts} data-tip="Keyboard shortcuts" data-tip-pos="top">
            <Keyboard size={13} aria-hidden="true" /><span className="sr-only">Keyboard shortcuts</span>
          </button>
        </div>
      </div>

      {ghost && !(ghost.over && mode === '2d') && (
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
