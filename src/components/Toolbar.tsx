import React from 'react';
import { Play, Square, RotateCcw, Download, Upload, Settings, Cpu, Trash2, Search, ChevronRight } from 'lucide-react';
import type { MCUModel, SimulationState } from '../types/circuit';

interface ToolbarProps {
  mcuModel: MCUModel;
  setMcuModel: (m: MCUModel) => void;
  selectedWireColor: string;
  setSelectedWireColor: (c: string) => void;
  simulationState: SimulationState;
  onRunSimulation: () => void;
  onOpenSettings: () => void;
  onExport: () => void;
  onImport: () => void;
  onClearCanvas: () => void;
  onOpenSearch?: () => void;
}

const WIRE_COLORS = [
  '#06b6d4', '#ffffff', '#ef4444', '#22c55e',
  '#f59e0b', '#a855f7', '#ec4899', '#64748b'
];

const Toolbar: React.FC<ToolbarProps> = ({
  mcuModel, setMcuModel,
  selectedWireColor, setSelectedWireColor,
  simulationState,
  onRunSimulation,
  onOpenSettings,
  onExport,
  onImport,
  onClearCanvas,
  onOpenSearch,
}) => {
  const isRunning = simulationState.isPlaying;

  return (
    <div className="flex items-center justify-between w-full h-full">

      {/* LEFT — Logo & Breadcrumbs */}
      <div className="flex items-center space-x-6 min-w-0 flex-1">
        <div className="flex items-center select-none pl-3 pr-6 py-1.5 border-r border-[var(--border-color)]">
          <Cpu size={18} className="text-white mr-3 flex-shrink-0" />
          <span className="font-sans font-extrabold text-[15px] text-white tracking-[0.2em] uppercase select-none" style={{ fontFamily: 'Inter, sans-serif' }}>
            XAVIERLABS
          </span>
          <span className="ml-3 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-white text-black tracking-widest uppercase flex-shrink-0">
            BETA
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-zinc-400 font-medium pl-2">
          <span className="hover:text-white cursor-pointer transition-colors">Workspace</span>
          <ChevronRight size={12} />
          <span className="text-white font-semibold">Untitled Project</span>
        </div>
      </div>

      {/* CENTER — Global Command Center */}
      <div className="flex items-center justify-center flex-1 max-w-lg hidden md:flex">
        <div 
          onClick={onOpenSearch}
          className="flex items-center w-full bg-[#18181b] border border-[var(--border-color)] rounded-xl px-3.5 py-1.5 group hover:border-zinc-500 transition-colors cursor-pointer"
        >
          <Search size={14} className="text-zinc-400 mr-2.5" />
          <span className="text-xs text-zinc-400 flex-1 truncate font-sans">Search commands, components, or datasheets...</span>
          <div className="flex items-center space-x-1 ml-2">
            <kbd className="px-1.5 py-0.5 rounded bg-[#27272a] border border-[#3f3f46] text-[10px] text-zinc-300 font-mono">Ctrl</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-[#27272a] border border-[#3f3f46] text-[10px] text-zinc-300 font-mono">K</kbd>
          </div>
        </div>
      </div>

      {/* RIGHT — Tools & Actions */}
      <div className="flex items-center justify-end space-x-4 flex-1 pr-2">
        {/* Wire Color Picker */}
        <div className="flex items-center space-x-1.5 bg-[var(--bg-active)] px-3 py-1.5 rounded-full border border-[var(--border-color)]">
          {WIRE_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setSelectedWireColor(color)}
              title={`Wire: ${color}`}
              className={`w-4 h-4 rounded-full transition-transform flex-shrink-0 ${
                selectedWireColor === color
                  ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-[var(--bg-active)]'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="w-px h-5 bg-[var(--border-light)]" />
        
        {/* MCU selector */}
        <div className="flex items-center px-2 py-1 bg-[var(--bg-active)] rounded-lg border border-[var(--border-color)]">
          <select
            value={mcuModel}
            onChange={(e) => setMcuModel(e.target.value as MCUModel)}
            className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer hover:text-[var(--color-cyan)] transition-colors"
          >
            <option value="uno" className="bg-[var(--bg-secondary)]">Arduino Uno</option>
            <option value="esp32" className="bg-[var(--bg-secondary)]">ESP32</option>
          </select>
        </div>

        {/* Simulation Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onRunSimulation}
            className={`flex items-center justify-center space-x-1.5 px-4 py-1.5 rounded-full transition-all duration-200 font-bold text-xs uppercase tracking-wider border ${
              isRunning
                ? 'bg-transparent text-white border-white hover:bg-zinc-900'
                : 'bg-white text-black border-white hover:bg-zinc-200'
            }`}
            title={isRunning ? 'Stop Simulation (F5)' : 'Run Simulation (F5)'}
          >
            {isRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
            <span>{isRunning ? 'Stop' : 'Run'}</span>
          </button>
          
          <button
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isRunning ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer' : 'text-zinc-600 cursor-not-allowed'}`}
            disabled={!isRunning}
            onClick={() => { if (isRunning) onRunSimulation(); }}
            title="Restart Simulation"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-[var(--border-light)]" />

        {/* System actions */}
        <div className="flex items-center space-x-1">
          <ToolbarIconBtn icon={Upload} title="Import Project (.json)" onClick={onImport} />
          <ToolbarIconBtn icon={Download} title="Export Project (.json)" onClick={onExport} />
          <ToolbarIconBtn icon={Trash2} title="Clear Canvas" onClick={onClearCanvas} danger />
          <ToolbarIconBtn icon={Settings} title="Settings & API Key" onClick={onOpenSettings} />
        </div>
      </div>
    </div>
  );
};

const ToolbarIconBtn: React.FC<{
  icon: React.FC<{ size?: number }>;
  title: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ icon: Icon, title, onClick, danger }) => (
  <button
    onClick={onClick}
    title={title}
    className={`p-2 rounded-lg transition-colors ${
      danger
        ? 'text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950'
        : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]'
    }`}
  >
    <Icon size={17} />
  </button>
);

export default Toolbar;
