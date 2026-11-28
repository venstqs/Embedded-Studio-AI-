/**
 * The electrical side.
 *
 * Pins joined by breadboard strips, legs pushed into holes and closed
 * switches become one node. Wires are tiny resistors, so the current in
 * every wire is known and can be drawn. Nodal analysis then solves the
 * voltages: diodes, LEDs and transistors are piecewise-linear models whose
 * states are tried until they agree, and capacitors are stepped through time.
 * A missing resistor, a backwards LED or a motor on a bare pin behaves the
 * way it would on a real bench.
 */
import type { Live, Note, Part, Wire } from '../types.ts';
import { BOARDS, LED_COLORS, PARTS, SEGMENTS, isBoard, pinPos, ref } from '../parts/catalog.ts';
import { CHIP_PINS, parseChip, pinNames } from './chip.ts';
import type { BoardInfo } from '../parts/catalog.ts';

/** A pin driven by the board: a voltage behind a source resistance. `f` is the switching frequency of PWM or tone(). */
export interface Drive { v: number; r: number; pwm?: number; f?: number }

interface Res { a: number; b: number; g: number }
interface Src { a: number; b: number; g: number; v: number; part?: string; name?: string; limit?: number }
interface Diode { a: number; b: number; vf: number; ron: number; part: string; ch: number; on: boolean }
interface Bjt { b: number; c: number; e: number; part: string; mode: 0 | 1 | 2 }
interface Cap { a: number; b: number; farads: number; part: string }
interface Timer555 { vcc: number; gnd: number; trig: number; thres: number; ctrl: number; reset: number; out: number; disch: number; part: string; powered: boolean }
interface WireEl { id: string; a: number; b: number }

const GND = -1;
const R_WIRE = 0.05;
/** NPN transistor: base-emitter drop, gain, and the collector-emitter drop when fully on. */
const VBE = 0.65, RBE = 25, BETA = 120, VCESAT = 0.15, RCE = 2;
const R_MOTOR = 18;
const R_SHUNT = 0.1;
/** The multimeter measures resistance by pushing a little current from a 3 V source behind 3 kΩ. */
const OHM_V = 3, OHM_R = 3000;

class UnionFind {
  private p = new Map<string, string>();
  add(x: string) { if (!this.p.has(x)) this.p.set(x, x); }
  has(x: string) { return this.p.has(x); }
  find(x: string): string {
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r)!;
    let c = x;
    while (c !== r) { const n = this.p.get(c)!; this.p.set(c, r); c = n; }
    return r;
  }
  join(a: string, b: string) {
    if (!this.p.has(a) || !this.p.has(b)) return;
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.p.set(ra, rb);
  }
  copy() { const u = new UnionFind(); for (const [k, v] of this.p) u.p.set(k, v); return u; }
}

interface Solution { v: Float64Array; i: number[]; ib: number[]; ic: number[] }

export class Circuit {
  parts: Part[];
  board: Part | null;
  info: BoardInfo | null;
  notes: Note[] = [];
  /** Electrical nodes: strips, holes and closed switches, but not wires. */
  private nodes = new UnionFind();
  /** Everything connected at all, wires included. Used for "is this sensor wired to that pin". */
  private nets = new UnionFind();
  private wireList: Wire[] = [];
  private nodeOf = new Map<string, number>();
  private n = 0;
  private res: Res[] = [];
  private src: Src[] = [];
  private diodes: Diode[] = [];
  private bjts: Bjt[] = [];
  private caps: Cap[] = [];
  private timers: Timer555[] = [];
  private wireEls: WireEl[] = [];
  private groundRoot = '';
  private volts: Float64Array = new Float64Array(0);
  private lowVolts: Float64Array = new Float64Array(0);
  private pwmWaves: { duty: number; f?: number; dv: Float64Array }[] = [];
  private amps: number[] = [];
  private bjtIb: number[] = [];
  private bjtIc: number[] = [];
  private staticNotes: Note[] = [];
  private capV: Map<string, number>;
  private timerQ: Map<string, boolean>;
  private dt = 1 / 60;

