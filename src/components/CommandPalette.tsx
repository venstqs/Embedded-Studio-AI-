import React, { useState, useEffect, useRef } from 'react';
import { Search, Cpu, Zap, Lightbulb, ToggleLeft, Thermometer, Gauge, Target, Layers, Play, Square, Download, Upload, Trash2, Globe, ArrowRight, X } from 'lucide-react';
import type { Component } from '../types/circuit';
import { createComponentPreset } from '../services/circuitPresets';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddComponent: (comp: Component) => void;
  onRunSimulation: () => void;
  isRunning: boolean;
  onClearCanvas: () => void;
  onExport: () => void;
  onImport: () => void;
  onOpenPanel: (panel: 'editor' | 'instruments' | 'copilot' | 'power' | 'datasheets', tab?: string) => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Component' | 'Action' | 'Tool';
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC<Props> = ({
  isOpen,
  onClose,
  onAddComponent,
  onRunSimulation,
  isRunning,
  onClearCanvas,
  onExport,
  onImport,
  onOpenPanel,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or shortcut
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items: CommandItem[] = [
    // Components
    { id: 'c-led', title: 'Add LED (Red/Green/Blue)', category: 'Component', icon: <Lightbulb size={16} className="text-yellow-400" />, action: () => { onAddComponent(createComponentPreset('led')); onClose(); } },
    { id: 'c-rgb', title: 'Add RGB LED (Common Cathode)', category: 'Component', icon: <Lightbulb size={16} className="text-cyan-400" />, action: () => { onAddComponent(createComponentPreset('rgb_led')); onClose(); } },
    { id: 'c-resistor', title: 'Add 220Ω Resistor', category: 'Component', icon: <Zap size={16} className="text-amber-400" />, action: () => { onAddComponent(createComponentPreset('resistor')); onClose(); } },
    { id: 'c-button', title: 'Add Tactile Push Button', category: 'Component', icon: <ToggleLeft size={16} className="text-zinc-400" />, action: () => { onAddComponent(createComponentPreset('button')); onClose(); } },
    { id: 'c-pot', title: 'Add 10kΩ Potentiometer', category: 'Component', icon: <Gauge size={16} className="text-amber-300" />, action: () => { onAddComponent(createComponentPreset('potentiometer')); onClose(); } },
    { id: 'c-dht11', title: 'Add DHT11 Temp & Humidity Sensor', category: 'Component', icon: <Thermometer size={16} className="text-sky-400" />, action: () => { onAddComponent(createComponentPreset('dht11')); onClose(); } },
    { id: 'c-sonic', title: 'Add HC-SR04 Ultrasonic Sensor', category: 'Component', icon: <Thermometer size={16} className="text-blue-400" />, action: () => { onAddComponent(createComponentPreset('ultrasonic')); onClose(); } },
    { id: 'c-servo', title: 'Add SG90 Micro Servo', category: 'Component', icon: <Target size={16} className="text-violet-400" />, action: () => { onAddComponent(createComponentPreset('servo')); onClose(); } },
    { id: 'c-buzzer', title: 'Add Piezo Buzzer', category: 'Component', icon: <Target size={16} className="text-orange-400" />, action: () => { onAddComponent(createComponentPreset('buzzer')); onClose(); } },
    { id: 'c-relay', title: 'Add 5V Relay Module', category: 'Component', icon: <Target size={16} className="text-emerald-400" />, action: () => { onAddComponent(createComponentPreset('relay')); onClose(); } },
    { id: 'c-lcd', title: 'Add LCD 1602 Display (I2C)', category: 'Component', icon: <Layers size={16} className="text-green-400" />, action: () => { onAddComponent(createComponentPreset('lcd')); onClose(); } },
    { id: 'c-uno', title: 'Add Arduino Uno R3 Board', category: 'Component', icon: <Cpu size={16} className="text-teal-400" />, action: () => { onAddComponent(createComponentPreset('mcu', 'uno')); onClose(); } },
    { id: 'c-esp32', title: 'Add ESP32 DevKit v1 Board', category: 'Component', icon: <Cpu size={16} className="text-red-400" />, action: () => { onAddComponent(createComponentPreset('mcu', 'esp32')); onClose(); } },

    // Actions
    { id: 'a-run', title: isRunning ? 'Stop Firmware Simulation' : 'Run Firmware Simulation', category: 'Action', icon: isRunning ? <Square size={16} className="text-red-400" /> : <Play size={16} className="text-green-400" />, action: () => { onRunSimulation(); onClose(); } },
    { id: 'a-editor', title: 'Open C++ / Arduino Code Editor', category: 'Tool', icon: <Cpu size={16} className="text-white" />, action: () => { onOpenPanel('editor'); onClose(); } },
    { id: 'a-serial', title: 'Open Serial Monitor & Interactive Terminal', category: 'Tool', icon: <Cpu size={16} className="text-white" />, action: () => { onOpenPanel('instruments', 'Serial Monitor'); onClose(); } },
    { id: 'a-scope', title: 'Open Oscilloscope (PWM Waveforms)', category: 'Tool', icon: <Cpu size={16} className="text-sky-400" />, action: () => { onOpenPanel('instruments', 'Oscilloscope'); onClose(); } },
    { id: 'a-meter', title: 'Open Multimeter (Pin Voltage Readout)', category: 'Tool', icon: <Gauge size={16} className="text-yellow-400" />, action: () => { onOpenPanel('instruments', 'Multimeter'); onClose(); } },
    { id: 'a-copilot', title: 'Open Gemini AI Copilot Assistant', category: 'Tool', icon: <Cpu size={16} className="text-purple-400" />, action: () => { onOpenPanel('copilot'); onClose(); } },
    { id: 'a-datasheets', title: 'Open Component Datasheets', category: 'Tool', icon: <Cpu size={16} className="text-zinc-400" />, action: () => { onOpenPanel('datasheets'); onClose(); } },
    { id: 'a-export', title: 'Export Circuit Project JSON', category: 'Action', icon: <Download size={16} className="text-zinc-300" />, action: () => { onExport(); onClose(); } },
    { id: 'a-import', title: 'Import Circuit Project JSON', category: 'Action', icon: <Upload size={16} className="text-zinc-300" />, action: () => { onImport(); onClose(); } },
    { id: 'a-clear', title: 'Clear Canvas Components', category: 'Action', icon: <Trash2 size={16} className="text-red-400" />, action: () => { onClearCanvas(); onClose(); } },
  ];

  const filtered = items.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));

  const handleWebSearch = () => {
    if (!query.trim()) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 px-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#121215] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-[#27272a] bg-[#18181b]">
          <Search size={16} className="text-zinc-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a component, tool, or action..."
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none font-sans"
          />
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Results list */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filtered.length > 0 ? (
            filtered.map(item => (
              <div
                key={item.id}
                onClick={item.action}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#27272a] transition-all cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-lg bg-[#18181b]">
                    {item.icon}
                  </div>
                  <span className="text-xs font-medium text-white group-hover:text-white">{item.title}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{item.category}</span>
                  <ArrowRight size={12} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-zinc-500 text-xs">
              No internal tools matched &quot;{query}&quot;.
            </div>
          )}

          {/* Web Search Fallback */}
          {query.trim() && (
            <div
              onClick={handleWebSearch}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all cursor-pointer mt-2"
            >
              <div className="flex items-center space-x-3">
                <Globe size={16} className="text-blue-400" />
                <span className="text-xs font-medium text-blue-300">Search web for &quot;{query}&quot;</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">Google Search ↗</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#27272a] bg-[#18181b] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>Navigation Shortcuts</span>
          <div className="flex items-center space-x-3">
            <span><kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">Esc</kbd> Close</span>
            <span><kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">Ctrl+K</kbd> Toggle</span>
          </div>
        </div>
      </div>
    </div>
  );
};
