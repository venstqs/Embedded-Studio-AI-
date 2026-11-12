/**
 * Hand-built 3D models of every part, made from simple shapes so the whole
 * explorer ships without downloading any model files. Units are millimetres.
 */
import * as THREE from 'three';
import type { PartType } from '../types';

export interface Callout { at: [number, number, number]; title: string; text: string }
export interface Model {
  group: THREE.Group;
  callouts: Callout[];
  /** Optional live demo driven by a 0..1 slider. */
  demo?: { label: string; start: number; read: (v: number) => string; apply: (v: number) => void };
}

type Opt = { rx?: number; ry?: number; rz?: number; metal?: number; rough?: number; opacity?: number; emissive?: number };

const mat = (color: number, o: Opt = {}) => new THREE.MeshStandardMaterial({
  color, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0,
  transparent: o.opacity !== undefined, opacity: o.opacity ?? 1,
  emissive: o.emissive ?? 0x000000,
});
const place = <T extends THREE.Object3D>(m: T, g: THREE.Object3D, x: number, y: number, z: number, o: Opt = {}) => {
  m.position.set(x, y, z);
  m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  m.traverse(c => { c.castShadow = true; c.receiveShadow = true; });
  g.add(m);
  return m;
};
const box = (g: THREE.Object3D, w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, o: Opt = {}) =>
  place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o)), g, x, y, z, o);
const cyl = (g: THREE.Object3D, r: number, h: number, color: number, x = 0, y = 0, z = 0, o: Opt & { r2?: number } = {}) =>
  place(new THREE.Mesh(new THREE.CylinderGeometry(o.r2 ?? r, r, h, 40), mat(color, o)), g, x, y, z, o);
const ball = (g: THREE.Object3D, r: number, color: number, x = 0, y = 0, z = 0, o: Opt = {}) =>
  place(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), mat(color, o)), g, x, y, z, o);
const STEEL = 0xc5ccd4, GOLD = 0xc9a227, BLACK = 0x1d2026;
const metal = { metal: 0.85, rough: 0.3 };
const leg = (g: THREE.Object3D, x: number, z: number, len: number, top = 0) => cyl(g, 0.3, len, STEEL, x, top - len / 2, z, metal);
const header = (g: THREE.Object3D, n: number, x0: number, y: number, z: number, alongZ = false) => {
  for (let i = 0; i < n; i++) {
    const [x, zz] = alongZ ? [x0, z + i * 2.54] : [x0 + i * 2.54, z];
    box(g, 0.64, 6, 0.64, GOLD, x, y - 3, zz, metal);
  }
};

function led(): Model {
  const g = new THREE.Group();
  const lens = mat(0xef2b2d, { opacity: 0.6, rough: 0.15 });
  place(new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5, 40), lens), g, 0, 3.5, 0);
  place(new THREE.Mesh(new THREE.SphereGeometry(2.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), lens), g, 0, 6, 0);
  place(new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, 1, 40), lens), g, 0, 0.5, 0);
  box(g, 0.5, 4.2, 1.6, STEEL, -1.27, 2.6, 0, metal);
  box(g, 2.2, 1.4, 1.6, STEEL, 0.6, 4.2, 0, metal);
  const die = box(g, 0.7, 0.4, 0.7, 0xffd9a0, 0.6, 5.1, 0, { emissive: 0x000000 });
  leg(g, -1.27, 0, 17);
  leg(g, 1.27, 0, 14);
  const glow = new THREE.PointLight(0xff3020, 0, 60);
  glow.position.set(0, 5, 0);
  g.add(glow);
  return {
    group: g,
    callouts: [
      { at: [0, 8, 0], title: 'Epoxy lens', text: 'Clear plastic shaped like a dome. It focuses the light forward and protects the tiny chip inside.' },
      { at: [0.6, 5.1, 0.9], title: 'The chip (die)', text: 'A grain-of-sand piece of semiconductor. This is the only part that actually makes light.' },
      { at: [-1.27, -12, 0], title: 'Anode: the long leg', text: 'Current goes in here. Connect it toward the positive side, through a resistor.' },
      { at: [1.27, -10, 0], title: 'Cathode: the short leg', text: 'Current leaves here, toward ground. The rim of the lens is also flat on this side.' },
    ],
    demo: {
      label: 'Current through the LED', start: 0.5, read: v => `${Math.round(v * 20)} mA`,
      apply: v => {
        lens.emissive.setHex(0xff2010); lens.emissiveIntensity = v * 1.6;
        (die.material as THREE.MeshStandardMaterial).emissive.setHex(0xffe0b0);
        (die.material as THREE.MeshStandardMaterial).emissiveIntensity = v * 3;
        glow.intensity = v * 900;
      },
    },
  };
}

