import { hex3 } from '../format';
import { MAX_ADDR } from '../memory';
import type { Cell } from '../types';
import {
  assemble,
  cellFromParsed,
  cellToLine,
  cellToSource,
  errorMessage,
  parseSourceLine,
  AsmTextWriter,
  type AsmError,
  type AsmWarning,
  type ParsedLine,
} from './asm';

/** One row of "Editor 1 (Tipo Memoria)": address, instruction or data, comment (message for LDT/EAP/MSG). */
export interface Editor1Row {
  addr: number;
  source: string;
  comment: string;
}

export function memoryToRows(entries: Iterable<{ addr: number; cell: Cell }>): Editor1Row[] {
  const rows: Editor1Row[] = [];
  for (const { addr, cell } of entries) {
    if (cell.text === '') continue;
    const { source, comment } = cellToSource(cell);
    rows.push({ addr, source, comment });
  }
  return rows;
}

/**
 * "Convertir a Editor 1": every addressed line of the text becomes a row (error lines keep their text).
 * Lines past FFF are left out: they do not fit in memory and assemble already reports SE LLENO LA MEMORIA.
 */
export function textToRows(text: string): { rows: Editor1Row[]; errors: AsmError[]; warnings: AsmWarning[] } {
  const result = assemble(text);
  const rows: Editor1Row[] = [];
  for (const line of result.lines) {
    if (line.addr === null || line.addr > MAX_ADDR) continue;
    const cell = result.cells.get(line.addr);
    if (line.kind === 'error' || !cell) {
      rows.push({ addr: line.addr, source: line.source, comment: line.comment });
    } else {
      const { source, comment } = cellToSource(cell);
      rows.push({ addr: line.addr, source, comment });
    }
  }
  return { rows, errors: result.errors, warnings: result.warnings };
}

/** Parses a row once and builds its cell (null for an error). In Editor 1 the message of LDT/EAP/MSG lives in the comment column. */
function rowToCell(row: Editor1Row): { p: ParsedLine; cell: Cell | null } {
  const p = parseSourceLine(row.source, true);
  if (p.kind === 'error') return { p, cell: null };
  if (p.kind === 'instr' && p.def.shape === 'msg') {
    const message = p.message !== '' ? p.message : row.comment;
    return { p, cell: cellFromParsed({ ...p, message }, '') };
  }
  return { p, cell: cellFromParsed(p, row.comment) };
}

export function validateRow(row: Editor1Row): AsmError | null {
  return rowError(row, parseSourceLine(row.source, true));
}

function rowError(row: Editor1Row, p: ParsedLine): AsmError | null {
  if (row.addr < 0 || row.addr > MAX_ADDR) {
    return { addr: row.addr, line: 0, kind: 'instr', message: `SE LLENO LA MEMORIA (Dir: ${hex3(row.addr)})` };
  }
  if (p.kind === 'error') return { addr: row.addr, line: 0, kind: p.error, message: errorMessage(p.error, row.addr) };
  if (p.kind === 'instr' && p.def.code === 42 && p.message === '' && row.comment.trim() === '') {
    return { addr: row.addr, line: 0, kind: 'param', message: errorMessage('param', row.addr) };
  }
  return null;
}

/** "Enviar a Memoria": rows to cells, with the original's error messages. */
export function rowsToCells(rows: readonly Editor1Row[]): { cells: Map<number, Cell>; errors: AsmError[]; warnings: AsmWarning[] } {
  const cells = new Map<number, Cell>();
  const errors: AsmError[] = [];
  const warnings: AsmWarning[] = [];
  rows.forEach((row, i) => {
    const { p, cell } = rowToCell(row);
    const invalid = rowError(row, p);
    if (invalid) {
      errors.push({ ...invalid, line: i + 1 });
      return;
    }
    if (p.kind === 'error' || !cell) return;
    if (p.warning) warnings.push({ addr: row.addr, line: i + 1, message: `Dir ${hex3(row.addr)}: ${p.warning}` });
    cells.set(row.addr, cell);
  });
  return { cells, errors, warnings };
}

/** "Convertir a Editor 2": rows to text with #HEX directives where needed. */
export function rowsToText(rows: readonly Editor1Row[]): string {
  const writer = new AsmTextWriter();
  for (const row of rows) {
    const { cell } = rowToCell(row);
    if (cell) {
      writer.add(row.addr, cellToLine(cell));
    } else {
      writer.add(row.addr, row.comment !== '' ? `${row.source} ;${row.comment}` : row.source);
      // An error row may take no address (blank, comment only) or move it ('#...'): pin the next row.
      writer.pin();
    }
  }
  return writer.text();
}
