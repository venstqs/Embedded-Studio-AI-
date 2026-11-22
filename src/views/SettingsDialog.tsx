import { useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight, Code, Cpu, Info, Monitor, Palette, RotateCcw, Terminal } from 'lucide-react';
import { BAUDS, CODE_THEMES, SPEEDS, resetSettings, setSettings, useSettings } from '../settings';
import type { LineEnding } from '../settings';
import { Dialog, GithubMark, Logo } from './ui';
import { XAVIERLABS } from '../brand';

export type SettingsSection = 'editor' | 'serial' | 'sim' | 'look' | 'about';

declare const __BUILD__: { hash: string; date: string };
const BUILD = typeof __BUILD__ === 'undefined' ? { hash: 'dev', date: '' } : __BUILD__;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">{hint}</p>}
      </div>
      <div className="flex justify-end">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-fg' : 'bg-surface-3'}`} style={{ boxShadow: 'inset 0 0 0 1px var(--line-2)' }}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${on ? 'left-[18px] bg-[var(--on-inverse)]' : 'left-0.5 bg-fg-3'}`} />
    </button>
  );
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => <button key={String(v)} role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

const SAMPLE = `// Blink the built-in LED
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("on");
  delay(500);
}`;

export default function SettingsDialog({ section: start = 'editor', theme, onTheme, onClose }: {
  section?: SettingsSection; theme: 'dark' | 'light'; onTheme: (t: 'dark' | 'light') => void; onClose: () => void;
}) {
  const s = useSettings();
  const [section, setSection] = useState<SettingsSection>(start);
  const nav: [SettingsSection, string, ReactNode][] = [
    ['editor', 'Code editor', <Code key="Code" size={14} />],
    ['serial', 'Serial monitor', <Terminal key="Terminal" size={14} />],
    ['sim', 'Simulation', <Cpu key="Cpu" size={14} />],
    ['look', 'Appearance', <Palette key="Palette" size={14} />],
    ['about', 'About XavierLabs', <Info key="Info" size={14} />],
  ];

  return (
    <Dialog title="Settings" onClose={onClose} width={760}>
      <div className="flex max-h-[70vh] min-h-[420px] flex-col sm:flex-row">
        <nav className="flex shrink-0 gap-0.5 overflow-auto border-b border-line p-2 sm:w-48 sm:flex-col sm:border-r sm:border-b-0" aria-label="Settings sections">
          {nav.map(([id, label, icon]) => (
            <button key={id} onClick={() => setSection(id)} aria-current={section === id ? 'page' : undefined}
              className={`flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-left text-[12.5px] ${section === id ? 'bg-surface-2 font-medium text-fg' : 'text-fg-2 hover:text-fg'}`}>
              <span className="text-fg-3">{icon}</span>{label}
            </button>
          ))}
          <span className="hidden flex-1 sm:block" />
          <button className="hidden h-8 items-center gap-2 rounded-md px-2.5 text-[12px] text-fg-3 hover:text-fg sm:flex" onClick={resetSettings}><RotateCcw size={13} /> Reset all</button>
        </nav>

        <div className="scroll min-w-0 flex-1 overflow-auto px-5 py-2">
          {section === 'editor' && (
            <>
              <div className="py-3">
                <p className="mb-2 text-[13px] font-medium">Code theme</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {CODE_THEMES.map(t => (
                    <button key={t.id} onClick={() => setSettings('editor', { theme: t.id })} aria-pressed={s.editor.theme === t.id}
                      className="overflow-hidden rounded-lg text-left" style={{ boxShadow: s.editor.theme === t.id ? '0 0 0 2px var(--fg)' : '0 0 0 1px var(--line-2)' }}>
                      <div className="code-area overflow-hidden px-2.5 py-2 font-mono text-[10.5px] leading-4 whitespace-nowrap" data-code-theme={t.id} style={{ background: 'var(--code-bg)' }}>
                        <span style={{ color: 'var(--code-keyword)', fontWeight: 600 }}>void</span> <span style={{ color: 'var(--code-function)' }}>loop</span><span style={{ color: 'var(--code-punct)' }}>() {'{'}</span><br />
                        &nbsp;&nbsp;<span style={{ color: 'var(--code-function)' }}>delay</span><span style={{ color: 'var(--code-punct)' }}>(</span><span style={{ color: 'var(--code-number)' }}>500</span><span style={{ color: 'var(--code-punct)' }}>);</span> <span style={{ color: 'var(--code-comment)' }}>// wait</span><br />
                        <span style={{ color: 'var(--code-punct)' }}>{'}'}</span>
                      </div>
                      <p className="border-t border-line px-2.5 py-1.5 text-[12px] font-medium">{t.name}</p>
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Text size" hint="Also on the editor’s status line.">
                <div className="flex items-center gap-2">
                  <input type="range" min={10} max={22} value={s.editor.fontSize} onChange={e => setSettings('editor', { fontSize: +e.target.value })} className="w-32" aria-label="Text size" />
                  <span className="w-10 text-right font-mono text-[12px] tabular-nums">{s.editor.fontSize}px</span>
                </div>
              </Field>
              <Field label="Indent size" hint="Spaces per Tab press, and for Tidy indentation.">
                <Seg label="Indent size" value={s.editor.tabSize} options={[[2, '2'], [4, '4']]} onChange={v => setSettings('editor', { tabSize: v })} />
              </Field>
              <Field label="Close brackets and quotes" hint="Typing ( adds the ), and Enter between { } opens an indented line.">
                <Toggle label="Close brackets" on={s.editor.autoClose} onChange={v => setSettings('editor', { autoClose: v })} />
              </Field>
              <Field label="Line numbers" hint="Hidden while long lines wrap.">
                <Toggle label="Line numbers" on={s.editor.lineNumbers} onChange={v => setSettings('editor', { lineNumbers: v })} />
              </Field>
              <Field label="Wrap long lines">
                <Toggle label="Wrap long lines" on={s.editor.wrap} onChange={v => setSettings('editor', { wrap: v })} />
              </Field>
              <div className="py-3">
                <p className="mb-2 text-[12px] text-fg-3">Preview</p>
                <pre className="code-area overflow-auto rounded-lg p-3" style={{ fontSize: s.editor.fontSize, lineHeight: `${Math.round(s.editor.fontSize * 1.55)}px`, boxShadow: '0 0 0 1px var(--line-2)' }}>
                  {SAMPLE.split('\n').map((l, i) => <div key={i}>{l.replace(/^ {2}/, ' '.repeat(s.editor.tabSize)) || ' '}</div>)}
                </pre>
              </div>
            </>
          )}

          {section === 'serial' && (
            <>
              <Field label="Baud rate" hint="Must match Serial.begin() in your sketch, or the text comes out garbled, just like on a real board.">
                <select className="input w-36" value={s.serial.baud} onChange={e => setSettings('serial', { baud: +e.target.value })}>
                  {BAUDS.map(b => <option key={b} value={b}>{b} baud</option>)}
                </select>
              </Field>
              <Field label="Line ending" hint="Added to the end of everything you send.">
                <select className="input w-40" value={s.serial.lineEnding} onChange={e => setSettings('serial', { lineEnding: e.target.value as LineEnding })}>
                  <option value="none">No line ending</option><option value="nl">Newline</option><option value="cr">Carriage return</option><option value="both">Both NL &amp; CR</option>
                </select>
              </Field>
              <Field label="Timestamps" hint="Show the simulated time each line arrived.">
                <Toggle label="Timestamps" on={s.serial.timestamps} onChange={v => setSettings('serial', { timestamps: v })} />
              </Field>
              <Field label="Autoscroll" hint="Keep the newest line in view.">
                <Toggle label="Autoscroll" on={s.serial.autoscroll} onChange={v => setSettings('serial', { autoscroll: v })} />
              </Field>
              <Field label="Show what I send" hint="Echo your messages in the monitor, dimmed.">
                <Toggle label="Echo" on={s.serial.echo} onChange={v => setSettings('serial', { echo: v })} />
              </Field>
              <Field label="Display" hint="Hex shows the raw bytes: 'A' is 41, a newline is 0A.">
                <Seg label="Display" value={s.serial.view} options={[['text', 'Text'], ['hex', 'Hex']]} onChange={v => setSettings('serial', { view: v })} />
              </Field>
            </>
          )}

          {section === 'sim' && (
            <>
              <Field label="Simulation speed" hint="Slow motion makes fast things visible: watch a capacitor charge or a 555 flip. Also in the menu next to Start.">
                <Seg label="Speed" value={s.sim.speed} options={SPEEDS.map(v => [v, `${v}×`] as [number, string])} onChange={v => setSettings('sim', { speed: v })} />
              </Field>
              <p className="py-3 text-[12px] leading-relaxed text-fg-3">The clock in the header and the serial timestamps show simulated time, so <code className="font-mono">millis()</code> and <code className="font-mono">delay()</code> stay correct at any speed.</p>
            </>
          )}

          {section === 'look' && (
            <>
              <Field label="Theme">
                <Seg label="Theme" value={theme} options={[['dark', 'Dark'], ['light', 'Light']]} onChange={onTheme} />
              </Field>
              <Field label="Density" hint="Compact fits more on small screens.">
                <Seg label="Density" value={s.ui.density} options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]} onChange={v => setSettings('ui', { density: v })} />
              </Field>
              <Field label="Animations" hint="Turn off moving effects such as current flow and spinners.">
                <Toggle label="Animations" on={s.ui.motion} onChange={v => setSettings('ui', { motion: v })} />
              </Field>
            </>
          )}

          {section === 'about' && (
            <div className="py-4">
              <div className="flex items-center gap-3">
                <Logo size={44} boxed />
                <div>
                  <p className="text-[16px] font-semibold tracking-tight">XavierLabs IDE</p>
                  <p className="text-[12.5px] text-fg-2">Electronics lab in the browser</p>
                </div>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-fg-2">
                Part of <span className="font-medium text-fg">XavierLabs</span>, the home of Adrian Xavier Moral’s own tools, from ESP32 and LoRaWAN boards to on-device AI and research agents. Everything shipped for the lab lives under one name.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {([
                  [XAVIERLABS.site, 'XavierLabs', 'The lab and its maker', <Monitor key="site" size={15} />],
                  [XAVIERLABS.lab, 'XavierLabs AI', 'Terminal research agents', <Terminal key="ai" size={15} />],
                  [XAVIERLABS.github, 'GitHub', 'Everything else, @venstqs', <GithubMark key="gh" size={15} />],
                  [XAVIERLABS.contact, 'Say hello', 'Ideas, bugs and collaborations', <ArrowUpRight key="hi" size={15} />],
                ] as const).map(([href, title, sub, icon]) => (
                  <a key={title} href={href} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-3 hover:bg-surface-2">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-surface-2 text-fg-2">{icon}</span>
                    <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{title}</span><span className="block truncate text-[12px] text-fg-3">{sub}</span></span>
                    <ArrowUpRight size={14} className="text-fg-3" />
                  </a>
                ))}
              </div>
              <p className="mt-5 font-mono text-[11px] text-fg-3">
                build <a className="underline-offset-2 hover:text-fg hover:underline" href={`${XAVIERLABS.repo}/commit/${BUILD.hash}`} target="_blank" rel="noreferrer">{BUILD.hash}</a>{BUILD.date && ` · ${BUILD.date}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
