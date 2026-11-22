import type { Part, Project } from '../types';
import { PARTS, designators, formatFarads, formatOhms, isBoard, ref } from '../parts/catalog';
import { buildNets } from './nets';
import type { Nets } from './nets';

/**
 * Circuit check, like the electrical rule check in a PCB tool: finds the
 * mistakes you can spot before pressing Start. Shorts, legs that go nowhere,
 * parts in backwards, LEDs with nothing to limit their current, wires that
 * do nothing.
 */
export interface Issue {
  level: 'error' | 'warn' | 'info';
  title: string;
  text: string;
  parts: string[];
  wire?: string;
}

const isSource = (p: Part) => isBoard(p.type) || p.type === 'battery';
const isInstrument = (p: Part) => p.type === 'multimeter' || p.type === 'scope';
type Kind = { power: boolean; ground: boolean; drive: boolean };
const NONE: Kind = { power: false, ground: false, drive: false };
/** Pins that are fine to leave unconnected. */
const OPTIONAL = new Set(['ne555:CTRL', 'seg7:dp']);

/** What drives each net: a supply's +, a ground, or a board's I/O pin. */
function netKinds(parts: Part[], nets: Nets) {
  const byRef = new Map<string, Part>();
  const kinds = new Map<string, Kind>();
  for (const part of parts) for (const pin of PARTS[part.type].pins) {
    const r = ref(part.id, pin.id);
    byRef.set(r, part);
    const root = nets.root(r);
    const k = kinds.get(root) ?? { ...NONE };
    if (isSource(part) && pin.kind === 'power') k.power = true;
    if (isSource(part) && pin.kind === 'ground') k.ground = true;
    if (isBoard(part.type) && pin.kind === 'digital') k.drive = true;
    kinds.set(root, k);
  }
  return { byRef, kind: (r: string) => kinds.get(nets.root(r)) ?? NONE };
}

export function checkCircuit(project: Project): Issue[] {
  const { parts, wires } = project;
  const nets = buildNets(parts, wires);
  const names = designators(parts);
  const nm = (p: Part) => names.get(p.id) ?? PARTS[p.type].name;
  const { byRef, kind } = netKinds(parts, nets);
  const out: Issue[] = [];

  // Shorts: a supply's + joined straight to its −.
  const shorted = new Set<string>();
  for (const part of parts) {
    if (!isSource(part)) continue;
    for (const pin of PARTS[part.type].pins) {
      if (pin.kind !== 'power') continue;
      const r = ref(part.id, pin.id);
      const root = nets.root(r);
      if (shorted.has(root) || !kind(r).ground) continue;
      shorted.add(root);
      out.push({ level: 'error', title: 'Short circuit', text: `${nm(part)} ${pin.name} is joined straight to ground. Current would rush through with nothing to stop it.`, parts: [part.id] });
    }
  }

  for (const part of parts) {
    if (part.type === 'breadboard' || isSource(part)) continue;
    const pins = PARTS[part.type].pins;
    // Connected means the net reaches another part (an empty breadboard strip does not count).
    const loose = pins.filter(pin => {
      if (OPTIONAL.has(`${part.type}:${pin.id}`)) return false;
      const r = ref(part.id, pin.id);
      return !nets.group(r).some(o => { const q = byRef.get(o); return o !== r && q && q.type !== 'breadboard' && q.id !== part.id; });
    });
    if (loose.length === pins.length) {
      out.push({ level: isInstrument(part) ? 'info' : 'warn', title: 'Not connected', text: `${nm(part)} isn’t connected to anything yet.`, parts: [part.id] });
      continue;
    }
    if (loose.length && !isInstrument(part) && part.type !== 'rgb_led' && part.type !== 'switch') {
      out.push({ level: 'warn', title: 'Loose pin', text: `${nm(part)}: ${loose.map(p => p.name.replace(/ \(.*\)$/, '')).join(', ')} ${loose.length === 1 ? 'goes' : 'go'} nowhere.`, parts: [part.id] });
    }
    // Both legs in the same strip: the part is shorted out.
    if (pins.length === 2 && !loose.length) {
      const [a, b] = pins.map(p => ref(part.id, p.id));
      if (nets.root(a) === nets.root(b)) out.push({ level: 'warn', title: 'Shorted out', text: `Both legs of ${nm(part)} are joined, so no current goes through it. Move one leg to another column.`, parts: [part.id] });
    }
  }

  // Polarity and current limiting.
  for (const part of parts) {
    if (part.type !== 'led' && part.type !== 'capacitor' && part.type !== 'diode') continue;
    const [pa, pk] = part.type === 'capacitor' ? ['+', '-'] : ['A', 'K'];
    const a = kind(ref(part.id, pa)), k = kind(ref(part.id, pk));
    if ((a.ground && (k.power || k.drive)) || (k.power && !a.power && !a.drive && !a.ground && part.type !== 'diode')) {
      out.push({
        level: part.type === 'capacitor' ? 'error' : 'warn', title: 'In backwards', parts: [part.id],
        text: part.type === 'capacitor'
          ? `${nm(part)} has its − leg on the supply. Electrolytic capacitors can burst when reversed.`
          : `${nm(part)} faces the wrong way: the ${part.type === 'led' ? 'long leg (anode)' : 'anode'} should point toward +.`,
      });
    }
    if (part.type === 'led' && (a.power || a.drive) && k.ground) {
      out.push({ level: 'warn', title: 'No resistor', text: `${nm(part)} goes straight from ${a.power ? 'the supply' : 'a board pin'} to ground. Add a 220 Ω resistor or it will burn out.`, parts: [part.id] });
    }
  }

  for (const id of nets.redundant) {
    out.push({ level: 'info', title: 'Extra wire', text: 'This wire joins two points that are already connected, so it does nothing.', parts: [], wire: id });
  }
  const rank = { error: 0, warn: 1, info: 2 };
  return out.sort((x, y) => rank[x.level] - rank[y.level]);
}

