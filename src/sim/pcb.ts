import type { Project } from '../types';
import { MM_PER_UNIT, PARTS, designators, isBoard, partBounds, pinPos, ref } from '../parts/catalog';
import { buildNets } from './nets';

/**
 * Breadboard to PCB: every leg becomes a pad at exactly the spot it sits on
 * the breadboard (the workplane is drawn to true 2.54 mm scale), every
 * breadboard strip and jumper becomes copper, and an Arduino becomes a
 * shield-style set of header pads that line up with the real board.
 *
 * It is a single-layer draft with straight right-angle routes, so traces of
 * different nets can cross; those crossings are counted so they can be
 * fixed with a jumper or in a full PCB tool.
 */

export interface Pad { x: number; y: number; d: number; drill: number; net: number; part: string }
export interface Track { pts: [number, number][]; net: number }
export interface Silk { label: string; x: number; y: number; w: number; h: number }
export interface Pcb { w: number; h: number; pads: Pad[]; tracks: Track[]; silk: Silk[]; nets: number; crossings: number }

const SKIP = new Set(['breadboard', 'multimeter', 'scope']);
const MARGIN = 4;

export function buildPcb(p: Project): Pcb | null {
  const nets = buildNets(p.parts, p.wires);
  const names = designators(p.parts);
  const parts = p.parts.filter(x => !SKIP.has(x.type));
  const raw: (Omit<Pad, 'net'> & { root: string })[] = [];
  const partOf = new Map<string, string>();
  for (const part of p.parts) for (const pin of PARTS[part.type].pins) partOf.set(ref(part.id, pin.id), part.id);
  for (const part of parts) {
    for (const pin of PARTS[part.type].pins) {
      const r = ref(part.id, pin.id);
      // On a board, only the header pins something is wired to.
      if (isBoard(part.type) && !nets.group(r).some(o => { const q = partOf.get(o); return q && q !== part.id && !SKIP.has(p.parts.find(x => x.id === q)!.type); })) continue;
      const w = pinPos(part, pin);
      raw.push({ x: w.x * MM_PER_UNIT, y: w.y * MM_PER_UNIT, d: isBoard(part.type) ? 1.7 : 1.8, drill: isBoard(part.type) ? 1.0 : 0.9, part: part.id, root: nets.root(r) });
    }
  }
  if (!raw.length) return null;
  const x0 = Math.min(...raw.map(q => q.x)) - MARGIN, y0 = Math.min(...raw.map(q => q.y)) - MARGIN;
  const x1 = Math.max(...raw.map(q => q.x)) + MARGIN, y1 = Math.max(...raw.map(q => q.y)) + MARGIN;
  const ids = new Map<string, number>();
  const pads: Pad[] = raw.map(({ root, ...q }) => {
    if (!ids.has(root)) ids.set(root, ids.size + 1);
    return { ...q, x: +(q.x - x0).toFixed(3), y: +(q.y - y0).toFixed(3), net: ids.get(root)! };
  });

  // Route each net as a right-angle spanning tree.
  const tracks: Track[] = [];
  const byNet = new Map<number, Pad[]>();
  for (const pad of pads) { const l = byNet.get(pad.net) ?? []; l.push(pad); byNet.set(pad.net, l); }
  let used = 0;
  for (const [net, list] of byNet) {
    const uniq = list.filter((q, i) => list.findIndex(o => Math.abs(o.x - q.x) < 0.01 && Math.abs(o.y - q.y) < 0.01) === i);
    if (uniq.length < 2) continue;
    used++;
    const inTree = new Set([0]);
    while (inTree.size < uniq.length) {
      let best: [number, number] | null = null, bd = Infinity;
      for (const i of inTree) for (let j = 0; j < uniq.length; j++) {
        if (inTree.has(j)) continue;
        const d = Math.abs(uniq[i].x - uniq[j].x) + Math.abs(uniq[i].y - uniq[j].y);
        if (d < bd) { bd = d; best = [i, j]; }
      }
      if (!best) break;
      inTree.add(best[1]);
      const a = uniq[best[0]], b = uniq[best[1]];
      tracks.push({ net, pts: a.x === b.x || a.y === b.y ? [[a.x, a.y], [b.x, b.y]] : [[a.x, a.y], [b.x, a.y], [b.x, b.y]] });
    }
  }

  const silk: Silk[] = parts.map(part => {
    const b = partBounds(part);
    return { label: names.get(part.id) ?? part.type, x: b.x0 * MM_PER_UNIT - x0, y: b.y0 * MM_PER_UNIT - y0, w: (b.x1 - b.x0) * MM_PER_UNIT, h: (b.y1 - b.y0) * MM_PER_UNIT };
  }).filter(s => s.x > -s.w && s.y > -s.h);

  return { w: +(x1 - x0).toFixed(2), h: +(y1 - y0).toFixed(2), pads, tracks, silk, nets: used, crossings: countCrossings(tracks) };
}

