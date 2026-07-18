import type { Component, ComponentType, MCUModel, Pin } from '../types/circuit';

// Generate a random ID
export const generateId = () => Math.random().toString(36).substring(2, 9);

// Create pins for Arduino Uno
const createUnoPins = (componentId: string): Pin[] => {
  const pins: Pin[] = [];

  // Digital Pins: D0 to D13, plus GND, AREF, SDA, SCL (Top Edge)
  // Let's place them horizontally at y: 15
  const digitalNames = ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'TX>1', 'RX<0'];
  digitalNames.forEach((name, index) => {
    pins.push({
      id: `${componentId}_pin_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name,
      type: name === 'GND' ? 'ground' : 'digital',
      x: 35 + index * 12,
      y: 15,
      parentComponentId: componentId,
    });
  });

  // Power & Analog Pins (Bottom Edge)
  // Let's place them horizontally at y: 145
  const powerNames = ['RESET', '3.3V', '5V', 'GND', 'GND', 'Vin'];
  powerNames.forEach((name, index) => {
    pins.push({
      id: `${componentId}_pin_power_${index}`, // use index to avoid duplicate id for the two GND pins
      name,
      type: name.includes('GND') ? 'ground' : 'power',
      x: 35 + index * 12,
      y: 145,
      parentComponentId: componentId,
    });
  });

  const analogNames = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
  analogNames.forEach((name, index) => {
    pins.push({
      id: `${componentId}_pin_${name.toLowerCase()}`,
      name,
      type: 'analog',
      x: 125 + index * 12,
      y: 145,
      parentComponentId: componentId,
    });
  });

  return pins;
};

// Create pins for ESP32 DevKit v1
const createESP32Pins = (componentId: string): Pin[] => {
  const pins: Pin[] = [];
  
  // Left Column Pins (x: 15)
  const leftPins = ['EN', 'VP(36)', 'VN(39)', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND', '5V'];
  leftPins.forEach((name, index) => {
    pins.push({
      id: `${componentId}_pin_l_${index}`,
      name,
      type: name === 'GND' ? 'ground' : (name === '5V' ? 'power' : 'digital'),
      x: 15,
      y: 35 + index * 11,
      parentComponentId: componentId,
    });
  });

  // Right Column Pins (x: 125)
  const rightPins = ['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2(16)', 'TX2(17)', 'D5', 'D18', 'D19', 'D21', 'RX0(3)', 'TX0(1)', 'D22', 'D23'];
  rightPins.forEach((name, index) => {
    pins.push({
      id: `${componentId}_pin_r_${index}`,
      name,
      type: name === 'GND' ? 'ground' : (name === '3V3' ? 'power' : 'digital'),
      x: 125,
      y: 35 + index * 11,
      parentComponentId: componentId,
    });
  });

  return pins;
};

// Preset factory for any component type
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
          width: 140,
          height: 210,
          pins: createESP32Pins(id),
        };
      } else {
        return {
          id,
          type: 'mcu',
          model: 'uno',
          name: 'Arduino Uno R3',
          x: 80,
          y: 100,
          width: 260,
          height: 160,
          pins: createUnoPins(id),
        };
      }
      
    case 'led':
      return {
        id,
        type: 'led',
        name: 'Red LED',
        x: 400,
        y: 80,
        width: 40,
        height: 60,
        pins: [
          { id: `${id}_pin_anode`, name: 'A', type: 'digital', x: 13, y: 52, parentComponentId: id },
          { id: `${id}_pin_cathode`, name: 'K', type: 'ground', x: 27, y: 52, parentComponentId: id }
        ],
        value: 220, // default series resistance reference
        state: { isOn: false, brightness: 0 }
      };

    case 'resistor':
      return {
        id,
        type: 'resistor',
        name: '220Ω Resistor',
        x: 400,
        y: 180,
        width: 70,
        height: 24,
        pins: [
          { id: `${id}_pin_1`, name: '1', type: 'passive', x: 5, y: 12, parentComponentId: id } as any,
          { id: `${id}_pin_2`, name: '2', type: 'passive', x: 65, y: 12, parentComponentId: id } as any
        ],
        value: 220,
      };

    case 'button':
      return {
        id,
        type: 'button',
        name: 'Push Button',
        x: 400,
        y: 260,
        width: 44,
        height: 44,
        pins: [
          { id: `${id}_pin_1`, name: '1', type: 'digital', x: 8, y: 22, parentComponentId: id },
          { id: `${id}_pin_2`, name: '2', type: 'digital', x: 36, y: 22, parentComponentId: id }
        ],
        state: { isPressed: false }
      };

    case 'potentiometer':
      return {
        id,
        type: 'potentiometer',
        name: '10kΩ Pot',
        x: 500,
        y: 80,
        width: 50,
        height: 70,
        pins: [
          { id: `${id}_pin_vcc`, name: 'VCC', type: 'power', x: 12, y: 62, parentComponentId: id },
          { id: `${id}_pin_sig`, name: 'SIG', type: 'analog', x: 25, y: 62, parentComponentId: id },
          { id: `${id}_pin_gnd`, name: 'GND', type: 'ground', x: 38, y: 62, parentComponentId: id }
        ],
        value: 50, // default wiper percent (0 - 100)
        state: { voltage: 1.65 }
      };

    case 'dht11':
      return {
        id,
        type: 'dht11',
        name: 'DHT11 Sensor',
        x: 500,
        y: 180,
        width: 54,
        height: 70,
        pins: [
          { id: `${id}_pin_vcc`, name: 'VCC', type: 'power', x: 13, y: 62, parentComponentId: id },
          { id: `${id}_pin_data`, name: 'DATA', type: 'digital', x: 27, y: 62, parentComponentId: id },
          { id: `${id}_pin_gnd`, name: 'GND', type: 'ground', x: 41, y: 62, parentComponentId: id }
        ],
        state: { temperature: 24, humidity: 45 }
      };

    case 'breadboard':
      return {
        id,
        type: 'breadboard',
        name: 'Half Breadboard',
        x: 150,
        y: 320,
        width: 480,
        height: 140,
        pins: [] // visual only layout helper
      };

    default:
      throw new Error(`Unknown component type: ${type}`);
  }
};