  /** `capV` and `timerQ` hold stateful parts' memory, so charge and latch state survive a circuit rebuild mid-run. */
  constructor(parts: Part[], wires: Wire[], capV = new Map<string, number>(), timerQ = new Map<string, boolean>()) {
    this.parts = parts;
    this.capV = capV;
    this.timerQ = timerQ;
    this.board = parts.find(p => isBoard(p.type)) ?? null;
    this.info = this.board ? BOARDS[this.board.type as 'uno' | 'esp32'] : null;
    this.join(wires);
    this.elements();
  }

  get hasCapacitors() { return this.caps.length > 0; }
  get hasTimers() { return this.timers.length > 0; }

  // ---- connectivity ----
  private join(wires: Wire[]) {
    const holes = new Map<string, string>();
    const key = (x: number, y: number) => `${Math.round(x / 4)},${Math.round(y / 4)}`;
    for (const part of this.parts) {
      const strips = new Map<string, string>();
      for (const p of PARTS[part.type].pins) {
        const r = ref(part.id, p.id);
        this.nodes.add(r);
        if (p.strip) { const first = strips.get(p.strip); if (first) this.nodes.join(r, first); else strips.set(p.strip, r); }
        if (part.type === 'breadboard') { const w = pinPos(part, p); holes.set(key(w.x, w.y), r); }
      }
      if (part.type === 'button' && part.props.pressed) this.nodes.join(ref(part.id, '1a'), ref(part.id, '2a'));
      if (part.type === 'switch') this.nodes.join(ref(part.id, 'C'), ref(part.id, part.props.pos ? 'B' : 'A'));
      // A custom chip's inside nodes exist only inside the package.
      if (part.type === 'custom') for (const n of parseChip(String(part.props.def ?? ''), pinNames(part.props)).internal) this.nodes.add(ref(part.id, n));
    }
    // legs pushed into breadboard holes
    for (const part of this.parts) {
      if (part.type === 'breadboard') continue;
      for (const p of PARTS[part.type].pins) {
        const w = pinPos(part, p);
        const hole = holes.get(key(w.x, w.y));
        if (hole) this.nodes.join(ref(part.id, p.id), hole);
      }
    }
    this.nets = this.nodes.copy();
    this.wireList = wires.filter(w => this.nodes.has(w.from) && this.nodes.has(w.to));
    for (const w of this.wireList) this.nets.join(w.from, w.to);
  }

  private node(r: string): number {
    const root = this.nodes.find(r);
    if (root === this.groundRoot) return GND;
    let i = this.nodeOf.get(root);
    if (i === undefined) { i = this.n++; this.nodeOf.set(root, i); }
    return i;
  }

  /** Index of a pin's node without creating one: GND (−1) for ground or anything unknown. */
  private index(r: string): number {
    if (!this.nodes.has(r)) return GND;
    const root = this.nodes.find(r);
    if (root === this.groundRoot) return GND;
    return this.nodeOf.get(root) ?? GND;
  }

