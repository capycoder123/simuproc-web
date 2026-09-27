/**
 * Pure logic of the "Conversión de bases" utility window of the original: conversion of
 * non-negative integers of any size between bases 2..36 (with bigint, "se pueden convertir
 * numeros mas grandes"), the Ascii view of a value, and the IEEE 754 single-precision
 * breakdown of real numbers. Messages are the original's texts.
 */
import { bitsToFloat, floatToBits } from './float';
import { MAX_ADDR } from './memory';

export type BaseParseResult = { ok: true; value: bigint } | { ok: false; message: string };
export type BaseValidation = { ok: true; base: number } | { ok: false; message: string };
export type FloatParseResult = { ok: true; value: number } | { ok: false; message: string };
/** `bits` is the 32-bit pattern as typed, so NaN payloads survive (a float round trip may not keep them). */
export type FloatBitsParseResult = { ok: true; value: number; bits: number } | { ok: false; message: string };

export interface BaseConversions {
  decimal: string;
  binary: string;
  hex: string;
  octal: string;
  /** The value in the base chosen for "Otra Base". */
  other: string;
  ascii: string;
  /** Length of the binary form ("Longitud = N Bits"). */
  bits: number;
}

export interface FloatBreakdown {
  /** The 32 bits, sign first. */
  bits: string;
  /** 1 character. */
  sign: string;
  /** 8 characters: the biased exponent. */
  exponent: string;
  /** 23 characters: the fraction without the hidden bit. */
  mantissa: string;
  /** The biased exponent in decimal ("Exp D."). */
  exponentDecimal: number;
  decimalText: string;
}

export const MIN_BASE = 2;
export const MAX_BASE = 36;
/** Largest magnitude accepted for a single-precision float. */
export const FLOAT32_MAX = 3.4028235e38;

const MSG_BASE_EMPTY = 'Introduzca una Base.';
const MSG_FLOAT_DECIMAL = 'Número Decimal de punto flotante No Válido';
const MSG_FLOAT_RANGE = 'Este Número no puede representarse en 32 bits';
const MSG_FLOAT_LENGTH = 'Ingrese los 32 bits';
const MSG_FLOAT_BITS = 'Número de punto flotante No Válido';

/** Messages of the fields with a fixed base; any other base uses the generic one. */
const INVALID_VALUE: Readonly<Partial<Record<number, string>>> = {
  10: 'Número Decimal No Válido',
  2: 'Número Binario No Válido, entre solo 1 y 0s.',
  16: 'Valor Hexa no Válido, entre valores solo entre 0-9 y A-F',
  8: 'Número Octal No Válido, entre solo números entre 0 y 7.',
};

/** JS literal prefixes that let BigInt parse long inputs natively. */
const NATIVE_PREFIX: Readonly<Partial<Record<number, string>>> = { 2: '0b', 8: '0o', 10: '', 16: '0x' };

function invalidValueMessage(base: number): string {
  return INVALID_VALUE[base] ?? `Valor no válido para la base ${base}`;
}

function assertBase(base: number): void {
  if (!Number.isInteger(base) || base < MIN_BASE || base > MAX_BASE) {
    throw new RangeError(`base must be an integer between ${MIN_BASE} and ${MAX_BASE}, got ${base}`);
  }
}

/**
 * Value of one digit (0-9, then A-Z in either case), or -1. Works on the character as
 * typed: upper-casing first would turn characters such as "ß" into valid digits ("SS").
 */
function digitValue(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 65 && c <= 90) return c - 55;
  if (c >= 97 && c <= 122) return c - 87;
  return -1;
}

/**
 * Parses a non-negative integer written in `base` (2..36): digits 0-9 then A-Z, case
 * insensitive, surrounding whitespace allowed, no sign. Throws RangeError for a base
 * outside 2..36 (validate user input with `validateBase` first).
 */