/** A SPICE netlist of the circuit, for students who move on to LTspice or ngspice. */
export function netlist(project: Project): string {
  const { parts, wires } = project;
  const nets = buildNets(parts, wires);
  const names = designators(parts);
  const { kind } = netKinds(parts, nets);
  const label = new Map<string, string>();
  let n = 0, supplies = 0;
  const net = (partId: string, pin: string) => {
    const r = ref(partId, pin);
    const root = nets.root(r);
    let l = label.get(root);
    if (!l) {
      const k = kind(r);
      l = k.ground ? '0' : k.power ? (supplies++ ? `VCC${supplies}` : 'VCC') : `N${String(++n).padStart(3, '0')}`;
      label.set(root, l);
    }
    return l;
  };
  const lines = [`* ${project.name || 'XavierLabs circuit'}`, `* Exported from XavierLabs IDE`, ''];
  const models = new Set<string>();
  const si = (s: string) => s.replace(/\s|Ω|F/g, '').replace('µ', 'u');
  for (const p of parts) {
    const d = (names.get(p.id) ?? p.id).replace(/\s/g, '_');
    const pins = (...ids: string[]) => ids.map(i => net(p.id, i)).join(' ');
    const pos = +p.props.pos || 0.5;
    switch (p.type) {
      case 'resistor': lines.push(`R_${d} ${pins('1', '2')} ${si(formatOhms(+p.props.ohms))}`); break;
      case 'capacitor': lines.push(`C_${d} ${pins('+', '-')} ${si(formatFarads(+p.props.uf))}`); break;
      case 'led': {
        const m = `LED_${String(p.props.color).toUpperCase()}`;
        lines.push(`D_${d} ${pins('A', 'K')} ${m}`);
        models.add(`.model ${m} D(IS=1e-19 N=1.8 RS=5)`);
        break;
      }
      case 'diode': lines.push(`D_${d} ${pins('A', 'K')} D1N4148`); models.add('.model D1N4148 D(IS=2.5n RS=0.6 N=1.75)'); break;
      case 'npn': lines.push(`Q_${d} ${pins('C', 'B', 'E')} Q2N2222`); models.add('.model Q2N2222 NPN(IS=1e-14 BF=120)'); break;
      case 'battery': lines.push(`V_${d} ${pins('+', '-')} DC 9`); break;
      case 'potentiometer':
        lines.push(`R_${d}A ${pins('1', 'W')} ${Math.max(1, Math.round(10000 * pos))}`, `R_${d}B ${pins('W', '2')} ${Math.max(1, Math.round(10000 * (1 - pos)))}`);
        break;
      case 'breadboard': break;
      default: {
        const spec = PARTS[p.type];
        lines.push(`* ${d} ${spec.name}: ${spec.pins.map(pin => `${pin.id}=${net(p.id, pin.id)}`).join(' ')}`);
      }
    }
  }
  if (models.size) lines.push('', ...models);
  lines.push('', '.op', '.end', '');
  return lines.join('\n');
}
