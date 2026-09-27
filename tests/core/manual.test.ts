import { describe, expect, it } from 'vitest';
import { ISA_BY_MNEMONIC, assemble, buildManualCell, disassemble, validateManualAddress } from '../../src/core';

const def = (m: string) => ISA_BY_MNEMONIC.get(m)!;

describe('Entrada de Instrucciones Manualmente', () => {
  it('builds cells with the same encoding as the assembler', () => {
    expect(buildManualCell(def('MOV'), 'ax , 34', 'c')).toEqual({ ok: true, cell: { text: '10AX,34', comment: 'c', origin: 'instr' }, text: 'MOV AX,34' });
    expect(buildManualCell(def('LDT'), '', 'Cuantos?')).toEqual({ ok: true, cell: { text: '40000', comment: 'Cuantos?', origin: 'instr' }, text: 'LDT' });
    expect(buildManualCell(def('HLT'), 'ignorado', '')).toEqual({ ok: true, cell: { text: '99000', comment: '', origin: 'instr' }, text: 'HLT' });
    expect(buildManualCell(def('JNC'), '7', '')).toMatchObject({ ok: true, cell: { text: '367' } });
  });

  it('reports the original messages for invalid parameters', () => {
    const msg = (m: string, ops: string) => {
      const r = buildManualCell(def(m), ops, '');
      return r.ok ? 'OK' : r.message;
    };
    expect(msg('PUSH', '')).toBe('Introduzca un Registro: AX BX CX BP');
    expect(msg('PUSH', 'DX')).toBe('Introduzca un Registro Válido: AX BX CX BP');
    expect(msg('INC', '')).toBe('Introduzca un Registro: AX BX CX BP, ó una Dir de mem desde 000 hasta FFF');
    expect(msg('INC', 'ZZ')).toBe('Registro no válido...Introduzca un Registro Válido: AX BX CX BP, o una Dir de Mem.');
    expect(msg('MOV', '')).toBe('Introduzca un destino y un origen, pueden ser registros o dir de memoria.');
    expect(msg('MOV', 'AX')).toBe('Parámetro no válido, ejemplos: AX,CX ó 1F,BX ó 1,21 ó CX,1A  Separelos con una coma.');
    expect(msg('MOV', 'AX,')).toBe('No especificó una dirección o registro de Origen válido. Ejs: AX,BX ó 2F,1A ó BX,2F');
    expect(msg('MOV', 'QQ,AX')).toBe('Registro de Destino no válido... Introduzca un Reg Válido: AX BX CX BP, o una Dir de Mem.');
    expect(msg('AND', '')).toBe('Introduzca un Registro: AX BX CX, ó una Dir de mem desde 000 hasta FFF');
    expect(msg('NOT', 'BP')).toBe('Registro no válido...Introduzca un Registro Válido: AX BX CX, o una Dir de Mem.');
    expect(msg('ROL', '')).toBe('Entre un destino y número de veces, puede ser un registro o dir de memoria.');
    expect(msg('ROL', 'AX')).toBe('Parámetro no válido, ejemplos: AX,4 ó 3B,14 ó 111,2  Separelos con una coma.');
    expect(msg('ROL', 'AX,')).toBe('No especifico un Número de veces a realizar la operación. Ejs: AX,4 ó 3B,14 ó BX,7');
    expect(msg('ROL', 'AX,17')).toBe('Numero de veces muy grande. Ejs: AX,4 ó 3B,15 ó BX,7');
    expect(msg('ROL', 'AX,123')).toBe('El Número de veces Esta muy Grande.');
    expect(msg('ROL', 'AX,x')).toBe('Número de veces NO válido. Ejs: AX,3 ó 1C3,11 ó BX,2');
    expect(msg('ROL', 'AX,0')).toBe('Número de veces NO válido. Ejs: AX,3 ó 1C3,11 ó BX,2');
    expect(msg('SHL', 'AX,00')).toBe('Número de veces NO válido. Ejs: AX,3 ó 1C3,11 ó BX,2');
    expect(msg('SHL', 'AX,16')).toBe('OK');
    expect(msg('LDA', '')).toBe('Introduzca una Dirección de Memoria en Hexadecimal, el rango va desde 000 hasta FFF');
    expect(msg('LDA', '1234')).toBe('Dir de Mem No Válida, Solo Hexa desde 000 hasta FFF');
    expect(msg('IN', '')).toBe('Entre un destino y puerto de entrada, el destino es cualquier registro.');
    expect(msg('IN', 'AX')).toBe('Parámetro no válido, ejemplos: AX,12 ó BX,1  Separelos con una coma.');
    expect(msg('IN', 'AX,')).toBe('No especifico un puerto. Ejs: AX,4 ó CX,14 ó BX,9');
    expect(msg('IN', 'AX,1234')).toBe('Puerto muy grande. Ejs: AX,4 ó BX,1 ó CX,2');
    expect(msg('IN', 'BP,1')).toBe('No especificó un registro de Destino válido. Ejs: CX,1 ó BX,14 ó CX,12');
    expect(msg('IN', 'AX,x')).toBe('Puerto NO válido. Ejs: AX,3 ó CX,11 ó BX,2');
    expect(msg('OUT', '')).toBe('Entre un puerto de salida, y un origen, el origen es cualquier registro.');
    expect(msg('OUT', '1')).toBe('Parámetro no válido, ejemplos: 12,AX ó 1,BX  Separelos con una coma.');
    expect(msg('OUT', '1,')).toBe('No especificó un registro de origen válido. Ejs: 1,AX ó 14,BX ó 12,CX');
    expect(msg('OUT', 'x,AX')).toBe('Puerto NO válido. Ejs: 3,AX ó 11,CX ó 2,BX');
    expect(msg('OUT', '1234,AX')).toBe('Puerto muy grande. Ejs: 4,AX ó 1,BX ó 2,CX');
    expect(msg('OUT', '1,BP')).toBe('No especificó un registro de Origen válido. Ejs: 1,CX ó 14,BX ó 12,CX');
    expect(msg('OUT', '13,AX')).toBe('OK');
  });

  it('rejects MSG without a message, which the saved .asm could not reopen', () => {
    expect(buildManualCell(def('MSG'), '', '')).toEqual({ ok: false, message: 'Escriba el mensaje de MSG en el comentario.' });
    expect(buildManualCell(def('MSG'), '', '   ')).toEqual({ ok: false, message: 'Escriba el mensaje de MSG en el comentario.' });
    expect(buildManualCell(def('MSG'), '', 'hola')).toMatchObject({ ok: true, cell: { text: '42000', comment: 'hola' } });
    expect(buildManualCell(def('EAP'), '', '')).toMatchObject({ ok: true, cell: { text: '41000', comment: '' } });
  });

  it('every cell it accepts reassembles from its .asm form', () => {
    for (const [m, ops, comment] of [['MSG', '', ''], ['MSG', '', 'x'], ['LDT', '', ''], ['MOV', 'AX,BX', 'c'], ['HLT', '', '']]) {
      const r = buildManualCell(def(m), ops, comment);
      if (!r.ok) continue;
      expect(assemble(disassemble([{ addr: 0, cell: r.cell }])).errors, `${m} ${ops} ;${comment}`).toEqual([]);
    }
  });

  it('validates the starting address', () => {
    expect(validateManualAddress('')).toEqual({ ok: false, message: 'Introduzca una Dirección de Memoria en Hexadecimal, el rango va desde 000 hasta FFF' });
    expect(validateManualAddress('xyz')).toEqual({ ok: false, message: 'Valor Hexa no Válido, entre valores solo entre 0-9 y A-F' });
    expect(validateManualAddress('1000')).toEqual({ ok: false, message: 'Dir de Mem No Válida, Solo Hexa desde 000 hasta FFF' });
    expect(validateManualAddress('3fH')).toEqual({ ok: true, addr: 0x3f });
  });
});

