import { describe, expect, it } from 'vitest';
import { editBase, editIntField, initialIntState, stepBase, type IntField, type IntState } from '../../src/ui/windows/baseConversion';

const MSG_DECIMAL = 'Número Decimal No Válido';
const MSG_HEX = 'Valor Hexa no Válido, entre valores solo entre 0-9 y A-F';

/** Types `text` into `field` one character at a time, as the dialog's onChange does. */
function type(state: IntState, field: IntField, text: string): IntState {
  let s = state;
  for (let i = 1; i <= text.length; i++) s = editIntField(s, field, text.slice(0, i));
  return s;
}

describe('Conversión de bases: campos con texto no válido', () => {
  it('changing the base brings a field with invalid text back to the last valid value', () => {
    const typed = type(initialIntState(), 'decimal', '12x');
    expect(typed.error).toBe(MSG_DECIMAL);
    expect(typed.texts.decimal).toBe('12x');

    const stepped = stepBase(typed, +1);
    expect(stepped.texts.decimal).toBe('12');
    expect(stepped.texts.other).toBe('30');
    expect(stepped.error).toBe('');

    const edited = editBase(typed, '7');
    expect(edited.texts).toEqual({ decimal: '12', binary: '1100', hex: 'C', octal: '14', other: '15' });
    expect(edited.error).toBe('');
  });

  it('an invalid edit in another field re-syncs the earlier invalid text and shows only the new error', () => {
    const s = editIntField(type(initialIntState(), 'decimal', '12x'), 'hex', '-1');
    expect(s.error).toBe(MSG_HEX);
    expect(s.texts.hex).toBe('-1');
    expect(s.texts.decimal).toBe('12');
    expect(s.value).toBe(12n);
  });

  it('an invalid base keeps the fields and shows the base error', () => {
    const s = editBase(type(initialIntState(), 'decimal', '12'), '99');
    expect(s.texts.decimal).toBe('12');
    expect(s.error).not.toBe('');
  });
});

describe('Conversión de bases: vaciar un campo', () => {
  it('clearing a field also re-syncs a field that still held invalid text', () => {
    const s = editIntField(type(initialIntState(), 'decimal', '12x'), 'hex', '');
    expect(s.error).toBe('');
    expect(s.texts.hex).toBe('');
    expect(s.texts.decimal).toBe('12');
  });
});
