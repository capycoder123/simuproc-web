import { code2, hex3 } from '../format';
import { ISA_BY_MNEMONIC, MNEMONIC_ALIASES, type InstrDef } from '../isa';
import { MEM_SIZE, parseBinaryWord } from '../memory';
import { decodeCell } from '../decode';
import { operandsToText, parseOperands, type Operand } from '../operands';
import type { Cell } from '../types';

export const ASM_HEADER = '#SimuProc 1.4.3.0';

export interface AsmError {
  addr: number;
  line: number;
  kind: 'instr' | 'param';
  message: string;
}

export interface AsmWarning {
  addr: number;
  line: number;
  message: string;
}

export type AsmLineKind = 'blank' | 'comment' | 'directive' | 'instr' | 'data' | 'error';

export interface AsmLine {
  line: number;
  addr: number | null;
  kind: AsmLineKind;
  /** Code part of the line without the comment, trimmed. */
  source: string;
  comment: string;
}

export interface AsmResult {
  cells: Map<number, Cell>;
  lines: AsmLine[];
  errors: AsmError[];
  warnings: AsmWarning[];
}

export type ParsedLine =
  | { kind: 'instr'; def: InstrDef; ops: Operand[]; message: string; warning?: string }
  | { kind: 'data'; text: string; value: number; warning?: string }
  | { kind: 'error'; error: 'instr' | 'param'; detail?: string };

/** Splits a line at the first ';' that is outside quotes. */
export function stripComment(line: string): { code: string; comment: string } {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote !== null) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ';') {
      return { code: line.slice(0, i), comment: line.slice(i + 1) };
    }
  }
  return { code: line, comment: '' };
}

/** Removes one pair of matching quotes, or a single unclosed leading quote. Inner spacing is kept. */
export function unquote(s: string): string {
  if (s.length === 0) return s;
  const q = s[0];
  if (q !== '"' && q !== "'") return s;
  if (s.length >= 2 && s[s.length - 1] === q) return s.slice(1, -1);
  return s.slice(1);
}

/** Whether `form`, written after the mnemonic, is read back by the assembler as `msg`. */
function readsBackAs(form: string, msg: string): boolean {
  return unquote(stripComment(form).code.trim()) === msg;
}

/**
 * Wraps a message for the Editor 2 text form: 'msg', or "msg" when it contains ', as before. Only a
 * message that mixes ' and " falls back to the first of msg, 'msg and "msg that reads back unchanged;
 * if none does, it is written bare.
 */
export function quoteMessage(msg: string): string {
  const quoted = msg.includes("'") ? `"${msg}"` : `'${msg}'`;
  const forms = [quoted, msg, `'${msg}`, `"${msg}`];
  return forms.find((f) => readsBackAs(f, msg)) ?? msg;
}

export function errorMessage(kind: 'instr' | 'param', addr: number): string {
  return kind === 'instr'
    ? `INSTRUCCION NO VALIDA en la Dir: ${hex3(addr)}`
    : `PARAMETRO NO VALIDO para la inst en la Dir: ${hex3(addr)}`;
}

/**
 * Parses the code part of a line (comment already removed) as an instruction or a data word.
 * `allowEmptyMessage` is used by Editor 1, where the message of LDT/EAP/MSG lives in the comment column.
 */
