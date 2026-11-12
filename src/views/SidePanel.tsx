import { useEffect, useMemo, useRef, useState } from 'react';
import EditorModule from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import { CircleAlert, Eraser, Send, Settings2, X } from 'lucide-react';
import type { Note, Project } from '../types';
import { askTutor, loadSettings, saveSettings } from '../services/aiService';
import type { TutorSettings } from '../services/aiService';

// The editor ships as CommonJS; depending on the bundler its component is the module or its .default.
const Editor = ((EditorModule as unknown as { default?: typeof EditorModule }).default ?? EditorModule);

export interface Problem { line: number; message: string; kind: 'build' | 'run' }

interface Props {
  tab: 'code' | 'tutor';
  setTab: (t: 'code' | 'tutor') => void;
  project: Project;
  setCode: (c: string) => void;
  running: boolean;
  hasBoard: boolean;
  problem: Problem | null;
  serial: string;
  onClearSerial: () => void;
  onSend: (text: string) => void;
  notes: Note[];
  onClose: () => void;
}

export default function SidePanel(p: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-ink text-white">
      <div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-2 py-1.5">
        {(['code', 'tutor'] as const).map(t => (
          <button key={t} onClick={() => p.setTab(t)} aria-pressed={p.tab === t}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${p.tab === t ? 'bg-white text-ink' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            {t === 'code' ? 'Code' : 'Tutor'}
          </button>
        ))}
        <span className="flex-1" />
        <button onClick={p.onClose} aria-label="Close panel" className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"><X size={16} /></button>
      </div>
      {p.tab === 'code' ? <Code {...p} /> : <Tutor project={p.project} notes={p.notes} />}
    </div>
  );
}

function Code({ project, setCode, running, hasBoard, problem, serial, onClearSerial, onSend }: Props) {
  const lines = useMemo(() => project.code.split('\n').length, [project.code]);
  const out = useRef<HTMLPreElement>(null);
  const [input, setInput] = useState('');
  useEffect(() => { const el = out.current; if (el) el.scrollTop = el.scrollHeight; }, [serial]);

  return (
    <>
      <div className="scroll-dark code-area min-h-0 flex-[3] overflow-auto">
        <div className="flex min-h-full">
          <div className="shrink-0 py-3 pr-2 pl-3 text-right text-white/35 select-none" aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => (
              <div key={i} className={problem?.line === i + 1 ? 'rounded-sm bg-white px-1 font-semibold text-ink' : 'px-1'}>{i + 1}</div>
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
        <div role="alert" className="flex shrink-0 gap-2 border-t border-white/40 bg-white/10 px-3 py-2 text-sm">
          <CircleAlert size={16} className="mt-0.5 shrink-0 text-white" aria-hidden="true" />
          <span><strong>{problem.kind === 'build' ? `Line ${problem.line}` : 'Stopped while running'}.</strong> {problem.message}</span>
        </div>
      )}
      {!hasBoard && !problem && (
        <p className="shrink-0 border-t border-white/10 px-3 py-2 text-sm text-white/70">This circuit has no board, so the sketch is not used. Add an Arduino Uno to run code.</p>
      )}
      {running && <p className="shrink-0 border-t border-white/10 px-3 py-1.5 text-xs text-white/60">Stop the simulation to edit the code.</p>}

      <div className="flex min-h-0 flex-[2] flex-col border-t border-white/10">
        <div className="flex shrink-0 items-center px-3 py-1.5">
          <h2 className="text-sm font-semibold">Serial monitor</h2>
          <span className="flex-1" />
          <button onClick={onClearSerial} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"><Eraser size={13} /> Clear</button>
        </div>
        <pre ref={out} className="scroll-dark min-h-0 flex-1 overflow-auto px-3 pb-2 font-mono text-[12.5px] leading-5 whitespace-pre-wrap text-[#e4e4e7]">
          {serial || <span className="text-white/40">{running ? 'Nothing printed yet. Use Serial.println() in your sketch.' : 'Text from Serial.print() shows up here while the simulation runs.'}</span>}
        </pre>
        <form className="flex shrink-0 gap-1.5 border-t border-white/10 p-2" onSubmit={e => { e.preventDefault(); if (input) { onSend(input + '\n'); setInput(''); } }}>
          <input value={input} onChange={e => setInput(e.target.value)} disabled={!running} aria-label="Send text to the board" placeholder={running ? 'Send text to the board' : 'Start the simulation to send text'}
            className="h-8 min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-2 font-mono text-[12.5px] text-white placeholder:text-white/35" />
          <button type="submit" disabled={!running || !input} className="grid h-8 w-9 place-items-center rounded-md bg-white/10 hover:bg-white/20" aria-label="Send"><Send size={14} /></button>
        </form>
      </div>
    </>
  );
}