  private elements() {
    const battery = this.parts.find(p => p.type === 'battery');
    this.groundRoot = this.board ? this.nodes.find(ref(this.board.id, 'GND')) : battery ? this.nodes.find(ref(battery.id, '-')) : '';
    const N = (part: Part, id: string) => this.node(ref(part.id, id));
    const R = (a: number, b: number, ohms: number) => { if (a !== b) this.res.push({ a, b, g: 1 / Math.max(ohms, 1e-3) }); };
    const D = (part: Part, a: string, k: string, vf: number, ron: number, ch = 0) =>
      this.diodes.push({ a: N(part, a), b: N(part, k), vf, ron, part: part.id, ch, on: false });

    if (this.board && this.info) {
      for (const [id, v, r] of this.info.supplies) {
        const a = N(this.board, id);
        if (a === GND) this.staticNotes.push({ partId: this.board.id, text: `Short circuit: the ${id} pin is wired straight to GND. On a real board this can damage it.` });
        else this.src.push({ a, b: GND, g: 1 / r, v, part: this.board.id, name: id, limit: 0.8 });
      }
    }
    for (const p of this.parts) {
      switch (p.type) {
        case 'battery': {
          const a = N(p, '+'), b = N(p, '-');
          if (a === b) this.staticNotes.push({ partId: p.id, text: 'Short circuit: the battery terminals are joined directly. A real battery would get hot.' });
          else this.src.push({ a, b, g: 1 / 1.5, v: 9, part: p.id, name: 'battery', limit: 1.5 });
          break;
        }
        case 'resistor': R(N(p, '1'), N(p, '2'), +p.props.ohms || 220); break;
        case 'led': D(p, 'A', 'K', (LED_COLORS[String(p.props.color)] ?? LED_COLORS.red).vf, 9); break;
        case 'rgb_led': D(p, 'R', 'K', 1.9, 9, 0); D(p, 'G', 'K', 3.0, 9, 1); D(p, 'B', 'K', 3.0, 9, 2); break;
        case 'diode': D(p, 'A', 'K', 0.7, 0.4); break;
        case 'seg7': SEGMENTS.forEach((s, ch) => D(p, s, 'COM', 1.8, 9, ch)); break;
        case 'npn': this.bjts.push({ b: N(p, 'B'), c: N(p, 'C'), e: N(p, 'E'), part: p.id, mode: 0 }); break;
        case 'capacitor': {
          const a = N(p, '+'), b = N(p, '-');
          if (a !== b) this.caps.push({ a, b, farads: (+p.props.uf || 100) * 1e-6, part: p.id });
          break;
        }
        case 'motor': R(N(p, '+'), N(p, '-'), R_MOTOR); break;
        case 'switch': N(p, 'A'); N(p, 'B'); N(p, 'C'); break;
        case 'multimeter': {
          const a = N(p, 'V'), b = N(p, 'COM');
          if (p.props.mode === 'A') R(a, b, R_SHUNT);
          else if (p.props.mode === 'Ω') { if (a !== b) this.src.push({ a, b, g: 1 / OHM_R, v: OHM_V }); }
          else R(a, b, 10e6);
          break;
        }
        case 'scope': R(N(p, 'CH'), N(p, 'GND'), 10e6); break;
        case 'ne555': {
          const vcc = N(p, 'VCC'), gnd = N(p, 'GND'), ctrl = N(p, 'CTRL'), reset = N(p, 'RESET');
          const trig = N(p, 'TRIG'), thres = N(p, 'THRES'), out = N(p, 'OUT'), disch = N(p, 'DISCH');
          // The three 5 kΩ resistors that give the 555 its name: CTRL sits at 2/3 VCC.
          R(vcc, ctrl, 5000);
          R(ctrl, gnd, 10000);
          // Weak internal pull-up on RESET so leaving it unconnected doesn't hold the chip in reset.
          R(vcc, reset, 100000);
          R(trig, gnd, 10e6);
          R(thres, gnd, 10e6);
          this.timers.push({ vcc, gnd, trig, thres, ctrl, reset, out, disch, part: p.id, powered: false });
          break;
        }
        case 'potentiometer': {
          const pos = Math.min(1, Math.max(0, +p.props.pos));
          R(N(p, '1'), N(p, 'W'), 10000 * (1 - pos) + 1);
          R(N(p, 'W'), N(p, '2'), 10000 * pos + 1);
          break;
        }
        case 'ldr': R(N(p, '1'), N(p, '2'), ldrOhms(+p.props.lux)); break;
        case 'buzzer': R(N(p, '+'), N(p, '-'), 800); break;
        case 'relay': R(N(p, 'IN'), N(p, 'GND'), 50000); R(N(p, 'VCC'), N(p, 'GND'), 70); break;
        case 'servo': R(N(p, 'VCC'), N(p, 'GND'), 500); N(p, 'SIG'); break;
        case 'lcd': R(N(p, 'VCC'), N(p, 'GND'), 200); break;
        case 'dht11': R(N(p, 'VCC'), N(p, 'GND'), 5000); N(p, 'DATA'); break;
        case 'ultrasonic': R(N(p, 'VCC'), N(p, 'GND'), 330); N(p, 'ECHO'); N(p, 'TRIG'); break;
        case 'custom': {
          const { els } = parseChip(String(p.props.def ?? ''), pinNames(p.props));
          els.forEach((e, i) => {
            if (e.k === 'R') R(N(p, e.a), N(p, e.b), e.ohms);
            else if (e.k === 'D') D(p, e.a, e.b, e.vf, e.ron, i);
            else if (e.k === 'V') { const a = N(p, e.a), b = N(p, e.b); if (a !== b) this.src.push({ a, b, g: 1 / e.r, v: e.v, part: p.id, name: 'chip source', limit: 2 }); }
            else { const a = N(p, e.a), b = N(p, e.b); if (a !== b) this.caps.push({ a, b, farads: e.f, part: `${p.id}#${i}` }); }
          });
          for (const id of CHIP_PINS) N(p, id);
          break;
        }
        case 'uno': case 'esp32':
          for (const pin of PARTS[p.type].pins) if (pin.kind === 'digital' || pin.kind === 'analog') N(p, pin.id);
          break;
      }
    }
    for (const w of this.wireList) {
      const a = this.node(w.from), b = this.node(w.to);
      if (a !== b) this.wireEls.push({ id: w.id, a, b });
    }
  }

