import { memo } from 'react';
import type { Live, Part } from '../types';
import { BB_COLS, LED_COLORS, PARTS, resistorBands } from './catalog';

const METAL = '#9aa3ad';
const txt = (size: number, fill = '#fff', weight = 600) =>
  ({ fontSize: size, fill, fontWeight: weight, fontFamily: 'IBM Plex Sans, sans-serif', pointerEvents: 'none' as const, userSelect: 'none' as const });

const Legs = ({ xs, h = 8 }: { xs: number[]; h?: number }) => (
  <>{xs.map(x => <line key={x} x1={x} y1={0} x2={x} y2={-h} stroke={METAL} strokeWidth={2} strokeLinecap="round" />)}</>
);

const PinLabels = ({ labels, y = -11 }: { labels: string[]; y?: number }) => (
  <>{labels.map((l, i) => <text key={i} x={i * 12} y={y} textAnchor="middle" style={txt(4.2, '#fff', 500)}>{l}</text>)}</>
);

function Led({ part, live }: { part: Part; live?: Live }) {
  const hex = (LED_COLORS[String(part.props.color)] ?? LED_COLORS.red).hex;
  const b = live?.b ?? 0;
  return (
    <>
      {b > 0.02 && <circle cx={6} cy={-32} r={30} fill={hex} opacity={b * 0.5} filter="url(#xl-glow)" />}
      <path d="M0 0V-6L2-10V-18M12 0V-6L10-10V-18" stroke={METAL} strokeWidth={2} fill="none" strokeLinecap="round" />
      <rect x={-4} y={-22} width={20} height={5} rx={1.5} fill={hex} opacity={0.75} />
      <path d="M-2-21V-36A8 8 0 0 1 14-36V-21Z" fill={hex} opacity={0.45 + b * 0.55} />
      <path d="M-2-21V-36A8 8 0 0 1 14-36V-21Z" fill="#fff" opacity={b * 0.45} />
      <path d="M1-37a5 5 0 0 1 4-5" stroke="#fff" strokeWidth={1.5} fill="none" opacity={0.7} strokeLinecap="round" />
    </>
  );
}

function RgbLed({ live }: { live?: Live }) {
  const [r, g, b] = live?.rgb ?? [0, 0, 0];
  const lit = Math.max(r, g, b);
  const color = `rgb(${Math.round(255 * r)},${Math.round(255 * g)},${Math.round(255 * b)})`;
  return (
    <>
      {lit > 0.02 && <circle cx={18} cy={-36} r={34} fill={color} opacity={0.55} filter="url(#xl-glow)" />}
      <path d="M0 0V-8L10-14V-20M12 0V-20M24 0V-20M36 0V-8L26-14V-20" stroke={METAL} strokeWidth={2} fill="none" strokeLinecap="round" />
      <rect x={5} y={-25} width={26} height={5} rx={1.5} fill="#dfe6ee" />
      <path d="M7-24V-40A11 11 0 0 1 29-40V-24Z" fill={lit > 0.02 ? color : '#eef2f7'} stroke="#c3ccd6" strokeWidth={0.8} />
      <path d="M11-41a7 7 0 0 1 5-6" stroke="#fff" strokeWidth={1.5} fill="none" opacity={0.8} strokeLinecap="round" />
    </>
  );
}

function Resistor({ part }: { part: Part }) {
  const bands = resistorBands(+part.props.ohms || 220);
  return (
    <>
      <line x1={0} y1={0} x2={48} y2={0} stroke={METAL} strokeWidth={2} strokeLinecap="round" />
      <rect x={11} y={-5.5} width={26} height={11} rx={5} fill="#dcc096" stroke="#b79562" strokeWidth={0.8} />
      {bands.map((c, i) => <rect key={i} x={15.5 + i * 4.5} y={-5.5} width={2.6} height={11} fill={c} />)}
      <rect x={31} y={-5.5} width={2.6} height={11} fill="#c9a227" />
    </>
  );
}

function Button({ part }: { part: Part }) {
  const down = !!part.props.pressed;
  return (
    <>
      {[[0, 0], [24, 0], [0, 24], [24, 24]].map(([x, y], i) => <rect key={i} x={x - 2} y={y - 2} width={4} height={4} fill={METAL} />)}
      <rect x={1} y={1} width={22} height={22} rx={3} fill="#2b2f36" />
      <rect x={3.5} y={3.5} width={17} height={17} rx={2} fill="#c9d0d8" />
      <circle cx={12} cy={12} r={down ? 6 : 7} fill={down ? '#0d0f12' : '#23262c'} stroke={down ? '#fff' : '#3d424b'} strokeWidth={down ? 2 : 1} />
    </>
  );
}

