export interface Tutorial {
  id: string;
  title: string;
  board: 'uno' | 'esp32';
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  tags: string[];
  steps: string[];
  code: string;
}

export const TUTORIALS: Tutorial[] = [
  {
    id: 'uno-blink',
    title: 'GPIO & Blinking an LED',
    board: 'uno',
    description: 'Learn the absolute basics of digital output by controling a LED on Pin 13.',
    difficulty: 'Beginner',
    duration: '5 mins',
    tags: ['digitalWrite', 'delay', 'pinMode'],
    steps: [
      'Connect the LED Anode (+) to Digital Pin 13 through a 220 Ohm resistor.',
      'Connect the LED Cathode (-) directly to Ground (GND).',
      'Upload the starter sketch and check the LED flashing rate.'
    ],
    code: `// Lesson 1: Blinking an LED
const int ledPin = 13;

void setup() {
  // Set Pin 13 as a digital output
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH); // Turn the LED ON (5V)
  delay(1000);                // Wait for 1 second
  digitalWrite(ledPin, LOW);  // Turn the LED OFF (0V)
  delay(1000);                // Wait for 1 second
}`
  },
  {
    id: 'uno-pot-serial',
    title: 'Analog Reads & Serial Debugging',
    board: 'uno',
    description: 'Read analog voltage changes using a potentiometer and print outputs to the Serial Monitor.',
    difficulty: 'Beginner',
    duration: '10 mins',
    tags: ['analogRead', 'Serial.print', 'A0'],
    steps: [
      'Connect the left pin of the Potentiometer to 5V.',
      'Connect the right pin of the Potentiometer to GND.',
      'Connect the center Wiper pin of the Potentiometer to Analog Pin A0.',
      'Open the Serial Monitor tab below to watch the readings change as you dial.'
    ],
    code: `// Lesson 2: Potentiometer Input & Serial Debugging
const int potPin = A0;

void setup() {
  // Initialize serial communication at 9600 bps
  Serial.begin(9600);
  Serial.println("Potentiometer test initialized.");
}

void loop() {
  // Read value from potentiometer (0 to 1023)
  int rawValue = analogRead(potPin);
  
  // Calculate voltage: rawValue * (reference voltage / resolution)
  float voltage = rawValue * (5.0 / 1023.0);
  
  // Print results
  Serial.print("Raw ADC Value: ");
  Serial.print(rawValue);
  Serial.print(" | Voltage: ");
  Serial.print(voltage);
  Serial.println(" V");
  
  delay(500); // Sample every 500ms
}`
  },
  {
    id: 'uno-button',
    title: 'Digital Inputs & Pullups',
    board: 'uno',
    description: 'Control an LED using a tactile push button with Arduino internal pullup resistors.',
    difficulty: 'Intermediate',
    duration: '10 mins',
    tags: ['INPUT_PULLUP', 'digitalRead', 'if-else'],
    steps: [
      'Connect one leg of the button to Pin 2.',
      'Connect the opposite leg of the button to GND.',
      'Connect the LED Anode (+) to Pin 13 through a resistor, and Cathode to GND.',
      'Verify that pressing the button lights up the LED.'
    ],
    code: `// Lesson 3: Tactile Button with Pullup Resistor
const int buttonPin = 2;
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  // INPUT_PULLUP activates the internal 20k ohm resistor. 
  // The pin will read HIGH when open, and LOW when pressed.
  pinMode(buttonPin, INPUT_PULLUP);
}

void loop() {
  int buttonState = digitalRead(buttonPin);
  
  // If button is pressed (connected to GND, reading LOW)
  if (buttonState == LOW) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}`
  },
  {
    id: 'esp32-pwm',
    title: 'ESP32 PWM Dimmer (Fading LED)',
    board: 'esp32',
    description: 'Fade an LED brightness smoothly using Pulse Width Modulation (PWM) on the ESP32.',
    difficulty: 'Intermediate',
    duration: '12 mins',
    tags: ['analogWrite', 'PWM', 'Duty Cycle'],
    steps: [
      'Connect the LED Anode to GPIO pin D2 (through a 220 Ohm resistor).',
      'Connect the Cathode to ESP32 GND.',
      'Watch the LED glow pulse smoothly up and down.'
    ],
    code: `// Lesson 4: LED Fading with PWM
const int ledPin = 2; // Onboard LED or GPIO 2

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  // Increase brightness
  for (int dutyCycle = 0; dutyCycle <= 255; dutyCycle++) {
    analogWrite(ledPin, dutyCycle);
    delay(5);
  }
  
  // Decrease brightness
  for (int dutyCycle = 255; dutyCycle >= 0; dutyCycle--) {
    analogWrite(ledPin, dutyCycle);
    delay(5);
  }
  
  delay(1000); // Rest for a second
}`
  },
  {
    id: 'esp32-wifi-scan',
    title: 'ESP32 WiFi Scan Template',
    board: 'esp32',
    description: 'Learn the template code structure to scan and connect to local WiFi access points.',
    difficulty: 'Advanced',
    duration: '15 mins',
    tags: ['WiFi.h', 'Scan', 'Networking'],
    steps: [
      'Ensure target board is set to ESP32 DevKit v1.',
      'Inspect how the WiFi.h library is initialized.',
      'Check the Serial Monitor output for simulated network updates.'
    ],
    code: `#include "WiFi.h"

void setup() {
  Serial.begin(115200);
  
  // Set WiFi mode to station (client)
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  
  Serial.println("ESP32 WiFi Scanner Active.");
}

void loop() {
  Serial.println("Starting network scan...");
  
  // WiFi.scanNetworks returns the number of networks found
  int n = WiFi.scanNetworks();
  Serial.println("Scan complete.");
  
  if (n == 0) {
    Serial.println("No networks found.");
  } else {
    Serial.print(n);
    Serial.println(" networks found:");
    for (int i = 0; i < n; ++i) {
      Serial.print(i + 1);
      Serial.print(": ");
      Serial.print(WiFi.SSID(i));
      Serial.print(" (");
      Serial.print(WiFi.RSSI(i));
      Serial.println("dBm)");
      delay(10);
    }
  }
  
  Serial.println("");
  delay(5000); // Repeat scan every 5 seconds
}`
  }
];
