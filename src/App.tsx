import { useState, useEffect } from 'react';
import {
  Cpu,
  FolderOpen,
  PlusCircle,
  MessageSquareCode,
  Zap,
  BookOpen,
  Settings,
  HelpCircle,
  FileDown,
  Terminal,
  AlertTriangle,
  RotateCcw,
  Bug,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  FilePlus,
  Layout,
  Edit2,
  GraduationCap
} from 'lucide-react';
import './App.css';

import type { Component, Wire, SimulationState, ProjectFile } from './types/circuit';
import { createComponentPreset } from './services/circuitPresets';
import { runStaticAnalysis } from './services/simulationEngine';

// Components
import { CircuitCanvas } from './components/CircuitCanvas';
import { EditorPanel } from './components/EditorPanel';
import { AICopilot } from './components/AICopilot';
import { PowerAnalyzer } from './components/PowerAnalyzer';
import { Datasheets } from './components/Datasheets';
import { SettingsModal } from './components/SettingsModal';
import { CIRCUIT_TEMPLATES } from './services/circuitTemplates';
import { TUTORIALS } from './services/learningMaterials';

// Starter Codes
const UNO_STARTER_CODE = `// Arduino Uno Blink Sketch
const int ledPin = 13; // Built-in LED on D13

void setup() {
  Serial.begin(9600);
  Serial.println("Arduino Uno simulation starting...");
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  Serial.println("LED Pin 13 is HIGH - Powered");
  delay(1000);
  
  digitalWrite(ledPin, LOW);
  Serial.println("LED Pin 13 is LOW - Grounded");
  delay(1000);
}
`;

const ESP32_STARTER_CODE = `// ESP32 GPIO Blink Sketch
const int ledPin = 2; // Onboard LED usually GPIO2

void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 IoT simulation starting...");
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  Serial.println("ESP32 Pin D2 is HIGH");
  delay(1000);
  
  digitalWrite(ledPin, LOW);
  Serial.println("ESP32 Pin D2 is LOW");
  delay(1000);
}
`;

