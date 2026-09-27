import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURSO, SIMUPROC, SMP, expectOrdered, runAsmFile, runSmpFile } from '../helpers';

const c = (name: string) => path.join(CURSO, name);
const s = (name: string) => path.join(SIMUPROC, name);
const p = (name: string) => path.join(SMP, name);

describe('programas oficiales .smp', () => {
  it.each([
    [7, 'La Paridad de Dicho numero es: 3'],
    [65535, 'La Paridad de Dicho numero es: 16'],
    [0, 'La Paridad de Dicho numero es: 0'],
  ])('Calcula Paridad de un Numero: %i -> %s', async (input, expected) => {
    const r = await runSmpFile(p('Calcula Paridad de un Numero.smp'), [input]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual([expected]);
  });

  it('Calcula Numeros Primos hasta 20', async () => {
    const r = await runSmpFile(p('Calcula Numeros Primos.smp'), [20]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['Numeros Primos 1', 'Numeros Primos 2', 'Numeros Primos 3', '5', '7', '11', '13', '17', '19']);
    expect(r.cpu.regs.MAR).toBe(0x32);
  });
});

describe('ejemplos del curso', () => {
  it('Ejemplo1.asm', async () => {
    const r = await runAsmFile(c('Ejemplo1.asm'), [41]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['Hola mundo', 'el dato ingresado fue 41', 'nuevo ax 42']);
  });

  it('Ejemplo2.asm', async () => {
    const r = await runAsmFile(c('Ejemplo2.asm'), [5, 7]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['suma de dos datos', 'resultado 12']);
  });

  it('Ejemplo3.asm', async () => {
    const a = await runAsmFile(c('Ejemplo3.asm'), [4, 9]);
    expect(a.ended).toBe('halt');
    expectOrdered(a.lines, ['resultado 5']);
    const b = await runAsmFile(c('Ejemplo3.asm'), [9, 4]);
    expect(b.ended).toBe('halt');
    expectOrdered(b.lines, ['resultado -5']);
  });

  it('Ejemplo4.asm', async () => {
    const r = await runAsmFile(c('Ejemplo4.asm'), [5]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['suma de varios datos', 'parte menos significativa 50', 'parte menos significativa 0']);
  });

  it('Ejemplo5.asm', async () => {
    const r = await runAsmFile(c('Ejemplo5.asm'), [5]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['suma de varios datos', 'quedó la embarrada']);
  });

  it('ejemplo2026_3.txt with 40000 and 30000 sets carry and halts', async () => {
    const r = await runAsmFile(c('ejemplo2026_3.txt'), [40000, 30000]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['suma dos cosas', 'resultado menos sig 4464', 'reslutado mas sig 1', 'hay carry']);
  });

  it('ejemplo6.asm with 40000 and 30000 overwrites its HLT and hits an unrecognized opcode at 00F', async () => {
    const r = await runAsmFile(c('ejemplo6.asm'), [40000, 30000]);
    expect(r.lines).toEqual(['suma dos cosas', 'resultado menos sig 4464', 'reslutado mas sig 1', 'hay carry']);
    expect(r.ended).toBe('error');
    expect(r.error?.id).toBe('unknown-opcode');
    expect(r.error?.address).toBe(0x00f);
    expect(r.error?.message).toContain('00F');
    expect(r.cpu.regs.PC).toBe(0x010);
    expect(r.cpu.mem.get(0x00f).text).toBe('1001110001000000');
  });

  it.each(['ejemplo6.asm', 'ejemplo2026_3.txt'])('%s with 1 and 2 has neither C nor O', async (name) => {
    const r = await runAsmFile(c(name), [1, 2]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['suma dos cosas', 'resultado menos sig 3', 'reslutado mas sig 0', 'no hay ni C ni OF']);
  });

  it('ejemplo7.asm', async () => {
    const a = await runAsmFile(c('ejemplo7.asm'), [5, 3]);
    expect(a.ended).toBe('halt');
    expect(a.lines).toEqual(['resta dos cosas', 'resultado en ax -2', 'resul nega']);
    const b = await runAsmFile(c('ejemplo7.asm'), [3, 5]);
    expect(b.ended).toBe('halt');
    expect(b.lines).toEqual(['resta dos cosas', 'resultado en ax 2', 'no hay nega ni of']);
  });

  it('ejemplosuma10.asm', async () => {
    const r = await runAsmFile(c('ejemplosuma10.asm'));
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['suma 10 numeros', 'resdultado 100']);
    expect(r.requests).toBe(0);
  });

  it('multiplica.asm', async () => {
    const r = await runAsmFile(c('multiplica.asm'), [300, 300]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['multiplica', 'multiplica 300', 'por 300', 'igual   menos sig 24464', 'mas signif 1']);
  });

  it('saltos.asm', async () => {
    const mayor = await runAsmFile(c('saltos.asm'), [3, 5]);
    expect(mayor.ended).toBe('halt');
    expect(mayor.lines).toEqual(['es mayor 5', 'que 3']);
    const igual = await runAsmFile(c('saltos.asm'), [5, 5]);
    expect(igual.ended).toBe('halt');
    expect(igual.lines).toEqual(['es igual 5', 'con 5']);
    const menor = await runAsmFile(c('saltos.asm'), [5, 3]);
    expect(menor.ended).toBe('halt');
    expect(menor.lines).toEqual(['es menor 3', 'que 5']);
  });

  it('cargadat.asm', async () => {
    const r = await runAsmFile(c('cargadat.asm'), [3, 10, 20, 30]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['leido 10', 'leido 20', 'leido 30']);
  });

  it('leedat.asm (decimal data with warnings)', async () => {
    const r = await runAsmFile(c('leedat.asm'), [5]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['Dato leido 20', 'Dato leido 30', 'Dato leido 128', 'Dato leido 64', 'Dato leido 255']);
  });

  it.each(['2 iterajmp.asm', '3 iterloop.asm'])('%s', async (name) => {
    const r = await runAsmFile(c(name), [5]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['ciclos realizados: 5']);
  });

  it('1 cargaypush.asm leaves 103 in 03F and F80, BX=103, SP=F80', async () => {
    const r = await runAsmFile(c('1 cargaypush.asm'));
    expect(r.ended).toBe('halt');
    expect(r.cpu.mem.get(0x03f).text).toBe('1100111');
    expect(r.cpu.mem.get(0xf80).text).toBe('1100111');
    expect(r.cpu.mem.readData(0x03f).value).toBe(103);
    expect(r.cpu.regs.BX).toBe(103);
    expect(r.cpu.regs.SP).toBe(0xf80);
  });

  it('suma simple.asm (unclosed quote in EAP)', async () => {
    const r = await runAsmFile(c('suma simple.asm'), [2, 3]);
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['EL RESULTADO ES 5']);
  });
});

