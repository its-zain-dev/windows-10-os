/* ==========================================================================
   Authentic Windows 10 System Sound Synthesizer (Web Audio API)
   ========================================================================== */

let audioCtx = null;
let currentVolume = 0.72;
let isMuted = false;

function getCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setSoundVolume(volPercent, muted) {
  currentVolume = Math.max(0, Math.min(1, volPercent / 100));
  isMuted = !!muted;
}

function playTone(freq, startOffset, duration, gainVal = 0.14, type = 'sine') {
  if (isMuted || currentVolume <= 0) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainVal * currentVolume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export const Sound = {
  startup() {
    // Soft Windows 10 harmonic logon chord
    playTone(523.25, 0.00, 0.55, 0.12, 'sine');
    playTone(659.25, 0.08, 0.55, 0.10, 'sine');
    playTone(783.99, 0.16, 0.65, 0.10, 'sine');
    playTone(1046.5, 0.24, 0.75, 0.08, 'triangle');
  },
  notify() {
    // Classic Win10 two-note crystalline chime
    playTone(880, 0.00, 0.18, 0.11, 'sine');
    playTone(1318.5, 0.09, 0.34, 0.11, 'sine');
  },
  error() {
    // Windows Critical Stop low chord
    playTone(220, 0.00, 0.22, 0.14, 'triangle');
    playTone(196, 0.06, 0.28, 0.13, 'triangle');
  },
  exclamation() {
    playTone(587.33, 0.00, 0.14, 0.10, 'sine');
    playTone(440, 0.09, 0.22, 0.10, 'sine');
  },
  volumeTick() {
    playTone(740, 0.00, 0.07, 0.09, 'sine');
  },
  recycle() {
    playTone(420, 0.00, 0.06, 0.07, 'triangle');
    playTone(280, 0.05, 0.09, 0.07, 'triangle');
  }
};