function rgbLed(): Model {
  const g = new THREE.Group();
  const lens = mat(0xf2f5fa, { opacity: 0.7, rough: 0.2 });
  place(new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5, 40), lens), g, 0, 3.5, 0);
  place(new THREE.Mesh(new THREE.SphereGeometry(2.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), lens), g, 0, 6, 0);
  place(new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, 1, 40), lens), g, 0, 0.5, 0);
  [-1.9, -0.63, 0.63, 1.9].forEach((x, i) => leg(g, x, 0, i === 1 ? 17 : 14));
  const glow = new THREE.PointLight(0xffffff, 0, 60);
  glow.position.set(0, 5, 0);
  g.add(glow);
  return {
    group: g,
    callouts: [
      { at: [0, 8, 0], title: 'One lens, three chips', text: 'A red, a green and a blue chip sit side by side. Your eye blends them into one color.' },
      { at: [-0.63, -12, 0], title: 'Common cathode', text: 'The longest leg is shared by all three colors. It goes to ground.' },
      { at: [-1.9, -9, 0], title: 'Red leg', text: 'Each color has its own leg and needs its own resistor.' },
      { at: [1.9, -9, 0], title: 'Blue leg', text: 'Green sits between the long leg and this one.' },
    ],
    demo: {
      label: 'Mix a color', start: 0.15, read: v => `hue ${Math.round(v * 360)}°`,
      apply: v => { const c = new THREE.Color().setHSL(v, 1, 0.5); lens.emissive.copy(c); lens.emissiveIntensity = 1.1; glow.color.copy(c); glow.intensity = 700; },
    },
  };
}

function resistor(): Model {
  const g = new THREE.Group();
  const o = { rz: Math.PI / 2 };
  cyl(g, 1.15, 5, 0xdcc096, 0, 0, 0, o);
  ball(g, 1.35, 0xdcc096, -2.4, 0, 0); ball(g, 1.35, 0xdcc096, 2.4, 0, 0);
  [[-2.4, 0xe02424, 1.4], [-1.1, 0xe02424, 1.2], [0.1, 0x7a4a1e, 1.2], [2.4, GOLD, 1.4]].forEach(([x, c, r]) => cyl(g, r, 0.7, c, x, 0, 0, o));
  cyl(g, 0.3, 26, STEEL, 0, 0, 0, { ...o, ...metal });
  return {
    group: g,
    callouts: [
      { at: [-1.7, 1.5, 0], title: 'Value bands', text: 'Red, red, brown reads 2, 2, then one zero: 220 Ω. Every resistor wears its value as stripes.' },
      { at: [2.4, 1.6, 0], title: 'Tolerance band', text: 'Gold means the real value is within 5% of what the stripes say.' },
      { at: [0.9, -1.4, 0], title: 'Carbon film inside', text: 'A thin spiral of carbon on a ceramic rod. A longer, thinner spiral resists more.' },
      { at: [-9, 0, 0], title: 'Leads', text: 'A resistor has no direction. You can put it in either way round.' },
    ],
  };
}

function button(): Model {
  const g = new THREE.Group();
  box(g, 6, 3.3, 6, BLACK, 0, 1.65, 0);
  box(g, 6.1, 0.3, 6.1, STEEL, 0, 3.4, 0, metal);
  const cap = cyl(g, 1.75, 1.6, 0x15171b, 0, 4.2, 0);
  [[-3.2, -2.25], [3.2, -2.25], [-3.2, 2.25], [3.2, 2.25]].forEach(([x, z]) => { box(g, 0.7, 0.3, 0.7, STEEL, x, 0.9, z, metal); leg(g, x + Math.sign(x) * 0.2, z, 4.4, 1); });
  return {
    group: g,
    callouts: [
      { at: [0, 5.2, 0], title: 'Plunger', text: 'The part you press. A spring pushes it back up when you let go.' },
      { at: [1.6, 3.6, 1.6], title: 'Metal dome inside', text: 'Pressing bends a little metal dome until it touches both sides. That is the click you feel.' },
      { at: [-3.4, -2, 2.25], title: 'Four legs, two sides', text: 'Legs on the same side are already joined. Pressing connects one side to the other.' },
    ],
    demo: { label: 'Press it', start: 0, read: v => (v > 0.6 ? 'closed: current flows' : 'open: no current'), apply: v => { cap.position.y = 4.2 - v * 0.7; } },
  };
}

