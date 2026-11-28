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
  /** Called every frame with the seconds since the last one, for parts that move by themselves. */
  tick?: (dt: number) => void;
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
  sticker(g, 20, 12, 30, (c, X, Z) => {
    c.fillStyle = '#f4f6f9'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.fillStyle = '#2563eb'; c.fillRect(0, 0, c.canvas.width, 0.32 * c.canvas.height);
    label(c, 'TOWER PRO', X(0), Z(-4.1), 2.1 * 30, { color: '#fff', weight: 800 });
    label(c, 'SG90', X(0), Z(0.2), 4.2 * 30, { color: '#14213d', weight: 800 });
    label(c, 'MICRO SERVO  9g', X(0), Z(4), 1.5 * 30, { color: '#3b414b', weight: 600 });
  }, 0, 8, 6.12);
  sticker(g, 20, 12, 30, (c, X, Z) => {
    c.fillStyle = '#f4f6f9'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    label(c, 'Operating voltage 4.8 V', X(0), Z(-3), 1.4 * 30, { color: '#3b414b', weight: 500 });
    label(c, 'Torque 1.8 kg·cm', X(0), Z(0), 1.4 * 30, { color: '#3b414b', weight: 500 });
    label(c, 'Speed 0.1 s / 60°', X(0), Z(3), 1.4 * 30, { color: '#3b414b', weight: 500 });
  }, 0, 8, -6.12, { ry: Math.PI });
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
  sticker(g, 45, 20, 24, (c, X, Z) => {
    c.fillStyle = '#1f5fbf'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 5;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(X(-18 + i * 7), Z(9)); c.lineTo(X(-14 + i * 6), Z(-2)); c.lineTo(X(-6 + i * 2.5), Z(-6)); c.stroke(); }
    c.fillStyle = '#17181c'; c.fillRect(X(-9), Z(-3), 18 * 24, 7 * 24);
    label(c, 'HC-SR04', X(0), Z(-6.4), 3.2 * 24, { weight: 800 });
    label(c, 'Vcc  Trig  Echo  Gnd', X(0), Z(7.2), 1.8 * 24, { weight: 600 });
    label(c, 'EM78P153A', X(0), Z(0.5), 1.4 * 24, { color: '#9aa1ab', weight: 500, font: MONO });
  }, 0, 10, -0.81, { ry: Math.PI });
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
  sticker(g, 18.4, 14.4, 30, (c, X, Z) => {
    c.fillStyle = '#2f7de1'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    label(c, 'SONGLE', X(0), Z(-5), 2.4 * 30, { weight: 800 });
    label(c, 'SRD-05VDC-SL-C', X(0), Z(-1.6), 1.7 * 30, { weight: 600 });
    label(c, '10A 250VAC  10A 30VDC', X(0), Z(1.6), 1.2 * 30, { weight: 500 });
    label(c, '10A 125VAC  10A 28VDC', X(0), Z(3.8), 1.2 * 30, { weight: 500 });
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(X(-7.6), Z(5.2), 15.2 * 30, 1.4 * 30);
  }, 2, 17.08, 0, { rx: -Math.PI / 2 });
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
  for (const [z, ry] of [[8.76, 0], [-8.76, Math.PI]]) {
    sticker(g, 26.5, 31, 20, (c, X, Z) => {
      c.fillStyle = '#1b1d22'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      c.fillStyle = '#d97a1f'; c.fillRect(0, Z(9), c.canvas.width, 3 * 20);
      label(c, '9V', X(0), Z(-6), 12 * 20, { weight: 800, color: '#fff', font: FONT });
      label(c, 'ALKALINE', X(0), Z(4), 2.6 * 20, { weight: 700, color: '#fff' });
      label(c, '6LR61  MN1604', X(0), Z(13.4), 1.5 * 20, { weight: 500, color: '#9aa1ab', font: MONO });
    }, 0, 15.5, z, { ry });
  }
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

// ---- Printed surfaces: silkscreen, copper and holes are drawn on canvases ----
const FONT = '"Geist", "Segoe UI", Arial, sans-serif';
const MONO = '"Geist Mono", Consolas, monospace';

/** A canvas texture drawn at `ppm` pixels per millimetre for a surface `w` × `d` mm. */
function printed(w: number, d: number, ppm: number, draw: (c: CanvasRenderingContext2D, X: (x: number) => number, Z: (z: number) => number) => void) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * ppm);
  cv.height = Math.round(d * ppm);
  const c = cv.getContext('2d')!;
  draw(c, x => (x + w / 2) * ppm, z => (z + d / 2) * ppm);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A flat printed label stuck onto a face. `ry` turns it to face sideways or backwards; `rx` lays it flat. */
function sticker(g: THREE.Object3D, w: number, h: number, ppm: number, draw: (c: CanvasRenderingContext2D, X: (x: number) => number, Z: (z: number) => number) => void,
  x: number, y: number, z: number, o: { rx?: number; ry?: number } = {}) {
  const t = printed(w, h, ppm, draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, transparent: true }));
  m.position.set(x, y, z);
  m.rotation.set(o.rx ?? 0, o.ry ?? 0, 0);
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** A box whose top face shows a printed texture; the sides are plain. */
function slab(g: THREE.Object3D, w: number, h: number, d: number, side: number, top: THREE.Texture, x = 0, y = 0, z = 0, o: Opt = {}) {
  const s = mat(side, o);
  const t = new THREE.MeshStandardMaterial({ map: top, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0 });
  return place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [s, s, t, s, s, s]), g, x, y, z, o);
}

function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, o: { rot?: number; align?: CanvasTextAlign; weight?: number; color?: string; font?: string } = {}) {
  c.save();
  c.translate(x, y);
  if (o.rot) c.rotate(o.rot);
  c.fillStyle = o.color ?? '#f3fbfc';
  c.font = `${o.weight ?? 600} ${px}px ${o.font ?? FONT}`;
  c.textAlign = o.align ?? 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 0, 0);
  c.restore();
}

/** Female header socket: black plastic with a square hole for every pin. */
function socket(g: THREE.Object3D, n: number, x: number, z: number, h = 8.5, y0 = 1.6) {
  const w = n * 2.54;
  const top = printed(w, 2.5, 40, (c, X, Z) => {
    c.fillStyle = '#1b1d22'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    for (let i = 0; i < n; i++) {
      const cx = X(-w / 2 + 1.27 + i * 2.54), cz = Z(0), s = 0.95 * 40;
      c.fillStyle = '#050506'; c.fillRect(cx - s / 2, cz - s / 2, s, s);
      c.strokeStyle = '#3a3e45'; c.lineWidth = 3; c.strokeRect(cx - s / 2, cz - s / 2, s, s);
    }
  });
  return slab(g, w, h, 2.5, 0x1b1d22, top, x, y0 + h / 2, z, { rough: 0.7 });
}

