import React, { useState, useEffect } from 'react';
import DraggableWindow from './DraggableWindow';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  zIndex: number;
  onFocus: () => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem('gemini_api_key') || '');
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    onClose();
  };

  return (
    <DraggableWindow 
      title="Settings" 
      isOpen={isOpen} 
      onClose={onClose} 
      width={450} 
      height={280}
      initialX={window.innerWidth / 2 - 225}
      initialY={window.innerHeight / 2 - 140}
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="p-6">
        <h3 className="text-sm font-semibold mb-4 text-white">AI Copilot Configuration</h3>
        
        <div className="mb-4">
          <label className="block text-xs text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Google Gemini API Key</label>
          <input 
            type="password" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-[var(--bg-active)] border border-[var(--border-color)] rounded px-3 py-2 text-white text-sm outline-none focus:border-[var(--border-active)] transition-colors"
          />
        </div>
        
        <div className="text-xs text-[var(--text-muted)] mb-6">
          <p className="mb-2">The API key is stored locally in your browser's localStorage.</p>
          <p>Get a key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a> to unlock advanced circuit analysis and code generation.</p>
        </div>

        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-1.5 rounded text-sm text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary px-4 py-1.5 text-sm">
            Save & Close
          </button>
        </div>
      </div>
    </DraggableWindow>
  );
};

export default SettingsModal;
