// Web Audio API Synthesizer for Piezo Buzzer tone simulation in browser

class AudioSynthService {
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isMuted: boolean = false;

  private initContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public playTone(freq: number, durationMs?: number) {
    if (this.isMuted || freq <= 0 || freq > 20000) {
      this.stopTone();
      return;
    }

    try {
      this.initContext();
      if (!this.audioCtx) return;

      if (!this.oscillator) {
        this.oscillator = this.audioCtx.createOscillator();
        this.gainNode = this.audioCtx.createGain();
        this.oscillator.type = 'square'; // Piezo buzzers produce square waves
        this.gainNode.gain.setValueAtTime(0.08, this.audioCtx.currentTime); // gentle volume
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
        this.oscillator.start();
      }

      this.oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      if (durationMs && durationMs > 0) {
        setTimeout(() => {
          this.stopTone();
        }, durationMs);
      }
    } catch {
      // Audio autoplay may be prevented before user interaction
    }
  }

  public stopTone() {
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch {
        // Ignore stop error
      }
      this.oscillator = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // Ignore disconnect error
      }
      this.gainNode = null;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) this.stopTone();
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const audioSynth = new AudioSynthService();
