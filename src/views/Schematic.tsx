import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LayoutGrid, Maximize2 } from 'lucide-react';
import type { Live, Part, Wire } from '../types';
import { LED_COLORS, PARTS, designators, isBoard, partValue, ref } from '../parts/catalog';
import { buildNets } from '../sim/nets';

/**
 * The schematic: the same circuit drawn with standard symbols instead of
 * pictures. Built from the netlist, so it is always in step with the
 * breadboard. Power and ground use symbols rather than long wires, and
 * every other connection is routed with right-angle lines. Drag symbols to
 * tidy it up; the layout is saved with the project.
 */

interface Props {
  name: string;
  parts: Part[];
  wires: Wire[];
  positions?: Record<string, [number, number]>;
  onMove: (id: string, x: number, y: number, key: string) => void;
  onReset: () => void;
  selected: string[];
  onSelect: (ids: string[]) => void;
  running: boolean;
  live: Record<string, Live>;
  voltageAt: (r: string) => number;
}

type Pt = [number, number];
interface Sym { pins: Record<string, Pt>; w: number; h: number; draw: (p: Part, live?: Live) => ReactNode; box?: boolean }

const HIDDEN = new Set(['breadboard', 'multimeter', 'scope']);
const S = { stroke: 'var(--fg)', fill: 'none', strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const T = (size = 9, fill = 'var(--fg-2)', weight = 500) => ({ fontSize: size, fontFamily: '"Geist Mono", monospace', fill, fontWeight: weight });
const ZIG = 'M-30 0H-18L-15 -6L-9 6L-3 -6L3 6L9 -6L15 6L18 0H30';

const two = (draw: Sym['draw'], a = '1', b = '2'): Sym => ({ pins: { [a]: [-30, 0], [b]: [30, 0] }, w: 60, h: 30, draw });

const SYMBOLS: Partial<Record<Part['type'], Sym>> = {
  resistor: two(() => <path d={ZIG} {...S} />),
  ldr: two(() => <g><path d={ZIG} {...S} /><path d="M-10 -22L-3 -11M-4 -15L-3 -11L-7 -12M2 -22L9 -11M8 -15L9 -11L5 -12" {...S} strokeWidth={1.2} /></g>),
  potentiometer: { pins: { '1': [-30, 0], '2': [30, 0], W: [0, -30] }, w: 60, h: 40, draw: () => <g><path d={ZIG} {...S} /><path d="M0 -30V-9M-4 -14L0 -8L4 -14" {...S} /></g> },
  led: two((p, l) => {
    const on = (l?.b ?? 0) > 0.05;
    const c = LED_COLORS[String(p.props.color)]?.hex ?? '#ef2b2d';
    return (
      <g>
        <path d="M-30 0H-8M8 0H30M8 -9V9" {...S} />
        <path d="M-8 -9L-8 9L8 0Z" style={{ fill: on ? c : 'none', stroke: 'var(--fg)' }} strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M1 -12L8 -20M5 -20H8V-17M7 -9L14 -17M11 -17H14V-14" {...S} strokeWidth={1.2} style={{ stroke: on ? c : 'var(--fg)' }} />
        {on && <circle r={14} fill={c} opacity={0.18 * (l?.b ?? 0)} />}
      </g>
    );
  }, 'A', 'K'),
  diode: two(() => <g><path d="M-30 0H-8M8 0H30M8 -9V9" {...S} /><path d="M-8 -9L-8 9L8 0Z" {...S} /></g>, 'A', 'K'),
  capacitor: two(() => <g><path d="M-30 0H-4M4 0H30M-4 -11V11" {...S} /><path d="M4 -11Q8 0 4 11" {...S} /><path d="M-12 -12H-7M-9.5 -14.5V-9.5" {...S} strokeWidth={1.2} /></g>, '+', '-'),
  battery: { pins: { '+': [0, -30], '-': [0, 30] }, w: 40, h: 60, draw: () => <g><path d="M0 -30V-6M0 6V30M-12 -6H12M-6 0H6M-12 6H12" {...S} /><path d="M-4 6H4" {...S} /><text x={14} y={-10} style={T(10, 'var(--fg)', 700)}>+</text></g> },
  button: { pins: { '1a': [-30, 0], '1b': [-30, 0], '2a': [30, 0], '2b': [30, 0] }, w: 60, h: 34, draw: p => (
    <g>
      <path d="M-30 0H-12M12 0H30" {...S} />
      <circle cx={-12} cy={0} r={2.4} {...S} /><circle cx={12} cy={0} r={2.4} {...S} />
      <path d={p.props.pressed ? 'M-10 -3H10' : 'M-10 -8H10'} {...S} />
      <path d={p.props.pressed ? 'M0 -3V-14M-5 -14H5' : 'M0 -8V-18M-5 -18H5'} {...S} />
    </g>
  ) },
  switch: { pins: { C: [-30, 0], A: [30, -12], B: [30, 12] }, w: 60, h: 40, draw: p => (
    <g>
      <path d="M-30 0H-12M12 -12H30M12 12H30" {...S} />
      <circle cx={-12} cy={0} r={2.4} {...S} /><circle cx={12} cy={-12} r={2.4} {...S} /><circle cx={12} cy={12} r={2.4} {...S} />
      <path d={`M-10 -1L10 ${p.props.pos ? 11 : -11}`} {...S} />
    </g>
  ) },
  npn: { pins: { B: [-30, 0], C: [10, -30], E: [10, 30] }, w: 50, h: 60, draw: () => (
    <g>
      <circle cx={2} cy={0} r={17} {...S} />
      <path d="M-30 0H-5M-5 -10V10M-5 -5L10 -14V-30M-5 5L10 14V30" {...S} />
      <path d="M3 13L10 14L7 8" {...S} />
    </g>
  ) },
  motor: two(() => <g><path d="M-30 0H-14M14 0H30" {...S} /><circle r={14} {...S} /><text y={4} textAnchor="middle" style={T(12, 'var(--fg)', 700)}>M</text></g>, '+', '-'),
  buzzer: two(() => <g><path d="M-30 0H-10M10 0H30M-10 -8H10V8H-10Z" {...S} /><path d="M-6 -8L-12 -18H12L6 -8" {...S} /></g>, '+', '-'),
};

/** Chips, boards and modules: a labelled box with pins down both sides. */
function boxSym(p: Part, supply: string[], signal: string[]): Sym {
  // Power and ground down the left, signals down the right; balance the sides if one is empty.
  let left = supply, right = signal;
  if (!left.length || !right.length) { const all = [...supply, ...signal]; left = all.slice(0, Math.ceil(all.length / 2)); right = all.slice(Math.ceil(all.length / 2)); }
  const rows = Math.max(left.length, right.length, 1);
  const h = rows * 20 + 20, w = 96;
  const out: Record<string, Pt> = {};
  left.forEach((id, i) => { out[id] = [-w / 2 - 20, -h / 2 + 20 + i * 20]; });
  right.forEach((id, i) => { out[id] = [w / 2 + 20, -h / 2 + 20 + i * 20]; });
  const spec = PARTS[p.type];
  const short = (id: string) => spec.pins.find(x => x.id === id)?.id ?? id;
  return {
    pins: out, w: w + 40, h, box: true,
    draw: () => (
      <g>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} style={{ fill: 'var(--surface)', stroke: 'var(--fg)' }} strokeWidth={1.6} />
        {left.map((id, i) => <g key={id}><path d={`M${-w / 2 - 20} ${-h / 2 + 20 + i * 20}H${-w / 2}`} {...S} /><text x={-w / 2 + 5} y={-h / 2 + 23 + i * 20} style={T(8.5)}>{short(id)}</text></g>)}
        {right.map((id, i) => <g key={id}><path d={`M${w / 2} ${-h / 2 + 20 + i * 20}H${w / 2 + 20}`} {...S} /><text x={w / 2 - 5} y={-h / 2 + 23 + i * 20} textAnchor="end" style={T(8.5)}>{short(id)}</text></g>)}
      </g>
    ),
  };
}