  // ---- solving ----
  /** One solve with every pin at a fixed level. Tries element states until they agree. */
  private solveOnce(drives: Map<string, Drive>, level: (pinId: string, d: Drive) => number, dt: number): Solution {
    const n = this.n;
    const base = new Float64Array(n * n);
    const rhs0 = new Float64Array(n);
    const stamp = (G: Float64Array, a: number, b: number, g: number) => {
      if (a !== GND) G[a * n + a] += g;
      if (b !== GND) G[b * n + b] += g;
      if (a !== GND && b !== GND) { G[a * n + b] -= g; G[b * n + a] -= g; }
    };
    const inject = (rhs: Float64Array, a: number, b: number, amps: number) => {
      if (a !== GND) rhs[a] += amps;
      if (b !== GND) rhs[b] -= amps;
    };
    for (let k = 0; k < n; k++) base[k * n + k] += 1e-9;
    for (const r of this.res) stamp(base, r.a, r.b, r.g);
    for (const w of this.wireEls) stamp(base, w.a, w.b, 1 / R_WIRE);
    for (const s of this.src) { stamp(base, s.a, s.b, s.g); inject(rhs0, s.a, s.b, s.g * s.v); }
    // Capacitor over one time step: a conductance C/dt with a source that remembers its charge.
    for (const c of this.caps) { const g = c.farads / dt; stamp(base, c.a, c.b, g); inject(rhs0, c.a, c.b, g * (this.capV.get(c.part) ?? 0)); }
    if (this.board) {
      for (const [pinId, d] of drives) {
        const a = this.node(ref(this.board.id, pinId));
        if (a === GND || a >= n) continue;
        stamp(base, a, GND, 1 / d.r);
        inject(rhs0, a, GND, level(pinId, d) / d.r);
      }
    }

    let v: Float64Array = new Float64Array(n);
    const V = (k: number) => (k === GND ? 0 : v[k]);
    for (let iter = 0; iter < 60; iter++) {
      const G = base.slice();
      const rhs = rhs0.slice();
      for (const d of this.diodes) {
        if (!d.on || d.a === d.b) continue;
        const g = 1 / d.ron;
        stamp(G, d.a, d.b, g);
        inject(rhs, d.a, d.b, g * d.vf);
      }
      for (const t of this.bjts) {
        if (t.mode === 0) continue;
        stamp(G, t.b, t.e, 1 / RBE);
        inject(rhs, t.b, t.e, VBE / RBE);
        if (t.mode === 1) {
          // Active: collector current is BETA times the base current, gm·(Vb − Ve − VBE), into C and out of E.
          const gm = BETA / RBE;
          if (t.c !== GND) { if (t.b !== GND) G[t.c * n + t.b] += gm; if (t.e !== GND) G[t.c * n + t.e] -= gm; }
          if (t.e !== GND) { if (t.b !== GND) G[t.e * n + t.b] -= gm; G[t.e * n + t.e] += gm; }
          inject(rhs, t.c, t.e, gm * VBE);
        } else {
          // Saturated: fully on, a small fixed drop from collector to emitter.
          stamp(G, t.c, t.e, 1 / RCE);
          inject(rhs, t.c, t.e, VCESAT / RCE);
        }
      }
      for (const t of this.timers) {
        if (!t.powered) continue;
        if (this.timerQ.get(t.part)) {
          // Output HIGH: sources current from VCC with ~1.3 V Darlington drop behind 20 Ω.
          stamp(G, t.vcc, t.out, 1 / 20);
          inject(rhs, t.vcc, t.out, 1.3 / 20);
        } else {
          // Output LOW: sinks OUT to GND (15 Ω) and turns on the DISCH transistor to GND (20 Ω).
          stamp(G, t.out, t.gnd, 1 / 15);
          stamp(G, t.disch, t.gnd, 1 / 20);
        }
      }
      v = gauss(G, rhs, n);
      let changed = false;
      for (const t of this.timers) {
        const want = V(t.vcc) - V(t.gnd) >= 3;
        if (want !== t.powered) { t.powered = want; changed = true; }
      }
      for (const d of this.diodes) {
        if (d.a === d.b) continue;
        const vd = V(d.a) - V(d.b);
        const want = d.on ? vd - d.vf > -1e-9 : vd > d.vf + 1e-6;
        if (want !== d.on) { d.on = want; changed = true; }
      }
      for (const t of this.bjts) {
        const vbe = V(t.b) - V(t.e), vce = V(t.c) - V(t.e);
        const ib = t.mode ? (vbe - VBE) / RBE : 0;
        let m: 0 | 1 | 2 = t.mode;
        if (m === 0) { if (vbe > VBE + 1e-6) m = 1; }
        else if (ib < -1e-9) m = 0;
        else if (m === 1 && vce < VCESAT - 1e-6) m = 2;
        else if (m === 2 && (vce - VCESAT) / RCE > BETA * ib + 1e-9) m = 1;
        if (m !== t.mode) { t.mode = m; changed = true; }
      }
      if (!changed) break;
    }
    const i = this.diodes.map(d => (d.on ? Math.max(0, (V(d.a) - V(d.b) - d.vf) / d.ron) : 0));
    const ib = this.bjts.map(t => (t.mode ? Math.max(0, (V(t.b) - V(t.e) - VBE) / RBE) : 0));
    const ic = this.bjts.map((t, k) => (t.mode === 1 ? BETA * ib[k] : t.mode === 2 ? Math.max(0, (V(t.c) - V(t.e) - VCESAT) / RCE) : 0));
    return { v, i, ib, ic };
  }

