import { MEM_SIZE, classifyText, lastUsedAddress } from '../memory';
import { DIALOG_TEXTS } from '../texts';
import type { Cell } from '../types';

export const SMP_LINE1 = 'SimuProc 1.4 - Vlaye';
export const SMP_LINE2_DEFAULT = '1ba';

export interface SmpHeader {
  line1: string;
  line2: string;
  line3: string;
}

export interface SmpDocument {
  header: SmpHeader;
  cells: Map<number, Cell>;
}

export class SmpFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmpFormatError';
  }
}

/**
 * .smp layout (from the two official files): line 1 "SimuProc 1.4 - Vlaye", lines 2-3 of
 * unknown meaning kept verbatim, lines 4-6 empty, then two lines per address from 000:
 * the cell text and the cell comment. The file ends after the last written address.
 */
export function parseSmp(content: string): SmpDocument {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '' && content.endsWith('\n')) lines.pop();
  if (lines.length === 0 || !lines[0].startsWith('SimuProc')) {
    throw new SmpFormatError(DIALOG_TEXTS.archivoNoValido);
  }
  const header: SmpHeader = { line1: lines[0], line2: lines[1] ?? SMP_LINE2_DEFAULT, line3: lines[2] ?? '' };
  const cells = new Map<number, Cell>();
  let addr = 0;
  for (let i = 6; i < lines.length; i += 2) {
    const text = lines[i];
    const comment = lines[i + 1] ?? '';
    if (text !== '' || comment !== '') {
      // A written cell past FFF does not fit in memory: reject the file before anything is loaded.
      if (addr >= MEM_SIZE) throw new SmpFormatError(DIALOG_TEXTS.archivoNoValido);
      cells.set(addr, { text, comment, origin: classifyText(text) });
    }
    addr++;
  }
  return { header, cells };
}

/** Serializes the full memory (4096 cells) as an .smp file (LF line endings). */
export function serializeSmp(cells: readonly Cell[], header?: Partial<SmpHeader>): string {
  const last = lastUsedAddress(cells);
  const body: string[] = [];
  for (let a = 0; a <= last; a++) body.push(cells[a].text, cells[a].comment);
  const lineCount = 6 + body.length;
  const line3 = header?.line3 ?? (lineCount + 1).toString(16);
  const out = [header?.line1 ?? SMP_LINE1, header?.line2 ?? SMP_LINE2_DEFAULT, line3, '', '', '', ...body];
  return out.join('\n') + '\n';
}