function Pot({ part }: { part: Part }) {
  const a = -135 + Math.min(1, Math.max(0, +part.props.pos)) * 270;
  return (
    <>
      <Legs xs={[0, 12, 24]} />
      <rect x={-10} y={-54} width={44} height={46} rx={5} fill="#2a6fdb" />
      <circle cx={12} cy={-31} r={17} fill="#1c4fa3" />
      {[-135, -67.5, 0, 67.5, 135].map(d => <line key={d} x1={12} y1={-50.5} x2={12} y2={-48} stroke="#fff" strokeWidth={1} opacity={0.7} transform={`rotate(${d} 12 -31)`} />)}
      <g transform={`rotate(${a} 12 -31)`}>
        <circle cx={12} cy={-31} r={13} fill="#e9edf2" stroke="#b9c2cd" strokeWidth={1} />
        <rect x={10.6} y={-44} width={2.8} height={12} rx={1.4} fill="#09090b" />
      </g>
    </>
  );
}

function Ldr() {
  return (
    <>
      <Legs xs={[0, 12]} h={14} />
      <circle cx={6} cy={-25} r={13} fill="#d9662b" stroke="#a84a1b" strokeWidth={1} />
      <path d="M-3-31H13V-28H-1V-25H13V-22H-1V-19H15" stroke="#f9e3c4" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function Buzzer({ live }: { live?: Live }) {
  const on = !!live?.hz;
  return (
    <>
      <Legs xs={[0, 24]} />
      <circle cx={12} cy={-26} r={19} fill="#1d2026" />
      <circle cx={12} cy={-26} r={14} fill="none" stroke="#343842" strokeWidth={1.5} />
      <circle cx={12} cy={-26} r={3.2} fill="#000" />
      <text x={-1} y={-36} style={txt(8, '#cfd6dd')}>+</text>
      {on && <path d="M34-36a14 14 0 0 1 0 20M39-41a21 21 0 0 1 0 30" stroke="#09090b" strokeWidth={2} fill="none" strokeLinecap="round" />}
    </>
  );
}

function Servo({ live }: { live?: Live }) {
  const angle = live?.angle ?? 90;
  return (
    <>
      <path d="M0-4V-22Q0-30 4-36" stroke="#7a4a1e" strokeWidth={2.5} fill="none" />
      <path d="M12-4V-36" stroke="#e5383b" strokeWidth={2.5} fill="none" />
      <path d="M24-4V-22Q24-30 20-36" stroke="#f2801c" strokeWidth={2.5} fill="none" />
      <rect x={-4} y={-6} width={32} height={8} rx={1.5} fill="#22262e" />
      <rect x={-22} y={-80} width={68} height={16} rx={3} fill="#1b4fb5" />
      <circle cx={-16} cy={-72} r={2.5} fill="#0d2f73" /><circle cx={40} cy={-72} r={2.5} fill="#0d2f73" />
      <rect x={-13} y={-104} width={50} height={68} rx={5} fill="#2563eb" />
      <circle cx={12} cy={-80} r={13} fill="#3b7bff" />
      <g transform={`rotate(${angle - 90} 12 -80)`}>
        <rect x={8} y={-104} width={8} height={30} rx={4} fill="#f4f6f9" stroke="#b9c2cd" strokeWidth={0.8} />
        <circle cx={12} cy={-80} r={5.5} fill="#f4f6f9" stroke="#b9c2cd" strokeWidth={0.8} />
        <circle cx={12} cy={-80} r={1.6} fill="#5b6b82" />
        <circle cx={12} cy={-98} r={1.2} fill="#8f9aa6" />
      </g>
      {live?.angle !== undefined && <text x={12} y={-42} textAnchor="middle" style={txt(8)}>{Math.round(angle)}°</text>}
    </>
  );
}

function Ultrasonic() {
  const eye = (cx: number) => (
    <g key={cx}>
      <circle cx={cx} cy={-40} r={17} fill="#cfd6dd" stroke="#8f9aa6" strokeWidth={1} />
      <circle cx={cx} cy={-40} r={12.5} fill="#77818d" />
      <circle cx={cx} cy={-40} r={12.5} fill="url(#xl-mesh)" />
      <circle cx={cx} cy={-40} r={3} fill="#2b2f36" />
    </g>
  );
  return (
    <>
      <Legs xs={[0, 12, 24, 36]} />
      <rect x={-28} y={-68} width={92} height={60} rx={3} fill="#1f5fbf" />
      {eye(-5)}{eye(41)}
      <rect x={10} y={-66} width={16} height={7} rx={3.5} fill="#cfd6dd" />
      <PinLabels labels={['Vcc', 'Trig', 'Echo', 'Gnd']} />
    </>
  );
}

function Dht() {
  return (
    <>
      <Legs xs={[0, 12, 24]} />
      <rect x={-8} y={-24} width={40} height={16} rx={2} fill="#1f5fbf" />
      <rect x={-6} y={-66} width={36} height={46} rx={3} fill="#4fb0e6" />
      {[0, 1, 2, 3].flatMap(r => [0, 1, 2, 3].map(c => (
        <rect key={`${r}${c}`} x={-1.5 + c * 7.2} y={-61 + r * 7.5} width={5} height={5} rx={1} fill="#1b6fa8" />
      )))}
      <PinLabels labels={['+', 'out', '−']} y={-12} />
    </>
  );
}

function Lcd({ live }: { live?: Live }) {
  const lit = !!live?.backlight;
  const rows = live?.lcd;
  return (
    <>
      <Legs xs={[0, 12, 24, 36]} />
      <rect x={-16} y={-100} width={200} height={92} rx={3} fill="#1f7a4a" />
      {[[-10, -94], [178, -94], [-10, -14], [178, -14]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="#e9edf2" stroke="#b9c2cd" />)}
      <rect x={-4} y={-90} width={176} height={66} rx={2} fill="#14171c" />
      <rect x={3} y={-83} width={162} height={52} rx={1.5} fill={lit ? '#a9dc3f' : '#6c7f4a'} />
      {rows?.map((row, i) => (
        <text key={i} x={7} y={-62 + i * 21} textLength={154} lengthAdjust="spacing"
          style={{ fontSize: 14, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fill: '#1c2a0c', pointerEvents: 'none', userSelect: 'none', whiteSpace: 'pre' }}>
          {row.padEnd(16, ' ').slice(0, 16).replace(/ /g, ' ')}
        </text>
      ))}
      <PinLabels labels={['Gnd', 'Vcc', 'SDA', 'SCL']} y={-12} />
    </>
  );
}

function Relay({ live }: { live?: Live }) {
  return (
    <>
      <Legs xs={[0, 12, 24]} />
      <rect x={-16} y={-78} width={56} height={70} rx={3} fill="#17335f" />
      <rect x={-11} y={-74} width={46} height={16} rx={2} fill="#1fa35b" />
      {[-3, 12, 27].map(x => <circle key={x} cx={x} cy={-66} r={3.6} fill="#cfd6dd" stroke="#8f9aa6" />)}
      <rect x={-10} y={-54} width={44} height={34} rx={2} fill="#2f7de1" />
      <text x={12} y={-33} textAnchor="middle" style={txt(7)}>{live?.on ? 'CLOSED' : 'RELAY'}</text>
      <circle cx={34} cy={-13} r={2.6} fill={live?.on ? '#ff4d4f' : '#6b2a2c'} />
      <PinLabels labels={['+', '−', 'in']} y={-12} />
    </>
  );
}

function Battery() {
  return (
    <>
      <path d="M0 0V-10Q0-18 5-22" stroke="#e5383b" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M24 0V-10Q24-18 19-22" stroke="#22262e" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <rect x={-16} y={-90} width={56} height={70} rx={4} fill="#22262e" />
      <rect x={-16} y={-90} width={56} height={26} rx={4} fill="#d97a1f" />
      <rect x={-16} y={-70} width={56} height={6} fill="#d97a1f" />
      <text x={12} y={-36} textAnchor="middle" style={txt(18, '#fff', 700)}>9V</text>
      <text x={-6} y={-74} textAnchor="middle" style={txt(10, '#09090b', 700)}>+</text>
      <text x={30} y={-74} textAnchor="middle" style={txt(10, '#09090b', 700)}>−</text>
    </>
  );
}

const Breadboard = memo(function Breadboard() {
  const pins = PARTS.breadboard.pins;
  return (
    <>
      <rect x={0} y={0} width={396} height={216} rx={7} fill="#f6f4ee" stroke="#cfc9ba" strokeWidth={1.2} />
      <rect x={0} y={102} width={396} height={12} fill="#e4e0d4" />
      {[6, 186].map(y => <line key={y} x1={18} y1={y} x2={378} y2={y} stroke="#e5383b" strokeWidth={1.4} />)}
      {[30, 210].map(y => <line key={y} x1={18} y1={y} x2={378} y2={y} stroke="#2563eb" strokeWidth={1.4} />)}
      {[[12, 15, '+', '#e5383b'], [12, 27, '−', '#2563eb'], [12, 195, '+', '#e5383b'], [12, 207, '−', '#2563eb']].map(([x, y, s, c]) => (
        <text key={`${y}`} x={+x} y={+y} textAnchor="middle" style={txt(9, String(c), 700)}>{s}</text>
      ))}
      {pins.map(p => <rect key={p.id} x={p.x - 2.6} y={p.y - 2.6} width={5.2} height={5.2} rx={1.2} fill="#3a3e45" />)}
      {Array.from({ length: BB_COLS }, (_, i) => i + 1).filter(n => n === 1 || n % 5 === 0).map(n => (
        <text key={n} x={24 + (n - 1) * 12} y={41} textAnchor="middle" style={txt(5.5, '#8a8f98', 500)}>{n}</text>
      ))}
      {'abcde'.split('').map((r, i) => <text key={r} x={12} y={50 + i * 12} textAnchor="middle" style={txt(5.5, '#8a8f98', 500)}>{r}</text>)}
      {'fghij'.split('').map((r, i) => <text key={r} x={12} y={122 + i * 12} textAnchor="middle" style={txt(5.5, '#8a8f98', 500)}>{r}</text>)}
    </>
  );
});

const PWM = new Set(['D3', 'D5', 'D6', 'D9', 'D10', 'D11']);

function Uno({ live, running }: { live?: Live; running: boolean }) {
  const pins = PARTS.uno.pins;
  return (
    <>
      <rect x={0} y={0} width={324} height={216} rx={9} fill="#0f8391" stroke="#0a5f6a" strokeWidth={1.5} />
      <rect x={-10} y={34} width={48} height={46} rx={3} fill="#c5ccd4" stroke="#8f9aa6" />
      <rect x={-6} y={148} width={46} height={48} rx={4} fill="#1d2026" />
      <rect x={78} y={5} width={120} height={14} rx={2} fill="#1d2026" /><rect x={210} y={5} width={96} height={14} rx={2} fill="#1d2026" />
      <rect x={114} y={197} width={84} height={14} rx={2} fill="#1d2026" /><rect x={210} y={197} width={72} height={14} rx={2} fill="#1d2026" />
      {pins.map(p => <rect key={p.id} x={p.x - 3} y={p.y - 3} width={6} height={6} rx={1} fill="#565c66" />)}
      {pins.map(p => (
        <text key={p.id} x={p.x} y={p.y < 100 ? 29 : 192} textAnchor="middle"
          transform={`rotate(-90 ${p.x} ${p.y < 100 ? 29 : 192})`} style={{ ...txt(5.4, '#e6fbff', 500), textAnchor: p.y < 100 ? 'end' : 'start' }}>
          {(PWM.has(p.id) ? '~' : '') + p.name}
        </text>
      ))}
      <rect x={140} y={128} width={126} height={30} rx={2} fill="#1d2026" />
      {Array.from({ length: 14 }, (_, i) => <g key={i}><rect x={145 + i * 8.6} y={124} width={3} height={4} fill={METAL} /><rect x={145 + i * 8.6} y={158} width={3} height={4} fill={METAL} /></g>)}
      <text x={203} y={146} textAnchor="middle" style={txt(6.5, '#aeb6c0', 500)}>ATMEGA328P</text>
      <text x={196} y={92} textAnchor="middle" style={{ ...txt(20, '#fff', 700), fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: 1 }}>UNO</text>
      <rect x={52} y={10} width={16} height={16} rx={2} fill="#c5ccd4" /><circle cx={60} cy={18} r={4.5} fill="#e5383b" />
      <rect x={66} y={100} width={30} height={12} rx={6} fill="#c5ccd4" />
      <circle cx={108} cy={62} r={3.5} fill={running ? '#3dff8b' : '#0a5f6a'} /><text x={108} y={73} textAnchor="middle" style={txt(5, '#e6fbff', 500)}>ON</text>
      <circle cx={124} cy={62} r={3.5} fill={live?.b ? `rgba(255,190,40,${0.25 + live.b * 0.75})` : '#0a5f6a'} /><text x={124} y={73} textAnchor="middle" style={txt(5, '#e6fbff', 500)}>L</text>
      {[0, 1, 2].flatMap(c => [0, 1].map(r => <circle key={`${c}${r}`} cx={292 + r * 9} cy={96 + c * 9} r={2.4} fill="#c9a227" />))}
    </>
  );
}

function Esp32({ live, running }: { live?: Live; running: boolean }) {
  const pins = PARTS.esp32.pins;
  return (
    <>
      <rect x={0} y={0} width={120} height={216} rx={6} fill="#1b1d22" stroke="#000" strokeWidth={1} />
      <path d="M34 12V5H42V12H50V5H58V12H66V5H74V12H86" stroke="#c9a227" strokeWidth={1.6} fill="none" />
      <rect x={30} y={16} width={60} height={74} rx={2} fill="#bcc3cb" stroke="#8f9aa6" />
      <text x={60} y={50} textAnchor="middle" style={{ ...txt(12, '#2b2f36', 700), fontFamily: 'Bricolage Grotesque, sans-serif' }}>ESP32</text>
      <text x={60} y={62} textAnchor="middle" style={txt(5.5, '#4a515c', 500)}>Wi-Fi + Bluetooth</text>
      <rect x={45} y={200} width={30} height={18} rx={3} fill="#c5ccd4" stroke="#8f9aa6" />
      {[32, 88].map(x => <g key={x}><rect x={x - 7} y={180} width={14} height={11} rx={2} fill="#c5ccd4" /><circle cx={x} cy={185.5} r={3} fill="#2b2f36" /></g>)}
      <circle cx={52} cy={108} r={3} fill={running ? '#ff4d4f' : '#5a2224'} /><circle cx={68} cy={108} r={3} fill={live?.b ? `rgba(80,150,255,${0.3 + live.b * 0.7})` : '#1f3566'} />
      {pins.map(p => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} r={3.6} fill="#c9a227" /><circle cx={p.x} cy={p.y} r={1.5} fill="#1b1d22" />
          <text x={p.x < 60 ? 19 : 101} y={p.y + 1.8} textAnchor={p.x < 60 ? 'start' : 'end'} style={txt(5, '#d5dae1', 500)}>
            {p.id.replace(/^D/, '').replace(/^GND2$/, 'GND')}
          </text>
        </g>
      ))}
    </>
  );
}

