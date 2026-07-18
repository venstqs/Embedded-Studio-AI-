import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Key, AlertCircle } from 'lucide-react';
import { askGemini, getMockResponse } from '../services/geminiService';
import type { Component, Wire } from '../types/circuit';

interface Message {
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

interface AICopilotProps {
  apiKey: string;
  code: string;
  components: Component[];
  wires: Wire[];
  mcuModel: 'uno' | 'esp32';
  onOpenSettings: () => void;
  debuggerAlerts: Array<{ id: string; type: 'warning' | 'error' | 'success'; message: string; source: 'schematic' | 'code' }>;
}

export const AICopilot: React.FC<AICopilotProps> = ({
  apiKey,
  code,
  components,
  wires,
  mcuModel,
  onOpenSettings,
  debuggerAlerts,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: `Welcome to **Embedded Studio AI**! 🤖⚡

I can help you build your circuit, write Arduino C++ code, and debug wiring errors. 

Ask me a question or try one of the instant diagnostic checks below:`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      let reply = '';
      if (apiKey.trim()) {
        reply = await askGemini(apiKey, textToSend, code, components, wires, mcuModel);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        reply = getMockResponse(textToSend, code, components, wires);
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: reply,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      const errMsg = (err.message || '').toString();
      let helpfulTip = '';
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('key is invalid')) {
        helpfulTip = '\n\n> [!IMPORTANT]\n> **API Key Invalid:** Please check that you copied the key correctly from Google AI Studio. It usually starts with `AIzaSy...`';
      } else if (errMsg.includes('CORS') || errMsg.includes('fetch') || errMsg.includes('Failed to fetch')) {
        helpfulTip = '\n\n> [!WARNING]\n> **Network / CORS Issue:** Your browser was unable to reach the Google API endpoint. Verify your internet connection or check if a browser extension is blocking `generativelanguage.googleapis.com`.';
      } else if (errMsg.includes('blocked') || errMsg.includes('limit')) {
        helpfulTip = '\n\n> [!CAUTION]\n> **Blocked / Rate Limited:** Your API key has been restricted or has hit its rate limit. Double check your API usage console.';
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ **Error calling Gemini API**: ${err.message || 'Unknown network error.'}${helpfulTip}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanBugs = () => {
    if (debuggerAlerts.length === 0) {
      handleSendMessage("Analyze my schematic and code. Are there any hardware or firmware bugs?");
    } else {
      const bugList = debuggerAlerts.map(b => `- [${b.source.toUpperCase()}] ${b.message}`).join('\n');
      handleSendMessage(`I have these active debugger alerts in my workspace:\n${bugList}\n\nCan you explain these issues and tell me how to resolve them?`);
    }
  };

  return (
    <div className="copilot-container">

      {/* Warning message if API Key is not configured */}
      {!apiKey && (
        <div className="copilot-warning-card">
          <AlertCircle size={14} className="warning-icon" />
          <div className="warning-content">
            <span className="warning-text">Running in **Local Simulation Mode**. Set API key for full AI capabilities.</span>
            <button
              onClick={onOpenSettings}
              className="warning-link-btn"
            >
              <Key size={10} />
              <span>Configure Key</span>
            </button>
          </div>
        </div>
      )}

      {/* Message logs */}
      <div className="messages-list">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message-bubble-wrapper ${msg.sender === 'user' ? 'user' : 'ai'}`}
          >
            <div className={`message-avatar ${msg.sender === 'user' ? 'user' : 'ai'}`}>
              {msg.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={`message-bubble ${msg.sender === 'user' ? 'user' : 'ai'}`}>
              <div className="message-text">
                {msg.text.split('\n\n').map((para, pi) => {
                  // Format code blocks
                  if (para.startsWith('```')) {
                    const lines = para.split('\n');
                    const cleanCode = lines.slice(1, -1).join('\n');
                    return (
                      <pre key={pi} className="code-block">
                        <code>{cleanCode}</code>
                      </pre>
                    );
                  }
                  
                  // Format warnings/alerts
                  if (para.startsWith('> [!')) {
                    const lines = para.split('\n');
                    const title = lines[0].replace('> [!', '').replace(']', '');
                    const content = lines.slice(1).map(l => l.replace('> ', '')).join('\n');
                    return (
                      <div key={pi} className="block-warning">
                        <strong className="block-warning-title">{title}</strong>
                        <span className="block-warning-text">{content}</span>
                      </div>
                    );
                  }

                  // Standard paragraphs (convert simple markdown lists and bold text)
                  return (
                    <p key={pi} className="para-text">
                      {para.split('**').map((chunk, ci) => {
                        if (ci % 2 === 1) return <strong key={ci} className="text-bold">{chunk}</strong>;
                        
                        // Parse inline code blocks `code`
                        return chunk.split('`').map((inlineChunk, ii) => {
                          if (ii % 2 === 1) return <code key={ii} className="inline-code">{inlineChunk}</code>;
                          return inlineChunk;
                        });
                      })}
                    </p>
                  );
                })}
              </div>
              <span className="message-time">{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message-bubble-wrapper ai">
            <div className="message-avatar ai animate-pulse">
              <Bot size={14} />
            </div>
            <div className="message-bubble ai loading">
              <span className="loading-dot" style={{ animationDelay: '0ms' }} />
              <span className="loading-dot" style={{ animationDelay: '150ms' }} />
              <span className="loading-dot" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts / shortcuts */}
      <div className="prompt-shortcuts">
        <button
          onClick={handleScanBugs}
          className="prompt-shortcut-btn check"
        >
          🔍 Scan Schematic & Code
        </button>
        <button
          onClick={() => handleSendMessage("How do I wire an LED with a resistor to my board?")}
          className="prompt-shortcut-btn"
        >
          💡 Wire LED
        </button>
        <button
          onClick={() => handleSendMessage("How do I read analog voltage from a Potentiometer?")}
          className="prompt-shortcut-btn"
        >
          🎛️ Read Pot
        </button>
      </div>

      {/* Message input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputValue);
        }}
        className="message-form"
      >
        <input
          type="text"
          placeholder="Ask AI Copilot..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="message-input"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className="message-submit-btn"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
