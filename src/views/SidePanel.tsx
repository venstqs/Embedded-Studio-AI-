import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import EditorModule from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import {
  ArrowDown, ArrowRight, ArrowUp, ChartLine, Check, ChevronDown, ChevronUp, CircleAlert, CircleCheck, Clock, Copy, Download, Ellipsis, Eraser, FileCode,
  Lock, Pause, Play, Search, Send, Settings2, Sparkles, TextAlignStart, Type, WrapText, X,
} from 'lucide-react';
import type { Note, PartType, Project } from '../types';
import { PARTS } from '../parts/catalog';
import { PartThumb } from '../parts/PartArt';
import type { Starter } from '../data/projects';
import { askTutor, loadSettings, saveSettings } from '../services/aiService';
import type { TutorSettings } from '../services/aiService';
import { BAUDS, CODE_THEMES, setSettings, sketchBaud, useSettings } from '../settings';
import type { LineEnding } from '../settings';
import { garble, hex, received, stamp } from '../sim/serialLog';
import type { SerialLine, SerialLog } from '../sim/serialLog';
import { Menu } from './ui';

// The editor ships as CommonJS; depending on the bundler its component is the module or its .default.
const Editor = ((EditorModule as unknown as { default?: typeof EditorModule }).default ?? EditorModule);

export type DockTab = 'code' | 'guide' | 'tutor';
export interface Problem { line: number; message: string; kind: 'build' | 'run' }

interface Props {
  tab: DockTab;
  setTab: (t: DockTab) => void;
  project: Project;
  setCode: (c: string) => void;
  running: boolean;
  boardName: string | null;
  problem: Problem | null;
  serial: SerialLog;
  onClearSerial: () => void;
  onSend: (text: string) => void;
  notes: Note[];
  onClose: () => void;
  starter?: Starter;
  tipsDone: number[];
  onToggleTip: (i: number) => void;
  onExplore: (t: PartType) => void;
  /** Compile the sketch without running it. */
  onVerify: () => void;
  onSettings: (section?: string) => void;
  onToast: (text: string) => void;
}

export default function SidePanel(p: Props) {
  const tabs: [DockTab, string][] = [['code', 'Code'], ...(p.starter ? [['guide', 'Guide'] as [DockTab, string]] : []), ['tutor', 'Tutor']];
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 items-center border-b border-line pr-1.5 pl-2">
        <div className="tabs" role="tablist" aria-label="Side panel">
          {tabs.map(([t, label]) => (
            <button key={t} role="tab" aria-selected={p.tab === t} onClick={() => p.setTab(t)}>
              {label}
              {t === 'guide' && p.starter && <span className="font-mono text-[11px] text-fg-3">{p.tipsDone.length}/{p.starter.tryIt.length}</span>}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button onClick={() => p.onSettings('editor')} aria-label="Editor settings" className="btn btn-ghost btn-sm btn-icon" data-tip="Settings" data-tip-pos="left"><Settings2 size={15} /></button>
        <button onClick={p.onClose} aria-label="Close panel" className="btn btn-ghost btn-sm btn-icon" data-tip="Close panel" data-tip-pos="left"><X size={15} /></button>
      </div>
      {p.tab === 'code' && <Code {...p} />}
      {p.tab === 'guide' && p.starter && <Guide {...p} starter={p.starter} />}
      {p.tab === 'tutor' && <Tutor project={p.project} notes={p.notes} />}
    </div>
  );
}

// ---------- Code ----------

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };

const SNIPPETS: { label: string; hint: string; code: string }[] = [
  { label: 'Timer without delay()', hint: 'millis', code: 'unsigned long last = 0;\n\nvoid loop() {\n  if (millis() - last >= 500) {\n    last = millis();\n    // runs every 500 ms\n  }\n}\n' },
  { label: 'Read a button', hint: 'INPUT_PULLUP', code: 'pinMode(2, INPUT_PULLUP);\nif (digitalRead(2) == LOW) {\n  // pressed\n}\n' },
  { label: 'Read a knob or sensor', hint: 'analogRead', code: 'int raw = analogRead(A0);          // 0 to 1023\nint percent = map(raw, 0, 1023, 0, 100);\nSerial.println(percent);\n' },
  { label: 'Fade an LED', hint: 'analogWrite', code: 'for (int b = 0; b <= 255; b += 5) {\n  analogWrite(9, b);\n  delay(20);\n}\n' },
  { label: 'Print labelled values', hint: 'plotter', code: 'Serial.print("temp:");\nSerial.print(t);\nSerial.print(",hum:");\nSerial.println(h);\n' },
  { label: 'Play a tone', hint: 'tone', code: 'tone(8, 440, 200);   // pin, Hz, ms\ndelay(250);\n' },
  { label: 'Read serial input', hint: 'Serial.read', code: 'if (Serial.available() > 0) {\n  char c = Serial.read();\n  Serial.print("Got: ");\n  Serial.println(c);\n}\n' },
  { label: 'for loop', hint: 'for', code: 'for (int i = 0; i < 10; i++) {\n  \n}\n' },
];

/** Re-indent by brace depth. Keeps the code, fixes the spacing. */
function format(code: string, tab: number) {
  let depth = 0;
  return code.split('\n').map(raw => {
    const line = raw.trim();
    const bare = line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$/g, '');
    const lead = /^[}\])]/.test(line) ? 1 : 0;
    const out = line ? ' '.repeat(Math.max(0, depth - lead) * tab) + line : '';
    depth = Math.max(0, depth + (bare.match(/[{(]/g)?.length ?? 0) - (bare.match(/[})]/g)?.length ?? 0));
    return out;
  }).join('\n');
}

