import type { Live, Note, Part, ScopeView, Wire } from '../types.ts';
import { ref } from '../parts/catalog.ts';
import { Circuit } from './circuit.ts';
import type { Drive } from './circuit.ts';
import { compile } from './compiler.ts';
import { Runtime } from './runtime.ts';
import type { BoardIO } from './runtime.ts';

export interface Frame {
  live: Record<string, Live>;
  notes: Note[];
  /** New Serial text since the last frame */
  serial: string;
  ms: number;
  hz: number;
  error: string | null;
  /** Current in each wire, amps, positive from the wire's first end to its second. */
  wires: Record<string, number>;
}

interface Sample { t: number; lo: number; hi: number }

/** Divisions across and up the oscilloscope screen. */
export const SCOPE_DIVS = { x: 10, y: 8 };

/**
 * One running simulation: a compiled sketch plus the circuit it is wired to.
 * Call step() once per animation frame.
 */
export class Simulator {
  private circuit: Circuit;
  private parts: Part[];
  private rt: Runtime | null = null;
  private gen: Generator<void, void, void> | null = null;
  private stale = true;
  private error: string | null = null;
  /** Capacitor voltages and 555 flip-flop states, kept here so state survives a circuit rebuild. */
  private capV = new Map<string, number>();
  private timerQ = new Map<string, boolean>();
  private scopes = new Map<string, Sample[]>();
  /** Simulated milliseconds, for circuits without a board. */
  private clock = 0;

  /** Throws CompileError if the sketch has a mistake. */
  constructor(parts: Part[], wires: Wire[], code: string) {
    this.parts = parts;
    this.circuit = new Circuit(parts, wires, this.capV, this.timerQ);
    if (!this.circuit.board) return;
    const build = compile(code);
    const io: BoardIO = {
      vcc: this.circuit.info!.vcc,
      adcMax: this.circuit.info!.adcMax,
      led: this.circuit.info!.led,
      analogPin: ch => (this.circuit.board!.type === 'uno' ? 14 + ch : [36, 39, 34, 35, 32, 33][ch] ?? 36),
      isPin: n => this.circuit.info!.pinId(n) !== null,
      pinsChanged: () => { this.stale = true; },
      voltage: n => {
        if (this.stale) { this.circuit.solve(this.drives(false)); this.stale = false; }
        const id = this.circuit.info!.pinId(n);
        return id ? this.circuit.voltageAt(ref(this.circuit.board!.id, id)) : 0;
      },
      dht: n => { io.voltage(n); return this.circuit.dht(n); },
      echoCm: n => { io.voltage(n); return this.circuit.echoCm(n); },
    };
    const rt = new Runtime(io);
    const sketch = build(rt);
    this.rt = rt;
    this.gen = (function* () {
      yield* sketch.setup();
      for (;;) { yield* sketch.loop(); if (rt.tick()) yield; }
    })();
  }

  get hasSketch() { return this.rt !== null; }

  private drives(averaged: boolean): Map<string, Drive> {
    const out = new Map<string, Drive>();
    const info = this.circuit.info;
    if (!this.rt || !info) return out;
    const uno = this.circuit.board!.type === 'uno';
    for (const [n, p] of this.rt.pins) {
      const id = info.pinId(n);
      if (!id) continue;
      const tone = this.rt.tones.get(n);
      if (tone) { out.set(id, { v: info.vcc, r: 25, pwm: 0.5, f: tone.hz }); continue; }
      if (p.mode === 1) {
        const pwm = p.pwm ?? (averaged && p.avg !== null ? p.avg : p.level);
        // Uno PWM runs at 490 Hz, except pins 5 and 6 at 980 Hz. Software toggling has no fixed frequency.
        const f = p.pwm !== null ? (uno ? (n === 5 || n === 6 ? 980 : 490) : 1000) : undefined;
        out.set(id, { v: info.vcc, r: 25, pwm, f });
      } else if (p.mode === 2) out.set(id, { v: info.vcc, r: 30000 });
    }
    return out;
  }

  /** Parts moved, a button was pressed, a knob was turned: rebuild the wiring. */
  setCircuit(parts: Part[], wires: Wire[]) {
    this.parts = parts;
    this.circuit = new Circuit(parts, wires, this.capV, this.timerQ);
    this.stale = true;
    for (const id of this.scopes.keys()) if (!parts.some(p => p.id === id)) this.scopes.delete(id);
  }

  send(text: string) { if (this.rt) this.rt.serialIn += text; }

  voltageAt(r: string) { return this.circuit.voltageAt(r); }

