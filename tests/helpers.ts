import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import {
  Cpu,
  Memory,
  assemble,
  createTestDevices,
  decodeProgramBytes,
  parseSmp,
  type AsmResult,
  type Cell,
  type RuntimeErrorInfo,
  type SmpDocument,
  type SimplePorts,
} from '../src/core';

export const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
export const EJEMPLOS = path.join(ROOT, 'src', 'ejemplos');
export const CURSO = path.join(EJEMPLOS, 'curso');
export const SIMUPROC = path.join(EJEMPLOS, 'simuproc');
export const SMP = path.join(EJEMPLOS, 'smp');

export function readBytes(file: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(file));
}

export function readProgramText(file: string): string {
  return decodeProgramBytes(readBytes(file)).text;
}

export function loadAsm(file: string): AsmResult {
  return assemble(readProgramText(file));
}

export function loadSmp(file: string): SmpDocument {
  return parseSmp(readProgramText(file));
}

export interface RunOptions {
  maxSteps?: number;
  animation?: boolean;
  ignoreUnknownOpcodes?: boolean;
  seconds?: number;
  setup?: (cpu: Cpu) => void;
}

export interface RunOutcome {
  ended: 'halt' | 'error' | 'limit';
  error: RuntimeErrorInfo | null;
  lines: string[];
  cpu: Cpu;
  steps: number;
  requests: number;
  last: { decimal: string; binary: string } | null;
  ports: SimplePorts;
}

/** Runs cells with scripted keyboard inputs until HLT, a runtime error or the step limit. */
export async function runCells(cells: Map<number, Cell>, inputs: number[] = [], opts: RunOptions = {}): Promise<RunOutcome> {
  const mem = new Memory();
  mem.load(cells);
  const { devices, keyboard, screen, ports } = createTestDevices(inputs, opts.seconds ?? 0);
  const cpu = new Cpu(mem, devices);
  cpu.animation = opts.animation ?? false;
  cpu.options.ignoreUnknownOpcodes = opts.ignoreUnknownOpcodes ?? false;
  opts.setup?.(cpu);
  const maxSteps = opts.maxSteps ?? 200000;
  let steps = 0;
  while (steps < maxSteps) {
    const r = cpu.step();
    steps++;
    if (r.type === 'ok') continue;
    if (r.type === 'input') {
      const v = await devices.keyboard.read(r.request.message, r.request.mode);
      cpu.deliverInput(v);
      continue;
    }
    const base = { lines: screen.lines, cpu, steps, requests: keyboard.requests.length, last: screen.last, ports };
    if (r.type === 'halt') return { ended: 'halt', error: null, ...base };
    return { ended: 'error', error: r.error, ...base };
  }
  return { ended: 'limit', error: null, lines: screen.lines, cpu, steps, requests: keyboard.requests.length, last: screen.last, ports };
}

export async function runAsmFile(file: string, inputs: number[] = [], opts: RunOptions = {}): Promise<RunOutcome> {
  const asm = loadAsm(file);
  expect(asm.errors, `errores al ensamblar ${path.basename(file)}`).toEqual([]);
  return runCells(asm.cells, inputs, opts);
}

export async function runSmpFile(file: string, inputs: number[] = [], opts: RunOptions = {}): Promise<RunOutcome> {
  return runCells(loadSmp(file).cells, inputs, opts);
}

/** Assembles a snippet (lines joined with newlines) and runs it. */
export async function runSource(source: string, inputs: number[] = [], opts: RunOptions = {}): Promise<RunOutcome> {
  const asm = assemble(source);
  expect(asm.errors, 'errores al ensamblar el fragmento').toEqual([]);
  return runCells(asm.cells, inputs, opts);
}

/** Asserts that `expected` appears in `lines` in order (as a subsequence of exact lines). */
export function expectOrdered(lines: string[], expected: string[]): void {
  let i = 0;
  for (const line of lines) {
    if (i < expected.length && line === expected[i]) i++;
  }
  expect(i, `esperaba ver en orden ${JSON.stringify(expected)} en ${JSON.stringify(lines)}`).toBe(expected.length);
}

export function bin(s: string): number {
  return parseInt(s, 2);
}