function potentiometer(): Model {
  const g = new THREE.Group();
  box(g, 9.5, 6.5, 9.5, 0x2a6fdb, 0, 3.25, 0);
  cyl(g, 3.4, 1.2, STEEL, 0, 7.1, 0, metal);
  const knob = new THREE.Group();
  cyl(knob, 3, 7, 0xe9edf2, 0, 3.5, 0);
  box(knob, 0.7, 0.4, 2.6, 0x14213d, 0, 7.05, -1.6);
  place(knob, g, 0, 7.6, 0);
  [-2.5, 0, 2.5].forEach(x => leg(g, x, 4.2, 5));
  return {
    group: g,
    callouts: [
      { at: [0, 15, 0], title: 'Knob', text: 'Turns about three quarters of a circle. The line shows where the wiper is.' },
      { at: [3.5, 4, 4.8], title: 'Resistive track inside', text: 'A horseshoe of carbon, 10 kΩ from end to end. The wiper slides along it.' },
      { at: [0, -3.5, 4.2], title: 'Wiper (middle pin)', text: 'Reads a voltage somewhere between the two end pins, set by the knob.' },
      { at: [-2.5, -3.5, 4.2], title: 'End pins', text: 'Wire one to 5V and the other to ground. Swap them to reverse the knob.' },
    ],
    demo: { label: 'Turn the knob', start: 0.5, read: v => `${(v * 5).toFixed(2)} V on the wiper`, apply: v => { knob.rotation.y = (0.75 - v * 1.5) * Math.PI; } },
  };
}

function ldr(): Model {
  const g = new THREE.Group();
  cyl(g, 2.5, 1.8, 0xd9662b, 0, 0.9, 0);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 7; i++) { const z = -1.5 + i * 0.5, w = Math.sqrt(Math.max(0.1, 4.4 - z * z)); pts.push(new THREE.Vector3(i % 2 ? w : -w, 1.85, z), new THREE.Vector3(i % 2 ? -w : w, 1.85, z + 0.5)); }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], d = a.distanceTo(b);
    const m = box(g, d, 0.12, 0.16, 0xf9e3c4, (a.x + b.x) / 2, 1.85, (a.z + b.z) / 2);
    m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  }
  leg(g, -1.3, 0, 14); leg(g, 1.3, 0, 14);
  return {
    group: g,
    callouts: [
      { at: [0, 2.2, 0], title: 'Light-sensitive track', text: 'A zigzag of cadmium sulfide. Light knocks electrons loose in it, so it conducts better when lit.' },
      { at: [2.6, 0.9, 0], title: 'Ceramic base', text: 'Holds the track. The clear coating on top keeps moisture out.' },
      { at: [-1.3, -9, 0], title: 'Two leads', text: 'No direction, just like a resistor. Pair it with a fixed resistor to turn light into a voltage.' },
    ],
  };
}

function buzzer(): Model {
  const g = new THREE.Group();
  cyl(g, 6, 9.5, BLACK, 0, 4.75, 0);
  cyl(g, 1.1, 0.2, 0x000000, 0, 9.55, 0);
  box(g, 1.6, 0.1, 0.4, 0xe9edf2, -3.4, 9.55, 0); box(g, 0.4, 0.1, 1.6, 0xe9edf2, -3.4, 9.55, 0);
  leg(g, -3.3, 0, 6); leg(g, 3.3, 0, 6);
  return {
    group: g,
    callouts: [
      { at: [0, 9.8, 0], title: 'Sound hole', text: 'Sound leaves through here. Covering it with a finger makes it much quieter.' },
      { at: [4, 5, 4.6], title: 'Piezo disc inside', text: 'A ceramic disc that bends when voltage is applied. Bending back and forth quickly pushes air: sound.' },
      { at: [-3.4, 9.8, 1.6], title: 'Plus mark', text: 'This side goes to your signal pin. The other leg goes to ground.' },
    ],
  };
}

