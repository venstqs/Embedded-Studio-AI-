import type { Part, PartType, PinDef, Rot } from '../types.ts';

/** Hole pitch of the breadboard. Every pin sits on a multiple of this. */
export const P = 12;

export interface PartSpec {
  name: string;
  group: 'Boards' | 'Basics' | 'Chips' | 'Inputs' | 'Outputs' | 'Sensors' | 'Instruments';
  blurb: string;
  /** Art bounds in local coordinates: x0, y0, x1, y1 */
  box: [number, number, number, number];
  pins: PinDef[];
  defaults: Record<string, number | string>;
}

const pin = (id: string, name: string, x: number, y: number, kind: PinDef['kind'], strip?: string): PinDef =>
  ({ id, name, x, y, kind, strip });

// ---- Breadboard: 30 columns, rows a-e and f-j, a power rail pair on each side ----
export const BB_COLS = 30;
const BB_X0 = 24;
const ROWS_TOP = ['a', 'b', 'c', 'd', 'e'];
const ROWS_BOT = ['f', 'g', 'h', 'i', 'j'];

function breadboardPins(): PinDef[] {
  const out: PinDef[] = [];
  for (let c = 0; c < BB_COLS; c++) {
    const x = BB_X0 + c * P;
    const n = c + 1;
    out.push(pin(`tp${n}`, `+ rail`, x, 12, 'hole', 'tp'));
    out.push(pin(`tn${n}`, `− rail`, x, 24, 'hole', 'tn'));
    ROWS_TOP.forEach((r, i) => out.push(pin(`${r}${n}`, `${r}${n}`, x, 48 + i * P, 'hole', `t${n}`)));
    ROWS_BOT.forEach((r, i) => out.push(pin(`${r}${n}`, `${r}${n}`, x, 120 + i * P, 'hole', `b${n}`)));
    out.push(pin(`bp${n}`, `+ rail`, x, 192, 'hole', 'bp'));
    out.push(pin(`bn${n}`, `− rail`, x, 204, 'hole', 'bn'));
  }
  return out;
}

function unoPins(): PinDef[] {
  const out: PinDef[] = [];
  const top = ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'];
  top.forEach((id, i) => out.push(pin(
    id === 'GND' ? 'GND3' : id, id.replace(/^D/, ''), 84 + i * P, 12,
    id === 'GND' ? 'ground' : 'digital',
    id === 'GND' ? 'gnd' : id === 'SDA' ? 'sda' : id === 'SCL' ? 'scl' : undefined)));
  for (let i = 0; i < 8; i++) out.push(pin(`D${7 - i}`, `${7 - i}`, 216 + i * P, 12, 'digital'));
  const pw: [string, string, PinDef['kind'], string?][] = [
    ['IOREF', 'IOREF', 'passive'], ['RESET', 'RESET', 'passive'], ['3V3', '3.3V', 'power'],
    ['5V', '5V', 'power'], ['GND', 'GND', 'ground', 'gnd'], ['GND2', 'GND', 'ground', 'gnd'], ['VIN', 'Vin', 'passive'],
  ];
  pw.forEach(([id, name, kind, strip], i) => out.push(pin(id, name, 120 + i * P, 204, kind, strip)));
  for (let i = 0; i < 6; i++) {
    out.push(pin(`A${i}`, `A${i}`, 216 + i * P, 204, 'analog', i === 4 ? 'sda' : i === 5 ? 'scl' : undefined));
  }
  return out;
}

