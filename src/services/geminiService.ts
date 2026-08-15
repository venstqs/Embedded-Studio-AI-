import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Component, Wire } from '../types/circuit';

export const askGemini = async (
  apiKey: string,
  userMessage: string,
  code: string,
  components: Component[],
  wires: Wire[],
  mcuModel: 'uno' | 'esp32'
): Promise<string> => {
  try {
    // Format the schematic details into text representation for LLM context
    const schematicContext = components
      .filter((c) => c.type !== 'breadboard')
      .map((c) => {
        const pinConnections = c.pins
          .map((pin) => {
            // Find what wires connect to this pin
            const connections = wires
              .filter((w) => w.fromPinId === pin.id || w.toPinId === pin.id)
              .map((w) => {
                const otherPinId = w.fromPinId === pin.id ? w.toPinId : w.fromPinId;
                // Find matching component
                const otherComp = components.find((comp) => comp.pins.some((p) => p.id === otherPinId));
                const otherPin = otherComp?.pins.find((p) => p.id === otherPinId);
                return otherComp && otherPin ? `${otherComp.name} (${otherPin.name})` : 'unknown';
              });
            return connections.length > 0 ? `  - Pin ${pin.name} connected to: ${connections.join(', ')}` : null;
          })
          .filter(Boolean);

        return `Component: ${c.name} (ID: ${c.id})\n${pinConnections.length > 0 ? pinConnections.join('\n') : '  - No wires connected'}`;
      })
      .join('\n\n');

    const systemInstruction = `You are 'Embedded Studio AI Copilot', an expert embedded systems and hardware engineer. 
You are assisting high school / college STEM students who are learning electronics and firmware programming (mostly Arduino Uno and ESP32 with C++/Arduino code).
You have full visibility of their code and circuit wiring. Be educational, encouraging, concise, and technically accurate.

### ACTIVE HARDWARE CONTEXT:
Microcontroller Board: ${mcuModel === 'uno' ? 'Arduino Uno R3' : 'ESP32 DevKit v1'}

### ACTIVE CIRCUIT SCHEMATIC:
${schematicContext || 'No components wired yet.'}

### ACTIVE FIRMWARE CODE:
\`\`\`cpp
${code}
\`\`\`

Explain concepts clearly, review safety rules (e.g. current-limiting resistors for LEDs, VCC short-circuits, signal voltages), and guide students to fix issues step-by-step. Keep responses formatted in clean, scannable Markdown. Avoid long-winded answers.`;

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction,
    });

    const result = await model.generateContent(userMessage);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    throw new Error(error?.message || 'Failed to call Gemini API. Check your key and connection.');
  }
};

