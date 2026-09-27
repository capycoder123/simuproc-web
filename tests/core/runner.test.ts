import { describe, expect, it } from 'vitest';
import { Cpu, Memory, Runner, assemble, createTestDevices, type ErrorDecision, type RunnerState } from '../../src/core';

function makeRunner(
  source: string,
  inputs: number[],
  opts: { afterStep?: () => boolean; decision?: ErrorDecision; animation?: boolean; delayMs?: number } = {},
) {
  const asm = assemble(source);
  expect(asm.errors).toEqual([]);
  const mem = new Memory();
  mem.load(asm.cells);
  const { devices, screen } = createTestDevices(inputs);
  const cpu = new Cpu(mem, devices);
  const states: RunnerState[] = [];
  const errors: string[] = [];
  let halted = 0;
  let updates = 0;
  const runner = new Runner(cpu, devices, {
    getAnimation: () => opts.animation ?? false,
    getDelayMs: () => opts.delayMs ?? 0,
    onUpdate: () => updates++,
    onStateChange: (s) => states.push(s),
    onHalt: () => halted++,
    onError: (e) => {
      errors.push(e.id);
      return Promise.resolve(opts.decision ?? 'stop');
    },
    afterStep: opts.afterStep,
  });
  return { runner, cpu, screen, states, errors, halted: () => halted, updates: () => updates };
}

/** Resolves with 'timeout' if `p` takes longer than `ms`. */
function within<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([p, new Promise<'timeout'>((res) => setTimeout(() => res('timeout'), ms))]);
}

