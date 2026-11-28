import type { Probe } from '../types';

/** Probe colours: bright and distinct on both themes, like the channels on a real scope. */
export const PROBE_COLORS = ['#f5c518', '#22d3ee', '#e879f9', '#4ade80', '#fb923c', '#60a5fa', '#f87171', '#a3e635'];

/** The next free label (P1, P2 ...) and colour for a new probe. */
export function nextProbe(existing: Probe[]): { label: string; color: string } {
  const used = new Set(existing.map(p => p.label));
  let n = 1;
  while (used.has(`P${n}`)) n++;
  const colors = new Set(existing.map(p => p.color));
  const color = PROBE_COLORS.find(c => !colors.has(c)) ?? PROBE_COLORS[(n - 1) % PROBE_COLORS.length];
  return { label: `P${n}`, color };
}

export interface Trace { t: number[]; v: number[] }

/**
 * Keeps the recent voltage history of every probe while the simulation runs,
 * in simulated milliseconds. Lives outside React so recording every frame
 * costs nothing until something draws it.
 */
export class ProbeRecorder {
  private data = new Map<string, Trace>();
  private max: number;
  constructor(max = 2400) { this.max = max; }

  push(id: string, t: number, v: number) {
    let tr = this.data.get(id);
    if (!tr) { tr = { t: [], v: [] }; this.data.set(id, tr); }
    // A restarted simulation starts its clock again: begin a fresh trace.
    if (tr.t.length && t < tr.t[tr.t.length - 1]) { tr.t.length = 0; tr.v.length = 0; }
    tr.t.push(t);
    tr.v.push(v);
    if (tr.t.length > this.max) { tr.t.splice(0, tr.t.length - this.max); tr.v.splice(0, tr.v.length - this.max); }
  }

  get(id: string): Trace | undefined { return this.data.get(id); }
  clear() { this.data.clear(); }
  forget(keep: Set<string>) { for (const id of this.data.keys()) if (!keep.has(id)) this.data.delete(id); }
}

/** Statistics over the part of a trace inside [from, to]. Frequency counts rising crossings of the midpoint. */
export function stats(tr: Trace | undefined, from: number, to: number) {
  if (!tr || !tr.t.length) return null;
  let min = Infinity, max = -Infinity, sum = 0, n = 0;
  let i0 = tr.t.findIndex(t => t >= from);
  if (i0 < 0) i0 = tr.t.length - 1;
  for (let i = i0; i < tr.t.length && tr.t[i] <= to; i++) { const v = tr.v[i]; min = Math.min(min, v); max = Math.max(max, v); sum += v; n++; }
  if (!n) return null;
  const mid = (min + max) / 2;
  let rises = 0, first = -1, last = -1;
  if (max - min > 0.2) {
    for (let i = i0 + 1; i < tr.t.length && tr.t[i] <= to; i++) {
      if (tr.v[i - 1] < mid && tr.v[i] >= mid) { rises++; if (first < 0) first = tr.t[i]; last = tr.t[i]; }
    }
  }
  const hz = rises >= 2 && last > first ? ((rises - 1) * 1000) / (last - first) : null;
  return { min, max, avg: sum / n, now: tr.v[tr.v.length - 1], hz };
}

/**
 * A trace read as a logic signal: the threshold sits halfway between its
 * lowest and highest value (or at 2.5 V for a flat trace), then every
 * crossing is an edge. Gives what a logic analyzer reports.
 */
export function logic(tr: Trace | undefined, from: number, to: number) {
  if (!tr || !tr.t.length) return null;
  let min = Infinity, max = -Infinity;
  let i0 = tr.t.findIndex(t => t >= from);
  if (i0 < 0) i0 = tr.t.length - 1;
  i0 = Math.max(0, i0 - 1);
  for (let i = i0; i < tr.t.length && tr.t[i] <= to; i++) { min = Math.min(min, tr.v[i]); max = Math.max(max, tr.v[i]); }
  const th = max - min < 0.3 ? 2.5 : (min + max) / 2;
  const edges: { t: number; up: boolean }[] = [];
  let level = tr.v[i0] >= th;
  const start = level;
  for (let i = i0 + 1; i < tr.t.length && tr.t[i] <= to; i++) {
    const now = tr.v[i] >= th;
    if (now !== level) { edges.push({ t: tr.t[i], up: now }); level = now; }
  }
  const highs: number[] = [], lows: number[] = [], periods: number[] = [];
  for (let k = 1; k < edges.length; k++) {
    const d = edges[k].t - edges[k - 1].t;
    (edges[k - 1].up ? highs : lows).push(d);
    if (k >= 2 && edges[k].up === edges[k - 2].up) periods.push(edges[k].t - edges[k - 2].t);
  }
  const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const period = mean(periods), high = mean(highs), low = mean(lows);
  return {
    th, start, edges, high, low, period,
    hz: period ? 1000 / period : null,
    duty: high !== null && low !== null ? high / (high + low) : null,
  };
}