function servo(): Model {
  const g = new THREE.Group();
  const blue = 0x2563eb;
  box(g, 22.8, 22.5, 12.2, blue, 0, 11.25, 0);
  box(g, 32.4, 2.4, 12.2, blue, 0, 17.5, 0);
  cyl(g, 5.9, 4.2, blue, -5.4, 24.6, 0);
  cyl(g, 2.8, 4.2, blue, 0.6, 24.6, 0);
  cyl(g, 2.4, 3, 0xf4f6f9, -5.4, 28, 0);
  const horn = new THREE.Group();
  box(horn, 18, 1.4, 4.4, 0xf4f6f9, 6, 0, 0);
  cyl(horn, 3.4, 1.6, 0xf4f6f9, 0, 0, 0);
  cyl(horn, 0.9, 1.8, STEEL, 0, 0.1, 0, metal);
  place(horn, g, -5.4, 30, 0);
  [[0x7a4a1e, -1.3], [0xe5383b, 0], [0xf2801c, 1.3]].forEach(([c, z]) => cyl(g, 0.55, 16, c, 19, 3, z, { rz: Math.PI / 2 }));
  return {
    group: g,
    callouts: [
      { at: [8, 31, 0], title: 'Horn', text: 'The arm that moves. Attach your robot part here. It turns half a circle, 0° to 180°.' },
      { at: [0, 21, 6.3], title: 'Gears inside', text: 'A tiny fast motor drives a stack of gears that trades speed for strength.' },
      { at: [-8, 8, 6.3], title: 'Position sensor', text: 'A potentiometer on the output shaft tells the servo where the arm is, so it can stop at your angle.' },
      { at: [25, 3, 0], title: 'Three wires', text: 'Brown to ground, red to 5V, orange to a signal pin.' },
      { at: [15, 17.5, 0], title: 'Mounting tabs', text: 'Screw holes for fixing the servo to your build.' },
    ],
    demo: { label: 'servo.write(angle)', start: 0.5, read: v => `${Math.round(v * 180)}°`, apply: v => { horn.rotation.y = Math.PI - v * Math.PI; } },
  };
}

function ultrasonic(): Model {
  const g = new THREE.Group();
  box(g, 45, 20, 1.6, 0x1f5fbf, 0, 10, 0);
  [-13, 13].forEach(x => {
    cyl(g, 8, 12, STEEL, x, 10, 6.8, { rx: Math.PI / 2, ...metal });
    cyl(g, 6.4, 0.3, 0x4a515c, x, 10, 12.85, { rx: Math.PI / 2 });
  });
  box(g, 10, 3.4, 3.4, STEEL, 0, 17, 2.4, metal);
  header(g, 4, -3.81, 0, -1.2);
  return {
    group: g,
    callouts: [
      { at: [-13, 10, 13.5], title: 'Transmitter', text: 'A tiny speaker. It chirps at 40 kHz, far too high for you to hear.' },
      { at: [13, 10, 13.5], title: 'Receiver', text: 'A tiny microphone that listens for the chirp bouncing back.' },
      { at: [0, 17.5, 4.5], title: 'Crystal', text: 'Keeps the timing exact, so the echo time can be turned into distance.' },
      { at: [0, -5, -1.2], title: 'Four pins', text: 'Vcc, Trig, Echo, Gnd. Pulse Trig, then time how long Echo stays high.' },
    ],
  };
}

function dht11(): Model {
  const g = new THREE.Group();
  box(g, 14, 20, 1.2, 0x1f5fbf, 0, 10, -0.6);
  box(g, 12, 15.5, 5.5, 0x4fb0e6, 0, 11.2, 2.75);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) box(g, 1.7, 1.7, 0.3, 0x1b6fa8, -3.75 + c * 2.5, 6.6 + r * 3, 5.5);
  header(g, 3, -2.54, 0, -0.6);
  return {
    group: g,
    callouts: [
      { at: [0, 11, 5.9], title: 'Vented case', text: 'The holes let room air reach the sensors inside.' },
      { at: [-3, 15, 5.6], title: 'Humidity sensor', text: 'A strip that soaks up water vapor. Wetter air changes how well it conducts.' },
      { at: [3, 7, 5.6], title: 'Thermistor', text: 'A resistor whose value changes with temperature.' },
      { at: [0, -5, -0.6], title: 'Three pins', text: 'Power, data, ground. A chip inside sends both readings down the single data wire.' },
    ],
  };
}

