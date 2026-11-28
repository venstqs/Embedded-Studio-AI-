import type { Live, Part, Project } from '../types';
import { STARTERS } from './projects';

/**
 * Challenges that check themselves. Each one sets a goal ("blink at exactly
 * 2 Hz"), starts you from a circuit, and watches the running simulation to
 * see when every part of the goal is met. No teacher needed to mark it.
 */

/** What the simulation did, sampled every frame while it runs. */
interface Sample { t: number; led: Record<string, number>; ma: Record<string, number>; pressed: Record<string, boolean>; meter: Record<string, number | null> }

export class LiveMonitor {
  samples: Sample[] = [];
  clear() { this.samples = []; }
  push(t: number, live: Record<string, Live>, parts: Part[]) {
    if (this.samples.length && t < this.samples[this.samples.length - 1].t) this.clear();
    const s: Sample = { t, led: {}, ma: {}, pressed: {}, meter: {} };
    for (const p of parts) {
      const l = live[p.id];
      if (p.type === 'led') { s.led[p.id] = l?.b ?? 0; s.ma[p.id] = l?.ma ?? 0; }
      if (p.type === 'button') s.pressed[p.id] = !!p.props.pressed;
      if (p.type === 'multimeter') s.meter[p.id] = l?.reading && p.props.mode === 'V' ? parseFloat(l.reading.value) : null;
    }
    this.samples.push(s);
    if (this.samples.length > 4000) this.samples.splice(0, 1000);
  }
}

export interface Criterion { label: string; ok: boolean; detail?: string }
interface Ctx { project: Project; s: Sample[]; running: boolean }

export interface Challenge {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  goal: string;
  brief: string;
  hints: string[];
  start: () => Project;
  check: (c: Ctx) => Criterion[];
}

const starter = (id: string) => STARTERS.find(s => s.id === id)!.build();
const leds = (p: Project) => p.parts.filter(x => x.type === 'led').map(x => x.id);
const recent = (s: Sample[], ms: number) => { const end = s.length ? s[s.length - 1].t : 0; return s.filter(x => x.t >= end - ms); };
const anyLit = (c: Ctx) => recent(c.s, 600).some(x => Object.values(x.led).some(b => b > 0.3));
const has = (p: Project, type: string) => p.parts.some(x => x.type === type);

/** LED blink rate over the last few seconds, from its rising edges. */
function blinkHz(s: Sample[], id: string, windowMs = 4000) {
  const w = recent(s, windowMs);
  const rises: number[] = [];
  for (let i = 1; i < w.length; i++) if ((w[i - 1].led[id] ?? 0) < 0.5 && (w[i].led[id] ?? 0) >= 0.5) rises.push(w[i].t);
  if (rises.length < 3) return null;
  return ((rises.length - 1) * 1000) / (rises[rises.length - 1] - rises[0]);
}
const bestHz = (c: Ctx) => leds(c.project).map(id => blinkHz(c.s, id)).find(h => h !== null) ?? null;
const fmtHz = (h: number | null) => (h === null ? 'not blinking yet' : `now ${h.toFixed(2)} Hz`);
const runNote = (c: Ctx) => (c.running ? undefined : 'Start the simulation to test it');