  /**
   * Solve the circuit for a time step of `dt` seconds. Pins running PWM or
   * tone() are solved fully on and fully off and blended by duty cycle, which
   * is how a dimmed LED really behaves. `commit` moves capacitors forward in time.
   */
  solve(drives: Map<string, Drive>, dt = this.dt, commit = false) {
    this.dt = dt;
    const pwm = [...drives].filter(([, d]) => d.pwm !== undefined && d.pwm > 0 && d.pwm < 1).slice(0, 8);
    const isPwm = new Set(pwm.map(([id]) => id));
    const steady = (id: string, d: Drive) => (isPwm.has(id) ? 0 : d.pwm !== undefined ? d.pwm * d.v : d.v);
    const lo = this.solveOnce(drives, steady, dt);
    const v = lo.v.slice(), amps = lo.i.slice(), ib = lo.ib.slice(), ic = lo.ic.slice();
    this.lowVolts = lo.v;
    this.pwmWaves = [];
    for (const [id, d] of pwm) {
      const hi = this.solveOnce(drives, (pid, dd) => (pid === id ? dd.v : steady(pid, dd)), dt);
      const duty = d.pwm!;
      const dv = new Float64Array(v.length);
      for (let k = 0; k < v.length; k++) { dv[k] = hi.v[k] - lo.v[k]; v[k] += duty * dv[k]; }
      for (let k = 0; k < amps.length; k++) amps[k] += duty * (hi.i[k] - lo.i[k]);
      for (let k = 0; k < ib.length; k++) { ib[k] += duty * (hi.ib[k] - lo.ib[k]); ic[k] += duty * (hi.ic[k] - lo.ic[k]); }
      this.pwmWaves.push({ duty, f: d.f, dv });
    }
    this.volts = v;
    this.amps = amps;
    this.bjtIb = ib;
    this.bjtIc = ic;
    if (commit) {
      for (const c of this.caps) this.capV.set(c.part, this.at(c.a) - this.at(c.b));
      for (const t of this.timers) {
        const vg = this.at(t.gnd), vsup = this.at(t.vcc) - vg;
        if (vsup < 3) { this.timerQ.set(t.part, false); continue; }
        const vhi = this.at(t.ctrl) - vg, vlo = vhi * 0.5;
        let q = this.timerQ.get(t.part) ?? false;
        if (this.at(t.reset) - vg < 0.7) q = false;
        else if (this.at(t.trig) - vg < vlo) q = true;
        else if (this.at(t.thres) - vg > vhi) q = false;
        this.timerQ.set(t.part, q);
      }
    }
    this.checkLimits(drives);
  }

