/**
 * The electrical side: works out which pins are joined (wires, breadboard
 * strips, pressed buttons), then solves the voltages and currents with
 * nodal analysis. LEDs are modelled as diodes, so a missing resistor or a
 * backwards LED behaves the way it would on a real bench.
 */
import type { Live, Note, Part, Wire } from '../types.ts';
import { BOARDS, LED_COLORS, PARTS, isBoard, pinPos, ref } from '../parts/catalog.ts';
import type { BoardInfo } from '../parts/catalog.ts';

/** A pin driven by the board: a voltage behind a source resistance. */
export interface Drive { v: number; r: number; pwm?: number }

interface Res { a: number; b: number; g: number }
interface Src { a: number; b: number; g: number; v: number }
interface Diode { a: number; b: number; vf: number; part: string; ch: number; on: boolean }

const RD = 9; // on-resistance of an LED, ohms
const GND = -1;

export class Circuit {
  parts: Part[];
  board: Part | null;
  info: BoardInfo | null;
  notes: Note[] = [];
  private parent = new Map<string, string>();
  private nodeOf = new Map<string, number>();
  private n = 0;
  private res: Res[] = [];
  private src: Src[] = [];
  private diodes: Diode[] = [];
  private groundRoot = '';
  private volts: Float64Array = new Float64Array(0);
  private amps: number[] = [];
  private staticNotes: Note[] = [];

  constructor(parts: Part[], wires: Wire[]) {
    this.parts = parts;
    this.board = parts.find(p => isBoard(p.type)) ?? null;
    this.info = this.board ? BOARDS[this.board.type as 'uno' | 'esp32'] : null;
    this.join(wires);
    this.elements();
  }

