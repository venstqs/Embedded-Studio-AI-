import { memo } from 'react';

/**
 * The anti-static work mat the circuit sits on. Like a real bench mat it has
 * printed rulers (at true scale: one breadboard hole is 2.54 mm) and the
 * reference charts every beginner looks up: the resistor colour code, Ohm's
 * law, schematic symbols and how a breadboard is joined inside.
 */

export interface MatRect { x0: number; y0: number; x1: number; y1: number }

const MM = 12 / 2.54; // world units per millimetre
const INK = { fill: 'var(--mat-ink)' } as const;
const INK2 = { fill: 'var(--mat-ink-2)' } as const;
const LINE = { stroke: 'var(--mat-ink)' } as const;
const font = (size: number, weight = 500) => ({ fontSize: size, fontWeight: weight, fontFamily: 'Geist, sans-serif', userSelect: 'none' as const });

const BANDS: [string, string][] = [
  ['#1b1b1b', 'black'], ['#7a4a1e', 'brown'], ['#e02424', 'red'], ['#f2801c', 'orange'], ['#f2cf1f', 'yellow'],
  ['#1fa35b', 'green'], ['#2563eb', 'blue'], ['#8b3fd9', 'violet'], ['#8a8f98', 'grey'], ['#ffffff', 'white'],
];

function Rulers({ x0, y0, x1, y1 }: MatRect) {
  let top = '', left = '';
  const labelsTop: number[] = [], labelsLeft: number[] = [];
  for (let i = 0; x0 + 40 + i * MM <= x1 - 40; i++) {
    const x = x0 + 40 + i * MM;
    const len = i % 10 === 0 ? 11 : i % 5 === 0 ? 7 : 4;
    top += `M${x.toFixed(2)} ${y0 + 8}v${len}`;
    if (i % 10 === 0) labelsTop.push(i / 10);
  }
  for (let i = 0; y0 + 40 + i * MM <= y1 - 40; i++) {
    const y = y0 + 40 + i * MM;
    const len = i % 10 === 0 ? 11 : i % 5 === 0 ? 7 : 4;
    left += `M${x0 + 8} ${y.toFixed(2)}h${len}`;
    if (i % 10 === 0) labelsLeft.push(i / 10);
  }
  return (
    <g pointerEvents="none">
      <path d={top} style={LINE} strokeWidth={0.8} />
      <path d={left} style={LINE} strokeWidth={0.8} />
      {labelsTop.map(n => <text key={n} x={x0 + 40 + n * 10 * MM} y={y0 + 30} textAnchor="middle" style={{ ...font(7), ...INK }}>{n}</text>)}
      {labelsLeft.map(n => n > 0 && <text key={n} x={x0 + 30} y={y0 + 40 + n * 10 * MM + 2.5} textAnchor="middle" style={{ ...font(7), ...INK }}>{n}</text>)}
      <text x={x0 + 40} y={y0 + 30} dx={-12} textAnchor="end" style={{ ...font(7, 600), ...INK }}>cm</text>
    </g>
  );
}

function ColourCode() {
  return (
    <g>
      <text y={0} style={{ ...font(12, 650), ...INK }}>Resistor colour code</text>
      {BANDS.map(([c, name], i) => (
        <g key={name} transform={`translate(${i * 40} 14)`}>
          <rect width={32} height={22} rx={3} fill={c} style={{ stroke: 'var(--mat-ink-2)' }} strokeWidth={0.6} />
          <text x={16} y={38} textAnchor="middle" style={{ ...font(11, 650), ...INK }}>{i}</text>
          <text x={16} y={50} textAnchor="middle" style={{ ...font(7.5), ...INK2 }}>{name}</text>
        </g>
      ))}
      <g transform="translate(0 84)">
        <line x1={0} y1={14} x2={150} y2={14} stroke="#9aa3ad" strokeWidth={2.4} strokeLinecap="round" />
        <rect x={34} y={3} width={82} height={22} rx={10} fill="#dcc096" />
        {['#e02424', '#e02424', '#7a4a1e'].map((c, k) => <rect key={k} x={46 + k * 13} y={3} width={7} height={22} fill={c} />)}
        <rect x={98} y={3} width={7} height={22} fill="#c9a227" />
        <text x={170} y={12} style={{ ...font(10, 600), ...INK }}>red, red, brown, gold</text>
        <text x={170} y={26} style={{ ...font(10), ...INK2 }}>2, 2, then ×10  =  220 Ω, give or take 5%</text>
      </g>
    </g>
  );
}

