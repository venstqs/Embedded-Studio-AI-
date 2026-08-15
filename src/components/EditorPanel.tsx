import React from 'react';
import { Play, Square, X, Maximize2, Minimize2 } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/themes/prism-tomorrow.css';

interface Props {
  code: string;
  setCode: (c: string) => void;
  onClose: () => void;
  mcuModel: 'uno' | 'esp32';
  onRun: () => void;
  isRunning: boolean;
  isMaximized: boolean;
  isMinimized: boolean;
  onToggleMaximize: () => void;
  onToggleMinimize: () => void;
}

const EditorPanel: React.FC<Props> = ({ code, setCode, onClose, mcuModel, onRun, isRunning, isMaximized: _isMaximized, isMinimized, onToggleMaximize, onToggleMinimize }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'F5' || (e.key === 'Enter' && e.ctrlKey)) {
      e.preventDefault();
      onRun();
    }
  };

  // Count lines for the gutter
  const lines = code.split('\n');

  if (isMinimized) {
    return (
      <div className="flex items-center justify-between h-full px-3 cursor-pointer bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors rounded-lg" onClick={onToggleMinimize}>
        <span className="text-xs font-semibold text-[var(--text-primary)]">Code Editor</span>
        <button onClick={onClose} className="p-1 rounded text-[var(--text-muted)] hover:text-white">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-primary)] rounded-lg">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex-shrink-0">
        <div className="flex items-center">
          {/* Active file tab */}
          <div className="flex items-center space-x-2 px-3 py-1 bg-[var(--bg-active)] rounded-full border border-[var(--border-color)] text-[var(--text-primary)] text-xs">
            <div className="w-2 h-2 rounded-full bg-[var(--color-cyan)]" />
            <span>main.ino</span>
            <span className="text-[var(--text-muted)] ml-2">({mcuModel === 'uno' ? 'Arduino Uno' : 'ESP32'})</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRun}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold transition-all border ${
              isRunning
                ? 'bg-transparent text-white border-white hover:bg-zinc-900'
                : 'bg-white text-black border-white hover:bg-zinc-200'
            }`}
          >
            {isRunning ? <><Square size={10} fill="currentColor" /> <span>Stop</span></> : <><Play size={10} fill="currentColor" /> <span>Run</span></>}
          </button>
          
          <div className="w-px h-4 bg-[var(--border-color)] mx-1" />

          <button onClick={onToggleMinimize} className="p-1 rounded text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors">
            <Minimize2 size={13} />
          </button>
          <button onClick={onToggleMaximize} className="p-1 rounded text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors">
            <Maximize2 size={13} />
          </button>
          <button onClick={onClose} className="p-1 rounded text-[var(--text-muted)] hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-auto flex font-mono text-sm bg-[#1d1f21]" onKeyDown={handleKeyDown}>
        {/* Code area with react-simple-code-editor */}
        <div className="flex-1 min-h-full">
          <Editor
            value={code}
            onValueChange={setCode}
            highlight={code => Prism.highlight(code, Prism.languages.cpp, 'cpp')}
            padding={16}
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 12,
              minHeight: '100%',
              backgroundColor: '#1d1f21',
            }}
            className="editor-container"
            textareaClassName="focus:outline-none"
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 bg-[var(--bg-active)] text-[var(--text-secondary)] text-[10px] border-t border-[var(--border-color)]">
        <div className="flex items-center space-x-4">
          <span>{lines.length} lines</span>
          <span>Arduino C++</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>{mcuModel === 'uno' ? 'Arduino Uno R3' : 'ESP32 DevKit v1'}</span>
          <span className={`flex items-center space-x-1 ${isRunning ? 'text-green-300' : ''}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-white opacity-50'}`} />
            {isRunning ? 'Simulation Running' : 'Ready'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