function saveFile(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Code(p: Props) {
  const { project, setCode, running, boardName, problem, onVerify, onSettings, onToast } = p;
  const { editor } = useSettings();
  const code = project.code;
  const lines = useMemo(() => code.split('\n').length, [code]);
  const lh = Math.round(editor.fontSize * 1.55);
  const scroller = useRef<HTMLDivElement>(null);
  const caret = useRef<[number, number] | null>(null);
  const [pos, setPos] = useState({ ln: 1, col: 1, sel: 0 });
  const [find, setFind] = useState<{ q: string; r: string; i: number } | null>(null);
  const [serialOpen, setSerialOpen] = useState(true);
  const area = () => document.getElementById('sketch') as HTMLTextAreaElement | null;

  useLayoutEffect(() => {
    const ta = area();
    if (caret.current && ta) { ta.setSelectionRange(...caret.current); caret.current = null; }
  }, [code]);

  const readPos = () => {
    const ta = area();
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const ln = before.split('\n').length;
    setPos({ ln, col: ta.selectionStart - before.lastIndexOf('\n'), sel: Math.abs(ta.selectionEnd - ta.selectionStart) });
  };

  const insert = (text: string) => {
    if (running) return;
    const ta = area();
    const a = ta?.selectionStart ?? code.length, b = ta?.selectionEnd ?? code.length;
    const indent = code.slice(code.lastIndexOf('\n', a - 1) + 1, a).match(/^\s*/)?.[0] ?? '';
    const body = text.replace(/\n(?=.)/g, `\n${indent}`);
    setCode(code.slice(0, a) + body + code.slice(b));
    caret.current = [a + body.length, a + body.length];
    ta?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const ta = e.target as HTMLTextAreaElement;
    if (ta.tagName !== 'TEXTAREA') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setFind(f => f ?? { q: ta.value.slice(ta.selectionStart, ta.selectionEnd), r: '', i: 0 }); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') { e.preventDefault(); setCode(format(code, editor.tabSize)); return; }
    if (!editor.autoClose || running || e.ctrlKey || e.metaKey || e.altKey) return;
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const close = PAIRS[e.key];
    const quote = e.key === '"' || e.key === "'";
    if (quote && a === b && value[a] === e.key) { e.preventDefault(); ta.setSelectionRange(a + 1, a + 1); return; }
    if (close && !(quote && a === b && /\w/.test(value[a - 1] ?? ''))) {
      e.preventDefault();
      setCode(value.slice(0, a) + e.key + value.slice(a, b) + close + value.slice(b));
      caret.current = [a + 1, b + 1];
      return;
    }
    if (')]}'.includes(e.key) && a === b && value[a] === e.key) { e.preventDefault(); ta.setSelectionRange(a + 1, a + 1); return; }
    if (e.key === 'Backspace' && a === b && a > 0 && PAIRS[value[a - 1]] === value[a]) {
      e.preventDefault();
      setCode(value.slice(0, a - 1) + value.slice(a + 1));
      caret.current = [a - 1, a - 1];
      return;
    }
    if (e.key === 'Enter' && a === b && value[a - 1] === '{' && value[a] === '}') {
      e.preventDefault();
      const indent = value.slice(value.lastIndexOf('\n', a - 1) + 1, a).match(/^\s*/)?.[0] ?? '';
      const inner = `\n${indent}${' '.repeat(editor.tabSize)}`;
      setCode(value.slice(0, a) + inner + `\n${indent}` + value.slice(b));
      caret.current = [a + inner.length, a + inner.length];
    }
  };

  // ---- find and replace ----
  const hits = useMemo(() => {
    if (!find?.q) return [];
    const out: number[] = [];
    const hay = code.toLowerCase(), q = find.q.toLowerCase();
    for (let i = hay.indexOf(q); i >= 0 && out.length < 999; i = hay.indexOf(q, i + q.length)) out.push(i);
    return out;
  }, [code, find?.q]);
  const goTo = (i: number) => {
    if (!hits.length || !find) return;
    const n = ((i % hits.length) + hits.length) % hits.length;
    setFind({ ...find, i: n });
    const ta = area();
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(hits[n], hits[n] + find.q.length);
    const line = code.slice(0, hits[n]).split('\n').length;
    scroller.current?.scrollTo({ top: Math.max(0, (line - 4) * lh) });
    readPos();
  };
  const replace = (all: boolean) => {
    if (!find?.q || running || !hits.length) return;
    if (all) { setCode(code.replace(new RegExp(find.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), find.r)); onToast(`Replaced ${hits.length} match${hits.length === 1 ? '' : 'es'}`); return; }
    const at = hits[Math.min(find.i, hits.length - 1)];
    setCode(code.slice(0, at) + find.r + code.slice(at + find.q.length));
  };

  const theme = CODE_THEMES.find(t => t.id === editor.theme)!;
  const showGutter = editor.lineNumbers && !editor.wrap;

  return (
    <>
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line bg-surface pr-1.5 pl-3 text-[12px]">
        <FileCode size={13} className="text-fg-3" aria-hidden="true" />
        <span className="font-mono text-fg">sketch.ino</span>
        {running && <span className="chip ml-1 h-5 gap-1 text-[11px]"><Lock size={10} aria-hidden="true" />Read only</span>}
        <span className="flex-1" />
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={onVerify} disabled={!boardName} data-tip="Check that the code compiles">
          <CircleCheck size={14} aria-hidden="true" /><span className="hidden xl:inline">Verify</span>
        </button>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setFind(f => (f ? null : { q: '', r: '', i: 0 }))} aria-pressed={!!find} aria-label="Find and replace" data-tip="Find  Ctrl F"><Search size={14} /></button>
        <Menu label="Insert a snippet" align="right" trigger={<Sparkles size={14} />} items={SNIPPETS.map(s => ({ label: s.label, hint: s.hint, run: () => insert(s.code) }))} />
        <Menu label="More code actions" align="right" trigger={<Ellipsis size={15} />} items={[
          { label: 'Tidy indentation', hint: 'Ctrl Shift I', icon: <TextAlignStart size={14} />, run: () => { if (!running) { setCode(format(code, editor.tabSize)); onToast('Tidied the indentation'); } } },
          { label: editor.wrap ? 'Turn off word wrap' : 'Wrap long lines', icon: <WrapText size={14} />, run: () => setSettings('editor', { wrap: !editor.wrap }) },
          { label: 'Copy the sketch', icon: <Copy size={14} />, run: () => { void navigator.clipboard?.writeText(code); onToast('Copied the sketch'); } },
          { label: 'Download sketch.ino', icon: <Download size={14} />, run: () => saveFile(`${(project.name || 'sketch').replace(/[^\w-]+/g, '_')}.ino`, code) },
          'divider',
          { label: 'Editor settings', icon: <Settings2 size={14} />, run: () => onSettings('editor') },
        ]} />
      </div>

      {find && (
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-line bg-surface-2 p-2">
          <div className="flex items-center gap-1">
            <input autoFocus className="input h-7 flex-1 font-mono text-[12px]" placeholder="Find" value={find.q}
              onChange={e => setFind({ ...find, q: e.target.value, i: 0 })}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); goTo(find.i + (e.shiftKey ? -1 : 1) - (pos.sel ? 0 : 1)); } if (e.key === 'Escape') setFind(null); }} />
            <span className="w-14 text-center font-mono text-[11px] text-fg-3 tabular-nums">{find.q ? (hits.length ? `${find.i + 1}/${hits.length}` : 'none') : ''}</span>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => goTo(find.i - 1)} disabled={!hits.length} aria-label="Previous match"><ArrowUp size={13} /></button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => goTo(find.i + 1)} disabled={!hits.length} aria-label="Next match"><ArrowDown size={13} /></button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setFind(null)} aria-label="Close find"><X size={13} /></button>
          </div>
          <div className="flex items-center gap-1">
            <input className="input h-7 flex-1 font-mono text-[12px]" placeholder="Replace with" value={find.r} disabled={running}
              onChange={e => setFind({ ...find, r: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') replace(false); if (e.key === 'Escape') setFind(null); }} />
            <button className="btn btn-sm" onClick={() => replace(false)} disabled={running || !hits.length}>Replace</button>
            <button className="btn btn-sm" onClick={() => replace(true)} disabled={running || !hits.length}>All</button>
          </div>
        </div>
      )}

      <div ref={scroller} className={`scroll code-area min-h-0 overflow-auto ${editor.wrap ? 'wrap' : ''} ${serialOpen ? 'flex-[3]' : 'flex-1'}`}
        style={{ fontSize: editor.fontSize, lineHeight: `${lh}px` }} onKeyUp={readPos} onMouseUp={readPos}>
        <div className="flex min-h-full">
          {showGutter && (
            <div className="shrink-0 py-3 pr-2 pl-3 text-right select-none" style={{ color: 'var(--code-gutter)' }} aria-hidden="true">
              {Array.from({ length: lines }, (_, i) => (
                <div key={i} className={problem?.line === i + 1 ? 'rounded-sm bg-bad px-1 font-semibold text-white' : pos.ln === i + 1 ? 'px-1 text-[var(--code-fg)]' : 'px-1'}>{i + 1}</div>
              ))}
            </div>
          )}
          <Editor
            value={code}
            onValueChange={setCode}
            onKeyDown={onKeyDown}
            highlight={c => Prism.highlight(c, Prism.languages.cpp, 'cpp')}
            padding={12}
            tabSize={editor.tabSize}
            insertSpaces
            disabled={running}
            textareaId="sketch"
            aria-label="Arduino sketch"
            style={{ fontFamily: 'var(--font-mono)', fontSize: editor.fontSize, lineHeight: `${lh}px`, minHeight: '100%', flex: '1 1 auto', minWidth: editor.wrap ? 0 : 'max-content' }}
          />
        </div>
      </div>

      {/* Editor status line */}
      <div className="flex h-6 shrink-0 items-center gap-3 overflow-hidden border-t border-line bg-surface px-3 font-mono text-[10.5px] whitespace-nowrap text-fg-3">
        <span className="tabular-nums">Ln {pos.ln}, Col {pos.col}{pos.sel ? ` (${pos.sel} selected)` : ''}</span>
        <span className="flex-1" />
        <button className="hover:text-fg" onClick={() => setSettings('editor', { tabSize: editor.tabSize === 2 ? 4 : 2 })} data-tip="Indent size" data-tip-pos="top">Spaces: {editor.tabSize}</button>
        <span className="flex items-center gap-0.5">
          <button className="rounded px-1 hover:text-fg" aria-label="Smaller text" onClick={() => setSettings('editor', { fontSize: Math.max(10, editor.fontSize - 1) })}><Type size={9} /></button>
          <span className="tabular-nums">{editor.fontSize}px</span>
          <button className="rounded px-1 hover:text-fg" aria-label="Larger text" onClick={() => setSettings('editor', { fontSize: Math.min(22, editor.fontSize + 1) })}><Type size={12} /></button>
        </span>
        <button className="flex items-center gap-1 hover:text-fg" onClick={() => onSettings('editor')} data-tip="Code theme" data-tip-pos="top">
          <span className="flex overflow-hidden rounded-sm" aria-hidden="true">{theme.swatch.map(c => <span key={c} className="h-2 w-1.5" style={{ background: c }} />)}</span>
          {theme.name}
        </button>
        <span className="hidden 2xl:inline">C++ · {boardName ?? 'No board'}</span>
      </div>

      {problem && (
        <div role="alert" className="flex shrink-0 gap-2.5 border-t border-line bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed">
          <CircleAlert size={15} className="mt-0.5 shrink-0 text-bad" aria-hidden="true" />
          <span><span className="font-semibold text-fg">{problem.kind === 'build' ? `Line ${problem.line}` : 'Stopped while running'}</span><span className="text-fg-2">  {problem.message}</span></span>
        </div>
      )}
      {!boardName && !problem && (
        <p className="shrink-0 border-t border-line bg-surface-2 px-3 py-2 text-[12.5px] text-fg-2">This circuit has no board, so the sketch isn’t used. Add an Arduino Uno to run code.</p>
      )}

      <SerialMonitor {...p} open={serialOpen} setOpen={setSerialOpen} />
    </>
  );
}