function esp32Pins(): PinDef[] {
  const left = ['EN', 'D36', 'D39', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND', 'VIN'];
  const right = ['D23', 'D22', 'D1', 'D3', 'D21', 'D19', 'D18', 'D5', 'D17', 'D16', 'D4', 'D2', 'D15', 'GND2', '3V3'];
  const mk = (id: string, x: number, i: number): PinDef => {
    const kind: PinDef['kind'] = id.startsWith('GND') ? 'ground' : id === '3V3' || id === 'VIN' ? 'power' : id === 'EN' ? 'passive' : 'digital';
    const name = id.startsWith('GND') ? 'GND' : id === '3V3' ? '3.3V' : id === 'VIN' ? 'VIN (5V)' : id.replace(/^D/, 'GPIO ');
    return pin(id, name, x, 24 + i * P, kind, kind === 'ground' ? 'gnd' : undefined);
  };
  return [...left.map((id, i) => mk(id, 12, i)), ...right.map((id, i) => mk(id, 108, i))];
}

export const PARTS: Record<PartType, PartSpec> = {
  uno: {
    name: 'Arduino Uno', group: 'Boards', blurb: 'The brain. Runs your sketch and switches its pins on and off.',
    box: [0, 0, 324, 216], pins: unoPins(), defaults: {},
  },
  esp32: {
    name: 'ESP32 DevKit', group: 'Boards', blurb: 'A faster 3.3 V brain with Wi-Fi built in.',
    box: [0, 0, 120, 216], pins: esp32Pins(), defaults: {},
  },
  breadboard: {
    name: 'Breadboard', group: 'Boards', blurb: 'Push parts into the holes. Each column of five is joined inside.',
    box: [0, 0, 396, 216], pins: breadboardPins(), defaults: {},
  },
  battery: {
    name: '9V battery', group: 'Boards', blurb: 'Power for circuits that need no code.',
    box: [-18, -92, 42, 4],
    pins: [pin('+', 'Positive (+)', 0, 0, 'power'), pin('-', 'Negative (−)', 24, 0, 'ground')],
    defaults: {},
  },
  led: {
    name: 'LED', group: 'Basics', blurb: 'Lights up when current flows from the long leg to the short leg.',
    box: [-9, -50, 21, 4],
    pins: [pin('A', 'Anode (+, long leg)', 0, 0, 'passive'), pin('K', 'Cathode (−, short leg)', 12, 0, 'passive')],
    defaults: { color: 'red' },
  },
  rgb_led: {
    name: 'RGB LED', group: 'Outputs', blurb: 'Three LEDs in one. Mix red, green and blue into any color.',
    box: [-6, -54, 42, 4],
    pins: [pin('R', 'Red', 0, 0, 'passive'), pin('K', 'Common cathode (−)', 12, 0, 'passive'), pin('G', 'Green', 24, 0, 'passive'), pin('B', 'Blue', 36, 0, 'passive')],
    defaults: {},
  },
  resistor: {
    name: 'Resistor', group: 'Basics', blurb: 'Slows the current down so parts like LEDs do not burn out.',
    box: [-4, -8, 52, 8],
    pins: [pin('1', 'Lead 1', 0, 0, 'passive'), pin('2', 'Lead 2', 48, 0, 'passive')],
    defaults: { ohms: 220 },
  },
  button: {
    name: 'Push button', group: 'Inputs', blurb: 'Joins its two sides only while you hold it down.',
    box: [-7, -7, 31, 31],
    pins: [
      pin('1a', 'Side 1', 0, 0, 'passive', 's1'), pin('2a', 'Side 2', 24, 0, 'passive', 's2'),
      pin('1b', 'Side 1', 0, 24, 'passive', 's1'), pin('2b', 'Side 2', 24, 24, 'passive', 's2'),
    ],
    defaults: { pressed: 0 },
  },
  potentiometer: {
    name: 'Potentiometer', group: 'Inputs', blurb: 'A knob. Turning it changes the voltage on the middle pin.',
    box: [-12, -56, 36, 4],
    pins: [pin('1', 'End 1', 0, 0, 'passive'), pin('W', 'Wiper (middle)', 12, 0, 'analog'), pin('2', 'End 2', 24, 0, 'passive')],
    defaults: { pos: 0.5 },
  },
  ldr: {
    name: 'Light sensor', group: 'Sensors', blurb: 'A photoresistor. More light means less resistance.',
    box: [-9, -40, 21, 4],
    pins: [pin('1', 'Lead 1', 0, 0, 'passive'), pin('2', 'Lead 2', 12, 0, 'passive')],
    defaults: { lux: 500 },
  },
  buzzer: {
    name: 'Piezo buzzer', group: 'Outputs', blurb: 'Makes sound. Use tone() to play notes.',
    box: [-12, -46, 36, 4],
    pins: [pin('+', 'Positive (+)', 0, 0, 'passive'), pin('-', 'Negative (−)', 24, 0, 'passive')],
    defaults: {},
  },
  servo: {
    name: 'Servo motor', group: 'Outputs', blurb: 'Turns its arm to the exact angle you ask for, 0 to 180°.',
    box: [-24, -108, 48, 4],
    pins: [pin('GND', 'Ground (brown)', 0, 0, 'ground'), pin('VCC', 'Power (red)', 12, 0, 'power'), pin('SIG', 'Signal (orange)', 24, 0, 'digital')],
    defaults: {},
  },
  ultrasonic: {
    name: 'Distance sensor', group: 'Sensors', blurb: 'HC-SR04. Measures distance with sound echoes, like a bat.',
    box: [-30, -70, 66, 4],
    pins: [pin('VCC', 'VCC', 0, 0, 'power'), pin('TRIG', 'Trig', 12, 0, 'digital'), pin('ECHO', 'Echo', 24, 0, 'digital'), pin('GND', 'GND', 36, 0, 'ground')],
    defaults: { cm: 50 },
  },
  dht11: {
    name: 'DHT11 sensor', group: 'Sensors', blurb: 'Reads air temperature and humidity.',
    box: [-10, -68, 34, 4],
    pins: [pin('VCC', 'VCC', 0, 0, 'power'), pin('DATA', 'Data', 12, 0, 'digital'), pin('GND', 'GND', 24, 0, 'ground')],
    defaults: { temp: 28, hum: 65 },
  },
  lcd: {
    name: 'LCD 16×2', group: 'Outputs', blurb: 'Shows two lines of text. Talks over two wires (I2C).',
    box: [-18, -102, 186, 4],
    pins: [pin('GND', 'GND', 0, 0, 'ground'), pin('VCC', 'VCC', 12, 0, 'power'), pin('SDA', 'SDA', 24, 0, 'digital'), pin('SCL', 'SCL', 36, 0, 'digital')],
    defaults: {},
  },
  capacitor: {
    name: 'Capacitor', group: 'Basics', blurb: 'Stores a little charge and lets it out slowly. Good for smoothing power and for timing.',
    box: [-10, -60, 22, 4],
    pins: [pin('+', 'Positive (+, long leg)', 0, 0, 'passive'), pin('-', 'Negative (−, striped side)', 12, 0, 'passive')],
    defaults: { uf: 100 },
  },
  diode: {
    name: 'Diode', group: 'Basics', blurb: 'A one-way valve for current. It only flows toward the striped end.',
    box: [-4, -8, 52, 8],
    pins: [pin('A', 'Anode', 0, 0, 'passive'), pin('K', 'Cathode (striped end)', 48, 0, 'passive')],
    defaults: {},
  },
  npn: {
    name: 'NPN transistor', group: 'Basics', blurb: 'An electronic switch. A small current into the base lets a big current flow from collector to emitter.',
    box: [-6, -44, 30, 4],
    pins: [pin('E', 'Emitter (goes to ground)', 0, 0, 'passive'), pin('B', 'Base (the control)', 12, 0, 'passive'), pin('C', 'Collector (goes to the load)', 24, 0, 'passive')],
    defaults: {},
  },
  motor: {
    name: 'DC motor', group: 'Outputs', blurb: 'Spins when current flows through it. Swap its wires and it spins the other way.',
    box: [-14, -64, 38, 4],
    pins: [pin('-', 'Lead (−)', 0, 0, 'passive'), pin('+', 'Lead (+)', 24, 0, 'passive')],
    defaults: {},
  },
  seg7: {
    name: '7-segment display', group: 'Outputs', blurb: 'Seven LEDs shaped like an 8. Light the right ones to show any digit.',
    box: [-6, -4, 54, 64],
    pins: [
      pin('g', 'Segment g (middle)', 0, 0, 'passive'), pin('f', 'Segment f (top left)', 12, 0, 'passive'),
      pin('COM', 'Common cathode (−)', 24, 0, 'passive', 'com'),
      pin('a', 'Segment a (top)', 36, 0, 'passive'), pin('b', 'Segment b (top right)', 48, 0, 'passive'),
      pin('e', 'Segment e (bottom left)', 0, 60, 'passive'), pin('d', 'Segment d (bottom)', 12, 60, 'passive'),
      pin('COM2', 'Common cathode (−)', 24, 60, 'passive', 'com'),
      pin('c', 'Segment c (bottom right)', 36, 60, 'passive'), pin('dp', 'Decimal point', 48, 60, 'passive'),
    ],
    defaults: {},
  },
  switch: {
    name: 'Slide switch', group: 'Inputs', blurb: 'Stays where you put it. Joins the middle pin to the left or the right pin.',
    box: [-8, -24, 32, 4],
    pins: [pin('A', 'Left pin', 0, 0, 'passive'), pin('C', 'Middle (common)', 12, 0, 'passive'), pin('B', 'Right pin', 24, 0, 'passive')],
    defaults: { pos: 0 },
  },
  multimeter: {
    name: 'Multimeter', group: 'Instruments', blurb: 'Measures voltage, current or resistance. Wire its two jacks to the points you want to test.',
    box: [-30, -24, 66, 150],
    pins: [pin('COM', 'COM (black probe)', 0, 0, 'ground'), pin('V', 'V Ω mA (red probe)', 36, 0, 'power')],
    defaults: { mode: 'V' },
  },
  scope: {
    name: 'Oscilloscope', group: 'Instruments', blurb: 'Draws voltage over time, so you can see signals change faster than your eye can follow.',
    box: [-24, -24, 192, 150],
    pins: [pin('CH', 'Channel 1 probe', 0, 0, 'digital'), pin('GND', 'Ground clip', 24, 0, 'ground')],
    defaults: { tdiv: 2, vdiv: 1 },
  },
  ne555: {
    name: '555 timer', group: 'Chips', blurb: 'The most popular chip ever made. With two resistors and a capacitor it blinks, beeps or times things, no code needed.',
    box: [-8, -6, 44, 30],
    pins: [
      pin('VCC', 'Pin 8: VCC (+)', 0, 0, 'power'), pin('DISCH', 'Pin 7: discharge', 12, 0, 'passive'),
      pin('THRES', 'Pin 6: threshold', 24, 0, 'passive'), pin('CTRL', 'Pin 5: control voltage', 36, 0, 'passive'),
      pin('GND', 'Pin 1: ground', 0, 24, 'ground'), pin('TRIG', 'Pin 2: trigger', 12, 24, 'passive'),
      pin('OUT', 'Pin 3: output', 24, 24, 'digital'), pin('RESET', 'Pin 4: reset', 36, 24, 'passive'),
    ],
    defaults: {},
  },
  relay: {
    name: 'Relay module', group: 'Outputs', blurb: 'A switch your code can flip, for loads too big for a pin.',
    box: [-18, -80, 42, 4],
    pins: [pin('VCC', 'VCC', 0, 0, 'power'), pin('GND', 'GND', 12, 0, 'ground'), pin('IN', 'Signal in', 24, 0, 'digital')],
    defaults: {},
  },
};

export const PART_ORDER: PartType[] = [
  'uno', 'esp32', 'breadboard', 'battery',
  'led', 'resistor', 'capacitor', 'diode', 'npn',
  'ne555',
  'button', 'switch', 'potentiometer',
  'rgb_led', 'seg7', 'buzzer', 'motor', 'servo', 'lcd', 'relay',
  'ldr', 'ultrasonic', 'dht11',
  'multimeter', 'scope',
];

/** Segment pins of the 7-segment display, in the order the simulator reports brightness. */
export const SEGMENTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'] as const;

/** Capacitor values offered in the inspector, in microfarads. */
export const CAPACITORS = [1, 10, 100, 470, 1000];
export const formatFarads = (uf: number) => (uf >= 1 ? `${+uf.toPrecision(3)} µF` : uf >= 0.001 ? `${+(uf * 1000).toPrecision(3)} nF` : `${+(uf * 1e6).toPrecision(3)} pF`);

/** The E12 series: the resistor values you can actually buy, repeated every decade. */
export const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];

