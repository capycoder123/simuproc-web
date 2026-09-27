import { decodeCell, type DecodeResult } from './decode';
import { hex3 } from './format';
import type { Cell, Origin } from './types';

export const MEM_SIZE = 4096;
export const MAX_ADDR = 0xfff;
const BIN_RE = /^[01]{1,16}$/;

/** Value of a binary word of 1 to 16 digits, as a cell stores data, or null. The text is not trimmed. */
export function parseBinaryWord(text: string): number | null {
  return BIN_RE.test(text) ? parseInt(text, 2) : null;
}

/** Highest address with a non-empty text or comment, or -1. */
export function lastUsedAddress(cells: readonly Cell[]): number {
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].text !== '' || cells[i].comment !== '') return i;
  }
  return -1;
}

export function classifyText(text: string): Origin {
  if (text === '') return 'empty';
  const d = decodeCell(text);
  return d.def !== null && d.ops !== null ? 'instr' : 'data';
}

export interface DataRead {
  value: number;
  /** Set when the cell holds a text that is not a binary word (an instruction). */
  warning: string | null;
}

/** 4096 cells of text, as the original SimuProc stores them. */
export class Memory {
  readonly cells: Cell[];
  private decoded: (DecodeResult | undefined)[];

  constructor() {
    this.cells = Array.from({ length: MEM_SIZE }, () => ({ text: '', comment: '', origin: 'empty' as Origin }));
    this.decoded = new Array<DecodeResult | undefined>(MEM_SIZE);
  }

  get(addr: number): Cell {
    return this.cells[addr];
  }

  set(addr: number, text: string, comment = '', origin?: Origin): void {
    const cell = this.cells[addr];
    cell.text = text;
    cell.comment = comment;
    cell.origin = origin ?? classifyText(text);
    this.decoded[addr] = undefined;
  }

  clearCell(addr: number): void {
    this.set(addr, '', '', 'empty');
  }

  decode(addr: number): DecodeResult {
    let d = this.decoded[addr];
    if (!d) {
      d = decodeCell(this.cells[addr].text);
      this.decoded[addr] = d;
    }
    return d;
  }

  isBinary(addr: number): boolean {
    return BIN_RE.test(this.cells[addr].text);
  }

  /** Reads a cell as a 16-bit word: binary text, or 0 for an empty cell, or 0 with a warning. */
  readData(addr: number): DataRead {
    const text = this.cells[addr].text;
    if (text === '') return { value: 0, warning: null };
    const value = parseBinaryWord(text);
    if (value !== null) return { value, warning: null };
    return {
      value: 0,
      warning: `La dirección ${hex3(addr)} no contiene un dato binario ("${text}"); se lee como 0.`,
    };
  }

  /** Stores a 16-bit word as minimal binary text ("0" for zero). The comment is kept. */
  writeData(addr: number, value: number): void {
    this.set(addr, (value & 0xffff).toString(2), this.cells[addr].comment, 'data');
  }

  clear(): void {
    for (let i = 0; i < MEM_SIZE; i++) {
      const c = this.cells[i];
      c.text = '';
      c.comment = '';
      c.origin = 'empty';
      this.decoded[i] = undefined;
    }
  }

  usedCells(): number {
    let n = 0;
    for (const c of this.cells) if (c.origin !== 'empty') n++;
    return n;
  }

  entries(): { addr: number; cell: Cell }[] {
    const out: { addr: number; cell: Cell }[] = [];
    for (let i = 0; i < MEM_SIZE; i++) {
      const c = this.cells[i];
      if (c.origin !== 'empty' || c.comment !== '') out.push({ addr: i, cell: c });
    }
    return out;
  }

  /** Replaces the whole memory with the given cells. An address outside 000-FFF throws before anything changes. */
  load(entries: Iterable<[number, Cell]> | Map<number, Cell>): void {
    const list = [...entries];
    for (const [addr] of list) {
      if (!Number.isInteger(addr) || addr < 0 || addr > MAX_ADDR) throw new RangeError(`Dirección fuera de la memoria: ${addr}`);
    }
    this.clear();
    for (const [addr, cell] of list) this.set(addr, cell.text, cell.comment, cell.origin);
  }
}