// Fallback Mock AI Engine when no API key is provided
export const getMockResponse = (
  userMessage: string,
  _code: string,
  components: Component[],
  wires: Wire[]
): string => {
  const query = userMessage.toLowerCase();
  
  if (query.includes('hello') || query.includes('hi') || query.includes('who are you')) {
    return `Hello! I am your **Embedded Studio AI Copilot**. 🤖💡

I can analyze your active microcontroller code, components, and wires to help you debug and learn electronics. 

*Try asking me questions like:*
- *"How do I connect my LED to the Arduino?"*
- *"Why is my LED not turning on?"*
- *"How does the Potentiometer work?"*

*(Note: Plug in your own **Gemini API Key** in settings at the top right to enable live, fully unrestricted AI advice!)*`;
  }

  if (query.includes('led') && (query.includes('wire') || query.includes('connect') || query.includes('pin'))) {
    return `### Wiring an LED (Light Emitting Diode) 🔴

To safely connect an LED to your board (Arduino Uno or ESP32):
1. **Anode (A / Long leg)**: Connects to a digital output pin (e.g., **D13** on Arduino or **D2** on ESP32) through a **220Ω resistor**.
2. **Cathode (K / Short leg)**: Connects directly to **GND** (Ground).

> [!WARNING]
> **Why do we need a Resistor?**
> LEDs have low internal resistance. Connecting an LED directly between a 5V/3.3V pin and GND will cause excess current to flow, which will burn out the physical LED (and could damage the microcontroller). The resistor limits current to a safe ~15mA.

Here is an example code template to blink pin 13:
\`\`\`cpp
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH); // Turn LED on
  delay(1000);
  digitalWrite(ledPin, LOW);  // Turn LED off
  delay(1000);
}
\`\`\``;
  }

  if (query.includes('dht11') || query.includes('temp') || query.includes('humidity')) {
    return `### Working with the DHT11 Temperature & Humidity Sensor 🌡️💧

The DHT11 is a basic digital sensor that reads ambient temperature and relative humidity. It has three active pins:
1. **VCC**: Connect to **5V** or **3.3V**.
2. **GND**: Connect to **GND** on the board.
3. **DATA**: Connect to any digital pin (e.g., **D2** or **D4**).

#### Sample Arduino Code:
To read from a DHT11, you typically use a library like \`DHT.h\`. Here is a basic code structure:
\`\`\`cpp
#define DHTPIN 2     // Pin connected to DHT11 Data
#define DHTTYPE DHT11

void setup() {
  Serial.begin(9600);
  Serial.println("DHT11 sensor testing...");
}

void loop() {
  // The simulation engine feeds active slider values to the serial monitor!
  delay(2000);
}
\`\`\``;
  }

  if (query.includes('potentiometer') || query.includes('pot') || query.includes('analog')) {
    return `### Understanding Potentiometers (Rotary Knobs) 🎛️

A potentiometer is a variable resistor. When wired up, it outputs a variable analog voltage (from 0V to VCC) depending on how far you rotate the dial.

#### Pin Configuration:
1. **VCC (Left pin)**: Connect to **5V** or **3.3V**.
2. **SIG/Wiper (Center pin)**: Connect to an analog input pin (e.g., **A0** on Arduino).
3. **GND (Right pin)**: Connect to **GND**.

#### How to read values in code:
The Arduino's built-in ADC (Analog-to-Digital Converter) translates the voltage (0 to 5V) into a digital integer range between **0 and 1023**:
\`\`\`cpp
const int potPin = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(potPin); // Reads 0 to 1023
  float voltage = sensorValue * (5.0 / 1023.0); // Convert to actual Volts
  Serial.print("ADC Raw: ");
  Serial.print(sensorValue);
  Serial.print(" | Volts: ");
  Serial.println(voltage);
  delay(500);
}
\`\`\``;
  }

  if (query.includes('resistor') || query.includes('ohm')) {
    return `### Why do we use Resistors? ⚡

Resistors limit the flow of electrical current, protecting sensitive components like microcontrollers, LEDs, and ICs.

*   **LED Protection**: Usually **220Ω** to **330Ω**.
*   **Pull-up/Pull-down**: Typically **10kΩ** resistors used to hold pins at a stable HIGH or LOW voltage state when buttons are released.

In our **Power Consumption Analyzer** panel, adding appropriate resistors keeps current draws low, extending simulated battery runtimes!`;
  }

  if (query.includes('error') || query.includes('debug') || query.includes('why') || query.includes('not working')) {
    // Context-sensitive debugging fallback
    const hasLED = components.some((c) => c.type === 'led');
    const hasMcu = components.some((c) => c.type === 'mcu');
    const hasWires = wires.length > 0;

    if (!hasMcu) {
      return `⚠️ **AI Debugger Tip**: I don't see a Microcontroller on your canvas. Add an **Arduino Uno R3** or **ESP32** from the sidebar, then wire up components to begin simulation.`;
    }
    if (!hasWires) {
      return `⚠️ **AI Debugger Tip**: You have added components but haven't wired them up yet! Click on a component pin circle, then click on another pin circle to draw connection lines.`;
    }
    if (hasLED) {
      return `🔍 **AI Debugger Check**:
1. Check if your LED is connected to the exact pin specified in your code (e.g., is Anode wired to D13 while your code writes to D13?).
2. Make sure the LED Cathode (**K**) is wired to a **GND** pin.
3. Verify that your code calls \`pinMode(ledPin, OUTPUT);\` inside \`setup()\` and toggles it using \`digitalWrite(ledPin, HIGH);\`.`;
    }

    return `🔍 **AI Debugger Check**: 
I recommend:
1. Double-checking that your power connections (5V, 3.3V) don't directly short to GND (this will cause safety alerts).
2. Verifying that the pins designated in your \`setup()\` functions match your physical wiring lines on the canvas.
3. Reading the **Serial Monitor** logs below to inspect what data is being printed by your script.`;
  }

  return `I analyzed your query: *"${userMessage}"*

I can help with wiring, coding, and general hardware questions. 

**Pro-tip**: Since I am running locally, you can insert your own **Gemini API Key** in settings (gears icon or settings button in header) to get full-scale generative AI explanations specifically tailored to your exact canvas and code files!`;
};