function lcd(): Model {
  const g = new THREE.Group();
  box(g, 80, 36, 1.6, 0x1f7a4a, 0, 18, 0);
  box(g, 71, 24, 7, 0x14171c, 0, 19, 4.3);
  const screen = box(g, 64.5, 14.5, 0.2, 0xa9dc3f, 0, 19, 7.85, { emissive: 0x5c8a10 });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) box(g, 2.95, 5.55, 0.1, 0x8fc12d, -29.6 + c * 3.95, 22.2 - r * 6.4, 8);
  box(g, 41, 19, 1.4, BLACK, 0, 18, -5);
  box(g, 6.5, 6.5, 4.5, 0x2a6fdb, 8, 19, -8);
  cyl(g, 1.3, 0.5, 0xf4f6f9, 8, 19, -10.4, { rx: Math.PI / 2 });
  header(g, 4, -24, 14, -9, false);
  [[-37, 33.5], [37, 33.5], [-37, 2.5], [37, 2.5]].forEach(([x, y]) => cyl(g, 1.3, 1.7, 0xe9edf2, x, y, 0, { rx: Math.PI / 2 }));
  return {
    group: g,
    callouts: [
      { at: [0, 19, 8.3], title: 'Display glass', text: '16 characters on each of 2 lines. Every character is a 5 by 8 grid of dots.' },
      { at: [-34, 19, 7.9], title: 'Backlight', text: 'LEDs along the edge light the screen from behind. lcd.backlight() turns them on.' },
      { at: [-12, 18, -6], title: 'I2C backpack', text: 'A helper board on the back. It lets the board control the whole screen over just two wires.' },
      { at: [8, 19, -10.8], title: 'Contrast trimmer', text: 'On a real module, turn this small screw if the letters look faint.' },
      { at: [-20, 8, -9], title: 'Four pins', text: 'Gnd, Vcc, SDA (data) and SCL (clock).' },
    ],
    demo: { label: 'Backlight', start: 1, read: v => (v > 0.5 ? 'on' : 'off'), apply: v => { (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = v > 0.5 ? 1 : 0.05; } },
  };
}

function relay(): Model {
  const g = new THREE.Group();
  box(g, 34, 1.6, 26, 0x17335f, 0, 0.8, 0);
  box(g, 19, 15.5, 15, 0x2f7de1, 2, 9.3, 0);
  box(g, 7.5, 10, 15, 0x1fa35b, -12.5, 6.6, 0);
  [-5, 0, 5].forEach(z => cyl(g, 1.6, 0.4, STEEL, -12.5, 11.7, z, metal));
  box(g, 2.6, 8.5, 7.8, BLACK, 14.5, 5.8, 0);
  [-2.54, 0, 2.54].forEach(z => box(g, 6, 0.64, 0.64, GOLD, 17.5, 7.5, z, metal));
  box(g, 1.6, 0.8, 0.9, 0xff4d4f, 13, 2, 9, { emissive: 0x7a1012 });
  return {
    group: g,
    callouts: [
      { at: [2, 17.5, 0], title: 'Coil inside the blue box', text: 'An electromagnet. When your pin powers it, it pulls a metal arm across with a click.' },
      { at: [-12.5, 12.5, 0], title: 'Screw terminals', text: 'The switched side. A lamp or motor circuit connects here, fully separate from your board.' },
      { at: [19, 7.5, 0], title: 'Signal pins', text: 'Vcc, Gnd and IN. A HIGH on IN closes the switch.' },
      { at: [13, 2.8, 9], title: 'Indicator LED', text: 'Lights up while the switch is closed.' },
    ],
  };
}

function battery(): Model {
  const g = new THREE.Group();
  box(g, 26.5, 31, 17.5, BLACK, 0, 15.5, 0);
  box(g, 26.5, 15, 17.5, 0xd97a1f, 0, 38.5, 0, { metal: 0.4, rough: 0.4 });
  cyl(g, 2.9, 2.4, STEEL, -6.4, 47.2, 0, metal);
  place(new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 2.4, 6), mat(STEEL, metal)), g, 6.4, 47.2, 0);
  return {
    group: g,
    callouts: [
      { at: [-6.4, 48.8, 0], title: 'Positive terminal', text: 'The smaller, round snap. Current leaves from here.' },
      { at: [6.4, 48.8, 0], title: 'Negative terminal', text: 'The larger, six-sided snap. Current returns here.' },
      { at: [0, 22, 9], title: 'Six cells inside', text: 'Six small 1.5 V cells stacked in a row: 6 × 1.5 = 9 volts.' },
    ],
  };
}