// ---------- Serial monitor ----------

const ENDINGS: [LineEnding, string, string][] = [['none', 'No line ending', ''], ['nl', 'Newline', '\n'], ['cr', 'Carriage return', '\r'], ['both', 'Both NL & CR', '\r\n']];

function SerialMonitor({ project, running, serial, onClearSerial, onSend, onToast, open, setOpen }: Props & { open: boolean; setOpen: (o: boolean) => void }) {
  const { serial: cfg } = useSettings();
  const out = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [graph, setGraph] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [frozen, setFrozen] = useState<SerialLine[] | null>(null);
  const history = useRef<string[]>([]);
  const hpos = useRef(-1);
  const want = sketchBaud(project.code);
  const mismatch = want !== null && want !== cfg.baud;
  const shown = useMemo(() => {
    let l = frozen ?? serial.lines;
    if (!cfg.echo) l = l.filter(x => !x.tx);
    if (filter) { const q = filter.toLowerCase(); l = l.filter(x => x.s.toLowerCase().includes(q)); }
    return l.slice(-600);
  }, [serial.lines, frozen, cfg.echo, filter]);
  useEffect(() => {
    const el = out.current;
    if (el && cfg.autoscroll && !frozen) el.scrollTop = el.scrollHeight;
  }, [shown, graph, cfg.autoscroll, frozen]);

  const send = () => {
    if (!input || !running) return;
    onSend(input + (ENDINGS.find(e => e[0] === cfg.lineEnding)?.[2] ?? ''));
    history.current = [input, ...history.current.filter(h => h !== input)].slice(0, 30);
    hpos.current = -1;
    setInput('');
  };
  const text = (l: SerialLine) => (l.tx ? l.s : mismatch ? garble(l.s, cfg.baud / want!) : l.s);
  const logText = () => serial.lines.map(l => `${cfg.timestamps ? `${stamp(l.t)} ${l.tx ? '<-' : '->'} ` : ''}${l.tx ? `> ${l.s}` : text(l)}`).join('\n');

  return (
    <div className={`flex min-h-0 flex-col border-t border-line ${open ? 'flex-[2]' : 'shrink-0'}`}>
      <div className="flex h-9 shrink-0 items-center gap-1 pr-1.5 pl-2">
        <button className="flex shrink-0 items-center gap-1.5 rounded px-1 text-[12px] font-semibold whitespace-nowrap" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? <ChevronDown size={13} className="text-fg-3" /> : <ChevronUp size={13} className="text-fg-3" />}Serial monitor
          {running && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />}
        </button>
        <span className="flex-1" />
        {open && (
          <>
            <select className="input h-7 w-auto py-0 pr-6 pl-2 font-mono text-[11px]" value={cfg.baud} onChange={e => setSettings('serial', { baud: +e.target.value })} aria-label="Baud rate" data-tip="Baud rate">
              {BAUDS.map(b => <option key={b} value={b}>{b} baud</option>)}
            </select>
            <div className="seg" role="group" aria-label="Serial view">
              <button onClick={() => setGraph(false)} aria-pressed={!graph} data-tip="Text"><TextAlignStart size={12} /><span className="sr-only">Text</span></button>
              <button onClick={() => setGraph(true)} aria-pressed={graph} data-tip="Graph"><ChartLine size={12} /><span className="sr-only">Graph</span></button>
            </div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setFrozen(f => (f ? null : serial.lines))} aria-pressed={!!frozen} aria-label={frozen ? 'Resume' : 'Pause the view'} data-tip={frozen ? 'Resume' : 'Pause view'}>
              {frozen ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <Menu label="Serial options" align="right" trigger={<Ellipsis size={15} />} items={[
              { label: `${cfg.timestamps ? '✓ ' : ''}Show timestamps`, icon: <Clock size={14} />, run: () => setSettings('serial', { timestamps: !cfg.timestamps }) },
              { label: `${cfg.autoscroll ? '✓ ' : ''}Autoscroll`, icon: <ArrowDown size={14} />, run: () => setSettings('serial', { autoscroll: !cfg.autoscroll }) },
              { label: `${cfg.echo ? '✓ ' : ''}Show what I send`, icon: <Send size={14} />, run: () => setSettings('serial', { echo: !cfg.echo }) },
              { label: cfg.view === 'hex' ? 'Show as text' : 'Show as hex bytes', icon: <Type size={14} />, run: () => setSettings('serial', { view: cfg.view === 'hex' ? 'text' : 'hex' }) },
              { label: filter === null ? 'Filter lines' : 'Stop filtering', icon: <Search size={14} />, run: () => setFilter(f => (f === null ? '' : null)) },
              'divider',
              { label: 'Copy output', icon: <Copy size={14} />, run: () => { void navigator.clipboard?.writeText(logText()); onToast('Copied the serial output'); } },
              { label: 'Save log (.txt)', icon: <Download size={14} />, run: () => saveFile('serial-log.txt', logText()) },
            ]} />
            <button onClick={() => { onClearSerial(); setFrozen(null); }} className="btn btn-ghost btn-sm btn-icon" aria-label="Clear" data-tip="Clear" data-tip-pos="left"><Eraser size={13} /></button>
          </>
        )}
      </div>
      {open && (
        <>
          {mismatch && (
            <div className="flex shrink-0 items-center gap-2 border-y border-line bg-surface-2 px-3 py-1.5 text-[12px] text-fg-2">
              <CircleAlert size={13} className="shrink-0 text-warn" />
              <span className="flex-1">Your sketch uses <code className="font-mono text-fg">Serial.begin({want})</code>, so text at {cfg.baud} baud comes out garbled.</span>
              <button className="btn btn-sm shrink-0" onClick={() => setSettings('serial', { baud: want! })}>Use {want}</button>
            </div>
          )}
          {filter !== null && (
            <div className="flex shrink-0 items-center gap-1.5 px-2 pb-1.5">
              <Search size={12} className="text-fg-3" />
              <input autoFocus className="input h-7 font-mono text-[12px]" placeholder="Only show lines containing…" value={filter} onChange={e => setFilter(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setFilter(null); }} />
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setFilter(null)} aria-label="Stop filtering"><X size={13} /></button>
            </div>
          )}
          {graph ? <Plotter lines={received(serial).filter((_, i, a) => i < a.length - (serial.open ? 1 : 0))} running={running} garbled={mismatch} /> : (
            <div ref={out} className="scroll min-h-0 flex-1 overflow-auto px-3 py-1.5 font-mono text-[12px] leading-5 text-fg" style={{ background: 'var(--code-bg)' }} role="log" aria-live="off">
              {shown.length ? shown.map((l, i) => (
                <div key={i} className={`whitespace-pre-wrap break-all ${l.tx ? 'text-fg-3' : ''}`}>
                  {cfg.timestamps && <span className="mr-2 text-fg-3 select-none">{stamp(l.t)} {l.tx ? '←' : '→'}</span>}
                  {l.tx ? <span>{!cfg.timestamps && <ArrowRight size={10} className="mr-1 inline" />}{l.s}</span> : cfg.view === 'hex' ? <span className="text-fg-2">{hex(text(l))}</span> : text(l)}
                </div>
              )) : <span className="text-fg-3">{filter ? 'No lines match.' : running ? 'Nothing printed yet. Use Serial.println() in your sketch.' : 'Text from Serial.print() appears here while the simulation runs.'}</span>}
              {frozen && <div className="sticky bottom-0 mt-1 w-fit rounded bg-surface-3 px-2 py-0.5 text-[11px] text-fg-2">Paused. New output is still being recorded.</div>}
            </div>
          )}
          <form className="flex shrink-0 gap-1.5 border-t border-line p-2" onSubmit={e => { e.preventDefault(); send(); }}>
            <input value={input} onChange={e => setInput(e.target.value)} disabled={!running} aria-label="Send text to the board"
              placeholder={running ? 'Send text to the board (↑ for history)' : 'Start the simulation to send text'}
              onKeyDown={e => {
                if (e.key === 'ArrowUp' && history.current.length) { e.preventDefault(); hpos.current = Math.min(history.current.length - 1, hpos.current + 1); setInput(history.current[hpos.current]); }
                if (e.key === 'ArrowDown') { e.preventDefault(); hpos.current = Math.max(-1, hpos.current - 1); setInput(hpos.current < 0 ? '' : history.current[hpos.current]); }
              }}
              className="input min-w-0 font-mono text-[12px]" />
            <select className="input w-auto shrink-0 py-0 pr-6 pl-2 text-[11px]" value={cfg.lineEnding} onChange={e => setSettings('serial', { lineEnding: e.target.value as LineEnding })} aria-label="Line ending" data-tip="Added to what you send" data-tip-pos="top">
              {ENDINGS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <button type="submit" disabled={!running || !input} className="btn btn-icon shrink-0" aria-label="Send"><Send size={13} /></button>
          </form>
          <div className="flex h-5 shrink-0 items-center gap-3 overflow-hidden border-t border-line bg-surface px-3 font-mono text-[10px] whitespace-nowrap text-fg-3">
            <span>{serial.lines.filter(l => !l.tx).length} lines</span>
            {cfg.timestamps && <span>timestamps on</span>}
            {cfg.view === 'hex' && <span>hex</span>}
            <span className="flex-1" />
            <span>{cfg.baud} baud · {ENDINGS.find(e => e[0] === cfg.lineEnding)?.[1]}</span>
            {!cfg.autoscroll && <span className="flex items-center gap-1"><Check size={9} />scroll locked</span>}
          </div>
        </>
      )}
    </div>
  );
}

