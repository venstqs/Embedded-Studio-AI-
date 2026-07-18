export type ComponentType = 'mcu' | 'led' | 'resistor' | 'button' | 'potentiometer' | 'dht11' | 'breadboard';
export type MCUModel = 'uno' | 'esp32';
export type PinType = 'power' | 'ground' | 'digital' | 'analog' | 'sensor';

export interface Pin {
  id: string; // e.g. "uno_pin_13" or "led_1_pin_anode"
  name: string; // e.g. "D13", "GND", "Anode"
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
  value?: number; // e.g., resistance in ohms, temperature, angle
  state?: {
    isOn?: boolean;
    brightness?: number; // 0-255 for analogWrite / PWM
    isPressed?: boolean;
    temperature?: number; // DHT11 Temp
    humidity?: number; // DHT11 Hum
    voltage?: number; // Potentiometer output voltage
  };
}

export interface Wire {
  id: string;
  fromPinId: string;
  toPinId: string;
  color: string;
}

export interface SimulationState {
  isPlaying: boolean;
  speed: number; // multiplier, e.g. 1
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }>;
  pinVoltages: Record<string, number>; // Maps specific pin IDs to their calculated voltages (0 to 5 or 3.3)
  pinModes: Record<string, 'input' | 'output' | 'input_pullup'>; // Maps specific pin IDs to their modes
}

export interface ProjectFile {
  name: string;
  content: string;
  isActive: boolean;
}