const SI: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, '': 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1, r: 1 };

/**
 * Reads values the way engineers write them: "4.7k", "4k7", "220R", "1M", "100n", "2u2".
 * Returns the plain number, or null if it can't be read.
 */
export function parseSI(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '').replace(/(ohms?|Ω|F)$/i, '');
  if (!s) return null;
  const rkm = /^(\d+)([pnuµmkKMGRr])(\d+)$/.exec(s);
  if (rkm) return parseFloat(`${rkm[1]}.${rkm[3]}`) * SI[rkm[2]];
  const plain = /^(\d*\.?\d+(?:e[+-]?\d+)?)([pnuµmkKMGRr]?)$/.exec(s);
  if (plain) return parseFloat(plain[1]) * SI[plain[2]];
  return null;
}

/** World units to millimetres: one breadboard hole pitch (12 units) is 2.54 mm. */
export const MM_PER_UNIT = 2.54 / 12;

/**
 * A wire's curve: a gentle sag, plus an optional bend that moves the curve's
 * middle by `bend`. `mid` is that middle point, where the drag handle sits.
 */
export function wireGeom(a: { x: number; y: number }, b: { x: number; y: number }, bend?: [number, number]) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const sag = Math.min(34, len * 0.16);
  const [bx, by] = bend ?? [0, 0];
  const cx = (a.x + b.x) / 2 + 2 * bx, cy = (a.y + b.y) / 2 + sag + 2 * by;
  const mid = { x: (a.x + 2 * cx + b.x) / 4, y: (a.y + 2 * cy + b.y) / 4 };
  return { d: `M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}`, c: { x: cx, y: cy }, mid, len };
}

