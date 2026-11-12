import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Code2, Download, FolderOpen, Play, Square, X } from 'lucide-react';
import type { Live, Note, PartType, Project } from './types';
import { PARTS, isBoard } from './parts/catalog';
import { ArtDefs } from './parts/PartArt';
import { STARTERS } from './data/projects';
import { Simulator } from './sim/simulator';
import { CompileError } from './sim/compiler';
import { setBuzzer, unlockAudio } from './sim/audio';
import Workbench from './views/Workbench';
import type { Update } from './views/Workbench';
import SidePanel from './views/SidePanel';
import type { Problem } from './views/SidePanel';
import Home from './views/Home';

const Discover = lazy(() => import('./views/Discover'));

type ViewName = 'home' | 'build' | 'discover';
const STORE = 'xavierlabs_project_v2';
const PANEL_W = 'xavierlabs_panel_w';

const BLANK_CODE = `void setup() {
  // runs once when the board starts

}

void loop() {
  // runs again and again

}
`;

function blankProject(): Project {
  return {
    name: 'Untitled project',
    parts: [
      { id: 'board', type: 'uno', x: 24, y: 48, rot: 0, props: {} },
      { id: 'bb', type: 'breadboard', x: 372, y: 48, rot: 0, props: {} },
    ],
    wires: [],
    code: BLANK_CODE,
  };
}

function isProject(v: unknown): v is Project {
  const p = v as Project;
  return !!p && typeof p.code === 'string' && Array.isArray(p.wires) && Array.isArray(p.parts)
    && p.parts.every(x => x && typeof x.id === 'string' && x.type in PARTS && typeof x.x === 'number' && typeof x.y === 'number' && typeof x.props === 'object')
    && p.wires.every(w => w && typeof w.from === 'string' && typeof w.to === 'string');
}

function loadSaved(): Project | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    return isProject(v) ? { ...v, name: String(v.name ?? 'Untitled project') } : null;
  } catch { return null; }
}

const readNumber = (k: string, fallback: number) => { try { return Number(localStorage.getItem(k)) || fallback; } catch { return fallback; } };

/** Project plus undo history. `key` lets a run of edits (one drag, one slider) collapse into a single undo step. */
interface Hist { past: Project[]; present: Project; future: Project[]; key: string | null }
const fresh = (p: Project): Hist => ({ past: [], present: p, future: [], key: null });

const SAVED = loadSaved();