/** Prim's minimum spanning tree over Manhattan distance: the shortest way to join a net's pins. */
function mst(pts: Pt[]): [number, number][] {
  if (pts.length < 2) return [];
  const inTree = new Set([0]);
  const edges: [number, number][] = [];
  while (inTree.size < pts.length) {
    let best: [number, number] | null = null, bd = Infinity;
    for (const i of inTree) for (let j = 0; j < pts.length; j++) {
      if (inTree.has(j)) continue;
      const d = Math.abs(pts[i][0] - pts[j][0]) + Math.abs(pts[i][1] - pts[j][1]);
      if (d < bd) { bd = d; best = [i, j]; }
    }
    if (!best) break;
    inTree.add(best[1]);
    edges.push(best);
  }
  return edges;
}

export default function Schematic(props: Props) {
  const { name, parts, wires, positions, onMove, onReset, selected, onSelect, running, live, voltageAt } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 60, y: 60, k: 1 });
  const drag = useRef<{ kind: 'pan'; sx: number; sy: number; vx: number; vy: number } | { kind: 'move'; id: string; ox: number; oy: number; px: number; py: number; key: string } | null>(null);
  const seq = useRef(0);
  const refs = useMemo(() => designators(parts), [parts]);

  const model = useMemo(() => {
    const nets = buildNets(parts, wires);
    const shown = parts.filter(p => !HIDDEN.has(p.type));
    const pinInfo = new Map<string, { part: Part; kind: string; id: string }>();
    for (const p of parts) for (const pin of PARTS[p.type].pins) pinInfo.set(ref(p.id, pin.id), { part: p, kind: pin.kind, id: pin.id });
    const visiblePart = (r: string) => { const q = pinInfo.get(r); return q && !HIDDEN.has(q.part.type) ? q : null; };
    /** A pin matters if its net reaches another visible part. */
    const used = (r: string) => nets.group(r).some(o => o !== r && visiblePart(o) && visiblePart(o)!.part.id !== pinInfo.get(r)?.part.id);

    const syms = new Map<string, Sym>();
    for (const p of shown) {
      const known = SYMBOLS[p.type];
      if (known) { syms.set(p.id, known); continue; }
      let pinIds = PARTS[p.type].pins.map(x => x.id).filter(id => (isBoard(p.type) ? used(ref(p.id, id)) : true));
      if (isBoard(p.type)) {
        // One pin per net (a board has several GND pins joined inside), power on the left, signals on the right.
        const seen = new Set<string>();
        pinIds = pinIds.filter(id => { const r = nets.root(ref(p.id, id)); if (seen.has(r)) return false; seen.add(r); return true; });
      }
      const kindOf = (id: string) => PARTS[p.type].pins.find(x => x.id === id)?.kind ?? '';
      const supply = pinIds.filter(id => kindOf(id) === 'power' || kindOf(id) === 'ground');
      const signal = pinIds.filter(id => !supply.includes(id));
      syms.set(p.id, pinIds.length ? boxSym(p, supply, signal) : boxSym(p, [], PARTS[p.type].pins.slice(0, 2).map(x => x.id)));
    }

    // Automatic layout: boards and chips down the left, everything else in a grid ordered like the breadboard.
    const pos = new Map<string, Pt>();
    let by = 0;
    const boxes = shown.filter(p => syms.get(p.id)!.box).sort((a, b) => Number(isBoard(b.type)) - Number(isBoard(a.type)));
    for (const p of boxes) { const h = syms.get(p.id)!.h; pos.set(p.id, [0, by + h / 2]); by += h + 60; }
    const rest = shown.filter(p => !syms.get(p.id)!.box).sort((a, b) => a.x - b.x || a.y - b.y);
    const x0 = boxes.length ? 240 : 0;
    rest.forEach((p, i) => pos.set(p.id, [x0 + (i % 4) * 150, Math.floor(i / 4) * 130]));
    for (const p of shown) { const s = positions?.[p.id]; if (s) pos.set(p.id, s); }

    // Nets: what each one is, and where its visible pins sit.
    const groups = new Map<string, { pts: Pt[]; refs: string[]; ground: boolean; supply: string | null }>();
    for (const p of shown) {
      const sym = syms.get(p.id)!, [px, py] = pos.get(p.id)!;
      for (const [pid, [dx, dy]] of Object.entries(sym.pins)) {
        const r = ref(p.id, pid);
        if (!pinInfo.has(r)) continue;
        const root = nets.root(r);
        let g = groups.get(root);
        if (!g) {
          let ground = false, supply: string | null = null;
          for (const o of nets.group(r)) {
            const q = pinInfo.get(o);
            if (!q || !(isBoard(q.part.type) || q.part.type === 'battery')) continue;
            if (q.kind === 'ground') ground = true;
            if (q.kind === 'power') supply = q.part.type === 'battery' ? '+9V' : q.id;
          }
          g = { pts: [], refs: [], ground, supply: ground ? null : supply };
          groups.set(root, g);
        }
        // Pins that share a spot (the two halves of a button) count once.
        if (!g.pts.some(([x, y]) => x === px + dx && y === py + dy)) { g.pts.push([px + dx, py + dy]); g.refs.push(r); }
      }
    }
    return { shown, syms, pos, groups, nets };
  }, [parts, wires, positions]);

  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el || !model.shown.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of model.shown) {
      const [x, y] = model.pos.get(p.id)!, s = model.syms.get(p.id)!;
      x0 = Math.min(x0, x - s.w / 2 - 30); x1 = Math.max(x1, x + s.w / 2 + 30); y0 = Math.min(y0, y - s.h / 2 - 40); y1 = Math.max(y1, y + s.h / 2 + 40);
    }
    const r = el.getBoundingClientRect();
    const k = Math.min(2, Math.max(0.3, Math.min((r.width - 80) / (x1 - x0), (r.height - 80) / (y1 - y0))));
    setView({ k, x: (r.width - (x0 + x1) * k) / 2, y: (r.height - (y0 + y1) * k) / 2 });
  }, [model]);
  const fitOnce = useRef(false);
  useEffect(() => { if (!fitOnce.current && model.shown.length) { fitOnce.current = true; fit(); } }, [fit, model.shown.length]);

  useEffect(() => {
    const el = wrap.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
      setView(v => { const k = Math.min(4, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0015))); return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) }; });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  const world = (e: React.PointerEvent) => { const r = wrap.current!.getBoundingClientRect(); return [(e.clientX - r.left - view.x) / view.k, (e.clientY - r.top - view.y) / view.k] as Pt; };
  const down = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const id = (e.target as Element).closest<SVGElement>('[data-sym]')?.dataset.sym;
    if (!id || e.button === 1) { if (!id) onSelect([]); drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return; }
    onSelect(e.shiftKey ? (selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]) : [id]);
    const [wx, wy] = world(e), [px, py] = model.pos.get(id)!;
    drag.current = { kind: 'move', id, ox: wx, oy: wy, px, py, key: `sch:${++seq.current}` };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pan') { setView(v => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy })); return; }
    const [wx, wy] = world(e);
    const nx = Math.round((d.px + wx - d.ox) / 10) * 10, ny = Math.round((d.py + wy - d.oy) / 10) * 10;
    const cur = model.pos.get(d.id)!;
    if (cur[0] !== nx || cur[1] !== ny) onMove(d.id, nx, ny, d.key);
  };
  const up = () => { drag.current = null; };

  const groups = [...model.groups.values()];
  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden" style={{ background: 'var(--canvas)', backgroundImage: 'radial-gradient(circle, var(--grid) 0.8px, transparent 1px)', backgroundSize: `${20 * view.k}px ${20 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}>
      <svg className="absolute inset-0 h-full w-full touch-none select-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Schematic">
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* Wires: right-angle routes along each net's spanning tree */}
          {groups.map((g, gi) => {
            if (g.ground || g.supply || g.pts.length < 2) return null;
            const edges = mst(g.pts);
            const deg = new Map<number, number>();
            edges.forEach(([a, b]) => { deg.set(a, (deg.get(a) ?? 0) + 1); deg.set(b, (deg.get(b) ?? 0) + 1); });
            const label = running ? voltageAt(g.refs[0]) : null;
            return (
              <g key={gi}>
                {edges.map(([a, b], i) => <path key={i} d={`M${g.pts[a][0]} ${g.pts[a][1]}H${g.pts[b][0]}V${g.pts[b][1]}`} {...S} strokeWidth={1.4} />)}
                {[...deg].filter(([, n]) => n > 1).map(([i]) => <circle key={`j${i}`} cx={g.pts[i][0]} cy={g.pts[i][1]} r={3} style={{ fill: 'var(--fg)' }} />)}
                {label !== null && Number.isFinite(label) && edges.length > 0 && (
                  <g transform={`translate(${(g.pts[edges[0][0]][0] + g.pts[edges[0][1]][0]) / 2 - 20} ${g.pts[edges[0][0]][1] - 7})`}>
                    <rect x={-2} y={-9} width={42} height={12} rx={3} style={{ fill: 'var(--pop)', stroke: 'var(--line-2)' }} strokeWidth={0.8} />
                    <text x={2} y={0} style={T(8.5, 'var(--fg)', 600)}>{label.toFixed(2)} V</text>
                  </g>
                )}
              </g>
            );
          })}
          {/* Ground and supply symbols at each pin, instead of long wires */}
          {groups.map((g, gi) => (g.ground || g.supply) && g.pts.map(([x, y], i) => (
            <g key={`${gi}-${i}`} transform={`translate(${x} ${y})`}>
              {g.ground
                ? <path d="M0 0V12M-9 12H9M-6 16H6M-3 20H3" {...S} strokeWidth={1.4} />
                : <g><path d="M0 0V-12M-7 -12H7" {...S} strokeWidth={1.4} /><text y={-16} textAnchor="middle" style={T(8.5, 'var(--fg)', 700)}>{g.supply}</text></g>}
            </g>
          )))}
          {/* Symbols */}
          {model.shown.map(p => {
            const s = model.syms.get(p.id)!, [x, y] = model.pos.get(p.id)!;
            const on = selected.includes(p.id);
            const val = p.type === 'resistor' || p.type === 'capacitor' || p.type === 'custom' ? partValue(p) : s.box ? PARTS[p.type].name : '';
            return (
              <g key={p.id} data-sym={p.id} transform={`translate(${x} ${y})`} style={{ cursor: 'move' }}>
                <rect x={-s.w / 2 - 6} y={-s.h / 2 - 6} width={s.w + 12} height={s.h + 12} rx={6} fill="transparent"
                  style={on ? { stroke: 'var(--fg)', strokeDasharray: '4 3' } : undefined} strokeWidth={1} />
                {s.draw(p, running ? live[p.id] : undefined)}
                <text x={s.box ? 0 : 0} y={-s.h / 2 - 10} textAnchor="middle" style={T(9.5, 'var(--fg)', 700)}>{refs.get(p.id)}</text>
                {val && <text x={0} y={s.h / 2 + 16} textAnchor="middle" style={T(8.5)}>{val}</text>}
              </g>
            );
          })}
          {/* Unconnected pins get an X, like a no-connect marker */}
          {model.shown.map(p => {
            const s = model.syms.get(p.id)!, [x, y] = model.pos.get(p.id)!;
            return Object.entries(s.pins).map(([pid, [dx, dy]]) => {
              const g = model.groups.get(model.nets.root(ref(p.id, pid)));
              if (!g || g.pts.length > 1 || g.ground || g.supply) return null;
              return <path key={`${p.id}${pid}`} d={`M${x + dx - 3} ${y + dy - 3}l6 6m0 -6l-6 6`} style={{ stroke: 'var(--fg-3)' }} strokeWidth={1.2} />;
            });
          })}
        </g>
      </svg>

      {!model.shown.length && <p className="absolute inset-0 grid place-items-center text-[13px] text-fg-3">Add parts on the 2D view and their schematic appears here.</p>}

      {/* Title block, like a drawing sheet */}
      <div className="pointer-events-none absolute right-3 bottom-3 hidden overflow-hidden rounded-md border border-line-2 bg-surface/90 font-mono text-[10px] text-fg-3 backdrop-blur md:block">
        <div className="grid grid-cols-[auto_1fr]">
          <span className="border-r border-b border-line px-2 py-1">TITLE</span><span className="truncate border-b border-line px-2 py-1 text-fg">{name}</span>
          <span className="border-r border-b border-line px-2 py-1">PARTS</span><span className="border-b border-line px-2 py-1">{model.shown.length} · nets {groups.filter(g => g.pts.length > 1 || g.ground || g.supply).length}</span>
          <span className="border-r border-line px-2 py-1">SHEET</span><span className="px-2 py-1">1 / 1 · XavierLabs IDE</span>
        </div>
      </div>
      <div className="absolute top-3 left-3 flex gap-1">
        <button className="btn btn-sm bg-surface" onClick={fit}><Maximize2 size={13} /> Fit</button>
        <button className="btn btn-sm bg-surface" onClick={() => { onReset(); setTimeout(fit, 0); }} data-tip="Forget moved symbols"><LayoutGrid size={13} /> Auto layout</button>
      </div>
      <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-surface/80 px-2 py-1 text-[11px] text-fg-3 backdrop-blur">Generated from the breadboard. Drag symbols to tidy, scroll to zoom.</p>
    </div>
  );
}
