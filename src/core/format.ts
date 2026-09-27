import type { Bit } from './types';

/** Three-digit uppercase hexadecimal address, as the original shows it. */
export function hex3(n: number): string {
  return n.toString(16).toUpperCase().padStart(3, '0');
}

/** Sixteen-digit binary word. */
export function bin16(n: number): string {
  return (n & 0xffff).toString(2).padStart(16, '0');
}

/** Thirty-two-digit binary word (BX:AX). */
export function bin32(bx: number, ax: number): string {
  return bin16(bx) + bin16(ax);
}

/**
 * Decimal shown by EAP and by "Último Dato": when N=1 and bit 15 of AX is set
 * the value is shown as a two's-complement negative number.
 */
export function displayDecimal(ax: number, n: Bit): number {
  return n === 1 && (ax & 0x8000) !== 0 ? ax - 0x10000 : ax;
}

export function code2(code: number): string {
  return code.toString().padStart(2, '0');
}