const PREFIX: Record<PartType, string> = {
  uno: 'MCU', esp32: 'MCU', breadboard: 'BB', battery: 'BT', led: 'LED', rgb_led: 'LED', resistor: 'R', button: 'SW',
  potentiometer: 'RV', ldr: 'LDR', buzzer: 'BZ', servo: 'M', ultrasonic: 'U', dht11: 'U', lcd: 'LCD', relay: 'K',
  capacitor: 'C', diode: 'D', npn: 'Q', motor: 'M', seg7: 'DS', switch: 'SW', multimeter: 'XMM', scope: 'XSC', ne555: 'U',
};

/** Reference designators (R1, C2, LED1...) in the order parts were added. A label the user typed wins. */
export function designators(parts: { id: string; type: PartType; props: Record<string, number | string> }[]): Map<string, string> {
  const count: Record<string, number> = {};
  const out = new Map<string, string>();
  for (const p of parts) {
    const pre = PREFIX[p.type];
    count[pre] = (count[pre] ?? 0) + 1;
    const label = typeof p.props.label === 'string' ? p.props.label.trim() : '';
    out.set(p.id, label || `${pre}${count[pre]}`);
  }
  return out;
}

/** The value printed beside a part and in the bill of materials. */
export function partValue(p: { type: PartType; props: Record<string, number | string> }): string {
  switch (p.type) {
    case 'resistor': return formatOhms(+p.props.ohms || 220);
    case 'capacitor': return formatFarads(+p.props.uf || 100);
    case 'led': return `${String(p.props.color ?? 'red')} LED`;
    case 'rgb_led': return 'common cathode';
    case 'potentiometer': return '10 kΩ';
    case 'battery': return '9 V';
    case 'diode': return '1N4007';
    case 'npn': return '2N2222';
    case 'ne555': return 'NE555';
    case 'ldr': return 'GL5528';
    case 'buzzer': return 'piezo';
    case 'servo': return 'SG90';
    case 'ultrasonic': return 'HC-SR04';
    case 'dht11': return 'DHT11';
    case 'lcd': return '16×2 I2C';
    case 'relay': return '5 V';
    case 'switch': return 'SPDT';
    case 'button': return '6 mm tactile';
    case 'seg7': return 'common cathode';
    case 'motor': return 'DC 3–6 V';
    case 'uno': return 'ATmega328P';
    case 'esp32': return 'ESP-WROOM-32';
    case 'breadboard': return '400 points';
    case 'multimeter': return p.props.mode === 'A' ? 'mA' : p.props.mode === 'Ω' ? 'Ω' : 'V DC';
    case 'scope': return `${p.props.tdiv} ms/div`;
  }
}

