import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Minimal WebAudio stand-in whose clock only moves when the test says so. */
class FakeOscillator {
  type = '';
  readonly frequency = { value: 0 };
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  connect(): void {}
  disconnect(): void {}
  start(t: number): void {
    this.startedAt = t;
  }
  stop(t = 0): void {
    this.stoppedAt = t;
  }
}

class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  currentTime = 0;
  state = 'running';
  readonly destination = {};
  readonly oscillators: FakeOscillator[] = [];
  constructor() {
    FakeAudioContext.last = this;
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  createOscillator(): FakeOscillator {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    return { gain: { value: 0 }, connect() {}, disconnect() {} };
  }
}

async function loadAudio() {
  vi.resetModules();
  return import('../../src/platform/audio');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PC Speaker without WebAudio', () => {
  it('tells "no audio" apart from a frequency out of range', async () => {
    const { beep } = await loadAudio();
    expect(beep(440, 100)).toBe('no-audio');
    expect(beep(5, 100)).toBe('out-of-range');
    expect(beep(40000, 100)).toBe('out-of-range');
  });
});

describe('PC Speaker with WebAudio', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  it('plays consecutive notes one after another, not as a chord', async () => {
    const { beep } = await loadAudio();
    expect(beep(523, 500)).toBe('ok');
    expect(beep(587, 500)).toBe('ok');
    expect(beep(659, 500)).toBe('ok');
    const oscs = FakeAudioContext.last!.oscillators;
    expect(oscs.map((o) => o.startedAt)).toEqual([0, 0.5, 1]);
    expect(oscs.map((o) => o.stoppedAt)).toEqual([0.5, 1, 1.5]);
  });

  it('a note asked for after the queue has played starts at once', async () => {
    const { beep } = await loadAudio();
    beep(523, 500);
    FakeAudioContext.last!.currentTime = 2;
    beep(587, 500);
    expect(FakeAudioContext.last!.oscillators.map((o) => o.startedAt)).toEqual([0, 2]);
  });

  it('a loop of OUT 13 does not queue more than 10 s of sound', async () => {
    const { beep } = await loadAudio();
    const results = Array.from({ length: 10000 }, () => beep(440, 1000));
    expect(FakeAudioContext.last!.oscillators.length).toBeLessThanOrEqual(11);
    expect(results.filter((r) => r === 'ok').length).toBe(FakeAudioContext.last!.oscillators.length);
  });

  it('silenceSpeaker stops the queued notes and the next one starts now', async () => {
    const { beep, silenceSpeaker } = await loadAudio();
    beep(523, 1000);
    beep(587, 1000);
    const ctx = FakeAudioContext.last!;
    ctx.currentTime = 0.2;
    silenceSpeaker();
    expect(ctx.oscillators.map((o) => o.stoppedAt)).toEqual([0.2, 0.2]);
    beep(659, 1000);
    expect(ctx.oscillators[2].startedAt).toBe(0.2);
  });
});
