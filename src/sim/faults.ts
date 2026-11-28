import type { Fault, Part, Project, Wire } from '../types.ts';
import { designators } from '../parts/catalog.ts';

/**
 * Troubleshooting game: a fault hidden in the circuit. The drawing looks
 * perfect, but the simulator runs a broken version of it, so the student has
 * to measure their way to the culprit, the way you would on a real bench.
 */

/** The circuit the simulator actually runs, with the hidden faults applied. */
export function applyFaults(parts: Part[], wires: Wire[], faults?: Fault[]): { parts: Part[]; wires: Wire[] } {
  if (!faults?.length) return { parts, wires };
  let ps = parts, ws = wires;
  for (const f of faults) {
    if (f.kind === 'open-wire') ws = ws.filter(w => w.id !== f.target);
    else if (f.kind === 'dead') {
      // A burnt-out part is an open circuit: it is simply not there electrically.
      ps = ps.filter(p => p.id !== f.target);
    } else if (f.kind === 'value') ps = ps.map(p => (p.id === f.target ? { ...p, props: { ...p.props, ohms: (+p.props.ohms || 220) * 100 } } : p));
    else if (f.kind === 'stuck') ps = ps.map(p => (p.id === f.target ? { ...p, props: { ...p.props, pressed: 0, pos: 0 } } : p));
  }
  return { parts: ps, wires: ws };
}

const DEAD_TYPES = new Set(['led', 'resistor', 'diode', 'capacitor', 'ldr', 'potentiometer', 'buzzer', 'npn']);

/** Pick a believable fault for this circuit, or null if there is nothing to break. */
export function randomFault(p: Project, rnd = Math.random): Fault | null {
  const names = designators(p.parts);
  const options: Fault[] = [];
  for (const w of p.wires) options.push({ kind: 'open-wire', target: w.id, note: 'One jumper wire was broken inside its insulation, so it looked fine but carried nothing.' });
  for (const part of p.parts) {
    const n = names.get(part.id) ?? part.type;
    if (DEAD_TYPES.has(part.type)) options.push({ kind: 'dead', target: part.id, note: `${n} was dead: burnt out inside, so no current could pass through it.` });
    if (part.type === 'resistor') options.push({ kind: 'value', target: part.id, note: `${n} was the wrong value: its colour bands said one thing, but it was 100 times bigger.` });
    if (part.type === 'button' || part.type === 'switch') options.push({ kind: 'stuck', target: part.id, note: `${n} was broken: its contacts never closed, whatever you pressed.` });
  }
  if (!options.length) return null;
  return options[Math.floor(rnd() * options.length)];
}

export const FAULT_LABEL: Record<Fault['kind'], string> = {
  'open-wire': 'Broken wire', dead: 'Dead part', value: 'Wrong value', stuck: 'Stuck switch',
};
