import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, Box, Cable, CircleAlert, Clock, Code, Cpu, Gauge, Info, Layers, MousePointer2, Play, Plus, Rotate3d,
  ShieldCheck, Terminal, Trash2, TriangleAlert, Zap,
} from 'lucide-react';
import { GithubMark, Logo } from './ui';
import { XAVIERLABS } from '../brand';
import type { Live, PartType, Project } from '../types';
import { PARTS, PART_ORDER, pivot, toWorld } from '../parts/catalog';
import { PartArt, PartThumb } from '../parts/PartArt';
import { STARTERS } from '../data/projects';
import type { Starter } from '../data/projects';
import type { Saved } from '../App';

const Bench3D = lazy(() => import('./Bench3D'));

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';

/** A drawing of a whole circuit, made from the same art as the workplane. */
function CircuitPreview({ project, live }: { project: Project; live?: Record<string, Live> }) {
  const { box, pins } = useMemo(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const pins = new Map<string, { x: number; y: number }>();
    for (const part of project.parts) {
      const [a, b, c, d] = PARTS[part.type].box;
      for (const [lx, ly] of [[a, b], [c, b], [a, d], [c, d]]) {
        const w = toWorld(part, lx, ly);
        x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y);
      }
      for (const p of PARTS[part.type].pins) pins.set(`${part.id}:${p.id}`, toWorld(part, p.x, p.y));
    }
    return { box: [x0 - 16, y0 - 16, x1 - x0 + 32, y1 - y0 + 32], pins };
  }, [project]);

  return (
    <svg viewBox={box.join(' ')} className="h-full w-full" aria-hidden="true">
      {project.parts.map(part => {
        const [cx, cy] = pivot(part.type);
        return (
          <g key={part.id} filter={part.type === 'breadboard' ? undefined : 'url(#xl-lift)'}>
            <g transform={`translate(${part.x} ${part.y}) rotate(${part.rot} ${cx} ${cy})`}>
              <PartArt part={part} live={live?.[part.id]} running={!!live} />
            </g>
          </g>
        );
      })}
      {project.wires.map(w => {
        const a = pins.get(w.from), b = pins.get(w.to);
        if (!a || !b) return null;
        const sag = Math.min(34, Math.hypot(b.x - a.x, b.y - a.y) * 0.16);
        const d = `M${a.x} ${a.y}Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + sag} ${b.x} ${b.y}`;
        return (
          <g key={w.id}>
            <path d={d} stroke="rgb(0 0 0 / 0.4)" strokeWidth={4.6} fill="none" strokeLinecap="round" />
            <path d={d} stroke={w.color} strokeWidth={3.2} fill="none" strokeLinecap="round" />
            <path d={d} stroke="#fff" strokeOpacity={0.4} strokeWidth={0.9} fill="none" strokeLinecap="round" transform="translate(-0.5 -0.9)" />
          </g>
        );
      })}
    </svg>
  );
}

const dots = { backgroundImage: 'radial-gradient(circle, var(--grid) 1px, transparent 1.3px)', backgroundSize: '16px 16px' };

