/**
 * Everything a running sketch can call: pinMode, digitalWrite, delay, Serial,
 * Servo, the LCD... Time here is virtual. The simulator moves `frameEnd`
 * forward each animation frame and the sketch runs until it catches up.
 */

export interface PinState {
  mode: 0 | 1 | 2; // INPUT, OUTPUT, INPUT_PULLUP
  level: 0 | 1;
  /** analogWrite duty 0..1, or null when the pin is plain digital */
  pwm: number | null;
  // bookkeeping for pins that are toggled faster than the screen redraws
  since: number;
  hi: number;
  flips: number;
  /** averaged level over the last frame, when the sketch toggled it quickly */
  avg: number | null;
}

/** What the runtime needs from the circuit. */
export interface BoardIO {
  vcc: number;
  adcMax: number;
  led: number;
  analogPin(channel: number): number;
  isPin(n: number): boolean;
  pinsChanged(): void;
  voltage(pin: number): number;
  dht(pin: number): { t: number; h: number } | null;
  echoCm(pin: number): number | null;
}

export class SketchError extends Error {}

const fmt = (v: unknown, t: string, arg?: number): string => {
  if (t === 'String') return String(v);
  if (t === 'char') return String.fromCharCode(Number(v));
  if (t === 'bool') return v ? '1' : '0';
  const n = Number(v);
  if (t === 'float') {
    if (Number.isNaN(n)) return 'nan';
    if (!Number.isFinite(n)) return n > 0 ? 'inf' : '-inf';
    return n.toFixed(arg ?? 2);
  }
  if (arg && arg !== 10) return (Math.trunc(n) >>> 0).toString(arg).toUpperCase();
  return String(Math.trunc(n));
};

export class Runtime {
  us = 0;
  frameEnd = 0;
  pins = new Map<number, PinState>();
  serialOut = '';
  serialIn = '';
  servos = new Map<number, number>();
  tones = new Map<number, { hz: number; until: number }>();
  lcd = { on: false, backlight: false, rows: ['', ''], cols: 16, col: 0, row: 0 };
  LED: number;
  private ticks = 0;
  private wallStart = 0;
  private io: BoardIO;

  constructor(io: BoardIO) {
    this.io = io;
    this.LED = io.led;
  }

  // ---- scheduling ----
  beginFrame(us: number) {
    this.frameEnd = this.us + us;
    this.wallStart = performance.now();
  }
  /** Called at every loop turn. Returns true when the sketch should pause until the next frame. */
  tick(): boolean {
    this.us += 2;
    if ((++this.ticks & 1023) === 0 && performance.now() - this.wallStart > 14) this.us = this.frameEnd;
    return this.us >= this.frameEnd;
  }
  *delay(ms: number): Generator<void, void, void> { yield* this.delayUs(ms * 1000); }
  *delayUs(us: number): Generator<void, void, void> {
    const end = this.us + Math.max(0, +us || 0);
    while (end > this.frameEnd) { this.us = this.frameEnd; yield; }
    this.us = end;
  }
  millis() { return Math.floor(this.us / 1000); }
  micros() { return Math.floor(this.us); }

  /** Close the books on fast-toggled pins so LEDs can show an average brightness. */
  endFrame(frameUs: number) {
    for (const p of this.pins.values()) {
      const hi = p.hi + (p.level ? this.frameEnd - p.since : 0);
      p.avg = p.flips >= 2 && frameUs > 0 ? Math.min(1, Math.max(0, hi / frameUs)) : null;
      p.hi = 0; p.flips = 0; p.since = this.frameEnd;
    }
    for (const [pin, t] of this.tones) if (t.until && this.us >= t.until) this.tones.delete(pin);
  }