// ---- Tutor ----
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
      setMsgs(m => [...m, { from: 'tutor', text: `The tutor could not answer: ${(e as Error).message || 'the request failed'}. Check your key and model name in the tutor settings.` }]);
    }
    setBusy(false);
  };
  const set = (patch: Partial<TutorSettings>) => { const s = { ...settings, ...patch }; setSettings(s); saveSettings(s); };
  const field = 'mt-1 h-8 w-full rounded-md border border-white/15 bg-white/5 px-2 text-sm text-white';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-dark min-h-0 flex-1 overflow-auto p-3">
        {(!key || showSettings) && (
          <div className="mb-3 rounded-lg border border-white/15 p-3 text-sm">
            <p className="font-semibold">{key ? 'Tutor settings' : 'Connect the tutor'}</p>
            <p className="mt-1 text-white/70">The tutor reads your circuit and code and answers questions. It needs your own free API key, which stays in this browser.</p>
            <label className="mt-2 block">Service
              <select className={field} value={settings.provider} onChange={e => set({ provider: e.target.value as TutorSettings['provider'] })}>
                <option value="gemini" className="text-ink">Google Gemini</option>
                <option value="groq" className="text-ink">Groq</option>
              </select>
            </label>
            {settings.provider === 'gemini' ? (
              <>
                <label className="mt-2 block">Gemini API key <input type="password" className={field} value={settings.geminiKey} onChange={e => set({ geminiKey: e.target.value.trim() })} /></label>
                <label className="mt-2 block">Model <input className={field} value={settings.geminiModel} onChange={e => set({ geminiModel: e.target.value.trim() })} /></label>
                <a className="mt-2 inline-block text-white underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get a key from Google AI Studio</a>
              </>
            ) : (
              <>
                <label className="mt-2 block">Groq API key <input type="password" className={field} value={settings.groqKey} onChange={e => set({ groqKey: e.target.value.trim() })} /></label>
                <label className="mt-2 block">Model <input className={field} value={settings.groqModel} onChange={e => set({ groqModel: e.target.value.trim() })} /></label>
                <a className="mt-2 inline-block text-white underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Get a key from the Groq console</a>
              </>
            )}
          </div>
        )}
        {key && !msgs.length && (
          <div className="text-sm">
            <p className="text-white/70">Ask about your circuit or your code. The tutor can see both.</p>
            <div className="mt-2 flex flex-col items-start gap-1.5">
              {IDEAS.map(q => <button key={q} onClick={() => ask(q)} className="rounded-full border border-white/20 px-3 py-1 text-left hover:bg-white/10">{q}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`mb-2 max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${m.from === 'you' ? 'ml-auto bg-white text-ink' : 'bg-white/10'}`}>
            {m.from === 'you' ? m.text : <div className="prose-mini" dangerouslySetInnerHTML={{ __html: md(m.text) }} />}
          </div>
        ))}
        {busy && <p className="text-sm text-white/60">Thinking…</p>}
        <div ref={end} />
      </div>
      <form className="flex shrink-0 gap-1.5 border-t border-white/10 p-2" onSubmit={e => { e.preventDefault(); ask(text); }}>
        <button type="button" onClick={() => setShowSettings(s => !s)} aria-label="Tutor settings" aria-pressed={showSettings} className="grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-white/10"><Settings2 size={16} /></button>
        <input value={text} onChange={e => setText(e.target.value)} disabled={!key} aria-label="Ask the tutor" placeholder={key ? 'Ask a question' : 'Add a key above to ask questions'}
          className="h-9 min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-2.5 text-sm text-white placeholder:text-white/35" />
        <button type="submit" disabled={!key || busy || !text.trim()} className="grid h-9 w-10 place-items-center rounded-md bg-white text-ink" aria-label="Ask"><Send size={15} /></button>
      </form>
    </div>
  );
}
