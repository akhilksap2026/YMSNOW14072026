const audioCtx = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.12) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

export function playSuccess() {
  playTone(880, 0.1, "sine", 0.1);
  setTimeout(() => playTone(1174, 0.15, "sine", 0.1), 100);
}

export function playCheckIn() {
  playTone(660, 0.08, "sine", 0.1);
  setTimeout(() => playTone(880, 0.08, "sine", 0.1), 80);
  setTimeout(() => playTone(1100, 0.12, "sine", 0.1), 160);
}

export function playCheckOut() {
  playTone(1100, 0.08, "sine", 0.1);
  setTimeout(() => playTone(880, 0.08, "sine", 0.1), 80);
  setTimeout(() => playTone(660, 0.12, "sine", 0.1), 160);
}

export function playMoveComplete() {
  playTone(523, 0.1, "triangle", 0.08);
  setTimeout(() => playTone(659, 0.1, "triangle", 0.08), 120);
}
