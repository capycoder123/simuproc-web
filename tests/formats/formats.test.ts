import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ASM_HEADER,
  Memory,
  SmpFormatError,
  assemble,
  decodeCp1252,
  decodeProgramBytes,
  disassemble,
  disassembleWithWarnings,
  encodeAsmFile,
  encodeCp1252,
  memoryToRows,
  parseSmp,
  rowsToCells,
  rowsToText,
  serializeSmp,
  textToRows,
  type Cell,
} from '../../src/core';
import { quoteMessage } from '../../src/core/formats/asm';
import { CURSO, SIMUPROC, SMP, loadAsm, loadSmp, readBytes, readProgramText } from '../helpers';

const SMP_FILES = ['Calcula Numeros Primos.smp', 'Calcula Paridad de un Numero.smp'];
const CURSO_FILES = fs.readdirSync(CURSO).sort();
const SIMUPROC_FILES = fs.readdirSync(SIMUPROC).sort();

function cellsEqual(a: Map<number, Cell>, b: Map<number, Cell>): void {
  const norm = (m: Map<number, Cell>) =>
    [...m.entries()].sort((x, y) => x[0] - y[0]).map(([addr, c]) => [addr, c.text, c.comment]);
  expect(norm(b)).toEqual(norm(a));
}

describe('formato .smp', () => {
  it.each(SMP_FILES)('%s round-trips byte for byte', (name) => {
    const bytes = readBytes(path.join(SMP, name));
    const text = decodeProgramBytes(bytes).text;
    const doc = parseSmp(text);
    const mem = new Memory();
    mem.load(doc.cells);
    const out = serializeSmp(mem.cells, doc.header);
    expect(out).toBe(text);
    expect(Buffer.from(encodeCp1252(out))).toEqual(Buffer.from(bytes));
  });

  it.each(SMP_FILES)('%s converted to Editor 2 text and reassembled gives identical cells', (name) => {
    const doc = loadSmp(path.join(SMP, name));
    const mem = new Memory();
    mem.load(doc.cells);
    const text = disassemble(mem.entries());
    const asm = assemble(text);
    expect(asm.errors).toEqual([]);
    cellsEqual(doc.cells, asm.cells);
  });

  it('parses the header of the samples and classifies cells', () => {
    const doc = loadSmp(path.join(SMP, 'Calcula Paridad de un Numero.smp'));
    expect(doc.header).toEqual({ line1: 'SimuProc 1.4 - Vlaye', line2: '1ba', line3: '23' });
    expect(doc.cells.get(0)).toEqual({ text: '04000', comment: '', origin: 'instr' });
    expect(doc.cells.get(2)?.comment).toBe('A que numero desea hallarle la Paridad?');
    expect(doc.cells.get(0xd)).toEqual({ text: '10000', comment: '', origin: 'data' });
    expect(doc.cells.size).toBe(12);
  });

  it('the placeholder of line 3 for a new program matches the Paridad sample', () => {
    const doc = loadSmp(path.join(SMP, 'Calcula Paridad de un Numero.smp'));
    const mem = new Memory();
    mem.load(doc.cells);
    expect(serializeSmp(mem.cells).split('\n')[2]).toBe('23');
  });

  it('rejects a file that does not start with SimuProc', () => {
    expect(() => parseSmp('hola\n')).toThrow('NO es un archivo Válido');
  });

  it('multiplica.asm assembled, saved as .smp, reloaded and disassembled gives the same cells', () => {
    const asm = loadAsm(path.join(CURSO, 'multiplica.asm'));
    expect(asm.errors).toEqual([]);
    expect(asm.cells.get(7)?.text).toBe('0110');
    const mem = new Memory();
    mem.load(asm.cells);
    const smp = serializeSmp(mem.cells);
    const back = parseSmp(smp);
    cellsEqual(asm.cells, back.cells);
    expect(back.cells.get(7)?.origin).toBe('instr');
    const mem2 = new Memory();
    mem2.load(back.cells);
    const again = assemble(disassemble(mem2.entries()));
    cellsEqual(asm.cells, again.cells);
  });
});

