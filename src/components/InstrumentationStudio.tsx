import React, { useState, useEffect, useRef } from 'react';
import { Terminal, BarChart3, Gauge, Bug, Download, X, Maximize2, Minimize2, Trash2, CornerDownLeft } from 'lucide-react';
import type { SimulationLog, OscilloscopeSample, DebuggerAlert } from '../types/circuit';

interface Props {
  onClose: () => void;
  logs: SimulationLog[];
  oscilloscopeSamples: Record<string, OscilloscopeSample[]>;
  debuggerAlerts: DebuggerAlert[];
  pinVoltages: Record<string, number>;
  isMaximized: boolean;
  isMinimized: boolean;
  onToggleMaximize: () => void;
  onToggleMinimize: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

const LOG_COLORS: Record<string, string> = {
  info: 'text-zinc-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
  success: 'text-green-400'
};

const LOG_PREFIXES = {
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERR!]',
  success: '[ OK ]',
};

const OscilloscopeView: React.FC<{ samples: Record<string, OscilloscopeSample[]> }> = ({ samples }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampleKeys = Object.keys(samples);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width; const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += W / 10) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += H / 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H * 0.8); ctx.lineTo(W, H * 0.8); ctx.stroke();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText('5V', 4, H * 0.1 + 4);
    ctx.fillText('0V', 4, H * 0.85);

    const colors = ['#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];

    sampleKeys.slice(0, 5).forEach((pinId, colorIdx) => {
      const waveData = samples[pinId];
      if (!waveData || waveData.length === 0) return;

      const color = colors[colorIdx % colors.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      waveData.forEach((sample, i) => {
        const x = (i / (waveData.length - 1)) * W;
        const y = H * 0.8 - (sample.voltage / 5) * (H * 0.65);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      ctx.fillText(pinId.split('_').pop() || pinId, W - 60, H * 0.1 + colorIdx * 14 + 8);
    });

    if (sampleKeys.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Run simulation to see waveforms', W / 2, H / 2);
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText('PWM pins will show square waves here', W / 2, H / 2 + 16);
    }
  }, [samples, sampleKeys]);

  return (
    <div className="flex-1 relative p-3">
      <canvas ref={canvasRef} width={800} height={200} className="w-full h-full rounded-lg" style={{ imageRendering: 'crisp-edges' }} />
    </div>
  );
};

const InstrumentationStudio: React.FC<Props> = ({ onClose, logs, oscilloscopeSamples, debuggerAlerts, pinVoltages, isMaximized: _isMaximized, isMinimized, onToggleMaximize, onToggleMinimize, activeTab: propActiveTab, setActiveTab: propSetActiveTab }) => {
  const [localActiveTab, setLocalActiveTab] = useState('Serial Monitor');
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = propSetActiveTab || setLocalActiveTab;
  const [inputCommand, setInputCommand] = useState('');
  const [baudRate, setBaudRate] = useState('9600');
  const [terminalLogs, setTerminalLogs] = useState<SimulationLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Sync incoming props logs
  useEffect(() => {
    setTerminalLogs(logs);
  }, [logs]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  const handleSendCommand = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputCommand.trim()) return;
    const timestamp = new Date().toLocaleTimeString();
    const userLog: SimulationLog = {
      timestamp,
      level: 'info',
      message: `> [TX ${baudRate} baud]: ${inputCommand.trim()}`,
    };
    const responseLog: SimulationLog = {
      timestamp,
      level: 'success',
      message: `< [RX MCU]: Received "${inputCommand.trim()}" (ACK 0x06)`,
    };
    setTerminalLogs(prev => [...prev, userLog, responseLog]);
    setInputCommand('');
  };

  const handleClearTerminal = () => {
    setTerminalLogs([]);
  };

  const tabs = [
    { id: 'Serial Monitor', icon: Terminal },
    { id: 'Oscilloscope', icon: BarChart3 },
    { id: 'Multimeter', icon: Gauge },
    { id: 'Debugger', icon: Bug },
  ];

  const downloadLogs = () => {
    const content = terminalLogs.map(l => `[${l.timestamp}] ${l.level.toUpperCase()}: ${l.message}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'simulation_logs.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  if (isMinimized) {
    return (
      <div className="flex items-center justify-between h-full px-3 cursor-pointer bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors rounded-lg" onClick={onToggleMinimize}>
        <span className="text-xs font-semibold text-[var(--text-primary)]">Instrumentation</span>
        <button onClick={onClose} className="p-1 rounded text-[var(--text-muted)] hover:text-white">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] rounded-lg overflow-hidden border border-[var(--border-color)]">
      {/* Tab Bar */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 flex-shrink-0">
        <div className="flex flex-1">
          {tabs.map(({ id, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center space-x-1.5 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === id
                  ? 'border-b-2 border-white text-white bg-[var(--bg-active)]'
                  : 'border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}>
              <Icon size={12} />
              <span>{id}</span>
              {id === 'Debugger' && debuggerAlerts.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {debuggerAlerts.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 pl-2">
          {activeTab === 'Serial Monitor' && (
            <>
              {/* Baud Rate Selector */}
              <select
                value={baudRate}
                onChange={e => setBaudRate(e.target.value)}
                className="bg-[var(--bg-primary)] text-xs text-[var(--text-secondary)] border border-[var(--border-color)] rounded px-2 py-1 outline-none cursor-pointer hover:border-zinc-500"
              >
                <option value="9600">9600 baud</option>
                <option value="115200">115200 baud</option>
                <option value="57600">57600 baud</option>
                <option value="19200">19200 baud</option>
              </select>

              <button onClick={handleClearTerminal} className="p-1.5 rounded text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors" title="Clear Console">
                <Trash2 size={13} />
              </button>
              <button onClick={downloadLogs} className="p-1.5 rounded text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors" title="Download Logs">
                <Download size={13} />
              </button>
            </>
          )}
          <div className="w-px h-4 bg-[var(--border-color)] mx-1" />
          <button onClick={onToggleMinimize} className="p-1.5 rounded text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors" title="Minimize">
            <Minimize2 size={13} />
          </button>
          <button onClick={onToggleMaximize} className="p-1.5 rounded text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors" title="Maximize">
            <Maximize2 size={13} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/20 transition-colors" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'Serial Monitor' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
            {/* Terminal Log Output */}
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1 select-text">
              {terminalLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                  <div className="text-center">
                    <Terminal size={28} className="mx-auto mb-2 opacity-20" />
                    <p className="text-xs">Terminal ready. Run simulation or type a command below.</p>
                  </div>
                </div>
              ) : (
                terminalLogs.map((log, i) => (
                  <div key={i} className={`flex items-start space-x-2 ${LOG_COLORS[log.level]}`}>
                    <span className="text-[var(--text-muted)] flex-shrink-0 opacity-40">[{log.timestamp}]</span>
                    <span className="opacity-70 flex-shrink-0">{LOG_PREFIXES[log.level]}</span>
                    <span className="flex-1 whitespace-pre-wrap leading-relaxed">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Interactive Terminal CLI Prompt */}
            <form onSubmit={handleSendCommand} className="flex items-center px-3 py-2 border-t border-[var(--border-color)] bg-[#121215] space-x-2">
              <span className="text-zinc-400 font-mono font-bold text-xs flex items-center select-none">
                $
              </span>
              <input
                type="text"
                value={inputCommand}
                onChange={e => setInputCommand(e.target.value)}
                placeholder="Send serial input or command to MCU..."
                className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 font-mono outline-none"
              />
              <button
                type="submit"
                disabled={!inputCommand.trim()}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono font-medium disabled:opacity-30 transition-colors flex items-center space-x-1"
              >
                <span>Send</span>
                <CornerDownLeft size={10} />
              </button>
            </form>
          </div>
        )}

        {activeTab === 'Oscilloscope' && (
          <div className="flex-1 flex flex-col bg-[#0a0a0a] p-2">
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-[10px] font-mono text-[var(--text-muted)]">TIME BASE: 10ms/div · 1V/div</span>
              <span className="text-[10px] font-mono text-[var(--color-cyan)]">
                {Object.keys(oscilloscopeSamples).length} active channels
              </span>
            </div>
            <OscilloscopeView samples={oscilloscopeSamples} />
          </div>
        )}

        {activeTab === 'Multimeter' && (
          <div className="flex-1 overflow-y-auto p-4 bg-[#09090b]">
            <div className="max-w-xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-center py-2">
              
              {/* Digital Multimeter (DMM) Device Graphic */}
              <div className="w-64 bg-[#f59e0b] p-3 rounded-3xl shadow-2xl border-4 border-[#18181b] flex flex-col items-center select-none relative">
                {/* Brand label */}
                <div className="w-full flex justify-between items-center mb-2 px-1">
                  <span className="text-[10px] font-extrabold text-black tracking-widest uppercase">XAVIERLABS</span>
                  <span className="text-[9px] font-mono font-bold text-black opacity-80">XL-880 DMM</span>
                </div>

                {/* Backlit Digital LCD Screen */}
                <div className="w-full bg-[#86efac] border-4 border-[#18181b] rounded-xl p-3 shadow-inner flex flex-col justify-between h-20 mb-3 relative overflow-hidden">
                  <div className="flex justify-between items-center text-[9px] font-mono font-bold text-emerald-950 opacity-70">
                    <span>AUTO RANGE</span>
                    <span>DC VOLTS</span>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-mono font-black tracking-wider text-emerald-950">
                      {Object.keys(pinVoltages).length > 0
                        ? `${(Object.values(pinVoltages)[0] || 0).toFixed(2)}`
                        : '0.00'}
                    </span>
                    <span className="text-sm font-mono font-bold text-emerald-950 ml-1">V</span>
                  </div>
                </div>

                {/* Rotary Dial Knob */}
                <div className="w-24 h-24 rounded-full bg-[#18181b] border-4 border-[#27272a] flex items-center justify-center relative shadow-lg my-1">
                  <div className="w-16 h-16 rounded-full bg-[#27272a] border border-[#3f3f46] flex items-center justify-center relative">
                    <div className="w-2 h-7 bg-white rounded-full absolute top-1.5 shadow" />
                  </div>
                  {/* Dial Labels */}
                  <span className="absolute -top-1 font-mono text-[9px] font-bold text-black">V=</span>
                  <span className="absolute -right-2 font-mono text-[9px] font-bold text-black">V~</span>
                  <span className="absolute -bottom-1 font-mono text-[9px] font-bold text-black">Ω</span>
                  <span className="absolute -left-2 font-mono text-[9px] font-bold text-black">OFF</span>
                </div>

                {/* Probe Lead Sockets */}
                <div className="w-full flex justify-around mt-3 pt-2 border-t border-amber-600/40">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-[#ef4444] border-2 border-[#18181b] flex items-center justify-center shadow">
                      <div className="w-2 h-2 rounded-full bg-[#991b1b]" />
                    </div>
                    <span className="text-[8px] font-mono font-bold text-black mt-0.5">V/Ω (+)</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-[#18181b] border-2 border-[#27272a] flex items-center justify-center shadow">
                      <div className="w-2 h-2 rounded-full bg-black" />
                    </div>
                    <span className="text-[8px] font-mono font-bold text-black mt-0.5">COM (−)</span>
                  </div>
                </div>
              </div>

              {/* Multimeter Voltage Channels Panel */}
              <div className="flex-1 w-full space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Live Measured Channels</h3>
                  <span className="text-[10px] font-mono text-zinc-400">{Object.keys(pinVoltages).length} active</span>
                </div>

                {Object.keys(pinVoltages).length === 0 ? (
                  <div className="bg-[#121215] rounded-xl p-6 text-center border border-[#1f1f23]">
                    <Gauge size={28} className="mx-auto mb-2 text-zinc-500 opacity-40" />
                    <p className="text-xs text-zinc-400 font-medium">No live voltages measured yet.</p>
                    <p className="text-[10px] text-zinc-500 mt-1">Run simulation to view digital multimeter pin readings.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {Object.entries(pinVoltages).map(([pinId, voltage]) => (
                      <div key={pinId} className="flex items-center justify-between bg-[#121215] border border-[#1f1f23] rounded-xl px-3.5 py-2.5 hover:border-zinc-700 transition-colors">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${voltage > 0 ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-zinc-600'}`} />
                          <span className="text-xs font-mono text-white font-medium truncate max-w-[180px]">{pinId}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="h-1.5 w-24 bg-[#1e1e24] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (voltage / 5) * 100)}%` }} />
                          </div>
                          <span className={`text-xs font-bold font-mono min-w-[50px] text-right ${voltage > 3.5 ? 'text-red-400' : voltage > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                            {voltage.toFixed(2)} V
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {activeTab === 'Debugger' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#09090b]">
            {debuggerAlerts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <div className="text-4xl mb-2 text-zinc-600">✓</div>
                  <p className="text-sm font-semibold text-zinc-300">No issues detected</p>
                  <p className="text-xs text-zinc-500 mt-1">Run simulation to validate your circuit</p>
                </div>
              </div>
            ) : (
              debuggerAlerts.map((alert) => (
                <div key={alert.id} className="border-l-4 border-l-zinc-300 border-y border-r border-y-zinc-800 border-r-zinc-800 rounded-r-xl p-3 bg-[#121215]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">
                      {alert.type} · {alert.source}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed font-mono">{alert.message}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InstrumentationStudio;