/** A DIP chip: body, a leg every 2.54 mm on both long sides, and printed markings. */
function dip(g: THREE.Object3D, pinsPerSide: number, x: number, y: number, z: number, text: string) {
  const w = pinsPerSide * 2.54 + 0.6, d = 6.6, h = 3.4;
  const top = printed(w, d, 30, (c, X, Z) => {
    c.fillStyle = '#17181c'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.fillStyle = '#0b0c0e'; c.beginPath(); c.arc(X(-w / 2), Z(0), 1.1 * 30, -Math.PI / 2, Math.PI / 2); c.fill();
    c.beginPath(); c.arc(X(-w / 2 + 2.2), Z(1.9), 0.55 * 30, 0, Math.PI * 2); c.fill();
    label(c, text, X(0.6), Z(-0.6), 1.5 * 30, { color: '#c9ced6', weight: 600 });
    label(c, 'ATMEL  1846  MYS', X(0.6), Z(1.4), 0.9 * 30, { color: '#8b9099', weight: 500, font: MONO });
  });
  slab(g, w, h, d, 0x17181c, top, x, y + h / 2, z, { rough: 0.45 });
  for (let i = 0; i < pinsPerSide; i++) {
    const lx = x - w / 2 + 1.57 + i * 2.54;
    for (const sz of [-1, 1]) {
      box(g, 0.5, 0.25, 1.1, STEEL, lx, y + 1.6, z + sz * (d / 2 + 0.5), metal);
      box(g, 0.5, 2.4, 0.25, STEEL, lx, y + 0.4, z + sz * (d / 2 + 1), metal);
    }
  }
}

function breadboard(): Model {
  const g = new THREE.Group();
  const W = 83, D = 55;
  const rows = [-24.4, -21.9, -14, -11.5, -9, -6.5, -4, 4, 6.5, 9, 11.5, 14, 21.9, 24.4];
  const top = printed(W, D, 18, (c, X, Z) => {
    c.fillStyle = '#f6f4ee'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    // centre channel
    const grad = c.createLinearGradient(0, Z(-1.5), 0, Z(1.5));
    grad.addColorStop(0, '#d9d4c6'); grad.addColorStop(0.5, '#c9c3b2'); grad.addColorStop(1, '#d9d4c6');
    c.fillStyle = grad; c.fillRect(0, Z(-1.5), c.canvas.width, Z(1.5) - Z(-1.5));
    // rail stripes
    for (const [z, col] of [[-26.2, '#e5383b'], [-20.1, '#2563eb'], [20.1, '#e5383b'], [26.2, '#2563eb']] as const) {
      c.fillStyle = col; c.fillRect(X(-38), Z(z) - 4, X(38) - X(-38), 8);
    }
    // holes
    for (let col = 0; col < 30; col++) for (const z of rows) {
      const cx = X(-36.8 + col * 2.54), cz = Z(z), s = 1.15 * 18;
      c.fillStyle = '#e4e0d4'; c.fillRect(cx - s / 2 - 3, cz - s / 2 - 3, s + 6, s + 6);
      c.fillStyle = '#2a2d33'; c.fillRect(cx - s / 2, cz - s / 2, s, s);
      c.fillStyle = '#4a4e57'; c.fillRect(cx - s / 2, cz + s / 2 - 4, s, 4);
    }
    // numbers and letters
    for (let col = 0; col < 30; col++) {
      const n = col + 1;
      if (n === 1 || n % 5 === 0) {
        label(c, String(n), X(-36.8 + col * 2.54), Z(-16.6), 22, { color: '#8a8f98', weight: 500 });
        label(c, String(n), X(-36.8 + col * 2.54), Z(16.6), 22, { color: '#8a8f98', weight: 500 });
      }
    }
    'abcde'.split('').forEach((r, i) => { label(c, r, X(-39.6), Z(rows[2 + i]), 22, { color: '#8a8f98', weight: 500 }); label(c, r, X(39.6), Z(rows[2 + i]), 22, { color: '#8a8f98', weight: 500 }); });
    'fghij'.split('').forEach((r, i) => { label(c, r, X(-39.6), Z(rows[7 + i]), 22, { color: '#8a8f98', weight: 500 }); label(c, r, X(39.6), Z(rows[7 + i]), 22, { color: '#8a8f98', weight: 500 }); });
    for (const [z, s, col] of [[-26.2, '+', '#e5383b'], [-20.1, '−', '#2563eb'], [20.1, '+', '#e5383b'], [26.2, '−', '#2563eb']] as const) {
      label(c, s, X(-39.8), Z(z), 34, { color: col, weight: 700 });
    }
  });
  const body = slab(g, W, 9.5, D, 0xf1eee6, top, 0, 4.75, 0, { rough: 0.8 });
  box(g, W - 1, 0.6, D - 1, 0xe2ddd0, 0, 0.3, 0, { rough: 0.9 });
  const strip = box(g, 0.9, 6, 11.4, GOLD, -11.4, 5, -9, { ...metal, opacity: 0.001 });
  const strip2 = box(g, 0.9, 6, 11.4, GOLD, 13.4, 5, 9, { ...metal, opacity: 0.001 });
  const rail = box(g, 76, 6, 0.9, GOLD, 0, 5, -24.4, { ...metal, opacity: 0.001 });
  return {
    group: g,
    callouts: [
      { at: [-11.4, 9.8, -9], title: 'Terminal strip', text: 'Each column of five holes is one metal clip. Legs pushed into the same column are connected.' },
      { at: [10, 9.8, -24.4], title: 'Power rails', text: 'The long rows by the red and blue lines are joined end to end. Use them for 5V and ground.' },
      { at: [24, 9.8, 0], title: 'Centre gap', text: 'Splits the board in two. Chips and buttons sit across it so their sides stay separate.' },
    ],
    demo: {
      label: 'X-ray view', start: 0, read: v => (v > 0.5 ? 'showing the metal clips inside' : 'solid'),
      apply: v => {
        const x = v > 0.5;
        const mats = body.material as THREE.MeshStandardMaterial[];
        mats.forEach(m => { m.transparent = true; m.opacity = x ? 0.3 : 1; m.depthWrite = !x; });
        [strip, strip2, rail].forEach(s => { (s.material as THREE.MeshStandardMaterial).opacity = x ? 1 : 0.001; });
      },
    },
  };
}