type Seg = { a: [number, number]; b: [number, number]; net: number };
function countCrossings(tracks: Track[]) {
  const segs: Seg[] = [];
  for (const t of tracks) for (let i = 1; i < t.pts.length; i++) segs.push({ a: t.pts[i - 1], b: t.pts[i], net: t.net });
  let n = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], t = segs[j];
    if (s.net === t.net) continue;
    const sh = s.a[1] === s.b[1], th = t.a[1] === t.b[1];
    if (sh === th) {
      // Parallel: overlapping on the same line is a short.
      const same = sh ? s.a[1] === t.a[1] : s.a[0] === t.a[0];
      if (!same) continue;
      const [s0, s1] = sh ? [Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])] : [Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])];
      const [t0, t1] = sh ? [Math.min(t.a[0], t.b[0]), Math.max(t.a[0], t.b[0])] : [Math.min(t.a[1], t.b[1]), Math.max(t.a[1], t.b[1])];
      if (Math.min(s1, t1) - Math.max(s0, t0) > 0.01) n++;
      continue;
    }
    const h = sh ? s : t, v = sh ? t : s;
    const hx0 = Math.min(h.a[0], h.b[0]), hx1 = Math.max(h.a[0], h.b[0]), vy0 = Math.min(v.a[1], v.b[1]), vy1 = Math.max(v.a[1], v.b[1]);
    if (v.a[0] > hx0 + 0.01 && v.a[0] < hx1 - 0.01 && h.a[1] > vy0 + 0.01 && h.a[1] < vy1 - 0.01) n++;
  }
  return n;
}

// ---------- Fabrication files ----------

const g = (mm: number) => Math.round(mm * 1e6).toString();

function header(name: string) {
  return `G04 ${name}, made with XavierLabs IDE*\n%FSLAX46Y46*%\n%MOMM*%\n%LPD*%\n`;
}

/** Front copper: pads flashed, tracks drawn. Gerber's Y axis points up, so it is flipped. */
export function gerberCopper(b: Pcb) {
  const sizes = [...new Set(b.pads.map(p => p.d))];
  let out = header('Top copper') + '%TF.FileFunction,Copper,L1,Top*%\n';
  sizes.forEach((d, i) => { out += `%ADD${10 + i}C,${d.toFixed(3)}*%\n`; });
  out += `%ADD${10 + sizes.length}C,0.500*%\n`;
  sizes.forEach((d, i) => {
    out += `D${10 + i}*\n`;
    for (const p of b.pads) if (p.d === d) out += `X${g(p.x)}Y${g(b.h - p.y)}D03*\n`;
  });
  out += `D${10 + sizes.length}*\n`;
  for (const t of b.tracks) t.pts.forEach(([x, y], i) => { out += `X${g(x)}Y${g(b.h - y)}D0${i ? 1 : 2}*\n`; });
  return out + 'M02*\n';
}

export function gerberOutline(b: Pcb) {
  let out = header('Board outline') + '%TF.FileFunction,Profile,NP*%\n%ADD10C,0.150*%\nD10*\n';
  [[0, 0], [b.w, 0], [b.w, b.h], [0, b.h], [0, 0]].forEach(([x, y], i) => { out += `X${g(x)}Y${g(y)}D0${i ? 1 : 2}*\n`; });
  return out + 'M02*\n';
}

export function gerberSilk(b: Pcb) {
  let out = header('Top silkscreen') + '%TF.FileFunction,Legend,Top*%\n%ADD10C,0.150*%\nD10*\n';
  for (const s of b.silk) {
    [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h], [s.x, s.y]].forEach(([x, y], i) => { out += `X${g(x)}Y${g(b.h - y)}D0${i ? 1 : 2}*\n`; });
  }
  return out + 'M02*\n';
}

/** Excellon drill file for the plated through-holes. */
export function excellon(b: Pcb) {
  const tools = [...new Set(b.pads.map(p => p.drill))];
  let out = 'M48\n; made with XavierLabs IDE\nMETRIC,TZ\n';
  tools.forEach((d, i) => { out += `T${i + 1}C${d.toFixed(3)}\n`; });
  out += '%\nG90\nG05\n';
  tools.forEach((d, i) => {
    out += `T${i + 1}\n`;
    for (const p of b.pads) if (p.drill === d) out += `X${p.x.toFixed(3)}Y${(b.h - p.y).toFixed(3)}\n`;
  });
  return out + 'M30\n';
}
