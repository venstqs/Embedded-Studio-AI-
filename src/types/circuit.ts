export type ComponentType =
  | 'mcu'
  | 'led'
  | 'rgb_led'
  | 'resistor'
  | 'button'
  | 'potentiometer'
  | 'dht11'
  | 'ultrasonic'
  | 'ldr'
  | 'relay'
  | 'breadboard'
  | 'servo'
  | 'buzzer'
  | 'lcd';

export type MCUModel = 'uno' | 'esp32';
export type PinType = 'power' | 'ground' | 'digital' | 'analog' | 'sensor' | 'passive';

export interface Pin {
  id: string; // e.g. "uno_pin_d13" or "led_1_pin_anode"
  name: string; // e.g. "D13", "GND", "Anode", "Trig"
  type: PinType;
  x: number; // relative coordinate inside component width
  y: number; // relative coordinate inside component height
  parentComponentId: string;
}

export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pins: Pin[];
  model?: MCUModel;
  value?: number; // resistance in ohms, temperature, angle, distance
  color?: string; // LED color: 'red', 'green', 'blue', 'yellow', 'white'
  rotation?: number; // 0, 90, 180, 270
  state?: {
    isOn?: boolean;
    brightness?: number; // 0-255 for analogWrite / PWM
    rValue?: number; // 0-255 for RGB LED
    gValue?: number; // 0-255 for RGB LED
    bValue?: number; // 0-255 for RGB LED
    isPressed?: boolean;
    temperature?: number; // DHT11 Temp in °C
    humidity?: number; // DHT11 Hum in %
    distance?: number; // HC-SR04 distance in cm (2-400)
    lux?: number; // LDR light level in lux (0-1000)
    isRelayClosed?: boolean; // Relay switch active state
    voltage?: number; // Potentiometer output voltage
    angle?: number; // Servo angle 0-180
    frequency?: number; // Piezo Buzzer frequency in Hz
    text?: string; // LCD display text
  };
}

export interface Wire {
  id: string;
  fromPinId: string;
  toPinId: string;
  color: string;
}

export interface SimulationLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface DebuggerAlert {
  id: string;
  type: 'warning' | 'error' | 'success' | 'info';
  message: string;
  source: 'schematic' | 'code';
}

export interface OscilloscopeSample {
  time: number;
  voltage: number;
}

export interface SimulationState {
  isPlaying: boolean;
  speed: number; // multiplier, e.g. 1
  logs: SimulationLog[];
  pinVoltages: Record<string, number>; // Maps specific pin IDs to their calculated voltages
  pinModes: Record<string, 'input' | 'output' | 'input_pullup'>;
  oscilloscopeSamples?: Record<string, OscilloscopeSample[]>;
}

export interface ProjectFile {
  name: string;
  content: string;
  isActive: boolean;
}
