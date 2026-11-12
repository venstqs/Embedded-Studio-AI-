export type PartType =
  | 'uno' | 'esp32' | 'breadboard' | 'battery'
  | 'led' | 'rgb_led' | 'resistor' | 'button' | 'potentiometer' | 'ldr'
  | 'buzzer' | 'servo' | 'ultrasonic' | 'dht11' | 'lcd' | 'relay';

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
}

export interface Note {
  partId: string;
  text: string;
}
