/** PC Speaker (port 13): a square-wave beep through WebAudio. */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const SPEAKER_MIN_HZ = 7;
export const SPEAKER_MAX_HZ = 32767;
/** Longest stretch of sound queued ahead of the audio clock, in seconds; later notes are dropped. */
const MAX_QUEUE_S = 10;

/** Audio time at which the last queued note ends: the speaker plays one note at a time. */
let queueEnd = 0;
const pending = new Set<OscillatorNode>();

export type BeepResult = 'ok' | 'out-of-range' | 'no-audio' | 'queue-full';

/** Returns true when `hz` is a frequency the speaker can play. */
export function isSpeakerFrequency(hz: number): boolean {
  return hz >= SPEAKER_MIN_HZ && hz <= SPEAKER_MAX_HZ;
}

/** Plays `hz` for `ms` milliseconds after the notes already queued. */
export function beep(hz: number, ms: number): BeepResult {
  if (!isSpeakerFrequency(hz)) return 'out-of-range';
  const c = context();
  if (!c) return 'no-audio';
  const start = Math.max(c.currentTime, queueEnd);
  if (start - c.currentTime >= MAX_QUEUE_S) return 'queue-full';
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = hz;
  gain.gain.value = 0.08;
  osc.connect(gain);
  gain.connect(c.destination);
  const duration = Math.max(0.01, Math.min(10, ms / 1000));
  osc.start(start);
  osc.stop(start + duration);
  queueEnd = start + duration;
  pending.add(osc);
  osc.onended = () => {
    pending.delete(osc);
    osc.disconnect();
    gain.disconnect();
  };
  return 'ok';
}

/** Cuts the note playing and the queued ones (the simulation was stopped or replaced). */
export function silenceSpeaker(): void {
  queueEnd = 0;
  if (!ctx) return;
  for (const osc of pending) osc.stop(ctx.currentTime);
  pending.clear();
}
