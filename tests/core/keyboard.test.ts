import { describe, expect, it } from 'vitest';
import { parseKeyboardInput } from '../../src/core';

describe('parseKeyboardInput (teclado de Dispositivos de E/S)', () => {
  it.each([
    ['0', 0],
    ['65535', 65535],
    ['  42 ', 42],
  ])('decimal %j -> %i', (raw, value) => {
    expect(parseKeyboardInput(raw, 'decimal')).toEqual({ ok: true, value });
  });

  it.each([
    ['65536', 'El número esta muy Grande'],
    ['-1', 'Numero Decimal No Válido'],
    ['1.5', 'Numero Decimal No Válido'],
    ['', 'Numero Decimal No Válido'],
    ['abc', 'Numero Decimal No Válido'],
  ])('decimal %j is rejected with %j', (raw, message) => {
    expect(parseKeyboardInput(raw, 'decimal')).toEqual({ ok: false, message });
  });

  it.each([
    ['0', 0],
    ['101', 5],
    ['1111111111111111', 0xffff],
  ])('binario %j -> %i', (raw, value) => {
    expect(parseKeyboardInput(raw, 'binario')).toEqual({ ok: true, value });
  });

  it.each([
    ['11111111111111111', 'El número esta muy Grande'],
    ['102', 'Numero Binario No Válido, entre solo 1 y 0s.'],
    ['', 'Numero Binario No Válido, entre solo 1 y 0s.'],
  ])('binario %j is rejected with %j', (raw, message) => {
    expect(parseKeyboardInput(raw, 'binario')).toEqual({ ok: false, message });
  });

  it.each([
    ['2.5', 2.5],
    ['2,5', 2.5],
    ['-3', -3],
    ['+.5', 0.5],
    ['1e3', 1000],
    ['2147483647', 2147483647],
    ['-2147483647', -2147483647],
  ])('float %j -> %d', (raw, value) => {
    expect(parseKeyboardInput(raw, 'float')).toEqual({ ok: true, value });
  });

  it.each([
    ['2147483648', 'El número esta muy Grande'],
    ['-2147483648', 'El número esta muy Pequeño'],
    ['abc', 'Numero No Válido'],
    ['1..2', 'Numero No Válido'],
    ['', 'Numero No Válido'],
  ])('float %j is rejected with %j', (raw, message) => {
    expect(parseKeyboardInput(raw, 'float')).toEqual({ ok: false, message });
  });
});
