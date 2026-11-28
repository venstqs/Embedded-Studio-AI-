import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CornerDownLeft, Search, X } from 'lucide-react';


/**
 * The XavierLabs mark, the same slanted X as the XavierLabs site. Drawn in
 * the current text colour; `boxed` puts it on a tile like the favicon.
 */
export function Logo({ size = 24, boxed = false }: { size?: number; boxed?: boolean }) {
  const id = useId().replace(/:/g, '');
  const glyph = (
    <g transform="translate(6.33 0) skewX(-10)">
      <polygon points="30,36 36,36 16.19,4 10.19,4" fill="currentColor" mask={`url(#${id})`} />
      <polygon points="4,36 10,36 29.81,4 23.81,4" fill="currentColor" />
      <rect x="12.076" y="25.8" width="15.848" height="4" fill="currentColor" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ color: boxed ? 'var(--on-inverse)' : undefined }}>
      <defs>
        <mask id={id}><rect width="40" height="40" fill="#fff" /><polygon points="2.4,36 11.6,36 31.41,4 22.21,4" fill="#000" /></mask>
      </defs>
      {boxed ? <><rect width="40" height="40" rx="10" style={{ fill: 'var(--inverse)' }} /><g transform="translate(7 7) scale(.65)">{glyph}</g></> : glyph}
    </svg>
  );
}

/** GitHub's mark (brand icons are not in the icon set). */
export function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

// ---------- Dropdown menu ----------

export interface MenuItem { label: string; icon?: ReactNode; hint?: string; run: () => void; danger?: boolean }

/** A button that opens a small menu. Closes on outside click, Escape, or choosing an item. */
export function Menu({ trigger, label, items, align = 'right' }: { trigger: ReactNode; label: string; items: (MenuItem | 'divider')[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button className="btn btn-ghost btn-icon" aria-label={label} aria-haspopup="menu" aria-expanded={open} data-tip={open ? undefined : label} onClick={() => setOpen(o => !o)}>
        {trigger}
      </button>
      {open && (
        <div role="menu" className={`popover absolute top-[calc(100%+6px)] z-50 w-60 p-1 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.map((it, i) => it === 'divider'
            ? <div key={i} className="my-1 h-px bg-line" />
            : (
              <button key={it.label} role="menuitem" onClick={() => { setOpen(false); it.run(); }}
                className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] hover:bg-surface-2 ${it.danger ? 'text-bad' : 'text-fg'}`}>
                <span className="grid w-4 place-items-center text-fg-2">{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                {it.hint && <span className="text-[11.5px] text-fg-3">{it.hint}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ---------- Modal dialog ----------

export function Dialog({ title, onClose, children, width = 440 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" style={{ background: 'var(--scrim)' }} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="popover w-full overflow-hidden" style={{ maxWidth: width }}>
        <div className="flex h-11 items-center justify-between border-b border-line px-4">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Command palette ----------

export interface Command { id: string; label: string; group: string; hint?: string; icon?: ReactNode; keywords?: string; run: () => void }

/** Ctrl+K: search every action, project, part and page, and run it from the keyboard. */
export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter(c => { const hay = `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase(); return words.every(w => hay.includes(w)); }).slice(0, 80);
  }, [q, commands]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const run = (c?: Command) => { if (!c) return; onClose(); c.run(); };
  const groups: string[] = [];
  for (const c of results) if (!groups.includes(c.group)) groups.push(c.group);

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]" style={{ background: 'var(--scrim)' }} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="popover w-full max-w-[600px] overflow-hidden">
        <div className="flex h-12 items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-fg-3" aria-hidden="true" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search actions, projects and parts"
            aria-label="Search commands" aria-controls="palette-list" aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-3"
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); run(results[active]); }
              else if (e.key === 'Escape') onClose();
            }} />
          <span className="kbd">Esc</span>
        </div>
        <div ref={list} id="palette-list" role="listbox" className="scroll max-h-[min(440px,52vh)] overflow-auto p-1.5">
          {!results.length && <p className="px-3 py-6 text-center text-fg-3">Nothing matches “{q}”.</p>}
          {groups.map(g => (
            <div key={g} className="mb-1">
              <p className="eyebrow px-2.5 pt-2 pb-1">{g}</p>
              {results.map((c, i) => c.group !== g ? null : (
                <button key={c.id} id={`cmd-${c.id}`} data-index={i} role="option" aria-selected={i === active}
                  onPointerMove={() => setActive(i)} onClick={() => run(c)}
                  className={`flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-[13px] ${i === active ? 'bg-surface-3 text-fg' : 'text-fg-2'}`}>
                  <span className="grid w-5 shrink-0 place-items-center">{c.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="kbd">{c.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex h-9 items-center gap-4 border-t border-line px-4 text-[11.5px] text-fg-3">
          <span className="flex items-center gap-1.5"><span className="kbd">↑</span><span className="kbd">↓</span> to move</span>
          <span className="flex items-center gap-1.5"><span className="kbd"><CornerDownLeft size={10} /></span> to run</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Keyboard shortcuts ----------

const SHORTCUTS: [string, [string[], string][]][] = [
  ['General', [
    [['Ctrl', 'K'], 'Search actions, projects and parts'],
    [['Ctrl', 'Enter'], 'Start or stop the simulation'],
    [['Ctrl', ','], 'Settings'],
    [['Ctrl', 'Z'], 'Undo'],
    [['Ctrl', 'Shift', 'Z'], 'Redo'],
    [['?'], 'Show this list'],
  ]],
  ['Tools', [
    [['V'], 'Select'],
    [['H'], 'Pan (or hold Space)'],
    [['P'], 'Probe a pin'],
    [['M'], 'Measure'],
    [['F'], 'Fit to screen'],
    [['Esc'], 'Cancel, clear the selection'],
  ]],
  ['Editing', [
    [['Drag'], 'Box select: right inside, left touching'],
    [['Shift', 'Click'], 'Add to the selection'],
    [['Ctrl', 'A'], 'Select everything'],
    [['Ctrl', 'C'], 'Copy'],
    [['Ctrl', 'V'], 'Paste'],
    [['Ctrl', 'D'], 'Duplicate'],
    [['R'], 'Rotate'],
    [['←', '→'], 'Nudge (Shift for 5 holes)'],
    [['Del'], 'Delete the selection'],
  ]],
  ['Code', [
    [['Ctrl', 'F'], 'Find and replace'],
    [['Ctrl', 'Shift', 'I'], 'Tidy indentation'],
    [['Tab'], 'Indent'],
  ]],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} width={720}>
      <div className="scroll grid max-h-[70vh] gap-x-6 overflow-auto p-4 sm:grid-cols-2">
        {SHORTCUTS.map(([group, list]) => (
          <section key={group} className="mb-3">
            <h3 className="eyebrow mb-1 px-2">{group}</h3>
            <dl>
              {list.map(([keys, what]) => (
                <div key={what} className="flex h-8 items-center justify-between gap-3 rounded-md px-2 text-[12.5px] hover:bg-surface-2">
                  <dt className="text-fg-2">{what}</dt>
                  <dd className="flex shrink-0 gap-1">{keys.map(k => <kbd key={k} className="kbd">{k}</kbd>)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

