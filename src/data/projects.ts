import type { Part, PartType, Project, Rot, Wire } from '../types.ts';
import { PARTS, pinPos } from '../parts/catalog.ts';

export interface Starter {
  id: string;
  title: string;
  level: 'Start here' | 'Next steps' | 'Bigger builds';
  summary: string;
  /** What to try once it runs */
  tryIt: string[];
  parts: PartType[];
  build: () => Project;
}

const RED = '#e5383b', BLACK = '#22262e', ORANGE = '#f2801c', YELLOW = '#e9b400', GREEN = '#1fa35b', BLUE = '#2563eb', VIOLET = '#8b3fd9';

/** Small helper for laying out a starter circuit on the breadboard. */
class Bench {
  parts: Part[] = [];
  wires: Wire[] = [];
  private bb: Part;

  constructor(board: 'uno' | 'esp32' | null) {
    if (board) this.parts.push({ id: 'board', type: board, x: 24, y: 48, rot: 0, props: {} });
    this.bb = { id: 'bb', type: 'breadboard', x: 372, y: 48, rot: 0, props: {} };
    this.parts.push(this.bb);
  }
  /** Place a part so that one of its pins sits in a breadboard hole (or at a point). */
  put(id: string, type: PartType, pinId: string, at: string | [number, number], props: Record<string, number | string> = {}, rot: Rot = 0) {
    const part: Part = { id, type, x: 0, y: 0, rot, props: { ...PARTS[type].defaults, ...props } };
    const p = pinPos(part, PARTS[type].pins.find(q => q.id === pinId)!);
    const target = typeof at === 'string' ? pinPos(this.bb, PARTS.breadboard.pins.find(q => q.id === at)!) : { x: at[0], y: at[1] };
    part.x = target.x - p.x;
    part.y = target.y - p.y;
    this.parts.push(part);
  }
  /** Wire two pins. A bare name like "j4" means a breadboard hole. */
  wire(from: string, to: string, color: string) {
    const full = (r: string) => (r.includes(':') ? r : `bb:${r}`);
    this.wires.push({ id: `w${this.wires.length}`, from: full(from), to: full(to), color });
  }
  /** Resistor + LED from column c, with the LED grounded on the lower rail. */
  led(name: string, col: number, color: string, pin: string, wireColor: string) {
    this.put(`r_${name}`, 'resistor', '1', `h${col}`, { ohms: 220 });
    this.put(name, 'led', 'A', `g${col + 4}`, { color });
    this.wire(`board:${pin}`, `j${col}`, wireColor);
    this.wire(`j${col + 5}`, `bn${col + 5}`, BLACK);
  }
  ground() { this.wire('board:GND', 'bn1', BLACK); }
  power() { this.wire('board:5V', 'bp1', RED); this.ground(); }
  done(name: string, code: string): Project { return { name, parts: this.parts, wires: this.wires, code }; }
}