describe('ejemplos incrustados en el Editor 2 del original', () => {
  it('Ejemplo1.asm', async () => {
    const r = await runAsmFile(s('Ejemplo1.asm'));
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['Hola mundo']);
  });

  it('Ejemplo2.asm', async () => {
    const r = await runAsmFile(s('Ejemplo2.asm'));
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual(['Programa Ejemplo 2', 'El numero almacenado en D es: 13', 'La suma de estos dos numeros es: 34']);
  });

  it('Ejemplo3.asm', async () => {
    const r = await runAsmFile(s('Ejemplo3.asm'), [12, 5]);
    expect(r.ended).toBe('halt');
    expectOrdered(r.lines, ['Programa Ejemplo 3', 'Suma: 17', 'Resta: 7', 'Mult: 60', 'Div: 2']);
  });

  it('Ejemplo3.asm prints a positive product after a negative difference (100, 500)', async () => {
    const r = await runAsmFile(s('Ejemplo3.asm'), [100, 500]);
    expect(r.ended).toBe('halt');
    expectOrdered(r.lines, ['Suma: 600', 'Resta: -400', 'Mult: 50000', 'Div: 0']);
  });

  it('Ejemplo4.asm', async () => {
    const r = await runAsmFile(s('Ejemplo4.asm'), [3, 7, 2]);
    expect(r.ended).toBe('halt');
    expectOrdered(r.lines, ['Programa Ejemplo 4', 'Toma de Decisiones', 'El segundo numero fue Mayor', 'Desea volver a empezar?']);
    expect(r.lines).not.toContain('Opcion no valida');
  });

  it('Ejemplo5.asm (float port 1)', async () => {
    const r = await runAsmFile(s('Ejemplo5.asm'), [2.5, 1.5]);
    expect(r.ended).toBe('halt');
    expectOrdered(r.lines, ['Suma:', '4', 'Resta:', '1', 'Mult:', '3.75', 'Div:', '1.6667']);
    expect(r.cpu.regs.CX).toBe(1);
  });

  it.each([
    [16, '4'],
    [2.25, '1.5'],
  ])('Ejemplo6.asm square root of %s is %s', async (input, expected) => {
    const r = await runAsmFile(s('Ejemplo6.asm'), [input]);
    expect(r.ended).toBe('halt');
    expectOrdered(r.lines, ['La Raiz es:', expected]);
  });
});