function OhmsLaw() {
  return (
    <g>
      <text y={0} style={{ ...font(12, 650), ...INK }}>Ohm’s law</text>
      <g transform="translate(0 16)">
        <path d="M70 0L0 118H140Z" fill="none" style={LINE} strokeWidth={1.4} />
        <path d="M24 70H116M70 70V118" fill="none" style={LINE} strokeWidth={1.2} />
        <text x={70} y={56} textAnchor="middle" style={{ ...font(22, 700), ...INK }}>V</text>
        <text x={42} y={104} textAnchor="middle" style={{ ...font(20, 700), ...INK }}>I</text>
        <text x={98} y={104} textAnchor="middle" style={{ ...font(20, 700), ...INK }}>R</text>
        <text x={162} y={30} style={{ ...font(11, 600), ...INK }}>V = I × R</text>
        <text x={162} y={50} style={{ ...font(11, 600), ...INK }}>I = V ÷ R</text>
        <text x={162} y={70} style={{ ...font(11, 600), ...INK }}>R = V ÷ I</text>
        <text x={162} y={96} style={{ ...font(8.5), ...INK2 }}>Cover the one you want.</text>
        <text x={162} y={108} style={{ ...font(8.5), ...INK2 }}>V volts, I amps, R ohms.</text>
      </g>
    </g>
  );
}

function Symbols() {
  const s = { ...LINE, fill: 'none' };
  const items: [string, React.ReactNode][] = [
    ['Resistor', <path key="r" d="M0 20h10l4-8 6 16 6-16 6 16 6-16 4 8h10" style={s} strokeWidth={1.4} strokeLinejoin="round" />],
    ['LED', <g key="l" style={s} strokeWidth={1.4}><path d="M0 20h16M40 20h16M16 8v24l24-12z M40 8v24" /><path d="M30 6l6-6M36 10l6-6" /><path d="M36 0h0" /></g>],
    ['Capacitor', <g key="c" style={s} strokeWidth={1.4}><path d="M0 20h24M32 20h24M24 6v28" /><path d="M32 6q-4 14 0 28" /><path d="M14 8h4M16 6v4" /></g>],
    ['Battery', <g key="b" style={s} strokeWidth={1.4}><path d="M0 20h22M34 20h22M22 4v32M28 11v18M34 4v32" /></g>],
    ['Switch', <g key="s" style={s} strokeWidth={1.4}><path d="M0 22h14M42 22h14M14 22l26-12" /><circle cx={14} cy={22} r={2} /><circle cx={42} cy={22} r={2} /></g>],
    ['NPN transistor', <g key="q" style={s} strokeWidth={1.4}><circle cx={30} cy={20} r={17} /><path d="M2 20h20M22 9v22M22 15l14-10M22 25l14 10v6M36 -1v6" /><path d="M31 31l5 4-6 1" /></g>],
    ['Ground', <g key="g" style={s} strokeWidth={1.4}><path d="M28 0v18M14 18h28M19 24h18M24 30h8" /></g>],
  ];
  return (
    <g>
      <text y={0} style={{ ...font(12, 650), ...INK }}>Schematic symbols</text>
      {items.map(([label, art], i) => (
        <g key={label} transform={`translate(${i * 84} 18)`}>
          <g transform="translate(6 8)">{art}</g>
          <text x={34} y={66} textAnchor="middle" style={{ ...font(8.5, 550), ...INK }}>{label}</text>
        </g>
      ))}
    </g>
  );
}

