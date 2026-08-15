import type { Component, Wire, MCUModel } from '../types/circuit';
import { createComponentPreset } from './circuitPresets';

export interface CircuitTemplate {
  id: string;
  name: string;
  category: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  mcuModel: MCUModel;
  code: string;
  components: Component[];
  wires: Wire[];
}

export const CIRCUIT_TEMPLATES: CircuitTemplate[] = [
  {
    id: 'template_blink',
    name: '1. LED Blink (Hello World)',
    category: 'Beginner',
    description: 'Blink an external Red LED with a 220Ω current-limiting resistor connected to Digital Pin 13.',
    mcuModel: 'uno',
    code: `// Lab 1: LED Blink Experiment
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("LED Blink Simulation Initialized.");
}

void loop() {
  digitalWrite(ledPin, HIGH);
  Serial.println("LED ON [HIGH]");
  delay(1000);
  
  digitalWrite(ledPin, LOW);
  Serial.println("LED OFF [LOW]");
  delay(1000);
}`,
    components: [
      (() => {
        const mcu = createComponentPreset('mcu', 'uno');
        mcu.x = 60;
        mcu.y = 80;
        return mcu;
      })(),
      (() => {
        const led = createComponentPreset('led');
        led.id = 'led_blink_1';
        led.x = 380;
        led.y = 90;
        led.pins[0].parentComponentId = led.id;
        led.pins[1].parentComponentId = led.id;
        return led;
      })(),
      (() => {
        const res = createComponentPreset('resistor');
        res.id = 'res_blink_1';
        res.x = 380;
        res.y = 190;
        res.pins[0].parentComponentId = res.id;
        res.pins[1].parentComponentId = res.id;
        return res;
      })(),
    ],
    wires: [
      { id: 'w_blink_1', fromPinId: 'mcu_pin_d13', toPinId: 'led_blink_1_pin_anode', color: '#00f3ff' },
      { id: 'w_blink_2', fromPinId: 'led_blink_1_pin_cathode', toPinId: 'res_blink_1_pin_1', color: '#3b82f6' },
      { id: 'w_blink_3', fromPinId: 'res_blink_1_pin_2', toPinId: 'mcu_pin_gnd', color: '#4b5563' },
    ],
  },
  {
    id: 'template_pot_pwm',
    name: '2. Potentiometer LED Dimmer (PWM)',
    category: 'Beginner',
    description: 'Read analog voltage (0-5V) from potentiometer wiper on A0 and adjust LED brightness with PWM on Pin 9.',
    mcuModel: 'uno',
    code: `// Lab 2: Potentiometer PWM Dimmer
const int potPin = A0;
const int ledPin = 9; // PWM pin ~9

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Potentiometer PWM Dimmer Running.");
}

void loop() {
  int sensorValue = analogRead(potPin);
  // Map 0-1023 analog reading to 0-255 PWM duty cycle
  int brightness = map(sensorValue, 0, 1023, 0, 255);
  
  analogWrite(ledPin, brightness);
  Serial.print("Pot ADC: ");
  Serial.print(sensorValue);
  Serial.print(" | PWM Duty: ");
  Serial.println(brightness);
  
  delay(100);
}`,
    components: [
      (() => {
        const mcu = createComponentPreset('mcu', 'uno');
        mcu.x = 60;
        mcu.y = 80;
        return mcu;
      })(),
      (() => {
        const pot = createComponentPreset('potentiometer');
        pot.id = 'pot_dim_1';
        pot.x = 360;
        pot.y = 70;
        pot.pins.forEach((p) => (p.parentComponentId = pot.id));
        return pot;
      })(),
      (() => {
        const led = createComponentPreset('led');
        led.id = 'led_dim_1';
        led.name = 'Blue LED';
        led.color = 'blue';
        led.x = 480;
        led.y = 70;
        led.pins.forEach((p) => (p.parentComponentId = led.id));
        return led;
      })(),
      (() => {
        const res = createComponentPreset('resistor');
        res.id = 'res_dim_1';
        res.x = 480;
        res.y = 170;
        res.pins.forEach((p) => (p.parentComponentId = res.id));
        return res;
      })(),
    ],
    wires: [
      { id: 'w_p1', fromPinId: 'mcu_pin_5v', toPinId: 'pot_dim_1_pin_vcc', color: '#ef4444' },
      { id: 'w_p2', fromPinId: 'mcu_pin_a0', toPinId: 'pot_dim_1_pin_sig', color: '#f59e0b' },
      { id: 'w_p3', fromPinId: 'mcu_pin_gnd1', toPinId: 'pot_dim_1_pin_gnd', color: '#4b5563' },
      { id: 'w_p4', fromPinId: 'mcu_pin_d9', toPinId: 'led_dim_1_pin_anode', color: '#00f3ff' },
      { id: 'w_p5', fromPinId: 'led_dim_1_pin_cathode', toPinId: 'res_dim_1_pin_1', color: '#3b82f6' },
      { id: 'w_p6', fromPinId: 'res_dim_1_pin_2', toPinId: 'mcu_pin_gnd', color: '#4b5563' },
    ],
  },
  {
    id: 'template_servo_sweep',
    name: '3. SG90 Servo Sweep & Control',
    category: 'Intermediate',
    description: 'Control the rotating arm of an SG90 micro-servo motor across 0° to 180° using PWM pulse timing on Pin 9.',
    mcuModel: 'uno',
    code: `// Lab 3: SG90 Micro Servo Controller
#include <Servo.h>

Servo myServo;
int servoPin = 9;

void setup() {
  myServo.attach(servoPin);
  Serial.begin(9600);
  Serial.println("Servo Sweep Starting...");
}

void loop() {
  // Sweep from 0 to 180 degrees
  for (int pos = 0; pos <= 180; pos += 30) {
    myServo.write(pos);
    Serial.print("Servo Angle: ");
    Serial.print(pos);
    Serial.println(" deg");
    delay(400);
  }
  
  // Sweep back from 180 to 0 degrees
  for (int pos = 180; pos >= 0; pos -= 30) {
    myServo.write(pos);
    Serial.print("Servo Angle: ");
    Serial.print(pos);
    Serial.println(" deg");
    delay(400);
  }
}`,
    components: [
      (() => {
        const mcu = createComponentPreset('mcu', 'uno');
        mcu.x = 60;
        mcu.y = 80;
        return mcu;
      })(),
      (() => {
        const srv = createComponentPreset('servo');
        srv.id = 'srv_1';
        srv.x = 380;
        srv.y = 80;
        srv.pins.forEach((p) => (p.parentComponentId = srv.id));
        return srv;
      })(),
    ],
    wires: [
      { id: 'w_s1', fromPinId: 'mcu_pin_gnd', toPinId: 'srv_1_pin_gnd', color: '#4b5563' },
      { id: 'w_s2', fromPinId: 'mcu_pin_5v', toPinId: 'srv_1_pin_vcc', color: '#ef4444' },
      { id: 'w_s3', fromPinId: 'mcu_pin_d9', toPinId: 'srv_1_pin_sig', color: '#f59e0b' },
    ],
  },
  {
    id: 'template_weather_lcd',
    name: '4. DHT11 Weather Station on LCD 1602',
    category: 'Intermediate',
    description: 'Read real-time temperature & humidity data from DHT11 and display formatted metrics on an I2C LCD 1602.',
    mcuModel: 'uno',
    code: `// Lab 4: DHT11 Weather Station on LCD 1602 (I2C)
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

#define DHTPIN 2
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  Serial.begin(9600);
  dht.begin();
  lcd.init();
  lcd.backlight();
  
  lcd.setCursor(0, 0);
  lcd.print("Embedded Studio");
  lcd.setCursor(0, 1);
  lcd.print("Weather Station");
  delay(1500);
}

void loop() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Temp: ");
  lcd.print(temp, 1);
  lcd.print(" C");
  
  lcd.setCursor(0, 1);
  lcd.print("Humidity: ");
  lcd.print(hum, 0);
  lcd.print(" %");
  
  Serial.print("Temp: ");
  Serial.print(temp);
  Serial.print(" C | Hum: ");
  Serial.print(hum);
  Serial.println(" %");
  
  delay(2000);
}`,
    components: [
      (() => {
        const mcu = createComponentPreset('mcu', 'uno');
        mcu.x = 60;
        mcu.y = 80;
        return mcu;
      })(),
      (() => {
        const dht = createComponentPreset('dht11');
        dht.id = 'dht_ws_1';
        dht.x = 360;
        dht.y = 70;
        dht.pins.forEach((p) => (p.parentComponentId = dht.id));
        return dht;
      })(),
      (() => {
        const lcd = createComponentPreset('lcd');
        lcd.id = 'lcd_ws_1';
        lcd.x = 480;
        lcd.y = 70;
        lcd.pins.forEach((p) => (p.parentComponentId = lcd.id));
        return lcd;
      })(),
    ],
    wires: [
      { id: 'w_w1', fromPinId: 'mcu_pin_5v', toPinId: 'dht_ws_1_pin_vcc', color: '#ef4444' },
      { id: 'w_w2', fromPinId: 'mcu_pin_d2', toPinId: 'dht_ws_1_pin_data', color: '#00f3ff' },
      { id: 'w_w3', fromPinId: 'mcu_pin_gnd1', toPinId: 'dht_ws_1_pin_gnd', color: '#4b5563' },
      { id: 'w_w4', fromPinId: 'mcu_pin_5v', toPinId: 'lcd_ws_1_pin_vcc', color: '#ef4444' },
      { id: 'w_w5', fromPinId: 'mcu_pin_gnd2', toPinId: 'lcd_ws_1_pin_gnd', color: '#4b5563' },
      { id: 'w_w6', fromPinId: 'mcu_pin_sda', toPinId: 'lcd_ws_1_pin_sda', color: '#10b981' },
      { id: 'w_w7', fromPinId: 'mcu_pin_scl', toPinId: 'lcd_ws_1_pin_scl', color: '#a855f7' },
    ],
  },
  {
    id: 'template_ultrasonic_alarm',
    name: '5. Ultrasonic Distance Alarm with Buzzer',
    category: 'Intermediate',
    description: 'Detect obstacle distance using HC-SR04 ultrasonic sensor and trigger acoustic audio beeps on Piezo Buzzer when distance < 15cm.',
    mcuModel: 'uno',
    code: `// Lab 5: Ultrasonic Proximity Alarm
const int trigPin = 7;
const int echoPin = 6;
const int buzzerPin = 8;

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buzzerPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Ultrasonic Alarm Active.");
}

void loop() {
  // Trigger ultrasonic sonic burst
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH);
  // Calculate distance in centimeters
  long distanceCm = duration * 0.034 / 2;
  
  Serial.print("Distance: ");
  Serial.print(distanceCm);
  Serial.println(" cm");
  
  if (distanceCm > 0 && distanceCm < 15) {
    // Proximity Alert: Beep Tone at 1200Hz
    tone(buzzerPin, 1200);
    delay(100);
    noTone(buzzerPin);
  } else {
    noTone(buzzerPin);
  }
  
  delay(200);
}`,
    components: [
      (() => {
        const mcu = createComponentPreset('mcu', 'uno');
        mcu.x = 60;
        mcu.y = 80;
        return mcu;
      })(),
      (() => {
        const ultra = createComponentPreset('ultrasonic');
        ultra.id = 'ultra_1';
        ultra.x = 360;
        ultra.y = 70;
        ultra.pins.forEach((p) => (p.parentComponentId = ultra.id));
        return ultra;
      })(),
      (() => {
        const buz = createComponentPreset('buzzer');
        buz.id = 'buz_1';
        buz.x = 500;
        buz.y = 80;
        buz.pins.forEach((p) => (p.parentComponentId = buz.id));
        return buz;
      })(),
    ],
    wires: [
      { id: 'w_u1', fromPinId: 'mcu_pin_5v', toPinId: 'ultra_1_pin_vcc', color: '#ef4444' },
      { id: 'w_u2', fromPinId: 'mcu_pin_d7', toPinId: 'ultra_1_pin_trig', color: '#00f3ff' },
      { id: 'w_u3', fromPinId: 'mcu_pin_d6', toPinId: 'ultra_1_pin_echo', color: '#3b82f6' },
      { id: 'w_u4', fromPinId: 'mcu_pin_gnd1', toPinId: 'ultra_1_pin_gnd', color: '#4b5563' },
      { id: 'w_u5', fromPinId: 'mcu_pin_d8', toPinId: 'buz_1_pin_pos', color: '#f59e0b' },
      { id: 'w_u6', fromPinId: 'mcu_pin_gnd', toPinId: 'buz_1_pin_neg', color: '#4b5563' },
    ],
  },
  {
    id: 'template_rgb_mixer',
    name: '6. ESP32 RGB Light Mixer & Web Server',
    category: 'Advanced',
    description: 'Drive individual Red, Green, and Blue channels of an RGB LED with ESP32 PWM pins and custom color values.',
    mcuModel: 'esp32',
    code: `// Lab 6: ESP32 RGB Color Synthesizer
const int redPin = 25;
const int greenPin = 26;
const int bluePin = 27;

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
  Serial.begin(115200);
  Serial.println("ESP32 RGB Color Controller Ready.");
}

void loop() {
  // Cycle Cyan -> Magenta -> Yellow
  Serial.println("Color: Cyan [R:0, G:255, B:255]");
  analogWrite(redPin, 0);
  analogWrite(greenPin, 255);
  analogWrite(bluePin, 255);
  delay(1200);
  
  Serial.println("Color: Purple [R:200, G:0, B:255]");
  analogWrite(redPin, 200);
  analogWrite(greenPin, 0);
  analogWrite(bluePin, 255);
  delay(1200);
  
  Serial.println("Color: Amber [R:255, G:180, B:0]");
  analogWrite(redPin, 255);
  analogWrite(greenPin, 180);
  analogWrite(bluePin, 0);
  delay(1200);
}`,
    components: [
      (() => {
        const mcu = createComponentPreset('mcu', 'esp32');
        mcu.x = 60;
        mcu.y = 60;
        return mcu;
      })(),
      (() => {
        const rgb = createComponentPreset('rgb_led');
        rgb.id = 'rgb_exp_1';
        rgb.x = 320;
        rgb.y = 80;
        rgb.pins.forEach((p) => (p.parentComponentId = rgb.id));
        return rgb;
      })(),
    ],
    wires: [
      { id: 'w_rgb1', fromPinId: 'mcu_pin_l_7', toPinId: 'rgb_exp_1_pin_r', color: '#ef4444' }, // D25
      { id: 'w_rgb2', fromPinId: 'mcu_pin_l_13', toPinId: 'rgb_exp_1_pin_cat', color: '#4b5563' }, // GND
      { id: 'w_rgb3', fromPinId: 'mcu_pin_l_8', toPinId: 'rgb_exp_1_pin_g', color: '#10b981' }, // D26
      { id: 'w_rgb4', fromPinId: 'mcu_pin_l_9', toPinId: 'rgb_exp_1_pin_b', color: '#3b82f6' }, // D27
    ],
  },
  {
    id: 'template_ldr_relay',
    name: '7. Smart Streetlight with LDR & Relay',
    category: 'Intermediate',
    description: 'Read ambient light with an LDR photoresistor on A0. When light falls below 300 Lux, trigger the 5V Relay and turn on a high-power LED lamp.',
    mcuModel: 'uno',
    code: `// Lab 7: Smart Streetlight Automation
const int ldrPin = A0;
const int relayPin = 8;
const int ledPin = 13;
const int lightThreshold = 300; // Lux threshold

void setup() {
  pinMode(relayPin, OUTPUT);
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Smart Streetlight Controller Initialized.");
}

void loop() {
  int lux = analogRead(ldrPin);
  Serial.print("Ambient Light: ");
  Serial.print(lux);
  Serial.println(" Lux");
  
  if (lux < lightThreshold) {
    // Night time: Activate Relay and LED
    digitalWrite(relayPin, HIGH);
    digitalWrite(ledPin, HIGH);
    Serial.println("-> NIGHT DETECTED: Streetlight ON [Relay CLOSED]");
  } else {
    // Day time: Deactivate Relay and LED
    digitalWrite(relayPin, LOW);
    digitalWrite(ledPin, LOW);
    Serial.println("-> DAY DETECTED: Streetlight OFF [Relay OPEN]");
  }
  
  delay(1000);
}`,
    components: [
      (() => {
        const mcu = createComponentPreset('mcu', 'uno');
        mcu.x = 60;
        mcu.y = 80;
        return mcu;
      })(),
      (() => {
        const ldr = createComponentPreset('ldr');
        ldr.id = 'ldr_street_1';
        ldr.x = 360;
        ldr.y = 70;
        ldr.pins.forEach((p) => (p.parentComponentId = ldr.id));
        return ldr;
      })(),
      (() => {
        const relay = createComponentPreset('relay');
        relay.id = 'relay_street_1';
        relay.x = 480;
        relay.y = 70;
        relay.pins.forEach((p) => (p.parentComponentId = relay.id));
        return relay;
      })(),
      (() => {
        const led = createComponentPreset('led');
        led.id = 'led_street_1';
        led.name = 'Yellow Streetlight LED';
        led.color = 'yellow';
        led.x = 600;
        led.y = 70;
        led.pins.forEach((p) => (p.parentComponentId = led.id));
        return led;
      })(),
    ],
    wires: [
      { id: 'w_l1', fromPinId: 'mcu_pin_5v', toPinId: 'ldr_street_1_pin_vcc', color: '#ef4444' },
      { id: 'w_l2', fromPinId: 'mcu_pin_a0', toPinId: 'ldr_street_1_pin_sig', color: '#f59e0b' },
      { id: 'w_l3', fromPinId: 'mcu_pin_gnd1', toPinId: 'ldr_street_1_pin_gnd', color: '#4b5563' },
      { id: 'w_l4', fromPinId: 'mcu_pin_5v', toPinId: 'relay_street_1_pin_vcc', color: '#ef4444' },
      { id: 'w_l5', fromPinId: 'mcu_pin_d8', toPinId: 'relay_street_1_pin_in', color: '#00f3ff' },
      { id: 'w_l6', fromPinId: 'mcu_pin_gnd2', toPinId: 'relay_street_1_pin_gnd', color: '#4b5563' },
      { id: 'w_l7', fromPinId: 'mcu_pin_d13', toPinId: 'led_street_1_pin_anode', color: '#00f3ff' },
      { id: 'w_l8', fromPinId: 'mcu_pin_gnd', toPinId: 'led_street_1_pin_cathode', color: '#4b5563' },
    ],
  },
  {
    id: 'template_button_toggle',
    name: '8. Push Button Interactive Toggle & Debounce',
    category: 'Beginner',
    description: 'Toggle an LED state each time an interactive push button is pressed with software debounce logic.',
    mcuModel: 'uno',
    code: `// Lab 8: Interactive Push Button Toggle
const int buttonPin = 2;
const int ledPin = 13;

int ledState = LOW;
int lastButtonState = LOW;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Push Button Controller Ready. Click the button on canvas!");
}

void loop() {
  int reading = digitalRead(buttonPin);
  
  if (reading != lastButtonState) {
    if (reading == LOW) { // Button Pressed (Active LOW)
      ledState = (ledState == HIGH) ? LOW : HIGH;
      digitalWrite(ledPin, ledState);
      Serial.print("Button Pressed! LED State: ");
      Serial.println(ledState == HIGH ? "ON [HIGH]" : "OFF [LOW]");
    }
    delay(50); // Debounce delay
  }
  
  lastButtonState = reading;
}`,
    components: [
      (() => {
        const mcu = createComponentPreset('mcu', 'uno');
        mcu.x = 60;
        mcu.y = 80;
        return mcu;
      })(),
      (() => {
        const btn = createComponentPreset('button');
        btn.id = 'btn_tog_1';
        btn.x = 360;
        btn.y = 90;
        btn.pins.forEach((p) => (p.parentComponentId = btn.id));
        return btn;
      })(),
      (() => {
        const led = createComponentPreset('led');
        led.id = 'led_tog_1';
        led.name = 'Green LED';
        led.color = 'green';
        led.x = 480;
        led.y = 90;
        led.pins.forEach((p) => (p.parentComponentId = led.id));
        return led;
      })(),
    ],
    wires: [
      { id: 'w_b1', fromPinId: 'mcu_pin_d2', toPinId: 'btn_tog_1_pin_1', color: '#00f3ff' },
      { id: 'w_b2', fromPinId: 'mcu_pin_gnd1', toPinId: 'btn_tog_1_pin_2', color: '#4b5563' },
      { id: 'w_b3', fromPinId: 'mcu_pin_d13', toPinId: 'led_tog_1_pin_anode', color: '#10b981' },
      { id: 'w_b4', fromPinId: 'mcu_pin_gnd', toPinId: 'led_tog_1_pin_cathode', color: '#4b5563' },
    ],
  },
];

