import type { Clock, Devices, Keyboard, KeyboardMode, Ports, Screen } from './types';

/** Keyboard fed from a queue of values; used by the tests. */
export class ScriptedKeyboard implements Keyboard {
  readonly queue: number[];
  readonly requests: { prompt: string; mode: KeyboardMode }[] = [];

  constructor(values: readonly number[] = []) {
    this.queue = [...values];
  }

  read(prompt: string, mode: KeyboardMode): Promise<number> {
    this.requests.push({ prompt, mode });
    if (this.queue.length === 0) {
      return Promise.reject(new Error(`Sin entradas programadas para: ${prompt}`));
    }
    return Promise.resolve(this.queue.shift() as number);
  }
}

/** Screen that accumulates the monitor lines. */
export class BufferScreen implements Screen {
  readonly lines: string[] = [];
  last: { decimal: string; binary: string } | null = null;

  write(line: string): void {
    this.lines.push(line);
  }

  setLastValue(decimal: string, binary: string): void {
    this.last = { decimal, binary };
  }
}

/** Port 9 (switches) and port 13 (PC speaker) with in-memory state. */
export class SimplePorts implements Ports {
  switches = 0;
  readonly beeps: { hz: number; ms: number }[] = [];
  onBeep: ((hz: number, ms: number) => void) | null = null;

  in(port: number): number | undefined {
    return port === 9 ? this.switches & 0xffff : undefined;
  }

  out(port: number, value: number, bx: number): boolean {
    if (port === 13) {
      this.beeps.push({ hz: value, ms: bx });
      if (this.beeps.length > 100) this.beeps.shift();
      this.onBeep?.(value, bx);
      return true;
    }
    return false;
  }
}

export const systemClock: Clock = { seconds: () => new Date().getSeconds() };

export function nullDevices(): Devices {
  return {
    keyboard: { read: () => Promise.reject(new Error('No hay teclado conectado')) },
    screen: { write: () => undefined },
    ports: { in: () => undefined, out: () => false },
    clock: systemClock,
  };
}

export function createTestDevices(inputs: readonly number[] = [], seconds = 0) {
  const keyboard = new ScriptedKeyboard(inputs);
  const screen = new BufferScreen();
  const ports = new SimplePorts();
  const devices: Devices = { keyboard, screen, ports, clock: { seconds: () => seconds } };
  return { devices, keyboard, screen, ports };
}