export function parseInBase(text: string, base: number): BaseParseResult {
  assertBase(base);
  const digits = text.trim();
  if (digits === '') return { ok: false, message: invalidValueMessage(base) };
  for (const ch of digits) {
    const d = digitValue(ch);
    if (d < 0 || d >= base) return { ok: false, message: invalidValueMessage(base) };
  }
  const prefix = NATIVE_PREFIX[base];
  if (prefix !== undefined) return { ok: true, value: BigInt(prefix + digits) };
  const radix = BigInt(base);
  let value = 0n;
  for (const ch of digits) value = value * radix + BigInt(digitValue(ch));
  return { ok: true, value };
}

/** Validates the text of the "Base" field of "Otra Base". */
export function validateBase(text: string): BaseValidation {
  const t = text.trim();
  if (t === '') return { ok: false, message: MSG_BASE_EMPTY };
  const base = /^\d+$/.test(t) ? Number(t) : NaN;
  if (!(base >= MIN_BASE && base <= MAX_BASE)) {
    return { ok: false, message: `${t} es un valor no válido, solo se aceptan bases entre 2 y 36.` };
  }
  return { ok: true, base };
}

/** Writes `value` in `base` (2..36) with uppercase digits. Throws RangeError for another base. */
export function formatInBase(value: bigint, base: number): string {
  assertBase(base);
  return value.toString(base).toUpperCase();
}

const CONTROL_NAMES = [
  'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
  'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US',
] as const;

/**
 * Bytes 0x80..0x9F as the original shows them: Windows-1252, the ANSI code page it ran on
 * (0xA0..0xFF match Latin-1). The five positions Windows-1252 leaves undefined are the C1
 * control characters of Latin-1, so they are shown by name like the other controls.
 */
const CP1252_80_9F = [
  '€', 'HOP', '‚', 'ƒ', '„', '…', '†', '‡',
  'ˆ', '‰', 'Š', '‹', 'Œ', 'RI', 'Ž', 'SS3',
  'DCS', '‘', '’', '“', '”', '•', '–', '—',
  '˜', '™', 'š', '›', 'œ', 'OSC', 'ž', 'Ÿ',
] as const;

/** One byte as a character; control and invisible characters (SP, NBSP, SHY) by name. */
function byteText(b: number): string {
  if (b < 0x20) return CONTROL_NAMES[b];
  if (b === 0x20) return 'SP';
  if (b === 0x7f) return 'DEL';
  if (b >= 0x80 && b <= 0x9f) return CP1252_80_9F[b - 0x80];
  if (b === 0xa0) return 'NBSP';
  if (b === 0xad) return 'SHY';
  return String.fromCharCode(b);
}

/** A byte value as one character; a larger value as its bytes, most significant first. */
function asciiText(value: bigint): string {
  if (value <= 0xffn) return byteText(Number(value));
  const bytes: string[] = [];
  for (let v = value; v > 0n; v >>= 8n) bytes.push(byteText(Number(v & 0xffn)));
  return bytes.reverse().join(' ');
}

/** Every view of the window for a non-negative `value`. Throws RangeError for a negative value or an invalid base. */
export function convertAll(value: bigint, otherBase: number): BaseConversions {
  if (value < 0n) throw new RangeError('value must not be negative');
  const binary = formatInBase(value, 2);
  return {
    decimal: value.toString(10),
    binary,
    hex: formatInBase(value, 16),
    octal: formatInBase(value, 8),
    other: formatInBase(value, otherBase),
    ascii: asciiText(value),
    bits: binary.length,
  };
}

const FLOAT_DECIMAL_RE = /^[+-]?(\d+[.,]?\d*|[.,]\d+)([eE][+-]?\d+)?$/;

/**
 * Parses the "Base 10" field of "Numeros de Punto Flotante": decimal separator "." or ",",
 * optional sign and exponent. `value` is the number as typed (a double); the float32
 * rounding happens in `floatBreakdown`.
 */
export function floatFromDecimalText(text: string): FloatParseResult {
  const t = text.trim();
  if (!FLOAT_DECIMAL_RE.test(t)) return { ok: false, message: MSG_FLOAT_DECIMAL };
  const value = Number(t.replace(',', '.'));
  if (Math.abs(value) > FLOAT32_MAX) return { ok: false, message: MSG_FLOAT_RANGE };
  return { ok: true, value };
}

