import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Box, Clock, Cpu, Plus, Trash2 } from 'lucide-react';
import type { Live, Project } from '../types';
import { PARTS, pivot, toWorld } from '../parts/catalog';
import { PartArt } from '../parts/PartArt';
import { STARTERS } from '../data/projects';
import type { Starter } from '../data/projects';
import type { Saved } from '../App';

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

/** The Blink starter, blinking, framed like the editor it comes from. */
function LiveBlink() {
  const project = useMemo(() => STARTERS[0].build(), []);
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setOn(o => !o), 900);
    return () => clearInterval(t);
  }, []);
  const live: Record<string, Live> = { led: { b: on ? 1 : 0 }, board: { on: true, b: on ? 1 : 0 } };
  const code: [string, boolean][] = [['digitalWrite(LED_PIN, HIGH);', on], ['delay(1000);', false], ['digitalWrite(LED_PIN, LOW);', !on], ['delay(1000);', false]];
  return (
    <div className="card overflow-hidden shadow-2xl">
      <div className="flex h-10 items-center gap-2 border-b border-line px-3.5">
        <Cpu size={14} className="text-fg-3" aria-hidden="true" />
        <span className="text-[12.5px] font-medium">Blink an LED</span>
        <span className="flex-1" />
        <span className="chip"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />Running</span>
      </div>
      <div className="aspect-[16/9] bg-canvas p-6" style={dots}><CircuitPreview project={project} live={live} /></div>
      <div className="border-t border-line px-4 py-3 font-mono text-[12px] leading-[1.75]" style={{ background: 'var(--code-bg)' }}>
        <div className="text-fg-3">void loop() {'{'}</div>
        {code.map(([line, hot], i) => (
          <div key={i} className={`-mx-2 rounded px-2 pl-6 transition-colors ${hot ? 'bg-surface-3 text-fg' : 'text-fg-3'}`}>{line}</div>
        ))}
        <div className="text-fg-3">{'}'}</div>
      </div>
    </div>
  );
}

const MINUTES: Record<Starter['level'], number> = { 'Start here': 5, 'Next steps': 10, 'Bigger builds': 20 };

function StarterCard({ s, onOpen }: { s: Starter; onOpen: () => void }) {
  const project = useMemo(() => s.build(), [s]);
  const parts = new Set(s.parts).size;
  return (
    <li>
      <button onClick={onOpen} className="group card flex h-full w-full flex-col overflow-hidden text-left transition-colors hover:border-line-2">
        <div className="h-40 w-full border-b border-line bg-canvas p-4 transition-colors" style={dots}><CircuitPreview project={project} /></div>
        <div className="flex w-full flex-1 flex-col p-4">
          <h3 className="text-[14px] font-semibold">{s.title}</h3>
          <p className="mt-1 line-clamp-2 flex-1 text-[12.5px] leading-relaxed text-fg-2">{s.summary}</p>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="chip"><Clock size={11} aria-hidden="true" />{MINUTES[s.level]} min</span>
            <span className="chip">{parts} parts</span>
            <span className="flex-1" />
            <ArrowRight size={15} className="text-fg-3 transition-all group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden="true" />
          </div>
        </div>
      </button>
    </li>
  );
}

const LEVELS: [Starter['level'], string][] = [
  ['Start here', 'No experience needed. Each one runs the moment you press Start simulation.'],
  ['Next steps', 'Read sensors, fade lights, make sound, and look at signals.'],
  ['Bigger builds', 'Several parts working together, like a real project.'],
];

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
      <button onClick={onOpen} className="card flex w-full flex-col overflow-hidden text-left transition-colors hover:border-line-2">
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

interface Props {
  saved: Saved[];
  currentId: string;
  onOpenSaved: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
  onBlank: () => void;
  onDiscover: () => void;
}

export default function Home({ saved, currentId, onOpenSaved, onDelete, onOpen, onBlank, onDiscover }: Props) {
  return (
    <div className="scroll h-full overflow-auto">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-10">
        {/* Hero */}
        <section className="grid items-center gap-12 py-12 lg:grid-cols-[1fr_1.12fr] lg:py-20">
          <div>
            <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />Runs entirely in your browser</span>
            <h1 className="mt-5 text-[42px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[56px]">
              Learn electronics by building it.
            </h1>
            <p className="mt-5 max-w-[440px] text-[16px] leading-relaxed text-fg-2">
              Wire real parts on a breadboard, write Arduino code, and watch current flow. Measure it with a multimeter, see it on an oscilloscope, and nothing ever burns out.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <button className="btn btn-primary btn-lg" onClick={() => onOpen('blink')}>Start building <ArrowRight size={16} aria-hidden="true" /></button>
              <button className="btn btn-lg" onClick={onDiscover}><Box size={16} aria-hidden="true" /> Explore parts in 3D</button>
            </div>
          </div>
          <LiveBlink />
        </section>

        {saved.length > 0 && (
          <section className="border-t border-line py-12" aria-labelledby="yours">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="yours" className="text-[18px]">Your projects</h2>
              <span className="chip">{saved.length}</span>
              <span className="flex-1" />
              <button className="btn btn-sm" onClick={onBlank}><Plus size={13} aria-hidden="true" /> New blank project</button>
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {saved.map(item => <SavedCard key={item.id} item={item} open={item.id === currentId} onOpen={() => onOpenSaved(item.id)} onDelete={() => onDelete(item.id)} />)}
            </ul>
          </section>
        )}

        <section className="border-t border-line py-12" aria-labelledby="path">
          <h2 id="path" className="text-[18px]">Learning path</h2>
          <p className="mt-1 text-fg-2">{STARTERS.length} projects, from your first blinking LED to motors, displays and instruments.</p>

          {LEVELS.map(([level, about], i) => {
            const list = STARTERS.filter(s => s.level === level);
            return (
              <div key={level} className="mt-10">
                <div className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line-2 bg-surface-2 font-mono text-[11.5px] font-medium">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px]">{level}</h3>
                    <p className="mt-0.5 text-[12.5px] text-fg-2">{about}</p>
                  </div>
                  <span className="text-[12px] text-fg-3 tabular-nums">{list.length} projects</span>
                </div>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map(s => <StarterCard key={s.id} s={s} onOpen={() => onOpen(s.id)} />)}
                </ul>
              </div>
            );
          })}
        </section>

        <section className="card mb-12 flex flex-wrap items-center gap-4 p-6">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-line-2 bg-surface-2"><Plus size={18} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px]">Start from scratch</h2>
            <p className="mt-0.5 text-[12.5px] text-fg-2">An empty workplane with a board and a breadboard. Bring your own idea.</p>
          </div>
          <button className="btn btn-primary" onClick={onBlank}>New blank project</button>
        </section>

        <footer className="flex flex-wrap items-center gap-3 border-t border-line py-8 text-[12px] text-fg-3">
          <span className="font-semibold text-fg-2">XavierLabs</span>
          <span>Learn electronics in your browser.</span>
          <span className="flex-1" />
          <span className="flex items-center gap-1.5">Press <span className="kbd">Ctrl</span><span className="kbd">K</span> to search anything</span>
        </footer>
      </div>
    </div>
  );
}
