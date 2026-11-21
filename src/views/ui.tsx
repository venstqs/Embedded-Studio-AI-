import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CornerDownLeft, Search, X } from 'lucide-react';

/** The XavierLabs mark. Drawn in the inverse colour so it reads on both themes. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="22" style={{ fill: 'var(--inverse)' }} />
      <path d="M28 28L50 50L72 28M72 72L50 50L28 72" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ stroke: 'var(--on-inverse)' }} />
      <circle cx="50" cy="50" r="5.5" style={{ fill: 'var(--on-inverse)' }} />
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

const SHORTCUTS: [string[], string][] = [
  [['Ctrl', 'K'], 'Search actions, projects and parts'],
  [['Ctrl', 'Enter'], 'Start or stop the simulation'],
  [['Ctrl', 'Z'], 'Undo'],
  [['Ctrl', 'Shift', 'Z'], 'Redo'],
  [['Ctrl', 'D'], 'Duplicate the selected part'],
  [['R'], 'Rotate the selected part'],
  [['Del'], 'Delete the selection'],
  [['Esc'], 'Cancel a wire or clear the selection'],
  [['Scroll'], 'Zoom the workplane'],
  [['Drag'], 'Pan, from an empty spot'],
  [['?'], 'Show this list'],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      <dl className="flex flex-col p-2">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={what} className="flex h-9 items-center justify-between gap-3 rounded-md px-2 hover:bg-surface-2">
            <dt className="text-fg-2">{what}</dt>
            <dd className="flex shrink-0 gap-1">{keys.map(k => <kbd key={k} className="kbd">{k}</kbd>)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
