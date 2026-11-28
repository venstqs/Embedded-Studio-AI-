import { useState } from 'react';
import { ChevronDown, ChevronRight, CircleAlert, CircleCheck } from 'lucide-react';
import type { Part } from '../types';
import { CHIP_TEMPLATES, parseChip, pinNames } from '../sim/chip';

/** Inspector section for a custom chip: name it, name its pins, and describe what is inside. */
export default function ChipEditor({ part, running, setProp }: {
  part: Part; running: boolean; setProp: (k: string, v: number | string, opt?: { key?: string; skip?: boolean }) => void;
}) {
  const names = pinNames(part.props);
  const def = String(part.props.def ?? '');
  const parsed = parseChip(def, names);
  const [help, setHelp] = useState(false);
  const setPin = (i: number, v: string) => {
    const next = [...names];
    next[i] = v.replace(/[,\s]/g, '').slice(0, 6) || `P${i + 1}`;
    setProp('pins', next.join(','), { key: `prop:${part.id}:pins` });
  };
  const pinBox = (i: number) => (
    <label key={i} className="flex flex-col items-center gap-0.5">
      <span className="font-mono text-[9.5px] text-fg-3">{i + 1}</span>
      <input className="input h-7 w-full px-1 text-center font-mono text-[11px]" value={names[i]} disabled={running} onChange={e => setPin(i, e.target.value)} aria-label={`Name of pin ${i + 1}`} />
    </label>
  );
  return (
    <div className="space-y-3">
      <label className="grid grid-cols-[88px_1fr] items-center gap-2">
        <span className="label">Chip name</span>
        <input className="input font-mono text-[12px]" value={String(part.props.name ?? '')} maxLength={10} disabled={running}
          onChange={e => setProp('name', e.target.value, { key: `prop:${part.id}:name` })} />
      </label>
      <label className="grid grid-cols-[88px_1fr] items-center gap-2">
        <span className="label">Start from</span>
        <select className="input" value="" disabled={running}
          onChange={e => { const t = CHIP_TEMPLATES.find(x => x.id === e.target.value); if (t) { setProp('def', t.def); setProp('pins', t.pins); setProp('name', t.name.split(' ')[0].slice(0, 10)); } }}>
          <option value="">Choose a template…</option>
          {CHIP_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <div>
        <span className="label">Pins (as the chip sits, notch on the left)</span>
        <div className="mt-1.5 rounded-lg border border-line bg-surface-2 p-2">
          <div className="grid grid-cols-4 gap-1">{[7, 6, 5, 4].map(pinBox)}</div>
          <div className="my-1.5 h-3 rounded bg-surface-3" aria-hidden="true" />
          <div className="grid grid-cols-4 gap-1">{[0, 1, 2, 3].map(pinBox)}</div>
        </div>
      </div>
      <div>
        <span className="flex items-baseline justify-between"><span className="label">What’s inside</span>
          {parsed.errors.length
            ? <span className="flex items-center gap-1 text-[11px] text-bad"><CircleAlert size={11} />{parsed.errors.length} to fix</span>
            : <span className="flex items-center gap-1 text-[11px] text-ok"><CircleCheck size={11} />{parsed.els.length} element{parsed.els.length === 1 ? '' : 's'}</span>}
        </span>
        <textarea className="input code-area mt-1.5 h-36 resize-y py-2 font-mono text-[12px] leading-5" spellCheck={false} value={def} disabled={running}
          onChange={e => setProp('def', e.target.value, { key: `prop:${part.id}:def` })} aria-label="Chip description" />
        {parsed.errors.slice(0, 3).map(e => <p key={e} className="mt-1 text-[11.5px] leading-relaxed text-bad">{e}</p>)}
      </div>
      <button className="flex items-center gap-1 text-[12px] text-fg-2 hover:text-fg" onClick={() => setHelp(h => !h)} aria-expanded={help}>
        {help ? <ChevronDown size={13} /> : <ChevronRight size={13} />} How to describe a chip
      </button>
      {help && (
        <dl className="grid grid-cols-[92px_1fr] gap-x-2 gap-y-1 rounded-lg bg-surface-2 p-2.5 font-mono text-[11px]">
          <dt>R a b 4k7</dt><dd className="font-sans text-fg-2">resistor</dd>
          <dt>LED a k red</dt><dd className="font-sans text-fg-2">LED, anode to cathode</dd>
          <dt>D a k</dt><dd className="font-sans text-fg-2">diode (0.7 V)</dd>
          <dt>Z a k 5.1</dt><dd className="font-sans text-fg-2">clamps above 5.1 V</dd>
          <dt>V + - 5</dt><dd className="font-sans text-fg-2">5 V source</dd>
          <dt>C + - 10u</dt><dd className="font-sans text-fg-2">capacitor</dd>
          <dt>_name</dt><dd className="font-sans text-fg-2">a node hidden inside</dd>
          <dt># note</dt><dd className="font-sans text-fg-2">comment</dd>
        </dl>
      )}
    </div>
  );
}
