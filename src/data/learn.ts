import type { PartType } from '../types';

export interface Lesson {
  how: string;
  wiring: string[];
  facts: [string, string][];
  watchOut: string;
}

export const LESSONS: Record<PartType, Lesson> = {
  uno: {
    how: 'An Arduino Uno is a small computer that runs one program over and over. It cannot do much alone, but its pins let it switch things on, and sense things, in the real world.',
    wiring: ['Outputs (LEDs, buzzers) go on digital pins 0 to 13.', 'Sensors that give a changing voltage go on A0 to A5.', 'Every circuit needs a path back to a GND pin.'],
    facts: [['Works at', '5 volts'], ['Digital pins', '14 (6 can do PWM)'], ['Analog inputs', '6, reading 0 to 1023'], ['Safe current per pin', '20 mA (40 mA at most)']],
    watchOut: 'A pin can only supply a little current. Motors and bright lamps need their own power and a relay or transistor.',
  },
  esp32: {
    how: 'The ESP32 is a faster board with Wi-Fi and Bluetooth built in, so projects can talk to phones and the internet. It runs the same kind of sketch as an Arduino.',
    wiring: ['Use the GPIO number in your code: digitalWrite(2, HIGH).', 'Power parts from the 3.3V pin, or VIN for 5 V parts.', 'I2C screens use GPIO 21 (SDA) and GPIO 22 (SCL).'],
    facts: [['Works at', '3.3 volts'], ['Processor', '2 cores at 240 MHz'], ['Analog inputs', 'reading 0 to 4095'], ['Wireless', 'Wi-Fi and Bluetooth']],
    watchOut: 'Its pins are 3.3 V. Feeding 5 V into a GPIO pin can damage the chip.',
  },
  breadboard: {
    how: 'A breadboard lets you build circuits without soldering. Under the holes are rows of metal clips: push two legs into the same clip and they are connected.',
    wiring: ['Each column of five holes (a to e, or f to j) is one connection.', 'The gap in the middle separates the top half from the bottom half.', 'The long rails along the edges carry power and ground to the whole board.'],
    facts: [['Columns', '30'], ['Hole spacing', '2.54 mm (0.1 inch)'], ['Tie points', '400']],
    watchOut: 'Putting both legs of a part in the same column joins them together, so the part does nothing.',
  },
  battery: {
    how: 'A battery pushes current around a loop. Chemical reactions inside keep one terminal at a higher voltage than the other, and current flows whenever there is a complete path between them.',
    wiring: ['Red lead is positive, black lead is negative.', 'Current only flows in a closed loop: out of +, through your parts, back to −.'],
    facts: [['Voltage', '9 volts'], ['Inside', 'six 1.5 V cells'], ['Typical capacity', 'about 500 mAh']],
    watchOut: 'Never join + straight to −. That short circuit drains the battery fast and makes it hot.',
  },
  led: {
    how: 'LED stands for light-emitting diode. A diode is a one-way street for current, and this one glows as current passes through. More current means more light, until it burns out.',
    wiring: ['Long leg (anode) toward the positive side.', 'Short leg (cathode) toward ground.', 'Always put a resistor in the path. 220 Ω suits a 5 V pin.'],
    facts: [['Needs about', '2 V (red) to 3 V (blue)'], ['Comfortable current', '10 to 20 mA'], ['Lifetime', 'tens of thousands of hours']],
    watchOut: 'With no resistor an LED takes far too much current and dies in a moment. Backwards, it simply stays dark.',
  },
  rgb_led: {
    how: 'An RGB LED is a red, a green and a blue LED sharing one case. By dimming each one with PWM you can mix almost any color, the same way a phone screen does.',
    wiring: ['Longest leg is the shared cathode: connect it to ground.', 'Give each color leg its own 220 Ω resistor.', 'Use PWM pins (the ~ ones) so you can fade each color.'],
    facts: [['Colors from 3 pins', 'over 16 million'], ['Leg order', 'red, ground, green, blue']],
    watchOut: 'One shared resistor on the ground leg makes the colors fight each other. Use three.',
  },
  resistor: {
    how: 'A resistor makes it harder for current to flow, like a narrow section in a water pipe. It is how you set exactly how much current a part receives. Ohm’s law ties it together: voltage = current × resistance.',
    wiring: ['It works the same in both directions.', 'In series with an LED, it limits the current.', 'Two in a row split a voltage between them (a voltage divider).'],
    facts: [['Measured in', 'ohms (Ω)'], ['220 Ω bands', 'red, red, brown'], ['10 kΩ bands', 'brown, black, orange']],
    watchOut: 'Too large a value and your LED barely glows. Too small and it burns. 220 Ω to 1 kΩ suits most LEDs.',
  },
  button: {
    how: 'A push button is a gap in the circuit that closes while you press it. Your sketch reads the pin to find out whether the gap is open or closed.',
    wiring: ['Sit it across the centre gap of the breadboard.', 'One side to a digital pin, the other side to ground.', 'Use pinMode(pin, INPUT_PULLUP) so the pin reads HIGH until pressed.'],
    facts: [['Pressed reads', 'LOW (with INPUT_PULLUP)'], ['Released reads', 'HIGH']],
    watchOut: 'A pin wired to nothing "floats" and reads random values. The pull-up fixes that.',
  },
  potentiometer: {
    how: 'A potentiometer is a resistor with a sliding contact. Turning the knob moves the contact along the track, so the middle pin taps off anything from 0 V to the full supply voltage.',
    wiring: ['One end pin to 5V, the other end pin to ground.', 'Middle pin to an analog input such as A0.', 'analogRead() then gives 0 to 1023 as you turn.'],
    facts: [['Track resistance', '10 kΩ'], ['Turns', 'about 270°']],
    watchOut: 'Forgetting one end pin leaves the reading stuck or jumpy.',
  },
  ldr: {
    how: 'A photoresistor (LDR) changes resistance with light: very high in the dark, low in bright light. Pair it with a fixed resistor and the changing resistance becomes a changing voltage you can read.',
    wiring: ['One lead to 5V.', 'Other lead to an analog pin, and also through a 10 kΩ resistor to ground.', 'Brighter light gives a higher analogRead() value.'],
    facts: [['In the dark', 'about 200 kΩ'], ['In bright light', 'under 1 kΩ']],
    watchOut: 'On its own it gives the pin nothing to compare against. It always needs the second resistor.',
  },
  buzzer: {
    how: 'A piezo buzzer holds a thin disc that flexes when voltage is applied. Switch the voltage on and off hundreds of times a second and the disc vibrates the air at that pitch.',
    wiring: ['Plus leg to a digital pin.', 'Other leg to ground.', 'tone(pin, 440) plays the note A. noTone(pin) stops it.'],
    facts: [['Middle C', '262 Hz'], ['Loudest around', '2 to 4 kHz']],
    watchOut: 'digitalWrite(HIGH) alone gives one click, not a note. Sound needs the pin to keep switching.',
  },
  servo: {
    how: 'A servo is a motor that knows its own position. You send it an angle, and a sensor inside lets it turn to exactly that angle and hold there, even when pushed.',
    wiring: ['Brown wire to ground, red wire to 5V.', 'Orange wire to a digital pin.', 'Use the Servo library: attach(pin), then write(angle).'],
    facts: [['Range', '0° to 180°'], ['Speed', 'about 0.1 s per 60°'], ['Weight', '9 grams']],
    watchOut: 'Servos draw a lot of current when they move. Several of them need their own power supply.',
  },
  ultrasonic: {
    how: 'The HC-SR04 measures distance the way a bat does. It sends a burst of sound too high to hear and times how long the echo takes to return. Sound travels about 343 metres a second, so time gives distance.',
    wiring: ['Vcc to 5V, Gnd to ground.', 'Trig to a digital pin you set as OUTPUT.', 'Echo to a digital pin you set as INPUT.'],
    facts: [['Range', '2 cm to 4 m'], ['Sound pitch', '40 kHz'], ['Formula', 'cm = microseconds × 0.034 ÷ 2']],
    watchOut: 'Soft or angled surfaces swallow the echo, so the reading jumps to a huge number.',
  },
  dht11: {
    how: 'The DHT11 measures how warm and how humid the air is. A small chip inside reads both sensors and sends the two numbers as a stream of pulses on one wire.',
    wiring: ['Left pin to 5V, right pin to ground.', 'Middle pin to a digital pin.', 'Use the DHT library: readTemperature() and readHumidity().'],
    facts: [['Temperature', '0 to 50 °C, ±2 °C'], ['Humidity', '20 to 90%'], ['Fastest reading', 'once a second']],
    watchOut: 'Reading it more than once a second returns "nan" (not a number).',
  },
  lcd: {
    how: 'This liquid crystal display shows 2 lines of 16 characters. Each character is a grid of dots that darken when powered. The I2C board on the back cuts the wiring down to two signal wires.',
    wiring: ['Gnd to ground, Vcc to 5V.', 'SDA to A4 and SCL to A5 on an Uno.', 'In code: lcd.init(), lcd.backlight(), then lcd.print().'],
    facts: [['Characters', '16 × 2'], ['I2C address', 'usually 0x27'], ['Each character', '5 × 8 dots']],
    watchOut: 'Printing shorter text over longer text leaves old letters behind. Add spaces or call lcd.clear().',
  },
  relay: {
    how: 'A relay is a switch flipped by an electromagnet. A small current from your board moves a metal arm that opens or closes a completely separate, more powerful circuit.',
    wiring: ['Vcc to 5V, Gnd to ground.', 'IN to a digital pin.', 'The device you are switching wires into the screw terminals.'],
    facts: [['Coil', '5 volts'], ['Can switch', 'up to 10 amps'], ['Sound', 'an audible click']],
    watchOut: 'Mains electricity is dangerous. Practise with batteries and low-voltage lamps only.',
  },
  capacitor: {
    how: 'A capacitor is two metal plates with a thin insulator between them. Push current in and charge piles up on the plates; take the push away and the charge flows back out. The bigger the capacitor, the longer it takes to fill and to empty.',
    wiring: ['The long leg (+) goes toward the positive side.', 'The stripe with − signs marks the negative leg.', 'How fast it charges depends on the resistor in front of it: resistance × capacitance gives the time in seconds.'],
    facts: [['Measured in', 'farads (1 µF is a millionth)'], ['Time constant', 'R × C, so 1 kΩ × 1000 µF = 1 s'], ['This one is rated', '25 V']],
    watchOut: 'This kind of capacitor has a + and a − side. Backwards, or above its voltage rating, a real one can bulge or pop.',
  },
  diode: {
    how: 'A diode lets current flow one way and blocks it the other way, like a one-way valve in a pipe. Current goes from the anode to the cathode (the striped end), but never back.',
    wiring: ['The silver stripe marks the cathode.', 'It takes about 0.7 V to push current through the right way.', 'Across a motor or relay it soaks up the voltage spike when the current switches off. That is called a flyback diode.'],
    facts: [['Part number', '1N4007'], ['Forward drop', 'about 0.7 V'], ['Max current', '1 A'], ['Blocks up to', '1000 V backwards']],
    watchOut: 'An LED is a diode too, but this one doesn’t light up. It is made for steering current, not for making light.',
  },
  npn: {
    how: 'A transistor is a switch with no moving parts. A tiny current flowing into the base lets a current about a hundred times bigger flow from the collector to the emitter. That is how a 20 mA Arduino pin can control a motor that needs a quarter of an amp.',
    wiring: ['Emitter to ground.', 'Base to an Arduino pin, through a 1 kΩ resistor.', 'Collector to the thing you want to switch. Its other end goes to power.'],
    facts: [['Part number', '2N2222'], ['Gain', 'about 100 times'], ['Max collector current', '600 mA'], ['Starts to turn on at', 'about 0.65 V on the base']],
    watchOut: 'Always put a resistor on the base. Without one the base takes far too much current and the transistor burns out.',
  },
  motor: {
    how: 'Inside a DC motor, current flows through coils of wire that sit between magnets. The magnetic push spins the shaft. More current means more speed, and reversing the current reverses the direction.',
    wiring: ['A motor needs more current than a pin can give, so switch it with a transistor.', 'Put a diode across the motor, striped end to the + side, to protect the transistor.', 'Control its speed with analogWrite() on the transistor’s base.'],
    facts: [['Typical voltage', '3 to 6 V'], ['Current when running', '100 to 300 mA'], ['Speed', 'thousands of turns a minute']],
    watchOut: 'Never wire a motor straight to a digital pin. It pulls far more than the 40 mA a pin can safely give.',
  },
  seg7: {
    how: 'A 7-segment display is eight LEDs in one package: seven bars shaped like an 8, plus a decimal point. All of them share one negative pin (the common cathode) and each bar has its own pin. Light the right bars and you can show any digit.',
    wiring: ['The two middle pins are the common cathode. Connect them to ground through a resistor.', 'Each segment pin goes to its own Arduino pin.', 'Segments are named a to g, clockwise from the top, with g across the middle.'],
    facts: [['Segments', '7 plus a decimal point'], ['Type', 'common cathode'], ['Each segment needs', 'about 1.8 V and 10 mA']],
    watchOut: 'With one shared resistor, digits that light more segments look dimmer. One resistor per segment keeps them even.',
  },
  switch: {
    how: 'A slide switch joins its middle pin to either the left pin or the right pin, depending on where the slider sits. Unlike a push button, it stays where you leave it.',
    wiring: ['Your circuit connects to the middle pin.', 'Wire one side pin to power. Slide toward it to switch on.', 'In code, read it like a button with INPUT_PULLUP.'],
    facts: [['Type', 'SPDT: single pole, double throw'], ['Positions', '2']],
    watchOut: 'The middle pin is the one that moves between sides. If nothing is wired to it, sliding the switch does nothing.',
  },
  multimeter: {
    how: 'A multimeter is the electronics detective. In V mode it measures the voltage between its two probes. In mA mode it measures the current flowing through it. In Ω mode it measures resistance by pushing a tiny current of its own through the part.',
    wiring: ['Voltage: touch the probes across the part, red on the + side.', 'Current: break the circuit and put the meter in the gap, so the current has to flow through it.', 'Resistance: take the part out of the circuit or disconnect the power, then touch both ends.'],
    facts: [['Voltage range', 'up to 200 V'], ['Current range', 'up to 10 A'], ['Probe colors', 'red for +, black for COM']],
    watchOut: 'In mA mode the meter is almost a plain wire. Putting it straight across a battery or the 5V pin makes a short circuit.',
  },
  scope: {
    how: 'An oscilloscope draws a graph of voltage over time, thousands of times a second. It shows things a multimeter can’t, like the fast on-off pulses behind analogWrite(), or a capacitor slowly charging up.',
    wiring: ['Clip GND to the circuit’s ground.', 'Wire CH1 to the point you want to see.', 'Change the time per division to zoom in or out in time, and the volts per division to make the wave taller or shorter.'],
    facts: [['Screen', '10 divisions across, 8 up'], ['Time per division', '0.5 ms to 1 s'], ['Input', '10 MΩ, so it barely disturbs the circuit']],
    watchOut: 'The scope measures against its GND clip. Clip it anywhere other than ground and every reading shifts.',
  },
  custom: {
    how: 'A custom chip is a package you fill yourself. Real chips are built the same way: a tiny circuit of transistors, resistors and diodes sealed in plastic, with only the pins showing. Describe the inside in a few lines (R for a resistor, LED, D for a diode, V for a source, C for a capacitor) and the simulator wires it up for real.',
    wiring: [
      'Pick a template in the inspector, or write your own description, one element per line: R A _mid 220 puts a 220 Ω resistor between pin A and an inside node.',
      'Name the pins so the chip is easy to wire, then push it across the middle gap of the breadboard like any DIP chip.',
      'Probe its pins (P) to check it does what you designed.',
    ],
    facts: [['Package', 'DIP-8, like the 555'], ['Inside', 'R, D, Z, LED, V and C elements'], ['Inside nodes', 'Names starting with _ stay hidden']],
    watchOut: 'Pin 1 is bottom-left beside the notch. A source (V) inside the chip can power a circuit, so double-check which pins it drives.',
  },
  ne555: {
    how: 'The 555 timer is an eight-pin chip with two voltage comparators and a memory bit inside. It watches the voltage on a charging capacitor: when it reaches two-thirds of the supply voltage it flips the output off and drains the capacitor; when it falls to one-third it flips back on. That simple loop makes a steady blink or tone with no microcontroller at all.',
    wiring: [
      'Pin 8 (VCC) to power (+5 V or 9 V) and pin 1 (GND) to ground. Tie pin 4 (RESET) to VCC so it stays awake.',
      'To blink on its own (astable): wire R1 from VCC to pin 7 (DISCH), R2 from pin 7 to pins 6 and 2 (joined together), and a capacitor from pin 2 to GND.',
      'Pin 3 (OUT) drives your LED (through a resistor) or buzzer.',
    ],
    facts: [['Part number', 'NE555 (DIP-8)'], ['Supply voltage', '4.5 to 16 V'], ['Thresholds', '⅓ and ⅔ of VCC'], ['Max output current', '200 mA']],
    watchOut: 'The notch on the left end marks pin 1 at the bottom-left. Pin numbers run anticlockwise around the chip, ending with pin 8 at the top-left.',
  },
};
