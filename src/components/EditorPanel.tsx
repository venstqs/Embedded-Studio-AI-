import React, { useRef, useEffect, useState } from 'react';
import { FileCode, Play, RotateCcw, Code, Columns, Maximize2, Minimize2, X } from 'lucide-react';
import type { ProjectFile, SimulationState } from '../types/circuit';

interface EditorPanelProps {
  files: ProjectFile[];
  onUpdateFiles: (files: ProjectFile[]) => void;
  simulationState: SimulationState;
  onStartSimulation: () => void;
  onStopSimulation: () => void;
  onResetSimulation: () => void;
  selectedMCUModel: 'uno' | 'esp32';
  
  // Layout Controls
  layoutSwap: boolean;
  onToggleLayoutSwap: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  files,
  onUpdateFiles,
  simulationState,
  onStartSimulation,
  onStopSimulation,
  onResetSimulation,
  selectedMCUModel,
  layoutSwap,
  onToggleLayoutSwap,
  isMaximized,
  onToggleMaximize,
  onClose,
}) => {
  const activeFile = files.find((f) => f.isActive) || files[0];
  const [lineCount, setLineCount] = useState(1);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);

  // Sync line numbers count
  useEffect(() => {
    if (activeFile) {
      const lines = activeFile.content.split('\n').length;
      setLineCount(Math.max(1, lines));
    }
  }, [activeFile?.content]);

  // Sync scrollbars
  const handleScroll = () => {
    if (textareaRef.current) {
      const scrollTop = textareaRef.current.scrollTop;
      const scrollLeft = textareaRef.current.scrollLeft;

      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = scrollTop;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = scrollTop;
        highlightRef.current.scrollLeft = scrollLeft;
      }
    }
  };

  const handleContentChange = (val: string) => {
    onUpdateFiles(
      files.map((f) => (f.name === activeFile.name ? { ...f, content: val } : f))
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const val = e.currentTarget.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      handleContentChange(newVal);
      
      // Reset cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const selectFile = (fileName: string) => {
    onUpdateFiles(
      files.map((f) => ({ ...f, isActive: f.name === fileName }))
    );
  };

  // Drag & Drop reordering handlers
  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    
    const updated = [...files];
    const [draggedFile] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, draggedFile);
    
    onUpdateFiles(updated);
    setDraggedIdx(null);
  };

  // Simple Arduino syntax highlighter
  const highlightArduinoCode = (codeText: string) => {
    // 1. Escape HTML
    let html = codeText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Placeholders map to avoid highlighting keywords inside comments or strings
    const placeholders: string[] = [];
    const pushPlaceholder = (val: string) => {
      const id = `___PLACEHOLDER_${placeholders.length}___`;
      placeholders.push(val);
      return id;
    };

    // 2. Hide comments (single line and multi line)
    html = html.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, (match) => {
      return pushPlaceholder(`<span class="code-comment">${match}</span>`);
    });

    // 3. Hide strings
    html = html.replace(/"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'/g, (match) => {
      return pushPlaceholder(`<span class="code-string">${match}</span>`);
    });

    // 4. Highlight keywords (Arduino & C++ style: Teal #00979C)
    const keywords = /\b(void|int|const|char|float|double|bool|boolean|string|long|unsigned|if|else|return|switch|case|break|setup|loop|INPUT|OUTPUT|INPUT_PULLUP|HIGH|LOW)\b/g;
    html = html.replace(keywords, '<span class="code-keyword">$1</span>');

    // 5. Highlight functions & classes (built-ins: Orange #D35400)
    const functions = /\b(pinMode|digitalWrite|digitalRead|analogRead|analogWrite|delay|millis|Serial|begin|print|println|available|read|write)\b/g;
    html = html.replace(functions, '<span class="code-function">$1</span>');

    // 6. Highlight numeric literals
    html = html.replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>');

    // 7. Restore comments and strings from placeholders
    for (let i = placeholders.length - 1; i >= 0; i--) {
      html = html.replace(`___PLACEHOLDER_${i}___`, placeholders[i]);
    }

    return { __html: html + '\n' }; // trailing newline allows scrolling alignment
  };

  return (
    <div className="editor-pane" style={{ order: layoutSwap ? 2 : 1 }}>
      {/* Editor Tabs & Control Row */}
      <div className="pane-header">
        <div className="editor-tabs">
          {files.map((file, idx) => (
            <div
              key={file.name}
              onClick={() => selectFile(file.name)}
              className={`editor-tab ${file.isActive ? 'active' : ''}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
            >
              <FileCode size={12} className={file.isActive ? 'icon-active' : 'icon-muted'} />
              <span>{file.name}</span>
            </div>
          ))}
        </div>

        {/* Compile / Simulation Buttons */}
        <div className="editor-controls">
          {!simulationState.isPlaying ? (
            <button
              className="btn btn-success"
              onClick={onStartSimulation}
              data-tooltip="Compile and Run"
            >
              <Play size={12} fill="currentColor" />
              <span>Run Sandbox</span>
            </button>
          ) : (
            <button
              className="btn btn-danger"
              onClick={onStopSimulation}
              data-tooltip="Stop Simulation"
            >
              <span className="pulse-dot" />
              <span>Stop</span>
            </button>
          )}

          <button
            className="btn btn-icon"
            onClick={onResetSimulation}
            data-tooltip="Reset MCU"
          >
            <RotateCcw size={12} />
          </button>

          <div className="pane-divider" style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

          <button className="panel-toggle-btn" onClick={onToggleLayoutSwap} data-tooltip="Swap Panel Left/Right">
            <Columns size={12} />
          </button>
          <button className="panel-toggle-btn" onClick={onToggleMaximize} data-tooltip={isMaximized ? "Restore Layout" : "Maximize Panel"}>
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button className="panel-close-btn" onClick={onClose} data-tooltip="Close Panel">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Main text editor box */}
      <div className="editor-container">
        {/* Line Numbers column */}
        <div
          ref={lineNumbersRef}
          className="line-numbers"
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Layered Highlighter Output */}
        <pre
          ref={highlightRef}
          className="code-highlight-layer"
          aria-hidden="true"
        >
          <code dangerouslySetInnerHTML={highlightArduinoCode(activeFile?.content || '')} />
        </pre>

        {/* Text Area Input */}
        <textarea
          ref={textareaRef}
          className="code-textarea transparent-text"
          value={activeFile?.content || ''}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          placeholder="// Enter your firmware code here..."
        />
        
        {/* Compiler active overlay */}
        {simulationState.isPlaying && (
          <div className="simulation-overlay">
            <Code size={10} className="pulse-icon" />
            <span>Simulating: {selectedMCUModel === 'uno' ? 'Uno R3' : 'ESP32'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