  // ---- pins ----
  A(ch: number) { return this.io.analogPin(ch); }
  private pin(n: number, fn: string): PinState {
    n = Math.trunc(n);
    let p = this.pins.get(n);
    if (!p) {
      if (!this.io.isPin(n)) throw new SketchError(`${fn}() was called with pin ${n}, but this board has no pin ${n}.`);
      p = { mode: 0, level: 0, pwm: null, since: this.us, hi: 0, flips: 0, avg: null };
      this.pins.set(n, p);
    }
    return p;
  }
  pm(n: number, mode: number) {
    const p = this.pin(n, 'pinMode');
    p.mode = (mode === 1 ? 1 : mode === 2 ? 2 : 0);
    if (p.mode !== 1) { p.pwm = null; }
    this.io.pinsChanged();
  }
  dw(n: number, v: number) {
    const p = this.pin(n, 'digitalWrite');
    const level = v ? 1 : 0;
    this.us += 4;
    if (p.mode !== 1) { p.mode = level ? 2 : 0; this.io.pinsChanged(); return; } // writing HIGH to an input turns on the pull-up
    if (p.level !== level || p.pwm !== null) {
      if (p.level) p.hi += this.us - p.since;
      p.since = this.us; p.flips++;
      p.level = level; p.pwm = null;
      this.io.pinsChanged();
    }
  }
  aw(n: number, v: number) {
    const p = this.pin(n, 'analogWrite');
    p.mode = 1;
    const duty = Math.min(255, Math.max(0, Math.trunc(v))) / 255;
    p.pwm = duty; p.level = duty >= 0.5 ? 1 : 0;
    this.us += 8;
    this.io.pinsChanged();
  }
  dr(n: number): number {
    const p = this.pin(n, 'digitalRead');
    this.us += 4;
    if (p.mode === 1) return p.level;
    return this.io.voltage(Math.trunc(n)) > this.io.vcc * 0.5 ? 1 : 0;
  }
  ar(n: number): number {
    n = Math.trunc(n);
    if (n >= 0 && n <= 5 && this.io.vcc === 5) n = this.io.analogPin(n); // analogRead(0) means A0 on an Uno
    this.pin(n, 'analogRead');
    this.us += 100;
    const v = this.io.voltage(n) / this.io.vcc;
    return Math.min(this.io.adcMax, Math.max(0, Math.round(v * this.io.adcMax)));
  }
  *pulseIn(n: number, _state = 1, timeout = 1_000_000): Generator<void, number, void> {
    const cm = this.io.echoCm(Math.trunc(n));
    if (cm === null) { yield* this.delayUs(timeout); return 0; }
    const us = Math.round(cm * 58.83);
    yield* this.delayUs(us + 480);
    return us;
  }
  tone(n: number, hz: number, ms?: number) {
    this.pin(n, 'tone');
    this.tones.set(Math.trunc(n), { hz: Math.max(31, +hz || 0), until: ms ? this.us + ms * 1000 : 0 });
  }
  noTone(n: number) { this.tones.delete(Math.trunc(n)); }

  // ---- maths and text ----
  idiv(a: number, b: number) { return b === 0 ? 0 : Math.trunc(a / b); }
  imod(a: number, b: number) { return b === 0 ? 0 : a % b; }
  map(x: number, a: number, b: number, c: number, d: number) { return b === a ? c : Math.trunc(((x - a) * (d - c)) / (b - a) + c); }
  random(a: number, b?: number) {
    const [lo, hi] = b === undefined ? [0, a] : [a, b];
    return hi <= lo ? lo : Math.floor(lo + Math.random() * (hi - lo));
  }
  str(v: unknown, t: string, arg?: number) { return fmt(v, t, arg); }
  at(s: string, i: number) { const c = s.charCodeAt(i); return Number.isNaN(c) ? 0 : c; }
  toInt(s: string) { const n = parseInt(s, 10); return Number.isNaN(n) ? 0 : n; }
  toFloat(s: string) { const n = parseFloat(s); return Number.isNaN(n) ? 0 : n; }
  remove(s: string, i: number, n?: number) { return s.slice(0, i) + (n === undefined ? '' : s.slice(i + n)); }
  arr(n: number, z: unknown) {
    if (!(n >= 0 && n <= 4000)) throw new SketchError(`An array of size ${n} is too big for the board's memory.`);
    return Array.from({ length: n }, () => z);
  }
  arr2(n: number, m: number, z: unknown) { return Array.from({ length: n }, () => this.arr(m, z)); }