describe('formato .asm (Editor 2)', () => {
  it.each(CURSO_FILES)('%s (curso) loads with zero errors', (name) => {
    const asm = loadAsm(path.join(CURSO, name));
    expect(asm.errors).toEqual([]);
    if (name === 'leedat.asm') {
      expect(asm.warnings).toHaveLength(5);
      expect(asm.warnings[0].message).toContain('interpretado como decimal');
    } else {
      expect(asm.warnings).toEqual([]);
    }
  });

  it.each(SIMUPROC_FILES)('%s (incrustado) loads with zero errors', (name) => {
    const asm = loadAsm(path.join(SIMUPROC, name));
    expect(asm.errors).toEqual([]);
    expect(asm.warnings).toEqual([]);
  });

  it('a program saved as .asm starts with the header and reloads to identical cells', () => {
    const asm = loadAsm(path.join(SIMUPROC, 'Ejemplo4.asm'));
    const mem = new Memory();
    mem.load(asm.cells);
    const text = disassemble(mem.entries());
    expect(text.startsWith(ASM_HEADER + '\n')).toBe(true);
    const bytes = encodeAsmFile(text);
    const reloaded = assemble(decodeProgramBytes(bytes).text);
    expect(reloaded.errors).toEqual([]);
    cellsEqual(asm.cells, reloaded.cells);
    expect(decodeProgramBytes(bytes).text.includes('\r\n')).toBe(true);
  });

  it('MSG "€–" saved as .asm and reloaded keeps its characters', () => {
    const text = `${ASM_HEADER}\nMSG "€–"\nHLT\n`;
    const bytes = encodeAsmFile(text);
    expect(bytes[bytes.indexOf(0x22) + 1]).toBe(0x80);
    expect(bytes[bytes.indexOf(0x22) + 2]).toBe(0x96);
    const decoded = decodeProgramBytes(bytes);
    expect(decoded.encoding).toBe('cp1252');
    const asm = assemble(decoded.text);
    expect(asm.errors).toEqual([]);
    expect(asm.cells.get(0)).toEqual({ text: '42000', comment: '€–', origin: 'instr' });
  });

  it('decodes CP1252 bytes with accents and encodes unmappable characters as ?', () => {
    expect(decodeCp1252(new Uint8Array([0x71, 0x75, 0x65, 0x64, 0xf3]))).toBe('quedó');
    expect(decodeProgramBytes(new Uint8Array([0x6d, 0x73, 0x67, 0x20, 0xf3])).encoding).toBe('cp1252');
    expect(Array.from(encodeCp1252('a中ñ'))).toEqual([0x61, 0x3f, 0xf1]);
  });

  it('classifies the lines of 2 iterajmp.asm: header and #iteracionesd are comments, #20 is a directive', () => {
    const asm = loadAsm(path.join(CURSO, '2 iterajmp.asm'));
    expect(asm.lines[0]).toMatchObject({ kind: 'comment', addr: null });
    expect(asm.lines[1]).toMatchObject({ kind: 'comment', addr: null, source: '#iteracionesd con salto' });
    expect(asm.lines[2]).toMatchObject({ kind: 'instr', addr: 0 });
    expect(asm.lines[12]).toMatchObject({ kind: 'directive', addr: null });
    expect(asm.cells.get(0x20)).toEqual({ text: '1010', comment: '', origin: 'data' });
  });

  it('reports errors with the address the line would occupy', () => {
    const asm = assemble('CLA\nFOO 1\nMOV AX\nMSG\n11111111111111111\nHLT');
    expect(asm.errors.map((e) => e.message)).toEqual([
      'INSTRUCCION NO VALIDA en la Dir: 001',
      'PARAMETRO NO VALIDO para la inst en la Dir: 002',
      'PARAMETRO NO VALIDO para la inst en la Dir: 003',
      'INSTRUCCION NO VALIDA en la Dir: 004',
    ]);
    expect(asm.cells.get(5)?.text).toBe('99000');
  });

  it('explains a binary word longer than 16 digits in a data block', () => {
    const asm = assemble('#100\n100000000001\n101010101010101010101010\n1100\n1011101110111\n11001000\n111');
    expect(asm.errors.map((e) => e.message)).toEqual(['INSTRUCCION NO VALIDA en la Dir: 101']);
    expect(asm.warnings.map((w) => w.message)).toEqual([
      'Dir 101: dato binario de 24 dígitos; cada posición de memoria guarda 16 bits (divídalo en dos posiciones)',
    ]);
    expect([...asm.cells.keys()]).toEqual([0x100, 0x102, 0x103, 0x104, 0x105]);
    expect(asm.cells.get(0x103)?.text).toBe('1011101110111');
  });

  it('normalizes operands: case, H suffix, spaces, digits as typed', () => {
    const asm = assemble("mov cx , ax\nlda 30h\njmp BH\nMOV 35,03D\nldt 'hola ; mundo' ;c\neap \"EL RESULTADO ES\nXBA");
    expect(asm.errors).toEqual([]);
    expect([...asm.cells.values()].map((c) => c.text)).toEqual(['10CX,AX', '0130', '30B', '1035,03D', '40000', '41000', '03000']);
    expect(asm.cells.get(4)?.comment).toBe('hola ; mundo');
    expect(asm.cells.get(5)?.comment).toBe('EL RESULTADO ES');
    expect(asm.warnings.map((w) => w.message)).toEqual(['Dir 006: XBA interpretado como XAB']);
  });

  it('Editor 1 rows convert both ways', () => {
    const { rows, errors } = textToRows(readProgramText(path.join(SIMUPROC, 'Ejemplo2.asm')));
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.addr, r.source, r.comment])).toEqual([
      [0, 'MSG', 'Programa Ejemplo 2'],
      [1, 'MOV AX,D', 'Llevo el contenido de la direccion D al registro AX'],
      [2, 'EAP', 'El numero almacenado en D es:'],
      [3, 'ADD E', 'le sumo al Contenido de AX el valor de la dir E, el resultado queda en AX'],
      [4, 'EAP', 'La suma de estos dos numeros es:'],
      [5, 'HLT', 'Termina el Programa'],
      [13, '1101', 'Es el numero 13, los numeros se escriben en binario'],
      [14, '10101', 'Es el numero 21 y esta inicializado en la dir E, no hay necesidad de especificarlo, pues esta consecutivo a D'],
    ]);
    const cells = rowsToCells(rows);
    expect(cells.errors).toEqual([]);
    expect(cells.cells.get(0)).toEqual({ text: '42000', comment: 'Programa Ejemplo 2', origin: 'instr' });
    expect(cells.cells.get(5)).toEqual({ text: '99000', comment: 'Termina el Programa', origin: 'instr' });
    const text = rowsToText(rows);
    expect(text.split('\n').slice(0, 3)).toEqual([ASM_HEADER, "MSG 'Programa Ejemplo 2'", 'MOV AX,D ;Llevo el contenido de la direccion D al registro AX']);
    expect(text).toContain('\n#D\n1101 ;Es el numero 13');
    const mem = new Memory();
    mem.load(cells.cells);
    expect(memoryToRows(mem.entries())).toEqual(rows);
  });
});