function uno(): Model {
  const g = new THREE.Group();
  const W = 68.6, D = 53.4;
  // Pin x-positions on the headers (mm from board centre)
  const hdr = (cx: number, n: number) => Array.from({ length: n }, (_, i) => cx - (n * 2.54) / 2 + 1.27 + i * 2.54);
  const dig1 = hdr(-4.5, 10), dig2 = hdr(21.5, 8), pow = hdr(3, 8), ana = hdr(24, 6);
  const holes: [number, number][] = [[-19.1, -24.15], [31.8, -8.85], [31.8, 19.05], [-20.3, 24.1]];

  const pcb = printed(W, D, 20, (c, X, Z) => {
    const grad = c.createLinearGradient(0, 0, c.canvas.width, c.canvas.height);
    grad.addColorStop(0, '#0a7380'); grad.addColorStop(1, '#075a65');
    c.fillStyle = grad; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    // copper traces under the solder mask
    c.strokeStyle = 'rgba(120, 220, 230, 0.18)'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
    const trace = (pts: number[][]) => { c.beginPath(); pts.forEach(([x, z], i) => (i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)))); c.stroke(); };
    dig1.slice(4).forEach((x, i) => trace([[x, -22], [x, -18 + i * 0.6], [-6 + i * 2.54, 6], [-6 + i * 2.54, 8.2]]));
    dig2.forEach((x, i) => trace([[x, -22], [x, -16], [14 + i * 1.2, 4], [14 + i * 1.2, 8.2]]));
    ana.forEach((x, i) => trace([[x, 22], [x, 19], [10 + i * 2.54, 17], [10 + i * 2.54, 15.8]]));
    trace([[-30, -8], [-22, -8], [-14, -2], [-12, 2]]);
    trace([[-28, 12], [-20, 12], [-12, 16], [-8, 16]]);
    c.lineWidth = 14; trace([[-22, 20], [-10, 20], [-6, 22]]);
    // ground pour vias
    c.fillStyle = 'rgba(200, 245, 250, 0.35)';
    for (let i = 0; i < 18; i++) { const x = -10 + (i % 6) * 6.2, z = -10 + Math.floor(i / 6) * 5.5; c.beginPath(); c.arc(X(x), Z(z), 5, 0, Math.PI * 2); c.fill(); }
    // mounting holes
    for (const [x, z] of holes) {
      c.fillStyle = '#d8dde3'; c.beginPath(); c.arc(X(x), Z(z), 2.6 * 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0a2f33'; c.beginPath(); c.arc(X(x), Z(z), 1.6 * 20, 0, Math.PI * 2); c.fill();
    }
    // silkscreen
    c.strokeStyle = '#f3fbfc'; c.lineWidth = 4;
    c.strokeRect(X(-17.6), Z(-26.2), X(8.2) - X(-17.6), Z(-22.8) - Z(-26.2));
    c.strokeRect(X(11.3), Z(-26.2), X(31.7) - X(11.3), Z(-22.8) - Z(-26.2));
    c.strokeRect(X(-7.2), Z(22.8), X(13.2) - X(-7.2), Z(26.2) - Z(22.8));
    c.strokeRect(X(16.4), Z(22.8), X(31.6) - X(16.4), Z(26.2) - Z(22.8));
    const dn = ['SCL', 'SDA', 'AREF', 'GND', '13', '12', '~11', '~10', '~9', '8'];
    dig1.forEach((x, i) => label(c, dn[i], X(x), Z(-21.6), 26, { rot: -Math.PI / 2, align: 'right' }));
    ['7', '~6', '~5', '4', '~3', '2', 'TX→1', 'RX←0'].forEach((t, i) => label(c, t, X(dig2[i]), Z(-21.6), 26, { rot: -Math.PI / 2, align: 'right' }));
    ['', 'IOREF', 'RESET', '3.3V', '5V', 'GND', 'GND', 'Vin'].forEach((t, i) => label(c, t, X(pow[i]), Z(21.6), 26, { rot: -Math.PI / 2, align: 'left' }));
    ana.forEach((x, i) => label(c, `A${i}`, X(x), Z(21.6), 26, { rot: -Math.PI / 2, align: 'left' }));
    label(c, 'DIGITAL (PWM~)', X(14), Z(-14.4), 40, { weight: 700 });
    label(c, 'POWER', X(3), Z(15.6), 34, { weight: 700 });
    label(c, 'ANALOG IN', X(24), Z(15.6), 34, { weight: 700 });
    // logo
    c.lineWidth = 9; c.strokeStyle = '#f3fbfc';
    c.beginPath(); c.arc(X(4.2), Z(-5.5), 2.4 * 20, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(X(9.4), Z(-5.5), 2.4 * 20, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#f3fbfc'; c.fillRect(X(3.2), Z(-5.5) - 4, 40, 8); c.fillRect(X(8.4), Z(-5.5) - 4, 40, 8); c.fillRect(X(9.4) - 4, Z(-6.5), 8, 40);
    label(c, 'UNO', X(22), Z(-5.5), 120, { weight: 800, font: FONT });
    label(c, 'ARDUINO', X(6.8), Z(-1.6), 44, { weight: 800 });
    label(c, 'L', X(0), Z(-14.8), 28); label(c, 'TX', X(-3), Z(-9.7), 24); label(c, 'RX', X(3), Z(-9.7), 24); label(c, 'ON', X(22), Z(-7.6), 28);
    label(c, 'RESET', X(-24), Z(-18.4), 26);
    label(c, 'ICSP', X(31.8), Z(-1.4), 26, { rot: -Math.PI / 2 });
    label(c, 'MADE IN ITALY', X(-12), Z(-5.5), 22, { weight: 500 });
  });
  slab(g, W, 1.6, D, 0x0c6c77, pcb, 0, 0.8, 0, { rough: 0.78 });

  // Ports
  box(g, 16, 11, 12, STEEL, -30.3, 7.1, -14.5, { metal: 0.9, rough: 0.25 });
  box(g, 0.6, 7.4, 8.4, 0x2b2f36, -38.35, 7.1, -14.5);
  box(g, 0.7, 4.6, 5.4, 0xe8e2d0, -38.4, 7.1, -14.5, { rough: 0.6 });
  box(g, 14, 11, 9, 0x1b1d22, -29.2, 7.1, 18.5, { rough: 0.6 });
  cyl(g, 3.1, 1, 0x050506, -36.25, 7.6, 18.5, { rz: Math.PI / 2 });
  cyl(g, 1, 1.2, 0xd4d8de, -36.2, 7.6, 18.5, { rz: Math.PI / 2, ...metal });

  // Headers
  socket(g, 10, -4.5, -24.5); socket(g, 8, 21.5, -24.5); socket(g, 8, 3, 24.5); socket(g, 6, 24, 24.5);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) box(g, 0.64, 6, 0.64, GOLD, 30.5 + r * 2.54, 4.6, -2.5 + k * 2.54, metal);
  box(g, 5.1, 2.5, 7.6, 0x1b1d22, 31.8, 2.85, 0);

  // Chips and small parts
  socket(g, 14, 9, 12, 1.6).scale.set(1, 1, 3.2);
  dip(g, 14, 9, 3.2, 12, 'ATMEGA328P-PU');
  const qfn = printed(5, 5, 40, (c, X, Z) => { c.fillStyle = '#17181c'; c.fillRect(0, 0, 200, 200); label(c, '16U2', X(0), Z(0), 46, { color: '#aeb4bd', font: MONO }); c.fillStyle = '#555'; c.beginPath(); c.arc(X(-1.8), Z(-1.8), 8, 0, 7); c.fill(); });
  slab(g, 5, 1, 5, 0x17181c, qfn, -19, 2.1, -4);
  const xtal = place(new THREE.Mesh(new THREE.CapsuleGeometry(1.9, 6.6, 8, 24), mat(0xd4d8de, { metal: 0.9, rough: 0.2 })), g, -12, 3.2, 3, { rz: Math.PI / 2 });
  xtal.scale.set(1, 1, 0.7);
  [[-15.5, 18.6], [-20.5, 9.8]].forEach(([x, z]) => {
    cyl(g, 3.15, 5.6, 0x1f2a44, x, 4.4, z, { rough: 0.4 });
    cyl(g, 3.0, 0.2, 0xb8bec6, x, 7.25, z, metal);
    box(g, 6, 0.05, 0.4, 0x8a9099, x, 7.37, z, metal); box(g, 0.4, 0.05, 6, 0x8a9099, x, 7.37, z, metal);
  });
  box(g, 6.6, 2.4, 6.2, 0x1b1d22, -23.5, 2.8, 2.5);
  box(g, 6.6, 0.4, 3.4, STEEL, -23.5, 2, -1.9, metal);
  box(g, 6, 3.4, 6, STEEL, -24, 3.3, -22.3, metal);
  cyl(g, 1.6, 1.4, 0xe5383b, -24, 5.6, -22.3, { rough: 0.35 });
  for (const [x, z] of [[-6, 3], [-4, 3], [6, 0.5], [26, 2], [-14, -14]]) box(g, 1.6, 0.6, 0.8, x === -14 ? 0x8a6d3b : 0x2f3238, x, 1.9, z);
  const ledL = box(g, 1.6, 0.8, 0.9, 0xf6b300, 0, 2, -12, { emissive: 0x7a5800 });
  box(g, 1.6, 0.8, 0.9, 0xf6b300, -3, 2, -12, { emissive: 0x3a2a00 }); box(g, 1.6, 0.8, 0.9, 0xf6b300, 3, 2, -12, { emissive: 0x3a2a00 });
  box(g, 1.6, 0.8, 0.9, 0x3dff8b, 22, 2, -5, { emissive: 0x0d7a3a });
  return {
    group: g,
    callouts: [
      { at: [9, 7, 12], title: 'Microcontroller (ATmega328P)', text: 'The actual computer. Your whole sketch lives in this one chip: 32 KB of storage, 2 KB of memory.' },
      { at: [8, 10.5, -24.5], title: 'Digital pins 0 to 13', text: 'Each can be switched to 5 V or 0 V, or read as HIGH or LOW. The ones marked ~ can fade with PWM.' },
      { at: [24, 10.5, 24.5], title: 'Analog pins A0 to A5', text: 'These measure a voltage from 0 to 5 V and report it as a number from 0 to 1023.' },
      { at: [3, 10.5, 24.5], title: 'Power pins', text: '5V, 3.3V and ground for powering your parts.' },
      { at: [-30, 13, -14.5], title: 'USB port', text: 'Uploads your sketch, powers the board, and carries Serial messages back to your computer.' },
      { at: [-29, 13, 18.5], title: 'Barrel jack', text: 'For a 7 to 12 V wall adapter or battery when no computer is attached.' },
      { at: [0, 3, -12], title: 'Built-in LED', text: 'Already wired to pin 13, so you can blink a light with no extra parts.' },
      { at: [-24, 6.5, -22.3], title: 'Reset button', text: 'Restarts your sketch from the top of setup().' },
      { at: [-12, 5.2, 3], title: '16 MHz crystal', text: 'The heartbeat. It ticks 16 million times a second to keep time for delay() and millis().' },
      { at: [-15.5, 7.6, 18.6], title: 'Capacitors', text: 'Tiny charge tanks that smooth out the power, so the chip never sees a dip in voltage.' },
    ],
    demo: {
      label: 'Blink pin 13', start: 0, read: v => (v > 0.5 ? 'digitalWrite(13, HIGH)' : 'digitalWrite(13, LOW)'),
      apply: v => { (ledL.material as THREE.MeshStandardMaterial).emissive.setHex(v > 0.5 ? 0xffb000 : 0x241a00); (ledL.material as THREE.MeshStandardMaterial).emissiveIntensity = v > 0.5 ? 3 : 1; },
    },
  };
}

