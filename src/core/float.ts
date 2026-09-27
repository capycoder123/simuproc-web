/** IEEE 754 single precision helpers. Every arithmetic result is rounded with Math.fround. */

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

/** Largest magnitude accepted by the float instructions of the original (spec: -2GB .. 2GB). */
export const FLOAT_LIMIT = 2147483647;

/**
 * FLOAT_LIMIT is not representable in single precision and rounds to 2^31, which is what
 * a keyboard value of ±2147483647 becomes once stored; results up to it are not an overflow.
 */
export const FLOAT_LIMIT_F32 = Math.fround(FLOAT_LIMIT);

export function floatToBits(f: number): number {
  f32[0] = f;
  return u32[0];
}

export function bitsToFloat(bits: number): number {
  u32[0] = bits >>> 0;
  return f32[0];
}

export function regsToFloat(bx: number, ax: number): number {
  return bitsToFloat(((bx & 0xffff) << 16) | (ax & 0xffff));
}

export function floatToRegs(f: number): { bx: number; ax: number } {
  const bits = floatToBits(f);
  return { bx: bits >>> 16, ax: bits & 0xffff };
}

/**
 * Text shown by OUT 1: rounded to `decimals` places, trailing zeros removed when
 * `stripZeros` is on (both are options of "Configurar SimuProc").
 */
export function formatFloat(f: number, decimals = 4, stripZeros = true): string {
  if (Number.isNaN(f)) return 'NaN';
  if (!Number.isFinite(f)) return f > 0 ? 'Infinito' : '-Infinito';
  let s = f.toFixed(Math.max(0, Math.min(20, decimals)));
  if (stripZeros && s.includes('.')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  if (s === '-0' || /^-0\.0*$/.test(s)) s = s.slice(1);
  return s;
}
