export type PartType =
  | 'uno' | 'esp32' | 'breadboard' | 'battery'
  | 'led' | 'rgb_led' | 'resistor' | 'button' | 'potentiometer' | 'ldr'
  | 'buzzer' | 'servo' | 'ultrasonic' | 'dht11' | 'lcd' | 'relay'
  | 'capacitor' | 'diode' | 'npn' | 'motor' | 'seg7' | 'switch'
  | 'multimeter' | 'scope' | 'ne555' | 'custom';

export type Rot = 0 | 90 | 180 | 270;

export interface Part {
  id: string;
  type: PartType;
  x: number;
  y: number;
  rot: Rot;
  /** Editable values: resistor ohms, LED color, knob position, sensor readings... */
  props: Record<string, number | string>;
}

/** Wire ends are pin references written as "partId:pinId". */
export interface Wire {
  id: string;
  from: string;
  to: string;
  color: string;
  /** How far the user dragged the middle of the wire away from its natural curve, in world units. */
  bend?: [number, number];
}

export type PinKind = 'power' | 'ground' | 'digital' | 'analog' | 'passive' | 'hole';

export interface PinDef {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: PinKind;
  /** Pins of one part that share a strip are joined inside the part. */
  strip?: string;
}

export interface Project {
  name: string;
  parts: Part[];
  wires: Wire[];
  code: string;
  /** Which starter this came from, so its "things to try" can be shown. */
  starter?: string;
  /** Voltage probes pinned to pins, graphed over time in the Probes panel. */
  probes?: Probe[];
  /** Hidden faults for the troubleshooting game. */
  faults?: Fault[];
  /** Set when this project is a classroom lesson. */
  lesson?: Lesson;
  /** A self-checking challenge this project is working on. */
  challenge?: string;
  /** Where each part sits on the schematic, if moved from the automatic layout. */
  schematic?: Record<string, [number, number]>;
}

export interface Fault {
  kind: 'open-wire' | 'dead' | 'value' | 'stuck';
  /** Part or wire id. */
  target: string;
  /** What was wrong, shown when it is found or revealed. */
  note: string;
}

export interface Lesson {
  title: string;
  text: string;
  lockParts: boolean;
  lockWires: boolean;
  lockCode: boolean;
}

/** A voltage probe clipped onto one pin (or breadboard hole). */
export interface Probe {
  id: string;
  /** The pin, as part:pin. */
  ref: string;
  /** P1, P2 ... */
  label: string;
  color: string;
}

/** What a part is doing right now while the simulation runs. */
export interface Live {
  /** LED brightness 0..1 */
  b?: number;
  rgb?: [number, number, number];
  over?: boolean;
  angle?: number;
  lcd?: string[] | null;
  backlight?: boolean;
  hz?: number;
  on?: boolean;
  /** Current through the part in milliamps (collector current for a transistor). */
  ma?: number;
  /** Transistor base current in milliamps, and whether it is switched off, partly on or fully on. */
  base?: number;
  state?: 'off' | 'partly' | 'on';
  /** Voltage across a capacitor. */
  volts?: number;
  /** Motor speed in turns per second; negative turns the other way. */
  rps?: number;
  /** 7-segment brightness per segment, a b c d e f g dp. */
  segs?: number[];
  /** Multimeter display. */
  reading?: { value: string; unit: string };
  scope?: ScopeView;
}

/** What an oscilloscope screen shows. Times run 0..1 across the screen. */
export interface ScopeView {
  /** Fast time base: a stepped line as flat pairs t, v, t, v ... */
  line?: number[];
  /** Slow time base: lowest and highest voltage at each of N+1 evenly spaced times (NaN where no data yet). */
  lo?: number[];
  hi?: number[];
  avg: number;
  vmin: number;
  vmax: number;
  /** Frequency and duty cycle of the strongest square wave, if any. */
  f?: number;
  duty?: number;
}

export interface Note {
  partId: string;
  text: string;
}
