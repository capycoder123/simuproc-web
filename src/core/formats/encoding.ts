/** Text encodings of the original's files: UTF-8 when valid, otherwise Windows-1252. */

const CP1252_HIGH: readonly number[] = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];

const CP1252_REVERSE = new Map<number, number>();
CP1252_HIGH.forEach((cp, i) => CP1252_REVERSE.set(cp, 0x80 + i));

export function decodeCp1252(bytes: Uint8Array): string {
  const chars = new Array<string>(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    chars[i] = String.fromCharCode(b >= 0x80 && b < 0xa0 ? CP1252_HIGH[b - 0x80] : b);
  }
  return chars.join('');
}

/** Characters that CP1252 cannot encode become '?'. */
export function encodeCp1252(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) out[i] = cp;
    else out[i] = CP1252_REVERSE.get(cp) ?? 0x3f;
  }
  return out;
}

export type ProgramEncoding = 'utf-8' | 'cp1252';

/** Decodes a program file: UTF-8 when the bytes are valid UTF-8, otherwise CP1252. */
export function decodeProgramBytes(bytes: Uint8Array): { text: string; encoding: ProgramEncoding } {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: decodeCp1252(bytes), encoding: 'cp1252' };
  }
}

export function normalizeLineEndings(text: string, ending: '\r\n' | '\n'): string {
  return text.replace(/\r\n|\r|\n/g, ending);
}

/** Bytes of an .asm/.txt file as the original on Windows writes them: CP1252 with CRLF. */
export function encodeAsmFile(text: string): Uint8Array {
  return encodeCp1252(normalizeLineEndings(text, '\r\n'));
}

/** Bytes of an .smp file: CP1252 with LF, like the two official samples. */
export function encodeSmpFile(text: string): Uint8Array {
  return encodeCp1252(normalizeLineEndings(text, '\n'));
}
