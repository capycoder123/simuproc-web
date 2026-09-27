import { describe, expect, it } from 'vitest';
import {
  convertAll,
  floatBreakdown,
  floatBreakdownFromBits,
  floatFromBitsText,
  floatFromDecimalText,
  formatInBase,
  parseInBase,
  readFloatBitsFromMemory,
  readFloatFromMemory,
  validateBase,
} from '../../src/core/bases';

const MSG_DECIMAL = 'Número Decimal No Válido';
const MSG_BINARY = 'Número Binario No Válido, entre solo 1 y 0s.';
const MSG_HEX = 'Valor Hexa no Válido, entre valores solo entre 0-9 y A-F';
const MSG_OCTAL = 'Número Octal No Válido, entre solo números entre 0 y 7.';

/** Memory reader over a sparse map of 16-bit words; empty cells read as 0. */
function wordsReader(words: Record<number, number>) {
  const calls: number[] = [];
  const readWord = (addr: number) => {
    calls.push(addr);
    return words[addr] ?? 0;
  };
  return { readWord, calls };
}

describe('parseInBase', () => {
  it('reads 255 written in each base', () => {
    expect(parseInBase('255', 10)).toEqual({ ok: true, value: 255n });
    expect(parseInBase('11111111', 2)).toEqual({ ok: true, value: 255n });
    expect(parseInBase('FF', 16)).toEqual({ ok: true, value: 255n });
    expect(parseInBase('377', 8)).toEqual({ ok: true, value: 255n });
    expect(parseInBase('100110', 3)).toEqual({ ok: true, value: 255n });
    expect(parseInBase('73', 36)).toEqual({ ok: true, value: 255n });
  });

  it('is case insensitive and accepts surrounding whitespace', () => {
    expect(parseInBase('  ff\t', 16)).toEqual({ ok: true, value: 255n });
    expect(parseInBase('zZ', 36)).toEqual({ ok: true, value: 1295n });
    expect(parseInBase(' 0007 ', 10)).toEqual({ ok: true, value: 7n });
  });

  it('keeps every digit of values larger than 32 bits', () => {
    expect(parseInBase('10000000000', 16)).toEqual({ ok: true, value: 2n ** 40n });
    expect(parseInBase('18446744073709551616', 10)).toEqual({ ok: true, value: 2n ** 64n });
    expect(parseInBase('1' + '0'.repeat(70), 2)).toEqual({ ok: true, value: 2n ** 70n });
    expect(parseInBase('10000000000000', 5)).toEqual({ ok: true, value: 5n ** 13n });
  });

  it('rejects invalid decimal numbers with the original message', () => {
    for (const text of ['12a', '-5', '+5', '1.5', '1 2', '', '   ']) {
      expect(parseInBase(text, 10)).toEqual({ ok: false, message: MSG_DECIMAL });
    }
  });

  it('rejects invalid binary, hexadecimal and octal numbers with the original messages', () => {
    expect(parseInBase('102', 2)).toEqual({ ok: false, message: MSG_BINARY });
    expect(parseInBase('FG', 16)).toEqual({ ok: false, message: MSG_HEX });
    expect(parseInBase('0x1F', 16)).toEqual({ ok: false, message: MSG_HEX });
    expect(parseInBase('78', 8)).toEqual({ ok: false, message: MSG_OCTAL });
  });

  it('uses the generic message for any other base', () => {
    expect(parseInBase('3', 3)).toEqual({ ok: false, message: 'Valor no válido para la base 3' });
    expect(parseInBase('K', 20)).toEqual({ ok: false, message: 'Valor no válido para la base 20' });
  });

  it('does not accept characters whose upper case looks like digits', () => {
    expect(parseInBase('ß', 36)).toEqual({ ok: false, message: 'Valor no válido para la base 36' });
    expect(parseInBase('ﬀ', 16)).toEqual({ ok: false, message: MSG_HEX });
    expect(parseInBase('١٢', 10)).toEqual({ ok: false, message: MSG_DECIMAL });
  });

  it('throws for a base outside 2..36', () => {
    expect(() => parseInBase('1', 1)).toThrow(RangeError);
    expect(() => parseInBase('1', 37)).toThrow(RangeError);
    expect(() => parseInBase('1', 2.5)).toThrow(RangeError);
  });
});

