import React, { useState } from 'react';
import type { Component } from '../types/circuit';
import { createComponentPreset } from '../services/circuitPresets';
import { Search, Zap, Lightbulb, ToggleLeft, Thermometer, Cpu, Plus, Layers, Gauge, Target } from 'lucide-react';

interface Props {
  onAddComponent: (c: Component) => void;
}

const getComponentIcon = (type: string) => {
  switch (type) {
    case 'resistor': return <Zap size={16} className="text-amber-500" />;
    case 'led': case 'rgb_led': return <Lightbulb size={16} className="text-yellow-500" />;
    case 'button': return <ToggleLeft size={16} className="text-slate-400" />;
    case 'potentiometer': return <Gauge size={16} className="text-amber-400" />;
    case 'dht11': case 'ultrasonic': return <Thermometer size={16} className="text-cyan-500" />;
    case 'servo': case 'relay': return <Target size={16} className="text-violet-500" />;
    case 'lcd': return <Layers size={16} className="text-green-500" />;
    default: return <Cpu size={16} className="text-[var(--text-muted)]" />;
  }
};

const COMPONENTS_LIST = [
  { type: 'led', name: 'LED', category: 'Output' },
  { type: 'rgb_led', name: 'RGB LED', category: 'Output' },
  { type: 'resistor', name: 'Resistor', category: 'Passive' },
  { type: 'button', name: 'Push Button', category: 'Input' },
  { type: 'potentiometer', name: 'Potentiometer', category: 'Input' },
  { type: 'dht11', name: 'DHT11 Sensor', category: 'Sensors' },
  { type: 'ultrasonic', name: 'Ultrasonic', category: 'Sensors' },
  { type: 'ldr', name: 'Photoresistor', category: 'Sensors' },
  { type: 'servo', name: 'Servo Motor', category: 'Actuators' },
  { type: 'buzzer', name: 'Piezo Buzzer', category: 'Output' },
  { type: 'relay', name: '5V Relay', category: 'Actuators' },
  { type: 'lcd', name: 'LCD 1602', category: 'Output' },
  { type: 'breadboard', name: 'Breadboard', category: 'Prototyping' },
];

const ComponentLibrary: React.FC<Props> = ({ onAddComponent }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const add = (type: string) => {
    onAddComponent(createComponentPreset(type as any));
  };

  const filtered = COMPONENTS_LIST.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-4 border-b border-[var(--border-color)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Component Library</h2>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-[var(--text-muted)]" size={16} />
          <input 
            type="text" 
            placeholder="Search components..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-full pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-blue-400 transition-colors"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        <div className="space-y-2">
          {filtered.map(comp => (
            <div 
              key={comp.type}
              onClick={() => add(comp.type)}
              className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
                  {getComponentIcon(comp.type)}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-[var(--text-primary)]">{comp.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{comp.category}</span>
                </div>
              </div>
              
              <div 
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-all"
              >
                <Plus size={16} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComponentLibrary;
