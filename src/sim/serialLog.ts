/**
 * The serial monitor's history as lines, each stamped with the simulated time
 * it started. Lines the user sent are kept too (tx) so they can be echoed.
 */
export interface SerialLine { t: number; s: string; tx?: boolean }
export interface SerialLog { lines: SerialLine[]; open: boolean }

export const EMPTY_LOG: SerialLog = { lines: [], open: false };
const MAX_LINES = 2000;

export function appendSerial(log: SerialLog, text: string, t: number, tx = false): SerialLog {
  if (!text) return log;
  const lines = log.lines.slice();
  if (tx) {
    lines.push({ t, s: text.replace(/[\r\n]+$/, ''), tx: true });
    return { lines: lines.slice(-MAX_LINES), open: false };
  }
  const parts = text.replace(/\r\n?/g, '\n').split('\n');
  let open = log.open;
  parts.forEach((p, i) => {
    if (i === 0 && open && lines.length) lines[lines.length - 1] = { ...lines[lines.length - 1], s: lines[lines.length - 1].s + p };
    else if (i < parts.length - 1 || p) lines.push({ t, s: p });
    open = i === parts.length - 1 ? p !== '' : open;
  });
  return { lines: lines.slice(-MAX_LINES), open };
}

/** Lines the board printed (not echoes), as plain text. */
export const received = (log: SerialLog) => log.lines.filter(l => !l.tx);

/** Simulated time as Arduino IDE style mm:ss.mmm. */
export function stamp(ms: number) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), r = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
}

const JUNK = '⸮ÿþ¿¡±§¤ÆÐ×øð¦¬';
/**
 * What text looks like when the monitor's baud rate does not match the
 * sketch's: the same bytes read at the wrong speed come out as junk.
 */
export function garble(s: string, ratio: number) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const k = (c * 31 + i * 7 + Math.round(ratio * 13)) % (JUNK.length + 6);
    if (k < JUNK.length) out += JUNK[k];
    else if (i % 3 === 0) out += String.fromCharCode(0x40 + (c % 26));
  }
  return out;
}

export const hex = (s: string) => [...new TextEncoder().encode(s)].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