function esp32(): Model {
  const g = new THREE.Group();
  const W = 51.5, D = 28;
  const left = ['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND', 'VIN'];
  const right = ['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND', '3V3'];
  const px = (i: number) => -17.8 + i * 2.54;
  const pcb = printed(W, D, 20, (c, X, Z) => {
    c.fillStyle = '#16181d'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 6;
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(X(px(i * 1.6)), Z(-11)); c.lineTo(X(px(i * 1.6) + 3), Z(-4)); c.lineTo(X(8 + i), Z(-1)); c.stroke(); }
    for (let i = 0; i < 15; i++) {
      for (const [z, names] of [[-12.7, right], [12.7, left]] as const) {
        c.fillStyle = '#c9a227'; c.beginPath(); c.arc(X(px(i)), Z(z), 0.95 * 20, 0, 7); c.fill();
        c.fillStyle = '#0d0e11'; c.beginPath(); c.arc(X(px(i)), Z(z), 0.5 * 20, 0, 7); c.fill();
        label(c, names[14 - i] ?? '', X(px(i)), Z(z > 0 ? 9.6 : -9.6), 22, { rot: -Math.PI / 2, align: z > 0 ? 'left' : 'right', color: '#e8eaee', weight: 500 });
      }
    }
    label(c, 'ESP32 DEVKIT V1', X(12), Z(0), 40, { weight: 700, color: '#e8eaee' });
    label(c, 'EN', X(20), Z(-5.2), 26, { color: '#e8eaee' }); label(c, 'BOOT', X(20), Z(5.2), 26, { color: '#e8eaee' });
  });
  slab(g, W, 1.6, D, 0x101215, pcb, 0, 0.8, 0, { rough: 0.72 });
  // Module: blue-black plate with printed antenna, metal shield on top
  const plate = printed(25.5, 18, 30, (c, X, Z) => {
    c.fillStyle = '#1d2230'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.strokeStyle = '#d8b13a'; c.lineWidth = 0.55 * 30; c.lineJoin = 'miter';
    c.beginPath(); c.moveTo(X(-6.5), Z(7.5));
    let x = -6.5;
    for (let i = 0; i < 5; i++) { c.lineTo(X(x), Z(-7)); x -= 1.1; c.lineTo(X(x), Z(-7)); c.lineTo(X(x), Z(6.5)); x -= 1.1; c.lineTo(X(x), Z(6.5)); }
    c.stroke();
    c.fillStyle = '#c9a227';
    for (let i = 0; i < 13; i++) { c.fillRect(X(-5 + i * 1.27) - 6, 0, 12, 24); c.fillRect(X(-5 + i * 1.27) - 6, c.canvas.height - 24, 12, 24); }
  });
  slab(g, 25.5, 0.8, 18, 0x1d2230, plate, -12, 2, 0);
  const shield = printed(17.6, 15.6, 30, (c, X, Z) => {
    const grad = c.createLinearGradient(0, 0, c.canvas.width, c.canvas.height);
    grad.addColorStop(0, '#e6e9ed'); grad.addColorStop(1, '#b7bdc5');
    c.fillStyle = grad; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    label(c, 'ESP-WROOM-32', X(0), Z(-3.4), 1.9 * 30, { color: '#3b414b', weight: 700 });
    label(c, 'Wi-Fi + BT + BLE', X(0), Z(-0.4), 1.2 * 30, { color: '#555c67', weight: 500 });
    label(c, 'FCC ID: 2AC7Z-ESPWROOM32', X(0), Z(2.4), 0.9 * 30, { color: '#6a717c', weight: 500, font: MONO });
    c.strokeStyle = '#6a717c'; c.lineWidth = 3; c.strokeRect(X(-7.6), Z(4.4), 34, 34);
    label(c, 'CE', X(-2), Z(5.2), 1.4 * 30, { color: '#555c67', weight: 700 });
  });
  slab(g, 17.6, 2.6, 15.6, 0xc9ced6, shield, -8.4, 3.7, 0, { metal: 0.9, rough: 0.3 });
  // USB, buttons, regulator, LEDs
  box(g, 5.8, 2.8, 7.8, STEEL, 23.4, 3, 0, { metal: 0.9, rough: 0.25 });
  box(g, 0.4, 1.6, 6.2, 0x16181d, 26.3, 3, 0);
  [-7.6, 7.6].forEach(z => { box(g, 4.2, 1.6, 3.2, STEEL, 19.8, 2.4, z, metal); cyl(g, 0.9, 1, 0x1b1d22, 19.8, 3.6, z); });
  box(g, 3.2, 1.4, 3.6, 0x1b1d22, 12, 2.3, -6.5); box(g, 3, 0.3, 1.6, STEEL, 12, 1.75, -8.8, metal);
  box(g, 4, 1.2, 4, 0x1b1d22, 6, 2.2, 6);
  box(g, 1.4, 0.7, 0.8, 0xff4d4f, 15.5, 1.95, 3, { emissive: 0x7a1012 });
  box(g, 1.4, 0.7, 0.8, 0x4f8cff, 15.5, 1.95, -3, { emissive: 0x10307a });
  // Pins hang below the board through black spacers
  for (const z of [-12.7, 12.7]) { header(g, 15, -17.8, 0, z); box(g, 38.1, 2.5, 2.5, 0x1b1d22, 0, -1.25, z); }
  return {
    group: g,
    callouts: [
      { at: [-8.4, 5.2, 0], title: 'ESP32 module', text: 'Under the metal shield: a two-core processor running at 240 MHz, with Wi-Fi and Bluetooth radios.' },
      { at: [-21.5, 2.6, 0], title: 'Antenna', text: 'The zigzag copper trace sends and receives radio. Keep metal away from it.' },
      { at: [23.4, 4.6, 0], title: 'Micro-USB', text: 'Power and programming.' },
      { at: [19.8, 4.3, 7.6], title: 'EN and BOOT buttons', text: 'EN restarts the board. BOOT is held while uploading on some boards.' },
      { at: [0, -3, 12.7], title: 'GPIO pins', text: 'These work at 3.3 V, not 5 V. Many of them can also read analog values from 0 to 4095.' },
    ],
  };
}

