import { FLOAT_LIMIT } from './float';
import type { KeyboardMode } from './types';

export type KeyboardParse = { ok: true; value: number } | { ok: false; message: string };

const err = (message: string): KeyboardParse => ({ ok: false, message });
const ok = (value: number): KeyboardParse => ({ ok: true, value });

/** Validation of the "Dispositivos de E/S" keyboard, with the original's messages. */
export function parseKeyboardInput(raw: string, mode: KeyboardMode): KeyboardParse {
  const s = raw.trim();
  switch (mode) {
    case 'decimal': {
      if (!/^\d+$/.test(s)) return err('Numero Decimal No Válido');
      const v = Number(s);
      if (v > 65535) return err('El número esta muy Grande');
      return ok(v);
    }
    case 'binario': {
      if (!/^[01]+$/.test(s)) return err('Numero Binario No Válido, entre solo 1 y 0s.');
      if (s.length > 16) return err('El número esta muy Grande');
      return ok(parseInt(s, 2));
    }
    case 'float': {
      const t = s.replace(',', '.');
      if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return err('Numero No Válido');
      const v = Number(t);
      if (v > FLOAT_LIMIT) return err('El número esta muy Grande');
      if (v < -FLOAT_LIMIT) return err('El número esta muy Pequeño');
      return ok(v);
    }
  }
}
