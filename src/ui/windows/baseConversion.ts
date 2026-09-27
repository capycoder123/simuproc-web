/** State and pure reducers of the "Conversión de bases" window (BaseConversionDialog.tsx). */

import {
  MAX_BASE,
  MIN_BASE,
  convertAll,
  floatBreakdown,
  floatBreakdownFromBits,
  floatFromBitsText,
  floatFromDecimalText,
  formatInBase,
  parseInBase,
  validateBase,
  type FloatBreakdown,
} from '../../core/bases';

export type IntField = 'decimal' | 'binary' | 'hex' | 'octal' | 'other';

const FIXED_BASE: Readonly<Record<Exclude<IntField, 'other'>, number>> = { decimal: 10, binary: 2, hex: 16, octal: 8 };

const DEFAULT_BASE = 3;

export interface IntState {
  texts: Record<IntField, string>;
  baseText: string;
  /** Last valid value: every field shows it except the one holding the user's text. */
  value: bigint;
  ascii: string;
  bits: number;
  error: string;
}

export interface FloatState {
  decText: string;
  binText: string;
  parts: FloatBreakdown;
  error: string;
}

export function initialIntState(): IntState {
  const c = convertAll(0n, DEFAULT_BASE);
  return {
    texts: { decimal: c.decimal, binary: c.binary, hex: c.hex, octal: c.octal, other: c.other },
    baseText: String(DEFAULT_BASE),
    value: 0n,
    ascii: c.ascii,
    bits: c.bits,
    error: '',
  };
}

export function floatStateFrom(parts: FloatBreakdown): FloatState {
  return { decText: parts.decimalText, binText: parts.bits, parts, error: '' };
}

/** Shows `value` in every field but `typed`. With an invalid base, "Otra Base" keeps its text and the base error shows. */
function showValue(state: IntState, value: bigint, typed: IntField): IntState {
  const base = validateBase(state.baseText);
  const c = convertAll(value, base.ok ? base.base : DEFAULT_BASE);
  const texts: Record<IntField, string> = {
    decimal: c.decimal,
    binary: c.binary,
    hex: c.hex,
    octal: c.octal,
    other: base.ok ? c.other : state.texts.other,
  };
  texts[typed] = state.texts[typed];
  return { ...state, texts, value, ascii: c.ascii, bits: c.bits, error: base.ok ? '' : base.message };
}

export function editIntField(state: IntState, field: IntField, text: string): IntState {
  const next: IntState = { ...state, texts: { ...state.texts, [field]: text } };
  // Every other field goes back to the last valid value, so only the edited one can hold invalid text.
  if (text.trim() === '') return { ...showValue(next, state.value, field), error: '' };
  let base: number;
  if (field === 'other') {
    const valid = validateBase(state.baseText);
    if (!valid.ok) return { ...next, error: valid.message };
    base = valid.base;
  } else {
    base = FIXED_BASE[field];
  }
  const parsed = parseInBase(text, base);
  return parsed.ok ? showValue(next, parsed.value, field) : { ...showValue(next, state.value, field), error: parsed.message };
}

export function editBase(state: IntState, text: string): IntState {
  const next: IntState = { ...state, baseText: text };
  const valid = validateBase(text);
  if (!valid.ok) return { ...next, error: valid.message };
  return showValue({ ...next, texts: { ...state.texts, other: formatInBase(state.value, valid.base) } }, state.value, 'other');
}

/** Arrow keys on the base field step it like the original's up-down control. */
export function stepBase(state: IntState, delta: number): IntState {
  const valid = validateBase(state.baseText);
  const current = valid.ok ? valid.base : DEFAULT_BASE;
  return editBase(state, String(Math.min(MAX_BASE, Math.max(MIN_BASE, current + delta))));
}

export function editFloatDecimal(state: FloatState, text: string): FloatState {
  const next: FloatState = { ...state, decText: text };
  if (text.trim() === '') return { ...next, error: '' };
  const parsed = floatFromDecimalText(text);
  if (!parsed.ok) return { ...next, error: parsed.message };
  const parts = floatBreakdown(parsed.value);
  return { ...next, binText: parts.bits, parts, error: '' };
}

export function editFloatBits(state: FloatState, text: string): FloatState {
  const next: FloatState = { ...state, binText: text };
  if (text.trim() === '') return { ...next, error: '' };
  const parsed = floatFromBitsText(text);
  if (!parsed.ok) return { ...next, error: parsed.message };
  const parts = floatBreakdownFromBits(parsed.bits);
  return { ...next, decText: parts.decimalText, parts, error: '' };
}
