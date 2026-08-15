import React, { useState, useEffect } from 'react';
import DraggableWindow from './DraggableWindow';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  zIndex: number;
  onFocus: () => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const [provider, setProvider] = useState<'gemini' | 'groq'>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setProvider((localStorage.getItem('ai_provider') as 'gemini' | 'groq') || 'gemini');
      setGeminiKey(localStorage.getItem('gemini_api_key') || '');
      setGroqKey(localStorage.getItem('groq_api_key') || '');
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('groq_api_key', groqKey);
    onClose();
  };

  return (
    <DraggableWindow 
      title="Settings" 
      isOpen={isOpen} 
      onClose={onClose} 
      width={450} 
      height={380}
      initialX={window.innerWidth / 2 - 225}
      initialY={window.innerHeight / 2 - 190}
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="p-6">
        <h3 className="text-sm font-semibold mb-4 text-white">AI Copilot Configuration</h3>
        
        <div className="mb-4">
          <label className="block text-xs text-[var(--text-secondary)] mb-2 uppercase tracking-wider">AI Provider</label>
          <select 
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'gemini' | 'groq')}
            className="w-full bg-[var(--bg-active)] border border-[var(--border-color)] rounded px-3 py-2 text-white text-sm outline-none focus:border-[var(--border-active)] transition-colors"
          >
            <option value="gemini">Google Gemini</option>
            <option value="groq">Groq (Llama 3)</option>
          </select>
        </div>

        {provider === 'gemini' ? (
          <div className="mb-4">
            <label className="block text-xs text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Google Gemini API Key</label>
            <input 
              type="password" 
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-[var(--bg-active)] border border-[var(--border-color)] rounded px-3 py-2 text-white text-sm outline-none focus:border-[var(--border-active)] transition-colors"
            />
            <p className="text-xs text-[var(--text-muted)] mt-2">Get a key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.</p>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-xs text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Groq API Key</label>
            <input 
              type="password" 
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full bg-[var(--bg-active)] border border-[var(--border-color)] rounded px-3 py-2 text-white text-sm outline-none focus:border-[var(--border-active)] transition-colors"
            />
            <p className="text-xs text-[var(--text-muted)] mt-2">Get a key from <a href="https://console.groq.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Groq Console</a>.</p>
          </div>
        )}
        
        <div className="text-xs text-[var(--text-muted)] mb-6">
          <p className="mb-2">Your API keys are stored locally in your browser's localStorage.</p>
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