const DASH = ['', '6 4', '2 3', '10 3 2 3'];

/**
 * Serial plotter: graphs the numbers in each printed line. "12 34" or
 * "temp:21.5,hum:60" both become one point per series; labels name the series.
 */
function Plotter({ lines, running, garbled }: { lines: SerialLine[]; running: boolean; garbled: boolean }) {
  const { data, names } = useMemo(() => {
    const rows: number[][] = [];
    let names: string[] = [];
    for (const line of lines.slice(-200)) {
      const nums = line.s.match(/-?\d+(?:\.\d+)?/g);
      if (!nums) continue;
      rows.push(nums.slice(0, 4).map(Number));
      const labels = [...line.s.matchAll(/([A-Za-z_][\w ]*?)\s*[:=]\s*-?\d/g)].map(m => m[1].trim());
      if (labels.length) names = labels;
    }
    return { data: rows, names };
  }, [lines]);
  const series = Math.max(0, ...data.map(r => r.length));
  if (garbled) return <p className="flex-1 px-3 py-2 text-[12.5px] text-fg-3" style={{ background: 'var(--code-bg)' }}>The baud rate doesn’t match the sketch, so there are no numbers to graph.</p>;
  if (!data.length) {
    return <p className="flex-1 px-3 py-2 text-[12.5px] text-fg-3" style={{ background: 'var(--code-bg)' }}>{running ? 'Waiting for numbers. Print one number per line, for example Serial.println(value);' : 'Numbers printed with Serial.println() are graphed here while the simulation runs.'}</p>;
  }
  const all = data.flat();
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const W = 400, H = 160, n = Math.max(2, data.length);
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : v.toFixed(1));
  const last = data[data.length - 1];
  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-2" style={{ background: 'var(--code-bg)' }}>
      <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 py-1 font-mono text-[11.5px] text-fg">
        {Array.from({ length: series }, (_, k) => (
          <span key={k} className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" style={{ stroke: 'var(--fg)' }} strokeWidth="2" strokeDasharray={DASH[k]} /></svg>
            {names[k] && <span className="text-fg-3">{names[k]}</span>}
            {last[k] !== undefined ? fmt(last[k]) : '–'}
          </span>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label={`Graph of the last ${data.length} printed values`}>
          {[0.25, 0.5, 0.75].map(f => <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} style={{ stroke: 'var(--line)' }} vectorEffect="non-scaling-stroke" />)}
          {Array.from({ length: series }, (_, k) => (
            <polyline key={k} fill="none" style={{ stroke: 'var(--fg)' }} strokeWidth={1.6} strokeDasharray={DASH[k]} vectorEffect="non-scaling-stroke" strokeLinejoin="round"
              points={data.map((r, i) => (r[k] === undefined ? null : `${x(i)},${y(r[k])}`)).filter(Boolean).join(' ')} />
          ))}
        </svg>
        <span className="pointer-events-none absolute top-0 left-0 rounded px-1 font-mono text-[10px] text-fg-3" style={{ background: 'var(--code-bg)' }}>{fmt(hi)}</span>
        <span className="pointer-events-none absolute bottom-0 left-0 rounded px-1 font-mono text-[10px] text-fg-3" style={{ background: 'var(--code-bg)' }}>{fmt(lo)}</span>
      </div>
    </div>
  );
}

