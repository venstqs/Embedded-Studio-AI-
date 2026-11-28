import { memo } from 'react';
import type { Live, Part } from '../types';
import { BB_COLS, LED_COLORS, PARTS, SEGMENTS, formatFarads, resistorBands, wireGeom } from './catalog';

const METAL = '#9aa3ad';
const txt = (size: number, fill = '#fff', weight = 600) =>
  ({ fontSize: size, fill, fontWeight: weight, fontFamily: 'Geist, sans-serif', pointerEvents: 'none' as const, userSelect: 'none' as const });

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
      <rect x={11} y={-5.5} width={26} height={11} rx={5} fill="url(#xl-resistor)" stroke="#a5875a" strokeWidth={0.6} />
      {bands.map((c, i) => <rect key={i} x={15.5 + i * 4.5} y={-5.5} width={2.6} height={11} fill={c} />)}
      <rect x={31} y={-5.5} width={2.6} height={11} fill="#c9a227" />
      <rect x={11} y={-5.5} width={26} height={11} rx={5} fill="url(#xl-band)" />
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
          style={{ fontSize: 14, fontFamily: 'Geist Mono, monospace', fontWeight: 600, fill: '#1c2a0c', pointerEvents: 'none', userSelect: 'none', whiteSpace: 'pre' }}>
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
      <rect x={0} y={4} width={396} height={216} rx={7} fill="#d6d0c0" />
      <rect x={0} y={0} width={396} height={216} rx={7} fill="#f6f4ee" stroke="#cfc9ba" strokeWidth={1.2} />
      <rect x={0} y={102} width={396} height={12} fill="#e4e0d4" />
      <line x1={0} y1={103} x2={396} y2={103} stroke="#cfc9ba" strokeWidth={1} />
      {[6, 186].map(y => <line key={y} x1={18} y1={y} x2={378} y2={y} stroke="#e5383b" strokeWidth={1.4} />)}
      {[30, 210].map(y => <line key={y} x1={18} y1={y} x2={378} y2={y} stroke="#2563eb" strokeWidth={1.4} />)}
      {[[12, 15, '+', '#e5383b'], [12, 27, '−', '#2563eb'], [12, 195, '+', '#e5383b'], [12, 207, '−', '#2563eb']].map(([x, y, s, c]) => (
        <text key={`${y}`} x={+x} y={+y} textAnchor="middle" style={txt(9, String(c), 700)}>{s}</text>
      ))}
      {pins.map(p => <rect key={p.id} x={p.x - 2.6} y={p.y - 2.6} width={5.2} height={5.2} rx={1.2} fill="#2f3238" stroke="#e7e2d6" strokeWidth={0.8} />)}
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
  const led = (x: number, y: number, on: boolean, color: string, label: string) => (
    <g>
      {on && <circle cx={x} cy={y} r={7} fill={color} opacity={0.45} filter="url(#xl-glow-sm)" />}
      <rect x={x - 3} y={y - 1.8} width={6} height={3.6} rx={0.8} fill={on ? color : '#d8dde3'} stroke={on ? color : '#9aa3ad'} strokeWidth={0.5} />
      <text x={x} y={y + 9} textAnchor="middle" style={txt(5, '#e6fbff', 600)}>{label}</text>
    </g>
  );
  const smd = (x: number, y: number, vertical = false, body = '#2f3238') => (
    <g transform={`translate(${x} ${y})${vertical ? ' rotate(90)' : ''}`}>
      <rect x={-4} y={-2} width={8} height={4} rx={0.6} fill={body} />
      <rect x={-4} y={-2} width={1.8} height={4} fill="#c5ccd4" /><rect x={2.2} y={-2} width={1.8} height={4} fill="#c5ccd4" />
    </g>
  );
  return (
    <>
      {/* board, with copper traces showing faintly through the solder mask */}
      <rect x={0} y={0} width={324} height={216} rx={9} fill="url(#xl-pcb)" stroke="#075762" strokeWidth={1.5} />
      <g stroke="#3fb4c0" strokeWidth={1.6} fill="none" opacity={0.35} strokeLinecap="round" strokeLinejoin="round">
        <path d="M144 20V44L160 60H200M156 20V40L170 54H222M168 20V36L180 48H246M228 20V44L238 54V122M240 20V46L250 56V122M252 20V48L262 58V122" />
        <path d="M216 196V176L208 168H170V160M228 196V172L222 166M240 196V170L250 160M120 196V178L104 162H80" />
        <path d="M40 60H66L80 74V92M28 120H48L62 134H96M100 150H138" />
      </g>
      {[[66, 14], [312, 72], [312, 185], [66, 203]].map(([x, y]) => (
        <g key={`${x}${y}`}><circle cx={x} cy={y} r={7} fill="#e3e7eb" /><circle cx={x} cy={y} r={4.4} fill="#0a3940" /></g>
      ))}

      {/* silkscreen */}
      <g fill="none" stroke="#e6fbff" strokeWidth={0.8} opacity={0.9}>
        <rect x={76} y={3} width={124} height={18} rx={1.5} /><rect x={208} y={3} width={100} height={18} rx={1.5} />
        <rect x={112} y={195} width={88} height={18} rx={1.5} /><rect x={208} y={195} width={76} height={18} rx={1.5} />
      </g>
      <text x={192} y={58} textAnchor="middle" style={{ ...txt(7, '#e6fbff', 700), letterSpacing: 0.6 }}>DIGITAL (PWM ~)</text>
      <text x={156} y={164} textAnchor="middle" style={{ ...txt(7, '#e6fbff', 700), letterSpacing: 0.6 }}>POWER</text>
      <text x={246} y={164} textAnchor="middle" style={{ ...txt(7, '#e6fbff', 700), letterSpacing: 0.6 }}>ANALOG IN</text>
      <g stroke="#e6fbff" strokeWidth={2.6} fill="none">
        <circle cx={160} cy={92} r={8} /><circle cx={176} cy={92} r={8} />
      </g>
      <g stroke="#e6fbff" strokeWidth={2}><line x1={156} y1={92} x2={164} y2={92} /><line x1={172} y1={92} x2={180} y2={92} /><line x1={176} y1={88} x2={176} y2={96} /></g>
      <text x={168} y={114} textAnchor="middle" style={{ ...txt(8.5, '#e6fbff', 800), letterSpacing: 1.2 }}>ARDUINO</text>
      <text x={232} y={102} textAnchor="middle" style={{ ...txt(30, '#fff', 800), fontFamily: 'Geist, sans-serif', letterSpacing: 0.5 }}>UNO</text>

      {/* USB-B and barrel jack */}
      <rect x={-12} y={32} width={52} height={50} rx={3} fill="url(#xl-metal)" stroke="#7d8792" strokeWidth={0.8} />
      <rect x={-12} y={42} width={8} height={30} rx={1.5} fill="#2b2f36" />
      <rect x={-11} y={49} width={5} height={16} rx={1} fill="#e8e2d0" />
      <line x1={-8} y1={35} x2={36} y2={35} stroke="#fff" strokeWidth={1.2} opacity={0.7} />
      <rect x={-8} y={146} width={50} height={52} rx={4} fill="url(#xl-plastic)" />
      <circle cx={6} cy={172} r={11} fill="#050506" stroke="#3a3e45" strokeWidth={1.5} />
      <circle cx={6} cy={172} r={3.4} fill="url(#xl-metal)" />

      {/* headers */}
      <rect x={78} y={5} width={120} height={14} rx={2} fill="url(#xl-plastic)" /><rect x={210} y={5} width={96} height={14} rx={2} fill="url(#xl-plastic)" />
      <rect x={114} y={197} width={84} height={14} rx={2} fill="url(#xl-plastic)" /><rect x={210} y={197} width={72} height={14} rx={2} fill="url(#xl-plastic)" />
      {pins.map(p => (
        <g key={p.id}><rect x={p.x - 3.2} y={p.y - 3.2} width={6.4} height={6.4} rx={0.8} fill="#050506" /><rect x={p.x - 3.2} y={p.y + 1.6} width={6.4} height={1.6} fill="#3a3e45" /></g>
      ))}
      {pins.map(p => (
        <text key={p.id} x={p.x} y={p.y < 100 ? 26 : 192} textAnchor="middle"
          transform={`rotate(-90 ${p.x} ${p.y < 100 ? 26 : 192})`} style={{ ...txt(5.2, '#e6fbff', 500), textAnchor: p.y < 100 ? 'end' : 'start' }}>
          {(PWM.has(p.id) ? '~' : '') + p.name}
        </text>
      ))}

      {/* ATmega328P in its socket */}
      <rect x={136} y={121} width={134} height={44} rx={2} fill="#22252b" />
      {Array.from({ length: 14 }, (_, i) => (
        <g key={i}>
          <rect x={144 + i * 8.6} y={122} width={3.4} height={7} rx={0.6} fill="url(#xl-metal)" />
          <rect x={144 + i * 8.6} y={157} width={3.4} height={7} rx={0.6} fill="url(#xl-metal)" />
        </g>
      ))}
      <rect x={140} y={128} width={126} height={30} rx={2} fill="url(#xl-chip)" />
      <path d="M140 137A6 6 0 0 1 140 149Z" fill="#0b0c0e" />
      <circle cx={148} cy={152} r={2} fill="#0b0c0e" />
      <text x={205} y={142} textAnchor="middle" style={txt(7, '#c9ced6', 600)}>ATMEGA328P-PU</text>
      <text x={205} y={151} textAnchor="middle" style={{ ...txt(4.6, '#8b9099', 500), fontFamily: 'Geist Mono, monospace' }}>ATMEL 1846</text>

      {/* support chips and parts */}
      <rect x={82} y={56} width={20} height={20} rx={1.5} fill="url(#xl-chip)" />
      <circle cx={86} cy={60} r={1.2} fill="#5a5f68" />
      <text x={92} y={68} textAnchor="middle" style={{ ...txt(4.4, '#aeb4bd', 500), fontFamily: 'Geist Mono, monospace' }}>16U2</text>
      <rect x={98} y={102} width={26} height={11} rx={5.5} fill="url(#xl-metal)" stroke="#7d8792" strokeWidth={0.6} />
      <text x={111} y={109.5} textAnchor="middle" style={{ ...txt(4.6, '#3a3e45', 700) }}>16.000</text>
      {[[60, 104], [60, 128]].map(([x, y]) => (
        <g key={y}>
          <circle cx={x} cy={y} r={9} fill="#1f2a44" stroke="#0f1626" strokeWidth={1} />
          <circle cx={x} cy={y} r={7} fill="url(#xl-metal)" />
          <path d={`M${x - 5} ${y}H${x + 5}M${x} ${y - 5}V${y + 5}`} stroke="#6b7480" strokeWidth={1.2} />
        </g>
      ))}
      <rect x={46} y={154} width={22} height={16} rx={1.5} fill="url(#xl-chip)" />
      <rect x={48} y={148} width={18} height={6} fill="url(#xl-metal)" />
      {smd(112, 88)}{smd(124, 88, false, '#8a6d3b')}{smd(276, 140, true, '#8a6d3b')}{smd(288, 140, true)}{smd(286, 60)}

      {/* reset button and ICSP header */}
      <rect x={50} y={8} width={20} height={20} rx={2} fill="url(#xl-metal)" stroke="#7d8792" strokeWidth={0.6} />
      <circle cx={60} cy={18} r={6} fill="#c8282b" /><circle cx={58.5} cy={16.5} r={2.2} fill="#ff7a7c" opacity={0.6} />
      <text x={60} y={36} textAnchor="middle" style={txt(4.6, '#e6fbff', 600)}>RESET</text>
      <rect x={286} y={90} width={21} height={30} rx={1} fill="url(#xl-plastic)" />
      {[0, 1, 2].flatMap(c => [0, 1].map(r => (
        <g key={`${c}${r}`}><rect x={289 + r * 9} y={93 + c * 9} width={6} height={6} rx={0.5} fill="#c9a227" /><rect x={290.5 + r * 9} y={94.5 + c * 9} width={3} height={3} fill="#f0d36a" /></g>
      )))}
      <text x={296.5} y={128} textAnchor="middle" style={txt(4.6, '#e6fbff', 600)}>ICSP</text>

      {/* status LEDs */}
      {led(112, 66, running, '#3dff8b', 'ON')}
      {led(128, 66, !!live?.b, '#ffb400', 'L')}
      {led(144, 66, false, '#ffb400', 'TX')}
      {led(160, 66, false, '#ffb400', 'RX')}
    </>
  );
}

