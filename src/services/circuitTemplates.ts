import type { Component, Wire } from "../types/circuit";
import { createComponentPreset, generateId } from "./circuitPresets";

export interface CircuitTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  board: "uno" | "esp32";
  icon: string;
  tags: string[];
  starterCode: string;
  build: () => { components: Component[]; wires: Wire[] };
}

function makeWire(fromPinId: string, toPinId: string, color = "#00f0ff"): Wire {
  return { id: `wire_${generateId()}`, fromPinId, toPinId, color };
}

function buildLEDBlink(board: "uno" | "esp32") {
  const mcu = createComponentPreset("mcu", board);
  mcu.x = 80; mcu.y = 60;
  const led = createComponentPreset("led");
  led.name = "Red LED"; led.x = 420; led.y = 80;
  const res = createComponentPreset("resistor");
  res.x = 420; res.y = 170;

  const pinOut = board === "uno"
    ? mcu.pins.find(p => p.name === "D13")!
    : mcu.pins.find(p => p.name === "D2")!;
  const gnd = mcu.pins.find(p => p.type === "ground")!;
  const anode = led.pins.find(p => p.name === "A")!;
  const cathode = led.pins.find(p => p.name === "K")!;

  return {
    components: [mcu, res, led],
    wires: [
      makeWire(pinOut.id, res.pins[0].id, "#00f0ff"),
      makeWire(res.pins[1].id, anode.id, "#00f0ff"),
      makeWire(cathode.id, gnd.id, "#4b5563"),
    ],
  };
}

function buildButtonLED(board: "uno" | "esp32") {
  const mcu = createComponentPreset("mcu", board);
  mcu.x = 80; mcu.y = 60;
  const led = createComponentPreset("led");
  led.name = "Green LED"; led.x = 460; led.y = 80;
  const res = createComponentPreset("resistor");
  res.x = 460; res.y = 180;
  const btn = createComponentPreset("button");
  btn.x = 420; btn.y = 300;

  const ledOut = board === "uno"
    ? mcu.pins.find(p => p.name === "D13")!
    : mcu.pins.find(p => p.name === "D2")!;
  const btnIn = board === "uno"
    ? mcu.pins.find(p => p.name === "D2")!
    : mcu.pins.find(p => p.name === "D4")!;
  const gnd = mcu.pins.find(p => p.type === "ground")!;
  const vcc = mcu.pins.find(p => p.name === "5V" || p.name === "3.3V" || p.name === "3V3")!;
  const anode = led.pins.find(p => p.name === "A")!;
  const cathode = led.pins.find(p => p.name === "K")!;

  return {
    components: [mcu, res, led, btn],
    wires: [
      makeWire(ledOut.id, res.pins[0].id, "#00f0ff"),
      makeWire(res.pins[1].id, anode.id, "#00f0ff"),
      makeWire(cathode.id, gnd.id, "#4b5563"),
      makeWire(vcc.id, btn.pins[0].id, "#ef4444"),
      makeWire(btn.pins[1].id, btnIn.id, "#00f0ff"),
    ],
  };
}

function buildPotentiometer(board: "uno" | "esp32") {
  const mcu = createComponentPreset("mcu", board);
  mcu.x = 80; mcu.y = 80;
  const pot = createComponentPreset("potentiometer");
  pot.x = 440; pot.y = 100;

  const a0 = mcu.pins.find(p => p.name === "A0" || p.name === "VP(36)")!;
  const vcc = mcu.pins.find(p => p.name === "5V" || p.name === "3.3V" || p.name === "3V3")!;
  const gnd = mcu.pins.find(p => p.type === "ground")!;

  return {
    components: [mcu, pot],
    wires: [
      makeWire(vcc.id, pot.pins.find(p => p.name === "VCC")!.id, "#ef4444"),
      makeWire(pot.pins.find(p => p.name === "SIG")!.id, a0.id, "#00f0ff"),
      makeWire(pot.pins.find(p => p.name === "GND")!.id, gnd.id, "#4b5563"),
    ],
  };
}

