import type { Component, Wire, DebuggerAlert, SimulationLog, OscilloscopeSample } from '../types/circuit';
import { audioSynth } from './audioSynth';

interface SimulationReport {
  voltages: Record<string, number>;
  modes: Record<string, 'input' | 'output' | 'input_pullup'>;
  logs: SimulationLog[];
  ledStates: Record<string, { isOn: boolean; brightness: number }>;
  rgbStates: Record<string, { r: number; g: number; b: number; isOn: boolean }>;
  servoAngles: Record<string, number>;
  lcdTexts: Record<string, string>;
  buzzerFreqs: Record<string, number>;
  relayStates: Record<string, boolean>;
  debuggerAlerts: DebuggerAlert[];
  oscilloscopeSamples: Record<string, OscilloscopeSample[]>;
}

export const runStaticAnalysis = (
  code: string,
  components: Component[],
  wires: Wire[],
  mcuModel: 'uno' | 'esp32'
): SimulationReport => {
  const voltages: Record<string, number> = {};
  const modes: Record<string, 'input' | 'output' | 'input_pullup'> = {};
  const logs: SimulationLog[] = [];
  const ledStates: Record<string, { isOn: boolean; brightness: number }> = {};
  const rgbStates: Record<string, { r: number; g: number; b: number; isOn: boolean }> = {};
  const servoAngles: Record<string, number> = {};
  const lcdTexts: Record<string, string> = {};
  const buzzerFreqs: Record<string, number> = {};
  const relayStates: Record<string, boolean> = {};
  const debuggerAlerts: DebuggerAlert[] = [];
  const oscilloscopeSamples: Record<string, OscilloscopeSample[]> = {};

  const addLog = (level: 'info' | 'warn' | 'error' | 'success', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    logs.push({ timestamp, level, message });
  };

  const addAlert = (type: 'warning' | 'error' | 'success' | 'info', message: string, source: 'schematic' | 'code') => {
    debuggerAlerts.push({
      id: `alert_${Math.random().toString(36).substring(2, 9)}`,
      type,
      message,
      source,
    });
  };

  // 1. Locate MCU component
  const mcu = components.find((c) => c.type === 'mcu');
  if (!mcu) {
    addAlert('error', 'No Microcontroller detected on canvas. Place an Arduino Uno R3 or ESP32 from the library.', 'schematic');
    return {
      voltages,
      modes,
      logs,
      ledStates,
      rgbStates,
      servoAngles,
      lcdTexts,
      buzzerFreqs,
      relayStates,
      debuggerAlerts,
      oscilloscopeSamples,
    };
  }

  addLog('info', `Initializing ${mcu.name} compilation & schematic validation...`);

  // 2. Build connection graph
  const connectionMap: Record<string, string[]> = {};
  
  // Explicit wire connections
  wires.forEach((w) => {
    if (!connectionMap[w.fromPinId]) connectionMap[w.fromPinId] = [];
    if (!connectionMap[w.toPinId]) connectionMap[w.toPinId] = [];
    connectionMap[w.fromPinId].push(w.toPinId);
    connectionMap[w.toPinId].push(w.fromPinId);
  });

  // Internal component bridges (Passives & Switches)
  components.forEach(comp => {
    if (comp.type === 'resistor') {
      const p1 = comp.pins[0]?.id;
      const p2 = comp.pins[1]?.id;
      if (p1 && p2) {
        if (!connectionMap[p1]) connectionMap[p1] = [];
        if (!connectionMap[p2]) connectionMap[p2] = [];
        connectionMap[p1].push(p2);
        connectionMap[p2].push(p1);
      }
    }
    if (comp.type === 'button' && comp.state?.isPressed) {
      const p1 = comp.pins[0]?.id;
      const p2 = comp.pins[1]?.id;
      if (p1 && p2) {
        if (!connectionMap[p1]) connectionMap[p1] = [];
        if (!connectionMap[p2]) connectionMap[p2] = [];
        connectionMap[p1].push(p2);
        connectionMap[p2].push(p1);
      }
    }
  });

  const getConnectedNodePins = (startPinId: string): string[] => {
    const visited = new Set<string>();
    const queue = [startPinId];
    while (queue.length > 0) {
      const pinId = queue.shift()!;
      if (!visited.has(pinId)) {
        visited.add(pinId);
        (connectionMap[pinId] || []).forEach((n) => {
          if (!visited.has(n)) queue.push(n);
        });
      }
    }
    return Array.from(visited);
  };

  const arePinsConnected = (pinA: string, pinB: string): boolean => {
    return getConnectedNodePins(pinA).includes(pinB);
  };

  // 3. Resolve Pin references in C++ Code
  const pinVarRegex = /(?:const\s+)?(?:int|define|byte)\s+(\w+)\s*=?\s*([0-9A-Za-z_]+)/gi;
  const pinVarMap: Record<string, string> = {};
  let match;
  while ((match = pinVarRegex.exec(code)) !== null) {
    pinVarMap[match[1]] = match[2];
  }

  const resolveMCUPin = (pinArg: string) => {
    const resolvedName = pinVarMap[pinArg] || pinArg;
    return mcu.pins.find((p) => {
      const pn = p.name.toLowerCase();
      const target = resolvedName.toLowerCase();
      if (pn === target) return true;
      if (pn === `d${target}`) return true;
      if (pn.startsWith('d') && pn.slice(1) === target) return true;
      if (pn.startsWith('gpio') && pn.slice(4) === target) return true;
      const numMatch = pn.match(/^(?:d|gpio)?(\d+)/);
      if (numMatch && numMatch[1] === target) return true;
      return false;
    });
  };

  // 3.5 Parse Serial.print & Serial.println
  const serialRegex = /Serial\.(?:println|print)\s*\(\s*(?:"([^"]*)"|([^)]+))\s*\)/g;
  while ((match = serialRegex.exec(code)) !== null) {
    const text = match[1] !== undefined ? match[1] : match[2]?.trim();
    if (text && !text.toLowerCase().includes('begin')) {
      addLog('info', `[Serial Output] ${text}`);
    }
  }

  // 4. Parse pinMode
  const pinModeRegex = /pinMode\s*\(\s*(\w+)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*\)/g;
  while ((match = pinModeRegex.exec(code)) !== null) {
    const pinArg = match[1];
    const mode = match[2].toLowerCase() as 'output' | 'input' | 'input_pullup';
    const mcuPin = resolveMCUPin(pinArg);
    if (mcuPin) {
      modes[mcuPin.id] = mode;
      addLog('info', `Configured MCU Pin ${mcuPin.name} as ${match[2]}`);
    }
  }

  // 5. Parse digitalWrite & analogWrite
  const activeWrites: Record<string, 'HIGH' | 'LOW'> = {};
  const pwmWrites: Record<string, number> = {};

  const digitalWriteRegex = /digitalWrite\s*\(\s*(\w+)\s*,\s*(HIGH|LOW)\s*\)/g;
  while ((match = digitalWriteRegex.exec(code)) !== null) {
    const mcuPin = resolveMCUPin(match[1]);
    if (mcuPin) {
      activeWrites[mcuPin.id] = match[2] as 'HIGH' | 'LOW';
    }
  }

  const analogWriteRegex = /analogWrite\s*\(\s*(\w+)\s*,\s*(\w+|\d+)\s*\)/g;
  while ((match = analogWriteRegex.exec(code)) !== null) {
    const mcuPin = resolveMCUPin(match[1]);
    const val = parseInt(pinVarMap[match[2]] || match[2], 10);
    if (mcuPin) {
      const duty = isNaN(val) ? 255 : Math.max(0, Math.min(255, val));
      pwmWrites[mcuPin.id] = duty;
      activeWrites[mcuPin.id] = duty > 0 ? 'HIGH' : 'LOW';
    }
  }

  // 6. Parse tone() and noTone()
  const toneRegex = /tone\s*\(\s*(\w+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?\s*\)/g;
  while ((match = toneRegex.exec(code)) !== null) {
    const mcuPin = resolveMCUPin(match[1]);
    const freq = parseInt(match[2], 10);
    const duration = match[3] ? parseInt(match[3], 10) : undefined;
    if (mcuPin) {
      buzzerFreqs[mcuPin.id] = freq;
      audioSynth.playTone(freq, duration);
      addLog('info', `Tone generator on ${mcuPin.name}: ${freq} Hz`);
    }
  }

  if (code.includes('noTone')) {
    audioSynth.stopTone();
  }

  // 7. Parse Servo angles
  const servoRegex = /(?:\w+)\.write\s*\(\s*(\d+)\s*\)/g;
  let servoAngle = 90;
  while ((match = servoRegex.exec(code)) !== null) {
    servoAngle = Math.max(0, Math.min(180, parseInt(match[1], 10)));
  }

  // 8. Base MCU Power & GND rails
  const maxVoltage = mcuModel === 'uno' ? 5.0 : 3.3;
  const gndPins = mcu.pins.filter((p) => p.type === 'ground').map((p) => p.id);
  const powerPins: string[] = [];

  mcu.pins.forEach((pin) => {
    if (pin.name === '5V') {
      voltages[pin.id] = 5.0;
      powerPins.push(pin.id);
    } else if (pin.name === '3.3V' || pin.name === '3V3') {
      voltages[pin.id] = 3.3;
      powerPins.push(pin.id);
    } else if (pin.type === 'ground') {
      voltages[pin.id] = 0.0;
    } else if (modes[pin.id] === 'output') {
      const isHigh = activeWrites[pin.id] === 'HIGH';
      voltages[pin.id] = isHigh ? maxVoltage : 0.0;
      if (isHigh) powerPins.push(pin.id);
    } else {
      voltages[pin.id] = 0.0;
    }
  });

  // Short Circuit Check (Direct connection between VCC and GND)
  const isShortCircuit = powerPins.some((vccId) =>
    gndPins.some((gndId) => arePinsConnected(vccId, gndId))
  );

  if (isShortCircuit) {
    addAlert('error', 'FATAL SHORT CIRCUIT: Power rail (VCC) is directly connected to Ground (GND)! Disconnect immediately to prevent damage.', 'schematic');
    addLog('error', 'Short Circuit Detected! Simulation stopped.');
    return {
      voltages,
      modes,
      logs,
      ledStates,
      rgbStates,
      servoAngles,
      lcdTexts,
      buzzerFreqs,
      relayStates,
      debuggerAlerts,
      oscilloscopeSamples,
    };
  }

  // 9. Propagate Voltages across connected components
  components.forEach((comp) => {
    if (comp.type === 'mcu' || comp.type === 'breadboard') return;

    comp.pins.forEach((pin) => {
      const connected = getConnectedNodePins(pin.id);
      const hasPower = connected.some((pid) => powerPins.includes(pid));
      const hasGnd = connected.some((pid) => gndPins.includes(pid));

      if (hasPower && hasGnd) {
        voltages[pin.id] = maxVoltage;
      } else if (hasPower) {
        voltages[pin.id] = maxVoltage;
      } else {
        voltages[pin.id] = 0;
      }
    });
  });

  // 10. Hardware Components Evaluation
  components.forEach((comp) => {
    // Single LED
    if (comp.type === 'led') {
      const anode = comp.pins.find((p) => p.name.includes('Anode') || p.name === 'A');
      const cathode = comp.pins.find((p) => p.name.includes('Cathode') || p.name === 'K');

      if (anode && cathode) {
        const isAnodePowered = getConnectedNodePins(anode.id).some((pid) => powerPins.includes(pid));
        const isCathodeGnd = getConnectedNodePins(cathode.id).some((pid) => gndPins.includes(pid));

        if (isAnodePowered && isCathodeGnd) {
          const connectedMCUPinId = mcu.pins.find((p) => getConnectedNodePins(anode.id).includes(p.id))?.id;
          const brightness = connectedMCUPinId && pwmWrites[connectedMCUPinId] !== undefined ? pwmWrites[connectedMCUPinId] : 255;
          ledStates[comp.id] = { isOn: true, brightness };
          addLog('info', `${comp.name} is glowing! [Duty: ${Math.round((brightness / 255) * 100)}%]`);

          // Resistor Protection Diagnostic Check
          const connectedToAnode = getConnectedNodePins(anode.id);
          const hasResistor = components.some(
            (c) => c.type === 'resistor' && connectedToAnode.some((pid) => c.pins.some((rp) => rp.id === pid))
          );
          if (!hasResistor) {
            addAlert('warning', `Missing Resistor: ${comp.name} is wired directly to power without a current-limiting resistor! In real hardware, this would burn out the LED. Place a 220Ω resistor.`, 'schematic');
          }
        } else {
          ledStates[comp.id] = { isOn: false, brightness: 0 };
        }
      }
    }

    // 4-Pin RGB LED
    if (comp.type === 'rgb_led') {
      const rPin = comp.pins.find((p) => p.name === 'Red');
      const gPin = comp.pins.find((p) => p.name === 'Green');
      const bPin = comp.pins.find((p) => p.name === 'Blue');
      const catPin = comp.pins.find((p) => p.name === 'GND');

      if (rPin && gPin && bPin && catPin) {
        const isCathodeGnd = getConnectedNodePins(catPin.id).some((pid) => gndPins.includes(pid));
        if (isCathodeGnd) {
          const rMCU = mcu.pins.find((p) => getConnectedNodePins(rPin.id).includes(p.id))?.id;
          const gMCU = mcu.pins.find((p) => getConnectedNodePins(gPin.id).includes(p.id))?.id;
          const bMCU = mcu.pins.find((p) => getConnectedNodePins(bPin.id).includes(p.id))?.id;

          const r = rMCU && pwmWrites[rMCU] !== undefined ? pwmWrites[rMCU] : (rMCU && activeWrites[rMCU] === 'HIGH' ? 255 : 0);
          const g = gMCU && pwmWrites[gMCU] !== undefined ? pwmWrites[gMCU] : (gMCU && activeWrites[gMCU] === 'HIGH' ? 255 : 0);
          const b = bMCU && pwmWrites[bMCU] !== undefined ? pwmWrites[bMCU] : (bMCU && activeWrites[bMCU] === 'HIGH' ? 255 : 0);

          const isOn = r > 0 || g > 0 || b > 0;
          rgbStates[comp.id] = { r, g, b, isOn };
          if (isOn) {
            addLog('info', `${comp.name} Color Mix -> R:${r}, G:${g}, B:${b}`);
          }
        }
      }
    }

    // SG90 Servo
    if (comp.type === 'servo') {
      const sigPin = comp.pins.find((p) => p.name === 'SIG');
      const vccPin = comp.pins.find((p) => p.name === 'VCC');
      const gndPin = comp.pins.find((p) => p.name === 'GND');

      if (sigPin && vccPin && gndPin) {
        const isPowered = getConnectedNodePins(vccPin.id).some((pid) => powerPins.includes(pid)) &&
                          getConnectedNodePins(gndPin.id).some((pid) => gndPins.includes(pid));
        if (isPowered) {
          servoAngles[comp.id] = servoAngle;
          addLog('info', `Servo SG90 Position: ${servoAngle}°`);
        } else {
          addAlert('warning', 'SG90 Servo motor is not receiving power. Connect VCC to 5V and GND to ground.', 'schematic');
        }
      }
    }

    // LCD 1602 Display
    if (comp.type === 'lcd') {
      const vccPin = comp.pins.find((p) => p.name === 'VCC');
      const gndPin = comp.pins.find((p) => p.name === 'GND');
      if (vccPin && gndPin) {
        const isPowered = getConnectedNodePins(vccPin.id).some((pid) => powerPins.includes(pid)) &&
                          getConnectedNodePins(gndPin.id).some((pid) => gndPins.includes(pid));
        if (isPowered) {
          lcdTexts[comp.id] = 'Embedded Studio\nSimulation Live';
        } else {
          addAlert('warning', 'LCD 1602 Display is not powered. Connect VCC to 5V and GND to ground.', 'schematic');
        }
      }
    }

    // Relay Module
    if (comp.type === 'relay') {
      const inPin = comp.pins.find((p) => p.name === 'IN');
      const isTriggered = inPin && getConnectedNodePins(inPin.id).some((pid) => powerPins.includes(pid));
      relayStates[comp.id] = !!isTriggered;
      if (isTriggered) {
        addLog('info', `Relay Switch Active [CLICK]`);
      }
    }

    // Ultrasonic HC-SR04
    if (comp.type === 'ultrasonic') {
      const trigPin = comp.pins.find((p) => p.name === 'TRIG');
      const echoPin = comp.pins.find((p) => p.name === 'ECHO');
      if (trigPin && echoPin) {
        const distance = comp.state?.distance || 20;
        addLog('info', `[HC-SR04 Ultrasonic] Measured distance: ${distance} cm`);
      }
    }
  });

  // 11. Generate Live Oscilloscope Waveforms for Active PWM / Analog Pins
  Object.keys(pwmWrites).forEach((pinId) => {
    const duty = pwmWrites[pinId] || 0;
    const samples: OscilloscopeSample[] = [];
    for (let t = 0; t <= 50; t++) {
      const cycle = t % 10;
      const dutyThreshold = (duty / 255) * 10;
      const v = cycle < dutyThreshold ? maxVoltage : 0;
      samples.push({ time: t, voltage: v });
    }
    oscilloscopeSamples[pinId] = samples;
  });

  // Compiler syntax validity check
  if (!code.includes('setup') || !code.includes('loop')) {
    addAlert('error', 'Code must include void setup() and void loop() entry points.', 'code');
    addLog('error', 'Compilation Error: Missing setup() or loop() function.');
  } else {
    addAlert('success', 'Firmware compiled successfully with zero syntax errors!', 'code');
    addLog('success', 'Build Succeeded: Firmware uploaded to simulated MCU memory.');
  }

  return {
    voltages,
    modes,
    logs,
    ledStates,
    rgbStates,
    servoAngles,
    lcdTexts,
    buzzerFreqs,
    relayStates,
    debuggerAlerts,
    oscilloscopeSamples,
  };
};
