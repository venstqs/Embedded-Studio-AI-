import type { Live, Note, Part, Wire } from '../types.ts';
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
}

/**
 * One running simulation: a compiled sketch plus the circuit it is wired to.
 * Call step() once per animation frame.
 */
export class Simulator {
  private circuit: Circuit;
  private rt: Runtime | null = null;
  private gen: Generator<void, void, void> | null = null;
  private stale = true;
  private error: string | null = null;

  /** Throws CompileError if the sketch has a mistake. */
  constructor(parts: Part[], wires: Wire[], code: string) {
    this.circuit = new Circuit(parts, wires);
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
    for (const [n, p] of this.rt.pins) {
      const id = info.pinId(n);
      if (!id) continue;
      if (p.mode === 1) out.set(id, { v: info.vcc, r: 25, pwm: p.pwm ?? (averaged && p.avg !== null ? p.avg : p.level) });
      else if (p.mode === 2) out.set(id, { v: info.vcc, r: 30000 });
    }
    return out;
  }

  /** Parts moved, a button was pressed, a knob was turned: rebuild the wiring. */
  setCircuit(parts: Part[], wires: Wire[]) {
    this.circuit = new Circuit(parts, wires);
    this.stale = true;
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
    this.circuit.solve(this.drives(true));
    this.stale = true;
    const live = this.circuit.live(rt);
    let hz = 0;
    for (const l of Object.values(live)) if (l.hz) hz = l.hz;
    return { live, notes: this.circuit.notes, serial, ms: rt ? rt.millis() : 0, hz, error: this.error };
  }
}