// ---- Analog parts and instruments ----

function capacitor(): Model {
  const g = new THREE.Group();
  const R = 4, H = 11;
  const skin = printed(2 * Math.PI * R, H, 26, c => {
    const w = c.canvas.width, h = c.canvas.height;
    const grad = c.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a5bc4'); grad.addColorStop(1, '#1d4499');
    c.fillStyle = grad; c.fillRect(0, 0, w, h);
    // The stripe wraps across u = 0, which faces the front, right above the minus leg.
    c.fillStyle = '#d6dfee'; c.fillRect(0, 0, w * 0.085, h); c.fillRect(w * 0.915, 0, w * 0.085, h);
    for (let i = 0; i < 4; i++) { c.fillStyle = '#1d3f8c'; c.fillRect(w * 0.955, h * (0.18 + i * 0.19), w * 0.08, h * 0.04); c.fillRect(-w * 0.045, h * (0.18 + i * 0.19), w * 0.08, h * 0.04); }
    label(c, '100µF', w * 0.25, h * 0.38, h * 0.16, { weight: 800 });
    label(c, '25V', w * 0.25, h * 0.58, h * 0.13, { weight: 700 });
    label(c, '105°C', w * 0.25, h * 0.76, h * 0.09, { weight: 600, color: '#c9d6f2' });
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true), new THREE.MeshStandardMaterial({ map: skin, roughness: 0.45 }));
  place(body, g, 0, H / 2 + 0.6, 0);
  cyl(g, R * 0.99, 0.5, 0xc5ccd4, 0, H + 0.6, 0, { metal: 0.85, rough: 0.35 });
  for (const ry of [0, Math.PI / 2, Math.PI / 4]) box(g, R * 1.3, 0.1, 0.25, 0x6b7480, 0, H + 0.9, 0, { ry, metal: 0.6 });
  cyl(g, R * 0.95, 0.6, 0x1b1d22, 0, 0.3, 0);
  leg(g, 0, -1.25, 14, 0.6);
  leg(g, 0, 1.25, 11, 0.6);
  return {
    group: g,
    callouts: [
      { at: [0, 6, 4.1], title: 'Minus stripe', text: 'The pale stripe with − signs marks the negative leg. Get this the wrong way round and a real one can pop.' },
      { at: [0, -12.5, -1.25], title: 'Positive leg (longer)', text: 'The long leg goes toward the + side of the circuit.' },
      { at: [0, 11.9, 0], title: 'Safety vent', text: 'The cuts in the top let gas escape safely if the capacitor is ever overloaded.' },
      { at: [4.1, 10, 0], title: 'Rolled foil inside', text: 'Two long strips of aluminium foil, separated by paper soaked in a chemical, are rolled up tight. More foil area stores more charge.' },
    ],
  };
}

function diode(): Model {
  const g = new THREE.Group();
  const o = { rz: Math.PI / 2 };
  cyl(g, 1.35, 5.2, 0x17181c, 0, 0, 0, { ...o, rough: 0.35 });
  cyl(g, 1.38, 0.8, 0xd4d9e0, 1.8, 0, 0, { ...o, metal: 0.4, rough: 0.4 });
  cyl(g, 0.3, 26, STEEL, 0, 0, 0, { ...o, ...metal });
  return {
    group: g,
    callouts: [
      { at: [1.8, 1.6, 0], title: 'Cathode band', text: 'The stripe marks the end current flows out of. Current can go toward the stripe, never away from it.' },
      { at: [-9, 0, 0], title: 'Anode lead', text: 'Connect this end toward the positive side.' },
      { at: [-0.8, 1.5, 0], title: 'Silicon chip inside', text: 'A tiny piece of silicon with a P side and an N side. Where they meet, current can only cross one way.' },
    ],
  };
}

function npn(): Model {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 4.8, 48, 1, false, Math.PI / 2, Math.PI), mat(0x17181c, { rough: 0.4 }));
  place(body, g, 0, 2.4, 0);
  sticker(g, 4.9, 4.8, 60, (c, X, Z) => {
    c.fillStyle = '#17181c'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    label(c, '2N', X(0), Z(-1.3), 1.1 * 60, { color: '#d4d9e0', weight: 700 });
    label(c, '2222A', X(0), Z(0.1), 1.0 * 60, { color: '#d4d9e0', weight: 700 });
    label(c, 'E  B  C', X(0), Z(1.6), 0.7 * 60, { color: '#8b9099', weight: 600 });
  }, 0, 2.4, 0.01);
  [-1.27, 0, 1.27].forEach(x => leg(g, x, 0, 12.5));
  return {
    group: g,
    callouts: [
      { at: [-1.27, -11, 0.4], title: 'Emitter', text: 'Where both currents leave. Connect it to ground.' },
      { at: [0, -8, 0.4], title: 'Base', text: 'The control. A small current in here switches the big current on.' },
      { at: [1.27, -11, 0.4], title: 'Collector', text: 'The big current comes in here, from the motor or lamp you are switching.' },
      { at: [0, 3.6, 0.1], title: 'Flat face', text: 'Hold the flat side toward you, legs down, and the pins read E, B, C from left to right.' },
      { at: [0, 4.9, -1.2], title: 'Three layers of silicon', text: 'Inside, a thin P-type layer is sandwiched between two N-type layers. That sandwich is what makes it NPN.' },
    ],
  };
}