export function parseSourceLine(code: string, allowEmptyMessage = false): ParsedLine {
  const s = code.trim();
  const word = parseBinaryWord(s);
  if (word !== null) return { kind: 'data', text: s, value: word };
  if (/^[01]{17,}$/.test(s)) return { kind: 'error', error: 'instr', detail: `dato binario de ${s.length} dígitos; cada posición de memoria guarda 16 bits (divídalo en dos posiciones)` };
  if (/^\d{1,5}$/.test(s)) {
    const v = Number(s);
    if (v <= 65535) {
      return {
        kind: 'data',
        text: v.toString(2),
        value: v,
        warning: `"${s}" interpretado como decimal; el original solo acepta binario`,
      };
    }
    return { kind: 'error', error: 'instr' };
  }
  const m = /^([A-Za-z]+)\b\s*(.*)$/s.exec(s);
  if (!m) return { kind: 'error', error: 'instr' };
  const mnemonic = m[1].toUpperCase();
  let def = ISA_BY_MNEMONIC.get(mnemonic);
  let warning: string | undefined;
  if (!def) {
    const alias = MNEMONIC_ALIASES.get(mnemonic);
    if (alias) {
      def = ISA_BY_MNEMONIC.get(alias);
      warning = `${mnemonic} interpretado como ${alias}`;
    }
  }
  if (!def) return { kind: 'error', error: 'instr' };
  const rest = m[2] ?? '';
  if (def.shape === 'msg') {
    const message = unquote(rest.trim());
    if (def.code === 42 && message === '' && !allowEmptyMessage) return { kind: 'error', error: 'param' };
    return { kind: 'instr', def, ops: [], message, warning };
  }
  if (def.shape === 'none') {
    if (rest.trim() !== '') return { kind: 'error', error: 'param' };
    return { kind: 'instr', def, ops: [], message: '', warning };
  }
  const ops = parseOperands(def.shape, rest);
  if (!ops) return { kind: 'error', error: 'param' };
  return { kind: 'instr', def, ops, message: '', warning };
}

/** Builds the cell text of a parsed line, in the .smp encoding. */
export function cellFromParsed(p: Exclude<ParsedLine, { kind: 'error' }>, lineComment: string): Cell {
  if (p.kind === 'data') return { text: p.text, comment: lineComment, origin: 'data' };
  const isMessage = p.def.shape === 'msg';
  const tail = p.def.shape === 'none' || isMessage ? '000' : operandsToText(p.ops);
  return { text: code2(p.def.code) + tail, comment: isMessage ? p.message : lineComment, origin: 'instr' };
}

const DIRECTIVE_RE = /^#([0-9A-Fa-f]{1,3})[Hh]?$/;
/** '#' lines that are not directives but look like one: an address in another form, or a number followed by text. */
const ADDRESS_LIKE_RE = /^#\s*(?:0[Xx])?([0-9A-Fa-f]+)[Hh]?$/;
const NUMBER_WITH_TEXT_RE = /^#([0-9A-Fa-f]*\d[0-9A-Fa-f]*)[Hh]?\s/;

/** Warning for a '#' comment line that was probably meant as an address directive, or null. */
function directiveWarning(source: string, line: number): string | null {
  const m = ADDRESS_LIKE_RE.exec(source) ?? NUMBER_WITH_TEXT_RE.exec(source);
  if (!m) return null;
  return parseInt(m[1], 16) >= MEM_SIZE
    ? `Línea ${line}: "${source}" está fuera de rango (directivas de 000 a FFF); se toma como comentario`
    : `Línea ${line}: "${source}" no es una directiva válida (ejemplo: #20); se toma como comentario`;
}