describe('Runner', () => {
  it('runs a program with keyboard input to HLT', async () => {
    const r = makeRunner('LDT dato\nEAP valor\nHLT', [9]);
    await r.runner.run();
    expect(r.screen.lines).toEqual(['valor 9']);
    expect(r.halted()).toBe(1);
    expect(r.states).toEqual(['running', 'waiting', 'running', 'idle']);
    expect(r.cpu.status).toBe('halted');
  });

  it('pauses when afterStep asks for it and resumes with run()', async () => {
    let steps = 0;
    const r = makeRunner('INC AX\nINC AX\nINC AX\nHLT', [], { afterStep: () => ++steps === 2 });
    await r.runner.run();
    expect(r.runner.state).toBe('paused');
    expect(r.cpu.regs.AX).toBe(2);
    await r.runner.run();
    expect(r.runner.state).toBe('idle');
    expect(r.cpu.regs.AX).toBe(3);
    expect(r.halted()).toBe(1);
  });

  it('stepOnce executes one cycle and leaves the runner paused', async () => {
    const r = makeRunner('INC AX\nINC AX\nHLT', []);
    await r.runner.stepOnce();
    expect(r.cpu.regs.AX).toBe(1);
    expect(r.runner.state).toBe('paused');
    await r.runner.stepOnce();
    await r.runner.stepOnce();
    expect(r.runner.state).toBe('idle');
    expect(r.halted()).toBe(1);
  });

  it('continues after an ignorable error when the decision is continue, stops otherwise', async () => {
    const cont = makeRunner('POP AX\nMSG fin\nHLT', [], { decision: 'continue' });
    await cont.runner.run();
    expect(cont.errors).toEqual(['pop-empty']);
    expect(cont.screen.lines).toEqual(['fin']);
    expect(cont.halted()).toBe(1);
    const stop = makeRunner('POP AX\nMSG fin\nHLT', [], { decision: 'stop' });
    await stop.runner.run();
    expect(stop.screen.lines).toEqual([]);
    expect(stop.runner.state).toBe('idle');
    expect(stop.cpu.status).toBe('error');
  });

  it('a fatal error stops without asking twice', async () => {
    const r = makeRunner('DIV 20\nHLT\n#20\n0', [], { decision: 'continue' });
    await r.runner.run();
    expect(r.errors).toEqual(['div-zero']);
    expect(r.runner.state).toBe('idle');
    expect(r.cpu.status).toBe('error');
  });

  it('stop() abandons a pending keyboard request', async () => {
    const asm = assemble('LDT\nHLT');
    const mem = new Memory();
    mem.load(asm.cells);
    let reject: ((e: Error) => void) | null = null;
    const devices = {
      keyboard: {
        read: () =>
          new Promise<number>((_, rej) => {
            reject = rej;
          }),
        cancel: () => reject?.(new Error('cancelado')),
      },
      screen: { write: () => undefined },
      ports: { in: () => undefined, out: () => false },
      clock: { seconds: () => 0 },
    };
    const cpu = new Cpu(mem, devices);
    const states: RunnerState[] = [];
    const runner = new Runner(cpu, devices, {
      getAnimation: () => false,
      getDelayMs: () => 0,
      onUpdate: () => undefined,
      onStateChange: (s) => states.push(s),
      onHalt: () => undefined,
      onError: () => Promise.resolve('stop'),
    });
    const running = runner.run();
    expect(runner.state).toBe('waiting');
    runner.stop();
    await running;
    expect(runner.state).toBe('idle');
    expect(cpu.pending).toBeNull();
    expect(cpu.status).toBe('stopped');
  });

  it('with animation it updates the view once per executed instruction', async () => {
    const r = makeRunner('INC AX\nINC AX\nINC AX\nHLT', [], { animation: true, delayMs: 1 });
    await r.runner.run();
    expect(r.cpu.status).toBe('halted');
    expect(r.updates()).toBe(4);
  });

  it('pause() during a run leaves the runner paused and run() resumes it', async () => {
    const r = makeRunner('INC AX\nJMP 000', []);
    const running = r.runner.run();
    r.runner.pause();
    await running;
    expect(r.runner.state).toBe('paused');
    const ax = r.cpu.regs.AX;
    expect(ax).toBeGreaterThan(0);
    const resumed = r.runner.run();
    r.runner.pause();
    await resumed;
    expect(r.runner.state).toBe('paused');
    expect(r.cpu.regs.AX).toBeGreaterThan(ax);
  });

  it('the pause decision after an ignorable error pauses before the next instruction', async () => {
    const r = makeRunner('POP AX\nMSG fin\nHLT', [], { decision: 'pause' });
    await r.runner.run();
    expect(r.errors).toEqual(['pop-empty']);
    expect(r.runner.state).toBe('paused');
    expect(r.screen.lines).toEqual([]);
    await r.runner.run();
    expect(r.screen.lines).toEqual(['fin']);
    expect(r.halted()).toBe(1);
  });

  it('with a long animation delay, pause() applies without waiting for the delay', async () => {
    const r = makeRunner('INC AX\nJMP 000', [], { animation: true, delayMs: 2000 });
    const running = r.runner.run();
    await new Promise((res) => setTimeout(res, 10));
    r.runner.pause();
    expect(await within(running, 200)).not.toBe('timeout');
    expect(r.runner.state).toBe('paused');
    expect(r.cpu.regs.AX).toBe(1);
  });

  it('with a long animation delay, a pause asked by afterStep applies at once', async () => {
    const r = makeRunner('INC AX\nJMP 000', [], { animation: true, delayMs: 2000, afterStep: () => true });
    expect(await within(r.runner.run(), 200)).not.toBe('timeout');
    expect(r.runner.state).toBe('paused');
    expect(r.cpu.regs.AX).toBe(1);
  });

  it('stop() during an animation delay ends the run promptly', async () => {
    const r = makeRunner('INC AX\nJMP 000', [], { animation: true, delayMs: 2000 });
    const running = r.runner.run();
    await new Promise((res) => setTimeout(res, 10));
    r.runner.stop();
    expect(await within(running, 200)).not.toBe('timeout');
    expect(r.runner.state).toBe('idle');
    expect(r.cpu.status).toBe('stopped');
  });
});