describe('validateBase', () => {
  it('accepts integers between 2 and 36', () => {
    expect(validateBase('2')).toEqual({ ok: true, base: 2 });
    expect(validateBase(' 16 ')).toEqual({ ok: true, base: 16 });
    expect(validateBase('36')).toEqual({ ok: true, base: 36 });
  });

  it('asks for a base when the field is empty', () => {
    expect(validateBase('')).toEqual({ ok: false, message: 'Introduzca una Base.' });
    expect(validateBase('   ')).toEqual({ ok: false, message: 'Introduzca una Base.' });
  });

  it('rejects other values with the original message', () => {
    for (const text of ['1', '0', '37', '100', 'abc', '2.5', '-3']) {
      expect(validateBase(text)).toEqual({
        ok: false,
        message: `${text} es un valor no válido, solo se aceptan bases entre 2 y 36.`,
      });
    }
  });
});

describe('formatInBase', () => {
  it('writes uppercase digits', () => {
    expect(formatInBase(255n, 16)).toBe('FF');
    expect(formatInBase(35n, 36)).toBe('Z');
    expect(formatInBase(0n, 7)).toBe('0');
    expect(formatInBase(2n ** 40n, 16)).toBe('10000000000');
  });

  it('throws for a base outside 2..36', () => {
    expect(() => formatInBase(1n, 1)).toThrow(RangeError);
    expect(() => formatInBase(1n, 37)).toThrow(RangeError);
  });
});

describe('convertAll', () => {
  it('converts decimal 255 to every base, its character and its length', () => {
    expect(convertAll(255n, 3)).toEqual({
      decimal: '255',
      binary: '11111111',
      hex: 'FF',
      octal: '377',
      other: '100110',
      ascii: 'ÿ',
      bits: 8,
    });
  });

  it('converts 0', () => {
    expect(convertAll(0n, 3)).toEqual({ decimal: '0', binary: '0', hex: '0', octal: '0', other: '0', ascii: 'NUL', bits: 1 });
  });

  it('converts a value larger than 32 bits', () => {
    const c = convertAll(2n ** 40n, 36);
    expect(c.decimal).toBe('1099511627776');
    expect(c.hex).toBe('10000000000');
    expect(c.binary).toBe('1' + '0'.repeat(40));
    expect(c.octal).toBe('20000000000000');
    expect(c.other).toBe('E13WU1OG');
    expect(c.bits).toBe(41);
    expect(c.ascii).toBe('SOH NUL NUL NUL NUL NUL');
  });

  it('names control characters, space and DEL', () => {
    const ascii = (n: number) => convertAll(BigInt(n), 3).ascii;
    expect(ascii(1)).toBe('SOH');
    expect(ascii(9)).toBe('HT');
    expect(ascii(10)).toBe('LF');
    expect(ascii(13)).toBe('CR');
    expect(ascii(27)).toBe('ESC');
    expect(ascii(31)).toBe('US');
    expect(ascii(32)).toBe('SP');
    expect(ascii(127)).toBe('DEL');
  });

  it('shows printable characters as themselves, 128..159 as Windows-1252', () => {
    const ascii = (n: number) => convertAll(BigInt(n), 3).ascii;
    expect(ascii(65)).toBe('A');
    expect(ascii(126)).toBe('~');
    expect(ascii(0x80)).toBe('€');
    expect(ascii(0x81)).toBe('HOP');
    expect(ascii(0x99)).toBe('™');
    expect(ascii(0xa0)).toBe('NBSP');
    expect(ascii(0xf1)).toBe('ñ');
  });

  it('shows a value above 255 as its bytes, most significant first', () => {
    expect(convertAll(0x4142n, 3).ascii).toBe('A B');
    expect(convertAll(0x100n, 3).ascii).toBe('SOH NUL');
    expect(convertAll(0x48_6f_6c_61n, 3).ascii).toBe('H o l a');
  });

  it('throws for a negative value', () => {
    expect(() => convertAll(-1n, 3)).toThrow(RangeError);
  });
});

