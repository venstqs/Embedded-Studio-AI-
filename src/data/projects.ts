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
    tryIt: ['Click the knob and drag its slider while it runs.', 'Open the Serial monitor to watch the numbers change.'],
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
];

export const starterFor = (type: PartType): Starter | undefined =>
  STARTERS.find(s => s.parts.includes(type) && s.id !== 'blink' && s.id !== 'battery') ?? STARTERS.find(s => s.parts.includes(type));
