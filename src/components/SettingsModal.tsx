import React, { useState } from 'react';
import { Eye, EyeOff, Settings, Info, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
}) => {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(keyInput);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <Settings className="modal-icon text-active" size={16} />
            <h3 className="modal-title">Workspace Settings</h3>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Google Gemini API Key</label>
            <div className="form-input-container">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="Enter Gemini API key from AI Studio..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="form-control"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="form-reveal-btn"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            
            {/* Guide on getting an API key */}
            <div className="info-guide-card">
              <Info size={14} className="info-guide-icon" />
              <div className="info-guide-content">
                <span>You can get a Gemini API Key for free to test this project. In-browser direct requests bypass server fees!</span>
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="info-guide-link"
                >
                  <span>Get Free Gemini Key in Google AI Studio</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          </div>

          <div className="about-branding-section">
            <h4 className="about-title">About XavierLabs IDE</h4>
            <div className="about-text">
              <p>Designed for STE (Science, Technology, and Engineering) students to write sketch code and simulate circuitry client-side without physical components.</p>
              <p>Created as a high-fidelity static SPA for seamless GitHub Pages deployment.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
