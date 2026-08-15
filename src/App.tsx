import React, { useState, useCallback } from 'react';
import './App.css';
import type { Component, Wire, SimulationState, MCUModel, DebuggerAlert } from './types/circuit';
import type { OscilloscopeSample } from './types/circuit';
import Toolbar from './components/Toolbar';
import CircuitCanvas from './components/CircuitCanvas';
import ComponentLibrary from './components/ComponentLibrary';
import EditorPanel from './components/EditorPanel';
import InstrumentationStudio from './components/InstrumentationStudio';
import AICopilot from './components/AICopilot';
import PowerAnalyzer from './components/PowerAnalyzer';
import Datasheets from './components/Datasheets';
import SettingsModal from './components/SettingsModal';
import { CommandPalette } from './components/CommandPalette';
import { runStaticAnalysis } from './services/simulationEngine';
import { createComponentPreset } from './services/circuitPresets';
import { Terminal, Code, Grid3X3, Zap, Bot, BookOpen, X, AlertTriangle, CheckCircle, Info, AlertCircle, BarChart3, Gauge, Bug } from 'lucide-react';

// ------- Toast Notifications -------
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

const TOAST_ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};
const TOAST_COLORS = {
  success: 'border-green-500 text-green-400 bg-green-950',
  error: 'border-red-500 text-red-400 bg-red-950',
  warning: 'border-amber-500 text-amber-400 bg-amber-950',
  info: 'border-blue-500 text-blue-400 bg-blue-950',
};

const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => (
  <div className="fixed bottom-6 right-6 z-[9998] flex flex-col space-y-2 pointer-events-none">
    {toasts.map(toast => {
      const Icon = TOAST_ICONS[toast.type];
      return (
        <div key={toast.id}
          className={`flex items-start space-x-2 px-4 py-3 rounded-xl border ${TOAST_COLORS[toast.type]} bg-opacity-80 backdrop-blur-md shadow-xl max-w-sm pointer-events-auto animate-in slide-in-from-right duration-300`}>
          <Icon size={14} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs flex-1 leading-relaxed text-white">{toast.message}</p>
          <button onClick={() => onDismiss(toast.id)} className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0">
            <X size={12} />
          </button>
        </div>
      );
    })}
  </div>
);

// Helper for default starter circuit
const createInitialCircuit = () => {
  const mcu = createComponentPreset('mcu', 'uno');
  const led = createComponentPreset('led');
  const resistor = createComponentPreset('resistor');

  mcu.x = 80; mcu.y = 90;
  led.x = 420; led.y = 80;
  resistor.x = 420; resistor.y = 190;

  const d13Pin = mcu.pins.find(p => p.name === 'D13')?.id;
  const gndPin = mcu.pins.find(p => p.name === 'GND')?.id;
  const resP1 = resistor.pins[0]?.id;
  const resP2 = resistor.pins[1]?.id;
  const ledAnode = led.pins.find(p => p.name.includes('Anode'))?.id;
  const ledCathode = led.pins.find(p => p.name.includes('Cathode'))?.id;

  const initialWires: Wire[] = [];
  if (d13Pin && resP1) {
    initialWires.push({ id: 'wire_init_1', fromPinId: d13Pin, toPinId: resP1, color: '#f59e0b' });
  }
  if (resP2 && ledAnode) {
    initialWires.push({ id: 'wire_init_2', fromPinId: resP2, toPinId: ledAnode, color: '#ef4444' });
  }
  if (gndPin && ledCathode) {
    initialWires.push({ id: 'wire_init_3', fromPinId: gndPin, toPinId: ledCathode, color: '#3b82f6' });
  }

  return { components: [mcu, led, resistor], wires: initialWires };
};