describe('ejemplos empaquetados', () => {
  it('src/ejemplos holds the 17 course programs, the 6 examples of the original and its 2 .smp programs', () => {
    expect(CURSO_FILES).toHaveLength(17);
    expect(SIMUPROC_FILES).toHaveLength(6);
    expect(fs.readdirSync(SMP).sort()).toEqual(SMP_FILES);
  });
});

describe('límites de memoria y casos borde', () => {
  const smpWithPairs = (pairs: [string, string][]) =>
    ['SimuProc 1.4 - Vlaye', '1ba', '0', '', '', '', ...pairs.flat()].join('\n') + '\n';

  it('Convertir a Editor 1 keeps no row past FFF and reports the overflow once', () => {
    const { rows, errors } = textToRows('#FFF\nHLT\nNOP\nNOP');
    expect(rows.map((r) => r.addr)).toEqual([0xfff]);
    expect(errors.map((e) => e.message)).toEqual(['SE LLENO LA MEMORIA (línea 3)']);
  });

  it('Enviar a Memoria rejects an Editor 1 row past FFF before building its cell', () => {
    const r = rowsToCells([
      { addr: 0xfff, source: 'HLT', comment: '' },
      { addr: 0x1000, source: 'NOP', comment: '' },
    ]);
    expect(r.errors.map((e) => [e.line, e.message])).toEqual([[2, 'SE LLENO LA MEMORIA (Dir: 1000)']]);
    expect([...r.cells.keys()]).toEqual([0xfff]);
  });

  it('Memory.load rejects an address outside 000-FFF without touching memory', () => {
    const m = new Memory();
    m.set(5, '1010');
    const cell: Cell = { text: '0', comment: '', origin: 'data' };
    expect(() => m.load(new Map([[0, cell], [0x1000, cell]]))).toThrow(RangeError);
    expect(() => m.load([[-1, cell]])).toThrow(RangeError);
    expect(m.get(5).text).toBe('1010');
    expect(m.get(0).text).toBe('');
  });

  it('rejects an .smp with a non-empty cell past FFF', () => {
    const pairs: [string, string][] = Array.from({ length: 4097 }, () => ['', '']);
    pairs[4096] = ['1', ''];
    expect(() => parseSmp(smpWithPairs(pairs))).toThrow(SmpFormatError);
    expect(() => parseSmp(smpWithPairs(pairs))).toThrow('NO es un archivo Válido Para Abrir en este Simulador.');
    pairs[4096] = ['', 'solo comentario'];
    expect(() => parseSmp(smpWithPairs(pairs))).toThrow(SmpFormatError);
  });

  it('accepts an .smp whose pairs past FFF are all empty', () => {
    const pairs: [string, string][] = Array.from({ length: 5000 }, () => ['', '']);
    pairs[0] = ['99000', ''];
    pairs[4095] = ['1', 'ultima'];
    const doc = parseSmp(smpWithPairs(pairs));
    expect([...doc.cells.keys()]).toEqual([0, 0xfff]);
    const m = new Memory();
    m.load(doc.cells);
    expect(m.get(0xfff)).toEqual({ text: '1', comment: 'ultima', origin: 'data' });
  });

  it('Convertir a Editor 2 keeps the addresses after a blank, comment-only or #... row', () => {
    for (const middle of [
      { addr: 1, source: '', comment: '' },
      { addr: 1, source: '', comment: 'pendiente' },
      { addr: 1, source: '#FF', comment: '' },
      { addr: 1, source: 'FOO', comment: '' },
    ]) {
      const text = rowsToText([{ addr: 0, source: 'LDA 10', comment: '' }, middle, { addr: 2, source: 'HLT', comment: '' }]);
      const asm = assemble(text);
      expect(asm.cells.get(2)?.text, JSON.stringify(middle)).toBe('99000');
      expect(asm.cells.has(1), JSON.stringify(middle)).toBe(false);
      expect(asm.cells.has(0xff), JSON.stringify(middle)).toBe(false);
    }
  });

  it('warns about a # line that looks like an address directive but is not one', () => {
    for (const bad of ['#1000', '#20 datos', '#0x20', '# 20', '#FFFF']) {
      const asm = assemble(`${bad}\nHLT`);
      expect(asm.lines[0].kind, bad).toBe('comment');
      expect([...asm.cells.keys()], bad).toEqual([0]);
      expect(asm.warnings, bad).toHaveLength(1);
      expect(asm.warnings[0].line, bad).toBe(1);
    }
    expect(assemble('#1000\nHLT').warnings[0].message).toBe(
      'Línea 1: "#1000" está fuera de rango (directivas de 000 a FFF); se toma como comentario',
    );
    expect(assemble('#20 datos\nHLT').warnings[0].message).toBe(
      'Línea 1: "#20 datos" no es una directiva válida (ejemplo: #20); se toma como comentario',
    );
    for (const ok of ['#iteracionesd con salto', '#SimuProc 1.4.3.0', '#ACE de datos', '# de la suma']) {
      expect(assemble(`${ok}\nHLT`).warnings, ok).toEqual([]);
    }
    const f0 = assemble('#f0\nHLT');
    expect(f0.warnings).toEqual([]);
    expect([...f0.cells.keys()]).toEqual([0xf0]);
  });

  it('a message with both quote types survives an .asm round trip', () => {
    for (const msg of [`a;b'c"d`, `'x"y`, `it's "ok"`, `he said "don't"`, 'a;b', "'hola", '  espacios  ']) {
      const m = new Memory();
      m.set(0, '42000', msg);
      const asm = assemble(disassemble(m.entries()));
      expect(asm.errors, msg).toEqual([]);
      expect(asm.cells.get(0)?.comment, msg).toBe(msg);
    }
  });

  it('a message without both quote types keeps its earlier quoted form', () => {
    expect(quoteMessage("it's")).toBe(`"it's"`);
    expect(quoteMessage("a'")).toBe(`"a'"`);
    expect(quoteMessage("'hola")).toBe(`"'hola"`);
    expect(quoteMessage('di "hola"')).toBe(`'di "hola"'`);
    const m = new Memory();
    m.set(0, '42000', "El valor de 'x' es");
    expect(disassemble(m.entries())).toContain(`MSG "El valor de 'x' es"`);
    // Every message over a small alphabet that does not mix ' and ": 'msg' without ', "msg" with '.
    const alphabet = ['a', "'", '"', ';', ' ', '#'];
    let msgs = [''];
    for (let len = 1; len <= 4; len++) {
      msgs = msgs.flatMap((p) => alphabet.map((c) => p + c));
      for (const msg of msgs) {
        if (msg.includes("'") && msg.includes('"')) continue;
        expect(quoteMessage(msg), msg).toBe(msg.includes("'") ? `"${msg}"` : `'${msg}'`);
      }
    }
  });

  it('warns when a message cannot be written as .asm without losing text', () => {
    const m = new Memory();
    m.set(0, '42000', `aa';"; `);
    m.set(1, '42000', 'se puede');
    const { text, warnings } = disassembleWithWarnings(m.entries());
    expect(text).toBe(disassemble(m.entries()));
    expect(warnings).toEqual([
      { addr: 0, line: 2, message: `Dir 000: el mensaje "aa';"; " mezcla comillas ' y " y no se puede guardar como .asm sin perder texto` },
    ]);
  });

  it('reports SE LLENO LA MEMORIA once for a text that overflows the memory', () => {
    const asm = assemble(Array.from({ length: 5000 }, () => 'NOP').join('\n'));
    const full = asm.errors.filter((e) => e.message.startsWith('SE LLENO'));
    expect(full.map((e) => e.line)).toEqual([4097]);
    expect(asm.lines.filter((l) => l.kind === 'error')).toHaveLength(5000 - 4096);
  });
});