function App() {
  // Global States
  const [selectedMCUModel, setSelectedMCUModel] = useState<'uno' | 'esp32'>('uno');
  const [components, setComponents] = useState<Component[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [activePinIdForWire, setActivePinIdForWire] = useState<string | null>(null);
  
  const [files, setFiles] = useState<ProjectFile[]>([
    { name: 'main.ino', content: UNO_STARTER_CODE, isActive: true },
    { name: 'config.h', content: '// Configure network variables here\n#define SSID "STEM-Lab-WiFi"\n#define PASS "12345678"', isActive: false },
  ]);

  const [activeSidebarTab, setActiveSidebarTab] = useState<'files' | 'components' | 'copilot' | 'power' | 'datasheet' | 'templates' | 'learning'>('components');
  const [activeBottomTab, setActiveBottomTab] = useState<'serial' | 'problems' | 'debugger'>('serial');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);

  // Layout Management
  const [layoutSwap, setLayoutSwap] = useState(false);
  const [maximizedPane, setMaximizedPane] = useState<'editor' | 'canvas' | null>(null);
  const [closedPanes, setClosedPanes] = useState<{ editor: boolean; canvas: boolean; bottom: boolean }>({
    editor: false,
    canvas: false,
    bottom: false,
  });

  const handleActivityIconClick = (tab: typeof activeSidebarTab) => {
    if (activeSidebarTab === tab && isSidebarOpen) {
      setIsSidebarOpen(false);
    } else {
      setActiveSidebarTab(tab);
      setIsSidebarOpen(true);
    }
  };

  const handleBottomTabClick = (tab: 'serial' | 'problems' | 'debugger') => {
    if (activeBottomTab === tab && isBottomPanelOpen) {
      setIsBottomPanelOpen(false);
    } else {
      setActiveBottomTab(tab);
      setIsBottomPanelOpen(true);
    }
  };
  
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isPlaying: false,
    speed: 1,
    logs: [],
    pinVoltages: {},
    pinModes: {},
  });

  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [debuggerAlerts, setDebuggerAlerts] = useState<Array<{ id: string; type: 'warning' | 'error' | 'success'; message: string; source: 'schematic' | 'code' }>>([]);
  const [projectSaved, setProjectSaved] = useState(false);
  
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');

  // Load API Key and saved project from localStorage on first mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
    if (savedKey) setApiKey(savedKey);

    // Try restoring saved project session
    const savedProject = localStorage.getItem('xavierlabs_project');
    if (savedProject) {
      try {
        const proj = JSON.parse(savedProject);
        if (proj.components && proj.wires && proj.files && proj.mcu) {
          setSelectedMCUModel(proj.mcu);
          setComponents(proj.components);
          setWires(proj.wires);
          setFiles(proj.files);
          return; // Skip default MCU reset
        }
      } catch (e) {
        console.warn('Failed to restore project:', e);
      }
    }
    // No saved project — load initial MCU board with default
    resetMCU('uno');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save project to localStorage on any meaningful change
  useEffect(() => {
    if (components.length === 0) return;
    const project = {
      mcu: selectedMCUModel,
      components,
      wires,
      files,
    };
    localStorage.setItem('xavierlabs_project', JSON.stringify(project));
  }, [components, wires, files, selectedMCUModel]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+R or Cmd+R — Run simulation
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (!simulationState.isPlaying) handleStartSimulation();
      }
      // Escape — Stop simulation or cancel wire drawing
      if (e.key === 'Escape') {
        if (simulationState.isPlaying) handleStopSimulation();
        setActivePinIdForWire(null);
      }
      // Ctrl+S — Save project snapshot
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setProjectSaved(true);
        setTimeout(() => setProjectSaved(false), 2000);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [simulationState.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update MCU when board selector changes
  const handleBoardChange = (mcu: 'uno' | 'esp32') => {
    setSelectedMCUModel(mcu);
    resetMCU(mcu);

    // Load matching starter code
    setFiles([
      { name: 'main.ino', content: mcu === 'uno' ? UNO_STARTER_CODE : ESP32_STARTER_CODE, isActive: true },
      { name: 'config.h', content: '// Configure network variables here\n#define SSID "STEM-Lab-WiFi"\n#define PASS "12345678"', isActive: false },
    ]);
  };

  const resetMCU = (mcuType: 'uno' | 'esp32') => {
    const newMcu = createComponentPreset('mcu', mcuType);
    setComponents([newMcu]);
    setWires([]);
    setSelectedComponentId(null);
    setSimulationState({
      isPlaying: false,
      speed: 1,
      logs: [],
      pinVoltages: {},
      pinModes: {},
    });
    setDebuggerAlerts([]);
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  // Add component to workspace
  const handleAddComponent = (type: any) => {
    try {
      const newComp = createComponentPreset(type);
      
      // Offset component based on existing ones so they don't overlay
      const count = components.filter(c => c.type === type).length;
      newComp.x += count * 20;
      newComp.y += count * 20;

      setComponents([...components, newComp]);
      
      // Automatically switch focus
      setSelectedComponentId(newComp.id);
    } catch (e) {
      console.error(e);
    }
  };

  // Simulation controls
  const handleStartSimulation = () => {
    const activeFile = files.find(f => f.isActive) || files[0];
    const report = runStaticAnalysis(activeFile.content, components, wires, selectedMCUModel);
    
    // Set simulator states
    setDebuggerAlerts(report.debuggerAlerts);
    setSimulationState({
      isPlaying: true,
      speed: 1,
      logs: report.logs,
      pinVoltages: report.voltages,
      pinModes: report.modes,
    });

    // Update LED states dynamically on the canvas
    setComponents(prevComponents =>
      prevComponents.map(comp => {
        if (comp.type === 'led' && report.ledStates[comp.id]) {
          return {
            ...comp,
            state: {
              ...comp.state,
              isOn: report.ledStates[comp.id].isOn,
              brightness: report.ledStates[comp.id].brightness,
            }
          };
        }
        return comp;
      })
    );

    // Auto focus bottom panel on alerts if there are problems
    const containsErrors = report.debuggerAlerts.some(a => a.type === 'error');
    if (containsErrors) {
      setActiveBottomTab('debugger');
    } else {
      setActiveBottomTab('serial');
    }
  };

  const handleStopSimulation = () => {
    setSimulationState(prev => ({ ...prev, isPlaying: false }));
    // Turn off LEDs
    setComponents(prevComponents =>
      prevComponents.map(comp => {
        if (comp.type === 'led') {
          return { ...comp, state: { ...comp.state, isOn: false, brightness: 0 } };
        }
        return comp;
      })
    );
  };

  const handleResetSimulation = () => {
    handleStopSimulation();
    resetMCU(selectedMCUModel);
  };

  // Export utilities
  const handleExport = (action: string) => {
    const activeFile = files.find(f => f.isActive) || files[0];
    let title = '';
    let content = '';
    let mimeType = 'text/plain';

    if (action === 'hex') {
      title = 'firmware.hex';
      content = `:100000000C9434000C9451000C9451000C945100AC\n:100010000C9451000C9451000C9451000C94510090\n:00000001FF`;
    } else if (action === 'pinout') {
      title = 'pinout_map.txt';
      content = `--- XAVIERLABS IDE: PINOUT CONFIGURATION ---\nBoard: ${selectedMCUModel === 'uno' ? 'Arduino Uno R3' : 'ESP32 DevKit v1'}\n\nWired components:\n` +
        components.filter(c => c.type !== 'mcu' && c.type !== 'breadboard').map(c => `[+] ${c.name} (${c.id})`).join('\n');
    } else if (action === 'json') {
      // Export full project as sharable JSON
      title = 'xavierlabs_project.json';
      mimeType = 'application/json';
      content = JSON.stringify({ mcu: selectedMCUModel, components, wires, files }, null, 2);
    } else {
      title = 'readme.md';
      content = `# XavierLabs IDE — Project Guide\nAuto-generated by XavierLabs IDE.\n\n## Board\n${selectedMCUModel === 'uno' ? 'Arduino Uno R3' : 'ESP32 DevKit v1'}\n\n## Component List\n` +
        components.map(c => `- ${c.name}`).join('\n') + `\n\n## Firmware Sketch\n\`\`\`cpp\n${activeFile.content}\n\`\`\``;
    }

    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = title;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Add a new blank file to the project
  const handleNewFile = () => {
    const baseName = 'new_file';
    const ext = '.ino';
    let fileName = `${baseName}${ext}`;
    let counter = 1;
    while (files.some(f => f.name === fileName)) {
      fileName = `${baseName}_${counter}${ext}`;
      counter++;
    }
    const newFile: typeof files[0] = {
      name: fileName,
      content: `// ${fileName}\n// Add your code here\n`,
      isActive: false,
    };
    setFiles([...files, newFile]);
  };

  // Import project from JSON file
  const handleImportProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const proj = JSON.parse(ev.target?.result as string);
          if (proj.components && proj.wires && proj.files && proj.mcu) {
            setSelectedMCUModel(proj.mcu);
            setComponents(proj.components);
            setWires(proj.wires);
            setFiles(proj.files);
            setSimulationState({ isPlaying: false, speed: 1, logs: [], pinVoltages: {}, pinModes: {} });
            setDebuggerAlerts([]);
          }
        } catch {
          alert('Invalid project file. Please select a valid XavierLabs JSON project.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };


  return (
    <div className="app-container">
      {/* 1. Header Titlebar */}
      <header className="title-bar">
        <div className="title-bar-left">
          <div className="logo">
            <Cpu className="logo-icon animate-pulse" size={18} />
            <span>XavierLabs</span>
          </div>
          
          <div className="board-select-container">
            <span className="board-label">Target Board:</span>
            <select
              value={selectedMCUModel}
              onChange={(e) => handleBoardChange(e.target.value as any)}
              className="board-selector"
            >
              <option value="uno">Arduino Uno R3</option>
              <option value="esp32">ESP32 DevKit v1</option>
            </select>
          </div>
        </div>

        <div className="title-bar-center">
          <div className="status-badge">
            <span className={`status-dot ${simulationState.isPlaying ? 'active' : ''}`} />
            <span>{simulationState.isPlaying ? 'Simulation Active' : 'Sandbox Idle'}</span>
          </div>
          {projectSaved && (
            <div className="saved-toast">
              <Save size={10} />
              <span>Project Saved</span>
            </div>
          )}
        </div>

        <div className="title-bar-right">
          {/* Restore Closed Panes controls */}
          {(closedPanes.editor || closedPanes.canvas || closedPanes.bottom) && (
            <div className="title-restore-controls">
              {closedPanes.editor && (
                <button className="restore-pill-btn" onClick={() => setClosedPanes(prev => ({ ...prev, editor: false }))} data-tooltip="Restore Code Editor">
                  Show Editor
                </button>
              )}
              {closedPanes.canvas && (
                <button className="restore-pill-btn" onClick={() => setClosedPanes(prev => ({ ...prev, canvas: false }))} data-tooltip="Restore Sandbox">
                  Show Sandbox
                </button>
              )}
              {closedPanes.bottom && (
                <button className="restore-pill-btn" onClick={() => { setClosedPanes(prev => ({ ...prev, bottom: false })); setIsBottomPanelOpen(true); }} data-tooltip="Restore Terminal">
                  Show Terminal
                </button>
              )}
            </div>
          )}

          {/* Export / Deploy dropdown */}
          <div className="export-dropdown">
            <button className="btn btn-ai flex items-center">
              <FileDown size={14} />
              <span>Compile & Build</span>
            </button>
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={() => handleExport('hex')}>
                📥 Export Firmware (.HEX)
              </button>
              <button className="dropdown-item" onClick={() => handleExport('pinout')}>
                🗺️ Export Pin Mapping
              </button>
              <button className="dropdown-item" onClick={() => handleExport('json')}>
                📦 Export Project (.JSON)
              </button>
              <button className="dropdown-item" onClick={handleImportProject}>
                📂 Import Project (.JSON)
              </button>
              <div className="dropdown-separator" />
              <button className="dropdown-item" onClick={() => handleExport('docs')}>
                📄 Generate Readme.MD
              </button>
            </div>
          </div>

          <button
            className="btn btn-icon text-slate-400 hover:text-white"
            onClick={() => setIsSettingsOpen(true)}
            data-tooltip="API Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* 2. Main Work Panel */}
      <main className="main-workspace">
        
        {/* Left Side Activity bar (Icons toggle) */}
        <nav className="activity-bar">
          <div className="activity-bar-top">
            <button
              onClick={() => handleActivityIconClick('files')}
              className={`activity-icon ${activeSidebarTab === 'files' && isSidebarOpen ? 'active' : ''}`}
              data-tooltip="Explorer"
            >
              <FolderOpen size={18} />
            </button>
            
            <button
              onClick={() => handleActivityIconClick('components')}
              className={`activity-icon ${activeSidebarTab === 'components' && isSidebarOpen ? 'active' : ''}`}
              data-tooltip="Component Library"
            >
              <PlusCircle size={18} />
            </button>

            <button
              onClick={() => handleActivityIconClick('copilot')}
              className={`activity-icon ${activeSidebarTab === 'copilot' && isSidebarOpen ? 'active' : ''}`}
              data-tooltip="AI Copilot"
            >
              <MessageSquareCode size={18} />
            </button>

            <button
              onClick={() => handleActivityIconClick('power')}
              className={`activity-icon ${activeSidebarTab === 'power' && isSidebarOpen ? 'active' : ''}`}
              data-tooltip="Power consumption"
            >
              <Zap size={18} />
            </button>

            <button
              onClick={() => handleActivityIconClick('datasheet')}
              className={`activity-icon ${activeSidebarTab === 'datasheet' && isSidebarOpen ? 'active' : ''}`}
              data-tooltip="Datasheet Intelligence"
            >
              <BookOpen size={18} />
            </button>

            <button
              onClick={() => handleActivityIconClick('templates')}
              className={`activity-icon ${activeSidebarTab === 'templates' && isSidebarOpen ? 'active' : ''}`}
              data-tooltip="Circuit Templates"
            >
              <Layout size={18} />
            </button>

            <button
              onClick={() => handleActivityIconClick('learning')}
              className={`activity-icon ${activeSidebarTab === 'learning' && isSidebarOpen ? 'active' : ''}`}
              data-tooltip="Learning Materials"
            >
              <GraduationCap size={18} />
            </button>
          </div>

          <div className="activity-bar-bottom">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="activity-icon"
              data-tooltip="Help & FAQ"
            >
              <HelpCircle size={18} />
            </a>
          </div>
        </nav>

        {/* Sidebar panels */}
        <aside className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
          <div className="sidebar-header">
            <span className="sidebar-title">
              {activeSidebarTab === 'files' && 'Workspace Files'}
              {activeSidebarTab === 'components' && 'Component Library'}
              {activeSidebarTab === 'copilot' && 'AI Copilot'}
              {activeSidebarTab === 'power' && 'Power Consumption'}
              {activeSidebarTab === 'datasheet' && 'Datasheet Intelligence'}
              {activeSidebarTab === 'templates' && 'Circuit Templates'}
              {activeSidebarTab === 'learning' && 'Learning Materials'}
            </span>
            <button className="panel-close-btn" onClick={() => setIsSidebarOpen(false)} data-tooltip="Collapse Panel">
              <ChevronLeft size={14} />
            </button>
          </div>

          <div className="sidebar-body">
            {activeSidebarTab === 'files' && (
              <div className="sidebar-content text-xs space-y-2">
                <div className="sidebar-files-toolbar">
                  <span className="text-slate-500 text-[10px] uppercase tracking-wide">Project Files</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleNewFile}
                      className="btn btn-icon"
                      data-tooltip="New File"
                    >
                      <FilePlus size={12} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Clear saved session and reset to blank project?')) {
                          localStorage.removeItem('xavierlabs_project');
                          resetMCU(selectedMCUModel);
                        }
                      }}
                      className="btn btn-icon"
                      data-tooltip="Clear Saved Session"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
                {files.map((file) => (
                  <div
                    key={file.name}
                    className={`sidebar-file-row ${file.isActive ? 'active' : ''}`}
                    onClick={() => {
                      if (editingFile !== file.name) {
                        setFiles(files.map(f => ({ ...f, isActive: f.name === file.name })));
                      }
                    }}
                  >
                    <FolderOpen size={13} className={file.isActive ? 'text-cyan-400' : 'text-slate-500'} />
                    {editingFile === file.name ? (
                      <input
                        type="text"
                        className="flex-1 bg-slate-800 text-xs text-white px-1 py-0.5 rounded outline-none border border-cyan-500"
                        value={renamingValue}
                        onChange={(e) => setRenamingValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (renamingValue && renamingValue !== file.name && !files.find(f => f.name === renamingValue)) {
                              setFiles(files.map(f => f.name === file.name ? { ...f, name: renamingValue } : f));
                            }
                            setEditingFile(null);
                          } else if (e.key === 'Escape') {
                            setEditingFile(null);
                          }
                        }}
                        onBlur={() => setEditingFile(null)}
                      />
                    ) : (
                      <span className="flex-1 truncate">{file.name}</span>
                    )}
                    
                    {!editingFile && (
                      <button
                        className="file-close-btn opacity-0 group-hover:opacity-100 hover:text-cyan-400 mr-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFile(file.name);
                          setRenamingValue(file.name);
                        }}
                        data-tooltip="Rename file"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}

                    {files.length > 1 && !editingFile && (
                      <button
                        className="file-close-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const remaining = files.filter(f => f.name !== file.name);
                          if (!file.isActive) {
                            setFiles(remaining);
                          } else {
                            setFiles(remaining.map((f, i) => ({ ...f, isActive: i === 0 })));
                          }
                        }}
                        data-tooltip="Close file"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeSidebarTab === 'components' && (
              <div className="sidebar-content">
                <span className="section-subtitle">Active Board Setup</span>
                
                {/* Reset current Board button card */}
                <div className="preset-card">
                  <div>
                    <span className="font-semibold block text-slate-200">
                      {selectedMCUModel === 'uno' ? 'Arduino Uno R3' : 'ESP32 DevKit'}
                    </span>
                    <span className="text-[10px] text-slate-550 block mt-0.5">Core Microcontroller Canvas</span>
                  </div>
                  <button className="btn btn-icon" onClick={() => resetMCU(selectedMCUModel)} data-tooltip="Clear sandbox & reset board">
                    <RotateCcw size={12} />
                  </button>
                </div>

                <span className="section-subtitle">Outputs & Actuators</span>
                <div className="component-grid">
                  <div
                    onClick={() => handleAddComponent('led')}
                    className="component-card"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px rgba(239,68,68,0.5))' }}>
                      <path d="M12 2a6 6 0 0 0-6 6v7h12V8a6 6 0 0 0-6-6Z"/>
                      <path d="M6 19h12"/>
                      <path d="M9 19v3"/>
                      <path d="M15 19v3"/>
                    </svg>
                    <span>Red LED</span>
                  </div>
                  <div
                    onClick={() => {
                      const newLED = createComponentPreset('led');
                      newLED.name = 'Green LED';
                      const count = components.filter(c => c.name.includes('Green')).length;
                      newLED.x += count * 20 + 50;
                      newLED.y += count * 20;
                      setComponents([...components, newLED]);
                    }}
                    className="component-card"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px rgba(16,185,129,0.5))' }}>
                      <path d="M12 2a6 6 0 0 0-6 6v7h12V8a6 6 0 0 0-6-6Z"/>
                      <path d="M6 19h12"/>
                      <path d="M9 19v3"/>
                      <path d="M15 19v3"/>
                    </svg>
                    <span>Green LED</span>
                  </div>
                </div>

                <span className="section-subtitle">Inputs & Sensors</span>
                <div className="component-grid">
                  <div
                    onClick={() => handleAddComponent('button')}
                    className="component-card"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="16" height="16" x="4" y="4" rx="2"/>
                      <circle cx="12" cy="12" r="5" fill="rgba(255,255,255,0.1)"/>
                      <circle cx="12" cy="12" r="2" fill="currentColor"/>
                      <path d="M2 12h2"/>
                      <path d="M20 12h2"/>
                    </svg>
                    <span>Push Button</span>
                  </div>
                  <div
                    onClick={() => handleAddComponent('potentiometer')}
                    className="component-card"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9"/>
                      <circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.15)"/>
                      <line x1="12" y1="12" x2="12" y2="6"/>
                    </svg>
                    <span>Potentiometer</span>
                  </div>
                  <div
                    onClick={() => handleAddComponent('dht11')}
                    className="component-card component-card-large"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="18" x="5" y="3" rx="2"/>
                      <path d="M9 7h6"/>
                      <path d="M9 11h6"/>
                      <path d="M9 15h6"/>
                      <path d="M8 21v2"/>
                      <path d="M12 21v2"/>
                      <path d="M16 21v2"/>
                    </svg>
                    <span>DHT11 Temp & Humidity Sensor</span>
                  </div>
                </div>

                <span className="section-subtitle">Passives & Structural</span>
                <div className="component-grid">
                  <div
                    onClick={() => handleAddComponent('resistor')}
                    className="component-card"
                  >
                    <svg width="22" height="8" viewBox="0 0 44 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="0" y1="8" x2="8" y2="8"/>
                      <rect x="8" y="2" width="28" height="12" rx="4" fill="rgba(255,255,255,0.05)"/>
                      <line x1="14" y1="2" x2="14" y2="14"/>
                      <line x1="22" y1="2" x2="22" y2="14"/>
                      <line x1="30" y1="2" x2="30" y2="14"/>
                      <line x1="36" y1="8" x2="44" y2="8"/>
                    </svg>
                    <span>Resistor</span>
                  </div>
                  <div
                    onClick={() => handleAddComponent('breadboard')}
                    className="component-card"
                  >
                    <svg width="22" height="10" viewBox="0 0 44 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="42" height="18" x="1" y="1" rx="2" fill="rgba(255,255,255,0.05)"/>
                      <line x1="6" y1="6" x2="38" y2="6" strokeDasharray="1,2" strokeWidth="2"/>
                      <line x1="6" y1="10" x2="38" y2="10" strokeDasharray="1,2" strokeWidth="2"/>
                      <line x1="6" y1="14" x2="38" y2="14" strokeDasharray="1,2" strokeWidth="2"/>
                    </svg>
                    <span>Breadboard</span>
                  </div>
                </div>
              </div>
            )}

            {activeSidebarTab === 'copilot' && (
              <AICopilot
                apiKey={apiKey}
                code={files.find(f => f.isActive)?.content || ''}
                components={components}
                wires={wires}
                mcuModel={selectedMCUModel}
                onOpenSettings={() => setIsSettingsOpen(true)}
                debuggerAlerts={debuggerAlerts}
              />
            )}

            {activeSidebarTab === 'power' && (
              <PowerAnalyzer
                components={components}
                mcuModel={selectedMCUModel}
                simulationState={simulationState}
              />
            )}

            {activeSidebarTab === 'datasheet' && (
              <Datasheets />
            )}

            {activeSidebarTab === 'templates' && (
              <div className="sidebar-content templates-panel">
                <p className="templates-intro">
                  Pre-built circuits with starter code. Click <strong>Load</strong> to instantly set up the sandbox and editor.
                </p>
                <div className="templates-grid">
                  {CIRCUIT_TEMPLATES.map((tmpl) => (
                    <div key={tmpl.id} className="template-card">
                      <div className="template-card-top">
                        <span className="template-icon">{tmpl.icon}</span>
                        <div className="template-meta">
                          <span className={`template-difficulty difficulty-${tmpl.difficulty.toLowerCase()}`}>
                            {tmpl.difficulty}
                          </span>
                          <span className="template-board">{tmpl.board === 'uno' ? 'Uno' : 'ESP32'}</span>
                        </div>
                      </div>
                      <h4 className="template-name">{tmpl.name}</h4>
                      <p className="template-desc">{tmpl.description}</p>
                      <div className="template-tags">
                        {tmpl.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="template-tag">{tag}</span>
                        ))}
                      </div>
                      <button
                        className="btn btn-primary template-load-btn"
                        onClick={() => {
                          if (selectedMCUModel !== tmpl.board) {
                            handleBoardChange(tmpl.board);
                          }
                          const { components: tComps, wires: tWires } = tmpl.build();
                          setComponents(tComps);
                          setWires(tWires);
                          setSimulationState({ isPlaying: false, speed: 1, logs: [], pinVoltages: {}, pinModes: {} });
                          setDebuggerAlerts([]);
                          setFiles([{ name: `${tmpl.id}.ino`, content: tmpl.starterCode, isActive: true }]);
                        }}
                      >
                        ⚡ Load Template
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSidebarTab === 'learning' && (
              <div className="sidebar-content templates-panel">
                <p className="templates-intro">
                  Tutorials for Arduino and ESP32. Click <strong>Load Code</strong> to load the tutorial sketch into your active editor file.
                </p>
                <div className="templates-grid">
                  {TUTORIALS.map((tut) => (
                    <div key={tut.id} className="template-card">
                      <div className="template-card-top">
                        <span className="template-icon">📚</span>
                        <div className="template-meta">
                          <span className={`template-difficulty difficulty-${tut.difficulty.toLowerCase()}`}>
                            {tut.difficulty}
                          </span>
                          <span className="template-board">{tut.board === 'uno' ? 'Uno' : 'ESP32'}</span>
                        </div>
                      </div>
                      <h4 className="template-name">{tut.title}</h4>
                      <p className="template-desc">{tut.description}</p>
                      
                      <div className="learning-steps-box" style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-primary)' }}>Wiring Steps:</strong>
                        <ol style={{ paddingLeft: '14px', margin: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {tut.steps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <button
                        className="btn btn-primary template-load-btn"
                        onClick={() => {
                          if (selectedMCUModel !== tut.board) {
                            handleBoardChange(tut.board);
                          }
                          // Load code into the active file
                          setFiles(files.map(f => f.isActive ? { ...f, content: tut.code } : f));
                        }}
                      >
                        ⚡ Load Code
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Central Panes */}
        <section className="workspace-panes">
          
          {/* Top Row Split Panel (Editor & Canvas) */}
          {(!closedPanes.editor || !closedPanes.canvas) && (
            <div className="top-panes">
              {!closedPanes.editor && (maximizedPane === null || maximizedPane === 'editor') && (
                <EditorPanel
                  files={files}
                  onUpdateFiles={setFiles}
                  simulationState={simulationState}
                  onStartSimulation={handleStartSimulation}
                  onStopSimulation={handleStopSimulation}
                  onResetSimulation={handleResetSimulation}
                  selectedMCUModel={selectedMCUModel}
                  layoutSwap={layoutSwap}
                  onToggleLayoutSwap={() => setLayoutSwap(!layoutSwap)}
                  isMaximized={maximizedPane === 'editor'}
                  onToggleMaximize={() => setMaximizedPane(maximizedPane === 'editor' ? null : 'editor')}
                  onClose={() => setClosedPanes(prev => ({ ...prev, editor: true }))}
                />
              )}
              
              {!closedPanes.canvas && (maximizedPane === null || maximizedPane === 'canvas') && (
                <CircuitCanvas
                  components={components}
                  wires={wires}
                  selectedComponentId={selectedComponentId}
                  activePinIdForWire={activePinIdForWire}
                  simulationState={simulationState}
                  onUpdateComponents={setComponents}
                  onUpdateWires={setWires}
                  onSelectComponent={setSelectedComponentId}
                  onSetActivePinIdForWire={setActivePinIdForWire}
                  layoutSwap={layoutSwap}
                  onToggleLayoutSwap={() => setLayoutSwap(!layoutSwap)}
                  isMaximized={maximizedPane === 'canvas'}
                  onToggleMaximize={() => setMaximizedPane(maximizedPane === 'canvas' ? null : 'canvas')}
                  onClose={() => setClosedPanes(prev => ({ ...prev, canvas: true }))}
                />
              )}
            </div>
          )}

          {/* Bottom Tabs Panel */}
          {!closedPanes.bottom && (
            <div className={`bottom-pane ${isBottomPanelOpen ? '' : 'collapsed'}`}>
              <div className="tab-headers">
                <button
                  className={`tab-header ${activeBottomTab === 'serial' && isBottomPanelOpen ? 'active' : ''}`}
                  onClick={() => handleBottomTabClick('serial')}
                >
                  <Terminal size={12} />
                  <span>Serial Monitor</span>
                </button>

                <button
                  className={`tab-header ${activeBottomTab === 'debugger' && isBottomPanelOpen ? 'active' : ''}`}
                  onClick={() => handleBottomTabClick('debugger')}
                >
                  <Bug size={12} className={debuggerAlerts.some(a => a.type === 'error') ? 'text-rose-500 animate-bounce' : ''} />
                  <span>AI Hardware Debugger</span>
                  {debuggerAlerts.length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                      debuggerAlerts.some(a => a.type === 'error') ? 'bg-rose-500 text-white' : 'bg-yellow-500 text-slate-950'
                    }`}>
                      {debuggerAlerts.length}
                    </span>
                  )}
                </button>

                <div className="tab-actions-right">
                  {activeBottomTab === 'serial' && isBottomPanelOpen && (
                    <button
                      className="btn btn-icon mr-2 text-[10px]"
                      onClick={() => setSimulationState(prev => ({ ...prev, logs: [] }))}
                      data-tooltip="Clear Serial Console"
                      style={{ padding: '2px 6px', height: '20px', display: 'flex', alignItems: 'center' }}
                    >
                      Clear
                    </button>
                  )}
                  <button
                    className="panel-toggle-btn"
                    onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
                    data-tooltip={isBottomPanelOpen ? "Collapse Panel" : "Expand Panel"}
                  >
                    {isBottomPanelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                  <button
                    className="panel-close-btn"
                    onClick={() => setClosedPanes(prev => ({ ...prev, bottom: true }))}
                    data-tooltip="Close Panel"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {isBottomPanelOpen && (
                <div className="tab-content select-text">
                  {activeBottomTab === 'serial' && (
                    <div className="space-y-1 font-mono text-[11px]">
                      {simulationState.isPlaying ? (
                        <>
                          <div className="text-slate-500">// Serial interface listening...</div>
                          {simulationState.logs.map((log, idx) => (
                            <div key={idx} className={`flex gap-3 ${
                              log.level === 'error' ? 'text-red-400 font-semibold' : log.level === 'warn' ? 'text-amber-400' : 'text-slate-300'
                            }`}>
                              <span className="text-slate-600 select-none">[{log.timestamp}]</span>
                              <span>{log.message}</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="text-slate-500 flex flex-col items-center justify-center h-24 gap-2">
                          <Terminal size={24} className="text-slate-700" />
                          <span>Serial disconnected. Click "Run Sandbox" to start microcontroller outputs.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {activeBottomTab === 'debugger' && (
                    <div className="space-y-2">
                      {debuggerAlerts.length > 0 ? (
                        debuggerAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className={`p-3 rounded border flex gap-3 items-start ${
                              alert.type === 'error'
                                ? 'bg-red-950/20 border-red-500/30 text-red-200'
                                : alert.type === 'warning'
                                ? 'bg-yellow-950/25 border-yellow-500/30 text-yellow-200'
                                : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                            }`}
                          >
                            <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${
                              alert.type === 'error' ? 'text-red-400' : alert.type === 'warning' ? 'text-yellow-400' : 'text-emerald-400'
                            }`} />
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-1.5 font-bold uppercase text-[9px] tracking-wide">
                                <span className={alert.type === 'error' ? 'text-red-400' : alert.type === 'warning' ? 'text-yellow-400' : 'text-emerald-400'}>
                                  [{alert.source}] {alert.type}
                                </span>
                              </div>
                              <p className="font-sans leading-relaxed">{alert.message}</p>
                              <button
                                onClick={() => {
                                  setActiveSidebarTab('copilot');
                                  const element = document.querySelector('.activity-icon[data-tooltip="AI Copilot"]');
                                  if (element) (element as HTMLButtonElement).click();
                                }}
                                className="text-[10px] underline font-medium hover:text-white mt-1.5 block"
                              >
                                💡 Ask AI Copilot how to fix this wiring mismatch
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 flex flex-col items-center justify-center h-24 gap-2">
                          <Bug size={24} className="text-slate-700" />
                          <span>AI Debugger clean. Run compiling simulation to check for wiring errors.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* 3. Status Bar */}
      <footer className="status-bar">
        <div className="status-item">
          <span className="status-active-pulse" style={{ backgroundColor: simulationState.isPlaying ? 'var(--color-success)' : 'var(--text-muted)' }} />
          <span>MCU: {selectedMCUModel === 'uno' ? 'Arduino Uno (ATmega328P)' : 'ESP32 (ESP-WROOM-32)'}</span>
        </div>


        <div className="status-item gap-4">
          <span>Wires: {wires.length}</span>
          <span>Components: {components.length}</span>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
}

export default App;

// Trigger CI build
