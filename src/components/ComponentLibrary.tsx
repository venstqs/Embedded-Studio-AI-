import React, { useState } from 'react';
import type { Component } from '../types/circuit';
import { createComponentPreset } from '../services/circuitPresets';
import { Zap, Lightbulb, ToggleLeft, Thermometer, Cpu, Plus, Layers, Gauge, Target, ChevronDown, ChevronRight, Activity } from 'lucide-react';

interface Props {
  onAddComponent: (c: Component) => void;
}

const getComponentIcon = (type: string) => {
  switch (type) {
    case 'resistor': return <Zap size={14} className="text-amber-400" />;
    case 'led': case 'rgb_led': return <Lightbulb size={14} className="text-yellow-400" />;
    case 'button': return <ToggleLeft size={14} className="text-slate-300" />;
    case 'potentiometer': return <Gauge size={14} className="text-amber-400" />;
    case 'dht11': return <Thermometer size={14} className="text-cyan-400" />;
    case 'ultrasonic': return <Activity size={14} className="text-cyan-400" />;
    case 'ldr': return <Lightbulb size={14} className="text-yellow-300" />;
    case 'servo': case 'relay': return <Target size={14} className="text-violet-400" />;
    case 'lcd': return <Layers size={14} className="text-green-400" />;
    case 'buzzer': return <Activity size={14} className="text-pink-400" />;
    default: return <Cpu size={14} className="text-zinc-400" />;
  }
};

type Category = 'All' | 'Input' | 'Output' | 'Sensors' | 'Actuators' | 'Passive' | 'Prototyping';

const COMPONENTS_LIST = [
  { type: 'led', name: 'LED', desc: 'Light Emitting Diode', category: 'Output' as Category },
  { type: 'rgb_led', name: 'RGB LED', desc: 'Full color LED', category: 'Output' as Category },
  { type: 'buzzer', name: 'Piezo Buzzer', desc: 'Sound output', category: 'Output' as Category },
  { type: 'lcd', name: 'LCD 1602', desc: '16×2 char display', category: 'Output' as Category },
  { type: 'button', name: 'Push Button', desc: 'Momentary switch', category: 'Input' as Category },
  { type: 'potentiometer', name: 'Potentiometer', desc: 'Variable resistor', category: 'Input' as Category },
  { type: 'dht11', name: 'DHT11', desc: 'Temp & humidity', category: 'Sensors' as Category },
  { type: 'ultrasonic', name: 'Ultrasonic HC-SR04', desc: 'Distance sensor', category: 'Sensors' as Category },
  { type: 'ldr', name: 'Photoresistor', desc: 'Light sensor', category: 'Sensors' as Category },
  { type: 'servo', name: 'Servo Motor', desc: 'Angle control', category: 'Actuators' as Category },
  { type: 'relay', name: '5V Relay', desc: 'High-power switch', category: 'Actuators' as Category },
  { type: 'resistor', name: 'Resistor', desc: 'Current limiter', category: 'Passive' as Category },
  { type: 'breadboard', name: 'Breadboard', desc: 'Prototyping board', category: 'Prototyping' as Category },
];

const CATEGORIES: Category[] = ['All', 'Input', 'Output', 'Sensors', 'Actuators', 'Passive', 'Prototyping'];

const CATEGORY_COLORS: Record<string, string> = {
  Input: 'text-blue-400',
  Output: 'text-yellow-400',
  Sensors: 'text-cyan-400',
  Actuators: 'text-violet-400',
  Passive: 'text-amber-400',
  Prototyping: 'text-green-400',
};

const ComponentLibrary: React.FC<Props> = ({ onAddComponent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const add = (type: string) => {
    onAddComponent(createComponentPreset(type as any));
  };

  const toggleGroup = (cat: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filtered = COMPONENTS_LIST.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = activeCategory === 'All' || c.category === activeCategory;
    return matchSearch && matchCat;
  });

  // Group by category when showing 'All'
  const grouped: Record<string, typeof filtered> = {};
  filtered.forEach(c => {
    const key = activeCategory === 'All' ? c.category : 'Results';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#222] flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-white tracking-widest uppercase">Components</h2>
          <span className="text-[10px] text-zinc-500">{filtered.length} items</span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#18181b] border border-[#2d2d2d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-white text-black'
                  : 'bg-[#1e1e1e] text-zinc-400 hover:text-white border border-[#333] hover:border-zinc-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Component List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {Object.entries(grouped).map(([groupName, items]) => (
          <div key={groupName} className="mb-2">
            {activeCategory === 'All' && (
              <button
                onClick={() => toggleGroup(groupName)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold tracking-widest uppercase rounded hover:bg-[#1e1e1e] transition-colors group"
              >
                <div className="flex items-center space-x-2">
                  <span className={CATEGORY_COLORS[groupName] || 'text-zinc-400'}>{groupName}</span>
                  <span className="text-zinc-600 font-normal">{items.length}</span>
                </div>
                {collapsedGroups.has(groupName)
                  ? <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                  : <ChevronDown size={12} className="text-zinc-600 group-hover:text-zinc-400" />}
              </button>
            )}

            {!collapsedGroups.has(groupName) && (
              <div className="space-y-1 mt-1">
                {items.map(comp => (
                  <div
                    key={comp.type}
                    onClick={() => add(comp.type)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#141416] border border-[#222] hover:border-[#3d3d3d] hover:bg-[#1e1e1e] transition-all cursor-pointer group"
                    draggable
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#1e1e1e] border border-[#2a2a2a] flex-shrink-0 group-hover:border-[#444]">
                        {getComponentIcon(comp.type)}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-white leading-tight">{comp.name}</p>
                        <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">{comp.desc}</p>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md bg-white/10 transition-all flex-shrink-0">
                      <Plus size={12} className="text-white" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-600 text-xs">
            <Cpu size={24} className="mx-auto mb-2 opacity-30" />
            <p>No components found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComponentLibrary;
