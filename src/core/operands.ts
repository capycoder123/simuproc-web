import type { OperandShape } from './isa';
import type { RegName } from './types';

export type Operand =
  | { kind: 'reg'; reg: RegName }
  | { kind: 'mem'; addr: number; text: string }
  | { kind: 'count'; n: number }
  | { kind: 'port'; n: number };

export const REG4: readonly string[] = ['AX', 'BX', 'CX', 'BP'];
export const REG3: readonly string[] = ['AX', 'BX', 'CX'];
const ADDR_RE = /^([0-9A-F]{1,3})H?$/;

/** Hex address of 1 to 3 digits with an optional H suffix. Keeps the digits as typed. */
export function parseAddress(raw: string): { addr: number; text: string } | null {
  const m = ADDR_RE.exec(raw.trim().toUpperCase());
  if (!m) return null;
  return { addr: parseInt(m[1], 16), text: m[1] };
}

/** One of `regs`, in any case and with surrounding spaces. */
export function parseReg(raw: string, regs: readonly string[]): Operand | null {
  const u = raw.trim().toUpperCase();
  return regs.includes(u) ? { kind: 'reg', reg: u as RegName } : null;
}

/** One of `regs`, or an address as parseAddress reads it. */
export function parseRegOrMem(raw: string, regs: readonly string[]): Operand | null {
  const r = parseReg(raw, regs);
  if (r) return r;
  const a = parseAddress(raw);
  return a ? { kind: 'mem', addr: a.addr, text: a.text } : null;
}

function parseCount(raw: string): Operand | null {
  const s = raw.trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 16 ? { kind: 'count', n } : null;
}

function parsePort(raw: string): Operand | null {
  const s = raw.trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  return { kind: 'port', n: Number(s) };
}

function split(text: string, expected: number): string[] | null {
  const parts = text.split(',');
  if (parts.length !== expected) return null;
  const trimmed = parts.map((p) => p.trim());
  return trimmed.some((p) => p === '') ? null : trimmed;
}

/**
 * Parses the operand text of an instruction (from the assembler or from a stored
 * cell) according to the shape of the instruction. Returns null when invalid.
 */
export function parseOperands(shape: OperandShape, text: string): Operand[] | null {
  const t = text.trim();
  switch (shape) {
    case 'none':
    case 'msg':
      return t === '' ? [] : null;
    case 'mem': {
      const p = split(t, 1);
      if (!p) return null;
      const a = parseAddress(p[0]);
      return a ? [{ kind: 'mem', addr: a.addr, text: a.text }] : null;
    }
    case 'reg4': {
      const p = split(t, 1);
      if (!p) return null;
      const r = parseReg(p[0], REG4);
      return r ? [r] : null;
    }
    case 'dest4': {
      const p = split(t, 1);
      if (!p) return null;
      const r = parseRegOrMem(p[0], REG4);
      return r ? [r] : null;
    }
    case 'mov': {
      const p = split(t, 2);
      if (!p) return null;
      const d = parseRegOrMem(p[0], REG4);
      const o = parseRegOrMem(p[1], REG4);
      return d && o ? [d, o] : null;
    }
    case 'log1': {
      const p = split(t, 1);
      if (!p) return null;
      const r = parseRegOrMem(p[0], REG3);
      return r ? [r] : null;
    }
    case 'log2': {
      const p = split(t, 2);
      if (!p) return null;
      const d = parseRegOrMem(p[0], REG3);
      const o = parseRegOrMem(p[1], REG3);
      return d && o ? [d, o] : null;
    }
    case 'shift': {
      const p = split(t, 2);
      if (!p) return null;
      const d = parseRegOrMem(p[0], REG3);
      const n = parseCount(p[1]);
      return d && n ? [d, n] : null;
    }
    case 'in': {
      const p = split(t, 2);
      if (!p) return null;
      const r = parseReg(p[0], REG3);
      const n = parsePort(p[1]);
      return r && n ? [r, n] : null;
    }
    case 'out': {
      const p = split(t, 2);
      if (!p) return null;
      const n = parsePort(p[0]);
      const r = parseReg(p[1], REG3);
      return n && r ? [n, r] : null;
    }
  }
}

/** For a shift instruction whose count is invalid but whose destination is valid. */
export function shiftDestinationIsValid(text: string): boolean {
  const p = split(text.trim(), 2);
  return p !== null && parseRegOrMem(p[0], REG3) !== null;
}

export function operandToText(op: Operand): string {
  switch (op.kind) {
    case 'reg':
      return op.reg;
    case 'mem':
      return op.text;
    case 'count':
    case 'port':
      return String(op.n);
  }
}

/** Canonical operand text as stored in a cell and shown in the memory list. */
export function operandsToText(ops: readonly Operand[]): string {
  return ops.map(operandToText).join(',');
}