/** A part's outline in world coordinates, after rotation. */
export function partBounds(part: { type: PartType; x: number; y: number; rot: Rot }) {
  const [bx0, by0, bx1, by1] = PARTS[part.type].box;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [lx, ly] of [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]]) {
    const w = toWorld(part, lx, ly);
    x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y);
  }
  return { x0, y0, x1, y1 };
}

export const isBoard = (t: PartType) => t === 'uno' || t === 'esp32';

/** The point a part rotates around. Kept on the grid so pins stay on the grid. */
export function pivot(type: PartType): [number, number] {
  const [x0, y0, x1, y1] = PARTS[type].box;
  return [Math.round((x0 + x1) / 2 / P) * P, Math.round((y0 + y1) / 2 / P) * P];
}

export function toWorld(part: { type: PartType; x: number; y: number; rot: Rot }, lx: number, ly: number) {
  const [cx, cy] = pivot(part.type);
  let dx = lx - cx, dy = ly - cy;
  for (let r = 0; r < part.rot; r += 90) [dx, dy] = [-dy, dx];
  return { x: part.x + cx + dx, y: part.y + cy + dy };
}

export const pinPos = (part: Part, p: PinDef) => toWorld(part, p.x, p.y);

export const ref = (partId: string, pinId: string) => `${partId}:${pinId}`;