function motor(): Model {
  const g = new THREE.Group();
  const o = { rz: Math.PI / 2 };
  cyl(g, 10, 25, 0xc9ced6, 0, 10, 0, { ...o, metal: 0.9, rough: 0.28 });
  cyl(g, 10.05, 0.8, 0x8f99a4, 4, 10, 0, { ...o, metal: 0.9, rough: 0.3 });
  cyl(g, 9.6, 5, 0x1b1d22, -14.5, 10, 0, { ...o, rough: 0.6 });
  cyl(g, 3, 1.4, 0xc9ced6, 12.9, 10, 0, { ...o, ...metal });
  cyl(g, 0.9, 9, STEEL, 17, 10, 0, { ...o, ...metal });
  for (const z of [-4, 4]) box(g, 1.4, 3.5, 2, 0xc9a227, -17.4, 12.5, z, metal);
  const curve = (z: number, color: number) => {
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-17.4, 14, z), new THREE.Vector3(-21, 15, z * 1.6), new THREE.Vector3(-26, 3, z * 2.4), new THREE.Vector3(-32, 0.6, z * 2.8)]);
    place(new THREE.Mesh(new THREE.TubeGeometry(path, 32, 0.7, 10, false), mat(color, { rough: 0.5 })), g, 0, 0, 0);
  };
  curve(-4, 0x22262e); curve(4, 0xe5383b);
  const prop = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const holder = new THREE.Group();
    holder.rotation.x = (i * 2 * Math.PI) / 3;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1, 13, 4.2), mat(0xf4f6f9, { rough: 0.45 }));
    blade.position.set(0, 7.6, 0);
    blade.rotation.y = 0.4;
    holder.add(blade);
    prop.add(holder);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3, 32), mat(0xe5383b, { rough: 0.4 }));
  hub.rotation.z = Math.PI / 2;
  prop.add(hub);
  place(prop, g, 21, 10, 0);
  let speed = 0;
  return {
    group: g,
    callouts: [
      { at: [0, 20.5, 0], title: 'Steel can with magnets', text: 'Two curved magnets are glued inside the can. They push against the spinning coils.' },
      { at: [-14.5, 18, 0], title: 'Brushes and contacts', text: 'Inside the black end cap, little springy brushes feed current to the spinning coils and flip its direction every half turn, so the push never stops.' },
      { at: [-17.4, 15, 4], title: 'Terminals', text: 'Current goes in one tab and out the other. Swap them and the motor turns the other way.' },
      { at: [21, 19, 0], title: 'Propeller', text: 'The shaft spins thousands of times a minute. The faster the current, the faster it turns.' },
    ],
    demo: { label: 'Voltage across the motor', start: 0.5, read: v => `${(v * 6).toFixed(1)} V`, apply: v => { speed = v * 14; } },
    tick: dt => { prop.rotation.x += speed * dt; },
  };
}

const DIGITS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];

function seg7(): Model {
  // Built in its own group, turned to face the default camera so the digit reads upright.
  const g = new THREE.Group();
  const turn = 0.74;
  const inner = new THREE.Group();
  inner.rotation.y = turn;
  g.add(inner);
  const at = (x: number, y: number, z: number): [number, number, number] =>
    [x * Math.cos(turn) + z * Math.sin(turn), y, -x * Math.sin(turn) + z * Math.cos(turn)];
  const face = printed(12.6, 19, 40, c => { c.fillStyle = '#26282d'; c.fillRect(0, 0, c.canvas.width, c.canvas.height); });
  slab(inner, 12.6, 8, 19, 0xe9edf2, face, 0, 4 + 1.5, 0, { rough: 0.6 });
  // segments a..g and the decimal point, slightly slanted like a real display
  const lay: [number, number, number, number][] = [
    [0, -5.75, 5.6, 1.2], [3.1, -2.9, 1.2, 5.0], [3.1, 2.9, 1.2, 5.0], [0, 5.75, 5.6, 1.2], [-3.1, 2.9, 1.2, 5.0], [-3.1, -2.9, 1.2, 5.0], [0, 0, 5.6, 1.2], [4.6, 6.3, 1.2, 1.2],
  ];
  const segs = lay.map(([x, z, w, d]) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.5, emissive: 0x000000 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), m);
    mesh.position.set(x - z * 0.12, 9.6, z);
    mesh.rotation.y = w < d ? -0.12 : 0; // lean the uprights with the italic slant
    inner.add(mesh);
    return m;
  });
  for (let i = 0; i < 5; i++) for (const z of [-7.62, 7.62]) box(inner, 0.5, 6, 0.3, STEEL, -5.08 + i * 2.54, -1.5, z, metal);
  const show = (digit: number) => segs.forEach((m, i) => {
    const on = i < 7 ? (DIGITS[digit] >> i) & 1 : 0;
    m.color.setHex(on ? 0x4a0603 : 0x3a3d44);
    m.emissive.setHex(on ? 0xff1606 : 0x000000);
    m.emissiveIntensity = on ? 1.15 : 0;
    m.roughness = on ? 0.9 : 0.5;
  });
  return {
    group: g,
    callouts: [
      { at: at(0, 9.8, -5.75), title: 'Segment a', text: 'Each bar is its own LED. They are named a to g, starting at the top and going clockwise, with g in the middle.' },
      { at: at(0, 9.8, 0), title: 'Segment g', text: 'The middle bar. Turning it on or off is the only difference between 0 and 8.' },
      { at: at(4.6, 9.8, 6.3), title: 'Decimal point', text: 'An eighth LED, for showing numbers like 3.5.' },
      { at: at(0, -3, 7.62), title: 'Ten pins', text: 'Five on each edge. The middle pin of each row is the shared negative (common cathode).' },
    ],
    demo: { label: 'Show a digit', start: 8 / 9, read: v => `digit ${Math.round(v * 9)}`, apply: v => show(Math.round(v * 9)) },
  };
}

function slideSwitch(): Model {
  const g = new THREE.Group();
  box(g, 8.6, 3.6, 4.4, 0xc9ced6, 0, 1.8 + 0.4, 0, { metal: 0.8, rough: 0.35 });
  box(g, 5.2, 0.2, 1.4, 0x17181c, 0, 4.1, 0);
  const knob = box(g, 1.6, 2.6, 1.8, 0xf4f6f9, -1.3, 5.2, 0, { rough: 0.5 });
  [-2.54, 0, 2.54].forEach(x => leg(g, x, 0, 4, 0.4));
  return {
    group: g,
    callouts: [
      { at: [-1.3, 6.6, 0], title: 'Slider', text: 'Push it left or right. It stays where you leave it.' },
      { at: [0, -3.5, 0], title: 'Middle pin', text: 'This pin is joined to whichever side the slider points to.' },
      { at: [3.6, 2.4, 2.3], title: 'Metal shell', text: 'Inside, a springy metal contact slides along with the knob, bridging the middle pin to one side.' },
    ],
    demo: {
      label: 'Slide it', start: 0, read: v => (v > 0.5 ? 'middle joined to the right pin' : 'middle joined to the left pin'),
      apply: v => { knob.position.x = v > 0.5 ? 1.3 : -1.3; },
    },
  };
}