  // ---- connectivity ----
  private find(x: string): string {
    let r = x;
    for (;;) { const p = this.parent.get(r); if (p === undefined || p === r) break; r = p; }
    this.parent.set(x, r);
    return r;
  }
  private union(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  private join(wires: Wire[]) {
    const holes = new Map<string, string>();
    const key = (x: number, y: number) => `${Math.round(x / 4)},${Math.round(y / 4)}`;
    for (const part of this.parts) {
      const strips = new Map<string, string>();
      for (const p of PARTS[part.type].pins) {
        const r = ref(part.id, p.id);
        this.parent.set(r, r);
        if (p.strip) { const first = strips.get(p.strip); if (first) this.union(r, first); else strips.set(p.strip, r); }
        if (part.type === 'breadboard') { const w = pinPos(part, p); holes.set(key(w.x, w.y), r); }
      }
      if (part.type === 'button' && part.props.pressed) this.union(ref(part.id, '1a'), ref(part.id, '2a'));
    }
    // legs pushed into breadboard holes
    for (const part of this.parts) {
      if (part.type === 'breadboard') continue;
      for (const p of PARTS[part.type].pins) {
        const w = pinPos(part, p);
        const hole = holes.get(key(w.x, w.y));
        if (hole) this.union(ref(part.id, p.id), hole);
      }
    }
    for (const w of wires) if (this.parent.has(w.from) && this.parent.has(w.to)) this.union(w.from, w.to);
  }

  private node(r: string): number {
    const root = this.find(r);
    if (root === this.groundRoot) return GND;
    let i = this.nodeOf.get(root);
    if (i === undefined) { i = this.n++; this.nodeOf.set(root, i); }
    return i;
  }

  private elements() {
    const battery = this.parts.find(p => p.type === 'battery');
    this.groundRoot = this.board ? this.find(ref(this.board.id, 'GND')) : battery ? this.find(ref(battery.id, '-')) : '';
    const N = (part: Part, id: string) => this.node(ref(part.id, id));
    const R = (a: number, b: number, ohms: number) => { if (a !== b) this.res.push({ a, b, g: 1 / Math.max(ohms, 0.01) }); };

    if (this.board && this.info) {
      for (const [id, v, r] of this.info.supplies) {
        const a = N(this.board, id);
        if (a === GND) this.staticNotes.push({ partId: this.board.id, text: `Short circuit: the ${id} pin is wired straight to GND. On a real board this can damage it.` });
        else this.src.push({ a, b: GND, g: 1 / r, v });
      }
    }
    for (const p of this.parts) {
      switch (p.type) {
        case 'battery': {
          const a = N(p, '+'), b = N(p, '-');
          if (a === b) this.staticNotes.push({ partId: p.id, text: 'Short circuit: the battery terminals are joined directly. A real battery would get hot.' });
          else this.src.push({ a, b, g: 1 / 1.5, v: 9 });
          break;
        }
        case 'resistor': R(N(p, '1'), N(p, '2'), +p.props.ohms || 220); break;
        case 'led':
          this.diodes.push({ a: N(p, 'A'), b: N(p, 'K'), vf: (LED_COLORS[String(p.props.color)] ?? LED_COLORS.red).vf, part: p.id, ch: 0, on: false });
          break;
        case 'rgb_led':
          (['R', 'G', 'B'] as const).forEach((c, ch) =>
            this.diodes.push({ a: N(p, c), b: N(p, 'K'), vf: ch === 0 ? 1.9 : 3.0, part: p.id, ch, on: false }));
          break;
        case 'potentiometer': {
          const pos = Math.min(1, Math.max(0, +p.props.pos));
          R(N(p, "1"), N(p, "W"), 10000 * (1 - pos) + 1);
          R(N(p, "W"), N(p, "2"), 10000 * pos + 1);
          break;
        }
        case 'ldr': R(N(p, '1'), N(p, '2'), ldrOhms(+p.props.lux)); break;
        case 'buzzer': R(N(p, '+'), N(p, '-'), 800); break;
        case 'relay': R(N(p, 'IN'), N(p, 'GND'), 50000); R(N(p, 'VCC'), N(p, 'GND'), 70); break;
        case 'servo': R(N(p, 'VCC'), N(p, 'GND'), 500); N(p, 'SIG'); break;
        case 'lcd': R(N(p, 'VCC'), N(p, 'GND'), 200); break;
        case 'dht11': R(N(p, 'VCC'), N(p, 'GND'), 5000); N(p, 'DATA'); break;
        case 'ultrasonic': R(N(p, 'VCC'), N(p, 'GND'), 330); N(p, 'ECHO'); N(p, 'TRIG'); break;
        case 'uno': case 'esp32':
          for (const pin of PARTS[p.type].pins) if (pin.kind === 'digital' || pin.kind === 'analog') N(p, pin.id);
          break;
      }
    }
  }

  // ---- solving ----
  /** Solve once with the given pin drives. Returns node voltages and each diode's current. */
  private solveOnce(drives: Map<string, Drive>, pwmLevel: (pinId: string, d: Drive) => number): { v: Float64Array; i: number[] } {
    const n = this.n;
    const base = new Float64Array(n * n);
    const rhs0 = new Float64Array(n);
    const stamp = (a: number, b: number, g: number) => {
      if (a !== GND) base[a * n + a] += g;
      if (b !== GND) base[b * n + b] += g;
      if (a !== GND && b !== GND) { base[a * n + b] -= g; base[b * n + a] -= g; }
    };
    const inject = (a: number, b: number, amps: number, rhs: Float64Array) => {
      if (a !== GND) rhs[a] += amps;
      if (b !== GND) rhs[b] -= amps;
    };
    for (let k = 0; k < n; k++) base[k * n + k] += 1e-9;
    for (const r of this.res) stamp(r.a, r.b, r.g);
    for (const s of this.src) { stamp(s.a, s.b, s.g); inject(s.a, s.b, s.g * s.v, rhs0); }
    if (this.board) {
      for (const [pinId, d] of drives) {
        const a = this.node(ref(this.board.id, pinId));
        if (a === GND || a >= n) continue;
        stamp(a, GND, 1 / d.r);
        inject(a, GND, pwmLevel(pinId, d) / d.r, rhs0);
      }
    }
    let v: Float64Array = new Float64Array(n);
    for (const d of this.diodes) d.on = false;
    for (let iter = 0; iter < 40; iter++) {
      const G = base.slice();
      const rhs = rhs0.slice();
      for (const d of this.diodes) {
        if (d.a === d.b) continue;
        if (d.on) {
          const g = 1 / RD;
          if (d.a !== GND) G[d.a * n + d.a] += g;
          if (d.b !== GND) G[d.b * n + d.b] += g;
          if (d.a !== GND && d.b !== GND) { G[d.a * n + d.b] -= g; G[d.b * n + d.a] -= g; }
          inject(d.a, d.b, g * d.vf, rhs);
        }
      }
      v = gauss(G, rhs, n);
      let changed = false;
      for (const d of this.diodes) {
        const vd = (d.a === GND ? 0 : v[d.a]) - (d.b === GND ? 0 : v[d.b]);
        const want = d.on ? vd - d.vf > -1e-9 : vd > d.vf + 1e-6;
        if (want !== d.on) { d.on = want; changed = true; }
      }
      if (!changed) break;
    }
    const i = this.diodes.map(d => {
      if (!d.on) return 0;
      const vd = (d.a === GND ? 0 : v[d.a]) - (d.b === GND ? 0 : v[d.b]);
      return Math.max(0, (vd - d.vf) / RD);
    });
    return { v, i };
  }

  /**
   * Solve the circuit. Pins running PWM are solved fully on and fully off and
   * blended by duty cycle, which is how a dimmed LED really behaves.
   */
  solve(drives: Map<string, Drive>) {
    const pwm = [...drives].filter(([, d]) => d.pwm !== undefined && d.pwm > 0 && d.pwm < 1).slice(0, 6);
    const isPwm = new Set(pwm.map(([id]) => id));
    const lo = this.solveOnce(drives, (id, d) => (isPwm.has(id) ? 0 : d.pwm !== undefined ? d.pwm * d.v : d.v));
    const v = lo.v.slice(), amps = lo.i.slice();
    for (const [id, d] of pwm) {
      const hi = this.solveOnce(drives, (pid, dd) => (pid === id ? dd.v : isPwm.has(pid) ? 0 : dd.pwm !== undefined ? dd.pwm * dd.v : dd.v));
      for (let k = 0; k < v.length; k++) v[k] += d.pwm! * (hi.v[k] - lo.v[k]);
      for (let k = 0; k < amps.length; k++) amps[k] += d.pwm! * (hi.i[k] - lo.i[k]);
    }
    this.volts = v;
    this.amps = amps;
    this.notes = [...this.staticNotes];
    if (this.board) {
      for (const [pinId, d] of drives) {
        if (d.r > 100) continue;
        const a = this.node(ref(this.board.id, pinId));
        const va = a === GND ? 0 : v[a] ?? 0;
        const ma = Math.abs(((d.pwm !== undefined ? d.pwm * d.v : d.v) - va) / d.r) * 1000;
        if (ma > 40) this.notes.push({ partId: this.board.id, text: `Pin ${pinId.replace(/^D/, '')} is pushing ${Math.round(ma)} mA. Its safe limit is 40 mA, so add a resistor.` });
      }
    }
  }

  voltageAt(r: string): number {
    if (!this.parent.has(r)) return 0;
    const root = this.find(r);
    if (root === this.groundRoot) return 0;
    const i = this.nodeOf.get(root);
    return i === undefined ? 0 : this.volts[i] ?? 0;
  }
  private drop(p: Part, a: string, b: string) { return this.voltageAt(ref(p.id, a)) - this.voltageAt(ref(p.id, b)); }

  /** Board pin numbers wired directly to this pin (through wires and breadboard only). */
  boardPinsOn(r: string): number[] {
    if (!this.board || !this.info || !this.parent.has(r)) return [];
    const root = this.find(r);
    const out: number[] = [];
    for (const p of PARTS[this.board.type].pins) {
      const n = this.info.pinNumber(p.id);
      if (n !== null && this.find(ref(this.board.id, p.id)) === root) out.push(n);
    }
    return out;
  }
  private boardPinIdOn(r: string, pinId: string): boolean {
    return !!this.board && this.parent.has(r) && this.find(r) === this.find(ref(this.board.id, pinId));
  }

  private powered(p: Part, min = 3): boolean { return this.drop(p, 'VCC', 'GND') >= min; }

  /** Sensor lookups used by the running sketch. */
  dht(pin: number): { t: number; h: number } | null {
    for (const p of this.parts) {
      if (p.type === 'dht11' && this.powered(p) && this.boardPinsOn(ref(p.id, 'DATA')).includes(pin)) return { t: +p.props.temp, h: +p.props.hum };
    }
    return null;
  }
  echoCm(pin: number): number | null {
    for (const p of this.parts) {
      if (p.type === 'ultrasonic' && this.powered(p, 4) && this.boardPinsOn(ref(p.id, 'ECHO')).includes(pin) && this.boardPinsOn(ref(p.id, 'TRIG')).length) {
        return +p.props.cm;
      }
    }
    return null;
  }

  /** What every part is doing, given the last solve and the sketch's library state. */
  live(rt: { servos: Map<number, number>; tones: Map<number, { hz: number }>; lcd: { on: boolean; backlight: boolean; rows: string[] } } | null): Record<string, Live> {
    const out: Record<string, Live> = {};
    const note = (p: Part, text: string) => this.notes.push({ partId: p.id, text });
    const amps = (part: string, ch: number) => { const k = this.diodes.findIndex(d => d.part === part && d.ch === ch); return k < 0 ? 0 : this.amps[k]; };
    const glow = (a: number) => Math.min(1, Math.pow(a / 0.012, 0.6));

    for (const p of this.parts) {
      switch (p.type) {
        case 'led': {
          const a = amps(p.id, 0);
          const over = a > 0.03;
          if (over) note(p, `This LED is getting ${Math.round(a * 1000)} mA. Above about 20 mA it burns out, so put a resistor (220 Ω works) in its path.`);
          else if (this.drop(p, 'K', 'A') > 1.2) note(p, 'This LED is backwards. Flip it so the long leg (anode) faces the + side.');
          out[p.id] = { b: glow(a), over };
          break;
        }
        case 'rgb_led': {
          const c = [amps(p.id, 0), amps(p.id, 1), amps(p.id, 2)];
          if (Math.max(...c) > 0.03) note(p, 'A color of this RGB LED is getting too much current. Give each color pin its own resistor.');
          out[p.id] = { rgb: [glow(c[0]), glow(c[1]), glow(c[2])], over: Math.max(...c) > 0.03 };
          break;
        }
        case 'buzzer': {
          let hz = 0;
          if (rt) for (const n of this.boardPinsOn(ref(p.id, '+'))) { const t = rt.tones.get(n); if (t) hz = t.hz; }
          const grounded = this.find(ref(p.id, '-')) === this.groundRoot || Math.abs(this.voltageAt(ref(p.id, '-'))) < 0.5;
          if (hz && !grounded) hz = 0;
          if (!hz && this.drop(p, '+', '-') > 2.5) hz = 2300;
          out[p.id] = { hz };
          break;
        }
        case 'servo': {
          const pins = this.boardPinsOn(ref(p.id, 'SIG'));
          const angle = rt ? pins.map(n => rt.servos.get(n)).find(a => a !== undefined) : undefined;
          const ok = this.powered(p, 4);
          if (angle !== undefined && !ok) note(p, 'This servo has no power. Wire red to 5V and brown to GND.');
          out[p.id] = { angle: ok && angle !== undefined ? angle : undefined, on: ok };
          break;
        }
        case 'lcd': {
          const ok = this.powered(p, 4);
          const bus = !!this.info && this.boardPinIdOn(ref(p.id, 'SDA'), this.info.sda) && this.boardPinIdOn(ref(p.id, 'SCL'), this.info.scl);
          if (rt?.lcd.on && ok && !bus) note(p, `The screen can't hear the board. Wire SDA to ${this.info?.sda.replace('D', 'GPIO ')} and SCL to ${this.info?.scl.replace('D', 'GPIO ')}.`);
          if (rt?.lcd.on && !ok) note(p, 'This screen has no power. Wire VCC to 5V and GND to GND.');
          out[p.id] = { on: ok, lcd: ok && bus && rt?.lcd.on ? rt.lcd.rows : null, backlight: ok && (!rt || !rt.lcd.on || rt.lcd.backlight) };
          break;
        }
        case 'relay':
          out[p.id] = { on: this.powered(p, 4) && this.drop(p, 'IN', 'GND') > 2 };
          break;
        case 'dht11': case 'ultrasonic':
          out[p.id] = { on: this.powered(p) };
          break;
        case 'uno': case 'esp32': {
          const led = this.info!.pinId(this.info!.led);
          out[p.id] = { on: true, b: led ? Math.min(1, Math.max(0, this.voltageAt(ref(p.id, led)) / this.info!.vcc)) : 0 };
          break;
        }
      }
    }
    return out;
  }
}

/** Photoresistor: about 200 kΩ in the dark, about 500 Ω in bright light. */
export function ldrOhms(lux: number): number {
  return 200000 / (1 + Math.max(0, lux) * 0.4);
}

function gauss(A: Float64Array, b: Float64Array, n: number): Float64Array {
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[piv * n + c])) piv = r;
    if (Math.abs(A[piv * n + c]) < 1e-15) continue;
    if (piv !== c) {
      for (let k = c; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[piv * n + k]; A[piv * n + k] = t; }
      const t = b[c]; b[c] = b[piv]; b[piv] = t;
    }
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c] / A[c * n + c];
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r * n + k] * x[k];
    const d = A[r * n + r];
    x[r] = Math.abs(d) < 1e-15 ? 0 : s / d;
  }
  return x;
}