  private at(k: number) { return k === GND ? 0 : this.volts[k] ?? 0; }

  private checkLimits(drives: Map<string, Drive>) {
    this.notes = [...this.staticNotes];
    if (this.board) {
      for (const [pinId, d] of drives) {
        if (d.r > 100) continue;
        const va = this.at(this.index(ref(this.board.id, pinId)));
        const ma = Math.abs(((d.pwm !== undefined ? d.pwm * d.v : d.v) - va) / d.r) * 1000;
        if (ma > 40) this.notes.push({ partId: this.board.id, text: `Pin ${pinId.replace(/^D/, '')} is pushing ${Math.round(ma)} mA. Its safe limit is 40 mA, so add a resistor.` });
      }
    }
    for (const s of this.src) {
      if (!s.limit || !s.part) continue;
      const amps = s.g * (s.v - (this.at(s.a) - this.at(s.b)));
      if (amps > s.limit) {
        this.notes.push({
          partId: s.part,
          text: s.name === 'battery'
            ? `Short circuit: ${amps.toFixed(1)} A is pouring out of the battery with almost nothing in the way. A real battery would get hot.`
            : `Short circuit: the ${s.name} pin is wired almost straight to GND. On a real board this could damage it.`,
        });
      }
    }
  }

  voltageAt(r: string): number { return this.at(this.index(r)); }
  private drop(p: Part, a: string, b: string) { return this.voltageAt(ref(p.id, a)) - this.voltageAt(ref(p.id, b)); }

