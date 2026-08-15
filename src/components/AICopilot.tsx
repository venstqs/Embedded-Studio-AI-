import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Trash2, Loader2, Key } from 'lucide-react';
import { askGemini, getMockResponse } from '../services/geminiService';
import type { Component, Wire } from '../types/circuit';

interface Props {
  code: string;
  components: Component[];
  wires: Wire[];
  mcuModel: 'uno' | 'esp32';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Simple markdown-to-JSX renderer
const renderMarkdown = (text: string) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let codeBlock: string[] = [];
  let inCode = false;
  let codelang = '';

  const renderInline = (line: string, key: string | number) => {
    // Bold
    let parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-[#2d2d2d] text-[#e06c75] px-1 py-0.5 rounded font-mono text-xs">{part.slice(1, -1)}</code>;
          }
          return part;
        })}
      </span>
    );
  };

  lines.forEach((line, idx) => {
    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeBlock = [];
        codelang = line.slice(3).trim();
      } else {
        inCode = false;
        elements.push(
          <div key={`code-${idx}`} className="my-2 rounded-lg overflow-hidden border border-[#3d3d3d]">
            <div className="bg-[#2d2d2d] px-3 py-1 text-xs text-[#888] font-mono flex justify-between">
              <span>{codelang || 'code'}</span>
            </div>
            <pre className="bg-[#1e1e1e] p-3 text-xs font-mono text-[#d4d4d4] overflow-x-auto">
              <code>{codeBlock.join('\n')}</code>
            </pre>
          </div>
        );
        codeBlock = [];
      }
      return;
    }
    if (inCode) { codeBlock.push(line); return; }

    if (line.startsWith('### ')) {
      elements.push(<h3 key={idx} className="text-sm font-bold text-[var(--color-cyan)] mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={idx} className="text-base font-bold text-white mt-3 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={idx} className="text-lg font-bold text-white mt-3 mb-1">{line.slice(2)}</h1>);
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={idx} className="border-l-2 border-[var(--color-amber)] pl-3 my-1 text-[var(--color-amber)] text-xs">
          {renderInline(line.slice(2), idx)}
        </blockquote>
      );
    } else if (line.match(/^[-*] /)) {
      elements.push(
        <div key={idx} className="flex items-start my-0.5 text-xs">
          <span className="text-[var(--color-cyan)] mr-2 mt-0.5">•</span>
          <span>{renderInline(line.slice(2), idx)}</span>
        </div>
      );
    } else if (line.match(/^\d+\. /)) {
      const match = line.match(/^(\d+)\. (.*)/);
      if (match) {
        elements.push(
          <div key={idx} className="flex items-start my-0.5 text-xs">
            <span className="text-[var(--color-amber)] mr-2 min-w-[16px]">{match[1]}.</span>
            <span>{renderInline(match[2], idx)}</span>
          </div>
        );
      }
    } else if (line.trim() === '') {
      elements.push(<div key={idx} className="h-1" />);
    } else {
      elements.push(<p key={idx} className="text-xs leading-relaxed">{renderInline(line, idx)}</p>);
    }
  });

  return elements;
};

const SUGGESTIONS = [
  'How do I wire an LED to the Arduino?',
  'Debug my circuit for errors',
  'Explain how PWM works',
  'Generate blink code for D13',
];

const AICopilot: React.FC<Props> = ({ code, components, wires, mcuModel }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I'm your **Embedded Studio AI Copilot** ✦\n\nI can analyze your circuit and code in real-time. Ask me anything about your schematic, firmware, or embedded electronics!\n\n*Tip: Add your Gemini API Key in Settings for full AI power.*`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem('gemini_api_key'));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');

    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const apiKey = localStorage.getItem('gemini_api_key') || '';
      let response: string;
      if (apiKey) {
        response = await askGemini(apiKey, userMsg, code, components, wires, mcuModel);
      } else {
        await new Promise(r => setTimeout(r, 600));
        response = getMockResponse(userMsg, code, components, wires);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `**Error**: ${err.message || 'Failed to get AI response. Check your API key.'}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded bg-[var(--bg-active)] border border-[var(--border-color)] flex items-center justify-center">
            <Bot size={14} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">AI Copilot</h2>
            <p className="text-[10px] text-[var(--text-muted)]">{hasApiKey ? 'Gemini Flash · Active' : 'Demo Mode'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!hasApiKey && (
            <div className="flex items-center space-x-1 text-[10px] text-[var(--text-muted)] bg-[var(--bg-active)] px-2 py-1 rounded border border-[var(--border-color)]">
              <Key size={10} />
              <span>No API Key</span>
            </div>
          )}
          <button onClick={() => setMessages([messages[0]])}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--color-red)] hover:bg-red-900 hover:bg-opacity-30 transition-colors"
            title="Clear History">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded bg-[var(--bg-active)] border border-[var(--border-color)] flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                <Bot size={12} className="text-[var(--text-primary)]" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-[var(--bg-active)] text-white text-xs border border-[var(--border-color)]'
                : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)]'
            }`}>
              {msg.role === 'assistant'
                ? <div className="space-y-1">{renderMarkdown(msg.content)}</div>
                : <p className="text-xs">{msg.content}</p>
              }
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded bg-[var(--bg-active)] border border-[var(--border-color)] flex items-center justify-center mr-2">
              <Bot size={12} className="text-[var(--text-primary)]" />
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2">
              <Loader2 size={14} className="text-[var(--text-muted)] animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => setInput(s)}
              className="text-[10px] px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-active)] transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-[var(--border-color)] flex-shrink-0">
        <div className="flex items-center space-x-2 bg-[var(--bg-active)] rounded border border-[var(--border-color)] focus-within:border-[var(--text-muted)] transition-all px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about your circuit..."
            className="flex-1 bg-transparent text-[var(--text-primary)] text-xs outline-none placeholder-[var(--text-muted)]"
          />
          <button onClick={sendMessage} disabled={!input.trim() || isLoading}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICopilot;
