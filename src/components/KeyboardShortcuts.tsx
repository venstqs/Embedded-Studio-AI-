import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], action: 'Open Command Palette', category: 'General' },
  { keys: ['F5'], action: 'Run / Stop Simulation', category: 'General' },
  { keys: ['Ctrl', 'Enter'], action: 'Run / Stop Simulation', category: 'General' },
  { keys: ['Ctrl', 'S'], action: 'Export Project (.json)', category: 'General' },
  { keys: ['Delete'], action: 'Delete Selected Component', category: 'Canvas' },
  { keys: ['Backspace'], action: 'Delete Selected Component', category: 'Canvas' },
  { keys: ['Scroll Wheel'], action: 'Zoom In / Out on Canvas', category: 'Canvas' },
  { keys: ['Alt', 'Drag'], action: 'Pan Canvas (or Middle Mouse)', category: 'Canvas' },
  { keys: ['Right Click'], action: 'Component Context Menu', category: 'Canvas' },
  { keys: ['Click'], action: 'Select & Open Properties', category: 'Canvas' },
  { keys: ['Esc'], action: 'Cancel Wire / Deselect', category: 'Canvas' },
];

const CATEGORIES = ['General', 'Canvas'];

const KeyboardShortcuts: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111113] border border-[#2a2a2a] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222]">
          <div className="flex items-center space-x-3">
            <Keyboard size={18} className="text-zinc-400" />
            <h2 className="text-white font-bold text-sm">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Shortcuts */}
        <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {CATEGORIES.map(cat => (
            <div key={cat}>
              <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2 px-1">{cat}</p>
              <div className="space-y-1">
                {SHORTCUTS.filter(s => s.category === cat).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs text-zinc-300">{s.action}</span>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                      {s.keys.map((k, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && <span className="text-zinc-600 text-[10px]">+</span>}
                          <kbd className="px-2 py-0.5 rounded-md bg-[#1e1e1e] border border-[#3a3a3a] text-[11px] text-zinc-300 font-mono shadow-sm">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-[#222]">
          <p className="text-[10px] text-zinc-600 text-center">Press <kbd className="px-1.5 py-0.5 rounded bg-[#1e1e1e] border border-[#333] text-zinc-400 font-mono">Esc</kbd> or click outside to close</p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