const METER_LABELS: Record<string, [string, string]> = { V: ['DC', 'V'], A: ['DC', 'mA'], 'Ω': ['', 'Ω'] };

function multimeter(): Model {
  const g = new THREE.Group();
  const W = 76, D = 150;
  let mode = 'V';
  const cv = document.createElement('canvas');
  cv.width = W * 8; cv.height = D * 8;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const X = (x: number) => (x + W / 2) * 8, Z = (z: number) => (z + D / 2) * 8;
  const draw = () => {
    const c = cv.getContext('2d')!;
    c.fillStyle = '#f2b705'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#23262c'; c.beginPath(); c.roundRect(X(-32), Z(-68), 64 * 8, 136 * 8, 40); c.fill();
    c.fillStyle = '#0b0c0e'; c.fillRect(X(-26), Z(-62), 52 * 8, 30 * 8);
    c.fillStyle = '#d3e0b8'; c.fillRect(X(-23), Z(-59), 46 * 8, 24 * 8);
    const [kind, unit] = METER_LABELS[mode];
    label(c, kind, X(-19), Z(-55), 3.2 * 8, { color: '#2b3320', weight: 700, align: 'left' });
    label(c, unit, X(19), Z(-55), 4 * 8, { color: '#2b3320', weight: 700, align: 'right' });
    label(c, mode === 'V' ? '4.98' : mode === 'A' ? '14.2' : '220', X(19), Z(-44), 13 * 8, { color: '#1c2410', weight: 600, align: 'right', font: MONO });
    label(c, 'XL-1000  DIGITAL MULTIMETER', X(0), Z(-26), 3 * 8, { color: '#e8eaee', weight: 700 });
    const ring: [string, number][] = [['V', -45], ['mA', 0], ['Ω', 45], ['OFF', 180]];
    for (const [t, a] of ring) {
      const r = (a * Math.PI) / 180;
      const on = (t === 'mA' && mode === 'A') || t === mode;
      label(c, t, X(23 * Math.sin(r)), Z(10 - 23 * Math.cos(r)), 5 * 8, { color: on ? '#f2b705' : '#e8eaee', weight: 700 });
    }
    label(c, 'COM', X(-14), Z(48), 3.4 * 8, { color: '#e8eaee', weight: 700 });
    label(c, 'VΩmA', X(14), Z(48), 3.4 * 8, { color: '#e8eaee', weight: 700 });
    tex.needsUpdate = true;
  };
  draw();
  slab(g, W, 30, D, 0xf2b705, tex, 0, 15, 0, { rough: 0.7 });
  const dial = new THREE.Group();
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(15, 16, 5, 48), mat(0x2b2e35, { rough: 0.45 }));
  dial.add(knob);
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 22), mat(0xe8eaee, { rough: 0.4 }));
  pointer.position.set(0, 3, -4);
  dial.add(pointer);
  place(dial, g, 0, 32.5, 10);
  for (const [x, color] of [[-14, 0x3a3e45], [14, 0xe5383b]] as const) {
    cyl(g, 4.4, 1.2, color, x, 30.6, 56, { rough: 0.4 });
    cyl(g, 2.4, 1.4, 0x050506, x, 30.8, 56);
  }
  // Probe leads curling out to the probes resting beside the meter
  const lead = (x: number, color: number) => {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 31, 56), new THREE.Vector3(x * 1.4, 44, 76), new THREE.Vector3(48 + x * 0.4, 20, 82), new THREE.Vector3(62 + x * 0.3, 2, 40),
    ]);
    place(new THREE.Mesh(new THREE.TubeGeometry(path, 48, 1.1, 10, false), mat(color, { rough: 0.5 })), g, 0, 0, 0);
    cyl(g, 2.2, 34, color, 62 + x * 0.3, 2.2, 22, { rx: Math.PI / 2, rough: 0.4 });
    cyl(g, 0.5, 10, STEEL, 62 + x * 0.3, 2.2, 0, { rx: Math.PI / 2, ...metal });
  };
  lead(-14, 0x22262e); lead(14, 0xe5383b);
  const angles: Record<string, number> = { V: -45, A: 0, 'Ω': 45 };
  return {
    group: g,
    callouts: [
      { at: [0, 30.4, -47], title: 'Display', text: 'Shows the reading and its unit. "OL" means the value is too big for the meter to show.' },
      { at: [0, 36, 10], title: 'Mode dial', text: 'Pick what to measure: V for voltage, mA for current, Ω for resistance.' },
      { at: [-14, 32, 56], title: 'COM jack', text: 'The black probe always goes here. It is the meter’s reference point.' },
      { at: [14, 32, 56], title: 'V Ω mA jack', text: 'The red probe goes here for every measurement on this meter.' },
      { at: [66, 4, 20], title: 'Probes', text: 'Touch the metal tips to the points you want to test. Hold them by the plastic.' },
    ],
    demo: {
      label: 'Turn the dial', start: 0, read: v => (v < 0.34 ? 'Voltage (V)' : v < 0.67 ? 'Current (mA)' : 'Resistance (Ω)'),
      apply: v => {
        const next = v < 0.34 ? 'V' : v < 0.67 ? 'A' : 'Ω';
        dial.rotation.y = (-angles[next] * Math.PI) / 180;
        if (next !== mode) { mode = next; draw(); }
      },
    },
  };
}