function buildDHT11(board: "uno" | "esp32") {
  const mcu = createComponentPreset("mcu", board);
  mcu.x = 80; mcu.y = 80;
  const dht = createComponentPreset("dht11");
  dht.x = 440; dht.y = 100;

  const data = mcu.pins.find(p => p.name === "D4")!;
  const vcc = mcu.pins.find(p => p.name === "5V" || p.name === "3.3V" || p.name === "3V3")!;
  const gnd = mcu.pins.find(p => p.type === "ground")!;

  return {
    components: [mcu, dht],
    wires: [
      makeWire(vcc.id, dht.pins.find(p => p.name === "VCC")!.id, "#ef4444"),
      makeWire(dht.pins.find(p => p.name === "DATA")!.id, data.id, "#00f0ff"),
      makeWire(dht.pins.find(p => p.name === "GND")!.id, gnd.id, "#4b5563"),
    ],
  };
}

function buildDualLED(board: "uno" | "esp32") {
  const mcu = createComponentPreset("mcu", board);
  mcu.x = 80; mcu.y = 60;
  const ledR = createComponentPreset("led");
  ledR.name = "Red LED"; ledR.x = 440; ledR.y = 60;
  const ledG = createComponentPreset("led");
  ledG.name = "Green LED"; ledG.x = 440; ledG.y = 160;
  const res1 = createComponentPreset("resistor");
  res1.x = 540; res1.y = 80;
  const res2 = createComponentPreset("resistor");
  res2.x = 540; res2.y = 175;
  const pot = createComponentPreset("potentiometer");
  pot.x = 440; pot.y = 280;

  const pin9 = mcu.pins.find(p => p.name === "D9" || p.name === "D18") ?? mcu.pins.find(p => p.name === "D13")!;
  const pin10 = mcu.pins.find(p => p.name === "D10" || p.name === "D19") ?? mcu.pins.find(p => p.name === "D12")!;
  const a0 = mcu.pins.find(p => p.name === "A0" || p.name === "VP(36)")!;
  const gnd = mcu.pins.find(p => p.type === "ground")!;
  const vcc = mcu.pins.find(p => p.name === "5V" || p.name === "3.3V" || p.name === "3V3")!;

  return {
    components: [mcu, ledR, ledG, res1, res2, pot],
    wires: [
      makeWire(pin9.id, res1.pins[0].id, "#00f0ff"),
      makeWire(res1.pins[1].id, ledR.pins.find(p => p.name === "A")!.id, "#00f0ff"),
      makeWire(ledR.pins.find(p => p.name === "K")!.id, gnd.id, "#4b5563"),
      makeWire(pin10.id, res2.pins[0].id, "#10b981"),
      makeWire(res2.pins[1].id, ledG.pins.find(p => p.name === "A")!.id, "#10b981"),
      makeWire(ledG.pins.find(p => p.name === "K")!.id, gnd.id, "#4b5563"),
      makeWire(vcc.id, pot.pins.find(p => p.name === "VCC")!.id, "#ef4444"),
      makeWire(pot.pins.find(p => p.name === "SIG")!.id, a0.id, "#00f0ff"),
      makeWire(pot.pins.find(p => p.name === "GND")!.id, gnd.id, "#4b5563"),
    ],
  };
}