function breadboard(): Model {
  const g = new THREE.Group();
  box(g, 83, 9.5, 55, 0xf6f4ee, 0, 4.75, 0);
  box(g, 83, 0.4, 3, 0xd9d4c6, 0, 9.4, 0);
  const holes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.2, 1.1), mat(0x3a3e45), 30 * 14);
  const m = new THREE.Matrix4();
  const rows = [-24.4, -21.9, -14, -11.5, -9, -6.5, -4, 4, 6.5, 9, 11.5, 14, 21.9, 24.4];
  let k = 0;
  for (let c = 0; c < 30; c++) for (const z of rows) { m.setPosition(-36.8 + c * 2.54, 9.52, z); holes.setMatrixAt(k++, m); }
  g.add(holes);
  [[-26, 0xe5383b], [-20.3, 0x2563eb], [20.3, 0xe5383b], [26, 0x2563eb]].forEach(([z, c]) => box(g, 76, 0.1, 0.5, c, 0, 9.52, z));
  const strip = box(g, 0.9, 6, 11.4, GOLD, -11.4, 5, -9, { ...metal, opacity: 0.001 });
  const rail = box(g, 76, 6, 0.9, GOLD, 0, 5, -24.4, { ...metal, opacity: 0.001 });
  const body = g.children[0] as THREE.Mesh;
  return {
    group: g,
    callouts: [
      { at: [-11.4, 9.8, -9], title: 'Terminal strip', text: 'Each column of five holes is one metal clip. Legs pushed into the same column are connected.' },
      { at: [10, 9.8, -24.4], title: 'Power rails', text: 'The long rows by the red and blue lines are joined end to end. Use them for 5V and ground.' },
      { at: [20, 9.8, 0], title: 'Centre gap', text: 'Splits the board in two. Chips and buttons sit across it so their sides stay separate.' },
    ],
    demo: {
      label: 'X-ray view', start: 0, read: v => (v > 0.5 ? 'showing the metal clips inside' : 'solid'),
      apply: v => {
        const x = v > 0.5;
        const bm = body.material as THREE.MeshStandardMaterial;
        bm.transparent = true; bm.opacity = x ? 0.35 : 1;
        [strip, rail].forEach(s => { (s.material as THREE.MeshStandardMaterial).opacity = x ? 1 : 0.001; });
      },
    },
  };
}

