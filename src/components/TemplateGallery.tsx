import React from 'react';
import type { Component, Wire } from '../types/circuit';
import { createComponentPreset } from '../services/circuitPresets';
import { X, Zap, Lightbulb, Thermometer, Gauge } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  gradient: string;
  badge: string;
  build: () => { components: Component[]; wires: Wire[]; code: string };
}

interface Props {
  onLoad: (data: { components: Component[]; wires: Wire[]; code: string }) => void;
  onDismiss: () => void;
}

const buildBlink = () => {
  const mcu = createComponentPreset('mcu', 'uno');
  const led = createComponentPreset('led');
  const resistor = createComponentPreset('resistor');
  mcu.x = 80; mcu.y = 90;
  led.x = 420; led.y = 80;
  resistor.x = 420; resistor.y = 190;
  const d13 = mcu.pins.find(p => p.name === 'D13')?.id;
  const gnd = mcu.pins.find(p => p.name === 'GND')?.id;
  const rp1 = resistor.pins[0]?.id;
  const rp2 = resistor.pins[1]?.id;
  const anode = led.pins.find(p => p.name.includes('Anode'))?.id;
  const cathode = led.pins.find(p => p.name.includes('Cathode'))?.id;
  const wires: Wire[] = [];
  if (d13 && rp1) wires.push({ id: 'w1', fromPinId: d13, toPinId: rp1, color: '#f59e0b' });
  if (rp2 && anode) wires.push({ id: 'w2', fromPinId: rp2, toPinId: anode, color: '#ef4444' });
  if (gnd && cathode) wires.push({ id: 'w3', fromPinId: gnd, toPinId: cathode, color: '#3b82f6' });
  return {
    components: [mcu, led, resistor],
    wires,
    code: `// XavierLabs — LED Blink Template\nconst int LED_PIN = 13;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(LED_PIN, OUTPUT);\n  Serial.println("XavierLabs: Blink started!");\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, HIGH);\n  Serial.println("LED ON");\n  delay(1000);\n  digitalWrite(LED_PIN, LOW);\n  Serial.println("LED OFF");\n  delay(1000);\n}`,
  };
};

const buildPotDimmer = () => {
  const mcu = createComponentPreset('mcu', 'uno');
  const led = createComponentPreset('led');
  const pot = createComponentPreset('potentiometer');
  mcu.x = 80; mcu.y = 90;
  led.x = 450; led.y = 70;
  pot.x = 420; pot.y = 230;
  const wires: Wire[] = [];
  return {
    components: [mcu, led, pot],
    wires,
    code: `// XavierLabs — Potentiometer Dimmer Template\nconst int LED_PIN = 9;\nconst int POT_PIN = A0;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(LED_PIN, OUTPUT);\n}\n\nvoid loop() {\n  int potVal = analogRead(POT_PIN);\n  int brightness = map(potVal, 0, 1023, 0, 255);\n  analogWrite(LED_PIN, brightness);\n  Serial.print("Brightness: ");\n  Serial.println(brightness);\n  delay(50);\n}`,
  };
};

const buildDHT11 = () => {
  const mcu = createComponentPreset('mcu', 'uno');
  const dht = createComponentPreset('dht11');
  mcu.x = 80; mcu.y = 90;
  dht.x = 420; dht.y = 120;
  const wires: Wire[] = [];
  return {
    components: [mcu, dht],
    wires,
    code: `// XavierLabs — DHT11 Sensor Logger Template\n// Requires the DHT sensor library\n#include <DHT.h>\n\n#define DHTPIN 2\n#define DHTTYPE DHT11\nDHT dht(DHTPIN, DHTTYPE);\n\nvoid setup() {\n  Serial.begin(9600);\n  dht.begin();\n  Serial.println("XavierLabs: DHT11 Logger ready!");\n}\n\nvoid loop() {\n  float humidity = dht.readHumidity();\n  float tempC = dht.readTemperature();\n  if (!isnan(humidity) && !isnan(tempC)) {\n    Serial.print("Temp: "); Serial.print(tempC); Serial.print("°C  ");\n    Serial.print("Humidity: "); Serial.print(humidity); Serial.println("%");\n  }\n  delay(2000);\n}`,
  };
};

const TEMPLATES: Template[] = [
  {
    id: 'blink',
    name: 'LED Blink',
    desc: 'Classic Hello World — blink an LED on pin 13 with serial output.',
    icon: <Lightbulb size={22} className="text-yellow-400" />,
    gradient: 'from-yellow-900/40 to-amber-900/20',
    badge: 'Beginner',
    build: buildBlink,
  },
  {
    id: 'potdimmer',
    name: 'Potentiometer Dimmer',
    desc: 'Use a potentiometer on A0 to smoothly dim an LED via PWM.',
    icon: <Gauge size={22} className="text-amber-400" />,
    gradient: 'from-orange-900/40 to-amber-900/20',
    badge: 'Intermediate',
    build: buildPotDimmer,
  },
  {
    id: 'dht11',
    name: 'DHT11 Logger',
    desc: 'Read temperature & humidity from a DHT11 sensor and print to serial.',
    icon: <Thermometer size={22} className="text-cyan-400" />,
    gradient: 'from-cyan-900/40 to-teal-900/20',
    badge: 'Intermediate',
    build: buildDHT11,
  },
];

const BADGE_COLORS: Record<string, string> = {
  Beginner: 'bg-green-900/60 text-green-400 border-green-700',
  Intermediate: 'bg-amber-900/60 text-amber-400 border-amber-700',
  Advanced: 'bg-red-900/60 text-red-400 border-red-700',
};

const TemplateGallery: React.FC<Props> = ({ onLoad, onDismiss }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111113] border border-[#2a2a2a] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#222]">
          <div>
            <h2 className="text-white font-bold text-base">Start with a Template</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Or close to start with an empty canvas</p>
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Template Cards */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => { onLoad(t.build()); onDismiss(); }}
              className={`text-left p-4 rounded-xl border border-[#2a2a2a] bg-gradient-to-br ${t.gradient} hover:border-[#444] hover:scale-[1.02] transition-all group`}
            >
              <div className="w-10 h-10 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center mb-3">
                {t.icon}
              </div>
              <div className="flex items-start justify-between mb-1.5">
                <h3 className="text-white text-sm font-semibold leading-tight">{t.name}</h3>
                <span className={`ml-2 flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${BADGE_COLORS[t.badge]}`}>
                  {t.badge}
                </span>
              </div>
              <p className="text-zinc-500 text-[11px] leading-relaxed">{t.desc}</p>
              <div className="mt-3 flex items-center text-[10px] text-zinc-400 group-hover:text-white transition-colors">
                <Zap size={10} className="mr-1" /> Load Template
              </div>
            </button>
          ))}
        </div>

        {/* Empty Canvas option */}
        <div className="px-5 pb-5">
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl border border-[#222] text-zinc-500 text-xs hover:border-[#444] hover:text-zinc-300 transition-colors"
          >
            Start with Empty Canvas →
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateGallery;