describe('floatFromDecimalText', () => {
  it('accepts "." or "," as decimal separator, a sign and an exponent', () => {
    expect(floatFromDecimalText('100.25')).toEqual({ ok: true, value: 100.25 });
    expect(floatFromDecimalText(' 100,25 ')).toEqual({ ok: true, value: 100.25 });
    expect(floatFromDecimalText('-1.5')).toEqual({ ok: true, value: -1.5 });
    expect(floatFromDecimalText('+.5')).toEqual({ ok: true, value: 0.5 });
    expect(floatFromDecimalText('2.5e-3')).toEqual({ ok: true, value: 0.0025 });
    expect(floatFromDecimalText('1E10')).toEqual({ ok: true, value: 1e10 });
    expect(floatFromDecimalText('7')).toEqual({ ok: true, value: 7 });
  });

  it('rejects text that is not a decimal number', () => {
    for (const text of ['', 'abc', '1.2.3', '1,5,0', '1e', '--1', 'Infinity', 'NaN', '0x10', '1 000']) {
      expect(floatFromDecimalText(text)).toEqual({ ok: false, message: 'Número Decimal de punto flotante No Válido' });
    }
  });

  it('rejects magnitudes above the float32 range', () => {
    expect(floatFromDecimalText('3.5e38')).toEqual({ ok: false, message: 'Este Número no puede representarse en 32 bits' });
    expect(floatFromDecimalText('-1e39')).toEqual({ ok: false, message: 'Este Número no puede representarse en 32 bits' });
    expect(floatFromDecimalText('1e400')).toEqual({ ok: false, message: 'Este Número no puede representarse en 32 bits' });
    expect(floatFromDecimalText('3.4028235e38')).toEqual({ ok: true, value: 3.4028235e38 });
  });
});

describe('floatFromBitsText', () => {
  it('reads exactly 32 binary digits', () => {
    expect(floatFromBitsText('01000010110010001000000000000000')).toEqual({ ok: true, value: 100.25, bits: 0x42c88000 });
    expect(floatFromBitsText(' 10111111110000000000000000000000 ')).toEqual({ ok: true, value: -1.5, bits: 0xbfc00000 });
  });

  it('asks for the 32 bits when the length is not 32', () => {
    expect(floatFromBitsText('')).toEqual({ ok: false, message: 'Ingrese los 32 bits' });
    expect(floatFromBitsText('0100')).toEqual({ ok: false, message: 'Ingrese los 32 bits' });
    expect(floatFromBitsText('0'.repeat(33))).toEqual({ ok: false, message: 'Ingrese los 32 bits' });
  });

  it('rejects 32 characters that are not all 0 or 1', () => {
    expect(floatFromBitsText('0100001011001000100000000000000' + '2')).toEqual({ ok: false, message: 'Número de punto flotante No Válido' });
    expect(floatFromBitsText('x'.repeat(32))).toEqual({ ok: false, message: 'Número de punto flotante No Válido' });
  });
});

