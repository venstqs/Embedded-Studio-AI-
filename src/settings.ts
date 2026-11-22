import { useSyncExternalStore } from 'react';

/**
 * Preferences for the whole IDE, saved in this browser. Any component can
 * read them with useSettings() and change them with setSettings(); every
 * reader updates at once.
 */

export type CodeTheme = 'xavier' | 'arduino' | 'midnight' | 'paper' | 'contrast';
export type LineEnding = 'none' | 'nl' | 'cr' | 'both';

export interface Settings {
  editor: {
    fontSize: number;
    tabSize: 2 | 4;
    wrap: boolean;
    lineNumbers: boolean;
    theme: CodeTheme;
    autoClose: boolean;
  };
  serial: {
    baud: number;
    lineEnding: LineEnding;
    timestamps: boolean;
    autoscroll: boolean;
    echo: boolean;
    view: 'text' | 'hex';
  };
  sim: { speed: number };
  ui: { density: 'comfortable' | 'compact'; motion: boolean };
}

export const DEFAULTS: Settings = {
  editor: { fontSize: 13, tabSize: 2, wrap: false, lineNumbers: true, theme: 'xavier', autoClose: true },
  serial: { baud: 9600, lineEnding: 'nl', timestamps: false, autoscroll: true, echo: true, view: 'text' },
  sim: { speed: 1 },
  ui: { density: 'comfortable', motion: true },
};

export const BAUDS = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200];
export const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4];
export const CODE_THEMES: { id: CodeTheme; name: string; swatch: [string, string, string] }[] = [
  { id: 'xavier', name: 'XavierLabs', swatch: ['#0b0b0d', '#fafafa', '#9fd8b4'] },
  { id: 'arduino', name: 'Arduino', swatch: ['#1f272a', '#00979c', '#d35400'] },
  { id: 'midnight', name: 'Midnight', swatch: ['#0d1117', '#ff7b72', '#a5d6ff'] },
  { id: 'paper', name: 'Paper', swatch: ['#fbfaf7', '#1b1b1b', '#0f7b45'] },
  { id: 'contrast', name: 'High contrast', swatch: ['#000000', '#ffffff', '#ffd400'] },
];

const KEY = 'xavierlabs_settings';
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      editor: { ...DEFAULTS.editor, ...raw.editor },
      serial: { ...DEFAULTS.serial, ...raw.serial },
      sim: { ...DEFAULTS.sim, ...raw.sim },
      ui: { ...DEFAULTS.ui, ...raw.ui },
    };
  } catch { return DEFAULTS; }
}

let current = load();

function apply(s: Settings) {
  const root = document.documentElement;
  root.dataset.density = s.ui.density;
  root.dataset.motion = s.ui.motion ? 'on' : 'off';
  root.dataset.codeTheme = s.editor.theme;
}
apply(current);

/** Change some settings. Pass a section and the fields to change. */
export function setSettings<K extends keyof Settings>(section: K, patch: Partial<Settings[K]>) {
  current = { ...current, [section]: { ...current[section], ...patch } };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  apply(current);
  listeners.forEach(l => l());
}

export function resetSettings() {
  current = DEFAULTS;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  apply(current);
  listeners.forEach(l => l());
}

export const getSettings = () => current;

export function useSettings(): Settings {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => current);
}

/** The baud rate a sketch opens the serial port at, from Serial.begin(...). */
export function sketchBaud(code: string): number | null {
  const m = code.replace(/\/\/.*$/gm, '').match(/Serial\s*\.\s*begin\s*\(\s*(\d+)/);
  return m ? +m[1] : null;
}