// ---------- Guide ----------

function Guide({ starter, tipsDone, onToggleTip, onExplore }: Props & { starter: Starter }) {
  const total = starter.tryIt.length;
  const used = [...new Set(starter.parts)];
  return (
    <div className="scroll min-h-0 flex-1 overflow-auto">
      <div className="border-b border-line p-4">
        <p className="eyebrow">{starter.level}</p>
        <h2 className="mt-1 text-[16px] font-semibold">{starter.title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">{starter.summary}</p>
      </div>

      <section className="border-b border-line p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">Things to try</h3>
          <span className="font-mono text-[11.5px] text-fg-3">{tipsDone.length} of {total}</span>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-fg transition-[width]" style={{ width: `${(tipsDone.length / total) * 100}%` }} />
        </div>
        <ol className="mt-3 space-y-1">
          {starter.tryIt.map((t, i) => {
            const done = tipsDone.includes(i);
            return (
              <li key={i}>
                <label className="flex cursor-pointer gap-3 rounded-md p-2 hover:bg-surface-2">
                  <input type="checkbox" className="peer sr-only" checked={done} onChange={() => onToggleTip(i)} />
                  <span className={`mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${done ? 'border-fg bg-fg text-app' : 'border-line-2'}`} aria-hidden="true">
                    {done ? <Check size={12} strokeWidth={3} /> : <span className="font-mono text-[10px] text-fg-3">{i + 1}</span>}
                  </span>
                  <span className={`text-[13px] leading-relaxed ${done ? 'text-fg-3 line-through' : 'text-fg'}`}>{t}</span>
                </label>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="p-4">
        <h3 className="text-[13px] font-semibold">In this project</h3>
        <ul className="mt-2 space-y-0.5">
          {used.map(t => (
            <li key={t}>
              <button className="group flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-surface-2" onClick={() => onExplore(t)}>
                <span className="tile-art h-9 w-9 shrink-0"><PartThumb part={{ id: t, type: t, x: 0, y: 0, rot: 0, props: PARTS[t].defaults }} size={28} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{PARTS[t].name}</span>
                  <span className="block truncate text-[12px] text-fg-3">{PARTS[t].blurb}</span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------- Tutor ----------

interface Msg { from: 'you' | 'tutor'; text: string }

/** Tiny Markdown renderer: code blocks, inline code, bold, lists, headings. */
function md(src: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return src.split(/```/).map((chunk, i) => {
    if (i % 2) return `<pre><code>${esc(chunk.replace(/^\w*\n/, ''))}</code></pre>`;
    const out: string[] = [];
    let list: string | null = null;
    for (const line of chunk.split('\n')) {
      const li = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
      const tag = li ? (/^\s*\d/.test(line) ? 'ol' : 'ul') : null;
      if (list && list !== tag) { out.push(`</${list}>`); list = null; }
      if (li) { if (!list) { out.push(`<${tag}>`); list = tag; } out.push(`<li>${inline(li[1])}</li>`); continue; }
      const h = /^#{1,4}\s+(.*)$/.exec(line);
      if (h) out.push(`<h4>${inline(h[1])}</h4>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push(`</${list}>`);
    return out.join('');
  }).join('');
}

const IDEAS = ['Why is my LED not lighting up?', 'Explain my code line by line', 'What should I try building next?'];

function Tutor({ project, notes }: { project: Project; notes: Note[] }) {
  const [settings, setSettings] = useState<TutorSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const key = settings.provider === 'gemini' ? settings.geminiKey : settings.groqKey;
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setMsgs(m => [...m, { from: 'you', text: q }]);
    setText('');
    setBusy(true);
    try {
      const answer = await askTutor(settings, q, project, notes);
      setMsgs(m => [...m, { from: 'tutor', text: answer }]);
    } catch (e) {
      setMsgs(m => [...m, { from: 'tutor', text: `The tutor couldn’t answer: ${(e as Error).message || 'the request failed'}. Check your key and model name in the tutor settings.` }]);
    }
    setBusy(false);
  };
  const set = (patch: Partial<TutorSettings>) => { const s = { ...settings, ...patch }; setSettings(s); saveSettings(s); };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {(!key || showSettings) && (
          <div className="card space-y-3 p-4">
            <div>
              <p className="text-[13px] font-semibold">{key ? 'Tutor settings' : 'Connect the tutor'}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">The tutor reads your circuit and code and answers questions about them. It uses your own free API key, which stays in this browser.</p>
            </div>
            <label className="block"><span className="label mb-1">Service</span>
              <select className="input" value={settings.provider} onChange={e => set({ provider: e.target.value as TutorSettings['provider'] })}>
                <option value="gemini">Google Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </label>
            {settings.provider === 'gemini' ? (
              <>
                <label className="block"><span className="label mb-1">Gemini API key</span><input type="password" className="input" value={settings.geminiKey} onChange={e => set({ geminiKey: e.target.value.trim() })} /></label>
                <label className="block"><span className="label mb-1">Model</span><input className="input font-mono text-[12px]" value={settings.geminiModel} onChange={e => set({ geminiModel: e.target.value.trim() })} /></label>
                <a className="inline-block text-[12.5px] text-fg underline underline-offset-2" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get a key from Google AI Studio</a>
              </>
            ) : (
              <>
                <label className="block"><span className="label mb-1">Groq API key</span><input type="password" className="input" value={settings.groqKey} onChange={e => set({ groqKey: e.target.value.trim() })} /></label>
                <label className="block"><span className="label mb-1">Model</span><input className="input font-mono text-[12px]" value={settings.groqModel} onChange={e => set({ groqModel: e.target.value.trim() })} /></label>
                <a className="inline-block text-[12.5px] text-fg underline underline-offset-2" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Get a key from the Groq console</a>
              </>
            )}
          </div>
        )}
        {key && !msgs.length && (
          <div>
            <p className="text-[13px] text-fg-2">Ask about your circuit or your code. The tutor can see both.</p>
            <div className="mt-3 flex flex-col items-start gap-1.5">
              {IDEAS.map(q => <button key={q} onClick={() => ask(q)} className="btn btn-sm h-auto py-1.5 text-left font-normal">{q}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[92%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${m.from === 'you' ? 'ml-auto bg-inverse text-on-inverse' : 'border border-line bg-surface-2'}`}>
            {m.from === 'you' ? m.text : <div className="prose-mini" dangerouslySetInnerHTML={{ __html: md(m.text) }} />}
          </div>
        ))}
        {busy && <p className="text-[12.5px] text-fg-3">Thinking…</p>}
        <div ref={end} />
      </div>
      <form className="flex shrink-0 gap-1.5 border-t border-line p-2" onSubmit={e => { e.preventDefault(); ask(text); }}>
        <button type="button" onClick={() => setShowSettings(s => !s)} aria-label="Tutor settings" aria-pressed={showSettings} className="btn btn-ghost btn-icon shrink-0" data-tip="Settings" data-tip-pos="top"><Settings2 size={15} /></button>
        <input value={text} onChange={e => setText(e.target.value)} disabled={!key} aria-label="Ask the tutor" placeholder={key ? 'Ask a question' : 'Add a key above to ask questions'} className="input" />
        <button type="submit" disabled={!key || busy || !text.trim()} className="btn btn-primary btn-icon shrink-0" aria-label="Ask"><Send size={14} /></button>
      </form>
    </div>
  );
}
