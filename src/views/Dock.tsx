import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDown, ArrowRight, ChartLine, ChevronDown, ChevronUp, CircleAlert, Clock, Copy, Crosshair, Download, Ellipsis, Eraser, Pause, Play, Search, Send,
  TextAlignStart, Trash2, Type, X,
} from 'lucide-react';
import { BAUDS, setSettings, sketchBaud, useSettings } from '../settings';
import type { LineEnding } from '../settings';
import { garble, hex, received, stamp } from '../sim/serialLog';
import type { SerialLine, SerialLog } from '../sim/serialLog';
import { logic, stats } from '../sim/probes';
import type { ProbeRecorder, Trace } from '../sim/probes';
import { Menu } from './ui';

/**
 * The bottom dock under the workplane, like the panel in a code editor or
 * a CAD tool: serial monitor, probes and problems share one resizable strip.
 */

export interface DockTabDef { id: string; label: string; icon: ReactNode; badge?: ReactNode; content: ReactNode }
export interface DockState { open: boolean; tab: string; h: number }

export function Dock({ tabs, state, setState }: { tabs: DockTabDef[]; state: DockState; setState: (s: DockState) => void }) {
  const active = tabs.find(t => t.id === state.tab) ?? tabs[0];
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const sy = e.clientY, h0 = state.h;
    const move = (ev: PointerEvent) => setState({ ...state, open: true, h: Math.round(Math.max(120, Math.min(window.innerHeight * 0.65, h0 - (ev.clientY - sy)))) });
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = 'row-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <section className="relative flex shrink-0 flex-col border-t border-line bg-surface" style={{ height: state.open ? state.h : 33 }} aria-label="Bottom panel">
      {state.open && (
        <div role="separator" aria-orientation="horizontal" aria-label="Resize bottom panel" tabIndex={0} onPointerDown={startResize}
          onKeyDown={e => { if (e.key === 'ArrowUp') setState({ ...state, h: Math.min(window.innerHeight * 0.65, state.h + 24) }); if (e.key === 'ArrowDown') setState({ ...state, h: Math.max(120, state.h - 24) }); }}
          className="group absolute -top-1 right-0 left-0 z-10 h-2 cursor-row-resize">
          <span className="absolute inset-x-0 top-1 h-px transition-colors group-hover:bg-fg/30 group-focus-visible:bg-fg/40" />
        </div>
      )}
      <div className="flex h-8 shrink-0 items-center gap-0.5 px-1.5" onDoubleClick={e => { if (e.target === e.currentTarget) setState({ ...state, open: !state.open }); }}>
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto" role="tablist" aria-label="Bottom panel">
          {tabs.map(t => {
            const on = state.open && t.id === active.id;
            return (
              <button key={t.id} role="tab" aria-selected={on} onClick={() => setState({ ...state, open: on ? false : true, tab: t.id })}
                className={`flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium whitespace-nowrap transition-colors ${on ? 'bg-surface-2 text-fg' : 'text-fg-3 hover:text-fg-2'}`}>
                <span className={on ? 'text-fg-2' : ''}>{t.icon}</span>{t.label}{t.badge}
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setState({ ...state, open: !state.open })} aria-label={state.open ? 'Collapse panel' : 'Expand panel'} data-tip={state.open ? 'Collapse' : 'Expand'} data-tip-pos="left">
          {state.open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {state.open && <div className="flex min-h-0 flex-1 flex-col border-t border-line">{active.content}</div>}
    </section>
  );
}

export function Count({ n, tone }: { n: number; tone?: 'warn' | 'bad' | 'ok' }) {
  if (!n) return null;
  const c = tone === 'bad' ? 'bg-bad text-white' : tone === 'warn' ? 'bg-warn text-black' : 'bg-surface-3 text-fg-2';
  return <span className={`grid h-4 min-w-4 place-items-center rounded-full px-1 font-mono text-[9.5px] font-semibold tabular-nums ${c}`}>{n > 99 ? '99+' : n}</span>;
}

function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Serial monitor ----------

const ENDINGS: [LineEnding, string, string][] = [['none', 'No line ending', ''], ['nl', 'Newline', '\n'], ['cr', 'Carriage return', '\r'], ['both', 'Both NL & CR', '\r\n']];

export function SerialPanel({ code, running, serial, onClear, onSend, onToast }: {
  code: string; running: boolean; serial: SerialLog; onClear: () => void; onSend: (text: string) => void; onToast: (t: string) => void;
}) {
  const { serial: cfg } = useSettings();
  const out = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [graph, setGraph] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [frozen, setFrozen] = useState<SerialLine[] | null>(null);
  const history = useRef<string[]>([]);
  const hpos = useRef(-1);
  const want = sketchBaud(code);
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
  const count = serial.lines.filter(l => !l.tx).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-line px-2">
        <select className="input h-7 w-auto py-0 pr-6 pl-2 font-mono text-[11px]" value={cfg.baud} onChange={e => setSettings('serial', { baud: +e.target.value })} aria-label="Baud rate" data-tip="Baud rate">
          {BAUDS.map(b => <option key={b} value={b}>{b} baud</option>)}
        </select>
        <div className="seg" role="group" aria-label="Serial view">
          <button onClick={() => setGraph(false)} aria-pressed={!graph} data-tip="Text"><TextAlignStart size={12} /><span className="ml-1 hidden sm:inline">Text</span></button>
          <button onClick={() => setGraph(true)} aria-pressed={graph} data-tip="Plotter"><ChartLine size={12} /><span className="ml-1 hidden sm:inline">Plot</span></button>
        </div>
        {filter !== null && (
          <label className="relative ml-1 flex min-w-0 max-w-64 flex-1 items-center">
            <Search size={12} className="pointer-events-none absolute left-2 text-fg-3" />
            <input autoFocus className="input h-7 pl-6 font-mono text-[12px]" placeholder="Only lines containing…" value={filter} onChange={e => setFilter(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setFilter(null); }} />
          </label>
        )}
        <span className="flex-1" />
        <span className="hidden font-mono text-[10.5px] text-fg-3 tabular-nums md:inline">{count} lines{cfg.timestamps ? ' · timestamps' : ''}{cfg.view === 'hex' ? ' · hex' : ''}</span>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setFilter(f => (f === null ? '' : null))} aria-pressed={filter !== null} aria-label="Filter lines" data-tip="Filter"><Search size={13} /></button>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setFrozen(f => (f ? null : serial.lines))} aria-pressed={!!frozen} aria-label={frozen ? 'Resume' : 'Pause the view'} data-tip={frozen ? 'Resume' : 'Pause view'}>
          {frozen ? <Play size={13} /> : <Pause size={13} />}
        </button>
        <Menu label="Serial options" align="right" trigger={<Ellipsis size={15} />} items={[
          { label: `${cfg.timestamps ? '✓ ' : ''}Show timestamps`, icon: <Clock size={14} />, run: () => setSettings('serial', { timestamps: !cfg.timestamps }) },
          { label: `${cfg.autoscroll ? '✓ ' : ''}Autoscroll`, icon: <ArrowDown size={14} />, run: () => setSettings('serial', { autoscroll: !cfg.autoscroll }) },
          { label: `${cfg.echo ? '✓ ' : ''}Show what I send`, icon: <Send size={14} />, run: () => setSettings('serial', { echo: !cfg.echo }) },
          { label: cfg.view === 'hex' ? 'Show as text' : 'Show as hex bytes', icon: <Type size={14} />, run: () => setSettings('serial', { view: cfg.view === 'hex' ? 'text' : 'hex' }) },
          'divider',
          { label: 'Copy output', icon: <Copy size={14} />, run: () => { void navigator.clipboard?.writeText(logText()); onToast('Copied the serial output'); } },
          { label: 'Save log (.txt)', icon: <Download size={14} />, run: () => saveFile('serial-log.txt', logText()) },
        ]} />
        <button onClick={() => { onClear(); setFrozen(null); }} className="btn btn-ghost btn-sm btn-icon" aria-label="Clear" data-tip="Clear" data-tip-pos="left"><Eraser size={13} /></button>
      </div>
      {mismatch && (
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3 py-1.5 text-[12px] text-fg-2">
          <CircleAlert size={13} className="shrink-0 text-warn" />
          <span className="flex-1">Your sketch uses <code className="font-mono text-fg">Serial.begin({want})</code>, so text at {cfg.baud} baud comes out garbled.</span>
          <button className="btn btn-sm shrink-0" onClick={() => setSettings('serial', { baud: want! })}>Use {want}</button>
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
      <form className="flex shrink-0 gap-1.5 border-t border-line p-1.5" onSubmit={e => { e.preventDefault(); send(); }}>
        <input value={input} onChange={e => setInput(e.target.value)} disabled={!running} aria-label="Send text to the board"
          placeholder={running ? 'Send text to the board (↑ for history)' : 'Start the simulation to send text'}
          onKeyDown={e => {
            if (e.key === 'ArrowUp' && history.current.length) { e.preventDefault(); hpos.current = Math.min(history.current.length - 1, hpos.current + 1); setInput(history.current[hpos.current]); }
            if (e.key === 'ArrowDown') { e.preventDefault(); hpos.current = Math.max(-1, hpos.current - 1); setInput(hpos.current < 0 ? '' : history.current[hpos.current]); }
          }}
          className="input h-7 min-w-0 font-mono text-[12px]" />
        <select className="input h-7 w-auto shrink-0 py-0 pr-6 pl-2 text-[11px]" value={cfg.lineEnding} onChange={e => setSettings('serial', { lineEnding: e.target.value as LineEnding })} aria-label="Line ending" data-tip="Added to what you send" data-tip-pos="top">
          {ENDINGS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <button type="submit" disabled={!running || !input} className="btn btn-sm btn-icon shrink-0" aria-label="Send"><Send size={13} /></button>
      </form>
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

// ---------- Probes ----------

export interface ProbeRow { id: string; label: string; color: string; name: string }
const WINDOWS = [100, 500, 1000, 2000, 5000, 10000];
const fmtT = (ms: number) => (ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`);
const fmtV = (v: number) => `${v.toFixed(Math.abs(v) >= 10 ? 1 : 2)}`;

/**
 * A multi-channel voltage logger: every probe on the circuit, graphed against
 * simulated time, with live min, max, average and frequency.
 */
export function ProbesPanel({ probes, recorder, now, running, onRemove, onClear, onFocus }: {
  probes: ProbeRow[]; recorder: ProbeRecorder; now: number; running: boolean;
  onRemove: (id: string) => void; onClear: () => void; onFocus: (id: string) => void;
}) {
  const [win, setWin] = useState(2000);
  const [fixed, setFixed] = useState(false);
  const [frozen, setFrozen] = useState<{ now: number; traces: Map<string, Trace> } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [mode, setMode] = useState<'analog' | 'logic'>('analog');
  /** Logic-analyzer style time cursors, in simulated ms. Click the graph to place A, then B. */
  const [cursors, setCursors] = useState<[number | null, number | null]>([null, null]);
  const tNow = frozen?.now ?? now;
  const get = (id: string) => (frozen ? frozen.traces.get(id) : recorder.get(id));
  const from = tNow - win;

  const W = 1000, H = 300;
  const series = probes.map(p => ({ p, tr: get(p.id), st: stats(get(p.id), from, tNow) }));
  let lo = 0, hi = 5.5;
  if (!fixed) {
    const vals = series.flatMap(s => (s.st ? [s.st.min, s.st.max] : []));
    if (vals.length) {
      lo = Math.min(0, ...vals); hi = Math.max(...vals);
      if (hi - lo < 0.5) hi = lo + 1;
      hi += (hi - lo) * 0.1;
      if (lo < 0) lo -= (hi - lo) * 0.05;
    }
  }
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => lo + (hi - lo) * f);

  const path = (tr?: Trace) => {
    if (!tr || !tr.t.length) return '';
    let i0 = tr.t.findIndex(t => t >= from);
    if (i0 < 0) return '';
    i0 = Math.max(0, i0 - 1);
    const n = tr.t.length - i0;
    const step = Math.max(1, Math.floor(n / 900));
    let d = '';
    let prevY: number | null = null;
    for (let i = i0; i < tr.t.length; i += step) {
      if (tr.t[i] > tNow) break;
      const x = ((tr.t[i] - from) / win) * W, yy = y(tr.v[i]);
      // Draw steps, so a digital pin looks like a logic trace instead of a sawtooth.
      d += d ? `H${x.toFixed(1)}V${yy.toFixed(1)}` : `M${x.toFixed(1)} ${yy.toFixed(1)}`;
      prevY = yy;
    }
    if (prevY !== null) d += `H${W}`;
    return d;
  };
  const lanes = mode === 'logic' ? series.map(s => logic(s.tr, from, tNow)) : [];
  const laneH = H / Math.max(1, probes.length);
  /** A logic lane: high near the top of its band, low near the bottom. */
  const lanePath = (tr: Trace | undefined, i: number, th: number) => {
    if (!tr || !tr.t.length) return '';
    let i0 = tr.t.findIndex(t => t >= from);
    if (i0 < 0) return '';
    i0 = Math.max(0, i0 - 1);
    const top = i * laneH + laneH * 0.22, bot = (i + 1) * laneH - laneH * 0.22;
    let d = '', last: number | null = null;
    for (let k = i0; k < tr.t.length && tr.t[k] <= tNow; k++) {
      const yy = tr.v[k] >= th ? top : bot;
      if (yy === last) continue;
      const x = Math.max(0, ((tr.t[k] - from) / win) * W);
      d += d ? `H${x.toFixed(1)}V${yy.toFixed(1)}` : `M${x.toFixed(1)} ${yy.toFixed(1)}`;
      last = yy;
    }
    return d ? `${d}H${W}` : '';
  };
  const fmtMs = (ms: number | null) => (ms === null ? '–' : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : ms >= 10 ? `${Math.round(ms)} ms` : `${ms.toFixed(1)} ms`);
  const fmtHz = (hz: number | null) => (hz === null ? '–' : hz >= 100 ? `${Math.round(hz)} Hz` : `${hz.toFixed(2)} Hz`);
  const [ca, cb] = cursors;
  const dt = ca !== null && cb !== null ? Math.abs(cb - ca) : null;
  const xOf = (t: number) => ((t - from) / win) * 100;
  const at = hover === null ? null : from + hover * win;
  const valueAt = (tr?: Trace) => {
    if (!tr || at === null) return null;
    let j = -1;
    for (let i = 0; i < tr.t.length; i++) { if (tr.t[i] <= at) j = i; else break; }
    return j >= 0 ? tr.v[j] : null;
  };

  if (!probes.length) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div className="max-w-sm">
          <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-lg border border-line-2 bg-surface-2 text-fg-2"><Crosshair size={18} /></span>
          <p className="text-[13.5px] font-semibold">No probes yet</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">Pick the probe tool <span className="kbd">P</span> in the toolbar, then click any pin or breadboard hole. Each probe shows its voltage on the circuit and is graphed here, like a multi-channel scope.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="scroll flex w-[300px] shrink-0 flex-col overflow-auto border-r border-line">
        <div className="sticky top-0 grid grid-cols-[1fr_52px_52px_52px] gap-1 border-b border-line bg-surface px-3 py-1.5 font-mono text-[10px] text-fg-3">
          {mode === 'logic'
            ? <><span>channel</span><span className="text-right">freq</span><span className="text-right">duty</span><span className="text-right">high</span></>
            : <><span>probe</span><span className="text-right">{at !== null ? 'cursor' : 'now'}</span><span className="text-right">min</span><span className="text-right">max</span></>}
        </div>
        {mode === 'logic' && series.map(({ p }, i) => {
          const L = lanes[i];
          return (
            <div key={p.id} className="group grid grid-cols-[1fr_52px_52px_52px] items-center gap-1 border-b border-line px-3 py-1.5 text-[12px] hover:bg-surface-2">
              <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => onFocus(p.id)}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
                <span className="font-mono font-semibold">{p.label}</span>
                <span className="truncate text-fg-3">{L ? `${L.edges.length} edges` : 'no data'}</span>
              </button>
              <span className="text-right font-mono tabular-nums">{fmtHz(L?.hz ?? null)}</span>
              <span className="text-right font-mono text-fg-3 tabular-nums">{L?.duty != null ? `${Math.round(L.duty * 100)}%` : '–'}</span>
              <span className="text-right font-mono text-fg-3 tabular-nums">{fmtMs(L?.high ?? null)}</span>
            </div>
          );
        })}
        {mode === 'analog' && series.map(({ p, tr, st }) => {
          const cur = at !== null ? valueAt(tr) : st?.now ?? null;
          return (
            <div key={p.id} className="group grid grid-cols-[1fr_52px_52px_52px] items-center gap-1 border-b border-line px-3 py-1.5 text-[12px] hover:bg-surface-2">
              <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => onFocus(p.id)} data-tip="Show on the circuit" data-tip-pos="top">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                <span className="font-mono font-semibold">{p.label}</span>
                <span className="truncate text-fg-3">{p.name}</span>
              </button>
              <span className="text-right font-mono tabular-nums">{cur === null ? '–' : fmtV(cur)}</span>
              <span className="text-right font-mono text-fg-3 tabular-nums">{st ? fmtV(st.min) : '–'}</span>
              <span className="relative text-right font-mono text-fg-3 tabular-nums">
                <span className="group-hover:invisible">{st ? fmtV(st.max) : '–'}</span>
                <button className="absolute inset-y-0 right-0 hidden items-center text-fg-3 hover:text-bad group-hover:flex" onClick={() => onRemove(p.id)} aria-label={`Remove ${p.label}`}><Trash2 size={12} /></button>
              </span>
              {st?.hz && <span className="col-span-4 -mt-0.5 pl-[18px] font-mono text-[10px] text-fg-3">avg {fmtV(st.avg)} V · ≈ {st.hz >= 100 ? Math.round(st.hz) : st.hz.toFixed(1)} Hz</span>}
            </div>
          );
        })}
        <p className="mt-auto px-3 py-2 text-[11px] leading-relaxed text-fg-3">{mode === 'logic'
          ? 'Each probe read as HIGH or LOW, halfway between its lowest and highest voltage. Click the graph to place cursors A and B. Slow the simulation down to catch fast signals.'
          : 'Volts, measured to ground. Hover the graph to read any moment, click to place time cursors.'}</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-line px-2">
          <div className="seg shrink-0" role="radiogroup" aria-label="Display">
            <button role="radio" aria-checked={mode === 'analog'} onClick={() => setMode('analog')}>Analog</button>
            <button role="radio" aria-checked={mode === 'logic'} onClick={() => setMode('logic')}>Logic</button>
          </div>
          <select className="input h-7 w-auto py-0 pr-6 pl-2 font-mono text-[11px]" value={win} onChange={e => setWin(+e.target.value)} aria-label="Time window" data-tip="Time across the graph">
            {WINDOWS.map(w => <option key={w} value={w}>{fmtT(w)}</option>)}
          </select>
          <div className={`seg shrink-0 whitespace-nowrap ${mode === 'logic' ? 'hidden' : ''}`} role="group" aria-label="Vertical range">
            <button aria-pressed={!fixed} onClick={() => setFixed(false)}>Auto</button>
            <button aria-pressed={fixed} onClick={() => setFixed(true)}>0–5 V</button>
          </div>
          {dt !== null && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px]">
              <span className="text-fg-3">A→B</span>{fmtMs(dt)}<span className="text-fg-3">·</span>{dt > 0 ? fmtHz(1000 / dt) : '–'}
              <button className="text-fg-3 hover:text-fg" onClick={() => setCursors([null, null])} aria-label="Clear cursors"><X size={11} /></button>
            </span>
          )}
          <span className="flex-1" />
          {!running && !frozen && <span className="hidden truncate text-[11.5px] text-fg-3 xl:inline">Start the simulation to record.</span>}
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setFrozen(f => (f ? null : { now, traces: new Map(probes.map(p => { const t = recorder.get(p.id); return [p.id, t ? { t: [...t.t], v: [...t.v] } : { t: [], v: [] }]; })) }))}
            aria-pressed={!!frozen} aria-label={frozen ? 'Resume' : 'Freeze the graph'} data-tip={frozen ? 'Resume' : 'Freeze'}>
            {frozen ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { onClear(); setFrozen(null); }} aria-label="Clear recordings" data-tip="Clear recordings"><Eraser size={13} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => probes.forEach(p => onRemove(p.id))} aria-label="Remove all probes" data-tip="Remove all probes" data-tip-pos="left"><X size={13} /></button>
        </div>
        <div className="relative min-h-0 flex-1 pl-11" style={{ background: 'var(--code-bg)' }}>
          {mode === 'analog' ? ticks.map((v, i) => (
            <span key={i} className="pointer-events-none absolute left-1 w-9 -translate-y-1/2 text-right font-mono text-[9.5px] text-fg-3 tabular-nums"
              style={{ top: `calc(${(1 - i / 4) * 100}% * 0.86 + 7%)` }}>{fmtV(v)}</span>
          )) : series.map(({ p }, i) => (
            <span key={p.id} className="pointer-events-none absolute left-1 w-9 -translate-y-1/2 text-right font-mono text-[10px] font-semibold tabular-nums"
              style={{ top: `calc(${((i + 0.5) / probes.length) * 100}% * 0.86 + 7%)`, color: p.color }}>{p.label}</span>
          ))}
          <div className="absolute inset-y-[7%] right-3 left-11"
            onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }}
            onPointerLeave={() => setHover(null)}
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              const t = from + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * win;
              setCursors(([a, b]) => (a === null || b !== null ? [t, null] : [a, t]));
            }}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label="Probe voltages over time">
              {mode === 'analog'
                ? ticks.map((v, i) => <line key={i} x1={0} x2={W} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--line)' }} vectorEffect="non-scaling-stroke" />)
                : series.map((_, i) => i > 0 && <line key={i} x1={0} x2={W} y1={i * laneH} y2={i * laneH} style={{ stroke: 'var(--line)' }} vectorEffect="non-scaling-stroke" />)}
              {[0.2, 0.4, 0.6, 0.8].map(f => <line key={f} x1={W * f} x2={W * f} y1={0} y2={H} style={{ stroke: 'var(--line)' }} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />)}
              {series.map(({ p, tr }, i) => (
                <path key={p.id} d={mode === 'logic' ? lanePath(tr, i, lanes[i]?.th ?? 2.5) : path(tr)} fill="none" stroke={p.color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${p.color}80)` }} />
              ))}
              {[ca, cb].map((c, i) => c !== null && c >= from && (
                <line key={i} x1={(xOf(c) / 100) * W} x2={(xOf(c) / 100) * W} y1={0} y2={H} style={{ stroke: 'var(--fg)' }} strokeDasharray={i ? '5 4' : undefined} vectorEffect="non-scaling-stroke" />
              ))}
              {hover !== null && <line x1={hover * W} x2={hover * W} y1={0} y2={H} style={{ stroke: 'var(--fg-2)' }} vectorEffect="non-scaling-stroke" />}
            </svg>
            <span className="pointer-events-none absolute -bottom-[1.15rem] left-0 font-mono text-[9.5px] text-fg-3">−{fmtT(win)}</span>
            <span className="pointer-events-none absolute right-0 -bottom-[1.15rem] font-mono text-[9.5px] text-fg-3">{frozen ? 'frozen' : 'now'}</span>
            {[ca, cb].map((c, i) => c !== null && c >= from && (
              <span key={i} className="pointer-events-none absolute top-0 -translate-x-1/2 rounded bg-inverse px-1 font-mono text-[9.5px] font-bold text-on-inverse" style={{ left: `${xOf(c)}%` }}>{i ? 'B' : 'A'}</span>
            ))}
            {at !== null && <span className="pointer-events-none absolute -top-[1.1rem] -translate-x-1/2 rounded bg-surface-3 px-1 font-mono text-[9.5px] text-fg" style={{ left: `${hover! * 100}%` }}>{stamp(Math.max(0, at))}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