/** Draws one part in its own local coordinates. The caller positions and rotates it. */
export const PartArt = memo(function PartArt({ part, live, running = false }: { part: Part; live?: Live; running?: boolean }) {
  switch (part.type) {
    case 'led': return <Led part={part} live={live} />;
    case 'rgb_led': return <RgbLed live={live} />;
    case 'resistor': return <Resistor part={part} />;
    case 'button': return <Button part={part} />;
    case 'potentiometer': return <Pot part={part} />;
    case 'ldr': return <Ldr />;
    case 'buzzer': return <Buzzer live={live} />;
    case 'servo': return <Servo live={live} />;
    case 'ultrasonic': return <Ultrasonic />;
    case 'dht11': return <Dht />;
    case 'lcd': return <Lcd live={live} />;
    case 'relay': return <Relay live={live} />;
    case 'battery': return <Battery />;
    case 'breadboard': return <Breadboard />;
    case 'uno': return <Uno live={live} running={running} />;
    case 'esp32': return <Esp32 live={live} running={running} />;
  }
});

/** Shared SVG filters and patterns. Render once at the top of the app. */
export const ArtDefs = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      <filter id="xl-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7" /></filter>
      <pattern id="xl-mesh" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.7" fill="#3a3e45" /></pattern>
    </defs>
  </svg>
);

/** A small picture of a part, for lists and menus. */
export function PartThumb({ part, size = 44 }: { part: Part; size?: number }) {
  const [x0, y0, x1, y1] = PARTS[part.type].box;
  const pad = 4;
  return (
    <svg width={size} height={size} viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`} aria-hidden="true">
      <PartArt part={part} />
    </svg>
  );
}
