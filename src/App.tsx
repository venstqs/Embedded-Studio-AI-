import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Box, Check, Cpu, Download, Ellipsis, FilePlus, FolderOpen, GraduationCap, Keyboard, LoaderCircle, Moon, PanelRight, Play, Plus, Search, Square, Sun, X } from 'lucide-react';
import type { Live, Note, PartType, Project } from './types';
import { PARTS, PART_ORDER, isBoard } from './parts/catalog';
import { ArtDefs } from './parts/PartArt';
import { STARTERS } from './data/projects';
import { Simulator } from './sim/simulator';
import { CompileError } from './sim/compiler';
import { setBuzzer, unlockAudio } from './sim/audio';
import Workbench from './views/Workbench';
import type { Update } from './views/Workbench';
import SidePanel from './views/SidePanel';
import type { DockTab, Problem } from './views/SidePanel';
import Home from './views/Home';
import { CommandPalette, Logo, Menu, ShortcutsDialog } from './views/ui';
import type { Command } from './views/ui';

const Discover = lazy(() => import('./views/Discover'));

type ViewName = 'home' | 'build' | 'discover';
type Theme = 'dark' | 'light';
const OLD_STORE = 'xavierlabs_project_v2';
const LIST = 'xavierlabs_projects_v1';
const CURRENT = 'xavierlabs_current_v1';
const PANEL_W = 'xavierlabs_panel_w';
const THEME = 'xavierlabs_theme';

export interface Saved { id: string; updated: number; project: Project }
const projectId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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

const tidy = (v: Project): Project => ({ ...v, name: String(v.name ?? 'Untitled project') });