describe('comportamiento fijado antes de refactorizar', () => {
  it('Editor 1 conversions keep the MSG-comment rule, warnings and verbatim error rows', () => {
    const rows = [
      { addr: 0, source: 'MSG', comment: 'desde comentario' },
      { addr: 1, source: "MSG 'en linea'", comment: 'ignorado' },
      { addr: 2, source: 'EAP', comment: '' },
      { addr: 3, source: 'LDA 1fh', comment: 'nota' },
      { addr: 5, source: 'FOO 1', comment: 'malo' },
      { addr: 6, source: 'SUB AX', comment: '' },
      { addr: 7, source: '12', comment: '' },
      { addr: 0x10, source: 'MSG', comment: '  ' },
    ];
    const r = rowsToCells(rows);
    expect([...r.cells.entries()]).toEqual([
      [0, { text: '42000', comment: 'desde comentario', origin: 'instr' }],
      [1, { text: '42000', comment: 'en linea', origin: 'instr' }],
      [2, { text: '41000', comment: '', origin: 'instr' }],
      [3, { text: '011F', comment: 'nota', origin: 'instr' }],
      [7, { text: '1100', comment: '', origin: 'data' }],
    ]);
    expect(r.errors.map((e) => [e.line, e.kind, e.message])).toEqual([
      [5, 'instr', 'INSTRUCCION NO VALIDA en la Dir: 005'],
      [6, 'param', 'PARAMETRO NO VALIDO para la inst en la Dir: 006'],
      [8, 'param', 'PARAMETRO NO VALIDO para la inst en la Dir: 010'],
    ]);
    expect(r.warnings.map((w) => [w.line, w.message])).toEqual([[7, 'Dir 007: "12" interpretado como decimal; el original solo acepta binario']]);
    expect(rowsToText(rows)).toBe(
      [
        ASM_HEADER,
        "MSG 'desde comentario'",
        "MSG 'en linea'",
        'EAP',
        'LDA 1F ;nota',
        '#5',
        'FOO 1 ;malo',
        '#6',
        'SUB AX',
        '#7',
        '1100',
        '#10',
        "MSG '  '",
        '',
      ].join('\n'),
    );
    expect(rowsToText([])).toBe(`${ASM_HEADER}\n`);
  });

  it('disassemble writes #HEX directives only where addresses jump', () => {
    const m = new Memory();
    m.set(0, '99000');
    m.set(1, '', 'solo comentario');
    m.set(2, '1');
    m.set(0xab, '10AX,BX', 'c');
    m.set(0xac, '0');
    expect(disassemble(m.entries())).toBe([ASM_HEADER, 'HLT', '#2', '1', '#AB', 'MOV AX,BX ;c', '0', ''].join('\n'));
    expect(disassemble([])).toBe(`${ASM_HEADER}\n`);
    m.set(0xad, '42000', `aa';"; `);
    expect(disassembleWithWarnings(m.entries()).warnings.map((w) => [w.addr, w.line])).toEqual([[0xad, 8]]);
  });

  it('serializeSmp ends at the last cell with text or comment', () => {
    const m = new Memory();
    expect(serializeSmp(m.cells)).toBe(['SimuProc 1.4 - Vlaye', '1ba', '7', '', '', '', ''].join('\n'));
    m.set(0, '1');
    m.set(2, '', 'nota');
    expect(serializeSmp(m.cells).split('\n').slice(6)).toEqual(['1', '', '', '', '', 'nota', '']);
  });

  it('Memory.readData reads binary words, empty cells as 0 and anything else as 0 with a warning', () => {
    const m = new Memory();
    m.set(0, '1111111111111111');
    m.set(1, '0');
    m.set(2, '99000');
    m.set(3, ' 1');
    expect(m.readData(0)).toEqual({ value: 0xffff, warning: null });
    expect(m.readData(1)).toEqual({ value: 0, warning: null });
    expect(m.readData(4)).toEqual({ value: 0, warning: null });
    expect(m.readData(2)).toEqual({ value: 0, warning: 'La dirección 002 no contiene un dato binario ("99000"); se lee como 0.' });
    expect(m.readData(3).warning).not.toBeNull();
  });
});
