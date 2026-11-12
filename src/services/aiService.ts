import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Note, Project } from '../types';
import { PARTS } from '../parts/catalog';

export type Provider = 'gemini' | 'groq';
export interface TutorSettings { provider: Provider; geminiKey: string; groqKey: string; geminiModel: string; groqModel: string }

const DEFAULTS: TutorSettings = { provider: 'gemini', geminiKey: '', groqKey: '', geminiModel: 'gemini-2.5-flash', groqModel: 'llama-3.3-70b-versatile' };

export function loadSettings(): TutorSettings {
  const get = (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };
  return {
    provider: get('ai_provider') === 'groq' ? 'groq' : 'gemini',
    geminiKey: get('gemini_api_key'),
    groqKey: get('groq_api_key'),
    geminiModel: get('gemini_model') || DEFAULTS.geminiModel,
    groqModel: get('groq_model') || DEFAULTS.groqModel,
  };
}

export function saveSettings(s: TutorSettings) {
  try {
    localStorage.setItem('ai_provider', s.provider);
    localStorage.setItem('gemini_api_key', s.geminiKey);
    localStorage.setItem('groq_api_key', s.groqKey);
    localStorage.setItem('gemini_model', s.geminiModel);
    localStorage.setItem('groq_model', s.groqModel);
  } catch { /* storage unavailable: settings last for this visit only */ }
}

/** Describes the circuit in words so the model can reason about the wiring. */
export function describeCircuit(project: Project): string {
  const label = (r: string) => {
    const [partId, pinId] = r.split(':');
    const part = project.parts.find(p => p.id === partId);
    if (!part) return r;
    const pin = PARTS[part.type].pins.find(p => p.id === pinId);
    return part.type === 'breadboard' ? `breadboard hole ${pinId}` : `${PARTS[part.type].name} pin "${pin?.name ?? pinId}"`;
  };
  const parts = project.parts.filter(p => p.type !== 'breadboard').map(p => {
    const extra = p.type === 'resistor' ? ` (${p.props.ohms} ohms)` : p.type === 'led' ? ` (${p.props.color})` : '';
    return `- ${PARTS[p.type].name}${extra}`;
  });
  const wires = project.wires.map(w => `- ${label(w.from)} <-> ${label(w.to)}`);
  return `Parts:\n${parts.join('\n') || '- none'}\n\nWires (breadboard columns of five holes are joined; parts are also pushed into holes):\n${wires.join('\n') || '- none'}`;
}

export async function askTutor(s: TutorSettings, question: string, project: Project, notes: Note[]): Promise<string> {
  const system = `You are the XavierLabs tutor, helping high school students learn electronics and Arduino programming in a browser simulator.
Be encouraging, concrete and brief. Explain why, not only what. Prefer hints over finished answers unless asked for the answer. Use Markdown.

Their circuit:
${describeCircuit(project)}

Simulator warnings right now:
${notes.map(n => `- ${n.text}`).join('\n') || '- none'}

Their sketch:
\`\`\`cpp
${project.code}
\`\`\``;

  if (s.provider === 'gemini') {
    const model = new GoogleGenerativeAI(s.geminiKey).getGenerativeModel({ model: s.geminiModel, systemInstruction: system });
    const result = await model.generateContent(question);
    return result.response.text();
  }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: s.groqModel, messages: [{ role: 'system', content: system }, { role: 'user', content: question }], temperature: 0.5, max_tokens: 1500 }),
  });
  if (!res.ok) throw new Error(`Groq replied ${res.status}. Check the key and the model name.`);
  const data = await res.json();
  return data.choices[0].message.content;
}
