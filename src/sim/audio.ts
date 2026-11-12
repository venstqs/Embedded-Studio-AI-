/** One square-wave voice for the piezo buzzer. */
let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;
let current = 0;

/** Call from a click handler so the browser allows sound. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    if (!osc) {
      osc = ctx.createOscillator();
      gain = ctx.createGain();
      osc.type = 'square';
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
    }
  } catch { /* no audio device: the buzzer stays silent */ }
}

export function setBuzzer(hz: number) {
  if (!ctx || !osc || !gain || hz === current) return;
  current = hz;
  const t = ctx.currentTime;
  if (hz > 0) osc.frequency.setValueAtTime(hz, t);
  gain.gain.setTargetAtTime(hz > 0 ? 0.045 : 0, t, 0.004);
}