export default function App() {
  const [view, setView] = useState<ViewName>(SAVED ? 'build' : 'home');
  const [hist, setHist] = useState<Hist>(() => fresh(SAVED ?? STARTERS[0].build()));
  const project = hist.present;
  const [resumable, setResumable] = useState(!!SAVED);
  const [fitKey, setFitKey] = useState(0);
  const [discover, setDiscover] = useState<PartType>('led');
  const [panel, setPanel] = useState<'code' | 'tutor' | null>(() => (window.innerWidth >= 1024 ? 'code' : null));
  const [panelW, setPanelW] = useState(() => readNumber(PANEL_W, 440));

  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [serial, setSerial] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState('');
  const sim = useRef<Simulator | null>(null);

  const update: Update = useCallback((fn, opt) => {
    setHist(h => {
      const next = fn(h.present);
      if (next === h.present) return h;
      if (opt?.skip) return { ...h, present: next };
      const k = opt?.key ?? null;
      const merge = k !== null && k === h.key;
      return { past: merge ? h.past : [...h.past.slice(-100), h.present], present: next, future: [], key: k };
    });
  }, []);
  const undo = useCallback(() => setHist(h => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], key: null } : h)), []);
  const redo = useCallback(() => setHist(h => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), key: null } : h)), []);

  // Save as you go.
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(project)); } catch { /* storage full or blocked */ } }, 400);
    return () => clearTimeout(t);
  }, [project]);
  useEffect(() => { try { localStorage.setItem(PANEL_W, String(panelW)); } catch { /* ignore */ } }, [panelW]);

  const stop = useCallback(() => {
    sim.current = null;
    setRunning(false);
    setLive({});
    setNotes([]);
    setBuzzer(0);
    update(p => (p.parts.some(x => x.props.pressed) ? { ...p, parts: p.parts.map(x => (x.props.pressed ? { ...x, props: { ...x.props, pressed: 0 } } : x)) } : p), { skip: true });
  }, [update]);

  const start = () => {
    unlockAudio();
    setProblem(null);
    setSerial('');
    try {
      sim.current = new Simulator(project.parts, project.wires, project.code);
    } catch (e) {
      const line = e instanceof CompileError ? e.line : 1;
      setProblem({ kind: 'build', line, message: (e as Error).message });
      setPanel('code');
      return;
    }
    setSeconds(0);
    setRunning(true);
  };

  // The simulation clock: one step per animation frame.
  useEffect(() => {
    if (!running) return;
    let raf = 0, last = performance.now(), shown = '', lastSecond = -1;
    const frame = (now: number) => {
      const s = sim.current;
      if (!s) return;
      const f = s.step(Math.min(50, now - last));
      last = now;
      const key = JSON.stringify(f.live) + f.notes.length;
      if (key !== shown) { shown = key; setLive(f.live); setNotes(f.notes); }
      if (f.serial) setSerial(t => (t + f.serial).slice(-12000));
      setBuzzer(f.hz);
      const sec = Math.floor(f.ms / 100) / 10;
      if (sec !== lastSecond) { lastSecond = sec; setSeconds(sec); }
      if (f.error) { setProblem({ kind: 'run', line: 0, message: f.error }); setPanel('code'); stop(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, stop]);

  useEffect(() => { if (view !== 'build') stop(); }, [view, stop]);

  // Pressing a button or moving a slider while running changes the circuit.
  useEffect(() => { if (running) sim.current?.setCircuit(project.parts, project.wires); }, [running, project.parts, project.wires]);

  // Global shortcuts: Ctrl+Enter runs (even from the code editor); Ctrl+Z / Ctrl+Shift+Z undo and redo the circuit.
  const keys = useRef({ toggle: () => {}, undo, redo });
  keys.current = { toggle: () => (running ? stop() : start()), undo, redo };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== 'build' || !(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'Enter') { e.preventDefault(); keys.current.toggle(); return; }
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      if (running) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); keys.current.undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); keys.current.redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, running]);

  const open = (p: Project) => {
    stop();
    setProblem(null);
    setSerial('');
    setHist(fresh(p));
    setResumable(true);
    setFitKey(k => k + 1);
    setView('build');
  };
  const openStarter = (id: string) => { const s = STARTERS.find(x => x.id === id); if (s) open(s.build()); };

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^\w-]+/g, '_') || 'project'}.xavierlabs.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const openFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!isProject(data)) throw new Error('not a project');
        open({ ...data, name: String(data.name ?? file.name.replace(/\..*$/, '')) });
        setNotice('');
      } catch {
        setNotice(`${file.name} is not a XavierLabs project file. Files saved from the old version can’t be opened here.`);
      }
    };
    input.click();
  };

  /** Drag the divider between the workplane and the code panel. */
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const sx = e.clientX, w0 = panelW;
    const max = () => Math.min(760, window.innerWidth - 520);
    const move = (ev: PointerEvent) => setPanelW(Math.round(Math.max(340, Math.min(max(), w0 - (ev.clientX - sx)))));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const hasBoard = project.parts.some(p => isBoard(p.type));
  const tabs: [ViewName, string][] = [['home', 'Learn'], ['build', 'Build'], ['discover', 'Parts in 3D']];

  return (
    <div className="flex h-full flex-col">
      <ArtDefs />
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-3 py-2 sm:px-4">
        <button onClick={() => setView('home')} className="flex items-center gap-2 font-display text-lg font-bold tracking-tight" aria-label="XavierLabs home">
          <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
            <rect width="100" height="100" rx="22" fill="#09090b" />
            <path d="M28 28L50 50L72 28M72 72L50 50L28 72" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="50" cy="50" r="5" fill="#fff" />
          </svg>
          <span className="hidden sm:inline">XavierLabs</span>
        </button>

        <nav className="flex gap-0.5" aria-label="Sections">
          {tabs.map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} aria-current={view === v ? 'page' : undefined}
              className={`relative h-9 rounded-md px-3 text-sm font-medium transition-colors ${view === v ? 'text-ink' : 'text-muted hover:bg-paper hover:text-ink'}`}>
              {label}
              {view === v && <span className="absolute inset-x-3 -bottom-[9px] h-0.5 rounded-full bg-ink" aria-hidden="true" />}
            </button>
          ))}
        </nav>

        {view === 'build' && (
          <>
            <span className="hidden h-6 w-px bg-line md:block" />
            <input value={project.name} onChange={e => update(p => ({ ...p, name: e.target.value }), { key: 'name' })} aria-label="Project name"
              className="hidden h-9 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold hover:border-line focus:border-ink focus:outline-none md:block md:max-w-72" />
            <span className="flex-1" />
            <div className="flex items-center gap-1.5">
              <button className="btn btn-icon" onClick={openFile} aria-label="Open a project file" title="Open a project file"><FolderOpen size={16} /></button>
              <button className="btn btn-icon" onClick={download} aria-label="Download this project" title="Download this project"><Download size={16} /></button>
              <button className={`btn ${panel ? 'border-ink' : ''}`} onClick={() => setPanel(p => (p ? null : 'code'))} aria-pressed={!!panel}><Code2 size={16} /> <span className="hidden sm:inline">Code</span></button>
              {running
                ? <button className="btn btn-stop w-[11.5rem] justify-center" onClick={stop} title="Stop (Ctrl+Enter)"><Square size={13} fill="currentColor" /> Stop simulation</button>
                : <button className="btn btn-go w-[11.5rem] justify-center" onClick={start} title="Start (Ctrl+Enter)"><Play size={15} fill="currentColor" /> Start simulation</button>}
            </div>
          </>
        )}
      </header>

      {notice && (
        <p role="alert" className="flex shrink-0 items-center gap-3 border-b border-ink bg-panel px-4 py-2 text-sm">
          <span className="flex-1">{notice}</span>
          <button className="tool" onClick={() => setNotice('')} aria-label="Dismiss"><X size={16} /></button>
        </p>
      )}

      <main className="min-h-0 flex-1">
        {view === 'build' && (
          <div className="flex h-full min-h-0 flex-col lg:flex-row">
            <div className="min-h-0 min-w-0 flex-1">
              <Workbench project={project} update={update} running={running} seconds={seconds} live={live} notes={notes}
                voltageAt={r => sim.current?.voltageAt(r) ?? 0} fitKey={fitKey}
                canUndo={hist.past.length > 0} canRedo={hist.future.length > 0} onUndo={undo} onRedo={redo}
                onLearn={t => { setDiscover(t); setView('discover'); }} />
            </div>
            {panel && (
              <>
                <div role="separator" aria-orientation="vertical" aria-label="Resize code panel" tabIndex={0}
                  aria-valuenow={panelW} aria-valuemin={340} aria-valuemax={760}
                  onPointerDown={startResize}
                  onKeyDown={e => { if (e.key === 'ArrowLeft') setPanelW(w => Math.min(760, w + 24)); if (e.key === 'ArrowRight') setPanelW(w => Math.max(340, w - 24)); }}
                  className="group relative hidden w-0 cursor-col-resize lg:block">
                  <span className="absolute inset-y-0 -left-1.5 w-3 group-hover:bg-ink/10 group-focus-visible:bg-ink/20" />
                </div>
                <div className="h-[46%] shrink-0 border-t border-line lg:h-auto lg:w-[var(--pw)] lg:border-t-0" style={{ '--pw': `${panelW}px` } as React.CSSProperties}>
                  <SidePanel tab={panel} setTab={setPanel} project={project} setCode={code => { update(p => ({ ...p, code }), { key: 'code' }); setProblem(null); }}
                    running={running} hasBoard={hasBoard} problem={problem} serial={serial} onClearSerial={() => setSerial('')}
                    onSend={t => sim.current?.send(t)} notes={notes} onClose={() => setPanel(null)} />
                </div>
              </>
            )}
          </div>
        )}
        {view === 'discover' && (
          <Suspense fallback={<p className="p-8 text-sm text-muted">Loading the 3D explorer…</p>}>
            <Discover type={discover} onPick={setDiscover} onOpenStarter={openStarter} />
          </Suspense>
        )}
        {view === 'home' && (
          <Home current={resumable ? project : null} onContinue={() => setView('build')} onOpen={openStarter}
            onBlank={() => open(blankProject())} onDiscover={() => setView('discover')} />
        )}
      </main>
    </div>
  );
}