function BreadboardKey() {
  const hole = (x: number, y: number, k: string) => <rect key={k} x={x - 2} y={y - 2} width={4} height={4} rx={0.8} style={INK2} />;
  const holes: React.ReactNode[] = [];
  for (let c = 0; c < 12; c++) {
    for (let r = 0; r < 5; r++) holes.push(hole(18 + c * 12, 30 + r * 10, `t${c}${r}`));
    for (let r = 0; r < 5; r++) holes.push(hole(18 + c * 12, 92 + r * 10, `b${c}${r}`));
    holes.push(hole(18 + c * 12, 8, `p${c}`), hole(18 + c * 12, 144, `n${c}`));
  }
  return (
    <g>
      <text y={0} style={{ ...font(12, 650), ...INK }}>Inside a breadboard</text>
      <g transform="translate(0 12)">
        <rect x={6} y={0} width={156} height={154} rx={6} fill="none" style={LINE} strokeWidth={1.2} />
        <rect x={9} y={3} width={150} height={10} rx={3} fill="#e5383b" opacity={0.28} />
        <rect x={9} y={139} width={150} height={10} rx={3} fill="#2563eb" opacity={0.28} />
        {[2, 3].map(c => <rect key={c} x={14 + c * 12} y={25} width={8} height={50} rx={3} fill="#1fa35b" opacity={0.35} />)}
        {[2, 3].map(c => <rect key={`b${c}`} x={14 + c * 12} y={87} width={8} height={50} rx={3} fill="#1fa35b" opacity={0.35} />)}
        {holes}
        <text x={176} y={12} style={{ ...font(9.5, 600), ...INK }}>Long rails: power and ground</text>
        <text x={176} y={50} style={{ ...font(9.5, 600), ...INK }}>Each column of 5 is</text>
        <text x={176} y={62} style={{ ...font(9.5, 600), ...INK }}>one connection</text>
        <text x={176} y={86} style={{ ...font(8.5), ...INK2 }}>The middle gap keeps</text>
        <text x={176} y={97} style={{ ...font(8.5), ...INK2 }}>the two halves apart</text>
      </g>
    </g>
  );
}

export default memo(function BenchMat({ x0, y0, x1, y1 }: MatRect) {
  let grid = '';
  for (let x = Math.ceil(x0 / 60) * 60; x < x1; x += 60) grid += `M${x} ${y0}V${y1}`;
  for (let y = Math.ceil(y0 / 60) * 60; y < y1; y += 60) grid += `M${x0} ${y}H${x1}`;
  const refY = y1 - 236;
  return (
    <g pointerEvents="none" aria-hidden="true">
      <rect x={x0 + 6} y={y0 + 10} width={x1 - x0} height={y1 - y0} rx={28} fill="rgb(0 0 0 / 0.18)" />
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={28} style={{ fill: 'var(--mat)', stroke: 'var(--mat-edge)' }} strokeWidth={2} />
      <clipPath id="xl-mat-clip"><rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={28} /></clipPath>
      <path d={grid} style={{ stroke: 'var(--mat-line)' }} strokeWidth={1} vectorEffect="non-scaling-stroke" clipPath="url(#xl-mat-clip)" />
      <Rulers x0={x0} y0={y0} x1={x1} y1={y1} />
      <g transform={`translate(${x0 + 48} ${y0 + 60})`}>
        <text style={{ ...font(15, 700), ...INK, letterSpacing: '-0.01em' }}>XavierLabs</text>
        <text y={16} style={{ ...font(9.5), ...INK2 }}>Anti-static work mat. Grid squares are 12.7 mm, five breadboard holes.</text>
      </g>
      <g transform={`translate(${x0 + 60} ${refY})`}>
        <ColourCode />
        <g transform="translate(470 0)"><OhmsLaw /></g>
        <g transform="translate(790 0)"><Symbols /></g>
        <g transform="translate(1400 0)"><BreadboardKey /></g>
      </g>
    </g>
  );
});
