import { LED_COLORS, parseSI } from '../parts/catalog.ts';

/**
 * Custom chips: an 8-pin part whose insides you describe in a few lines,
 * like a tiny SPICE netlist. The simulator builds those elements into the
 * circuit, so the chip behaves for real.
 *
 *   R  a b 220        resistor (ohms, SI suffixes: 4k7, 10k, 1M)
 *   D  a k [0.7]      diode, anode to cathode, forward voltage
 *   Z  a k 5.1        zener-style clamp: conducts from a to k above that voltage
 *   LED a k [red]     LED (green, blue, yellow, white...)
 *   V  + - 5 [1]      voltage source with an internal resistance in ohms
 *   C  + - 100u       capacitor
 *
 * Nodes are pin numbers (P1..P8), pin names you gave, or internal nodes
 * written with a leading underscore (_n1) that never leave the chip.
 */

export const CHIP_PINS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'] as const;

export type ChipEl =
  | { k: 'R'; a: string; b: string; ohms: number }
  | { k: 'D'; a: string; b: string; vf: number; ron: number }
  | { k: 'V'; a: string; b: string; v: number; r: number }
  | { k: 'C'; a: string; b: string; f: number };

export interface ParsedChip { els: ChipEl[]; errors: string[]; internal: string[] }

export function pinNames(props: Record<string, number | string>): string[] {
  const names = String(props.pins ?? '').split(',').map(s => s.trim());
  return CHIP_PINS.map((p, i) => names[i] || p);
}

const cache = new Map<string, ParsedChip>();

export function parseChip(src: string, names: string[]): ParsedChip {
  const key = `${names.join(',')}\n${src}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const els: ChipEl[] = [];
  const errors: string[] = [];
  const internal = new Set<string>();
  const byName = new Map<string, string>();
  names.forEach((n, i) => { byName.set(n.toLowerCase(), CHIP_PINS[i]); byName.set(CHIP_PINS[i].toLowerCase(), CHIP_PINS[i]); byName.set(String(i + 1), CHIP_PINS[i]); });
  const node = (tok: string | undefined, line: number): string | null => {
    if (!tok) { errors.push(`Line ${line}: missing a pin.`); return null; }
    if (tok.startsWith('_')) { internal.add(tok); return tok; }
    const p = byName.get(tok.toLowerCase());
    if (!p) errors.push(`Line ${line}: “${tok}” is not a pin. Use P1 to P8, a pin name, or _name for an inside node.`);
    return p ?? null;
  };
  const num = (tok: string | undefined, line: number, what: string, fallback?: number): number | null => {
    if (tok === undefined) { if (fallback !== undefined) return fallback; errors.push(`Line ${line}: needs a ${what}.`); return null; }
    const v = parseSI(tok);
    if (v === null || !Number.isFinite(v) || v <= 0) { errors.push(`Line ${line}: “${tok}” is not a ${what}.`); return null; }
    return v;
  };
  src.split('\n').forEach((raw, i) => {
    const line = i + 1;
    const text = raw.replace(/[#;].*$/, '').trim();
    if (!text) return;
    const [kind, t1, t2, t3, t4] = text.split(/\s+/);
    const k = kind.toUpperCase();
    const a = node(t1, line), b = node(t2, line);
    if (!a || !b) return;
    if (a === b) { errors.push(`Line ${line}: both ends are the same pin.`); return; }
    if (k === 'R') { const ohms = num(t3, line, 'resistance'); if (ohms) els.push({ k: 'R', a, b, ohms }); }
    else if (k === 'D') { const vf = num(t3, line, 'forward voltage', 0.7); if (vf) els.push({ k: 'D', a, b, vf, ron: 0.5 }); }
    else if (k === 'Z') { const vf = num(t3, line, 'clamp voltage'); if (vf) els.push({ k: 'D', a, b, vf, ron: 1 }); }
    else if (k === 'LED') {
      const color = (t3 ?? 'red').toLowerCase();
      const c = LED_COLORS[color];
      if (!c) errors.push(`Line ${line}: unknown LED colour “${t3}”. Try ${Object.keys(LED_COLORS).join(', ')}.`);
      else els.push({ k: 'D', a, b, vf: c.vf, ron: 9 });
    }
    else if (k === 'V') { const v = num(t3, line, 'voltage'); const r = num(t4, line, 'resistance', 1); if (v && r) els.push({ k: 'V', a, b, v, r }); }
    else if (k === 'C') { const f = num(t3, line, 'capacitance'); if (f) els.push({ k: 'C', a, b, f }); }
    else errors.push(`Line ${line}: “${kind}” isn’t an element. Use R, D, Z, LED, V or C.`);
  });
  const out = { els, errors, internal: [...internal] };
  if (cache.size > 200) cache.clear();
  cache.set(key, out);
  return out;
}

export const CHIP_TEMPLATES: { id: string; name: string; pins: string; def: string }[] = [
  {
    id: 'led-r', name: 'LED with a built-in resistor', pins: 'A,K,P3,P4,P5,P6,P7,P8',
    def: '# An LED with its resistor hidden inside.\n# Wire A to + (5 V) and K to ground.\nR A _mid 220\nLED _mid K red',
  },
  {
    id: 'zener', name: 'Zener 5 V regulator', pins: 'GND,P2,OUT,P4,P5,P6,P7,IN',
    def: '# A simple shunt regulator: IN (9 V) in, about 5 V out.\nR IN OUT 100\nZ OUT GND 5.1',
  },
  {
    id: 'divider', name: 'Voltage divider (half)', pins: 'GND,P2,P3,MID,P5,P6,P7,TOP',
    def: '# Two equal resistors: MID sits at half of TOP.\nR TOP MID 10k\nR MID GND 10k',
  },
  {
    id: 'bar', name: 'Four-LED light bar', pins: 'L1,L2,L3,L4,GND,P6,P7,P8',
    def: '# Four LEDs, each with its own resistor, sharing GND.\nR L1 _a 330\nLED _a GND red\nR L2 _b 330\nLED _b GND yellow\nR L3 _c 330\nLED _c GND green\nR L4 _d 330\nLED _d GND blue',
  },
  {
    id: 'rc', name: 'RC delay (slow rise)', pins: 'IN,P2,P3,P4,OUT,P6,P7,GND',
    def: '# OUT follows IN slowly: 10 kΩ and 100 µF, about 1 s.\nR IN OUT 10k\nC OUT GND 100u',
  },
];
