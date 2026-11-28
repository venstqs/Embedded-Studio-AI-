import { useMemo, useState } from 'react';
import { CircleCheck, Download, Image as ImageIcon, TriangleAlert } from 'lucide-react';
import type { Project } from '../types';
import { buildPcb, excellon, gerberCopper, gerberOutline, gerberSilk } from '../sim/pcb';
import { zip } from '../zip';
import { Dialog } from './ui';

/** A preview of the breadboard turned into a one-layer PCB, with Gerber and drill files to download. */
export default function PcbDialog({ project, onClose, onToast }: { project: Project; onClose: () => void; onToast: (t: string) => void }) {
  const pcb = useMemo(() => buildPcb(project), [project]);
  const [layers, setLayers] = useState({ copper: true, silk: true, drill: true });
  const base = (project.name.trim() || 'circuit').replace(/[^\w-]+/g, '_').toLowerCase();

  const save = (name: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const svgText = () => document.getElementById('xl-pcb')?.outerHTML.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"') ?? '';
  const downloadGerbers = () => {
    if (!pcb) return;
    save(`${base}-gerbers.zip`, zip([
      { name: `${base}-F_Cu.gtl`, text: gerberCopper(pcb) },
      { name: `${base}-F_SilkS.gto`, text: gerberSilk(pcb) },
      { name: `${base}-Edge_Cuts.gm1`, text: gerberOutline(pcb) },
      { name: `${base}.drl`, text: excellon(pcb) },
      { name: 'README.txt', text: `${project.name}\nMade with XavierLabs IDE.\n\nBoard ${pcb.w} x ${pcb.h} mm, single-sided, ${pcb.pads.length} plated holes, ${pcb.nets} nets.\nThis is a draft layout routed with straight lines.${pcb.crossings ? ` It has ${pcb.crossings} crossing(s): fix them with a jumper or in KiCad before ordering.` : ''}\n\nFiles: F_Cu (copper), F_SilkS (silkscreen), Edge_Cuts (outline), .drl (Excellon drill).\n` },
    ]));
    onToast('Downloaded the Gerber and drill files (.zip)');
  };

  const k = pcb ? Math.min(640 / pcb.w, 360 / pcb.h) : 1;
  return (
    <Dialog title="PCB layout" onClose={onClose} width={760}>
      {!pcb ? (
        <p className="p-6 text-[13px] text-fg-2">Add some parts first: every leg on the breadboard becomes a pad on the board.</p>
      ) : (
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="chip">{pcb.w.toFixed(1)} × {pcb.h.toFixed(1)} mm</span>
            <span className="chip">{pcb.pads.length} holes</span>
            <span className="chip">{pcb.nets} nets</span>
            {pcb.crossings
              ? <span className="flex items-center gap-1 text-warn"><TriangleAlert size={13} />{pcb.crossings} crossing{pcb.crossings === 1 ? '' : 's'} to fix</span>
              : <span className="flex items-center gap-1 text-ok"><CircleCheck size={13} />No crossings</span>}
            <span className="flex-1" />
            {(['copper', 'silk', 'drill'] as const).map(l => (
              <label key={l} className="flex items-center gap-1.5 text-fg-2 capitalize">
                <input type="checkbox" checked={layers[l]} onChange={e => setLayers(x => ({ ...x, [l]: e.target.checked }))} />{l === 'silk' ? 'Silkscreen' : l === 'drill' ? 'Holes' : 'Copper'}
              </label>
            ))}
          </div>
          <div className="mt-3 grid place-items-center overflow-hidden rounded-lg border border-line bg-[#0d0f12] p-4">
            <svg id="xl-pcb" width={pcb.w * k} height={pcb.h * k} viewBox={`-1 -1 ${pcb.w + 2} ${pcb.h + 2}`} role="img" aria-label="PCB preview">
              <rect x={0} y={0} width={pcb.w} height={pcb.h} rx={1.5} fill="#0e5a3a" stroke="#c9d3c7" strokeWidth={0.2} />
              {layers.copper && pcb.tracks.map((t, i) => <polyline key={i} points={t.pts.map(p => p.join(',')).join(' ')} fill="none" stroke="#d6a84a" strokeWidth={0.5} strokeLinecap="round" strokeLinejoin="round" />)}
              {layers.copper && pcb.pads.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.d / 2} fill="#e3b85a" />)}
              {layers.drill && pcb.pads.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.drill / 2} fill="#0d0f12" />)}
              {layers.silk && pcb.silk.map((s, i) => (
                <g key={i}>
                  <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={0.6} fill="none" stroke="#f2f2f2" strokeWidth={0.18} opacity={0.85} />
                  <text x={s.x + 0.6} y={s.y - 0.6} fill="#f2f2f2" style={{ fontSize: 1.8, fontFamily: 'Geist Mono, monospace', fontWeight: 600 }}>{s.label}</text>
                </g>
              ))}
            </svg>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-fg-3">
            Every leg becomes a pad exactly where it sits on the breadboard, every strip and jumper becomes copper, and an Arduino becomes shield-style header pads that line up with the real board. It’s a single-layer draft with straight routes: open the Gerbers in KiCad or a viewer to check it before ordering.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn" onClick={() => { save(`${base}-pcb.svg`, new Blob([svgText()], { type: 'image/svg+xml' })); onToast('Downloaded the PCB preview (SVG)'); }}><ImageIcon size={14} /> Preview (SVG)</button>
            <button className="btn btn-primary" onClick={downloadGerbers}><Download size={14} /> Gerber + drill (.zip)</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
