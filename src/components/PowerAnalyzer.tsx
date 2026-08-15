import React, { useMemo } from 'react';
import type { Component } from '../types/circuit';
import { Zap, Battery, AlertTriangle, CheckCircle } from 'lucide-react';

interface Props {
  components: Component[];
  isPlaying: boolean;
}

interface ComponentPower {
  id: string;
  name: string;
  type: string;
  current_mA: number;
  voltage: number;
  power_mW: number;
  color: string;
}

const COMPONENT_POWER: Record<string, { current_mA: number; voltage: number; color: string }> = {
  mcu:           { current_mA: 46,   voltage: 5.0,  color: '#22c55e' },
  led:           { current_mA: 15,   voltage: 2.0,  color: '#ef4444' },
  rgb_led:       { current_mA: 45,   voltage: 2.0,  color: '#a855f7' },
  resistor:      { current_mA: 0,    voltage: 0,    color: '#f59e0b' },
  button:        { current_mA: 0.1,  voltage: 3.3,  color: '#94a3b8' },
  potentiometer: { current_mA: 0.5,  voltage: 5.0,  color: '#fbbf24' },
  dht11:         { current_mA: 2.5,  voltage: 3.3,  color: '#38bdf8' },
  ultrasonic:    { current_mA: 15,   voltage: 5.0,  color: '#60a5fa' },
  ldr:           { current_mA: 1,    voltage: 3.3,  color: '#fde047' },
  relay:         { current_mA: 80,   voltage: 5.0,  color: '#f97316' },
  servo:         { current_mA: 150,  voltage: 5.0,  color: '#818cf8' },
  buzzer:        { current_mA: 30,   voltage: 5.0,  color: '#fb923c' },
  lcd:           { current_mA: 20,   voltage: 5.0,  color: '#4ade80' },
  breadboard:    { current_mA: 0,    voltage: 0,    color: '#64748b' },
};

const BATTERY_OPTIONS = [
  { label: '9V Alkaline (500mAh)', capacity_mAh: 500, voltage: 9, efficiency: 0.8 },
  { label: 'USB Power Bank (2000mAh)', capacity_mAh: 2000, voltage: 5, efficiency: 0.9 },
  { label: 'LiPo 3.7V (1000mAh)', capacity_mAh: 1000, voltage: 3.7, efficiency: 0.85 },
  { label: '4xAA Battery (2500mAh)', capacity_mAh: 2500, voltage: 6, efficiency: 0.75 },
];

const PowerAnalyzer: React.FC<Props> = ({ components, isPlaying }) => {
  const [selectedBattery, setSelectedBattery] = React.useState(0);

  const powerData = useMemo<ComponentPower[]>(() => {
    return components
      .filter(c => c.type !== 'breadboard' && c.type !== 'resistor')
      .map(c => {
        const spec = COMPONENT_POWER[c.type] || { current_mA: 5, voltage: 3.3, color: '#9ca3af' };
        const activeMult = (isPlaying && c.state?.isOn !== false) ? 1 : 0.01;
        return {
          id: c.id,
          name: c.name,
          type: c.type,
          current_mA: spec.current_mA * activeMult,
          voltage: spec.voltage,
          power_mW: spec.current_mA * activeMult * spec.voltage,
          color: spec.color,
        };
      });
  }, [components, isPlaying]);

  const totalCurrent = powerData.reduce((sum, c) => sum + c.current_mA, 0);
  const totalPower = powerData.reduce((sum, c) => sum + c.power_mW, 0);
  const battery = BATTERY_OPTIONS[selectedBattery];
  const runtimeHours = totalCurrent > 0 ? (battery.capacity_mAh * battery.efficiency) / totalCurrent : Infinity;
  const maxCurrent = Math.max(...powerData.map(c => c.current_mA), 1);
  const isWarning = totalCurrent > 500;
  const isDanger = totalCurrent > 900;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-color)] flex-shrink-0">
        <div className="flex items-center space-x-2 mb-1">
          <Zap size={16} className={isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-[var(--color-amber)]'} />
          <h2 className="text-sm font-semibold text-white">Power Analyzer</h2>
        </div>
        <p className="text-[10px] text-[var(--text-muted)]">{isPlaying ? 'Live simulation data' : 'Idle estimates'}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-xl p-3 border ${isDanger ? 'bg-red-900 bg-opacity-20 border-red-700' : isWarning ? 'bg-amber-900 bg-opacity-20 border-amber-700' : 'bg-[var(--bg-secondary)] border-[var(--border-light)]'}`}>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Total Current</p>
            <p className={`text-xl font-bold font-mono ${isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white'}`}>
              {totalCurrent.toFixed(1)} <span className="text-sm">mA</span>
            </p>
            {isDanger && <p className="text-[9px] text-red-400 mt-1 flex items-center gap-1"><AlertTriangle size={9} /> Over USB limit!</p>}
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl p-3">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Total Power</p>
            <p className="text-xl font-bold font-mono text-white">
              {totalPower < 1000 ? `${totalPower.toFixed(0)}` : `${(totalPower / 1000).toFixed(2)}`}
              <span className="text-sm">{totalPower < 1000 ? ' mW' : ' W'}</span>
            </p>
          </div>
        </div>

        {/* Battery Runtime */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Battery size={14} className="text-[var(--color-amber)]" />
            <p className="text-xs font-semibold text-white">Battery Runtime Estimator</p>
          </div>
          <select value={selectedBattery} onChange={e => setSelectedBattery(+e.target.value)}
            className="w-full bg-[var(--bg-active)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-xs text-white outline-none mb-3">
            {BATTERY_OPTIONS.map((b, i) => <option key={i} value={i}>{b.label}</option>)}
          </select>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">Estimated Runtime</span>
            <span className={`text-sm font-bold font-mono ${totalCurrent === 0 ? 'text-[var(--text-muted)]' : 'text-[var(--color-amber)]'}`}>
              {totalCurrent === 0 ? '∞' : runtimeHours > 999 ? `${Math.round(runtimeHours / 24)}d` : `${runtimeHours.toFixed(1)}h`}
            </span>
          </div>
        </div>

        {/* Per-component breakdown */}
        {powerData.length > 0 ? (
          <div>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Per-Component Draw</p>
            <div className="space-y-2">
              {powerData.map(comp => (
                <div key={comp.id}>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-xs text-[var(--text-secondary)] truncate max-w-[150px]">{comp.name}</span>
                    <span className="text-xs font-mono text-white">{comp.current_mA.toFixed(1)} mA</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg-active)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(comp.current_mA / maxCurrent) * 100}%`,
                        backgroundColor: comp.color,
                        boxShadow: `0 0 4px ${comp.color}`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle size={32} className="text-[var(--text-muted)] mb-2 opacity-30" />
            <p className="text-xs text-[var(--text-muted)]">Add components to see power analysis</p>
          </div>
        )}

        {/* Safety Guidelines */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl p-3 text-[10px] space-y-1">
          <p className="text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-2">Safety Limits</p>
          <div className={`flex justify-between ${totalCurrent > 200 ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
            <span>Arduino 5V pin max</span><span>500 mA</span>
          </div>
          <div className={`flex justify-between ${totalCurrent > 500 ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
            <span>USB Port limit</span><span>900 mA</span>
          </div>
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>ESP32 GPIO max</span><span>40 mA/pin</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerAnalyzer;
