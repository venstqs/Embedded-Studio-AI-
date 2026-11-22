import type { Part } from '../types';
import { PARTS, pinPos, ref } from '../parts/catalog';

/**
 * Which pins are electrically the same point: joined by wires, by the metal
 * strips inside a breadboard or a board, or by a leg pushed into a hole.
 * `redundant` lists wires whose two ends were already joined without them.
 */
export function buildNets(parts: Part[], wires: { id?: string; from: string; to: string }[]) {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) { const n = parent.get(c)!; parent.set(c, r); c = n; }
    return r;
  };
  const join = (a: string, b: string) => {
    if (!parent.has(a) || !parent.has(b)) return false;
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    parent.set(ra, rb);
    return true;
  };
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
  /** Pins of parts pushed into a breadboard hole, mapped to that hole. */
  const seated = new Map<string, string>();
  for (const part of parts) {
    if (part.type === 'breadboard') continue;
    for (const pin of PARTS[part.type].pins) {
      const w = pinPos(part, pin);
      const hole = holes.get(key(w.x, w.y));
      if (hole) { join(ref(part.id, pin.id), hole); seated.set(ref(part.id, pin.id), hole); }
    }
  }
  const redundant: string[] = [];
  for (const w of wires) if (parent.has(w.from) && parent.has(w.to) && !join(w.from, w.to) && w.id) redundant.push(w.id);
  const members = new Map<string, string[]>();
  for (const r of parent.keys()) { const root = find(r); const list = members.get(root); if (list) list.push(r); else members.set(root, [r]); }
  return {
    root: (r: string) => (parent.has(r) ? find(r) : r),
    group: (r: string) => (parent.has(r) ? members.get(find(r)) ?? [r] : [r]),
    seated,
    redundant,
  };
}
export type Nets = ReturnType<typeof buildNets>;
