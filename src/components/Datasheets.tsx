import React, { useState } from 'react';
import { BookOpen, Search, ChevronRight, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface DatasheetEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  pinout: { pin: string; desc: string; type: 'power' | 'ground' | 'digital' | 'analog' | 'passive' }[];
  specs: { label: string; value: string }[];
  codeExample: string;
  pinColor: string;
}

const PIN_COLORS = {
  power: '#ef4444',
  ground: '#3b82f6',
  digital: '#f59e0b',
  analog: '#22c55e',
  passive: '#71717a',
};

const DATASHEETS: DatasheetEntry[] = [
  {
    id: 'uno', name: 'Arduino Uno R3', category: 'Microcontroller', pinColor: '#00979d',
    description: 'Microcontroller board based on ATmega328P. Features 14 digital I/O pins (6 PWM), 6 analog inputs, 16 MHz ceramic resonator, USB connection, and power jack.',
    pinout: [
      { pin: 'D0–D13', desc: 'Digital I/O Pins (D3, D5, D6, D9, D10, D11 support PWM)', type: 'digital' },
      { pin: 'A0–A5', desc: '10-bit Analog Input Pins (0–5V range)', type: 'analog' },
      { pin: '5V / 3.3V', desc: 'Regulated Power Output Pins', type: 'power' },
      { pin: 'GND', desc: 'System Ground Pins', type: 'ground' },
    ],
    specs: [
      { label: 'Microcontroller', value: 'ATmega328P' }, { label: 'Operating Voltage', value: '5V' },
      { label: 'Clock Speed', value: '16 MHz' }, { label: 'Flash Memory', value: '32 KB (0.5KB for bootloader)' },
    ],
    codeExample: `void setup() {\n  Serial.begin(9600);\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}`,
  },
  {
    id: 'esp32', name: 'ESP32 DevKit v1', category: 'Microcontroller', pinColor: '#e11d48',
    description: 'Feature-rich 32-bit MCU with integrated Wi-Fi (802.11 b/g/n) and Bluetooth 4.2 BR/EDR & BLE. Dual-core Tensilica LX6 processor operating up to 240 MHz.',
    pinout: [
      { pin: 'GPIO0–GPIO39', desc: 'General Purpose I/O (Touch, ADC, DAC, PWM, SPI, I2C)', type: 'digital' },
      { pin: 'VP / VN', desc: 'ADC1_CH0 & ADC1_CH3 High sensitivity analog inputs', type: 'analog' },
      { pin: '3V3 / VIN', desc: '3.3V Regulated Output / 5V External Input', type: 'power' },
      { pin: 'GND', desc: 'Ground Pins', type: 'ground' },
    ],
    specs: [
      { label: 'CPU', value: 'Dual-core 32-bit LX6 240MHz' }, { label: 'Wireless', value: 'Wi-Fi 802.11b/g/n & Bluetooth 4.2' },
      { label: 'SRAM / Flash', value: '520 KB / 4 MB' }, { label: 'Operating Voltage', value: '3.3V' },
    ],
    codeExample: `#include <WiFi.h>\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.mode(WIFI_STA);\n  Serial.println("ESP32 Initialized!");\n}\nvoid loop() {\n  delay(1000);\n}`,
  },
  {
    id: 'led', name: 'LED (5mm)', category: 'Output', pinColor: '#ef4444',
    description: 'A light-emitting diode that emits light when forward biased. Always use a current-limiting resistor in series.',
    pinout: [
      { pin: 'Anode (+)', desc: 'Positive terminal (long leg)', type: 'digital' },
      { pin: 'Cathode (−)', desc: 'Negative terminal (short leg) → GND', type: 'ground' },
    ],
    specs: [
      { label: 'Forward Voltage', value: '1.8–3.3V' }, { label: 'Max Current', value: '20 mA' },
      { label: 'Recommended Resistor', value: '220Ω at 5V' }, { label: 'Wavelength', value: '620–625nm (Red)' },
    ],
    codeExample: `const int ledPin = 13;\nvoid setup() { pinMode(ledPin, OUTPUT); }\nvoid loop() {\n  digitalWrite(ledPin, HIGH); delay(1000);\n  digitalWrite(ledPin, LOW);  delay(1000);\n}`,
  },
  {
    id: 'resistor', name: 'Resistor', category: 'Passive', pinColor: '#f59e0b',
    description: 'Passive component that opposes electrical current flow. Used for LED protection, pull-up/pull-down, and voltage division.',
    pinout: [
      { pin: 'Pin 1', desc: 'Terminal A (non-polarized)', type: 'passive' },
      { pin: 'Pin 2', desc: 'Terminal B (non-polarized)', type: 'passive' },
    ],
    specs: [
      { label: 'Common Values', value: '220Ω, 10kΩ, 1kΩ' }, { label: 'Power Rating', value: '0.25W (1/4W)' },
      { label: 'Tolerance', value: '±5% (Gold band)' }, { label: 'V=IR', value: "Ohm's Law" },
    ],
    codeExample: `// No code needed — passive component\n// Use 220Ω to protect LEDs from digital pins\n// Use 10kΩ as pull-up for buttons:\n// pinMode(btnPin, INPUT_PULLUP);`,
  },
  {
    id: 'button', name: 'Tactile Push Button', category: 'Input', pinColor: '#94a3b8',
    description: 'Momentary SPST switch. When pressed, connects Pin 1 and Pin 2. Use INPUT_PULLUP to avoid floating input.',
    pinout: [
      { pin: 'Pin 1', desc: 'Connect to digital pin + 10kΩ to GND', type: 'digital' },
      { pin: 'Pin 2', desc: 'Connect to GND', type: 'ground' },
    ],
    specs: [
      { label: 'Max Voltage', value: '12V' }, { label: 'Max Current', value: '50 mA' },
      { label: 'Bounce Time', value: '~5ms (debounce)' }, { label: 'Type', value: 'SPST Momentary' },
    ],
    codeExample: `const int btnPin = 2;\nvoid setup() { pinMode(btnPin, INPUT_PULLUP); }\nvoid loop() {\n  if (digitalRead(btnPin) == LOW) {\n    // Button pressed!\n  }\n}`,
  },
  {
    id: 'potentiometer', name: '10kΩ Potentiometer', category: 'Input', pinColor: '#fbbf24',
    description: 'Variable resistor with 3 terminals. Wiper outputs a voltage between 0V and VCC based on rotation angle.',
    pinout: [
      { pin: 'VCC', desc: 'Connect to 5V or 3.3V power rail', type: 'power' },
      { pin: 'SIG', desc: 'Wiper output → Analog input pin', type: 'analog' },
      { pin: 'GND', desc: 'Connect to Ground', type: 'ground' },
    ],
    specs: [
      { label: 'Resistance', value: '10kΩ' }, { label: 'Resolution (Arduino)', value: '10-bit (0–1023)' },
      { label: 'Output Range', value: '0V to VCC' }, { label: 'Power Dissipation', value: '0.5W' },
    ],
    codeExample: `const int potPin = A0;\nvoid setup() { Serial.begin(9600); }\nvoid loop() {\n  int val = analogRead(potPin);\n  float volts = val * (5.0 / 1023.0);\n  Serial.println(volts);\n  delay(100);\n}`,
  },
  {
    id: 'dht11', name: 'DHT11 Sensor', category: 'Sensors', pinColor: '#38bdf8',
    description: 'Digital temperature & humidity sensor. Outputs calibrated digital signal. Requires DHT.h library.',
    pinout: [
      { pin: 'VCC', desc: 'Power supply 3–5.5V', type: 'power' },
      { pin: 'DATA', desc: 'Single-wire digital data output', type: 'digital' },
      { pin: 'GND', desc: 'Ground', type: 'ground' },
    ],
    specs: [
      { label: 'Temp Range', value: '0–50°C (±2°C)' }, { label: 'Humidity Range', value: '20–90%RH (±5%)' },
      { label: 'Sampling Rate', value: 'Max 1Hz (1 reading/sec)' }, { label: 'Supply Voltage', value: '3–5.5V DC' },
    ],
    codeExample: `#include <DHT.h>\n#define DHTPIN 2\n#define DHTTYPE DHT11\nDHT dht(DHTPIN, DHTTYPE);\nvoid setup() { Serial.begin(9600); dht.begin(); }\nvoid loop() {\n  float t = dht.readTemperature();\n  float h = dht.readHumidity();\n  Serial.print("T:"); Serial.print(t);\n  Serial.print("°C H:"); Serial.println(h);\n  delay(2000);\n}`,
  },
  {
    id: 'ultrasonic', name: 'HC-SR04 Ultrasonic', category: 'Sensors', pinColor: '#60a5fa',
    description: 'Measures distance using ultrasonic sound pulses. Trigger emits burst, Echo goes HIGH for the return duration.',
    pinout: [
      { pin: 'VCC', desc: '5V Power Supply', type: 'power' },
      { pin: 'TRIG', desc: 'Trigger: send 10μs HIGH pulse to start', type: 'digital' },
      { pin: 'ECHO', desc: 'Echo: HIGH duration = travel time', type: 'digital' },
      { pin: 'GND', desc: 'Ground', type: 'ground' },
    ],
    specs: [
      { label: 'Range', value: '2–400 cm' }, { label: 'Accuracy', value: '±3mm' },
      { label: 'Frequency', value: '40 kHz' }, { label: 'Supply Voltage', value: '5V DC' },
    ],
    codeExample: `const int trig = 9, echo = 10;\nvoid setup() {\n  pinMode(trig, OUTPUT); pinMode(echo, INPUT);\n  Serial.begin(9600);\n}\nvoid loop() {\n  digitalWrite(trig, LOW); delayMicroseconds(2);\n  digitalWrite(trig, HIGH); delayMicroseconds(10);\n  digitalWrite(trig, LOW);\n  long dur = pulseIn(echo, HIGH);\n  float cm = dur * 0.034 / 2;\n  Serial.println(cm); delay(500);\n}`,
  },
  {
    id: 'servo', name: 'SG90 Servo Motor', category: 'Actuators', pinColor: '#818cf8',
    description: 'Micro servo with 180° rotation range. Controlled by PWM signal (50Hz, 1-2ms pulse width). Requires Servo.h.',
    pinout: [
      { pin: 'GND', desc: 'Ground (Brown/Black wire)', type: 'ground' },
      { pin: 'VCC', desc: '5V power (Red wire)', type: 'power' },
      { pin: 'SIG', desc: 'PWM signal input (Orange/Yellow)', type: 'digital' },
    ],
    specs: [
      { label: 'Angle Range', value: '0–180°' }, { label: 'Stall Torque', value: '1.8 kg·cm at 5V' },
      { label: 'Operating Speed', value: '0.1s/60°' }, { label: 'Signal Frequency', value: '50Hz PWM' },
    ],
    codeExample: `#include <Servo.h>\nServo myServo;\nvoid setup() { myServo.attach(9); }\nvoid loop() {\n  for (int pos=0; pos<=180; pos++) {\n    myServo.write(pos); delay(15);\n  }\n  for (int pos=180; pos>=0; pos--) {\n    myServo.write(pos); delay(15);\n  }\n}`,
  },
  {
    id: 'buzzer', name: 'Piezo Buzzer', category: 'Output', pinColor: '#fb923c',
    description: 'Generates audio tones when driven by a frequency signal. Use tone() to specify Hz frequency.',
    pinout: [
      { pin: '(+)', desc: 'Positive terminal → digital output pin', type: 'digital' },
      { pin: '(−)', desc: 'Negative terminal → GND', type: 'ground' },
    ],
    specs: [
      { label: 'Operating Voltage', value: '3–24V' }, { label: 'Frequency Range', value: '2–4.5 kHz (peak resonance)' },
      { label: 'Sound Level', value: '85 dB at 10cm' }, { label: 'Current', value: '30 mA' },
    ],
    codeExample: `const int buzzerPin = 8;\nvoid setup() {}\nvoid loop() {\n  tone(buzzerPin, 523);  // C5 note\n  delay(500);\n  tone(buzzerPin, 659);  // E5 note\n  delay(500);\n  noTone(buzzerPin);\n  delay(500);\n}`,
  },
  {
    id: 'lcd', name: 'LCD 1602 (I2C)', category: 'Output', pinColor: '#4ade80',
    description: 'Liquid crystal display with 16 columns × 2 rows. Uses I2C interface (SDA/SCL) with LiquidCrystal_I2C library.',
    pinout: [
      { pin: 'GND', desc: 'Ground', type: 'ground' },
      { pin: 'VCC', desc: '5V Power', type: 'power' },
      { pin: 'SDA', desc: 'I2C Data (Arduino A4 / ESP32 D21)', type: 'digital' },
      { pin: 'SCL', desc: 'I2C Clock (Arduino A5 / ESP32 D22)', type: 'digital' },
    ],
    specs: [
      { label: 'Characters', value: '16×2' }, { label: 'Backlight', value: 'Blue/White LED' },
      { label: 'I2C Address', value: '0x27 (common)' }, { label: 'Supply Voltage', value: '5V DC' },
    ],
    codeExample: `#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2);\nvoid setup() {\n  lcd.init(); lcd.backlight();\n  lcd.setCursor(0,0);\n  lcd.print("XavierLabs IDE");\n  lcd.setCursor(0,1);\n  lcd.print("Hello World!");\n}\nvoid loop() {}`,
  },
  {
    id: 'relay', name: '5V Relay Module', category: 'Actuators', pinColor: '#f97316',
    description: 'Electromechanical switch controlled by low-voltage signal. Switches high-voltage/high-current AC or DC loads safely.',
    pinout: [
      { pin: 'VCC', desc: '5V coil power supply', type: 'power' },
      { pin: 'IN', desc: 'Control signal (LOW = ON for most modules)', type: 'digital' },
      { pin: 'GND', desc: 'Ground', type: 'ground' },
    ],
    specs: [
      { label: 'Coil Voltage', value: '5V DC' }, { label: 'Switch Capacity', value: '10A @ 250V AC' },
      { label: 'Coil Current', value: '~80 mA' }, { label: 'Contact Type', value: 'SPDT (NO, NC, COM)' },
    ],
    codeExample: `const int relayPin = 7;\nvoid setup() { pinMode(relayPin, OUTPUT); }\nvoid loop() {\n  digitalWrite(relayPin, LOW);  // Relay ON\n  delay(2000);\n  digitalWrite(relayPin, HIGH); // Relay OFF\n  delay(2000);\n}`,
  },
];

