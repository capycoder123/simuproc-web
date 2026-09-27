import type { Cpu, StepResult } from './cpu';
import type { RuntimeErrorInfo } from './errors';
import type { Devices, InputRequest } from './types';

export type RunnerState = 'idle' | 'running' | 'paused' | 'waiting';
export type ErrorDecision = 'continue' | 'stop' | 'pause';

export interface RunnerHooks {
  getAnimation(): boolean;
  /** Delay between animated steps; 0 means as fast as possible. */
  getDelayMs(): number;
  /** Called after each animated step and after each batch without animation. */
  onUpdate(): void;
  onStateChange(state: RunnerState): void;
  onHalt(): void;
  onError(error: RuntimeErrorInfo): Promise<ErrorDecision>;
  onInput?(request: InputRequest | null): void;
  /** Called after every executed step; return true to pause (used by "Vigilante de Memoria"). */
  afterStep?(): boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Drives the CPU: continuous execution, single steps, pause/resume, keyboard suspension. */
export class Runner {
  private readonly cpu: Cpu;
  private readonly devices: Devices;
  private readonly hooks: RunnerHooks;
  private token = 0;
  private current: RunnerState = 'idle';
  private pauseRequested = false;
  /** Ends the current animation delay early (set only while the loop waits). */
  private wake: (() => void) | null = null;

  constructor(cpu: Cpu, devices: Devices, hooks: RunnerHooks) {
    this.cpu = cpu;
    this.devices = devices;
    this.hooks = hooks;
  }

  get state(): RunnerState {
    return this.current;
  }

  private setState(s: RunnerState): void {
    if (s !== this.current) {
      this.current = s;
      this.hooks.onStateChange(s);
    }
  }

  /** Ejecutar / Reanudar: run continuously from the current PC. */
  async run(): Promise<void> {
    if (this.current === 'running' || this.current === 'waiting') return;
    const token = ++this.token;
    this.pauseRequested = false;
    this.setState('running');
    this.cpu.status = 'running';
    await this.loop(token);
  }

  /** Paso a paso: one cycle, then paused. */
  async stepOnce(): Promise<void> {
    if (this.current === 'running' || this.current === 'waiting') return;
    const token = ++this.token;
    this.pauseRequested = false;
    this.setState('running');
    this.cpu.status = 'running';
    const r = this.cpu.step();
    const cont = await this.handle(r, token);
    if (token !== this.token) return;
    if (cont) this.hooks.afterStep?.();
    this.hooks.onUpdate();
    if (cont) this.setState('paused');
  }

  pause(): void {
    if (this.current === 'running') {
      this.pauseRequested = true;
      this.wake?.();
    }
  }

  /** Stops the execution and abandons any pending keyboard request. */
  stop(): void {
    this.token++;
    this.pauseRequested = false;
    this.devices.keyboard.cancel?.();
    this.cpu.cancelInput();
    this.hooks.onInput?.(null);
    if (this.cpu.status === 'running' || this.cpu.status === 'waiting') this.cpu.status = 'stopped';
    this.setState('idle');
    this.wake?.();
  }

  /** Animation delay that pause() and stop() can cut short. */
  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.wake = null;
        resolve();
      }, ms);
      this.wake = () => {
        clearTimeout(timer);
        this.wake = null;
        resolve();
      };
    });
  }

  private async handle(r: StepResult, token: number): Promise<boolean> {
    switch (r.type) {
      case 'ok':
        return true;
      case 'halt':
        this.setState('idle');
        this.hooks.onHalt();
        return false;
      case 'input': {
        this.setState('waiting');
        this.hooks.onInput?.(r.request);
        this.hooks.onUpdate();
        let value: number;
        try {
          value = await this.devices.keyboard.read(r.request.message, r.request.mode);
        } catch {
          if (token === this.token) {
            this.cpu.cancelInput();
            this.cpu.status = 'stopped';
            this.hooks.onInput?.(null);
            this.setState('idle');
          }
          return false;
        }
        if (token !== this.token) return false;
        this.cpu.deliverInput(value);
        this.hooks.onInput?.(null);
        this.setState('running');
        return true;
      }
      case 'error': {
        this.hooks.onUpdate();
        if (r.error.kind === 'fatal') {
          this.setState('idle');
          await this.hooks.onError(r.error);
          return false;
        }
        const decision = await this.hooks.onError(r.error);
        if (token !== this.token) return false;
        if (decision === 'continue') return true;
        if (decision === 'pause') {
          this.setState('paused');
          return false;
        }
        this.cpu.status = 'error';
        this.setState('idle');
        return false;
      }
    }
  }

  private async loop(token: number): Promise<void> {
    while (token === this.token) {
      if (this.pauseRequested) {
        this.pauseRequested = false;
        this.setState('paused');
        this.hooks.onUpdate();
        return;
      }
      const animation = this.hooks.getAnimation();
      const delay = animation ? this.hooks.getDelayMs() : 0;
      if (animation && delay > 0) {
        const r = this.cpu.step();
        const cont = await this.handle(r, token);
        if (token !== this.token) return;
        if (cont && this.hooks.afterStep?.()) this.pauseRequested = true;
        this.hooks.onUpdate();
        if (!cont) return;
        if (!this.pauseRequested) await this.delay(delay);
      } else {
        const start = performance.now();
        let n = 0;
        let cont = true;
        while (token === this.token && !this.pauseRequested) {
          const r = this.cpu.step();
          if (r.type !== 'ok') {
            cont = await this.handle(r, token);
            if (token !== this.token) return;
            if (!cont) break;
          }
          if (this.hooks.afterStep?.()) this.pauseRequested = true;
          n++;
          if ((n & 127) === 0 && performance.now() - start > 8) break;
        }
        this.hooks.onUpdate();
        if (!cont) return;
        await sleep(0);
      }
    }
  }
}