export const STARTERS: Starter[] = [
  {
    id: 'blink', title: 'Blink an LED', level: 'Start here',
    summary: 'The first program everyone writes: turn a light on, wait, turn it off.',
    tryIt: ['Change both delay(1000) values to 200 and watch it speed up.', 'Click the resistor and switch it to 10 kΩ. Why does the LED get dim?'],
    parts: ['uno', 'led', 'resistor'],
    build: () => {
      const b = new Bench('uno');
      b.led('led', 4, 'red', 'D13', ORANGE);
      b.ground();
      return b.done('Blink an LED', `// Blink: the "hello world" of electronics.
const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);   // this pin will send power out
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);  // 5 volts: LED on
  Serial.println("on");
  delay(1000);                  // wait one second

  digitalWrite(LED_PIN, LOW);   // 0 volts: LED off
  Serial.println("off");
  delay(1000);
}
`);
    },
  },
  {
    id: 'battery', title: 'A circuit with no code', level: 'Start here',
    summary: 'Battery, button, resistor, LED. See what a closed loop means.',
    tryIt: ['Hold the button down to close the loop.', 'Flip the LED around (rotate it twice). Current only flows one way.'],
    parts: ['battery', 'button', 'resistor', 'led'],
    build: () => {
      const b = new Bench(null);
      b.put('bat', 'battery', '+', [276, 264]);
      b.wire('bat:+', 'bp1', RED);
      b.wire('bat:-', 'bn1', BLACK);
      b.put('btn', 'button', '1a', 'e8');
      b.wire('bp8', 'j8', RED);
      b.put('r1', 'resistor', '1', 'h10', { ohms: 470 });
      b.put('led', 'led', 'A', 'g14', { color: 'green' });
      b.wire('j15', 'bn15', BLACK);
      return b.done('A circuit with no code', `// This circuit has no board, so there is no code to run.
// Press "Start simulation", then hold the button.
void setup() {}
void loop() {}
`);
    },
  },
  {
    id: 'button', title: 'Button-controlled light', level: 'Start here',
    summary: 'Read a push button and light the LED only while it is held.',
    tryIt: ['Make the LED stay on after one press (hint: remember the state in a variable).', 'Swap the logic so the LED is on until you press.'],
    parts: ['uno', 'button', 'led', 'resistor'],
    build: () => {
      const b = new Bench('uno');
      b.led('led', 3, 'yellow', 'D13', ORANGE);
      b.put('btn', 'button', '1a', 'e16');
      b.wire('board:D2', 'j16', BLUE);
      b.wire('j18', 'bn18', BLACK);
      b.ground();
      return b.done('Button-controlled light', `const int BUTTON_PIN = 2;
const int LED_PIN = 13;

void setup() {
  // INPUT_PULLUP keeps the pin HIGH until the button
  // connects it to ground. So pressed reads LOW.
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  bool pressed = digitalRead(BUTTON_PIN) == LOW;

  if (pressed) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}
`);
    },
  },
  {
    id: 'dimmer', title: 'Knob dimmer', level: 'Next steps',
    summary: 'Turn a potentiometer to fade an LED with PWM.',
    tryIt: ['Click the knob and drag its slider while it runs.', 'Switch the Serial monitor to Graph and turn the knob.'],
    parts: ['uno', 'potentiometer', 'led', 'resistor'],
    build: () => {
      const b = new Bench('uno');
      b.led('led', 3, 'blue', 'D9', ORANGE);
      b.put('pot', 'potentiometer', '1', 'g16', { pos: 0.6 });
      b.wire('j16', 'bp16', RED);
      b.wire('j18', 'bn18', BLACK);
      b.wire('j17', 'board:A0', GREEN);
      b.power();
      return b.done('Knob dimmer', `const int KNOB_PIN = A0;
const int LED_PIN = 9;    // pin 9 can do PWM (the ~ pins)

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int knob = analogRead(KNOB_PIN);            // 0 to 1023
  int brightness = map(knob, 0, 1023, 0, 255); // 0 to 255

  analogWrite(LED_PIN, brightness);

  Serial.print("knob = ");
  Serial.print(knob);
  Serial.print("   brightness = ");
  Serial.println(brightness);
  delay(100);
}
`);
    },
  },
  {
    id: 'traffic', title: 'Traffic light', level: 'Next steps',
    summary: 'Three LEDs taking turns, like the one at the corner.',
    tryIt: ['Add a blinking yellow before green.', 'Write a function so loop() is only three lines long.'],
    parts: ['uno', 'led', 'resistor'],
    build: () => {
      const b = new Bench('uno');
      b.led('red', 2, 'red', 'D10', RED);
      b.led('yellow', 9, 'yellow', 'D9', YELLOW);
      b.led('green', 16, 'green', 'D8', GREEN);
      b.ground();
      return b.done('Traffic light', `const int RED = 10;
const int YELLOW = 9;
const int GREEN = 8;

void show(int pin, int ms) {
  digitalWrite(pin, HIGH);
  delay(ms);
  digitalWrite(pin, LOW);
}

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  show(GREEN, 3000);
  show(YELLOW, 1000);
  show(RED, 3000);
}
`);
    },
  },
  {
    id: 'nightlight', title: 'Automatic night light', level: 'Next steps',
    summary: 'A light sensor switches the LED on when the room gets dark.',
    tryIt: ['Click the light sensor and slide the light level down.', 'Change the 400 threshold and see when the LED switches.'],
    parts: ['uno', 'ldr', 'resistor', 'led'],
    build: () => {
      const b = new Bench('uno');
      b.led('led', 3, 'white', 'D9', ORANGE);
      b.put('ldr', 'ldr', '1', 'g16', { lux: 600 });
      b.put('r_div', 'resistor', '1', 'h17', { ohms: 10000 });
      b.wire('j16', 'bp16', RED);
      b.wire('j21', 'bn21', BLACK);
      b.wire('j17', 'board:A0', GREEN);
      b.power();
      return b.done('Automatic night light', `const int SENSOR_PIN = A0;
const int LED_PIN = 9;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  // The light sensor and the 10k resistor split the 5 volts
  // between them. More light = higher reading.
  int light = analogRead(SENSOR_PIN);
  Serial.println(light);

  if (light < 400) {
    digitalWrite(LED_PIN, HIGH);   // dark: light on
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(200);
}
`);
    },
  },
  {
    id: 'melody', title: 'Play a tune', level: 'Next steps',
    summary: 'Store notes in an array and play them on a buzzer.',
    tryIt: ['Turn your sound on, then start the simulation.', 'Change the numbers in notes[] to write your own song.'],
    parts: ['uno', 'buzzer'],
    build: () => {
      const b = new Bench('uno');
      b.put('buz', 'buzzer', '+', 'g6');
      b.wire('board:D8', 'j6', VIOLET);
      b.wire('j8', 'bn8', BLACK);
      b.ground();
      return b.done('Play a tune', `const int BUZZER_PIN = 8;

// Frequencies in hertz: C D E F G A B C
int notes[] = {262, 294, 330, 349, 392, 440, 494, 523};
int count = sizeof(notes) / sizeof(notes[0]);

void setup() {
  Serial.begin(9600);
}

void loop() {
  for (int i = 0; i < count; i++) {
    tone(BUZZER_PIN, notes[i]);
    Serial.println(notes[i]);
    delay(300);
  }
  noTone(BUZZER_PIN);
  delay(1000);
}
`);
    },
  },
  {
    id: 'rgb', title: 'Color mixer', level: 'Next steps',
    summary: 'Fade an RGB LED through the rainbow with three PWM pins.',
    tryIt: ['Set one color to 0 and see which colors disappear.', 'Make it flash your school colors.'],
    parts: ['uno', 'rgb_led', 'resistor'],
    build: () => {
      const b = new Bench('uno');
      b.put('rgb', 'rgb_led', 'R', 'g12');
      b.put('r_r', 'resistor', '1', 'h8', { ohms: 220 });
      b.put('r_g', 'resistor', '1', 'h14', { ohms: 220 });
      b.put('r_b', 'resistor', '1', 'j15', { ohms: 220 });
      b.wire('board:D11', 'j8', RED);
      b.wire('board:D10', 'f18', GREEN);
      b.wire('board:D9', 'i19', BLUE);
      b.wire('j13', 'bn13', BLACK);
      b.ground();
      return b.done('Color mixer', `const int RED_PIN = 11;
const int GREEN_PIN = 10;
const int BLUE_PIN = 9;

void setColor(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
}

void loop() {
  // red to green
  for (int i = 0; i <= 255; i += 5) { setColor(255 - i, i, 0); delay(20); }
  // green to blue
  for (int i = 0; i <= 255; i += 5) { setColor(0, 255 - i, i); delay(20); }
  // blue back to red
  for (int i = 0; i <= 255; i += 5) { setColor(i, 0, 255 - i); delay(20); }
}
`);
    },
  },
  {
    id: 'servo', title: 'Knob-controlled servo', level: 'Bigger builds',
    summary: 'Turn a knob and a servo arm follows. The start of every robot arm.',
    tryIt: ['Drag the knob slider and watch the arm.', 'Make the arm sweep back and forth by itself with a for loop.'],
    parts: ['uno', 'servo', 'potentiometer'],
    build: () => {
      const b = new Bench('uno');
      b.put('pot', 'potentiometer', '1', 'g4', { pos: 0.3 });
      b.wire('j4', 'bp4', RED);
      b.wire('j6', 'bn6', BLACK);
      b.wire('j5', 'board:A0', GREEN);
      b.put('servo', 'servo', 'GND', 'g16');
      b.wire('j16', 'bn16', BLACK);
      b.wire('j17', 'bp17', RED);
      b.wire('board:D9', 'j18', ORANGE);
      b.power();
      return b.done('Knob-controlled servo', `#include <Servo.h>

Servo arm;

void setup() {
  arm.attach(9);
  Serial.begin(9600);
}

void loop() {
  int knob = analogRead(A0);
  int angle = map(knob, 0, 1023, 0, 180);

  arm.write(angle);
  Serial.println(angle);
  delay(20);
}
`);
    },
  },
  {
    id: 'distance', title: 'Parking sensor', level: 'Bigger builds',
    summary: 'Measure distance with sound and beep faster as things get close.',
    tryIt: ['Click the sensor and slide the object closer.', 'Add an LED that turns on below 10 cm.'],
    parts: ['uno', 'ultrasonic', 'buzzer'],
    build: () => {
      const b = new Bench('uno');
      b.put('sonar', 'ultrasonic', 'VCC', 'g12', { cm: 60 });
      b.wire('j12', 'bp12', RED);
      b.wire('j15', 'bn15', BLACK);
      b.wire('board:D9', 'j13', BLUE);
      b.wire('board:D10', 'j14', YELLOW);
      b.put('buz', 'buzzer', '+', 'g24');
      b.wire('board:D6', 'j24', VIOLET);
      b.wire('j26', 'bn26', BLACK);
      b.power();
      return b.done('Parking sensor', `const int TRIG_PIN = 9;
const int ECHO_PIN = 10;
const int BUZZER_PIN = 6;

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.begin(9600);
}

long readDistanceCm() {
  // Send a short click of sound...
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // ...and time how long the echo takes to come back.
  long duration = pulseIn(ECHO_PIN, HIGH);
  return duration * 0.034 / 2;   // sound travels 0.034 cm per microsecond
}

void loop() {
  long cm = readDistanceCm();
  Serial.print(cm);
  Serial.println(" cm");

  if (cm < 40) {
    tone(BUZZER_PIN, 880, 60);
    delay(cm * 10 + 60);   // closer = shorter wait = faster beeps
  } else {
    delay(200);
  }
}
`);
    },
  },
  {
    id: 'weather', title: 'Desk weather station', level: 'Bigger builds',
    summary: 'Read temperature and humidity and show them on a screen.',
    tryIt: ['Click the DHT11 and change the temperature.', 'Show a warning on line 2 when it is hotter than 32 °C.'],
    parts: ['uno', 'dht11', 'lcd'],
    build: () => {
      const b = new Bench('uno');
      b.put('dht', 'dht11', 'VCC', 'g4');
      b.wire('j4', 'bp4', RED);
      b.wire('board:D2', 'j5', BLUE);
      b.wire('j6', 'bn6', BLACK);
      b.put('lcd', 'lcd', 'GND', 'g12');
      b.wire('j12', 'bn12', BLACK);
      b.wire('j13', 'bp13', RED);
      b.wire('j14', 'board:A4', GREEN);
      b.wire('j15', 'board:A5', YELLOW);
      b.power();
      return b.done('Desk weather station', `#include <DHT.h>
#include <LiquidCrystal_I2C.h>

DHT dht(2, DHT11);
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  dht.begin();
  lcd.init();
  lcd.backlight();
  Serial.begin(9600);
}

void loop() {
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();

  lcd.setCursor(0, 0);
  lcd.print("Temp: ");
  lcd.print(temp, 1);
  lcd.print(" C  ");

  lcd.setCursor(0, 1);
  lcd.print("Humidity: ");
  lcd.print(humidity, 0);
  lcd.print("%  ");

  Serial.print(temp);
  Serial.print(" C, ");
  Serial.print(humidity);
  Serial.println(" %");
  delay(1000);
}
`);
    },
  },
  {
    id: 'measure', title: 'Measure a voltage', level: 'Start here',
    summary: 'Two resistors split a battery’s 9 V between them. A multimeter shows you exactly how.',
    tryIt: [
      'Press Start: two equal resistors split the 9 V in half.',
      'Stop, click the bottom resistor, change it to 2.2 kΩ and start again. Why does the voltage go up?',
      'Hover the wires while it runs. The same current flows through both resistors.',
    ],
    parts: ['battery', 'resistor', 'multimeter'],
    build: () => {
      const b = new Bench(null);
      b.put('bat', 'battery', '+', [276, 264]);
      b.wire('bat:+', 'bp1', RED);
      b.wire('bat:-', 'bn1', BLACK);
      b.put('r1', 'resistor', '1', 'g6', { ohms: 1000 });
      b.put('r2', 'resistor', '1', 'h10', { ohms: 1000 });
      b.wire('bp6', 'j6', RED);
      b.wire('j14', 'bn14', BLACK);
      b.put('meter', 'multimeter', 'COM', [492, 300], { mode: 'V' });
      b.wire('meter:V', 'i10', RED);
      b.wire('meter:COM', 'bn18', BLACK);
      return b.done('Measure a voltage', `// No board in this circuit, so there is no code to run.
// Press "Start simulation" and read the multimeter.
void setup() {}
void loop() {}
`);
    },
  },
  {
    id: 'scope', title: 'See PWM on an oscilloscope', level: 'Next steps',
    summary: 'analogWrite() flicks a pin on and off 490 times a second. The oscilloscope lets you see it happen.',
    tryIt: [
      'Watch the pulses on the scope get wider as the LED gets brighter.',
      'Click the scope and set it to 200 ms per division. The pulses blur into a band, just like your eye blurs them.',
      'Change both delay(60) lines to delay(10). The LED fades faster, and so do the pulses.',
    ],
    parts: ['uno', 'led', 'resistor', 'scope'],
    build: () => {
      const b = new Bench('uno');
      b.led('led', 4, 'green', 'D9', ORANGE);
      b.ground();
      b.put('scope', 'scope', 'CH', [444, 300], { tdiv: 2, vdiv: 1 });
      b.wire('scope:CH', 'i4', YELLOW);
      b.wire('scope:GND', 'bn12', BLACK);
      return b.done('See PWM on an oscilloscope', `const int LED_PIN = 9;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  // analogWrite doesn't make an in-between voltage.
  // It switches the pin fully on and off 490 times a second.
  // The longer each "on" pulse, the brighter the LED looks.
  for (int duty = 0; duty <= 255; duty += 5) {
    analogWrite(LED_PIN, duty);
    delay(60);
  }
  for (int duty = 255; duty >= 0; duty -= 5) {
    analogWrite(LED_PIN, duty);
    delay(60);
  }
}
`);
    },
  },
  {
    id: 'fade', title: 'Fade with a capacitor', level: 'Next steps',
    summary: 'Charge a capacitor with a button, then watch it keep the LED glowing after you let go.',
    tryIt: [
      'Hold the button for a second, then let go. The LED fades out while the scope draws the curve.',
      'Stop, change the capacitor to 100 µF and try again. Is the fade shorter or longer?',
      'Change the 470 Ω resistor to 2.2 kΩ. The LED is dimmer, but how long does it glow now?',
    ],
    parts: ['battery', 'button', 'resistor', 'capacitor', 'led', 'scope'],
    build: () => {
      const b = new Bench(null);
      b.put('bat', 'battery', '+', [276, 264]);
      b.wire('bat:+', 'bp1', RED);
      b.wire('bat:-', 'bn1', BLACK);
      b.put('btn', 'button', '1a', 'e8');
      b.wire('bp8', 'j8', RED);
      b.put('r1', 'resistor', '1', 'h10', { ohms: 100 });
      b.put('cap', 'capacitor', '+', 'g14', { uf: 1000 });
      b.wire('j15', 'bn15', BLACK);
      b.put('r2', 'resistor', '1', 'i14', { ohms: 470 });
      b.put('led', 'led', 'A', 'h18', { color: 'red' });
      b.wire('j19', 'bn19', BLACK);
      b.put('scope', 'scope', 'CH', [444, 300], { tdiv: 500, vdiv: 2 });
      b.wire('scope:CH', 'f14', YELLOW);
      b.wire('scope:GND', 'bn23', BLACK);
      return b.done('Fade with a capacitor', `// No board here: a battery, a button and a capacitor.
// Press "Start simulation", hold the button, then let go.
void setup() {}
void loop() {}
`);
    },
  },
  {
    id: 'ne555', title: 'Blink with a 555 timer', level: 'Next steps',
    summary: 'Make an LED blink on its own with a 555 chip, two resistors and a capacitor—no microcontroller, no code.',
    tryIt: [
      'Watch the LED blink while the oscilloscope draws the square wave on pin 3.',
      'Move the orange scope probe from pin 3 (j12) to the capacitor (d15) to see it charge and discharge between 3 V and 6 V.',
      'Stop, change the capacitor to 10 µF and run again. Ten times smaller capacitor means ten times faster blinks.',
    ],
    parts: ['battery', 'ne555', 'resistor', 'capacitor', 'led', 'scope'],
    build: () => {
      const b = new Bench(null);
      b.put('bat', 'battery', '+', [276, 264]);
      b.wire('bat:+', 'bp1', RED);
      b.wire('bat:-', 'bn1', BLACK);
      b.wire('bp2', 'tp2', RED);
      b.wire('bn3', 'tn3', BLACK);
      b.put('u1', 'ne555', 'VCC', 'e10');
      b.wire('a10', 'tp10', RED);
      b.wire('j10', 'bn10', BLACK);
      b.wire('i13', 'bp13', RED);
      b.put('r1', 'resistor', '1', 'c7', { ohms: 10000 });
      b.wire('a7', 'tp7', RED);
      b.put('r2', 'resistor', '1', 'b11', { ohms: 10000 });
      b.wire('d15', 'd12', YELLOW);
      b.wire('a12', 'g11', GREEN);
      b.put('cap', 'capacitor', '+', 'c15', { uf: 100 });
      b.wire('a16', 'tn16', BLACK);
      b.put('r3', 'resistor', '1', 'h12', { ohms: 470 });
      b.put('led', 'led', 'A', 'g16', { color: 'red' });
      b.wire('j17', 'bn17', BLACK);
      b.put('scope', 'scope', 'CH', [444, 300], { tdiv: 500, vdiv: 2 });
      b.wire('scope:CH', 'j12', ORANGE);
      b.wire('scope:GND', 'bn23', BLACK);
      return b.done('Blink with a 555 timer', `// No microcontroller, no code: the NE555 timer chip blinks the LED on its own.
// Period ≈ 0.693 × (R1 + 2 × R2) × C ≈ 2.1 seconds.
void setup() {}
void loop() {}
`);
    },
  },
  {
    id: 'motor', title: 'Motor speed control', level: 'Bigger builds',
    summary: 'A transistor lets a tiny pin current switch a motor’s big current. Turn the knob to set the speed.',
    tryIt: [
      'Click the knob and drag its slider. The motor speeds up, and the dots on the wires show the current.',
      'Hover the wire into the base, then the wire to the motor. A few mA controls a couple of hundred.',
      'Delete the transistor and wire the motor straight to pin 9. Read the warning that appears.',
    ],
    parts: ['uno', 'npn', 'motor', 'diode', 'resistor', 'potentiometer'],
    build: () => {
      const b = new Bench('uno');
      b.put('q1', 'npn', 'E', 'g8');
      b.put('rb', 'resistor', '2', 'h9', { ohms: 1000 });
      b.wire('board:D9', 'j5', ORANGE);
      b.wire('j8', 'bn8', BLACK);
      b.put('d1', 'diode', 'A', 'h10');
      b.wire('j14', 'bp14', RED);
      b.put('m1', 'motor', '-', [828, 180]);
      b.wire('m1:-', 'j10', BLUE);
      b.wire('m1:+', 'bp24', RED);
      b.put('pot', 'potentiometer', '1', 'g17', { pos: 0.6 });
      b.wire('j17', 'bp17', RED);
      b.wire('j19', 'bn19', BLACK);
      b.wire('j18', 'board:A0', GREEN);
      b.power();
      return b.done('Motor speed control', `const int KNOB_PIN = A0;
const int MOTOR_PIN = 9;   // goes to the transistor's base, through 1 kΩ

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int knob = analogRead(KNOB_PIN);           // 0 to 1023
  int speed = map(knob, 0, 1023, 0, 255);

  // The pin only feeds the base a few mA.
  // The transistor lets the motor's much bigger current through.
  analogWrite(MOTOR_PIN, speed);

  Serial.print("speed = ");
  Serial.println(speed);
  delay(100);
}
`);
    },
  },
  {
    id: 'counter', title: 'Count on a 7-segment display', level: 'Bigger builds',
    summary: 'Light the right segments to show the digits 0 to 9, one every second.',
    tryIt: [
      'Make it count down from 9 instead of up.',
      'Notice that 8 looks dimmer than 1. All the segments share one resistor, so they split its current.',
      'Add patterns for A, b, C, d, E and F, and count in hexadecimal.',
    ],
    parts: ['uno', 'seg7', 'resistor'],
    build: () => {
      const b = new Bench('uno');
      b.put('disp', 'seg7', 'g', 'd14');
      b.put('rc', 'resistor', '1', 'j16', { ohms: 100 });
      b.wire('i20', 'bn20', BLACK);
      b.wire('board:D2', 'a17', ORANGE);
      b.wire('board:D3', 'a18', YELLOW);
      b.wire('board:D4', 'i17', GREEN);
      b.wire('board:D5', 'i15', BLUE);
      b.wire('board:D6', 'i14', VIOLET);
      b.wire('board:D7', 'a15', ORANGE);
      b.wire('board:D8', 'a14', YELLOW);
      b.ground();
      return b.done('Count on a 7-segment display', `// Which segments light up for each digit, as bits: g f e d c b a
byte digits[10] = {
  0b0111111, // 0
  0b0000110, // 1
  0b1011011, // 2
  0b1001111, // 3
  0b1100110, // 4
  0b1101101, // 5
  0b1111101, // 6
  0b0000111, // 7
  0b1111111, // 8
  0b1101111  // 9
};

// Arduino pins wired to segments a, b, c, d, e, f, g
int segmentPins[7] = {2, 3, 4, 5, 6, 7, 8};

void showDigit(int n) {
  for (int s = 0; s < 7; s++) {
    digitalWrite(segmentPins[s], bitRead(digits[n], s));
  }
}

void setup() {
  for (int s = 0; s < 7; s++) {
    pinMode(segmentPins[s], OUTPUT);
  }
  Serial.begin(9600);
}

void loop() {
  for (int n = 0; n <= 9; n++) {
    showDigit(n);
    Serial.println(n);
    delay(1000);
  }
}
`);
    },
  },
];

export const starterFor = (type: PartType): Starter | undefined =>
  STARTERS.find(s => s.parts.includes(type) && s.id !== 'blink' && s.id !== 'battery') ?? STARTERS.find(s => s.parts.includes(type));