let seq = 0;
export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function makePart(type: PartType, x = 0, y = 0, props: Record<string, number | string> = {}): Part {
  return { id: newId(type[0]), type, x, y, rot: 0, props: { ...PARTS[type].defaults, ...props } };
}

// ---- Board facts the simulator needs ----
export interface BoardInfo {
  vcc: number;
  adcMax: number;
  led: number;
  pinId: (n: number) => string | null;
  pinNumber: (id: string) => number | null;
  sda: string;
  scl: string;
  /** [pin id, volts, source resistance] */
  supplies: [string, number, number][];
}

export const BOARDS: Record<'uno' | 'esp32', BoardInfo> = {
  uno: {
    vcc: 5, adcMax: 1023, led: 13,
    pinId: n => (n >= 0 && n <= 13 ? `D${n}` : n >= 14 && n <= 19 ? `A${n - 14}` : null),
    pinNumber: id => (/^D\d+$/.test(id) ? +id.slice(1) : /^A\d$/.test(id) ? 14 + +id.slice(1) : null),
    sda: 'A4', scl: 'A5',
    supplies: [['5V', 5, 0.5], ['3V3', 3.3, 2]],
  },
  esp32: {
    vcc: 3.3, adcMax: 4095, led: 2,
    pinId: n => (PARTS.esp32.pins.some(p => p.id === `D${n}`) ? `D${n}` : null),
    pinNumber: id => (/^D\d+$/.test(id) ? +id.slice(1) : null),
    sda: 'D21', scl: 'D22',
    supplies: [['VIN', 5, 0.5], ['3V3', 3.3, 1]],
  },
};

export const LED_COLORS: Record<string, { hex: string; vf: number }> = {
  red: { hex: '#ef2b2d', vf: 1.8 },
  yellow: { hex: '#f6b300', vf: 2.0 },
  green: { hex: '#1fb85c', vf: 2.1 },
  blue: { hex: '#2f6bff', vf: 3.0 },
  white: { hex: '#f4f7ff', vf: 3.0 },
};

const BAND = ['#1b1b1b', '#7a4a1e', '#e02424', '#f2801c', '#f2cf1f', '#1fa35b', '#2563eb', '#8b3fd9', '#8a8f98', '#ffffff'];
/** The three colour bands of a resistor value (two digits and a multiplier). */
export function resistorBands(ohms: number): string[] {
  const s = String(Math.max(10, Math.round(ohms)));
  return [BAND[+s[0]], BAND[+s[1]], BAND[Math.min(9, s.length - 2)]];
}

export function formatOhms(o: number): string {
  if (o >= 1e6) return `${+(o / 1e6).toFixed(1)} MΩ`;
  if (o >= 1e3) return `${+(o / 1e3).toFixed(1)} kΩ`;
  return `${o} Ω`;
}