// ------- Main App -------
function App() {
  const initialCircuit = createInitialCircuit();
  // Core state
  const [mcuModel, setMcuModel] = useState<MCUModel>('uno');
  const [components, setComponents] = useState<Component[]>(initialCircuit.components);
  const [wires, setWires] = useState<Wire[]>(initialCircuit.wires);
  const [selectedWireColor, setSelectedWireColor] = useState<string>('#06b6d4');
  const [code, setCode] = useState<string>(
    `// XavierLabs Embedded Studio\n// Arduino Uno R3 Starter Template\n\nconst int LED_PIN = 13;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(LED_PIN, OUTPUT);\n  Serial.println("XavierLabs: Simulation Started!");\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, HIGH);\n  Serial.println("LED ON");\n  delay(1000);\n\n  digitalWrite(LED_PIN, LOW);\n  Serial.println("LED OFF");\n  delay(1000);\n}`
  );

  // Simulation
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isPlaying: false,
    speed: 1,
    logs: [],
    pinVoltages: {},
    pinModes: {},
  });
  const [debuggerAlerts, setDebuggerAlerts] = useState<DebuggerAlert[]>([]);
  const [oscilloscopeSamples, setOscilloscopeSamples] = useState<Record<string, OscilloscopeSample[]>>({});

  // UI panels
  const [activeLeftPanel, setActiveLeftPanel] = useState<'components' | null>('components');
  const [activeRightPanel, setActiveRightPanel] = useState<'copilot' | 'power' | 'datasheets' | null>(null);
  const [activeBottomPanel, setActiveBottomPanel] = useState<'editor' | 'instruments' | null>(null);
  const [instrumentTab, setInstrumentTab] = useState<string>('Serial Monitor');
  
  // Resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  // Window states
  const [isEditorMaximized, setIsEditorMaximized] = useState(false);
  const [isEditorMinimized, setIsEditorMinimized] = useState(false);
  const [isInstrumentsMaximized, setIsInstrumentsMaximized] = useState(false);
  const [isInstrumentsMinimized, setIsInstrumentsMinimized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Resizable Bottom Panel
  const [bottomPanelHeight, setBottomPanelHeight] = useState(320);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  // Resizable Right Panel
  const [rightPanelWidth, setRightPanelWidth] = useState(340);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(480, startWidth + (moveEvent.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleBottomPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingBottom(true);
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Dragging up decreases clientY, increasing height
      const newHeight = Math.max(150, Math.min(800, startHeight - (moveEvent.clientY - startY)));
      setBottomPanelHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizingBottom(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleRightPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Dragging left decreases clientX, increasing width
      const newWidth = Math.max(250, Math.min(600, startWidth - (moveEvent.clientX - startX)));
      setRightPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingRight(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Loading removed for instant boot

  // --- Run Simulation ---
  const handleRunSimulation = useCallback(() => {
    if (simulationState.isPlaying) {
      // Stop
      setSimulationState(prev => ({ ...prev, isPlaying: false }));
      setComponents(comps => comps.map(c => ({ ...c, state: { ...c.state, isOn: false } })));
      addToast('info', 'Simulation stopped.');
      return;
    }

    // Run static analysis
    const report = runStaticAnalysis(code, components, wires, mcuModel);

    // Apply states back to components
    setComponents(prev => prev.map(comp => {
      let newState = { ...comp.state };

      if (comp.type === 'led' && report.ledStates[comp.id]) {
        newState = { ...newState, ...report.ledStates[comp.id] };
      }
      if (comp.type === 'rgb_led' && report.rgbStates[comp.id]) {
        const rgb = report.rgbStates[comp.id];
        newState = { ...newState, rValue: rgb.r, gValue: rgb.g, bValue: rgb.b, isOn: rgb.isOn };
      }
      if (comp.type === 'servo' && report.servoAngles[comp.id] !== undefined) {
        newState = { ...newState, angle: report.servoAngles[comp.id] };
      }
      if (comp.type === 'lcd' && report.lcdTexts[comp.id]) {
        newState = { ...newState, text: report.lcdTexts[comp.id] };
      }
      if (comp.type === 'relay') {
        newState = { ...newState, isRelayClosed: report.relayStates[comp.id] ?? false };
      }
      if (comp.type === 'buzzer' && report.buzzerFreqs[comp.id] !== undefined) {
        newState = { ...newState, frequency: report.buzzerFreqs[comp.id] };
      }
      if (comp.type === 'mcu') {
        newState = { ...newState, isOn: true };
      }

      return { ...comp, state: newState };
    }));

    // Update simulation state
    setSimulationState({
      isPlaying: true,
      speed: 1,
      logs: report.logs,
      pinVoltages: report.voltages,
      pinModes: report.modes,
      oscilloscopeSamples: report.oscilloscopeSamples,
    });

    setDebuggerAlerts(report.debuggerAlerts);
    setOscilloscopeSamples(report.oscilloscopeSamples);

    // Show alerts as toasts
    const errors = report.debuggerAlerts.filter(a => a.type === 'error');
    const warnings = report.debuggerAlerts.filter(a => a.type === 'warning');
    const successes = report.debuggerAlerts.filter(a => a.type === 'success');

    if (errors.length > 0) {
      addToast('error', errors[0].message.slice(0, 100));
    } else if (warnings.length > 0) {
      addToast('warning', warnings[0].message.slice(0, 100));
    } else if (successes.length > 0) {
      addToast('success', 'Firmware compiled & uploaded successfully!');
    }

    // Auto-open instruments panel to show results
    setActiveBottomPanel('instruments');
  }, [simulationState.isPlaying, code, components, wires, mcuModel, addToast]);

  // --- Export / Import ---
  const handleExport = useCallback(() => {
    const project = { mcuModel, components, wires, code, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'xavierlabs_circuit.json'; a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Project exported as xavierlabs_circuit.json');
  }, [mcuModel, components, wires, code, addToast]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.components) setComponents(data.components);
          if (data.wires) setWires(data.wires);
          if (data.code) setCode(data.code);
          if (data.mcuModel) setMcuModel(data.mcuModel);
          addToast('success', 'Project imported successfully!');
        } catch {
          addToast('error', 'Invalid project file. Could not parse JSON.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [addToast]);

  const handleClearCanvas = useCallback(() => {
    setComponents([]);
    setWires([]);
    setSimulationState({ isPlaying: false, speed: 1, logs: [], pinVoltages: {}, pinModes: {} });
    setDebuggerAlerts([]);
    setOscilloscopeSamples({});
    addToast('info', 'Canvas cleared.');
  }, [addToast]);

  return (
    <>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="h-screen w-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-sans">

        {/* Top Navigation Bar */}
        <div className="h-[52px] bg-[var(--bg-secondary)] flex-shrink-0 z-20 flex items-center px-4 relative border-b border-[var(--border-color)]">
          <Toolbar
            mcuModel={mcuModel}
            setMcuModel={(newModel) => {
              setMcuModel(newModel);
              setComponents(prev => {
                const filtered = prev.filter(c => c.type !== 'mcu');
                const newMcu = createComponentPreset('mcu', newModel);
                return [newMcu, ...filtered];
              });
              addToast('info', `Switched board to ${newModel === 'uno' ? 'Arduino Uno R3' : 'ESP32 DevKit v1'}`);
            }}
            selectedWireColor={selectedWireColor}
            setSelectedWireColor={setSelectedWireColor}
            simulationState={simulationState}
            onRunSimulation={handleRunSimulation}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onExport={handleExport}
            onImport={handleImport}
            onClearCanvas={handleClearCanvas}
            onOpenSearch={() => setIsSearchOpen(true)}
          />
        </div>

        {/* Main Content Area: Classic Docked IDE Layout */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* 1. Activity Bar (Far Left) */}
          <div className="w-[52px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col items-center py-2 space-y-2 flex-shrink-0 z-10">
            <SidebarButton
              icon={Grid3X3} label="Component Library"
              active={activeLeftPanel === 'components'}
              onClick={() => setActiveLeftPanel(p => p === 'components' ? null : 'components')}
            />
            <div className="w-6 h-px bg-[var(--border-color)] my-1" />
            <SidebarButton
              icon={Code} label="Code Editor"
              active={activeBottomPanel === 'editor' && !isEditorMinimized}
              onClick={() => {
                if (activeBottomPanel === 'editor') {
                  if (isEditorMinimized) {
                    setIsEditorMinimized(false);
                  } else {
                    setActiveBottomPanel(null);
                  }
                } else {
                  setActiveBottomPanel('editor');
                  setIsEditorMinimized(false);
                  setIsEditorMaximized(false);
                }
              }}
            />
            <SidebarButton
              icon={Terminal} label="Serial Monitor / Terminal"
              active={activeBottomPanel === 'instruments' && instrumentTab === 'Serial Monitor' && !isInstrumentsMinimized}
              onClick={() => {
                if (activeBottomPanel === 'instruments' && instrumentTab === 'Serial Monitor') {
                  if (isInstrumentsMinimized) {
                    setIsInstrumentsMinimized(false);
                  } else {
                    setActiveBottomPanel(null);
                  }
                } else {
                  setActiveBottomPanel('instruments');
                  setInstrumentTab('Serial Monitor');
                  setIsInstrumentsMinimized(false);
                  setIsInstrumentsMaximized(false);
                }
              }}
            />
            <SidebarButton
              icon={BarChart3} label="Oscilloscope Waveforms"
              active={activeBottomPanel === 'instruments' && instrumentTab === 'Oscilloscope' && !isInstrumentsMinimized}
              onClick={() => {
                if (activeBottomPanel === 'instruments' && instrumentTab === 'Oscilloscope') {
                  if (isInstrumentsMinimized) {
                    setIsInstrumentsMinimized(false);
                  } else {
                    setActiveBottomPanel(null);
                  }
                } else {
                  setActiveBottomPanel('instruments');
                  setInstrumentTab('Oscilloscope');
                  setIsInstrumentsMinimized(false);
                  setIsInstrumentsMaximized(false);
                }
              }}
            />
            <SidebarButton
              icon={Gauge} label="Multimeter (Pin Voltages)"
              active={activeBottomPanel === 'instruments' && instrumentTab === 'Multimeter' && !isInstrumentsMinimized}
              onClick={() => {
                if (activeBottomPanel === 'instruments' && instrumentTab === 'Multimeter') {
                  if (isInstrumentsMinimized) {
                    setIsInstrumentsMinimized(false);
                  } else {
                    setActiveBottomPanel(null);
                  }
                } else {
                  setActiveBottomPanel('instruments');
                  setInstrumentTab('Multimeter');
                  setIsInstrumentsMinimized(false);
                  setIsInstrumentsMaximized(false);
                }
              }}
            />
            <SidebarButton
              icon={Bug} label="Hardware Debugger"
              active={activeBottomPanel === 'instruments' && instrumentTab === 'Debugger' && !isInstrumentsMinimized}
              badge={debuggerAlerts.filter(a => a.type === 'error').length}
              onClick={() => {
                if (activeBottomPanel === 'instruments' && instrumentTab === 'Debugger') {
                  if (isInstrumentsMinimized) {
                    setIsInstrumentsMinimized(false);
                  } else {
                    setActiveBottomPanel(null);
                  }
                } else {
                  setActiveBottomPanel('instruments');
                  setInstrumentTab('Debugger');
                  setIsInstrumentsMinimized(false);
                  setIsInstrumentsMaximized(false);
                }
              }}
            />
            <div className="flex-1" />
            <SidebarButton
              icon={Zap} label="Power Analyzer"
              active={activeRightPanel === 'power'}
              onClick={() => setActiveRightPanel(p => p === 'power' ? null : 'power')}
            />
            <SidebarButton
              icon={Bot} label="AI Copilot"
              active={activeRightPanel === 'copilot'}
              onClick={() => setActiveRightPanel(p => p === 'copilot' ? null : 'copilot')}
            />
            <SidebarButton
              icon={BookOpen} label="Datasheets"
              active={activeRightPanel === 'datasheets'}
              onClick={() => setActiveRightPanel(p => p === 'datasheets' ? null : 'datasheets')}
            />
          </div>

          {/* 2. Left Sidebar Panel (Docked & Resizable) */}
          {activeLeftPanel && (
            <div
              style={{ width: `${sidebarWidth}px` }}
              className="bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col flex-shrink-0 z-10 relative group/sidebar"
            >
              {/* Drag handle to lengthen / shorten Component Library */}
              <div
                onMouseDown={handleSidebarMouseDown}
                className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-white/30 transition-colors z-20 ${
                  isResizingSidebar ? 'bg-white/50' : ''
                }`}
                title="Drag to resize component library"
              />
              {activeLeftPanel === 'components' && (
                <ComponentLibrary
                  onAddComponent={(c) => {
                    setComponents(prev => [...prev, c]);
                    addToast('info', `${c.name} added to canvas`);
                  }}
                />
              )}
            </div>
          )}

          {/* 3. Center Area (Canvas + Bottom Panel) */}
          <div className="flex-1 flex flex-col overflow-hidden relative z-0 bg-[var(--bg-primary)]">
            {/* Canvas */}
            <div className="flex-1 relative overflow-hidden">
              <CircuitCanvas
                components={components}
                wires={wires}
                setComponents={setComponents}
                setWires={setWires}
                simulationState={simulationState}
                selectedWireColor={selectedWireColor}
              />
            </div>

            {/* Bottom Panel (Docked) */}
            {activeBottomPanel && (
              <div 
                style={{ 
                  height: ((activeBottomPanel === 'editor' && isEditorMaximized) || (activeBottomPanel === 'instruments' && isInstrumentsMaximized))
                    ? '100%' 
                    : ((activeBottomPanel === 'editor' && isEditorMinimized) || (activeBottomPanel === 'instruments' && isInstrumentsMinimized))
                      ? '36px'
                      : `${bottomPanelHeight}px`
                }}
                className={`flex flex-col border-t border-[var(--border-color)] bg-[var(--bg-secondary)] z-10 transition-all relative ${
                  ((activeBottomPanel === 'editor' && isEditorMaximized) || (activeBottomPanel === 'instruments' && isInstrumentsMaximized))
                    ? 'absolute inset-0' : ''
                }`}
              >
                {/* Drag handle to resize Bottom Panel */}
                {!((activeBottomPanel === 'editor' && (isEditorMaximized || isEditorMinimized)) || (activeBottomPanel === 'instruments' && (isInstrumentsMaximized || isInstrumentsMinimized))) && (
                  <div
                    onMouseDown={handleBottomPanelMouseDown}
                    className={`absolute top-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-white/30 transition-colors z-20 ${
                      isResizingBottom ? 'bg-white/50' : ''
                    }`}
                    title="Drag to resize height"
                  />
                )}
                
                {activeBottomPanel === 'editor' && (
                  <EditorPanel
                    code={code}
                    setCode={setCode}
                    onClose={() => setActiveBottomPanel(null)}
                    mcuModel={mcuModel}
                    onRun={handleRunSimulation}
                    isRunning={simulationState.isPlaying}
                    isMaximized={isEditorMaximized}
                    isMinimized={isEditorMinimized}
                    onToggleMaximize={() => setIsEditorMaximized(!isEditorMaximized)}
                    onToggleMinimize={() => setIsEditorMinimized(!isEditorMinimized)}
                  />
                )}
                {activeBottomPanel === 'instruments' && (
                  <InstrumentationStudio
                    onClose={() => setActiveBottomPanel(null)}
                    logs={simulationState.logs}
                    oscilloscopeSamples={oscilloscopeSamples}
                    debuggerAlerts={debuggerAlerts}
                    pinVoltages={simulationState.pinVoltages}
                    isMaximized={isInstrumentsMaximized}
                    isMinimized={isInstrumentsMinimized}
                    onToggleMaximize={() => setIsInstrumentsMaximized(!isInstrumentsMaximized)}
                    onToggleMinimize={() => setIsInstrumentsMinimized(!isInstrumentsMinimized)}
                    activeTab={instrumentTab}
                    setActiveTab={setInstrumentTab}
                  />
                )}
              </div>
            )}
          </div>

          {/* 4. Right Sidebar Panel (Docked) */}
          {activeRightPanel && (
            <div 
              style={{ width: `${rightPanelWidth}px` }}
              className="bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col flex-shrink-0 z-10 relative group/rightbar"
            >
              {/* Drag handle to resize Right Panel */}
              <div
                onMouseDown={handleRightPanelMouseDown}
                className={`absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-white/30 transition-colors z-20 ${
                  isResizingRight ? 'bg-white/50' : ''
                }`}
                title="Drag to resize right panel"
              />
              
              <button
                onClick={() => setActiveRightPanel(null)}
                className="absolute top-3 right-3 z-20 p-1.5 rounded-md text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-active)] transition-colors"
              >
                <X size={14} />
              </button>
              {activeRightPanel === 'copilot' && (
                <AICopilot
                  code={code}
                  components={components}
                  wires={wires}
                  mcuModel={mcuModel}
                />
              )}
              {activeRightPanel === 'power' && (
                <PowerAnalyzer
                  components={components}
                  isPlaying={simulationState.isPlaying}
                />
              )}
              {activeRightPanel === 'datasheets' && <Datasheets />}
            </div>
          )}
        </div>
      </div>

      {isSettingsOpen && (
        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)} 
          zIndex={100}
          onFocus={() => {}}
        />
      )}

      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onAddComponent={(comp) => {
          setComponents(prev => [...prev, comp]);
          addToast('info', `${comp.name} added to canvas`);
        }}
        onRunSimulation={handleRunSimulation}
        isRunning={simulationState.isPlaying}
        onClearCanvas={handleClearCanvas}
        onExport={handleExport}
        onImport={handleImport}
        onOpenPanel={(panel, tab) => {
          if (panel === 'editor') {
            setActiveBottomPanel('editor');
            setIsEditorMinimized(false);
          } else if (panel === 'instruments') {
            setActiveBottomPanel('instruments');
            if (tab) setInstrumentTab(tab);
            setIsInstrumentsMinimized(false);
          } else {
            setActiveRightPanel(panel);
          }
        }}
      />
    </>
  );
}

// ---- Sidebar Button Component ----
interface SidebarButtonProps {
  icon: React.FC<{ size?: number; strokeWidth?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({ icon: Icon, label, active, onClick, badge }) => {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
        active 
          ? 'text-white bg-[var(--bg-active)] border border-[var(--border-color)]' 
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
      }`}
    >
      <Icon size={24} strokeWidth={1.5} />
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-md">
          {badge}
        </span>
      )}
    </button>
  );
};

export default App;