  /** Current in every wire, in amps, positive from its `from` end to its `to` end. */
  wireCurrents(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const w of this.wireEls) out[w.id] = (this.at(w.a) - this.at(w.b)) / R_WIRE;
    return out;
  }

  /**
   * The voltage between two pins as a waveform: the level with every PWM pin
   * off, plus each PWM or tone pin's square wave on top. The oscilloscope draws this.
   */
  wave(a: string, b: string) {
    const ia = this.index(a), ib = this.index(b);
    const pick = (arr: Float64Array, k: number) => (k === GND ? 0 : arr[k] ?? 0);
    return {
      lo: pick(this.lowVolts, ia) - pick(this.lowVolts, ib),
      avg: this.voltageAt(a) - this.voltageAt(b),
      parts: this.pwmWaves
        .map(w => ({ duty: w.duty, f: w.f, dv: pick(w.dv, ia) - pick(w.dv, ib) }))
        .filter(c => Math.abs(c.dv) > 1e-4),
    };
  }

  /** Board pin numbers wired to this pin (through wires and the breadboard only). */
  boardPinsOn(r: string): number[] {
    if (!this.board || !this.info || !this.nets.has(r)) return [];
    const root = this.nets.find(r);
    const out: number[] = [];
    for (const p of PARTS[this.board.type].pins) {
      const n = this.info.pinNumber(p.id);
      if (n !== null && this.nets.find(ref(this.board.id, p.id)) === root) out.push(n);
    }
    return out;
  }
  private boardPinIdOn(r: string, pinId: string): boolean {
    return !!this.board && this.nets.has(r) && this.nets.find(r) === this.nets.find(ref(this.board.id, pinId));
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
    const glow = (a: number) => Math.min(1, Math.pow(Math.max(0, a) / 0.012, 0.6));

    for (const p of this.parts) {
      switch (p.type) {
        case 'led': {
          const a = amps(p.id, 0);
          const over = a > 0.03;
          if (over) note(p, `This LED is getting ${Math.round(a * 1000)} mA. Above about 20 mA it burns out, so put a resistor (220 Ω works) in its path.`);
          else if (this.drop(p, 'K', 'A') > 1.2) note(p, 'This LED is backwards. Flip it so the long leg (anode) faces the + side.');
          out[p.id] = { b: glow(a), over, ma: a * 1000 };
          break;
        }
        case 'rgb_led': {
          const c = [amps(p.id, 0), amps(p.id, 1), amps(p.id, 2)];
          if (Math.max(...c) > 0.03) note(p, 'A color of this RGB LED is getting too much current. Give each color pin its own resistor.');
          out[p.id] = { rgb: [glow(c[0]), glow(c[1]), glow(c[2])], over: Math.max(...c) > 0.03 };
          break;
        }
        case 'seg7': {
          const c = SEGMENTS.map((_, ch) => amps(p.id, ch));
          if (Math.max(...c) > 0.03) note(p, 'A segment is getting too much current. Put a resistor on the common pin or on each segment.');
          out[p.id] = { segs: c.map(glow) };
          break;
        }
        case 'diode': {
          const a = amps(p.id, 0);
          if (a > 1) note(p, `${a.toFixed(1)} A is going through this diode. It is rated for 1 A.`);
          out[p.id] = { ma: a * 1000 };
          break;
        }
        case 'npn': {
          const k = this.bjts.findIndex(t => t.part === p.id);
          const ib = k < 0 ? 0 : this.bjtIb[k], ic = k < 0 ? 0 : this.bjtIc[k];
          if (ib > 0.03) note(p, `The base is getting ${Math.round(ib * 1000)} mA. Put a resistor (1 kΩ works) between the pin and the base.`);
          if (ic > 0.8) note(p, `${Math.round(ic * 1000)} mA is flowing through this transistor. It is rated for 600 mA, so it would overheat.`);
          // Fully on (saturated) when the base gets more current than the load could ever use.
          out[p.id] = { ma: ic * 1000, base: ib * 1000, state: ic < 1e-5 ? 'off' : BETA * ib > 1.2 * ic ? 'on' : 'partly' };
          break;
        }
        case 'capacitor': {
          const vc = this.drop(p, '+', '-');
          if (vc < -1) note(p, 'This capacitor is in backwards. The leg next to the stripe must go to the − side, or a real one can pop.');
          else if (vc > 25.5) note(p, 'This capacitor is rated for 25 V and has more than that across it.');
          out[p.id] = { volts: vc };
          break;
        }
        case 'motor': {
          const i = this.drop(p, '+', '-') / R_MOTOR;
          const onPin = this.boardPinsOn(ref(p.id, '+')).length > 0 || this.boardPinsOn(ref(p.id, '-')).length > 0;
          if (onPin && Math.abs(i) > 0.04) note(p, 'Motors need more current than a pin can safely give. Drive it through a transistor, like the motor speed project does.');
          const turning = Math.abs(i) >= 0.02;
          out[p.id] = { ma: i * 1000, rps: turning ? Math.sign(i) * Math.min(12, (Math.abs(i) / 0.25) * 7) : 0 };
          break;
        }
        case 'multimeter': {
          const mode = String(p.props.mode || 'V');
          const v = this.drop(p, 'V', 'COM');
          if (mode === 'A' && Math.abs(v / R_SHUNT) > 0.5) note(p, 'Far too much current for the meter. In mA mode it has to go in the path of the current, never straight across a power supply.');
          out[p.id] = { reading: meterReading(mode, v) };
          break;
        }
        case 'buzzer': {
          let hz = 0;
          if (rt) for (const n of this.boardPinsOn(ref(p.id, '+'))) { const t = rt.tones.get(n); if (t) hz = t.hz; }
          const grounded = (this.nets.has(ref(p.id, '-')) && this.nets.find(ref(p.id, '-')) === this.groundRoot) || Math.abs(this.voltageAt(ref(p.id, '-'))) < 0.5;
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
        case 'ne555': {
          const ok = this.powered(p);
          const q = ok && (this.timerQ.get(p.id) ?? false);
          const vout = this.drop(p, 'OUT', 'GND');
          const vcc = this.drop(p, 'VCC', 'GND');
          const ma = ok ? (q ? Math.max(0, (vcc - 1.3 - vout) / 20) : Math.max(0, vout / 15)) * 1000 : 0;
          if (ma > 200) note(p, `The output pin is pushing ${Math.round(ma)} mA. A 555 is rated for 200 mA.`);
          out[p.id] = { on: ok, state: !ok ? 'off' : q ? 'on' : 'off', volts: vout, ma };
          break;
        }
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

/** What the multimeter's display shows for a voltage across its probes. */
export function meterReading(mode: string, v: number): { value: string; unit: string } {
  if (mode === 'A') {
    const a = v / R_SHUNT;
    if (Math.abs(a) >= 10) return { value: 'OL', unit: 'A' };
    if (Math.abs(a) < 1) return { value: (a * 1000).toFixed(Math.abs(a) < 0.1 ? 1 : 0), unit: 'mA' };
    return { value: a.toFixed(2), unit: 'A' };
  }
  if (mode === 'Ω') {
    if (v > OHM_V - 0.0005 || v < -0.01) return { value: 'OL', unit: 'Ω' };
    const r = Math.max(0, (OHM_R * v) / (OHM_V - v));
    if (r >= 1e6) return { value: (r / 1e6).toFixed(2), unit: 'MΩ' };
    if (r >= 1e3) return { value: (r / 1e3).toFixed(r >= 1e5 ? 0 : r >= 1e4 ? 1 : 2), unit: 'kΩ' };
    return { value: r.toFixed(r >= 100 ? 0 : 1), unit: 'Ω' };
  }
  if (Math.abs(v) >= 200) return { value: 'OL', unit: 'V' };
  if (Math.abs(v) < 1) return { value: (v * 1000).toFixed(0), unit: 'mV' };
  return { value: v.toFixed(2), unit: 'V' };
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