export const CHALLENGES: Challenge[] = [
  {
    id: 'first-light', title: 'First light', level: 1,
    goal: 'Light an LED from the 9 V battery, safely.',
    brief: 'The battery, a button and a resistor are already on the breadboard, but the LED is missing. Add one and wire it so it lights, without letting more than 20 mA through it.',
    hints: ['Drag an LED from the library onto the breadboard, next to the resistor.', 'The long leg (anode) goes toward +, the short leg (cathode) toward the − rail.', 'Current has to go: battery + → button → resistor → LED → battery −. Hold the button while it runs.'],
    start: () => { const p = starter('battery'); return { ...p, parts: p.parts.filter(x => x.type !== 'led'), name: 'Challenge: First light' }; },
    check: c => {
      const ma = Math.max(0, ...recent(c.s, 600).flatMap(x => Object.values(x.ma)));
      return [
        { label: 'There is an LED in the circuit', ok: has(c.project, 'led') },
        { label: 'The LED lights up', ok: anyLit(c), detail: runNote(c) },
        { label: 'No more than 20 mA through it', ok: anyLit(c) && ma <= 20, detail: ma ? `${ma.toFixed(1)} mA` : undefined },
      ];
    },
  },
  {
    id: 'safe-current', title: 'Just the right current', level: 1,
    goal: 'Keep the LED current between 5 and 15 mA.',
    brief: 'Someone fitted a 47 Ω resistor, and the LED is taking far too much current. Choose a better resistor so the LED gets between 5 and 15 mA.',
    hints: ['Ohm’s law: R = V ÷ I. The pin gives 5 V and a red LED drops about 1.8 V.', 'For 10 mA: (5 − 1.8) ÷ 0.010 ≈ 320 Ω. Try 330 Ω.', 'Click the resistor, then type a value like 330 or 4k7 in the inspector.'],
    start: () => { const p = starter('blink'); return { ...p, name: 'Challenge: Just the right current', parts: p.parts.map(x => (x.type === 'resistor' ? { ...x, props: { ...x.props, ohms: 47 } } : x)) }; },
    check: c => {
      const ma = Math.max(0, ...recent(c.s, 2500).flatMap(x => Object.values(x.ma)));
      return [
        { label: 'The LED lights up', ok: ma > 0.5, detail: runNote(c) },
        { label: 'At least 5 mA', ok: ma >= 5, detail: ma ? `${ma.toFixed(1)} mA` : undefined },
        { label: 'At most 15 mA', ok: ma > 0.5 && ma <= 15 },
      ];
    },
  },
  {
    id: 'blink-2hz', title: 'Blink at exactly 2 Hz', level: 1,
    goal: 'Make the LED blink twice a second (1.8 to 2.2 Hz).',
    brief: 'This LED blinks once every two seconds. Change the code so it blinks exactly twice per second. The checker measures the real blink rate.',
    hints: ['One blink is one ON time plus one OFF time.', '2 blinks per second means each blink takes 500 ms.', 'Use delay(250) after HIGH and delay(250) after LOW.'],
    start: () => ({ ...starter('blink'), name: 'Challenge: Blink at 2 Hz' }),
    check: c => {
      const hz = bestHz(c);
      return [
        { label: 'The LED is blinking', ok: hz !== null, detail: runNote(c) ?? fmtHz(hz) },
        { label: 'At 2 Hz, give or take 10%', ok: hz !== null && hz >= 1.8 && hz <= 2.2, detail: hz !== null ? `${hz.toFixed(2)} Hz` : undefined },
      ];
    },
  },
  {
    id: 'fade', title: 'Smooth fade', level: 2,
    goal: 'Show at least 8 different brightness levels on one LED.',
    brief: 'digitalWrite() only knows on and off. Make the LED glow at many levels in between, like a breathing light.',
    hints: ['analogWrite(pin, value) sets the brightness, from 0 to 255.', 'Only some pins can do it: on an Uno they are marked ~ (3, 5, 6, 9, 10, 11). Pin 13 is not one of them.', 'Move the LED wire to pin 9 and loop: for (int b = 0; b <= 255; b += 5) { analogWrite(9, b); delay(20); }'],
    start: () => ({ ...starter('blink'), name: 'Challenge: Smooth fade' }),
    check: c => {
      const levels = new Set<number>();
      for (const x of recent(c.s, 6000)) for (const b of Object.values(x.led)) if (b > 0.03) levels.add(Math.round(b * 25));
      return [
        { label: 'The LED lights up', ok: levels.size > 0, detail: runNote(c) },
        { label: 'At least 8 brightness levels', ok: levels.size >= 8, detail: `${levels.size} seen` },
      ];
    },
  },
  {
    id: 'button-light', title: 'Light while pressed', level: 2,
    goal: 'The LED is on only while the button is held.',
    brief: 'The wiring is done, but the sketch is empty. Write code that reads the button and lights the LED only while it is pressed.',
    hints: ['pinMode(2, INPUT_PULLUP) makes the pin read HIGH until the button joins it to ground.', 'So pressed reads LOW: if (digitalRead(2) == LOW) { ... }', 'Use digitalWrite(13, HIGH) inside the if, and LOW in the else.'],
    start: () => ({ ...starter('button'), name: 'Challenge: Light while pressed', code: '// The button is on pin 2, the LED on pin 13.\n// Light the LED only while the button is held.\n\nvoid setup() {\n\n}\n\nvoid loop() {\n\n}\n' }),
    check: c => {
      const w = recent(c.s, 8000).slice(3);
      const on = (x: Sample) => Object.values(x.led).some(b => b > 0.5);
      const down = (x: Sample) => Object.values(x.pressed).some(Boolean);
      const pressedOn = w.some(x => down(x) && on(x));
      const releasedOff = w.some(x => !down(x) && !on(x));
      // Allow a few frames for the code to react before calling it wrong.
      let wrong = 0;
      for (let i = 3; i < w.length; i++) if (!down(w[i]) && !down(w[i - 3]) && on(w[i])) wrong++;
      return [
        { label: 'Pressing the button lights the LED', ok: pressedOn, detail: runNote(c) ?? (pressedOn ? undefined : 'Hold the button while it runs') },
        { label: 'Letting go turns it off', ok: releasedOff && pressedOn },
        { label: 'It never lights on its own', ok: pressedOn && wrong < 4 },
      ];
    },
  },
  {
    id: 'three-volts', title: 'Make exactly 3 V', level: 2,
    goal: 'Make the multimeter read 3.0 V (2.9 to 3.1 V).',
    brief: 'Two resistors split the battery’s 9 V. Change them so the meter reads 3 V. This is a voltage divider: the most useful two-resistor circuit there is.',
    hints: ['The meter measures across the bottom resistor.', 'V = 9 × R2 ÷ (R1 + R2). For 3 V, R2 must be half of R1.', 'Try R1 = 2 kΩ and R2 = 1 kΩ, or 2.2 kΩ with 1.1 kΩ.'],
    start: () => ({ ...starter('measure'), name: 'Challenge: Make exactly 3 V' }),
    check: c => {
      const v = recent(c.s, 600).flatMap(x => Object.values(x.meter)).filter((x): x is number => x !== null).pop() ?? null;
      return [
        { label: 'The multimeter is measuring volts', ok: v !== null, detail: runNote(c) },
        { label: 'It reads 3.0 V, give or take 0.1', ok: v !== null && v >= 2.9 && v <= 3.1, detail: v !== null ? `${v.toFixed(2)} V` : undefined },
      ];
    },
  },
  {
    id: 'timer-1hz', title: '555 at one beat a second', level: 3,
    goal: 'Make the 555 blink the LED at 1 Hz (0.9 to 1.1 Hz), no code.',
    brief: 'This 555 blinks about once every two seconds. Change its timing parts so it blinks once a second, with no microcontroller.',
    hints: ['Period ≈ 0.693 × (R1 + 2 × R2) × C.', 'Now: 0.693 × (1 kΩ + 2 × 10 kΩ) × 100 µF ≈ 1.46 s. You need about 1 s.', 'Lower R2 to about 6.8 kΩ, or change C to 68 µF.'],
    start: () => ({ ...starter('ne555'), name: 'Challenge: 555 at 1 Hz' }),
    check: c => {
      const hz = bestHz(c);
      return [
        { label: 'No microcontroller in the circuit', ok: !c.project.parts.some(x => x.type === 'uno' || x.type === 'esp32') },
        { label: 'A 555 timer drives the LED', ok: has(c.project, 'ne555') && hz !== null, detail: runNote(c) ?? fmtHz(hz) },
        { label: 'At 1 Hz, give or take 10%', ok: hz !== null && hz >= 0.9 && hz <= 1.1, detail: hz !== null ? `${hz.toFixed(2)} Hz` : undefined },
      ];
    },
  },
];

const DONE_KEY = 'xavierlabs_challenges_done';
export function loadDone(): string[] { try { return JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]'); } catch { return []; } }
export function saveDone(ids: string[]) { try { localStorage.setItem(DONE_KEY, JSON.stringify(ids)); } catch { /* ignore */ } }