describe('floatBreakdown', () => {
  it('breaks down 100.25', () => {
    expect(floatBreakdown(100.25)).toEqual({
      bits: '01000010110010001000000000000000',
      sign: '0',
      exponent: '10000101',
      mantissa: '10010001000000000000000',
      exponentDecimal: 133,
      decimalText: '100.25',
    });
  });

  it('breaks down -1.5', () => {
    expect(floatBreakdown(-1.5)).toEqual({
      bits: '10111111110000000000000000000000',
      sign: '1',
      exponent: '01111111',
      mantissa: '10000000000000000000000',
      exponentDecimal: 127,
      decimalText: '-1.5',
    });
  });

  it('breaks down 0', () => {
    expect(floatBreakdown(0)).toEqual({
      bits: '0'.repeat(32),
      sign: '0',
      exponent: '00000000',
      mantissa: '0'.repeat(23),
      exponentDecimal: 0,
      decimalText: '0',
    });
  });

  it('prints the float32 value without trailing zeros', () => {
    expect(floatBreakdown(0.1).decimalText).toBe('0.1');
    expect(floatBreakdown(0.7).decimalText).toBe('0.7');
    expect(floatBreakdown(3.14159).decimalText).toBe('3.14159');
    expect(floatBreakdown(1 / 3).decimalText).toBe('0.33333334');
    expect(floatBreakdown(1e-10).decimalText).toBe('1e-10');
    expect(floatBreakdown(3.4028235e38).decimalText).toBe('3.4028235e+38');
  });

  it('prints a decimal text that parses back to the same float32', () => {
    for (const bits of [0x08a805a2, 0x71636b28]) {
      const shown = floatBreakdownFromBits(bits);
      const parsed = floatFromDecimalText(shown.decimalText);
      expect(parsed.ok, shown.decimalText).toBe(true);
      if (parsed.ok) expect(floatBreakdown(parsed.value).bits, shown.decimalText).toBe(shown.bits);
    }
    let seed = 12345;
    const next = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0);
    for (let i = 0; i < 20000; i++) {
      const bits = next();
      if (((bits >>> 23) & 0xff) === 0xff) continue;
      const shown = floatBreakdownFromBits(bits);
      const parsed = floatFromDecimalText(shown.decimalText);
      if (!parsed.ok || floatBreakdown(parsed.value).bits !== shown.bits) expect.fail(`${bits.toString(16)} -> ${shown.decimalText}`);
    }
  });

  it('prints integers without a decimal point, after rounding to float32', () => {
    expect(floatBreakdown(100).decimalText).toBe('100');
    expect(floatBreakdown(-7).decimalText).toBe('-7');
    expect(floatBreakdown(16777217).decimalText).toBe('16777216');
    expect(floatBreakdown(123456789).decimalText).toBe('123456792');
  });

  it('rounds the value to float32 before taking its bits', () => {
    expect(floatBreakdown(0.1).bits).toBe('00111101110011001100110011001101');
    expect(floatBreakdown(-0).sign).toBe('1');
    expect(floatBreakdown(-0).decimalText).toBe('-0');
  });
});

describe('floatBreakdownFromBits', () => {
  it('matches floatBreakdown for ordinary values', () => {
    expect(floatBreakdownFromBits(0x42c88000)).toEqual(floatBreakdown(100.25));
  });

  it('keeps the exact bits of NaN and infinities', () => {
    const nan = floatBreakdownFromBits(0x7fc00001);
    expect(nan.bits).toBe('01111111110000000000000000000001');
    expect(nan.exponentDecimal).toBe(255);
    expect(nan.decimalText).toBe('NaN');
    expect(floatBreakdownFromBits(0x7f800000).decimalText).toBe('Infinito');
    expect(floatBreakdownFromBits(0xff800000).decimalText).toBe('-Infinito');
  });
});

describe('readFloatFromMemory', () => {
  it('reads the high half at addr and the low half at addr + 1', () => {
    const { readWord, calls } = wordsReader({ 0x20: 0x42c8, 0x21: 0x8000 });
    expect(readFloatFromMemory(readWord, 0x20)).toBe(100.25);
    expect(calls).toEqual([0x20, 0x21]);
  });

  it('accepts the last pair of cells and rejects an address without a next cell', () => {
    const { readWord, calls } = wordsReader({ 0xffe: 0xbfc0, 0xfff: 0x0000 });
    expect(readFloatFromMemory(readWord, 0xffe)).toBe(-1.5);
    expect(readFloatFromMemory(readWord, 0xfff)).toBeNull();
    expect(readFloatFromMemory(readWord, -1)).toBeNull();
    expect(readFloatFromMemory(readWord, 1.5)).toBeNull();
    expect(calls).toEqual([0xffe, 0xfff]);
  });

  it('gives the raw 32-bit pattern, ignoring bits above 16 in each word', () => {
    const { readWord } = wordsReader({ 0x10: 0x1ffff, 0x11: 0xffff });
    expect(readFloatBitsFromMemory(readWord, 0x10)).toBe(0xffffffff);
    expect(readFloatBitsFromMemory(readWord, 0xfff)).toBeNull();
  });
});