/** Flowing signal lines behind the hero, the same motif as the XavierLabs site. */
function WaveField({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0, t = 0, w = 0, h = 0, fg = '#fff';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const readColor = () => { fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#fff'; };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1;
      const N = 36;
      for (let k = 0; k < N; k++) {
        ctx.globalAlpha = 0.03 + 0.12 * Math.sin((Math.PI * k) / N) ** 2;
        ctx.beginPath();
        for (let x = 0; x <= w + 8; x += 8) {
          const u = x / w;
          const y = h * 0.7 - u * h * 0.42
            + Math.sin(u * 5.2 + t * 0.55 + k * 0.11) * h * 0.08 * (0.35 + u)
            + Math.sin(u * 2.1 - t * 0.3 + k * 0.05) * h * 0.05
            + (k - N / 2) * h * 0.0055 * (1 + u * 2.2);
          if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    const resize = () => {
      const r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    const loop = () => { t += 0.016; draw(); raf = requestAnimationFrame(loop); };
    readColor();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    resize();
    // Only animate while on screen.
    const io = new IntersectionObserver(([e]) => { cancelAnimationFrame(raf); if (e.isIntersecting && !still()) raf = requestAnimationFrame(loop); });
    io.observe(c);
    const mo = new MutationObserver(() => { readColor(); draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect(); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    style={{ maskImage: 'linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)' }} />;
}

/** "Build a [blinking LED]" with the last words typed in and out, like the XavierLabs site. */
const WORDS = ['blinking LED', '555 timer', 'parking sensor', 'weather station', 'traffic light', 'motor controller', 'night light'];
function Typer() {
  const [i, setI] = useState(0);
  const [n, setN] = useState(WORDS[0].length);
  const [del, setDel] = useState(false);
  useEffect(() => {
    if (still()) return;
    const word = WORDS[i];
    const t = setTimeout(() => {
      if (!del) { if (n < word.length) setN(n + 1); else setDel(true); }
      else if (n > 0) setN(n - 1);
      else { setDel(false); setI((i + 1) % WORDS.length); }
    }, !del && n === WORDS[i].length ? 1700 : del ? 32 : 65);
    return () => clearTimeout(t);
  }, [i, n, del]);
  return (
    <p className="mt-6 flex flex-wrap items-center gap-2.5 text-[19px] font-medium tracking-tight text-fg-2" aria-label="Build a circuit">
      Build a
      <span className="inline-flex h-10 items-center rounded-lg bg-inverse px-3.5 font-medium text-on-inverse shadow-lg">
        {WORDS[i].slice(0, n)}
        <span className="type-caret ml-0.5 inline-block h-5 w-[2px] bg-current" aria-hidden="true" />
      </span>
    </p>
  );
}

/** Fades sections up as they scroll into view. */
function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as never} className={`reveal ${shown ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</Tag>;
}

const BLINK_CODE = [
  ['const int LED_PIN = 13;', ''],
  ['', ''],
  ['void setup() {', ''],
  ['  pinMode(LED_PIN, OUTPUT);', ''],
  ['}', ''],
  ['', ''],
  ['void loop() {', ''],
  ['  digitalWrite(LED_PIN, HIGH);', 'on'],
  ['  delay(1000);', ''],
  ['  digitalWrite(LED_PIN, LOW);', 'off'],
  ['  delay(1000);', ''],
  ['}', ''],
];

/** The Blink starter running, shown three ways: built in 3D, drawn in 2D, and as code. */
function Showcase({ dark }: { dark: boolean }) {
  const project = useMemo(() => STARTERS[0].build(), []);
  const [tab, setTab] = useState<'3d' | '2d' | 'code'>('3d');
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (still()) return;
    const t = setInterval(() => setOn(o => !o), 1000);
    return () => clearInterval(t);
  }, []);
  const live: Record<string, Live> = useMemo(() => ({ led: { b: on ? 1 : 0, ma: on ? 13.6 : 0 }, board: { on: true, b: on ? 1 : 0 } }), [on]);
  const preset = useMemo(() => ({ name: 'iso' as const, n: 0 }), []);
  const noop = () => {};

  return (
    <div className="showcase card relative overflow-hidden shadow-2xl">
      <div className="flex h-11 items-center gap-2 border-b border-line px-3">
        <span className="flex gap-1.5 pl-0.5" aria-hidden="true">{[0, 1, 2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-surface-3" />)}</span>
        <span className="ml-2 text-[12.5px] font-medium">Blink an LED</span>
        <span className="chip ml-1 hidden sm:inline-flex"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />Running</span>
        <span className="flex-1" />
        <div className="seg" role="tablist" aria-label="Showcase view">
          {([['3d', '3D'], ['2d', '2D'], ['code', 'Code']] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} aria-checked={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="relative aspect-[16/10] bg-canvas">
        {tab === '3d' && (
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-[12.5px] text-fg-3">Building the bench…</div>}>
            <Bench3D parts={project.parts} wires={project.wires} live={live} running flow={{}} dark={dark} selected={[]} preset={preset}
              onSelect={noop} onPress={noop} onToggle={noop} autoRotate zoom={1.7} />
          </Suspense>
        )}
        {tab === '2d' && <div className="absolute inset-0 p-6" style={dots}><CircuitPreview project={project} live={live} /></div>}
        {tab === 'code' && (
          <div className="absolute inset-0 overflow-hidden px-5 py-4 font-mono text-[12.5px] leading-[1.7]" style={{ background: 'var(--code-bg)', color: 'var(--code-fg)' }}>
            {BLINK_CODE.map(([line, when], i) => {
              const hot = (when === 'on' && on) || (when === 'off' && !on);
              return (
                <div key={i} className={`-mx-2 flex rounded px-2 transition-colors duration-300 ${hot ? 'bg-surface-3' : ''}`}>
                  <span className="w-7 shrink-0 text-right select-none" style={{ color: 'var(--code-gutter)' }}>{i + 1}</span>
                  <span className="pl-4 whitespace-pre" style={{ color: hot ? 'var(--code-fg)' : line.startsWith('void') || line.startsWith('const') ? 'var(--code-keyword)' : 'var(--code-fg)', opacity: when && !hot ? 0.55 : 1 }}>{line || ' '}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2">
          <span className="rounded-md bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] px-2 py-1 font-mono text-[11px] text-fg-2 backdrop-blur">
            {on ? 'D13 HIGH · LED 13.6 mA' : 'D13 LOW · LED off'}
          </span>
          {tab === '3d' && <span className="hidden rounded-md bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] px-2 py-1 text-[11px] text-fg-3 backdrop-blur sm:inline">Drag to orbit</span>}
        </div>
      </div>
    </div>
  );
}

const MARQUEE: [ReactNode, string][] = [
  [<Rotate3d key="a" size={13} />, '2D and 3D build views'], [<Activity key="b" size={13} />, 'Oscilloscope'], [<Gauge key="c" size={13} />, 'Multimeter'],
  [<Cpu key="d" size={13} />, 'Arduino Uno'], [<Cpu key="e" size={13} />, 'ESP32'], [<Zap key="f" size={13} />, 'Live current flow'], [<Layers key="g" size={13} />, '555 timer'],
  [<ShieldCheck key="h" size={13} />, 'Circuit check'], [<Code key="i" size={13} />, 'Real Arduino code'], [<Terminal key="j" size={13} />, 'Serial monitor and plotter'],
  [<Cable key="k" size={13} />, 'SPICE netlist export'], [<MousePointer2 key="l" size={13} />, 'CAD-style editing'], [<Box key="m" size={13} />, 'Every part in 3D'],
];

function Marquee() {
  const row = MARQUEE.map(([icon, label]) => (
    <span key={label} className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-line-2 px-4 text-[12.5px] font-medium whitespace-nowrap text-fg-2">
      <span className="text-fg-3">{icon}</span>{label}
    </span>
  ));
  return (
    <div className="marquee-mask relative overflow-hidden border-y border-line py-4" aria-label="Features">
      <div className="marquee flex w-max gap-3">{row}{row.map(r => <span key={`b-${r.key}`} aria-hidden="true" className="contents">{r}</span>)}</div>
    </div>
  );
}

// ---------- Bento visuals ----------

function IsoBoard({ project }: { project: Project }) {
  return (
    <div className="relative grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3 p-6">
      <div className="aspect-[4/3] rounded-lg border border-line bg-canvas p-3" style={dots}><CircuitPreview project={project} /></div>
      <span className="grid h-9 w-9 place-items-center rounded-full border border-line-2 bg-surface text-fg-2"><ArrowRight size={15} /></span>
      <div className="iso-wrap">
        <div className="iso aspect-[4/3] rounded-lg border border-line-2 bg-canvas p-3 shadow-2xl" style={dots}><CircuitPreview project={project} /></div>
      </div>
    </div>
  );
}

function ScopeScreen() {
  const wave = Array.from({ length: 14 }, (_, i) => `${i * 40},${i % 2 ? 22 : 62} ${i * 40 + 40},${i % 2 ? 22 : 62}`).join(' ');
  return (
    <div className="mx-5 mb-5 overflow-hidden rounded-lg border border-line-2 bg-[#06100b] p-2">
      <svg viewBox="0 0 280 84" className="h-24 w-full" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6].map(i => <line key={i} x1={i * 40} x2={i * 40} y1={0} y2={84} stroke="#1c3a29" strokeWidth={0.6} />)}
        {[1, 2, 3].map(i => <line key={i} x1={0} x2={280} y1={i * 21} y2={i * 21} stroke="#1c3a29" strokeWidth={0.6} />)}
        <g className="scope-run"><polyline points={wave} fill="none" stroke="#45f29a" strokeWidth={2} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px #45f29a)' }} /></g>
        <text x={6} y={11} fill="#45f29a" fontSize={8} fontFamily="Geist Mono, monospace">490 Hz · 50% · 5 V/div</text>
      </svg>
    </div>
  );
}

function CurrentLoop() {
  return (
    <div className="mx-5 mb-5 flex items-center gap-4 rounded-lg border border-line bg-canvas px-4 py-3" style={dots}>
      <svg viewBox="0 0 120 60" className="h-16 w-28 shrink-0" aria-hidden="true">
        <rect x={8} y={8} width={104} height={44} rx={8} fill="none" stroke="var(--line-2)" strokeWidth={3} />
        <rect x={8} y={8} width={104} height={44} rx={8} fill="none" stroke="var(--fg)" strokeWidth={2} strokeDasharray="2.6 9.4" strokeLinecap="round" className="xl-flow" />
        <circle cx={60} cy={8} r={6} fill="#ff4040" style={{ filter: 'drop-shadow(0 0 6px #ff4040)' }} />
        <rect x={100} y={22} width={24} height={16} rx={3} fill="var(--surface-3)" stroke="var(--line-2)" />
      </svg>
      <div className="font-mono text-[11.5px] leading-relaxed">
        <p className="text-fg">I = 13.6 mA</p>
        <p className="text-fg-3">V<sub>LED</sub> = 2.01 V</p>
        <p className="text-fg-3">R = 220 Ω</p>
      </div>
    </div>
  );
}

function CheckList() {
  const rows: [ReactNode, string, string][] = [
    [<CircleAlert key="a" size={14} className="text-bad" />, 'Short circuit', '5V joined to GND'],
    [<TriangleAlert key="b" size={14} className="text-warn" />, 'No resistor', 'LED1 will burn out'],
    [<TriangleAlert key="c" size={14} className="text-warn" />, 'In backwards', 'C1 is reversed'],
    [<Info key="d" size={14} className="text-fg-3" />, 'Extra wire', 'Does nothing'],
  ];
  return (
    <ul className="mx-5 mb-5 divide-y divide-line overflow-hidden rounded-lg border border-line bg-canvas">
      {rows.map(([icon, t, s]) => (
        <li key={t} className="flex items-center gap-2.5 px-3 py-2 text-[12px]">{icon}<span className="font-medium">{t}</span><span className="ml-auto text-fg-3">{s}</span></li>
      ))}
    </ul>
  );
}

function CodeSnip() {
  const k = { color: 'var(--code-keyword)', fontWeight: 600 }, f = { color: 'var(--code-function)' }, n = { color: 'var(--code-number)' }, s = { color: 'var(--code-string)' }, c = { color: 'var(--code-comment)' };
  return (
    <pre className="mx-5 mb-5 overflow-hidden rounded-lg border border-line px-3.5 py-3 font-mono text-[11.5px] leading-[1.7]" style={{ background: 'var(--code-bg)', color: 'var(--code-fg)' }}>
      <span style={k}>int</span> raw = <span style={f}>analogRead</span>(A0);{'\n'}
      <span style={k}>int</span> pct = <span style={f}>map</span>(raw, <span style={n}>0</span>, <span style={n}>1023</span>, <span style={n}>0</span>, <span style={n}>100</span>);{'\n'}
      Serial.<span style={f}>print</span>(<span style={s}>"light:"</span>);{'\n'}
      Serial.<span style={f}>println</span>(pct); <span style={c}>// graphed live</span>
    </pre>
  );
}

function Keys() {
  const keys: [string, string][] = [['Box select', 'drag'], ['Copy, paste', 'Ctrl C V'], ['Rotate', 'R'], ['Nudge', '← →'], ['Align', '8 ways'], ['Fit', 'F']];
  return (
    <div className="mx-5 mb-5 grid grid-cols-2 gap-1.5">
      {keys.map(([a, b]) => (
        <span key={a} className="flex items-center justify-between rounded-md border border-line bg-canvas px-2.5 py-1.5 text-[12px]">
          {a}<span className="kbd">{b}</span>
        </span>
      ))}
    </div>
  );
}

function Tile({ icon, title, text, children, className = '', delay = 0 }: { icon: ReactNode; title: string; text: string; children?: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={`bento card flex flex-col overflow-hidden ${className}`}>
      <div className="p-5 pb-4">
        <span className="mb-3 grid h-8 w-8 place-items-center rounded-lg border border-line-2 bg-surface-2 text-fg-2">{icon}</span>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">{text}</p>
      </div>
      <div className="mt-auto flex min-h-0 flex-1 flex-col justify-end">{children}</div>
    </Reveal>
  );
}

// ---------- Projects ----------

const LEVEL_DOTS: Record<Starter['level'], number> = { 'Start here': 1, 'Next steps': 2, 'Bigger builds': 3 };
const MINUTES: Record<Starter['level'], number> = { 'Start here': 5, 'Next steps': 10, 'Bigger builds': 20 };
const thumb = (t: PartType) => ({ id: t, type: t, x: 0, y: 0, rot: 0 as const, props: PARTS[t].defaults });

function StarterCard({ s, onOpen }: { s: Starter; onOpen: () => void }) {
  const project = useMemo(() => s.build(), [s]);
  const kinds = [...new Set(s.parts)].filter(t => t !== 'breadboard');
  return (
    <li>
      <button onClick={onOpen} className="group card flex h-full w-full flex-col overflow-hidden text-left transition-all hover:-translate-y-0.5 hover:border-line-2 hover:shadow-xl">
        <div className="relative h-40 w-full overflow-hidden border-b border-line bg-canvas p-4" style={dots}>
          <div className="h-full transition-transform duration-500 group-hover:scale-[1.04]"><CircuitPreview project={project} /></div>
          <span className="absolute top-3 left-3 flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] px-1.5 py-1 backdrop-blur" aria-label={`Difficulty ${LEVEL_DOTS[s.level]} of 3`}>
            {[1, 2, 3].map(i => <span key={i} className={`h-1.5 w-3 rounded-full ${i <= LEVEL_DOTS[s.level] ? 'bg-fg' : 'bg-line-2'}`} />)}
          </span>
          <span className="absolute right-3 bottom-3 flex h-8 w-8 translate-y-1 items-center justify-center rounded-full bg-inverse text-on-inverse opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100" aria-hidden="true">
            <Play size={13} fill="currentColor" />
          </span>
        </div>
        <div className="flex w-full flex-1 flex-col p-4">
          <h3 className="text-[14px] font-semibold">{s.title}</h3>
          <p className="mt-1 line-clamp-2 flex-1 text-[12.5px] leading-relaxed text-fg-2">{s.summary}</p>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="flex -space-x-1.5">
              {kinds.slice(0, 4).map(t => (
                <span key={t} className="grid h-6 w-6 place-items-center rounded-full border border-line bg-surface-2" data-tip={PARTS[t].name} data-tip-pos="top"><PartThumb part={thumb(t)} size={15} /></span>
              ))}
              {kinds.length > 4 && <span className="grid h-6 w-6 place-items-center rounded-full border border-line bg-surface-2 font-mono text-[9.5px] text-fg-2">+{kinds.length - 4}</span>}
            </span>
            <span className="flex-1" />
            <span className="flex items-center gap-1 text-[11.5px] text-fg-3"><Clock size={11} aria-hidden="true" />{MINUTES[s.level]} min</span>
          </div>
        </div>
      </button>
    </li>
  );
}

function ago(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'Edited just now';
  if (s < 3600) return `Edited ${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `Edited ${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'Edited yesterday' : d < 30 ? `Edited ${d} days ago` : `Edited ${new Date(t).toLocaleDateString()}`;
}

function SavedCard({ item, open, onOpen, onDelete }: { item: Saved; open: boolean; onOpen: () => void; onDelete: () => void }) {
  return (
    <li className="group relative">
      <button onClick={onOpen} className="card flex w-full flex-col overflow-hidden text-left transition-all hover:-translate-y-0.5 hover:border-line-2 hover:shadow-xl">
        <span className="block h-32 w-full border-b border-line bg-canvas p-3" style={dots}><CircuitPreview project={item.project} /></span>
        <span className="flex w-full items-center gap-2 px-3.5 py-3 pr-11">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{item.project.name}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-fg-3">
              {open && <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />}
              {open ? 'Open now' : ago(item.updated)}
            </span>
          </span>
        </span>
      </button>
      <button onClick={onDelete} aria-label={`Delete ${item.project.name}`} data-tip="Delete" data-tip-pos="top"
        className="btn btn-ghost btn-sm btn-icon absolute right-2.5 bottom-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
        <Trash2 size={14} />
      </button>
    </li>
  );
}

const LEVELS: [Starter['level'], string][] = [
  ['Start here', 'No experience needed. Each one runs the moment you press Start.'],
  ['Next steps', 'Read sensors, fade lights, make sound, and look at signals.'],
  ['Bigger builds', 'Several parts working together, like a real project.'],
];

interface Props {
  saved: Saved[];
  currentId: string;
  dark: boolean;
  onOpenSaved: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
  onBlank: () => void;
  onDiscover: () => void;
}

export default function Home({ saved, currentId, dark, onOpenSaved, onDelete, onOpen, onBlank, onDiscover }: Props) {
  const [level, setLevel] = useState<Starter['level'] | 'all'>('all');
  const shownStarters = STARTERS.filter(s => level === 'all' || s.level === level);
  const iso = useMemo(() => STARTERS.find(s => s.id === 'ne555')?.build() ?? STARTERS[0].build(), []);
  const recent = saved[0];
  const partTypes = PART_ORDER.filter(t => t !== 'breadboard');

  return (
    <div className="scroll h-full overflow-auto">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <WaveField />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-5 pt-14 pb-16 sm:px-10 lg:grid-cols-[1.08fr_1fr] lg:pt-20 lg:pb-24">
          <div className="hero-in">
            <a href={XAVIERLABS.site} target="_blank" rel="noreferrer" className="group inline-flex h-8 items-center gap-2 rounded-full border border-line-2 bg-surface/60 pr-3 pl-1 text-[12px] font-medium text-fg-2 backdrop-blur hover:text-fg">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-inverse text-on-inverse"><Logo size={12} /></span>
              XavierLabs IDE
              <span className="hidden text-fg-3 sm:inline">·</span>
              <span className="hidden text-fg-3 group-hover:text-fg-2 sm:inline">electronics lab in the browser</span>
              <ArrowUpRight size={12} className="text-fg-3" />
            </a>
            <h1 className="mt-6 text-[44px] leading-[0.98] font-semibold tracking-[-0.045em] sm:text-[60px] xl:text-[68px]">
              Learn electronics<br />by building it.
            </h1>
            <Typer />
            <p className="mt-6 max-w-[470px] text-[16px] leading-relaxed text-fg-2">
              Wire real parts on a breadboard, write Arduino code and watch current flow. Then flip to 3D and see the same circuit built on your bench. Nothing ever burns out.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <button className="btn btn-primary btn-lg" onClick={() => onOpen('blink')}>Start building <ArrowRight size={16} aria-hidden="true" /></button>
              <button className="btn btn-lg bg-surface/60 backdrop-blur" onClick={onDiscover}><Box size={16} aria-hidden="true" /> Explore parts in 3D</button>
            </div>
            {recent && (
              <button onClick={() => onOpenSaved(recent.id)} className="group mt-4 flex items-center gap-2 text-[13px] text-fg-2 hover:text-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
                Continue <span className="font-medium text-fg">“{recent.project.name}”</span>
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            <dl className="mt-10 grid max-w-[460px] grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {([[String(PART_ORDER.length), 'parts to build with'], [String(STARTERS.length), 'guided projects'], ['0', 'installs or sign-ups']] as const).map(([v, l]) => (
                <div key={l} className="bg-surface/80 px-4 py-3 backdrop-blur">
                  <dt className="sr-only">{l}</dt>
                  <dd className="text-[22px] font-semibold tracking-tight tabular-nums">{v}</dd>
                  <dd className="text-[11.5px] text-fg-3">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="hero-in [animation-delay:120ms]"><Showcase dark={dark} /></div>
        </div>
      </section>

      <Marquee />

      <div className="mx-auto max-w-[1240px] px-5 sm:px-10">
        {/* ---------- Jump back in ---------- */}
        {saved.length > 0 && (
          <Reveal as="section" className="pt-16" >
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="eyebrow">Your bench</p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-tight">Jump back in</h2>
              </div>
              <span className="chip mb-1">{saved.length}</span>
              <span className="flex-1" />
              <button className="btn btn-sm" onClick={onBlank}><Plus size={13} aria-hidden="true" /> New blank project</button>
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {saved.slice(0, 8).map(item => <SavedCard key={item.id} item={item} open={item.id === currentId} onOpen={() => onOpenSaved(item.id)} onDelete={() => onDelete(item.id)} />)}
            </ul>
          </Reveal>
        )}

        {/* ---------- Inside the lab ---------- */}
        <section className="pt-20" aria-labelledby="inside">
          <Reveal className="max-w-[700px]">
            <p className="eyebrow">Inside the lab</p>
            <h2 id="inside" className="mt-2 text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[42px]">A real bench, without the smoke.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-fg-2">Every tool you would find on an electronics bench, simulated properly and explained as you go.</p>
          </Reveal>
          <div className="mt-10 grid gap-3 md:grid-cols-6">
            <Tile className="md:col-span-4 md:row-span-2" icon={<Rotate3d size={15} />} title="Build in 2D. See it in 3D."
              text="Lay out parts on a flat drawing like a CAD tool, then flip one switch to see the same circuit built for real: legs in the holes, jumper wires arching between plugs, LEDs glowing while it runs.">
              <div className="min-h-[19rem] flex-1 border-t border-line"><IsoBoard project={iso} /></div>
            </Tile>
            <Tile className="md:col-span-2" delay={60} icon={<Zap size={15} />} title="Real physics, live" text="A circuit solver works out every voltage and current, 60 times a second. Watch the current flow.">
              <CurrentLoop />
            </Tile>
            <Tile className="md:col-span-2" delay={120} icon={<Activity size={15} />} title="Bench instruments" text="Probe signals with an oscilloscope and a multimeter, just like the real thing.">
              <ScopeScreen />
            </Tile>
            <Tile className="md:col-span-2" icon={<Code size={15} />} title="Arduino code that runs" text="Write real sketches, then read them back in the serial monitor and plotter.">
              <CodeSnip />
            </Tile>
            <Tile className="md:col-span-2" delay={60} icon={<ShieldCheck size={15} />} title="Catches mistakes first" text="Circuit check finds shorts, backwards parts and missing resistors before you press Start.">
              <CheckList />
            </Tile>
            <Tile className="md:col-span-2" delay={120} icon={<MousePointer2 size={15} />} title="Edits like a CAD tool" text="Box select, align, copy and paste, a minimap, and export to PNG, SVG or a SPICE netlist.">
              <Keys />
            </Tile>
          </div>
          <Reveal className="card mt-3 flex flex-col gap-5 overflow-hidden p-5 md:flex-row md:items-center">
            <div className="md:w-72">
              <span className="mb-3 grid h-8 w-8 place-items-center rounded-lg border border-line-2 bg-surface-2 text-fg-2"><Box size={15} /></span>
              <h3 className="text-[15px] font-semibold tracking-tight">Every part, opened up</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">Spin {partTypes.length} parts in 3D and see what is inside each one.</p>
              <button className="btn btn-sm mt-4" onClick={onDiscover}>Open the 3D explorer <ArrowRight size={13} /></button>
            </div>
            <ul className="grid flex-1 grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
              {partTypes.slice(0, 16).map(t => (
                <li key={t}>
                  <button onClick={onDiscover} className="tile w-full" data-tip={PARTS[t].name} aria-label={`${PARTS[t].name} in 3D`}>
                    <span className="tile-art pointer-events-none"><PartThumb part={thumb(t)} size={34} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="pt-20" aria-labelledby="how">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 id="how" className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">From idea to blinking in three steps.</h2>
          </Reveal>
          <ol className="mt-8 grid gap-3 md:grid-cols-3">
            {([
              ['01', 'Pick your parts', 'Drag a board, a breadboard and parts in from the library, or start from a guided project.', <Layers key="a" size={16} />],
              ['02', 'Wire it and write code', 'Click pin to pin to run jumper wires. Write the Arduino sketch beside the circuit.', <Cable key="b" size={16} />],
              ['03', 'Run it and measure', 'Press Start. Read voltages, watch the scope, slow time down, and flip to 3D.', <Play key="c" size={16} />],
            ] as const).map(([n, t, d, icon], i) => (
              <Reveal as="li" key={n} delay={i * 80} className="card relative p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] text-fg-3">{n}</span>
                  <span className="text-fg-3">{icon}</span>
                </div>
                <h3 className="mt-6 text-[16px] font-semibold tracking-tight">{t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">{d}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* ---------- Learning path ---------- */}
        <section className="pt-20" aria-labelledby="path">
          <Reveal className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Learning path</p>
              <h2 id="path" className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">{STARTERS.length} projects, one step at a time.</h2>
              <p className="mt-1.5 text-[14px] text-fg-2">{level === 'all' ? 'From your first blinking LED to motors, displays and instruments.' : LEVELS.find(l => l[0] === level)?.[1]}</p>
            </div>
            <div className="seg" role="tablist" aria-label="Level">
              <button role="tab" aria-selected={level === 'all'} aria-checked={level === 'all'} onClick={() => setLevel('all')}>All <span className="ml-1 font-mono text-[10.5px] text-fg-3">{STARTERS.length}</span></button>
              {LEVELS.map(([l], i) => (
                <button key={l} role="tab" aria-selected={level === l} aria-checked={level === l} onClick={() => setLevel(l)}>
                  <span className="mr-1 font-mono text-[10.5px] text-fg-3">{i + 1}</span>{l}
                </button>
              ))}
            </div>
          </Reveal>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shownStarters.map(s => <StarterCard key={s.id} s={s} onOpen={() => onOpen(s.id)} />)}
          </ul>
        </section>

        {/* ---------- Closing ---------- */}
        <Reveal as="section" className="relative mt-20 overflow-hidden rounded-2xl border border-line bg-surface">
          <WaveField className="opacity-70" />
          <div className="relative flex flex-col items-start gap-6 px-6 py-12 sm:px-12 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <h2 className="text-[30px] leading-tight font-semibold tracking-[-0.03em] sm:text-[38px]">Your bench is ready.</h2>
              <p className="mt-2 max-w-[460px] text-[15px] text-fg-2">Start from a guided project, or an empty workplane with a board and a breadboard. Bring your own idea.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary btn-lg" onClick={() => onOpen('blink')}>Start building <ArrowRight size={16} /></button>
              <button className="btn btn-lg" onClick={onBlank}><Plus size={16} /> Blank project</button>
            </div>
          </div>
        </Reveal>

        <footer className="mt-16 border-t border-line py-10 text-[12.5px] text-fg-3">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <a href={XAVIERLABS.site} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-2 text-fg">
                <Logo size={20} /><span className="text-[15px] font-semibold tracking-tight">XavierLabs</span>
              </a>
              <p className="mt-3 max-w-[340px] leading-relaxed">
                I love computers, all the way down to the silicon. XavierLabs IDE is the electronics lab of XavierLabs, built so anyone can learn it in a browser.
              </p>
              <p className="mt-3 flex items-center gap-1.5">Press <span className="kbd">Ctrl</span><span className="kbd">K</span> to search anything</p>
            </div>
            <div>
              <p className="eyebrow mb-3">The lab</p>
              <ul className="space-y-2">
                <li><a className="flex items-center gap-2 hover:text-fg" href={XAVIERLABS.site} target="_blank" rel="noreferrer"><Logo size={13} />XavierLabs<span className="text-fg-3">· the lab</span></a></li>
                <li><a className="flex items-center gap-2 hover:text-fg" href={XAVIERLABS.lab} target="_blank" rel="noreferrer"><Terminal size={13} />XavierLabs AI<span className="text-fg-3">· research agents</span></a></li>
                <li><a className="flex items-center gap-2 hover:text-fg" href={XAVIERLABS.about} target="_blank" rel="noreferrer"><ArrowUpRight size={13} />About the maker</a></li>
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-3">Elsewhere</p>
              <ul className="space-y-2">
                <li><a className="flex items-center gap-2 hover:text-fg" href={XAVIERLABS.github} target="_blank" rel="noreferrer"><GithubMark size={13} />GitHub @venstqs</a></li>
                <li><a className="flex items-center gap-2 hover:text-fg" href={XAVIERLABS.repo} target="_blank" rel="noreferrer"><GithubMark size={13} />Source of this IDE</a></li>
                <li><a className="flex items-center gap-2 hover:text-fg" href={XAVIERLABS.contact} target="_blank" rel="noreferrer"><ArrowUpRight size={13} />Say hello</a></li>
              </ul>
            </div>
          </div>
          <p className="mt-10 flex flex-wrap justify-between gap-2 border-t border-line pt-5 font-mono text-[11px]">
            <span>© {new Date().getFullYear()} XavierLabs · Adrian Xavier Moral</span>
            <span>Science · Technology · Electronics</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