  step(dtMs: number): Frame {
    const rt = this.rt;
    let serial = '';
    if (rt && this.gen && !this.error) {
      rt.beginFrame(dtMs * 1000);
      try {
        while (rt.us < rt.frameEnd) if (this.gen.next().done) break;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        this.error = /call stack/i.test(msg) ? 'A function keeps calling itself without stopping (infinite recursion).' : msg;
      }
      rt.endFrame(dtMs * 1000);
      serial = rt.serialOut;
      rt.serialOut = '';
    }
    this.clock += dtMs;
    // Capacitors and 555 timers move through time in small steps so charging curves and thresholds stay crisp.
    const drives = this.drives(true);
    const steps = this.circuit.hasTimers ? 16 : this.circuit.hasCapacitors ? 4 : 1;
    for (let s = 0; s < steps; s++) this.circuit.solve(drives, dtMs / 1000 / steps, true);
    this.stale = true;

    const live = this.circuit.live(rt);
    const now = rt ? rt.us / 1000 : this.clock;
    for (const p of this.parts) if (p.type === 'scope') live[p.id] = { scope: this.scopeView(p, now) };
    let hz = 0;
    for (const l of Object.values(live)) if (l.hz) hz = l.hz;
    const wires = this.circuit.wireCurrents();
    for (const k in wires) wires[k] = Math.round(wires[k] * 1e5) / 1e5;
    return { live, notes: this.circuit.notes, serial, ms: rt ? rt.millis() : Math.floor(this.clock), hz, error: this.error, wires };
  }

  /**
   * What the oscilloscope screen shows. Fast time bases draw the repeating
   * waveform of whatever PWM or tone pin is behind the probe, edge by edge.
   * Slow ones scroll the recorded history; PWM too fast to resolve shows as
   * a filled band, the way a real scope smears it.
   */
  private scopeView(p: Part, now: number): ScopeView {
    const w = this.circuit.wave(ref(p.id, 'CH'), ref(p.id, 'GND'));
    const swing = (sign: 1 | -1) => w.parts.reduce((s, c) => s + (c.f ? (sign > 0 ? Math.max(0, c.dv) : Math.min(0, c.dv)) : c.dv * c.duty), 0);
    let hist = this.scopes.get(p.id);
    if (!hist) { hist = []; this.scopes.set(p.id, hist); }
    hist.push({ t: now, lo: w.lo + swing(-1), hi: w.lo + swing(1) });
    while (hist.length > 2 && hist[0].t < now - 12000) hist.shift();

    const tdiv = +p.props.tdiv || 2;
    const span = tdiv * SCOPE_DIVS.x; // milliseconds across the screen
    const main = w.parts.filter(c => c.f).sort((a, b) => Math.abs(b.dv) - Math.abs(a.dv))[0];
    const view: ScopeView = { avg: w.avg, vmin: Infinity, vmax: -Infinity, f: main?.f, duty: main?.duty };

    if (span <= 100) {
      // Edges of every square wave inside the window, then the level between them.
      const dc = w.lo + w.parts.reduce((s, c) => s + (c.f ? 0 : c.dv * c.duty), 0);
      const edges = new Set<number>([0, span]);
      for (const c of w.parts) {
        if (!c.f) continue;
        const period = 1000 / c.f;
        for (let t = 0; t <= span && edges.size < 4000; t += period) { edges.add(t); edges.add(t + c.duty * period); }
      }
      const times = [...edges].filter(t => t <= span).sort((a, b) => a - b);
      const level = (t: number) => {
        let v = dc;
        for (const c of w.parts) if (c.f) { const ph = ((t / 1000) * c.f) % 1; if (ph < c.duty - 1e-9) v += c.dv; }
        return v;
      };
      const line: number[] = [];
      let prev = level(0);
      line.push(0, prev);
      for (const t of times) {
        const x = t / span;
        const next = level(Math.min(span - 1e-6, t + 1e-6));
        if (next !== prev) { line.push(x, prev, x, next); prev = next; }
      }
      line.push(1, prev);
      for (let i = 1; i < line.length; i += 2) { view.vmin = Math.min(view.vmin, line[i]); view.vmax = Math.max(view.vmax, line[i]); }
      view.line = line;
      return view;
    }

    const N = 240;
    const lo: number[] = new Array(N + 1).fill(NaN), hi: number[] = new Array(N + 1).fill(NaN);
    const start = now - span;
    let j = 0;
    for (let i = 0; i <= N; i++) {
      const t = start + (i / N) * span;
      while (j + 1 < hist.length && hist[j + 1].t <= t) j++;
      const s = hist[j];
      if (!s || s.t > t + 50) continue;
      lo[i] = s.lo; hi[i] = s.hi;
      view.vmin = Math.min(view.vmin, s.lo); view.vmax = Math.max(view.vmax, s.hi);
    }
    view.lo = lo;
    view.hi = hi;
    if (!main) { view.f = undefined; view.duty = undefined; }
    return view;
  }
}