/** Parses the "Base 2: formato IEEE 754 - 32 bits" field: exactly 32 binary digits. */
export function floatFromBitsText(text: string): FloatBitsParseResult {
  const t = text.trim();
  if (t.length !== 32) return { ok: false, message: MSG_FLOAT_LENGTH };
  if (!/^[01]{32}$/.test(t)) return { ok: false, message: MSG_FLOAT_BITS };
  const bits = parseInt(t, 2) >>> 0;
  return { ok: true, value: bitsToFloat(bits), bits };
}

/** 9 significant digits always give back the same float32; 8 do not for about 1% of values. */
const MAX_SIGNIFICANT_DIGITS = 9;

/** Removes trailing zeros of the fraction, keeping any exponent: "1.2500" -> "1.25", "1.00e-10" -> "1e-10". */
function stripFractionZeros(s: string): string {
  const e = s.indexOf('e');
  const mantissa = e < 0 ? s : s.slice(0, e);
  const exponent = e < 0 ? '' : s.slice(e);
  const trimmed = mantissa.includes('.') ? mantissa.replace(/0+$/, '').replace(/\.$/, '') : mantissa;
  return trimmed + exponent;
}

/**
 * Decimal text of a float32 value: integers (below 1e21) in full without a decimal point,
 * other values with the fewest significant digits (at most 9) that give back the same
 * float32, without trailing zeros. NaN and infinities print as formatFloat prints them.
 */
function float32Text(value: number): string {
  const f = Math.fround(value);
  if (Number.isNaN(f)) return 'NaN';
  if (!Number.isFinite(f)) return f > 0 ? 'Infinito' : '-Infinito';
  if (Object.is(f, -0)) return '-0';
  if (Number.isInteger(f) && Math.abs(f) < 1e21) return BigInt(f).toString();
  let text = f.toPrecision(MAX_SIGNIFICANT_DIGITS);
  for (let p = 1; p < MAX_SIGNIFICANT_DIGITS; p++) {
    const candidate = f.toPrecision(p);
    if (Math.fround(Number(candidate)) === f) {
      text = candidate;
      break;
    }
  }
  return stripFractionZeros(text);
}

/** Breakdown of a 32-bit pattern (taken as unsigned) into sign, biased exponent and mantissa. */
export function floatBreakdownFromBits(bits: number): FloatBreakdown {
  const b = bits >>> 0;
  const text = b.toString(2).padStart(32, '0');
  return {
    bits: text,
    sign: text.slice(0, 1),
    exponent: text.slice(1, 9),
    mantissa: text.slice(9),
    exponentDecimal: (b >>> 23) & 0xff,
    decimalText: float32Text(bitsToFloat(b)),
  };
}

/** IEEE 754 single-precision breakdown of `value` after rounding it to float32. */
export function floatBreakdown(value: number): FloatBreakdown {
  return floatBreakdownFromBits(floatToBits(Math.fround(value)));
}

/**
 * The 32-bit pattern stored like LDF reads it: high half at `addr`, low half at `addr + 1`.
 * Null when `addr` is not a whole address or `addr + 1` is past the last cell (0xFFF).
 */
export function readFloatBitsFromMemory(readWord: (addr: number) => number, addr: number): number | null {
  if (!Number.isInteger(addr) || addr < 0 || addr + 1 > MAX_ADDR) return null;
  const hi = readWord(addr) & 0xffff;
  const lo = readWord(addr + 1) & 0xffff;
  return ((hi << 16) | lo) >>> 0;
}

/** The float stored at `addr` and `addr + 1` (BX-like high half first), or null for an invalid address. */
export function readFloatFromMemory(readWord: (addr: number) => number, addr: number): number | null {
  const bits = readFloatBitsFromMemory(readWord, addr);
  return bits === null ? null : bitsToFloat(bits);
}