describe('Entrada Manual: registros y direcciones', () => {
  it('accepts registers in any case and with spaces, and addresses with H, as the assembler does', () => {
    const msg = (m: string, ops: string) => {
      const r = buildManualCell(def(m), ops, '');
      return r.ok ? r.text : r.message;
    };
    expect(msg('PUSH', ' bp ')).toBe('PUSH BP');
    expect(msg('INC', '1fh')).toBe('INC 1F');
    expect(msg('INC', '1000')).toBe('Registro no válido...Introduzca un Registro Válido: AX BX CX BP, o una Dir de Mem.');
    expect(msg('MOV', 'bp, 3a')).toBe('MOV BP,3A');
    expect(msg('MOV', 'AX,QQ')).toBe('Registro de Origen no válido... Introduzca un Reg Válido: AX BX CX BP, o una Dir de Mem.');
    expect(msg('AND', '12,cx')).toBe('AND 12,CX');
    expect(msg('AND', 'BP,AX')).toBe('Registro no válido...Introduzca un Registro Válido: AX BX CX, o una Dir de Mem.');
    expect(msg('SHR', '3b ,4')).toBe('SHR 3B,4');
    expect(msg('SHR', 'BP,4')).toBe('No especificó una dirección o registro de Destino válido. Ejs: CX,1 ó 31F,14 ó CX,22');
    expect(msg('IN', 'cx ,1')).toBe('IN CX,1');
    expect(msg('IN', '1F,1')).toBe('No especificó un registro de Destino válido. Ejs: CX,1 ó BX,14 ó CX,12');
    expect(msg('OUT', '1, bx')).toBe('OUT 1,BX');
    expect(msg('OUT', '1,1F')).toBe('No especificó un registro de Origen válido. Ejs: 1,CX ó 14,BX ó 12,CX');
  });
});