/** Assembles Editor 2 text into cells. Addresses run from 000 or from the last #HEX directive. */
export function assemble(text: string): AsmResult {
  const cells = new Map<number, Cell>();
  const lines: AsmLine[] = [];
  const errors: AsmError[] = [];
  const warnings: AsmWarning[] = [];
  let addr = 0;
  /** Set once SE LLENO LA MEMORIA has been reported, until a directive moves the address back. */
  let full = false;
  const rawLines = text.split(/\r\n|\r|\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const line = i + 1;
    const { code, comment } = stripComment(rawLines[i]);
    const source = code.trim();
    const lineComment = comment.trim();
    if (source === '') {
      lines.push({ line, addr: null, kind: lineComment === '' ? 'blank' : 'comment', source, comment: lineComment });
      continue;
    }
    if (source.startsWith('#')) {
      const d = DIRECTIVE_RE.exec(source);
      if (d) {
        addr = parseInt(d[1], 16);
        full = false;
        lines.push({ line, addr: null, kind: 'directive', source, comment: lineComment });
      } else {
        const warning = directiveWarning(source, line);
        if (warning) warnings.push({ addr, line, message: warning });
        lines.push({ line, addr: null, kind: 'comment', source, comment: lineComment });
      }
      continue;
    }
    if (addr >= MEM_SIZE) {
      // One error per overflow: every later line would repeat it.
      if (!full) errors.push({ addr, line, kind: 'instr', message: `SE LLENO LA MEMORIA (línea ${line})` });
      full = true;
      lines.push({ line, addr, kind: 'error', source, comment: lineComment });
      addr++;
      continue;
    }
    const p = parseSourceLine(source);
    if (p.kind === 'error') {
      errors.push({ addr, line, kind: p.error, message: errorMessage(p.error, addr) });
      if (p.detail) warnings.push({ addr, line, message: `Dir ${hex3(addr)}: ${p.detail}` });
      lines.push({ line, addr, kind: 'error', source, comment: lineComment });
      addr++;
      continue;
    }
    if (p.warning) warnings.push({ addr, line, message: `Dir ${hex3(addr)}: ${p.warning}` });
    cells.set(addr, cellFromParsed(p, lineComment));
    lines.push({ line, addr, kind: p.kind, source, comment: lineComment });
    addr++;
  }
  return { cells, lines, errors, warnings };
}

/** Mnemonic form of a cell for Editor 1 and the memory list. */
export function cellToSource(cell: Cell): { source: string; comment: string; isMessage: boolean } {
  if (cell.text === '') return { source: '', comment: cell.comment, isMessage: false };
  const d = decodeCell(cell.text);
  if (d.def && d.ops) {
    const source = d.ops.length > 0 ? `${d.def.mnemonic} ${operandsToText(d.ops)}` : d.def.mnemonic;
    return { source, comment: cell.comment, isMessage: d.def.shape === 'msg' };
  }
  return { source: cell.text, comment: cell.comment, isMessage: false };
}

/** Editor 2 text of a line for a cell (without the address). */
export function cellToLine(cell: Cell): string {
  const { source, comment, isMessage } = cellToSource(cell);
  if (isMessage) return comment !== '' ? `${source} ${quoteMessage(comment)}` : source;
  return comment !== '' ? `${source} ;${comment}` : source;
}

/** Editor 2 text built line by line, with a #HEX directive wherever a line does not follow the previous address. */
export class AsmTextWriter {
  private readonly out: string[] = [ASM_HEADER];
  /** Address the next line takes without a directive; -1 forces one. */
  private next = 0;

  /** Adds the line for `addr` and returns its line number. */
  add(addr: number, line: string): number {
    if (addr !== this.next) this.out.push(`#${addr.toString(16).toUpperCase()}`);
    this.out.push(line);
    this.next = addr + 1;
    return this.out.length;
  }

  /** Makes the next line get a directive even if its address follows. */
  pin(): void {
    this.next = -1;
  }

  text(): string {
    return this.out.join('\n') + '\n';
  }
}

/** Converts cells back to Editor 2 text, with #HEX directives where addresses are not consecutive. */
export function disassemble(entries: Iterable<{ addr: number; cell: Cell }>): string {
  return disassembleWithWarnings(entries).text;
}

/** Like disassemble, plus a warning for each message that the text form cannot hold without losing text. */
export function disassembleWithWarnings(entries: Iterable<{ addr: number; cell: Cell }>): { text: string; warnings: AsmWarning[] } {
  const writer = new AsmTextWriter();
  const warnings: AsmWarning[] = [];
  for (const { addr, cell } of entries) {
    if (cell.text === '') continue;
    const line = writer.add(addr, cellToLine(cell));
    const { comment, isMessage } = cellToSource(cell);
    if (isMessage && comment !== '' && !readsBackAs(quoteMessage(comment), comment)) {
      warnings.push({
        addr,
        line,
        message: `Dir ${hex3(addr)}: el mensaje "${comment}" mezcla comillas ' y " y no se puede guardar como .asm sin perder texto`,
      });
    }
  }
  return { text: writer.text(), warnings };
}