  // ---- Serial ----
  Serial = {
    begin: () => {},
    flush: () => {},
    print: (v: unknown, t: string, arg?: number) => { this.out(fmt(v, t, arg)); },
    println: (v: unknown, t: string, arg?: number) => { this.out(fmt(v, t, arg) + '\n'); },
    write: (v: number) => { this.out(String.fromCharCode(v)); },
    available: () => this.serialIn.length,
    peek: () => (this.serialIn.length ? this.serialIn.charCodeAt(0) : -1),
    read: () => {
      if (!this.serialIn.length) return -1;
      const c = this.serialIn.charCodeAt(0);
      this.serialIn = this.serialIn.slice(1);
      return c;
    },
    parseInt: () => {
      const m = /^[^\d-]*(-?\d+)/.exec(this.serialIn);
      this.serialIn = m ? this.serialIn.slice(m[0].length) : '';
      return m ? parseInt(m[1], 10) : 0;
    },
    parseFloat: () => {
      const m = /^[^\d.-]*(-?\d*\.?\d+)/.exec(this.serialIn);
      this.serialIn = m ? this.serialIn.slice(m[0].length) : '';
      return m ? parseFloat(m[1]) : 0;
    },
    readString: () => { const s = this.serialIn; this.serialIn = ''; return s; },
    readStringUntil: (ch: number) => {
      const i = this.serialIn.indexOf(String.fromCharCode(ch));
      const s = i < 0 ? this.serialIn : this.serialIn.slice(0, i);
      this.serialIn = i < 0 ? '' : this.serialIn.slice(i + 1);
      return s;
    },
  };
  private out(s: string) {
    this.us += 20 * s.length;
    this.serialOut += s;
    if (this.serialOut.length > 20000) this.serialOut = this.serialOut.slice(-10000);
  }

  // ---- libraries ----
  make(cls: string, args: number[]): unknown {
    if (cls === 'Servo') {
      let pin = -1;
      return {
        attach: (n: number) => { pin = Math.trunc(n); this.pin(pin, 'attach'); if (!this.servos.has(pin)) this.servos.set(pin, 90); },
        detach: () => { this.servos.delete(pin); pin = -1; },
        attached: () => pin >= 0,
        write: (a: number) => { if (pin >= 0) this.servos.set(pin, Math.min(180, Math.max(0, +a || 0))); },
        writeMicroseconds: (u: number) => { if (pin >= 0) this.servos.set(pin, Math.min(180, Math.max(0, ((u - 544) / (2400 - 544)) * 180))); },
        read: () => Math.round(this.servos.get(pin) ?? 0),
      };
    }
    if (cls === 'DHT') {
      const pin = Math.trunc(args[0] ?? -1);
      return {
        begin: () => { this.pin(pin, 'DHT'); },
        readTemperature: (f?: number) => { const r = this.io.dht(pin); return r ? (f ? r.t * 1.8 + 32 : r.t) : NaN; },
        readHumidity: () => this.io.dht(pin)?.h ?? NaN,
      };
    }
    const lcd = this.lcd;
    lcd.cols = args[1] || 16;
    const write = (s: string) => {
      for (const ch of s) {
        if (lcd.col < lcd.cols && lcd.row < 2) {
          const r = lcd.rows[lcd.row].padEnd(lcd.cols, ' ');
          lcd.rows[lcd.row] = r.slice(0, lcd.col) + ch + r.slice(lcd.col + 1);
        }
        lcd.col++;
      }
    };
    const nop = () => {};
    return {
      init: () => { lcd.on = true; }, begin: () => { lcd.on = true; },
      backlight: () => { lcd.backlight = true; }, noBacklight: () => { lcd.backlight = false; },
      clear: () => { lcd.rows = ['', '']; lcd.col = 0; lcd.row = 0; this.us += 2000; },
      home: () => { lcd.col = 0; lcd.row = 0; },
      setCursor: (c: number, r: number) => { lcd.col = Math.max(0, Math.trunc(c)); lcd.row = Math.max(0, Math.trunc(r)); },
      print: (v: unknown, t: string, arg?: number) => write(fmt(v, t, arg)),
      write: (v: number) => write(String.fromCharCode(v)),
      display: nop, noDisplay: nop, cursor: nop, noCursor: nop, blink: nop, noBlink: nop,
    };
  }
}
