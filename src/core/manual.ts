import { cellFromParsed } from './formats/asm';
import type { InstrDef } from './isa';
import {
  operandsToText,
  parseAddress,
  parseOperands,
  parseReg,
  parseRegOrMem,
  REG3 as REG3_SET,
  REG4 as REG4_SET,
  type Operand,
} from './operands';
import type { Cell } from './types';

/**
 * "Entrada de Instrucciones Manualmente": validation of the parameters typed for an
 * instruction of the list, with the original's messages e1..e35 (smpr_esp.lng).
 * The mapping of each text to an instruction shape is inferred from its examples.
 */
export type ManualResult = { ok: true; cell: Cell; text: string } | { ok: false; message: string };

const REG4 = 'AX BX CX BP';
const MAX = 'FFF';
const E = {
  e1: `Introduzca un Registro: ${REG4}`,
  e2: `Introduzca un Registro Válido: ${REG4}`,
  e3: `Introduzca un Registro: ${REG4}, ó una Dir de mem desde 000 hasta ${MAX}`,
  e4: `Registro no válido...Introduzca un Registro Válido: ${REG4}, o una Dir de Mem.`,
  e5: 'Introduzca un destino y un origen, pueden ser registros o dir de memoria.',
  e6: 'Parámetro no válido, ejemplos: AX,CX ó 1F,BX ó 1,21 ó CX,1A  Separelos con una coma.',
  e7: 'No especificó una dirección o registro de Origen válido. Ejs: AX,BX ó 2F,1A ó BX,2F',
  e8: 'No especificó una dirección o registro de Destino válido. Ejs: CX,BX ó 31F,1D ó CX,2E',
  e9: `Registro de Origen no válido... Introduzca un Reg Válido: ${REG4}, o una Dir de Mem.`,
  e10: `Registro de Destino no válido... Introduzca un Reg Válido: ${REG4}, o una Dir de Mem.`,
  e11: `Introduzca un Registro: AX BX CX, ó una Dir de mem desde 000 hasta ${MAX}`,
  e12: 'Registro no válido...Introduzca un Registro Válido: AX BX CX, o una Dir de Mem.',
  e13: 'Entre un destino y número de veces, puede ser un registro o dir de memoria.',
  e14: 'Parámetro no válido, ejemplos: AX,4 ó 3B,14 ó 111,2  Separelos con una coma.',
  e15: 'No especifico un Número de veces a realizar la operación. Ejs: AX,4 ó 3B,14 ó BX,7',
  e16: 'Numero de veces muy grande. Ejs: AX,4 ó 3B,15 ó BX,7',
  e17: 'No especificó una dirección o registro de Destino válido. Ejs: CX,1 ó 31F,14 ó CX,22',
  e18: 'El Número de veces Esta muy Grande.',
  e19: 'Número de veces NO válido. Ejs: AX,3 ó 1C3,11 ó BX,2',
  e20: `Introduzca una Dirección de Memoria en Hexadecimal, el rango va desde 000 hasta ${MAX}`,
  e21: `Dir de Mem No Válida, Solo Hexa desde 000 hasta ${MAX}`,
  e22: 'No hay nada que Borrar!!',
  e23: 'Valor Hexa no Válido, entre valores solo entre 0-9 y A-F',
  e24: 'Entre un destino y puerto de entrada, el destino es cualquier registro.',
  e25: 'Parámetro no válido, ejemplos: AX,12 ó BX,1  Separelos con una coma.',
  e26: 'No especifico un puerto. Ejs: AX,4 ó CX,14 ó BX,9',
  e27: 'Puerto muy grande. Ejs: AX,4 ó BX,1 ó CX,2',
  e28: 'No especificó un registro de Destino válido. Ejs: CX,1 ó BX,14 ó CX,12',
  e29: 'Puerto NO válido. Ejs: AX,3 ó CX,11 ó BX,2',
  e30: 'Entre un puerto de salida, y un origen, el origen es cualquier registro.',
  e31: 'Parámetro no válido, ejemplos: 12,AX ó 1,BX  Separelos con una coma.',
  e32: 'No especificó un registro de origen válido. Ejs: 1,AX ó 14,BX ó 12,CX',
  e33: 'Puerto NO válido. Ejs: 3,AX ó 11,CX ó 2,BX',
  e34: 'Puerto muy grande. Ejs: 4,AX ó 1,BX ó 2,CX',
  e35: 'No especificó un registro de Origen válido. Ejs: 1,CX ó 14,BX ó 12,CX',
} as const;

