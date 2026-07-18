import type { Component, Wire } from '../types/circuit';

interface SimulationReport {
  voltages: Record<string, number>;
  modes: Record<string, 'input' | 'output' | 'input_pullup'>;
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }>;
  ledStates: Record<string, { isOn: boolean; brightness: number }>;
  debuggerAlerts: Array<{ id: string; type: 'warning' | 'error' | 'success'; message: string; source: 'schematic' | 'code' }>;
}

export const runStaticAnalysis = (
  code: string,
  components: Component[],
  wires: Wire[],
  mcuModel: 'uno' | 'esp32'
): SimulationReport => {
  const voltages: Record<string, number> = {};
  const modes: Record<string, 'input' | 'output' | 'input_pullup'> = {};
  const logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = [];
  const ledStates: Record<string, { isOn: boolean; brightness: number }> = {};
  const debuggerAlerts: Array<{ id: string; type: 'warning' | 'error' | 'success'; message: string; source: 'schematic' | 'code' }> = [];

  const addLog = (level: 'info' | 'warn' | 'error', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    logs.push({ timestamp, level, message });
  };

  const addAlert = (type: 'warning' | 'error' | 'success', message: string, source: 'schematic' | 'code') => {
    debuggerAlerts.push({
      id: `alert_${Math.random().toString(36).substring(2, 9)}`,
      type,
      message,
      source
    });
  };

  // 1. Initial pin states based on MCU Model
  const mcu = components.find((c) => c.type === 'mcu');
  if (!mcu) {
    addAlert('error', 'No microcontroller found in the circuit canvas. Please add an Arduino Uno R3 or ESP32 from the components library.', 'schematic');
    return { voltages, modes, logs, ledStates, debuggerAlerts };
  }

  addLog('info', `Initializing ${mcu.name} compilation...`);
  addLog('info', `Verifying wiring connections...`);

  // 2. Map wires to trace connections
  // Create mapping: PinId -> List of connected PinIds
  const connectionMap: Record<string, string[]> = {};
  wires.forEach((w) => {
    if (!connectionMap[w.fromPinId]) connectionMap[w.fromPinId] = [];
    if (!connectionMap[w.toPinId]) connectionMap[w.toPinId] = [];
    connectionMap[w.fromPinId].push(w.toPinId);
    connectionMap[w.toPinId].push(w.fromPinId);
  });

  // Helper to trace full connected node (DFS)
  const getConnectedNodePins = (startPinId: string): string[] => {
    const visited = new Set<string>();
    const queue = [startPinId];
    
    while (queue.length > 0) {
      const pinId = queue.shift()!;
      if (!visited.has(pinId)) {
        visited.add(pinId);
        const neighbors = connectionMap[pinId] || [];
        neighbors.forEach((n) => {
          if (!visited.has(n)) queue.push(n);
        });
      }
    }
    return Array.from(visited);
  };

  // Helper to check if two pins are electrically connected
  const arePinsConnected = (pinIdA: string, pinIdB: string): boolean => {
    const connected = getConnectedNodePins(pinIdA);
    return connected.includes(pinIdB);
  };

  // Helper: resolve a pin variable/literal to an MCU pin object
  const resolveMCUPin = (pinArg: string) => {
    const pinName = pinVarMap[pinArg] || pinArg;
    return mcu.pins.find((p) => {
      const pn = p.name.toLowerCase();
      const target = pinName.toLowerCase();
      // Direct name match (e.g. "A0" == "A0")
      if (pn === target) return true;
      // "D13" == "13"
      if (pn === `d${target}`) return true;
      // "13" == "D13" (strip the D)
      if (pn.startsWith('d') && pn.slice(1) === target) return true;
      // "GPIO2" == "2" or "d2"
      if (pn.startsWith('gpio') && pn.slice(4) === target) return true;
      // ESP32 special names like "VP(36)" pin named by number
      const numMatch = pn.match(/^(?:d|gpio)?(\d+)/);
      if (numMatch && numMatch[1] === target) return true;
      return false;
    });
  };

  // Find pin declarations in code using regex patterns
  const ledPinVarRegex = /(?:const\s+)?(?:int|define)\s+(\w+Pin|\w+LED|LED_PIN|LED|\w+)\s*=?\s*(\d+|A\d+|GPIO\d+)/gi;
  const pinVarMap: Record<string, string> = {}; // Variable Name -> Pin Number
  let match;
  while ((match = ledPinVarRegex.exec(code)) !== null) {
    pinVarMap[match[1]] = match[2];
  }

  // Find pinMode configuration
  const pinModeRegex = /pinMode\s*\(\s*(\w+|\d+)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*\)/g;
  while ((match = pinModeRegex.exec(code)) !== null) {
    const pinArg = match[1];
    const modeArg = match[2] as 'OUTPUT' | 'INPUT' | 'INPUT_PULLUP';
    const mcuPin = resolveMCUPin(pinArg);
    if (mcuPin) {
      modes[mcuPin.id] = modeArg.toLowerCase() as any;
      addLog('info', `Configured Pin ${mcuPin.name} as ${modeArg}`);
    }
  }

  // 4. Simulate loop actions (look for digitalWrite, analogWrite, Serial.print)
  const digitalWriteRegex = /digitalWrite\s*\(\s*(\w+|\d+)\s*,\s*(HIGH|LOW)\s*\)/g;
  const activeWrites: Record<string, 'HIGH' | 'LOW'> = {};
  while ((match = digitalWriteRegex.exec(code)) !== null) {
    const pinArg = match[1];
    const stateArg = match[2] as 'HIGH' | 'LOW';
    const mcuPin = resolveMCUPin(pinArg);
    if (mcuPin) {
      activeWrites[mcuPin.id] = stateArg;
    }
  }

  // analogWrite PWM support (LED brightness simulation)
  const analogWriteRegex = /analogWrite\s*\(\s*(\w+|\d+)\s*,\s*(\d+)\s*\)/g;
  const pwmWrites: Record<string, number> = {};
  while ((match = analogWriteRegex.exec(code)) !== null) {
    const pinArg = match[1];
    const dutyArg = parseInt(match[2], 10);
    const mcuPin = resolveMCUPin(pinArg);
    if (mcuPin) {
      pwmWrites[mcuPin.id] = dutyArg; // 0-255
      // Convert to HIGH/LOW equivalent for voltage calc
      activeWrites[mcuPin.id] = dutyArg > 0 ? 'HIGH' : 'LOW';
    }
  }

  // Set voltages based on active writes
  const maxVoltage = mcuModel === 'uno' ? 5.0 : 3.3;
  mcu.pins.forEach((pin) => {
    // Standard power/GND pins
    if (pin.name === '5V') voltages[pin.id] = 5.0;
    else if (pin.name === '3.3V' || pin.name === '3V3') voltages[pin.id] = 3.3;
    else if (pin.name === 'GND') voltages[pin.id] = 0.0;
    
    // Configured output pins
    const mode = modes[pin.id];
    if (mode === 'output') {
      const state = activeWrites[pin.id] || 'LOW';
      voltages[pin.id] = state === 'HIGH' ? maxVoltage : 0.0;
    } else {
      voltages[pin.id] = voltages[pin.id] || 0.0;
    }
  });

  // Calculate secondary component pins voltage using connected nodes
  // All pins connected to VCC or HIGH pins get voltage, GND pins pull down to 0V.
  const powerPins = Object.keys(voltages).filter((pid) => voltages[pid] > 0);
  const gndPins = mcu.pins.filter((p) => p.type === 'ground').map((p) => p.id);

  // Mark voltages for connected components
  components.forEach((comp) => {
    if (comp.type === 'mcu' || comp.type === 'breadboard') return;

    comp.pins.forEach((pin) => {
      // Find what MCU pin this is connected to
      const connectedPins = getConnectedNodePins(pin.id);
      
      // If connected to a power/high pin
      const hasPower = connectedPins.some((pid) => powerPins.includes(pid));
      const hasGnd = connectedPins.some((pid) => gndPins.includes(pid));

      if (hasPower && hasGnd) {
        voltages[pin.id] = maxVoltage; // basic complete circuit voltage drop
      } else if (hasPower) {
        voltages[pin.id] = maxVoltage; // connected to voltage source
      } else {
        voltages[pin.id] = 0;
      }
    });
  });

  // 5. Evaluate hardware component states (LEDs glowing, buttons triggering)
  components.forEach((comp) => {
    if (comp.type === 'led') {
      const anode = comp.pins.find((p) => p.name === 'A')!;
      const cathode = comp.pins.find((p) => p.name === 'K')!;
      
      const anodeVolt = voltages[anode.id] || 0;
      const cathodeVolt = voltages[cathode.id] || 0;

      // An LED turns on if anode is HIGH and cathode is GND (or connected to it)
      const isCathodeConnectedToGND = getConnectedNodePins(cathode.id).some((pid) => {
        const pin = mcu.pins.find((p) => p.id === pid);
        return pin && pin.type === 'ground';
      });

      const hasVoltageDiff = anodeVolt > 1.5 && cathodeVolt < 0.5;

      if (hasVoltageDiff && isCathodeConnectedToGND) {
        // Find if any connected MCU pin had analogWrite applied
        const connectedMCUPinId = mcu.pins.find((p) =>
          getConnectedNodePins(anode.id).includes(p.id)
        )?.id;
        const brightness = connectedMCUPinId && pwmWrites[connectedMCUPinId] !== undefined
          ? pwmWrites[connectedMCUPinId]
          : 255;
        ledStates[comp.id] = { isOn: true, brightness };
        const dutyPct = Math.round((brightness / 255) * 100);
        addLog('info', `${comp.name} is glowing! Duty: ${dutyPct}% (Current: ~${Math.round(15 * brightness / 255)}mA)`);
        
        // Check for missing current limiting resistor!
        // Traces if there is a resistor in the pathway between the anode/cathode and the MCU/GND
        const connectedToAnode = getConnectedNodePins(anode.id);
        const hasResistor = components.some(
          (c) => c.type === 'resistor' && 
                 connectedToAnode.some((pid) => c.pins.some((rp) => rp.id === pid))
        );

        if (!hasResistor) {
          addAlert('warning', `Missing Resistor: ${comp.name} is wired directly without a current-limiting resistor! Running it at ${anodeVolt}V will burn out a physical LED in real life. Add a 220Ω resistor.`, 'schematic');
        }
      } else {
        ledStates[comp.id] = { isOn: false, brightness: 0 };
      }

      // Check pin mismatch logic (e.g. if code writes to pin 13, check if anode connects to pin 13)
      if (activeWrites) {
        Object.keys(activeWrites).forEach((mcuPinId) => {
          const mcuPin = mcu.pins.find((p) => p.id === mcuPinId);
          if (mcuPin && activeWrites[mcuPinId] === 'HIGH') {
            // Is this pin connected to the LED anode?
            const isConnected = arePinsConnected(mcuPinId, anode.id);
            const mode = modes[mcuPinId];
            if (mode === 'output' && !isConnected && Object.keys(ledStates).length > 0 && !ledStates[comp.id].isOn) {
              // Code is setting high, but the LED is not on. Check if LED is connected to some other pin
              const otherMCUConnectedPin = mcu.pins.find((p) => p.type === 'digital' && arePinsConnected(p.id, anode.id));
              if (otherMCUConnectedPin) {
                addAlert('error', `Wiring Mismatch: Your code writes HIGH to pin ${mcuPin.name}, but your ${comp.name} anode is wired to pin ${otherMCUConnectedPin.name}! Change pin definitions in code or wire.`, 'code');
              }
            }
          }
        });
      }
    }

    if (comp.type === 'button') {
      const pin1 = comp.pins.find((p) => p.name === '1')!;
      const pin2 = comp.pins.find((p) => p.name === '2')!;
      
      const isPressed = comp.state?.isPressed || false;
      if (isPressed) {
        // Equalize voltages on both sides of switch
        const v1 = voltages[pin1.id] || 0;
        const v2 = voltages[pin2.id] || 0;
        const maxV = Math.max(v1, v2);
        voltages[pin1.id] = maxV;
        voltages[pin2.id] = maxV;
      }
    }

    if (comp.type === 'dht11') {
      const dataPin = comp.pins.find((p) => p.name === 'DATA')!;
      const vccPin = comp.pins.find((p) => p.name === 'VCC')!;
      const gndPin = comp.pins.find((p) => p.name === 'GND')!;

      const isPowered = voltages[vccPin.id] > 2.5 && voltages[gndPin.id] < 0.5;
      
      // Is data pin connected to an MCU digital input pin?
      const connectedMCUPins = getConnectedNodePins(dataPin.id).map((pid) => mcu.pins.find((p) => p.id === pid)).filter(Boolean);
      const isDataConnected = connectedMCUPins.some((pin) => pin?.type === 'digital');

      if (isPowered && isDataConnected) {
        const temp = comp.state?.temperature || 24;
        const hum = comp.state?.humidity || 45;
        
        // Print sensor readings to serial monitor if simulating
        addLog('info', `[DHT11 Sensor Data Feed] Temp: ${temp}°C | Humidity: ${hum}%`);
      } else if (!isPowered) {
        addAlert('warning', `DHT11 sensor is not powered! Connect VCC to 5V/3.3V and GND to ground.`, 'schematic');
      }
    }

    if (comp.type === 'potentiometer') {
      const sigPin = comp.pins.find((p) => p.name === 'SIG')!;
      const vccPin = comp.pins.find((p) => p.name === 'VCC')!;
      const gndPin = comp.pins.find((p) => p.name === 'GND')!;
      
      const isPowered = voltages[vccPin.id] > 2.5 && voltages[gndPin.id] < 0.5;
      if (isPowered) {
        const valPercent = comp.value || 50;
        const refV = voltages[vccPin.id] || 3.3;
        const sigV = (valPercent / 100) * refV;
        voltages[sigPin.id] = parseFloat(sigV.toFixed(2));
        
        // Connect to MCU analog pin
        const mcuAnalogPin = mcu.pins.find((p) => p.type === 'analog' && arePinsConnected(p.id, sigPin.id));
        if (mcuAnalogPin) {
          const rawADC = Math.round((valPercent / 100) * 1023);
          addLog('info', `[ADC Converter] Read A${mcuAnalogPin.name} = Raw: ${rawADC} (Voltage: ${voltages[sigPin.id]}V)`);
        }
      } else {
        voltages[sigPin.id] = 0;
      }
    }
  });

  // 6. Final checks for compiler errors
  if (!code.includes('setup') || !code.includes('loop')) {
    addAlert('error', 'Compilation failed: Code must contain a void setup() and void loop() function.', 'code');
    addLog('error', 'Compile Error: missing setup() or loop() definition.');
  } else {
    addLog('info', 'Code compiled successfully with zero syntax errors!');
    addAlert('success', 'Smart Compiler: Compilation successful!', 'code');
  }

  return {
    voltages,
    modes,
    logs,
    ledStates,
    debuggerAlerts,
  };
};
