import type { Part, PartType, PinDef, Rot } from '../types.ts';

/** Hole pitch of the breadboard. Every pin sits on a multiple of this. */
export const P = 12;

export interface PartSpec {
  name: string;
  group: 'Boards' | 'Basics' | 'Inputs' | 'Outputs' | 'Sensors';
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
  relay: {
    name: 'Relay module', group: 'Outputs', blurb: 'A switch your code can flip, for loads too big for a pin.',
    box: [-18, -80, 42, 4],
    pins: [pin('VCC', 'VCC', 0, 0, 'power'), pin('GND', 'GND', 12, 0, 'ground'), pin('IN', 'Signal in', 24, 0, 'digital')],
    defaults: {},
  },
};

export const PART_ORDER: PartType[] = [
  'uno', 'esp32', 'breadboard', 'battery', 'led', 'resistor', 'button', 'potentiometer',
  'rgb_led', 'buzzer', 'servo', 'lcd', 'relay', 'ldr', 'ultrasonic', 'dht11',
];

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
