import { useEffect, useMemo, useRef, useState } from 'react';
import EditorModule from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import { ArrowRight, ChartLine, Check, CircleAlert, Eraser, FileCode, Lock, Send, Settings2, TextAlignStart, X } from 'lucide-react';
import type { Note, PartType, Project } from '../types';
import { PARTS } from '../parts/catalog';
import { PartThumb } from '../parts/PartArt';
import type { Starter } from '../data/projects';
import { askTutor, loadSettings, saveSettings } from '../services/aiService';
import type { TutorSettings } from '../services/aiService';

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
  serial: string;
  onClearSerial: () => void;
  onSend: (text: string) => void;
  notes: Note[];
  onClose: () => void;
  starter?: Starter;
  tipsDone: number[];
  onToggleTip: (i: number) => void;
  onExplore: (t: PartType) => void;
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
        <button onClick={p.onClose} aria-label="Close panel" className="btn btn-ghost btn-sm btn-icon" data-tip="Close panel" data-tip-pos="left"><X size={15} /></button>
      </div>
      {p.tab === 'code' && <Code {...p} />}
      {p.tab === 'guide' && p.starter && <Guide {...p} starter={p.starter} />}
      {p.tab === 'tutor' && <Tutor project={p.project} notes={p.notes} />}
    </div>
  );
}

// ---------- Code ----------

function Code({ project, setCode, running, boardName, problem, serial, onClearSerial, onSend }: Props) {
  const lines = useMemo(() => project.code.split('\n').length, [project.code]);
  const out = useRef<HTMLPreElement>(null);
  const [input, setInput] = useState('');
  const [graph, setGraph] = useState(false);
  useEffect(() => { const el = out.current; if (el) el.scrollTop = el.scrollHeight; }, [serial, graph]);

  return (
    <>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 text-[12px]">
        <FileCode size={13} className="text-fg-3" aria-hidden="true" />
        <span className="font-mono text-fg">sketch.ino</span>
        {running && <span className="chip h-5 gap-1 text-[11px]"><Lock size={10} aria-hidden="true" />Read only while running</span>}
        <span className="flex-1" />
        <span className="text-fg-3">{boardName ?? 'No board'}</span>
      </div>
      <div className="scroll code-area min-h-0 flex-[3] overflow-auto">
        <div className="flex min-h-full">
          <div className="shrink-0 py-3 pr-3 pl-3 text-right select-none" style={{ color: 'var(--code-gutter)' }} aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => (
              <div key={i} className={problem?.line === i + 1 ? 'rounded-sm bg-bad px-1 font-semibold text-white' : 'px-1'}>{i + 1}</div>
            ))}
          </div>
          <Editor
            value={project.code}
            onValueChange={setCode}
            highlight={c => Prism.highlight(c, Prism.languages.cpp, 'cpp')}
            padding={12}
            tabSize={2}
            insertSpaces
            disabled={running}
            textareaId="sketch"
            aria-label="Arduino sketch"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '20px', minHeight: '100%', flex: '1 0 auto', minWidth: 'max-content' }}
          />
        </div>
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

      <div className="flex min-h-0 flex-[2] flex-col border-t border-line">
        <div className="flex h-9 shrink-0 items-center gap-2 px-3">
          <h2 className="text-[12px] font-semibold">Serial monitor</h2>
          <span className="flex-1" />
          <div className="seg" role="group" aria-label="Serial view">
            <button onClick={() => setGraph(false)} aria-pressed={!graph} data-tip="Text"><TextAlignStart size={12} /><span className="sr-only">Text</span></button>
            <button onClick={() => setGraph(true)} aria-pressed={graph} data-tip="Graph"><ChartLine size={12} /><span className="sr-only">Graph</span></button>
          </div>
          <button onClick={onClearSerial} className="btn btn-ghost btn-sm btn-icon" aria-label="Clear" data-tip="Clear" data-tip-pos="left"><Eraser size={13} /></button>
        </div>
        {graph ? <Plotter serial={serial} running={running} /> : (
          <pre ref={out} className="scroll min-h-0 flex-1 overflow-auto px-3 pb-2 font-mono text-[12px] leading-5 whitespace-pre-wrap text-fg" style={{ background: 'var(--code-bg)' }}>
            {serial || <span className="text-fg-3">{running ? 'Nothing printed yet. Use Serial.println() in your sketch.' : 'Text from Serial.print() appears here while the simulation runs.'}</span>}
          </pre>
        )}
        <form className="flex shrink-0 gap-1.5 border-t border-line p-2" onSubmit={e => { e.preventDefault(); if (input) { onSend(input + '\n'); setInput(''); } }}>
          <input value={input} onChange={e => setInput(e.target.value)} disabled={!running} aria-label="Send text to the board" placeholder={running ? 'Send text to the board' : 'Start the simulation to send text'}
            className="input font-mono text-[12px]" />
          <button type="submit" disabled={!running || !input} className="btn btn-icon shrink-0" aria-label="Send"><Send size={13} /></button>
        </form>
      </div>
    </>
  );
}

const DASH = ['', '6 4', '2 3'];

/**
 * Serial plotter: graphs the numbers in each printed line. "12 34" or
 * "temp: 21.5, hum: 60" both become one point per series.
 */
function Plotter({ serial, running }: { serial: string; running: boolean }) {
  const data = useMemo(() => {
    const rows: number[][] = [];
    for (const line of serial.split('\n').slice(-161, -1)) {
      const nums = line.match(/-?\d+(?:\.\d+)?/g);
      if (nums) rows.push(nums.slice(0, 3).map(Number));
    }
    return rows;
  }, [serial]);
  const series = Math.max(0, ...data.map(r => r.length));
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
      <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 pb-1 font-mono text-[11.5px] text-fg">
        {Array.from({ length: series }, (_, k) => (
          <span key={k} className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" style={{ stroke: 'var(--fg)' }} strokeWidth="2" strokeDasharray={DASH[k]} /></svg>
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
