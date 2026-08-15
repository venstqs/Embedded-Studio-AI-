import type { Component, ComponentType, MCUModel, Pin } from '../types/circuit';

// Generate a unique ID
export const generateId = () => Math.random().toString(36).substring(2, 9);

// Resistor Color Code Band Calculator (4-Band)
const COLOR_CODES: Record<number, string> = {
  0: '#000000', // Black
  1: '#8b5a2b', // Brown
  2: '#ef4444', // Red
  3: '#f97316', // Orange
  4: '#eab308', // Yellow
  5: '#22c55e', // Green
  6: '#3b82f6', // Blue
  7: '#a855f7', // Violet
  8: '#6b7280', // Grey
  9: '#ffffff', // White
};

export const getResistorColorBands = (ohms: number = 220): string[] => {
  const valStr = Math.max(1, Math.round(ohms)).toString();
  const band1 = COLOR_CODES[parseInt(valStr[0], 10)] || '#8b5a2b';
  const band2 = COLOR_CODES[parseInt(valStr[1] || '0', 10)] || '#000000';
  const multiplierPower = Math.max(0, valStr.length - 2);
  const bandMultiplier = COLOR_CODES[multiplierPower] || '#000000';
  const bandTolerance = '#d4af37'; // Gold (5%)
  return [band1, band2, bandMultiplier, bandTolerance];
};

