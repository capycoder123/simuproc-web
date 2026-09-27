import { describe, expect, it } from 'vitest';
import { mnemonicsOfClass } from '../../src/core';
import { DEFAULT_CONFIG } from '../../src/state/store';
import { APP_NAME, BUTTONS, MODIFY_TEXTS } from '../../src/state/texts';
import { applyHighlightColor } from '../../src/ui/highlightColors';
import { MAX_LISTED, capList } from '../../src/ui/listCap';
import { S } from '../../src/ui/strings';

describe('highlight colours', () => {
  it('leaves the theme colour alone unless a custom one is chosen', () => {
    const props = new Map<string, string>();
    const style = {
      setProperty: (k: string, v: string) => void props.set(k, v),
      removeProperty: (k: string) => void props.delete(k),
    };
    applyHighlightColor(style, '--read', DEFAULT_CONFIG.readColor, DEFAULT_CONFIG.readColor);
    expect(props.has('--read')).toBe(false);
    applyHighlightColor(style, '--read', '#123456', DEFAULT_CONFIG.readColor);
    expect(props.get('--read')).toBe('#123456');
    // The default in another case is still the default.
    applyHighlightColor(style, '--read', DEFAULT_CONFIG.readColor.toUpperCase(), DEFAULT_CONFIG.readColor);
    expect(props.has('--read')).toBe(false);
    applyHighlightColor(style, '--write', '#abcdef', DEFAULT_CONFIG.writeColor);
    expect([...props]).toEqual([['--write', '#abcdef']]);
  });
});

describe('capList', () => {
  it('keeps a short list whole', () => {
    const items = Array.from({ length: MAX_LISTED }, (_, i) => i);
    expect(capList(items)).toEqual({ shown: items, more: null });
  });

  it('shows the first 50 and counts the rest', () => {
    const items = Array.from({ length: 1234 }, (_, i) => `Error ${i}`);
    const { shown, more } = capList(items);
    expect(shown).toEqual(items.slice(0, 50));
    expect(more).toBe('… y 1184 más');
  });
});

describe('texts shared by the store and the UI', () => {
  it('S reuses the state texts, byte for byte', () => {
    expect(S.appName).toBe(APP_NAME);
    expect([S.buttons.aceptar, S.buttons.cancelar, S.buttons.si, S.buttons.no]).toEqual(['Aceptar', 'Cancelar', 'Sí', 'No']);
    expect([BUTTONS.aceptar, BUTTONS.cancelar, BUTTONS.si, BUTTONS.no]).toEqual(['Aceptar', 'Cancelar', 'Sí', 'No']);
    expect(S.modify.indique).toBe(MODIFY_TEXTS.indique);
    expect(S.modify.badDir).toBe('Dir de Mem No Válida, Solo Hexa desde 000 hasta FFF');
  });

  it('the Vigilante hint explains the d suffix of a decimal value', () => {
    expect(S.watch.placeholderValor).toContain('10d');
    expect(S.watch.formatoValor).toContain('sufijo d (10d = 10)');
  });
});

describe('Estadísticas', () => {
  it('"Aritméticas" lists every instruction the counter adds up', () => {
    expect(mnemonicsOfClass('arith')).toEqual(['ADD', 'SUB', 'MUL', 'DIV', 'ADDF', 'SUBF', 'MULF', 'DIVF', 'ITOF', 'FTOI']);
  });
});