export const MANUAL_TEXTS = {
  ...E,
  seleccione: 'Debe Seleccionar una Instrucción.',
  anadida: 'Se añadió la instrucción: ',
  borrada: 'Se Borró la Ultima Instrucción',
  memoriaLlena: 'SE LLENO LA MEMORIA',
  /** Not an original text: MSG needs a message, as in the Editors (docs/fidelidad.md). */
  mensajeVacio: 'Escriba el mensaje de MSG en el comentario.',
} as const;

// The same register and address rules as parseOperands, so every accepted entry assembles.
const isReg = (s: string, regs: readonly string[]) => parseReg(s, regs) !== null;
const isRegOrMem = (s: string, regs: readonly string[]) => parseRegOrMem(s, regs) !== null;

/** Validates the address typed in "a partir de esta dirección de memoria". */
export function validateManualAddress(text: string): { ok: true; addr: number } | { ok: false; message: string } {
  const t = text.trim();
  if (t === '') return { ok: false, message: E.e20 };
  if (!/^[0-9A-Fa-f]{1,3}[Hh]?$/.test(t)) return { ok: false, message: /^[0-9A-Fa-f]+[Hh]?$/.test(t) ? E.e21 : E.e23 };
  const a = parseAddress(t);
  return a ? { ok: true, addr: a.addr } : { ok: false, message: E.e21 };
}

function shapeError(def: InstrDef, raw: string): string | null {
  const t = raw.trim();
  const parts = t.split(',').map((p) => p.trim());
  switch (def.shape) {
    case 'none':
    case 'msg':
      return null;
    case 'mem':
      if (t === '') return E.e20;
      return parseAddress(t) ? null : E.e21;
    case 'reg4':
      if (t === '') return E.e1;
      return isReg(t, REG4_SET) ? null : E.e2;
    case 'dest4':
      if (t === '') return E.e3;
      return isRegOrMem(t, REG4_SET) ? null : E.e4;
    case 'mov':
      if (t === '') return E.e5;
      if (parts.length !== 2) return E.e6;
      if (parts[0] === '') return E.e8;
      if (parts[1] === '') return E.e7;
      if (!isRegOrMem(parts[0], REG4_SET)) return E.e10;
      if (!isRegOrMem(parts[1], REG4_SET)) return E.e9;
      return null;
    case 'log1':
      if (t === '') return E.e11;
      return isRegOrMem(t, REG3_SET) ? null : E.e12;
    case 'log2':
      if (t === '') return E.e11;
      if (parts.length !== 2) return E.e6;
      if (!isRegOrMem(parts[0], REG3_SET) || !isRegOrMem(parts[1], REG3_SET)) return E.e12;
      return null;
    case 'shift': {
      if (t === '') return E.e13;
      if (parts.length !== 2) return E.e14;
      if (parts[1] === '') return E.e15;
      if (!isRegOrMem(parts[0], REG3_SET)) return E.e17;
      if (!/^\d+$/.test(parts[1])) return E.e19;
      const n = Number(parts[1]);
      if (parts[1].length > 2) return E.e18;
      if (n < 1) return E.e19;
      if (n > 16) return E.e16;
      return null;
    }
    case 'in': {
      if (t === '') return E.e24;
      if (parts.length !== 2) return E.e25;
      if (parts[1] === '') return E.e26;
      if (!isReg(parts[0], REG3_SET)) return E.e28;
      if (!/^\d+$/.test(parts[1])) return E.e29;
      if (parts[1].length > 3) return E.e27;
      return null;
    }
    case 'out': {
      if (t === '') return E.e30;
      if (parts.length !== 2) return E.e31;
      if (parts[1] === '') return E.e32;
      if (!/^\d+$/.test(parts[0])) return E.e33;
      if (parts[0].length > 3) return E.e34;
      if (!isReg(parts[1], REG3_SET)) return E.e35;
      return null;
    }
  }
}

/** Builds the cell for an instruction of the list with the typed parameters and comment. */
export function buildManualCell(def: InstrDef, operandText: string, comment: string): ManualResult {
  const err = shapeError(def, operandText);
  if (err) return { ok: false, message: err };
  // The Editors reject MSG without a message (PARAMETRO NO VALIDO), so a saved .asm would not reopen.
  if (def.code === 42 && comment.trim() === '') return { ok: false, message: MANUAL_TEXTS.mensajeVacio };
  let ops: Operand[] = [];
  if (def.shape !== 'none' && def.shape !== 'msg') {
    const parsed = parseOperands(def.shape, operandText);
    if (!parsed) return { ok: false, message: E.e6 };
    ops = parsed;
  }
  const isMessage = def.shape === 'msg';
  const cell = cellFromParsed({ kind: 'instr', def, ops, message: isMessage ? comment.trim() : '' }, isMessage ? '' : comment.trim());
  const text = ops.length > 0 ? `${def.mnemonic} ${operandsToText(ops)}` : def.mnemonic;
  return { ok: true, cell, text };
}