const downloadPdf = (entry: DatasheetEntry) => {
  const doc = new jsPDF();
  doc.setFillColor(9, 9, 11);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('XAVIERLABS DATASHEET', 14, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${entry.name.toUpperCase()} TECHNICAL SPECIFICATION`, 14, 28);
  
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Overview & Description', 14, 48);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const splitDesc = doc.splitTextToSize(entry.description, 180);
  doc.text(splitDesc, 14, 56);

  let y = 56 + splitDesc.length * 5 + 8;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Electrical Specifications', 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  entry.specs.forEach(s => {
    doc.text(`• ${s.label}: ${s.value}`, 16, y);
    y += 5.5;
  });

  y += 6;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Pinout Configuration', 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  entry.pinout.forEach(p => {
    doc.text(`• ${p.pin} : ${p.desc}`, 16, y);
    y += 5.5;
  });

  y += 6;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('4. C++ Sample Code', 14, y);
  y += 7;
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  const splitCode = doc.splitTextToSize(entry.codeExample, 180);
  doc.text(splitCode, 16, y);

  doc.save(`${entry.id}_datasheet_xavierlabs.pdf`);
};

const DatasheetCard: React.FC<{ entry: DatasheetEntry; onSelect: (e: DatasheetEntry) => void }> = ({ entry, onSelect }) => (
  <div className="w-full text-left p-3 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl hover:border-[var(--border-active)] hover:bg-[var(--bg-active)] transition-all group flex items-center justify-between">
    <div className="flex-1 cursor-pointer pr-2" onClick={() => onSelect(entry)}>
      <div className="flex items-center space-x-2 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.pinColor, boxShadow: `0 0 6px ${entry.pinColor}` }} />
        <span className="text-xs font-semibold text-white">{entry.name}</span>
      </div>
      <p className="text-[10px] text-[var(--text-muted)]">{entry.category} · {entry.specs[0].label}: {entry.specs[0].value}</p>
    </div>
    <div className="flex items-center space-x-1">
      <button
        onClick={(e) => { e.stopPropagation(); downloadPdf(entry); }}
        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
        title="Download PDF Datasheet"
      >
        <Download size={13} />
      </button>
      <ChevronRight size={12} className="text-[var(--text-muted)] cursor-pointer" onClick={() => onSelect(entry)} />
    </div>
  </div>
);

const Datasheets: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DatasheetEntry | null>(null);

  const filtered = DATASHEETS.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <div className="flex flex-col h-full">
        {/* Back header */}
        <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <button onClick={() => setSelected(null)}
              className="text-[var(--text-muted)] hover:text-white text-xs font-medium transition-colors flex items-center space-x-1">
              <span>← Back</span>
            </button>
            <div className="w-px h-4 bg-[var(--border-light)]" />
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selected.pinColor }} />
              <span className="text-sm font-semibold text-white">{selected.name}</span>
            </div>
          </div>
          <button
            onClick={() => downloadPdf(selected)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors"
          >
            <Download size={12} />
            <span>PDF</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Description */}
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{selected.description}</p>

          {/* Pinout */}
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Pinout</h3>
            <div className="space-y-1.5">
              {selected.pinout.map((p, i) => (
                <div key={i} className="flex items-start space-x-3 bg-[var(--bg-secondary)] rounded-lg px-3 py-2">
                  <div className="flex items-center space-x-1.5 min-w-[80px]">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIN_COLORS[p.type] }} />
                    <span className="text-[10px] font-mono text-white">{p.pin}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Specs */}
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Electrical Specs</h3>
            <div className="grid grid-cols-2 gap-2">
              {selected.specs.map((s, i) => (
                <div key={i} className="bg-[var(--bg-secondary)] rounded-lg px-3 py-2">
                  <p className="text-[9px] text-[var(--text-muted)]">{s.label}</p>
                  <p className="text-xs font-mono text-white font-semibold">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Code example */}
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Arduino Example</h3>
            <div className="bg-[#1e1e1e] rounded-xl border border-[var(--border-light)] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] font-mono">example.ino</span>
              </div>
              <pre className="p-3 text-[10px] font-mono text-[#d4d4d4] overflow-x-auto leading-relaxed">
                <code>{selected.codeExample}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--border-color)] flex-shrink-0">
        <div className="flex items-center space-x-2 mb-3">
          <BookOpen size={14} className="text-[var(--text-secondary)]" />
          <h2 className="text-sm font-semibold text-white">Datasheets</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2 text-[var(--text-muted)]" size={13} />
          <input type="text" placeholder="Search components..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-active)] border border-[var(--border-color)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--color-cyan)] transition-colors" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.map(entry => (
          <DatasheetCard key={entry.id} entry={entry} onSelect={setSelected} />
        ))}
      </div>
    </div>
  );
};

export default Datasheets;
