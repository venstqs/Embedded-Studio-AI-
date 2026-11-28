import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import EditorModule from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import {
  ArrowDown, ArrowRight, ArrowUp, Check, CircleAlert, CircleCheck, Copy, Download, Ellipsis, FileCode,
  Circle, Lightbulb, Lock, Search, Send, Settings2, Sparkles, TextAlignStart, Trophy, Type, WrapText, X,
} from 'lucide-react';
import type { Note, PartType, Project } from '../types';
import { PARTS } from '../parts/catalog';
import { PartThumb } from '../parts/PartArt';
import type { Starter } from '../data/projects';
import type { Challenge, Criterion } from '../data/challenges';
import { askTutor, loadSettings, saveSettings } from '../services/aiService';
import type { TutorSettings } from '../services/aiService';
import { CODE_THEMES, setSettings, useSettings } from '../settings';
import { Menu } from './ui';

// The editor ships as CommonJS; depending on the bundler its component is the module or its .default.
const Editor = ((EditorModule as unknown as { default?: typeof EditorModule }).default ?? EditorModule);

export type DockTab = 'code' | 'guide' | 'tutor' | 'challenge';
export interface Problem { line: number; message: string; kind: 'build' | 'run' }

interface Props {
  tab: DockTab;
  setTab: (t: DockTab) => void;
  project: Project;
  setCode: (c: string) => void;
  running: boolean;
  boardName: string | null;
  problem: Problem | null;
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
  /** The challenge this project is working on, with its live checklist. */
  challenge?: { c: Challenge; crit: Criterion[]; done: boolean; next?: Challenge };
  onNextChallenge: (id: string) => void;
  /** A classroom lesson locked the code. */
  codeLocked: boolean;
}

export default function SidePanel(p: Props) {
  const tabs: [DockTab, string][] = [
    ...(p.challenge ? [['challenge', 'Challenge'] as [DockTab, string]] : []),
    ['code', 'Code'], ...(p.starter && !p.challenge ? [['guide', 'Guide'] as [DockTab, string]] : []), ['tutor', 'Tutor'],
  ];
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 items-center border-b border-line pr-1.5 pl-2">
        <div className="tabs" role="tablist" aria-label="Side panel">
          {tabs.map(([t, label]) => (
            <button key={t} role="tab" aria-selected={p.tab === t} onClick={() => p.setTab(t)}>
              {label}
              {t === 'guide' && p.starter && <span className="font-mono text-[11px] text-fg-3">{p.tipsDone.length}/{p.starter.tryIt.length}</span>}
              {t === 'challenge' && p.challenge && (p.challenge.done
                ? <Trophy size={12} className="text-ok" />
                : <span className="font-mono text-[11px] text-fg-3">{p.challenge.crit.filter(x => x.ok).length}/{p.challenge.crit.length}</span>)}
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
      {p.tab === 'challenge' && p.challenge && <ChallengeView {...p.challenge} running={p.running} onNext={p.onNextChallenge} />}
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
  const { project, boardName, problem, onVerify, onSettings, onToast, codeLocked } = p;
  const running = p.running || codeLocked;
  const setCode = (c: string) => { if (!codeLocked) p.setCode(c); };
  const { editor } = useSettings();
  const code = project.code;
  const lines = useMemo(() => code.split('\n').length, [code]);
  const lh = Math.round(editor.fontSize * 1.55);
  const scroller = useRef<HTMLDivElement>(null);
  const caret = useRef<[number, number] | null>(null);
  const [pos, setPos] = useState({ ln: 1, col: 1, sel: 0 });
  const [find, setFind] = useState<{ q: string; r: string; i: number } | null>(null);
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
        {running && <span className="chip ml-1 h-5 gap-1 text-[11px]"><Lock size={10} aria-hidden="true" />{codeLocked ? 'Locked by the lesson' : 'Read only'}</span>}
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

      <div ref={scroller} className={`scroll code-area min-h-0 overflow-auto ${editor.wrap ? 'wrap' : ''} flex-1`}
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

    </>
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

// ---------- Challenge ----------

const LEVEL_NAME = ['', 'Warm-up', 'Getting there', 'Expert'];

function ChallengeView({ c, crit, done, next, running, onNext }: { c: Challenge; crit: Criterion[]; done: boolean; next?: Challenge; running: boolean; onNext: (id: string) => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [c.id]);
  const met = crit.filter(x => x.ok).length;
  return (
    <div className="scroll min-h-0 flex-1 overflow-auto p-4">
      <div className="flex items-center gap-2">
        <span className="chip">{LEVEL_NAME[c.level]}</span>
        <span className="flex gap-0.5" aria-label={`Difficulty ${c.level} of 3`}>{[1, 2, 3].map(i => <span key={i} className={`h-1.5 w-3 rounded-full ${i <= c.level ? 'bg-fg' : 'bg-line-2'}`} />)}</span>
      </div>
      <h2 className="mt-3 text-[18px] font-semibold tracking-tight">{c.title}</h2>
      <p className="mt-1 text-[13.5px] font-medium text-fg">{c.goal}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-fg-2">{c.brief}</p>

      {done ? (
        <div className="mt-5 rounded-xl border border-line-2 bg-surface-2 p-4 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-inverse text-on-inverse"><Trophy size={20} /></span>
          <p className="mt-3 text-[15px] font-semibold">Challenge complete</p>
          <p className="mt-1 text-[12.5px] text-fg-2">The simulator checked it: every goal was met while it ran.</p>
          {next && <button className="btn btn-primary mt-4 w-full" onClick={() => onNext(next.id)}>Next: {next.title} <ArrowRight size={14} /></button>}
        </div>
      ) : null}

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="eyebrow">Goals</h3>
          <span className="font-mono text-[11px] text-fg-3">{met}/{crit.length}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-ok transition-all duration-500" style={{ width: `${crit.length ? (met / crit.length) * 100 : 0}%` }} /></div>
        <ul className="mt-3 space-y-1.5">
          {crit.map(x => (
            <li key={x.label} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] transition-colors ${x.ok ? 'border-line-2 bg-surface-2' : 'border-line'}`}>
              {x.ok ? <Check size={15} className="mt-0.5 shrink-0 text-ok" /> : <Circle size={15} className="mt-0.5 shrink-0 text-fg-3" />}
              <span className="min-w-0 flex-1">
                <span className={x.ok ? 'text-fg' : 'text-fg-2'}>{x.label}</span>
                {x.detail && <span className="mt-0.5 block font-mono text-[11px] text-fg-3">{x.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
        {!running && !done && <p className="mt-3 text-[12px] text-fg-3">Goals are checked live while the simulation runs. Press Start (Ctrl Enter).</p>}
      </div>

      <div className="mt-6">
        <h3 className="eyebrow">Hints</h3>
        <ol className="mt-2 space-y-1.5">
          {c.hints.slice(0, shown).map((h, i) => (
            <li key={i} className="flex gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-fg-3" />{h}
            </li>
          ))}
        </ol>
        {shown < c.hints.length && (
          <button className="btn btn-sm mt-2" onClick={() => setShown(n => n + 1)}>
            <Lightbulb size={13} /> {shown ? 'Another hint' : 'Show a hint'} <span className="font-mono text-[10.5px] text-fg-3">{shown + 1}/{c.hints.length}</span>
          </button>
        )}
      </div>
    </div>
  );
}