function uno(): Model {
  const g = new THREE.Group();
  box(g, 68.6, 1.6, 53.4, 0x0f8391, 0, 0.8, 0);
  box(g, 16, 10.8, 12, STEEL, -30, 7, -14.5, metal);
  box(g, 14, 10.8, 9, BLACK, -29, 7, 18.5);
  box(g, 35, 3.6, 7.2, BLACK, 9, 3.6, 12);
  for (let i = 0; i < 14; i++) [8.2, 15.8].forEach(z => box(g, 0.5, 1.8, 0.5, STEEL, -7.5 + i * 2.54, 2.3, z, metal));
  box(g, 25.4, 8.5, 2.5, BLACK, -4.5, 5.8, -24.5); box(g, 20.3, 8.5, 2.5, BLACK, 21.5, 5.8, -24.5);
  box(g, 20.3, 8.5, 2.5, BLACK, 3, 5.8, 24.5); box(g, 15.2, 8.5, 2.5, BLACK, 24, 5.8, 24.5);
  box(g, 6, 3.4, 6, STEEL, -24, 3.3, -22.5, metal); cyl(g, 1.5, 1.2, 0xe5383b, -24, 5.5, -22.5);
  box(g, 11, 3.6, 4.6, STEEL, -12, 3.4, 2, metal);
  const ledL = box(g, 1.6, 0.8, 0.9, 0xf6b300, 0, 2, -12, { emissive: 0x7a5800 });
  box(g, 1.6, 0.8, 0.9, 0x3dff8b, 22, 2, -5, { emissive: 0x0d7a3a });
  box(g, 6.5, 2.2, 6.5, BLACK, -14, 2.7, 12);
  return {
    group: g,
    callouts: [
      { at: [9, 5.8, 12], title: 'Microcontroller (ATmega328P)', text: 'The actual computer. Your whole sketch lives in this one chip: 32 KB of storage, 2 KB of memory.' },
      { at: [8, 10.5, -24.5], title: 'Digital pins 0 to 13', text: 'Each can be switched to 5 V or 0 V, or read as HIGH or LOW. The ones marked ~ can fade with PWM.' },
      { at: [24, 10.5, 24.5], title: 'Analog pins A0 to A5', text: 'These measure a voltage from 0 to 5 V and report it as a number from 0 to 1023.' },
      { at: [3, 10.5, 24.5], title: 'Power pins', text: '5V, 3.3V and ground for powering your parts.' },
      { at: [-30, 13, -14.5], title: 'USB port', text: 'Uploads your sketch, powers the board, and carries Serial messages back to your computer.' },
      { at: [-29, 13, 18.5], title: 'Barrel jack', text: 'For a 7 to 12 V wall adapter or battery when no computer is attached.' },
      { at: [0, 3, -12], title: 'Built-in LED', text: 'Already wired to pin 13, so you can blink a light with no extra parts.' },
      { at: [-24, 6.5, -22.5], title: 'Reset button', text: 'Restarts your sketch from the top of setup().' },
      { at: [-12, 5.6, 2], title: '16 MHz crystal', text: 'The heartbeat. It ticks 16 million times a second to keep time for delay() and millis().' },
    ],
    demo: {
      label: 'Blink pin 13', start: 0, read: v => (v > 0.5 ? 'digitalWrite(13, HIGH)' : 'digitalWrite(13, LOW)'),
      apply: v => { (ledL.material as THREE.MeshStandardMaterial).emissive.setHex(v > 0.5 ? 0xffb000 : 0x241a00); (ledL.material as THREE.MeshStandardMaterial).emissiveIntensity = v > 0.5 ? 3 : 1; },
    },
  };
}

function esp32(): Model {
  const g = new THREE.Group();
  box(g, 51.5, 1.6, 28, 0x1b1d22, 0, 0.8, 0);
  box(g, 18, 3, 16, STEEL, -13, 3.1, 0, metal);
  box(g, 6, 0.9, 18, 0x1b1d22, -24.5, 2, 0);
  for (let i = 0; i < 5; i++) box(g, 4.6, 0.1, 0.6, GOLD, -24.5, 2.5, -6 + i * 3, metal);
  box(g, 5.6, 2.6, 7.6, STEEL, 23.6, 2.9, 0, metal);
  [-9, 9].forEach(z => { box(g, 4, 1.8, 3, STEEL, 20, 2.5, z, metal); cyl(g, 0.9, 0.8, BLACK, 20, 3.6, z); });
  box(g, 5, 1.6, 5, BLACK, 5, 2.4, 0);
  box(g, 1.4, 0.7, 0.8, 0xff4d4f, 12, 2, -5, { emissive: 0x7a1012 });
  header(g, 15, -17.8, 1.6, -12.7); header(g, 15, -17.8, 1.6, 12.7);
  return {
    group: g,
    callouts: [
      { at: [-13, 5, 0], title: 'ESP32 module', text: 'Under the metal shield: a two-core processor running at 240 MHz, with Wi-Fi and Bluetooth radios.' },
      { at: [-24.5, 3, 0], title: 'Antenna', text: 'The zigzag copper trace sends and receives radio. Keep metal away from it.' },
      { at: [23.6, 4.6, 0], title: 'Micro-USB', text: 'Power and programming.' },
      { at: [20, 4.4, 9], title: 'EN and BOOT buttons', text: 'EN restarts the board. BOOT is held while uploading on some boards.' },
      { at: [0, -3, 12.7], title: 'GPIO pins', text: 'These work at 3.3 V, not 5 V. Many of them can also read analog values from 0 to 4095.' },
    ],
  };
}

export const MODELS: Record<PartType, () => Model> = {
  led, rgb_led: rgbLed, resistor, button, potentiometer, ldr, buzzer, servo, ultrasonic, dht11, lcd, relay, battery, breadboard, uno, esp32,
};
