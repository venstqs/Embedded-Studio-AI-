import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Box, Plus } from 'lucide-react';
import type { Live, Project } from '../types';
import { PARTS, pivot, toWorld } from '../parts/catalog';
import { PartArt } from '../parts/PartArt';
import { STARTERS } from '../data/projects';
import type { Starter } from '../data/projects';

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
          <g key={part.id} transform={`translate(${part.x} ${part.y}) rotate(${part.rot} ${cx} ${cy})`}>
            <PartArt part={part} live={live?.[part.id]} running={!!live} />
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
            <path d={d} stroke="rgb(0 0 0 / 0.35)" strokeWidth={4.6} fill="none" strokeLinecap="round" />
            <path d={d} stroke={w.color} strokeWidth={3.2} fill="none" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

/** The Blink starter, blinking. The one thing a first-time visitor should see working. */
function LiveBlink() {
  const project = useMemo(() => STARTERS[0].build(), []);
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setOn(o => !o), 900);
    return () => clearInterval(t);
  }, []);
  const live: Record<string, Live> = { led: { b: on ? 1 : 0 }, board: { on: true, b: on ? 1 : 0 } };
  return (
    <div className="relative">
      <div className="card overflow-hidden" style={{ backgroundImage: 'radial-gradient(circle, #d4d4d8 1px, transparent 1.3px)', backgroundSize: '18px 18px' }}>
        <div className="aspect-[16/9] p-5"><CircuitPreview project={project} live={live} /></div>
        <div className="flex items-center gap-3 border-t border-line bg-ink px-4 py-2.5 font-mono text-[13px] text-white">
          <span className="text-white/50">loop()</span>
          <span className={on ? 'text-white' : 'text-white/35'}>digitalWrite(13, HIGH);</span>
          <span className={on ? 'text-white/35' : 'text-white'}>digitalWrite(13, LOW);</span>
        </div>
      </div>
    </div>
  );
}

function StarterCard({ s, onOpen }: { s: Starter; onOpen: () => void }) {
  const project = useMemo(() => s.build(), [s]);
  return (
    <li>
      <button onClick={onOpen} className="group card flex h-full w-full flex-col overflow-hidden text-left transition-colors hover:border-ink">
        <div className="h-36 w-full border-b border-line bg-paper p-3"><CircuitPreview project={project} /></div>
        <div className="flex w-full flex-1 flex-col p-4">
          <h3 className="text-lg leading-tight font-semibold">{s.title}</h3>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{s.summary}</p>
          <p className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
            <span className="truncate">{[...new Set(s.parts)].map(t => PARTS[t].name).join(', ')}</span>
            <ArrowRight size={16} className="shrink-0 text-ink transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </p>
        </div>
      </button>
    </li>
  );
}

const LEVELS: [Starter['level'], string][] = [
  ['Start here', 'No experience needed. Each one runs the moment you press Start simulation.'],
  ['Next steps', 'Read sensors, fade lights, make sound.'],
  ['Bigger builds', 'Several parts working together, like a real project.'],
];

interface Props {
  current: Project | null;
  onContinue: () => void;
  onOpen: (id: string) => void;
  onBlank: () => void;
  onDiscover: () => void;
}

export default function Home({ current, onContinue, onOpen, onBlank, onDiscover }: Props) {
  return (
    <div className="scroll-thin h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Hero */}
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1fr_1.15fr] lg:py-16">
          <div>
            <h1 className="text-[2.75rem] leading-[0.95] font-bold tracking-tight sm:text-6xl">
              Learn electronics by building it.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
              Wire real parts on a breadboard, write Arduino code, and press Start. It all runs in your browser, so nothing can burn out.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <button className="btn btn-ink btn-lg" onClick={() => onOpen('blink')}>Build your first circuit</button>
              <button className="btn btn-lg" onClick={onDiscover}><Box size={18} /> Explore parts in 3D</button>
            </div>
            {current && (
              <button onClick={onContinue} className="group mt-8 flex w-full max-w-md items-center gap-3 rounded-xl border border-line bg-panel p-3 text-left hover:border-ink">
                <span className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-paper p-1"><CircuitPreview project={current} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted">Continue where you left off</span>
                  <span className="block truncate font-semibold">{current.name}</span>
                </span>
                <ArrowRight size={18} className="shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <LiveBlink />
        </section>

        {/* The path */}
        {LEVELS.map(([level, about], i) => (
          <section key={level} className="border-t border-line py-10">
            <div className="flex items-baseline gap-4">
              <span className="font-display text-sm font-semibold text-muted tabular-nums">Step {i + 1}</span>
              <div>
                <h2 className="text-2xl font-semibold">{level}</h2>
                <p className="mt-1 text-sm text-muted">{about}</p>
              </div>
            </div>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STARTERS.filter(s => s.level === level).map(s => <StarterCard key={s.id} s={s} onOpen={() => onOpen(s.id)} />)}
            </ul>
          </section>
        ))}

        <section className="mb-10 flex flex-wrap items-center gap-4 rounded-2xl bg-ink p-6 text-white sm:p-8">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">Have your own idea?</h2>
            <p className="mt-1 text-sm text-white/70">Start from an empty workplane with just a board and a breadboard.</p>
          </div>
          <button className="btn btn-lg border-white bg-white text-ink hover:!bg-white/90" onClick={onBlank}><Plus size={18} /> Start a blank project</button>
        </section>
      </div>
    </div>
  );
}