export const CIRCUIT_TEMPLATES: CircuitTemplate[] = [
  {
    id: "led-blink-uno",
    name: "LED Blink",
    description: 'The classic "Hello World" of electronics. Blinks a red LED using digitalWrite.',
    difficulty: "Beginner",
    board: "uno",
    icon: "💡",
    tags: ["LED", "Digital", "Timing"],
    starterCode: `const int ledPin = 13;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ledPin, OUTPUT);\n  Serial.println(\"LED Blink ready!\");\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  Serial.println(\"LED ON\");\n  delay(1000);\n  digitalWrite(ledPin, LOW);\n  Serial.println(\"LED OFF\");\n  delay(1000);\n}`,
    build: () => buildLEDBlink("uno"),
  },
  {
    id: "led-blink-esp32",
    name: "ESP32 Blink",
    description: "LED blink adapted for ESP32 DevKit v1 using GPIO2.",
    difficulty: "Beginner",
    board: "esp32",
    icon: "📡",
    tags: ["ESP32", "LED", "GPIO"],
    starterCode: `const int ledPin = 2;\n\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  delay(500);\n  digitalWrite(ledPin, LOW);\n  delay(500);\n}`,
    build: () => buildLEDBlink("esp32"),
  },
  {
    id: "button-led",
    name: "Button + LED Toggle",
    description: "Press a button to toggle an LED. Demonstrates digital input with INPUT_PULLUP.",
    difficulty: "Beginner",
    board: "uno",
    icon: "🔘",
    tags: ["Button", "LED", "INPUT_PULLUP", "Digital Input"],
    starterCode: `const int ledPin = 13;\nconst int btnPin = 2;\nbool ledState = false;\nbool lastBtn = HIGH;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ledPin, OUTPUT);\n  pinMode(btnPin, INPUT_PULLUP);\n}\n\nvoid loop() {\n  bool btn = digitalRead(btnPin);\n  if (btn == LOW && lastBtn == HIGH) {\n    ledState = !ledState;\n    digitalWrite(ledPin, ledState ? HIGH : LOW);\n    Serial.println(ledState ? \"LED ON\" : \"LED OFF\");\n    delay(50);\n  }\n  lastBtn = btn;\n}`,
    build: () => buildButtonLED("uno"),
  },
  {
    id: "potentiometer",
    name: "Potentiometer ADC",
    description: "Read analog voltage from a rotary potentiometer and map it to 0–100%.",
    difficulty: "Beginner",
    board: "uno",
    icon: "🎛️",
    tags: ["Potentiometer", "Analog", "ADC"],
    starterCode: `const int potPin = A0;\n\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println(\"Potentiometer ADC ready!\");\n}\n\nvoid loop() {\n  int raw = analogRead(potPin);\n  float voltage = raw * (5.0 / 1023.0);\n  int percent = map(raw, 0, 1023, 0, 100);\n  Serial.print(\"Raw: \"); Serial.print(raw);\n  Serial.print(\" | Voltage: \"); Serial.print(voltage, 2); Serial.print(\"V\");\n  Serial.print(\" | Level: \"); Serial.print(percent); Serial.println(\"%\");\n  delay(300);\n}`,
    build: () => buildPotentiometer("uno"),
  },
  {
    id: "dht11",
    name: "DHT11 Temp & Humidity",
    description: "Read temperature and humidity from a DHT11 sensor. Adjust readings with the slider panel!",
    difficulty: "Intermediate",
    board: "uno",
    icon: "🌡️",
    tags: ["DHT11", "Sensor", "Temperature", "Humidity"],
    starterCode: `#define DHTPIN 4\n\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println(\"DHT11 Sensor Monitor\");\n  Serial.println(\"Adjust temperature/humidity using the slider panel.\");\n}\n\nvoid loop() {\n  // In XavierLabs: adjust values via slider panel\n  Serial.println(\"Reading sensor data...\");\n  delay(2000);\n}`,
    build: () => buildDHT11("uno"),
  },
  {
    id: "dual-led-dimmer",
    name: "Dual LED PWM Dimmer",
    description: "Two LEDs fade inversely using analogWrite. Potentiometer controls brightness level.",
    difficulty: "Intermediate",
    board: "uno",
    icon: "🌈",
    tags: ["PWM", "LED", "Potentiometer", "analogWrite"],
    starterCode: `const int redPin = 9;\nconst int greenPin = 10;\nconst int potPin = A0;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(redPin, OUTPUT);\n  pinMode(greenPin, OUTPUT);\n}\n\nvoid loop() {\n  int potValue = analogRead(potPin);\n  int brightness = map(potValue, 0, 1023, 0, 255);\n  analogWrite(redPin, brightness);\n  analogWrite(greenPin, 255 - brightness);\n  Serial.print(\"Pot: \"); Serial.print(potValue);\n  Serial.print(\" | Red PWM: \"); Serial.print(brightness);\n  Serial.print(\" | Green PWM: \"); Serial.println(255 - brightness);\n  delay(50);\n}`,
    build: () => buildDualLED("uno"),
  },
];