/** Every saved project, newest first. Moves a project saved by the single-slot version into the list. */
function loadList(): Saved[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LIST) ?? 'null');
    if (Array.isArray(raw)) {
      return raw.filter(x => x && typeof x.id === 'string' && isProject(x.project))
        .map(x => ({ id: x.id, updated: Number(x.updated) || 0, project: tidy(x.project) }))
        .sort((a, b) => b.updated - a.updated);
    }
    const old = JSON.parse(localStorage.getItem(OLD_STORE) ?? 'null');
    if (isProject(old)) {
      const list = [{ id: projectId(), updated: Date.now(), project: tidy(old) }];
      localStorage.setItem(LIST, JSON.stringify(list));
      localStorage.setItem(CURRENT, list[0].id);
      return list;
    }
  } catch { /* storage blocked or corrupt: start fresh */ }
  return [];
}
function persistList(list: Saved[]) {
  try { localStorage.setItem(LIST, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

const readNumber = (k: string, fallback: number) => { try { return Number(localStorage.getItem(k)) || fallback; } catch { return fallback; } };

/** Project plus undo history. `key` lets a run of edits (one drag, one slider) collapse into a single undo step. */
interface Hist { past: Project[]; present: Project; future: Project[]; key: string | null }
const fresh = (p: Project): Hist => ({ past: [], present: p, future: [], key: null });

const INITIAL_LIST = loadList();
const INITIAL = (() => {
  let id: string | null = null;
  try { id = localStorage.getItem(CURRENT); } catch { /* ignore */ }
  return INITIAL_LIST.find(x => x.id === id) ?? null;
})();

export default function App() {
  const [view, setView] = useState<ViewName>(INITIAL ? 'build' : 'home');
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  const [hist, setHist] = useState<Hist>(() => fresh(INITIAL?.project ?? { ...STARTERS[0].build(), starter: 'blink' }));
  const project = hist.present;
  const [saved, setSaved] = useState<Saved[]>(INITIAL_LIST);
  const [currentId, setCurrentId] = useState<string>(() => INITIAL?.id ?? projectId());
  /** The project as it was opened. An untouched starter is not added to "Your projects". */
  const pristine = useRef<Project | null>(INITIAL ? null : hist.present);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(INITIAL ? 'saved' : 'idle');
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [discover, setDiscover] = useState<PartType>('led');
  const [panel, setPanel] = useState<DockTab | null>(() => (window.innerWidth >= 1024 ? 'code' : null));
  const [panelW, setPanelW] = useState(() => readNumber(PANEL_W, 420));
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [addRequest, setAddRequest] = useState<{ type: PartType; n: number } | null>(null);
  const [tipsDone, setTipsDone] = useState<number[]>([]);

  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [flow, setFlow] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [serial, setSerial] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState('');
  const sim = useRef<Simulator | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME, theme); } catch { /* ignore */ }
  }, [theme]);

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

  // Save as you go, into this project's own slot in the list.
  useEffect(() => {
    const untouched = project === pristine.current;
    if (!untouched) setSaveState('saving');
    const t = setTimeout(() => {
      setSaved(list => {
        const exists = list.some(x => x.id === currentId);
        if (!exists && project === pristine.current) return list;
        const next = [{ id: currentId, updated: Date.now(), project }, ...list.filter(x => x.id !== currentId)];
        persistList(next);
        return next;
      });
      if (!untouched) setSaveState('saved');
      try { localStorage.setItem(CURRENT, currentId); } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
  }, [project, currentId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => { try { localStorage.setItem(PANEL_W, String(panelW)); } catch { /* ignore */ } }, [panelW]);

  const stop = useCallback(() => {
    sim.current = null;
    setRunning(false);
    setLive({});
    setFlow({});
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
      const key = JSON.stringify(f.live) + JSON.stringify(f.wires) + f.notes.length;
      if (key !== shown) { shown = key; setLive(f.live); setNotes(f.notes); setFlow(f.wires); }
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

  /** Open a project. A new one gets its own slot, so nothing you made is ever overwritten. */
  const open = (p: Project, id = projectId(), isNew = true) => {
    stop();
    setProblem(null);
    setSerial('');
    setHist(fresh(p));
    setCurrentId(id);
    pristine.current = isNew ? p : null;
    setSaveState(isNew ? 'idle' : 'saved');
    setTipsDone([]);
    setFitKey(k => k + 1);
    setView('build');
    if (panel === 'guide' && !p.starter) setPanel('code');
  };
  const openStarter = (id: string) => { const st = STARTERS.find(x => x.id === id); if (st) open({ ...st.build(), starter: st.id }); };
  const openSaved = (id: string) => {
    if (id === currentId) { setView('build'); return; }
    const found = saved.find(x => x.id === id);
    if (found) open(found.project, found.id, false);
  };
  const removeSaved = (id: string) => {
    const gone = saved.find(x => x.id === id);
    if (!gone) return;
    const next = saved.filter(x => x.id !== id);
    setSaved(next);
    persistList(next);
    const wasOpen = id === currentId;
    if (wasOpen) { setCurrentId(projectId()); pristine.current = project; setSaveState('idle'); }
    setToast({
      text: `Deleted “${gone.project.name}”`,
      action: {
        label: 'Undo',
        run: () => {
          setSaved(list => { const back = [...list, gone].sort((a, b) => b.updated - a.updated); persistList(back); return back; });
          if (wasOpen) { setCurrentId(gone.id); pristine.current = null; setSaveState('saved'); }
        },
      },
    });
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^\w-]+/g, '_') || 'project'}.xavierlabs.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ text: `Downloaded ${a.download}` });
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

  const explore = (t: PartType) => { setDiscover(t); setView('discover'); };
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  const togglePanel = () => setPanel(p => (p ? null : 'code'));

  // Global shortcuts. Ctrl+K and Ctrl+Enter work everywhere, even in the code editor.
  const keys = useRef({ toggle: () => {}, undo, redo });
  keys.current = { toggle: () => (running ? stop() : start()), undo, redo };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = !!(e.target as HTMLElement).closest('input,textarea,select,[contenteditable]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); return; }
      if (!mod && e.key === '?' && !typing) { e.preventDefault(); setShortcuts(true); return; }
      if (view !== 'build' || !mod) return;
      if (e.key === 'Enter') { e.preventDefault(); keys.current.toggle(); return; }
      if (typing || running) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); keys.current.undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); keys.current.redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, running]);

  /** Drag the divider between the workplane and the side panel. */
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const sx = e.clientX, w0 = panelW;
    const max = () => Math.min(760, window.innerWidth - 560);
    const move = (ev: PointerEvent) => setPanelW(Math.round(Math.max(340, Math.min(max(), w0 - (ev.clientX - sx)))));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const board = project.parts.find(p => isBoard(p.type));
  const starter = project.starter ? STARTERS.find(x => x.id === project.starter) : undefined;
  const tabs: [ViewName, string][] = [['home', 'Learn'], ['build', 'Build'], ['discover', 'Parts in 3D']];

  /** Built fresh each time the palette opens, so every command acts on the current project. */
  const buildCommands = (): Command[] => {
    const list: Command[] = [];
    if (view === 'build') {
      list.push({ id: 'run', group: 'Simulation', label: running ? 'Stop the simulation' : 'Start the simulation', hint: 'Ctrl ↵', icon: running ? <Square size={14} /> : <Play size={14} />, run: () => keys.current.toggle() });
      list.push({ id: 'panel', group: 'View', label: panel ? 'Hide the side panel' : 'Show the side panel', icon: <PanelRight size={14} />, run: togglePanel });
      if (starter) list.push({ id: 'guide', group: 'View', label: 'Open the project guide', icon: <BookOpen size={14} />, run: () => setPanel('guide') });
    }
    list.push(
      { id: 'go-home', group: 'Go to', label: 'Learn', icon: <GraduationCap size={14} />, run: () => setView('home') },
      { id: 'go-build', group: 'Go to', label: 'Build', icon: <Cpu size={14} />, run: () => setView('build') },
      { id: 'go-3d', group: 'Go to', label: 'Parts in 3D', icon: <Box size={14} />, run: () => setView('discover') },
      { id: 'theme', group: 'View', label: theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme', icon: theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />, run: toggleTheme },
      { id: 'new', group: 'Project', label: 'New blank project', icon: <FilePlus size={14} />, run: () => open(blankProject()) },
      { id: 'open', group: 'Project', label: 'Open a project file', icon: <FolderOpen size={14} />, run: openFile },
      { id: 'download', group: 'Project', label: 'Download this project', icon: <Download size={14} />, run: download },
      { id: 'keys', group: 'Help', label: 'Keyboard shortcuts', hint: '?', icon: <Keyboard size={14} />, run: () => setShortcuts(true) },
    );
    for (const s of saved) list.push({ id: `saved-${s.id}`, group: 'Your projects', label: s.project.name, keywords: 'open recent', icon: <Cpu size={14} />, run: () => openSaved(s.id) });
    for (const s of STARTERS) list.push({ id: `starter-${s.id}`, group: 'Starter projects', label: s.title, keywords: `${s.level} ${s.summary}`, icon: <BookOpen size={14} />, run: () => openStarter(s.id) });
    if (view === 'build' && !running) {
      for (const t of PART_ORDER) list.push({ id: `add-${t}`, group: 'Add a part', label: `Add ${PARTS[t].name}`, keywords: PARTS[t].group, icon: <Plus size={14} />, run: () => setAddRequest(r => ({ type: t, n: (r?.n ?? 0) + 1 })) });
    }
    for (const t of PART_ORDER) list.push({ id: `3d-${t}`, group: 'Explore in 3D', label: `${PARTS[t].name} in 3D`, keywords: 'learn explore inside', icon: <Box size={14} />, run: () => explore(t) });
    return list;
  };

  return (
    <div className="flex h-full flex-col bg-app">
      <ArtDefs />
      <header className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-2.5 sm:gap-3 sm:px-3">
        <button onClick={() => setView('home')} className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1" aria-label="XavierLabs home">
          <Logo size={24} />
          <span className="hidden text-[14px] font-semibold tracking-tight lg:inline">XavierLabs</span>
        </button>

        <nav className="seg shrink-0" aria-label="Sections">
          {tabs.map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} aria-current={view === v ? 'page' : undefined}>{label}</button>
          ))}
        </nav>

        {view === 'build' && (
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="text-fg-3">/</span>
            <input value={project.name} onChange={e => update(p => ({ ...p, name: e.target.value }), { key: 'name' })} aria-label="Project name"
              className="h-7 w-[min(18rem,24vw)] min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-[13px] font-medium text-fg hover:border-line-2 focus:border-fg-3 focus:outline-none" />
            {saveState !== 'idle' && (
              <span className="flex shrink-0 items-center gap-1 text-[12px] text-fg-3" aria-live="polite">
                {saveState === 'saving' ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
                {saveState === 'saving' ? 'Saving' : 'Saved'}
              </span>
            )}
          </div>
        )}

        <span className="flex-1" />

        <button className="btn btn-ghost hidden h-8 w-60 justify-start gap-2 border-line text-fg-3 hover:text-fg-2 lg:inline-flex" onClick={() => setPalette(true)}>
          <Search size={14} aria-hidden="true" /> Search or jump to
          <span className="ml-auto flex gap-0.5"><span className="kbd">Ctrl</span><span className="kbd">K</span></span>
        </button>
        <button className="btn btn-ghost btn-icon lg:hidden" onClick={() => setPalette(true)} aria-label="Search" data-tip="Search  Ctrl K"><Search size={15} /></button>
        <button className="btn btn-ghost btn-icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} data-tip={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {view === 'build' && (
          <>
            <Menu label="Project menu" trigger={<Ellipsis size={16} />} items={[
              { label: 'New blank project', icon: <FilePlus size={14} />, run: () => open(blankProject()) },
              { label: 'Open a project file', icon: <FolderOpen size={14} />, run: openFile },
              { label: 'Download this project', icon: <Download size={14} />, run: download },
              'divider',
              { label: 'Keyboard shortcuts', icon: <Keyboard size={14} />, hint: '?', run: () => setShortcuts(true) },
            ]} />
            <button className="btn btn-ghost btn-icon" onClick={togglePanel} aria-pressed={!!panel} aria-label="Toggle side panel" data-tip="Side panel" data-tip-pos="left"><PanelRight size={15} /></button>
            <span className="divider-v hidden sm:block" />
            {running ? (
              <button className="btn w-[9.5rem] justify-between" onClick={stop} data-tip="Ctrl Enter" data-tip-pos="left">
                <span className="flex items-center gap-2"><Square size={11} fill="currentColor" aria-hidden="true" /> Stop</span>
                <span className="font-mono text-[12px] text-fg-2 tabular-nums">{seconds.toFixed(1)} s</span>
              </button>
            ) : (
              <button className="btn btn-primary w-[9.5rem]" onClick={start} data-tip="Ctrl Enter" data-tip-pos="left">
                <Play size={13} fill="currentColor" aria-hidden="true" /> Start simulation
              </button>
            )}
          </>
        )}
      </header>

      {notice && (
        <div role="alert" className="flex shrink-0 items-center gap-3 border-b border-line bg-surface-2 px-4 py-2 text-[12.5px]">
          <span className="flex-1 text-fg">{notice}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <main className="min-h-0 flex-1">
        {view === 'build' && (
          <div className="flex h-full min-h-0 flex-col lg:flex-row">
            <div className="min-h-0 min-w-0 flex-1">
              <Workbench project={project} update={update} running={running} seconds={seconds} live={live} flow={flow} notes={notes}
                voltageAt={r => sim.current?.voltageAt(r) ?? 0} fitKey={fitKey}
                canUndo={hist.past.length > 0} canRedo={hist.future.length > 0} onUndo={undo} onRedo={redo}
                onLearn={explore} onToast={text => setToast({ text })} onShortcuts={() => setShortcuts(true)}
                addRequest={addRequest}
                guide={starter && panel !== 'guide' ? { done: tipsDone.length, total: starter.tryIt.length } : null}
                onOpenGuide={() => setPanel('guide')} />
            </div>
            {panel && (
              <>
                <div role="separator" aria-orientation="vertical" aria-label="Resize side panel" tabIndex={0}
                  aria-valuenow={panelW} aria-valuemin={340} aria-valuemax={760}
                  onPointerDown={startResize}
                  onKeyDown={e => { if (e.key === 'ArrowLeft') setPanelW(w => Math.min(760, w + 24)); if (e.key === 'ArrowRight') setPanelW(w => Math.max(340, w - 24)); }}
                  className="group relative hidden w-px cursor-col-resize bg-line lg:block">
                  <span className="absolute inset-y-0 -left-1 w-2 transition-colors group-hover:bg-fg/15 group-focus-visible:bg-fg/25" />
                </div>
                <div className="h-[46%] shrink-0 border-t border-line lg:h-auto lg:w-[var(--pw)] lg:border-t-0" style={{ '--pw': `${panelW}px` } as React.CSSProperties}>
                  <SidePanel tab={panel} setTab={setPanel} project={project} setCode={code => { update(p => ({ ...p, code }), { key: 'code' }); setProblem(null); }}
                    running={running} boardName={board ? PARTS[board.type].name : null} problem={problem} serial={serial} onClearSerial={() => setSerial('')}
                    onSend={t => sim.current?.send(t)} notes={notes} onClose={() => setPanel(null)}
                    starter={starter} tipsDone={tipsDone} onToggleTip={i => setTipsDone(d => (d.includes(i) ? d.filter(x => x !== i) : [...d, i]))}
                    onExplore={explore} />
                </div>
              </>
            )}
          </div>
        )}
        {view === 'discover' && (
          <Suspense fallback={<p className="p-8 text-fg-3">Loading the 3D explorer…</p>}>
            <Discover type={discover} onPick={setDiscover} onOpenStarter={openStarter} dark={theme === 'dark'} />
          </Suspense>
        )}
        {view === 'home' && (
          <Home saved={saved} currentId={currentId} onOpenSaved={openSaved} onDelete={removeSaved} onOpen={openStarter}
            onBlank={() => open(blankProject())} onDiscover={() => setView('discover')} />
        )}
      </main>

      {palette && <CommandPalette commands={buildCommands()} onClose={() => setPalette(false)} />}
      {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}

      {toast && (
        <div role="status" className="fixed bottom-10 left-1/2 z-[95] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg bg-inverse py-1.5 pr-1.5 pl-3.5 text-[13px] text-on-inverse shadow-xl">
          <span className="min-w-0 truncate">{toast.text}</span>
          {toast.action && <button className="shrink-0 rounded-md px-2.5 py-1 font-semibold hover:bg-on-inverse/10" onClick={() => { toast.action!.run(); setToast(null); }}>{toast.action.label}</button>}
          <button className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-on-inverse/10" onClick={() => setToast(null)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