function Esp32({ live, running }: { live?: Live; running: boolean }) {
  const pins = PARTS.esp32.pins;
  return (
    <>
      <rect x={0} y={0} width={120} height={216} rx={6} fill="#1b1d22" stroke="#000" strokeWidth={1} />
      <rect x={26} y={2} width={68} height={94} rx={2} fill="#1d2230" />
      <path d="M32 13V5H38V13H44V5H50V13H56V5H62V13H68V5H74V13H88" stroke="#d8b13a" strokeWidth={1.6} fill="none" />
      <rect x={30} y={18} width={60} height={74} rx={2} fill="url(#xl-metal)" stroke="#8f9aa6" />
      <text x={60} y={74} textAnchor="middle" style={{ ...txt(4.5, '#5a616c', 500), fontFamily: 'Geist Mono, monospace' }}>ESP-WROOM-32</text>
      <text x={60} y={50} textAnchor="middle" style={{ ...txt(12, '#2b2f36', 700), fontFamily: 'Geist, sans-serif' }}>ESP32</text>
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

// ---------- Analog parts ----------

function Capacitor({ part, live }: { part: Part; live?: Live }) {
  const uf = +part.props.uf || 100;
  const top = uf >= 470 ? -52 : uf >= 100 ? -46 : -40;
  const h = -8 - top;
  return (
    <>
      <path d="M0 0V-8M12 0V-8" stroke={METAL} strokeWidth={2} strokeLinecap="round" />
      <rect x={-8} y={top} width={28} height={h} rx={4} fill="url(#xl-cap)" />
      <rect x={11} y={top + 1} width={6} height={h - 2} fill="#cfd8e6" opacity={0.9} />
      {Array.from({ length: Math.max(2, Math.floor(h / 10)) }, (_, i) => <rect key={i} x={12.6} y={top + 5 + i * 9} width={2.8} height={1.2} fill="#1d3f8c" />)}
      <ellipse cx={6} cy={top + 0.5} rx={13.6} ry={2.4} fill="url(#xl-metal)" />
      <path d={`M-1 ${top + 0.5}H13M6 ${top - 1.5}V${top + 2.5}`} stroke="#7d8792" strokeWidth={0.7} />
      <text x={2} y={top + h / 2} textAnchor="middle" transform={`rotate(-90 2 ${top + h / 2})`} style={txt(5.4, '#e8eefb', 600)}>{formatFarads(uf)}</text>
      {live?.volts !== undefined && (
        <g>
          <rect x={-8} y={top - 13} width={28} height={9} rx={4.5} fill="#09090b" />
          <text x={6} y={top - 6.6} textAnchor="middle" style={{ ...txt(6, '#fff', 600), fontFamily: 'Geist Mono, monospace' }}>{live.volts.toFixed(1)} V</text>
        </g>
      )}
    </>
  );
}

function Diode() {
  return (
    <>
      <line x1={0} y1={0} x2={48} y2={0} stroke={METAL} strokeWidth={2} strokeLinecap="round" />
      <rect x={13} y={-4.5} width={22} height={9} rx={2.2} fill="url(#xl-chip)" />
      <rect x={29} y={-4.5} width={3.2} height={9} fill="#d4d9e0" />
      <rect x={13} y={-4.5} width={22} height={9} rx={2.2} fill="url(#xl-band)" />
    </>
  );
}

function Npn() {
  return (
    <>
      <path d="M0 0V-12L3 -18M12 0V-18M24 0V-12L21 -18" stroke={METAL} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-3 -18H27V-33Q27 -42 12 -42Q-3 -42 -3 -33Z" fill="url(#xl-chip)" />
      <path d="M-1 -20H25" stroke="#4a4e57" strokeWidth={0.8} />
      <text x={12} y={-31} textAnchor="middle" style={txt(5.6, '#d4d9e0', 700)}>2N2222</text>
      <text x={12} y={-24} textAnchor="middle" style={{ ...txt(4.2, '#9aa1ab', 500), letterSpacing: 2.2 }}>E B C</text>
    </>
  );
}

function Motor({ live }: { live?: Live }) {
  const rps = live?.rps ?? 0;
  const speed = Math.round(Math.abs(rps) * 2) / 2;
  const spin = speed > 0;
  return (
    <>
      <path d="M0 0V-10Q0 -16 6 -18" stroke="#22262e" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M24 0V-10Q24 -16 18 -18" stroke="#e5383b" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <circle cx={12} cy={-38} r={21} fill="url(#xl-metal)" stroke="#7d8792" strokeWidth={0.8} />
      <circle cx={12} cy={-38} r={15} fill="none" stroke="#9aa3ad" strokeWidth={1} />
      {[30, 150, 270].map(a => <circle key={a} cx={12 + 18 * Math.cos((a * Math.PI) / 180)} cy={-38 + 18 * Math.sin((a * Math.PI) / 180)} r={1.4} fill="#7d8792" />)}
      <g className={spin ? 'xl-spin' : undefined}
        style={spin ? { animationDuration: `${(1 / speed).toFixed(3)}s`, animationDirection: rps < 0 ? 'reverse' : 'normal' } : undefined}>
        <circle cx={12} cy={-38} r={24} fill="transparent" />
        {[0, 120, 240].map(a => (
          <path key={a} d="M12 -38C7 -48 8 -58 12 -62C17 -59 17 -48 12 -38Z" fill="#f4f6f9" stroke="#8f99a4" strokeWidth={0.7} transform={`rotate(${a} 12 -38)`} />
        ))}
        <circle cx={12} cy={-38} r={4} fill="#e5383b" stroke="#a51f22" strokeWidth={0.8} />
      </g>
    </>
  );
}

const SEG_T = 4;
const hSeg = (x1: number, x2: number, y: number) => `M${x1} ${y}L${x1 + SEG_T / 2} ${y - SEG_T / 2}H${x2 - SEG_T / 2}L${x2} ${y}L${x2 - SEG_T / 2} ${y + SEG_T / 2}H${x1 + SEG_T / 2}Z`;
const vSeg = (x: number, y1: number, y2: number) => `M${x} ${y1}L${x + SEG_T / 2} ${y1 + SEG_T / 2}V${y2 - SEG_T / 2}L${x} ${y2}L${x - SEG_T / 2} ${y2 - SEG_T / 2}V${y1 + SEG_T / 2}Z`;
const SEG_PATHS: Record<string, string> = {
  a: hSeg(14, 34, 11), b: vSeg(35, 12, 29), c: vSeg(35, 31, 48), d: hSeg(14, 34, 49),
  e: vSeg(13, 31, 48), f: vSeg(13, 12, 29), g: hSeg(14, 34, 30),
  dp: 'M41.5 49m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0',
};

function Seg7({ live }: { live?: Live }) {
  const segs = live?.segs ?? [];
  const lit = (b: number) => `rgb(${Math.round(110 + 145 * b)}, ${Math.round(26 + 20 * b)}, ${Math.round(26 + 14 * b)})`;
  return (
    <>
      {[0, 12, 24, 36, 48].map(x => (
        <g key={x}><rect x={x - 1.6} y={-2} width={3.2} height={8} fill={METAL} /><rect x={x - 1.6} y={54} width={3.2} height={8} fill={METAL} /></g>
      ))}
      <rect x={-6} y={4} width={60} height={52} rx={2} fill="#17181c" />
      <rect x={-3} y={7} width={54} height={46} rx={1.5} fill="#24262b" />
      <g transform="translate(24 30) skewX(-7) translate(-24 -30)">
        {SEGMENTS.map((s, i) => {
          const b = segs[i] ?? 0;
          return (
            <g key={s}>
              {b > 0.05 && <path d={SEG_PATHS[s]} fill="#ff3b30" opacity={0.75 * b} filter="url(#xl-glow-sm)" />}
              <path d={SEG_PATHS[s]} fill={b > 0.02 ? lit(b) : '#3a3d44'} />
            </g>
          );
        })}
      </g>
    </>
  );
}

function Slide({ part }: { part: Part }) {
  const right = !!part.props.pos;
  const kx = right ? 13 : -1;
  return (
    <>
      <Legs xs={[0, 12, 24]} h={7} />
      <rect x={-6} y={-18} width={36} height={12} rx={2} fill="url(#xl-metal)" stroke="#7d8792" strokeWidth={0.6} />
      <rect x={-2.5} y={-15.5} width={29} height={7} rx={1.5} fill="#1b1d22" />
      <rect x={kx} y={-22} width={12} height={15} rx={2} fill="#f4f6f9" stroke="#8f99a4" strokeWidth={0.8} />
      {[3, 6, 9].map(d => <line key={d} x1={kx + d} y1={-19} x2={kx + d} y2={-10} stroke="#b9c2cd" strokeWidth={0.8} />)}
    </>
  );
}

// ---------- Instruments ----------

const METER_MODES: [string, string, number][] = [['V', 'V', -45], ['A', 'mA', 0], ['Ω', 'Ω', 45]];

function Multimeter({ part, live }: { part: Part; live?: Live }) {
  const mode = String(part.props.mode || 'V');
  const angle = METER_MODES.find(m => m[0] === mode)?.[2] ?? -45;
  const r = live?.reading;
  const cx = 18, cy = 98;
  return (
    <>
      <rect x={-30} y={-24} width={96} height={174} rx={12} fill="#f2b705" />
      <rect x={-30} y={-24} width={96} height={174} rx={12} fill="url(#xl-band)" opacity={0.5} />
      <rect x={-23} y={-17} width={82} height={160} rx={8} fill="url(#xl-plastic)" />
      {/* probe jacks along the top, so the leads never cross the display */}
      <text x={0} y={-10.5} textAnchor="middle" style={txt(5.2, '#e8eaee', 700)}>COM</text>
      <text x={36} y={-10.5} textAnchor="middle" style={txt(5.2, '#e8eaee', 700)}>VΩmA</text>
      <circle cx={0} cy={0} r={7.5} fill="#0b0c0e" stroke="#3a3e45" strokeWidth={2.6} />
      <circle cx={36} cy={0} r={7.5} fill="#0b0c0e" stroke="#e5383b" strokeWidth={2.6} />
      {/* display */}
      <rect x={-17} y={14} width={70} height={38} rx={3} fill="#0b0c0e" />
      <rect x={-14} y={17} width={64} height={32} rx={2} fill={live ? '#d3e0b8' : '#9eab8b'} />
      <text x={-11} y={25} style={txt(5.2, '#2b3320', 700)}>{mode === 'Ω' ? '' : 'DC'}</text>
      <text x={47} y={25} textAnchor="end" style={txt(6.4, '#2b3320', 700)}>{live ? r?.unit ?? '' : ''}</text>
      <text x={47} y={45} textAnchor="end" style={{ fontFamily: 'Geist Mono, monospace', fontSize: 17, fontWeight: 600, fill: '#1c2410', pointerEvents: 'none', userSelect: 'none' }}>
        {live ? r?.value ?? '0.00' : '- - -'}
      </text>
      {/* dial */}
      {METER_MODES.map(([m, label, a]) => {
        const rad = (a * Math.PI) / 180;
        return (
          <g key={m}>
            <line x1={cx + 25 * Math.sin(rad)} y1={cy - 25 * Math.cos(rad)} x2={cx + 28.5 * Math.sin(rad)} y2={cy - 28.5 * Math.cos(rad)} stroke={m === mode ? '#f2b705' : '#9aa1ab'} strokeWidth={1.4} />
            <text x={cx + 35 * Math.sin(rad)} y={cy - 35 * Math.cos(rad) + 2.4} textAnchor="middle" style={txt(7, m === mode ? '#f2b705' : '#e8eaee', 700)}>{label}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={23} fill="#2b2e35" stroke="#0b0c0e" strokeWidth={1.2} />
      <g transform={`rotate(${angle} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={18} fill="url(#xl-chip)" stroke="#4a4e57" strokeWidth={0.8} />
        <rect x={cx - 3} y={cy - 22} width={6} height={26} rx={2.5} fill="#e8eaee" />
        <rect x={cx - 1} y={cy - 21} width={2} height={7} rx={1} fill="#e5383b" />
      </g>
      <text x={18} y={139} textAnchor="middle" style={txt(5.4, '#8f99a4', 700)}>XL-1000 Multimeter</text>
    </>
  );
}

const SX = -14, SY = 20, SW = 160, SH = 104;

function fmtTime(ms: number) {
  if (ms < 1) return `${Math.round(ms * 1000)} µs`;
  if (ms >= 1000) return `${ms / 1000} s`;
  return `${ms} ms`;
}

function Scope({ part, live }: { part: Part; live?: Live }) {
  const tdiv = +part.props.tdiv || 2, vdiv = +part.props.vdiv || 1;
  const s = live?.scope;
  const dx = SW / 10, dy = SH / 8;
  const yOf = (v: number) => Math.max(SY, Math.min(SY + SH, SY + SH - dy - (v / vdiv) * dy));
  let line = '';
  let band = '';
  if (s?.line) {
    for (let i = 0; i < s.line.length; i += 2) line += `${i ? 'L' : 'M'}${(SX + s.line[i] * SW).toFixed(1)} ${yOf(s.line[i + 1]).toFixed(1)}`;
  } else if (s?.lo && s.hi) {
    const n = s.lo.length - 1;
    let run: number[] = [];
    const flush = () => {
      if (run.length > 1) {
        const top = run.map((i, k) => `${k ? 'L' : 'M'}${(SX + (i / n) * SW).toFixed(1)} ${yOf(s.hi![i]).toFixed(1)}`).join('');
        const bottom = [...run].reverse().map(i => `L${(SX + (i / n) * SW).toFixed(1)} ${yOf(s.lo![i]).toFixed(1)}`).join('');
        band += `${top}${bottom}Z`;
        line += run.map((i, k) => `${k ? 'L' : 'M'}${(SX + (i / n) * SW).toFixed(1)} ${yOf((s.hi![i] + s.lo![i]) / 2).toFixed(1)}`).join('');
      }
      run = [];
    };
    for (let i = 0; i <= n; i++) { if (Number.isNaN(s.lo[i])) flush(); else run.push(i); }
    flush();
  }
  const mono = { fontFamily: 'Geist Mono, monospace', pointerEvents: 'none' as const, userSelect: 'none' as const };
  const fmtF = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : `${Math.round(f)} Hz`);
  return (
    <>
      <rect x={-24} y={-24} width={216} height={174} rx={8} fill="url(#xl-scope)" />
      {/* probe inputs along the top, so the leads never cross the screen */}
      <text x={0} y={-11} textAnchor="middle" style={txt(5.2, '#f6c215', 700)}>CH1</text>
      <text x={24} y={-11} textAnchor="middle" style={txt(5.2, '#d5dae1', 700)}>GND</text>
      <circle cx={0} cy={0} r={8} fill="url(#xl-metal)" stroke="#5a616c" strokeWidth={0.8} />
      <circle cx={0} cy={0} r={4.6} fill="#0b0c0e" stroke="#f6c215" strokeWidth={1.4} />
      <circle cx={24} cy={0} r={7} fill="#0b0c0e" stroke="#3a3e45" strokeWidth={2.4} />
      <text x={182} y={-9} textAnchor="end" style={txt(6, '#8f99a4', 700)}>XL-Scope 100</text>
      {/* screen */}
      <rect x={SX - 6} y={SY - 6} width={SW + 12} height={SH + 12} rx={4} fill="#0b0c0e" />
      <rect x={SX} y={SY} width={SW} height={SH} fill="#061209" />
      {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={SX + i * dx} y1={SY} x2={SX + i * dx} y2={SY + SH} stroke={i === 5 ? '#1f5a37' : '#13321f'} strokeWidth={0.6} />)}
      {Array.from({ length: 9 }, (_, i) => <line key={`h${i}`} x1={SX} y1={SY + i * dy} x2={SX + SW} y2={SY + i * dy} stroke={i === 7 ? '#1f5a37' : '#13321f'} strokeWidth={0.6} />)}
      <path d={`M${SX} ${SY + SH - dy - 3}l4 3l-4 3Z`} fill="#3dff8b" opacity={0.8} />
      {band && <path d={band} fill="#3dff8b" opacity={0.28} />}
      {line && <path d={line} stroke="#3dff8b" strokeWidth={2.4} fill="none" opacity={0.45} filter="url(#xl-glow-sm)" />}
      {line && <path d={line} stroke="#9dffc4" strokeWidth={1.1} fill="none" strokeLinejoin="round" />}
      <text x={SX + 4} y={SY + 8} style={{ ...mono, fontSize: 6, fill: '#3dff8b' }}>{fmtTime(tdiv)}/div   {vdiv} V/div</text>
      {s ? (
        <text x={SX + 4} y={SY + SH - 4} style={{ ...mono, fontSize: 6, fill: '#3dff8b' }}>
          {s.f ? `${fmtF(s.f)}  ${Math.round((s.duty ?? 0) * 100)}%  ` : ''}avg {s.avg.toFixed(2)} V  max {Number.isFinite(s.vmax) ? s.vmax.toFixed(2) : '0.00'} V
        </text>
      ) : (
        <text x={SX + SW / 2} y={SY + SH / 2} textAnchor="middle" style={{ ...mono, fontSize: 7, fill: '#2f8f55' }}>Start the simulation to see a signal</text>
      )}
      {/* controls */}
      {[[169, 40, 'Time'], [169, 82, 'Volts']].map(([x, y, label]) => (
        <g key={String(label)}>
          <circle cx={+x} cy={+y} r={12} fill="#1b1d22" stroke="#0b0c0e" />
          <circle cx={+x} cy={+y} r={9} fill="url(#xl-metal)" />
          <line x1={+x} y1={+y} x2={+x} y2={+y - 8} stroke="#2b2f36" strokeWidth={1.6} strokeLinecap="round" />
          <text x={+x} y={+y + 20} textAnchor="middle" style={txt(5.2, '#d5dae1', 600)}>{label}</text>
        </g>
      ))}
      <circle cx={169} cy={124} r={3} fill={live ? '#3dff8b' : '#1f3b2a'} />
      <text x={169} y={136} textAnchor="middle" style={txt(5, '#d5dae1', 600)}>Run</text>
    </>
  );
}

function Ne555() {
  return (
    <>
      {[0, 12, 24, 36].map(x => (
        <g key={x}>
          <rect x={x - 1.6} y={-1.5} width={3.2} height={5.5} rx={0.6} fill={METAL} />
          <rect x={x - 1.6} y={20} width={3.2} height={5.5} rx={0.6} fill={METAL} />
        </g>
      ))}
      <rect x={-6} y={3} width={48} height={18} rx={2} fill="url(#xl-chip)" />
      <path d="M-6 8.5A3.5 3.5 0 0 1 -6 15.5Z" fill="#0b0c0e" />
      <circle cx={-1} cy={17} r={1.4} fill="#0b0c0e" />
      <text x={19} y={13.6} textAnchor="middle" style={txt(6.6, '#d4d9e0', 700)}>NE555</text>
      <text x={19} y={18.6} textAnchor="middle" style={txt(3.6, '#8b9099', 500)}>TIMER</text>
    </>
  );
}

function CustomChip({ part }: { part: Part }) {
  const names = String(part.props.pins ?? '').split(',').map(s => s.trim());
  const label = (i: number) => (names[i] && names[i] !== `P${i + 1}` ? names[i] : String(i + 1));
  const top = [7, 6, 5, 4], bottom = [0, 1, 2, 3];
  return (
    <>
      {[0, 12, 24, 36].map(x => (
        <g key={x}>
          <rect x={x - 1.6} y={-1.5} width={3.2} height={5.5} rx={0.6} fill={METAL} />
          <rect x={x - 1.6} y={20} width={3.2} height={5.5} rx={0.6} fill={METAL} />
        </g>
      ))}
      <rect x={-6} y={3} width={48} height={18} rx={2} fill="url(#xl-chip)" />
      <path d="M-6 8.5A3.5 3.5 0 0 1 -6 15.5Z" fill="#0b0c0e" />
      <rect x={-4.5} y={3.8} width={45} height={16.4} rx={1.6} fill="none" stroke="#3b3f47" strokeWidth={0.5} strokeDasharray="1.2 1" />
      {top.map((pi, i) => <text key={pi} x={i * 12} y={7.6} textAnchor="middle" style={txt(2.9, '#8b9099', 600)}>{label(pi).slice(0, 4)}</text>)}
      {bottom.map((pi, i) => <text key={pi} x={i * 12} y={19.2} textAnchor="middle" style={txt(2.9, '#8b9099', 600)}>{label(pi).slice(0, 4)}</text>)}
      <text x={19} y={13.9} textAnchor="middle" style={txt(5, '#d4d9e0', 700)}>{String(part.props.name || 'CUSTOM').slice(0, 10)}</text>
    </>
  );
}

const Plug = ({ x, y, angle }: { x: number; y: number; angle: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${angle})`} pointerEvents="none">
    <rect x={-0.8} y={-0.9} width={3.6} height={1.8} rx={0.5} fill="#c9ced6" />
    <rect x={2.4} y={-2.8} width={8} height={5.6} rx={1.1} fill="#1d1f24" />
    <rect x={3.4} y={-2} width={6} height={1.1} rx={0.5} fill="#fff" opacity={0.14} />
  </g>
);

/** A jumper wire: shadow, coloured insulation, a highlight, and a plug housing at each end. */
export function WireArt({ a, b, bend, color, selected = false }: { a: { x: number; y: number }; b: { x: number; y: number }; bend?: [number, number]; color: string; selected?: boolean }) {
  const g = wireGeom(a, b, bend);
  const ang = (p: { x: number; y: number }, q: { x: number; y: number }) => (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
  return (
    <>
      <path d={g.d} style={selected ? { stroke: 'var(--fg)' } : { stroke: 'rgb(0 0 0 / 0.4)' }} strokeWidth={selected ? 7 : 4.6} fill="none" strokeLinecap="round" />
      <path d={g.d} stroke={color} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <path d={g.d} stroke="#fff" strokeOpacity={0.4} strokeWidth={0.9} fill="none" strokeLinecap="round" transform="translate(-0.5 -0.9)" />
      <Plug x={a.x} y={a.y} angle={ang(a, g.c)} />
      <Plug x={b.x} y={b.y} angle={ang(b, g.c)} />
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
    case 'capacitor': return <Capacitor part={part} live={live} />;
    case 'diode': return <Diode />;
    case 'npn': return <Npn />;
    case 'motor': return <Motor live={live} />;
    case 'seg7': return <Seg7 live={live} />;
    case 'switch': return <Slide part={part} />;
    case 'multimeter': return <Multimeter part={part} live={live} />;
    case 'scope': return <Scope part={part} live={live} />;
    case 'ne555': return <Ne555 />;
    case 'custom': return <CustomChip part={part} />;
  }
});

/** Shared SVG filters and patterns. Render once at the top of the app. */
/** Shared gradients and filters. Rendered once on the page, and again inside exported or rasterized drawings. */
export const ArtDefsContent = () => (
    <defs>
      <filter id="xl-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7" /></filter>
      <filter id="xl-glow-sm" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.5" /></filter>
      {/* Soft contact shadow so parts sit on the workplane instead of floating on it */}
      <filter id="xl-lift" x="-10%" y="-10%" width="125%" height="130%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2.4" floodColor="#000" floodOpacity="0.24" />
      </filter>
      <linearGradient id="xl-pcb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#11909f" /><stop offset="1" stopColor="#0b6f7b" /></linearGradient>
      <linearGradient id="xl-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eef1f4" /><stop offset="0.55" stopColor="#c3cad2" /><stop offset="1" stopColor="#8f99a4" /></linearGradient>
      <linearGradient id="xl-chip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#30333a" /><stop offset="1" stopColor="#15161a" /></linearGradient>
      <linearGradient id="xl-plastic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c2f36" /><stop offset="1" stopColor="#16181c" /></linearGradient>
      <linearGradient id="xl-resistor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1dcb5" /><stop offset="0.45" stopColor="#dcc096" /><stop offset="1" stopColor="#ae8d5d" /></linearGradient>
      <linearGradient id="xl-cap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#163577" /><stop offset="0.38" stopColor="#3a6fd4" /><stop offset="1" stopColor="#14306c" /></linearGradient>
      <linearGradient id="xl-scope" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d424b" /><stop offset="1" stopColor="#24272d" /></linearGradient>
      <linearGradient id="xl-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.25" /></linearGradient>
      <pattern id="xl-mesh" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.7" fill="#3a3e45" /></pattern>
    </defs>
);

export const ArtDefs = () => (
  <svg id="xl-defs" width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <ArtDefsContent />
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