// Create pins for Arduino Uno R3
const createUnoPins = (componentId: string): Pin[] => {
  const pins: Pin[] = [];

  // Top Edge Header: SCL, SDA, AREF, GND, D13 down to D0 (x: 28 to 226, y: 14)
  const topNames = ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'TX1', 'RX0'];
  topNames.forEach((name, idx) => {
    pins.push({
      id: `${componentId}_pin_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name,
      type: name === 'GND' ? 'ground' : (name === 'SCL' || name === 'SDA' ? 'digital' : 'digital'),
      x: 32 + idx * 11,
      y: 14,
      parentComponentId: componentId,
    });
  });

  // Bottom Edge Power Header (x: 32 to 92, y: 154)
  const powerNames = ['RESET', '3.3V', '5V', 'GND1', 'GND2', 'Vin'];
  powerNames.forEach((name, idx) => {
    pins.push({
      id: `${componentId}_pin_${name.toLowerCase()}`,
      name: name.replace(/\d+$/, ''),
      type: name.includes('GND') ? 'ground' : 'power',
      x: 32 + idx * 11,
      y: 154,
      parentComponentId: componentId,
    });
  });

  // Bottom Edge Analog Header A0-A5 (x: 148 to 203, y: 154)
  const analogNames = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
  analogNames.forEach((name, idx) => {
    pins.push({
      id: `${componentId}_pin_${name.toLowerCase()}`,
      name,
      type: 'analog',
      x: 148 + idx * 11,
      y: 154,
      parentComponentId: componentId,
    });
  });

  return pins;
};

// Create pins for ESP32 DevKit v1 (30-pin)
const createESP32Pins = (componentId: string): Pin[] => {
  const pins: Pin[] = [];

  // Left Column Pins (x: 14)
  const leftPins = ['EN', 'VP(36)', 'VN(39)', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND', 'VIN(5V)'];
  leftPins.forEach((name, idx) => {
    pins.push({
      id: `${componentId}_pin_l_${idx}`,
      name: name.split('(')[0],
      type: name.includes('GND') ? 'ground' : (name.includes('5V') ? 'power' : 'digital'),
      x: 14,
      y: 28 + idx * 13,
      parentComponentId: componentId,
    });
  });

  // Right Column Pins (x: 136)
  const rightPins = ['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5', 'D18', 'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23'];
  rightPins.forEach((name, idx) => {
    pins.push({
      id: `${componentId}_pin_r_${idx}`,
      name,
      type: name === 'GND' ? 'ground' : (name === '3V3' ? 'power' : 'digital'),
      x: 136,
      y: 28 + idx * 13,
      parentComponentId: componentId,
    });
  });

  return pins;
};

// Preset factory for all electronics components
export const createComponentPreset = (type: ComponentType, model?: MCUModel): Component => {
  const id = `${type}_${generateId()}`;

  switch (type) {
    case 'mcu':
      if (model === 'esp32') {
        return {
          id,
          type: 'mcu',
          model: 'esp32',
          name: 'ESP32 DevKit v1',
          x: 100,
          y: 80,
          width: 150,
          height: 230,
          pins: createESP32Pins(id),
          state: { isOn: false },
        };
      } else {
        return {
          id,
          type: 'mcu',
          model: 'uno',
          name: 'Arduino Uno R3',
          x: 80,
          y: 90,
          width: 250,
          height: 170,
          pins: createUnoPins(id),
          state: { isOn: false },
        };
      }

    case 'led':
      return {
        id,
        type: 'led',
        name: 'Red LED',
        x: 400,
        y: 80,
        width: 44,
        height: 64,
        color: 'red',
        value: 220,
        pins: [
          { id: `${id}_pin_anode`, name: 'Anode (+)', type: 'digital', x: 15, y: 56, parentComponentId: id },
          { id: `${id}_pin_cathode`, name: 'Cathode (-)', type: 'ground', x: 29, y: 56, parentComponentId: id },
        ],
        state: { isOn: false, brightness: 0 },
      };

    case 'rgb_led':
      return {
        id,
        type: 'rgb_led',
        name: 'RGB LED (Common Cathode)',
        x: 400,
        y: 160,
        width: 60,
        height: 68,
        pins: [
          { id: `${id}_pin_r`, name: 'Red', type: 'digital', x: 12, y: 60, parentComponentId: id },
          { id: `${id}_pin_cat`, name: 'GND', type: 'ground', x: 24, y: 60, parentComponentId: id },
          { id: `${id}_pin_g`, name: 'Green', type: 'digital', x: 36, y: 60, parentComponentId: id },
          { id: `${id}_pin_b`, name: 'Blue', type: 'digital', x: 48, y: 60, parentComponentId: id },
        ],
        state: { rValue: 0, gValue: 0, bValue: 0, isOn: false },
      };

    case 'resistor':
      return {
        id,
        type: 'resistor',
        name: '220Ω Resistor',
        x: 400,
        y: 250,
        width: 80,
        height: 28,
        value: 220,
        pins: [
          { id: `${id}_pin_1`, name: '1', type: 'passive', x: 6, y: 14, parentComponentId: id },
          { id: `${id}_pin_2`, name: '2', type: 'passive', x: 74, y: 14, parentComponentId: id },
        ],
      };

    case 'button':
      return {
        id,
        type: 'button',
        name: 'Tactile Push Button',
        x: 500,
        y: 80,
        width: 48,
        height: 48,
        pins: [
          { id: `${id}_pin_1`, name: 'Pin 1', type: 'digital', x: 10, y: 44, parentComponentId: id },
          { id: `${id}_pin_2`, name: 'Pin 2', type: 'digital', x: 38, y: 44, parentComponentId: id },
        ],
        state: { isPressed: false },
      };

    case 'potentiometer':
      return {
        id,
        type: 'potentiometer',
        name: '10kΩ Potentiometer',
        x: 500,
        y: 160,
        width: 58,
        height: 76,
        value: 50, // 50%
        pins: [
          { id: `${id}_pin_vcc`, name: 'VCC', type: 'power', x: 12, y: 68, parentComponentId: id },
          { id: `${id}_pin_sig`, name: 'SIG', type: 'analog', x: 29, y: 68, parentComponentId: id },
          { id: `${id}_pin_gnd`, name: 'GND', type: 'ground', x: 46, y: 68, parentComponentId: id },
        ],
        state: { voltage: 2.5 },
      };

    case 'dht11':
      return {
        id,
        type: 'dht11',
        name: 'DHT11 Temp & Humidity Sensor',
        x: 500,
        y: 260,
        width: 58,
        height: 76,
        pins: [
          { id: `${id}_pin_vcc`, name: 'VCC', type: 'power', x: 13, y: 68, parentComponentId: id },
          { id: `${id}_pin_data`, name: 'DATA', type: 'digital', x: 29, y: 68, parentComponentId: id },
          { id: `${id}_pin_gnd`, name: 'GND', type: 'ground', x: 45, y: 68, parentComponentId: id },
        ],
        state: { temperature: 25, humidity: 50 },
      };

    case 'ultrasonic':
      return {
        id,
        type: 'ultrasonic',
        name: 'HC-SR04 Ultrasonic Sensor',
        x: 600,
        y: 80,
        width: 90,
        height: 52,
        value: 20, // 20 cm
        pins: [
          { id: `${id}_pin_vcc`, name: 'VCC', type: 'power', x: 18, y: 46, parentComponentId: id },
          { id: `${id}_pin_trig`, name: 'TRIG', type: 'digital', x: 36, y: 46, parentComponentId: id },
          { id: `${id}_pin_echo`, name: 'ECHO', type: 'digital', x: 54, y: 46, parentComponentId: id },
          { id: `${id}_pin_gnd`, name: 'GND', type: 'ground', x: 72, y: 46, parentComponentId: id },
        ],
        state: { distance: 20 },
      };

    case 'ldr':
      return {
        id,
        type: 'ldr',
        name: 'Photoresistor (LDR)',
        x: 600,
        y: 160,
        width: 48,
        height: 60,
        value: 500, // Lux
        pins: [
          { id: `${id}_pin_vcc`, name: 'VCC', type: 'power', x: 12, y: 52, parentComponentId: id },
          { id: `${id}_pin_sig`, name: 'SIG', type: 'analog', x: 24, y: 52, parentComponentId: id },
          { id: `${id}_pin_gnd`, name: 'GND', type: 'ground', x: 36, y: 52, parentComponentId: id },
        ],
        state: { lux: 500 },
      };

    case 'relay':
      return {
        id,
        type: 'relay',
        name: '5V Relay Module',
        x: 600,
        y: 250,
        width: 72,
        height: 60,
        pins: [
          { id: `${id}_pin_vcc`, name: 'VCC', type: 'power', x: 14, y: 52, parentComponentId: id },
          { id: `${id}_pin_in`, name: 'IN', type: 'digital', x: 36, y: 52, parentComponentId: id },
          { id: `${id}_pin_gnd`, name: 'GND', type: 'ground', x: 58, y: 52, parentComponentId: id },
        ],
        state: { isRelayClosed: false },
      };

    case 'servo':
      return {
        id,
        type: 'servo',
        name: 'SG90 Micro Servo',
        x: 720,
        y: 80,
        width: 68,
        height: 68,
        pins: [
          { id: `${id}_pin_gnd`, name: 'GND', type: 'ground', x: 16, y: 60, parentComponentId: id },
          { id: `${id}_pin_vcc`, name: 'VCC', type: 'power', x: 34, y: 60, parentComponentId: id },
          { id: `${id}_pin_sig`, name: 'SIG', type: 'digital', x: 52, y: 60, parentComponentId: id },
        ],
        state: { angle: 90 },
      };

    case 'buzzer':
      return {
        id,
        type: 'buzzer',
        name: 'Piezo Buzzer',
        x: 720,
        y: 170,
        width: 50,
        height: 50,
        pins: [
          { id: `${id}_pin_pos`, name: '(+)', type: 'digital', x: 14, y: 44, parentComponentId: id },
          { id: `${id}_pin_neg`, name: '(-)', type: 'ground', x: 36, y: 44, parentComponentId: id },
        ],
        state: { frequency: 0 },
      };

    case 'lcd':
      return {
        id,
        type: 'lcd',
        name: 'LCD 1602 (I2C Display)',
        x: 700,
        y: 250,
        width: 160,
        height: 70,
        pins: [
          { id: `${id}_pin_gnd`, name: 'GND', type: 'ground', x: 16, y: 62, parentComponentId: id },
          { id: `${id}_pin_vcc`, name: 'VCC', type: 'power', x: 34, y: 62, parentComponentId: id },
          { id: `${id}_pin_sda`, name: 'SDA', type: 'digital', x: 52, y: 62, parentComponentId: id },
          { id: `${id}_pin_scl`, name: 'SCL', type: 'digital', x: 70, y: 62, parentComponentId: id },
        ],
        state: { text: 'Embedded Studio\nReady to Simulate' },
      };

    case 'breadboard':
      return {
        id,
        type: 'breadboard',
        name: 'Half Breadboard',
        x: 120,
        y: 330,
        width: 540,
        height: 150,
        pins: [],
      };

    default:
      throw new Error(`Unknown component type: ${type}`);
  }
};