function scope(): Model {
  const g = new THREE.Group();
  const W = 140, H = 80, Dp = 60;
  const cv = document.createElement('canvas');
  cv.width = W * 8; cv.height = H * 8;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const X = (x: number) => (x + W / 2) * 8, Y = (y: number) => (H / 2 - y) * 8;
  let freq = 2;
  const draw = () => {
    const c = cv.getContext('2d')!;
    c.fillStyle = '#30343b'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#0b0c0e'; c.fillRect(X(-66), Y(34), 92 * 8, 64 * 8);
    const sx = X(-63), sy = Y(31), sw = 86 * 8, sh = 58 * 8;
    c.fillStyle = '#061209'; c.fillRect(sx, sy, sw, sh);
    c.strokeStyle = '#174a2a'; c.lineWidth = 2;
    for (let i = 0; i <= 10; i++) { c.beginPath(); c.moveTo(sx + (i * sw) / 10, sy); c.lineTo(sx + (i * sw) / 10, sy + sh); c.stroke(); }
    for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(sx, sy + (i * sh) / 8); c.lineTo(sx + sw, sy + (i * sh) / 8); c.stroke(); }
    c.strokeStyle = '#7dffb0'; c.lineWidth = 5; c.shadowColor = '#3dff8b'; c.shadowBlur = 18;
    c.beginPath();
    const hiY = sy + sh * 0.22, loY = sy + sh * 0.78;
    const periods = freq * 2;
    for (let i = 0; i < periods; i++) {
      const x0 = sx + (i / periods) * sw, x1 = sx + ((i + 0.6) / periods) * sw, x2 = sx + ((i + 1) / periods) * sw;
      if (i === 0) c.moveTo(x0, loY);
      c.lineTo(x0, hiY); c.lineTo(x1, hiY); c.lineTo(x1, loY); c.lineTo(x2, loY);
    }
    c.stroke();
    c.shadowBlur = 0;
    label(c, `${(1000 / (freq * 200)).toFixed(1)} ms/div   1 V/div`, sx + 16, sy + 26, 22, { color: '#3dff8b', align: 'left', font: MONO });
    label(c, `${freq * 100} Hz  60%`, sx + 16, sy + sh - 22, 22, { color: '#3dff8b', align: 'left', font: MONO });
    label(c, 'Time', X(44), Y(10), 30, { color: '#d5dae1', weight: 600 });
    label(c, 'Volts', X(58), Y(10), 30, { color: '#d5dae1', weight: 600 });
    label(c, 'CH1', X(44), Y(-20), 30, { color: '#f6c215', weight: 700 });
    label(c, 'XL-Scope 100', X(50), Y(31), 32, { color: '#aeb6c0', weight: 700 });
    tex.needsUpdate = true;
  };
  draw();
  box(g, W, H, Dp, 0x30343b, 0, H / 2 + 3, 0, { rough: 0.55 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 }));
  place(face, g, 0, H / 2 + 3, Dp / 2 + 0.01);
  const fy = H / 2 + 3; // world height of the middle of the front panel
  for (const x of [44, 58]) {
    cyl(g, 5.5, 5, 0x1b1d22, x, fy + 20, Dp / 2 + 2.5, { rx: Math.PI / 2, rough: 0.4 });
    cyl(g, 4.2, 6, 0xc9ced6, x, fy + 20, Dp / 2 + 3, { rx: Math.PI / 2, ...metal });
    box(g, 0.8, 3.4, 0.6, 0x2b2f36, x, fy + 21.6, Dp / 2 + 6.1);
  }
  cyl(g, 3.6, 7, 0xd4d8de, 44, fy - 30, Dp / 2 + 3.5, { rx: Math.PI / 2, metal: 0.9, rough: 0.25 });
  cyl(g, 1.8, 7.2, 0x0b0c0e, 44, fy - 30, Dp / 2 + 3.6, { rx: Math.PI / 2 });
  for (const x of [-60, 60]) for (const z of [-24, 24]) box(g, 10, 3, 6, 0x17181c, x, 1.5, z);
  return {
    group: g,
    callouts: [
      { at: [-20, H / 2 + 13, Dp / 2 + 0.5], title: 'Screen', text: 'Time runs left to right, voltage runs bottom to top. Each square on the grid is one division.' },
      { at: [44, H / 2 + 23, Dp / 2 + 6.5], title: 'Time knob', text: 'Sets how much time each division across stands for. Turn it to zoom in on fast signals.' },
      { at: [58, H / 2 + 23, Dp / 2 + 6.5], title: 'Volts knob', text: 'Sets how many volts each division up stands for. Turn it to make the wave fit.' },
      { at: [44, H / 2 - 27, Dp / 2 + 7.2], title: 'CH1 input', text: 'The probe plugs in here. Its clip goes to ground and its tip touches the signal.' },
    ],
    demo: { label: 'Signal speed', start: 0.3, read: v => `${(1 + Math.round(v * 5)) * 100} Hz`, apply: v => { const f = 1 + Math.round(v * 5); if (f !== freq) { freq = f; draw(); } } },
  };
}

function ne555(name = 'NE555', sub = 'TIMER', custom = false): Model {
  const g = new THREE.Group();
  const W = 9.8, H = 3.4, D = 6.4;
  // Dark epoxy DIP-8 package sitting slightly above the breadboard.
  box(g, W, H, D, 0x17181c, 0, 2.5, 0, { rough: 0.45 });
  // Orientation notch on the left end.
  cyl(g, 0.85, H + 0.04, 0x0b0c0e, -W / 2 + 0.1, 2.5, 0, { rough: 0.7 });
  // Laser-etched markings on top face.
  sticker(g, W, D, 80, (c, X, Z) => {
    c.fillStyle = '#17181c'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.fillStyle = '#0b0c0e';
    c.beginPath(); c.arc(X(-W / 2), Z(0), 0.85 * 80, -Math.PI / 2, Math.PI / 2); c.fill();
    c.beginPath(); c.arc(X(-3.6), Z(1.9), 0.45 * 80, 0, Math.PI * 2); c.fill();
    label(c, name, X(0.3), Z(-0.4), (name.length > 7 ? 1.1 : 1.45) * 80, { color: '#d4d9e0', weight: 700, font: MONO });
    label(c, sub, X(0.3), Z(1.3), 0.8 * 80, { color: '#8b9099', weight: 600, font: MONO });
    const top = ['8', '7', '6', '5'], bot = ['1', '2', '3', '4'];
    [-3.81, -1.27, 1.27, 3.81].forEach((x, i) => {
      label(c, top[i], X(x), Z(-2.45), 0.65 * 80, { color: '#6b7280', font: MONO });
      label(c, bot[i], X(x), Z(2.45), 0.65 * 80, { color: '#6b7280', font: MONO });
    });
  }, 0, 2.5 + H / 2 + 0.01, 0, { rx: -Math.PI / 2 });
  // Eight bent DIP-8 metal legs (4 per side at 2.54 mm pitch).
  for (const side of [-1, 1]) {
    const z = side * 3.81;
    for (const x of [-3.81, -1.27, 1.27, 3.81]) {
      box(g, 1.15, 0.35, 0.85, STEEL, x, 2.2, side * 3.55, metal);
      box(g, 1.15, 1.6, 0.3, STEEL, x, 1.4, z, metal);
      box(g, 0.48, 3.2, 0.28, STEEL, x, -1.0, z, metal);
    }
  }
  if (custom) return {
    group: g,
    callouts: [
      { at: [-4.6, 4.2, 0], title: 'Notch & pin 1 dot', text: 'Pin 1 is at the bottom-left, next to the notch. Pins count anticlockwise up to 8.' },
      { at: [0, 4.3, 0], title: 'Your design inside', text: 'A custom chip holds whatever you describe: resistors, diodes, LEDs, sources and capacitors, wired between its pins.' },
    ],
  };
  return {
    group: g,
    callouts: [
      { at: [-4.6, 4.2, 0], title: 'Notch & pin 1 dot', text: 'The notch marks the left end, and the dot marks pin 1 (GND). Count anticlockwise to pin 8 (VCC).' },
      { at: [1.27, -1.6, 3.81], title: 'Output (Pin 3)', text: 'Switches cleanly between HIGH and LOW to drive an LED, buzzer or transistor (up to 200 mA).' },
      { at: [-1.27, -1.6, -3.81], title: 'Discharge (Pin 7)', text: 'An internal transistor that drains the timing capacitor to ground whenever the output is LOW.' },
      { at: [1.27, -1.6, -3.81], title: 'Threshold (Pin 6)', text: 'Watches the capacitor voltage. When it rises above ⅔ VCC, the output flips LOW.' },
      { at: [0, 4.3, 0], title: 'Inside the DIP-8 package', text: 'A silicon die with two comparators, a flip-flop and three 5 kΩ resistors—which is where the name 555 comes from.' },
    ],
  };
}

export const MODELS: Record<PartType, () => Model> = {
  led, rgb_led: rgbLed, resistor, button, potentiometer, ldr, buzzer, servo, ultrasonic, dht11, lcd, relay, battery, breadboard, uno, esp32,
  capacitor, diode, npn, motor, seg7, switch: slideSwitch, multimeter, scope, ne555: () => ne555(), custom: () => ne555('CUSTOM', 'XAVIERLABS', true),
};
