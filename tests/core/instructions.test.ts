import { describe, expect, it } from 'vitest';
import {
  Cpu,
  ISA,
  Memory,
  assemble,
  bin16,
  createTestDevices,
  floatToRegs,
  parseKeyboardInput,
  regsToFloat,
  type Flags,
} from '../../src/core';
import { bin, runSource } from '../helpers';

/** Sets registers and memory before running a snippet that ends with HLT. */
function setup(init: { AX?: number; BX?: number; CX?: number; BP?: number; mem?: Record<string, string> }) {
  return (cpu: Cpu) => {
    if (init.AX !== undefined) cpu.regs.AX = init.AX;
    if (init.BX !== undefined) cpu.regs.BX = init.BX;
    if (init.CX !== undefined) cpu.regs.CX = init.CX;
    if (init.BP !== undefined) {
      cpu.regs.BP = init.BP;
      cpu.regs.SP = init.BP;
    }
    for (const [a, t] of Object.entries(init.mem ?? {})) cpu.mem.set(parseInt(a, 16), t);
  };
}

describe('ejemplos de la especificación 1.4.3', () => {
  it('AND AX,3F: 1001101 AND 11011 = 1001', async () => {
    const r = await runSource('AND AX,3F\nHLT', [], { setup: setup({ AX: bin('1001101'), mem: { '3F': '11011' } }) });
    expect(r.ended).toBe('halt');
    expect(r.cpu.regs.AX).toBe(bin('1001'));
    expect(r.cpu.flags.Z).toBe(0);
  });

  it('NOT AX: 10011 -> 1111111111101100', async () => {
    const r = await runSource('NOT AX\nHLT', [], { setup: setup({ AX: bin('10011') }) });
    expect(bin16(r.cpu.regs.AX)).toBe('1111111111101100');
  });

  it('OR 3A,3B: 1001101 OR 11011 = 1011111', async () => {
    const r = await runSource('OR 3A,3B\nHLT', [], { setup: setup({ mem: { '3A': '1001101', '3B': '11011' } }) });
    expect(r.cpu.mem.readData(0x3a).value).toBe(bin('1011111'));
  });

  it('XOR 3A,3B: 1001101 XOR 11011 = 1010110', async () => {
    const r = await runSource('XOR 3A,3B\nHLT', [], { setup: setup({ mem: { '3A': '1001101', '3B': '11011' } }) });
    expect(r.cpu.mem.readData(0x3a).value).toBe(bin('1010110'));
  });

  it.each([
    [2, '10111000', 0],
    [7, '1011100000000', 0],
    [13, '1100000000000101', 1],
  ])('ROL 7E,%i on 101110 -> %s C=%i', async (n, expected, c) => {
    const r = await runSource(`ROL 7E,${n}\nHLT`, [], { setup: setup({ mem: { '7E': '101110' } }) });
    expect(r.cpu.mem.get(0x7e).text).toBe(expected);
    expect(r.cpu.flags.C).toBe(c);
  });

  it.each([
    [2, '1011', 1],
    [6, '0', 1],
    [11, '0', 0],
  ])('SHR 1A,%i on 101110 -> %s C=%i', async (n, expected, c) => {
    const r = await runSource(`SHR 1A,${n}\nHLT`, [], { setup: setup({ mem: { '1A': '101110' } }) });
    expect(r.cpu.mem.get(0x1a).text).toBe(expected);
    expect(r.cpu.flags.C).toBe(c);
  });

  it('SHL and ROR move the last bit out into C', async () => {
    const shl = await runSource('SHL AX,1\nHLT', [], { setup: setup({ AX: 0x8001 }) });
    expect(shl.cpu.regs.AX).toBe(0x0002);
    expect(shl.cpu.flags.C).toBe(1);
    const ror = await runSource('ROR AX,1\nHLT', [], { setup: setup({ AX: 0x0001 }) });
    expect(ror.cpu.regs.AX).toBe(0x8000);
    expect(ror.cpu.flags.C).toBe(1);
  });

  it('MUL splits a 21-bit product into AX (low 16 bits) and BX (high bits), like the spec example', async () => {
    // The spec's product 101101000111100010111 (1478423) is prime, so no pair of 16-bit words
    // produces it; 24 x 61601 = 1478424 = 101101000111100011000 has the same high part 10110.
    const r = await runSource('MUL 20\nHLT', [], { setup: setup({ AX: 61601, mem: { '20': (24).toString(2) } }) });
    expect(bin16(r.cpu.regs.AX)).toBe('1000111100011000');
    expect(r.cpu.regs.BX).toBe(bin('10110'));
    expect(r.cpu.flags.O).toBe(1);
    expect(r.cpu.flags.Z).toBe(0);
  });

  it('MUL that fits leaves BX = 0 and O = 0', async () => {
    const r = await runSource('MUL 20\nHLT', [], { setup: setup({ AX: 12, BX: 99, mem: { '20': '101' } }) });
    expect(r.cpu.regs.AX).toBe(60);
    expect(r.cpu.regs.BX).toBe(0);
    expect(r.cpu.flags.O).toBe(0);
  });

  it('CMP sets Z and N (greater, equal, less) and keeps AX', async () => {
    const gt = await runSource('CMP 4A\nHLT', [], { setup: setup({ AX: bin('10110'), mem: { '4A': '1100' } }) });
    expect([gt.cpu.flags.Z, gt.cpu.flags.N]).toEqual([0, 0]);
    expect(gt.cpu.regs.AX).toBe(bin('10110'));
    const eq = await runSource('CMP 4A\nHLT', [], { setup: setup({ AX: 12, mem: { '4A': '1100' } }) });
    expect([eq.cpu.flags.Z, eq.cpu.flags.N]).toEqual([1, 0]);
    const lt = await runSource('CMP 4A\nHLT', [], { setup: setup({ AX: 5, mem: { '4A': '1100' } }) });
    expect([lt.cpu.flags.Z, lt.cpu.flags.N]).toEqual([0, 1]);
  });

  it('LDF/STF: 2A=0100001011001000 2B=1000000000000000 is 100.25', async () => {
    const r = await runSource('LDF 2A\nSTF 30\nHLT', [], {
      setup: setup({ mem: { '2A': '0100001011001000', '2B': '1000000000000000' } }),
    });
    expect(bin16(r.cpu.regs.BX)).toBe('0100001011001000');
    expect(bin16(r.cpu.regs.AX)).toBe('1000000000000000');
    expect(regsToFloat(r.cpu.regs.BX, r.cpu.regs.AX)).toBe(100.25);
    expect(r.cpu.mem.get(0x30).text).toBe('100001011001000');
    expect(r.cpu.mem.get(0x31).text).toBe('1000000000000000');
    expect(floatToRegs(100.25)).toEqual({ bx: 0x42c8, ax: 0x8000 });
  });

  it('INC on memory 1001 -> 1010', async () => {
    const r = await runSource('INC EB\nHLT', [], { setup: setup({ mem: { EB: '1001' } }) });
    expect(r.cpu.mem.get(0xeb).text).toBe('1010');
    expect(r.cpu.flags.C).toBe(0);
    expect(r.cpu.flags.O).toBe(0);
  });

  it('DEC to 0 sets Z = 1', async () => {
    const r = await runSource('DEC AX\nHLT', [], { setup: setup({ AX: 1 }) });
    expect(r.cpu.regs.AX).toBe(0);
    expect(r.cpu.flags.Z).toBe(1);
    expect(r.cpu.flags.N).toBe(0);
  });

  it('INC FFFF -> 0000 with C=1, O=1, Z=1', async () => {
    const r = await runSource('INC AX\nHLT', [], { setup: setup({ AX: 0xffff }) });
    expect(r.cpu.regs.AX).toBe(0);
    expect([r.cpu.flags.C, r.cpu.flags.O, r.cpu.flags.Z]).toEqual([1, 1, 1]);
  });

  it('DEC 0000 -> FFFF with N=1', async () => {
    const r = await runSource('DEC AX\nHLT', [], { setup: setup({ AX: 0 }) });
    expect(r.cpu.regs.AX).toBe(0xffff);
    expect(r.cpu.flags.N).toBe(1);
    expect(r.cpu.flags.Z).toBe(0);
  });

  it('PUSH/POP round trip through mem[BP]', async () => {
    const r = await runSource('PUSH AX\nPOP BX\nHLT', [], { setup: setup({ AX: 103 }) });
    expect(r.cpu.mem.get(0xf80).text).toBe('1100111');
    expect(r.cpu.regs.BX).toBe(103);
    expect(r.cpu.regs.SP).toBe(0xf80);
  });

  it('128 pushes from BP=F80 succeed and the 129th overflows the stack', async () => {
    const src = Array.from({ length: 129 }, () => 'PUSH AX').join('\n') + '\nHLT';
    const r = await runSource(src, [], { setup: setup({ AX: 1 }) });
    expect(r.ended).toBe('error');
    expect(r.error?.id).toBe('stack-overflow');
    expect(r.error?.kind).toBe('fatal');
    expect(r.cpu.regs.SP).toBe(0x1000);
    expect(r.cpu.stats.push).toBe(129);
    expect(r.cpu.mem.get(0xfff).text).toBe('1');
  });

  it('POP on an empty stack raises the ignorable POP error', async () => {
    const r = await runSource('POP AX\nHLT');
    expect(r.ended).toBe('error');
    expect(r.error?.id).toBe('pop-empty');
    expect(r.error?.kind).toBe('ignore');
  });

  it('MOV BP,mem with a valid address moves BP and resets SP', async () => {
    const r = await runSource('MOV BP,3B\nHLT', [], { setup: setup({ mem: { '3B': '110011110001' } }) });
    expect(r.cpu.regs.BP).toBe(0xcf1);
    expect(r.cpu.regs.SP).toBe(0xcf1);
  });

  it('MOV BP,mem with an invalid value raises the BP error', async () => {
    const big = await runSource('MOV BP,3B\nHLT', [], { setup: setup({ mem: { '3B': '1000000000000' } }) });
    expect(big.error?.id).toBe('bp-invalid');
    const text = await runSource('MOV BP,3B\nHLT', [], { setup: setup({ mem: { '3B': '10AX,BX' } }) });
    expect(text.error?.id).toBe('bp-invalid');
    expect(text.cpu.regs.BP).toBe(0xf80);
  });

  it('DIV by zero is a fatal error', async () => {
    const r = await runSource('DIV 20\nHLT', [], { setup: setup({ AX: 7, mem: { '20': '0' } }) });
    expect(r.error?.id).toBe('div-zero');
    expect(r.error?.kind).toBe('fatal');
    expect(r.cpu.status).toBe('error');
  });

  it('DIV uses AX alone as dividend and leaves the remainder in BX', async () => {
    const r = await runSource('DIV 20\nHLT', [], { setup: setup({ AX: 23, BX: 5, mem: { '20': '101' } }) });
    expect(r.cpu.regs.AX).toBe(4);
    expect(r.cpu.regs.BX).toBe(3);
  });

  it('LDB beyond FFF raises the memory-end error', async () => {
    const r = await runSource('LDB FFF\nHLT', [], { setup: setup({ BX: 1 }) });
    expect(r.error?.id).toBe('mem-end');
    expect(r.error?.kind).toBe('pause');
  });

  it('IN on port 5 raises the port error; port 8 reads the clock', async () => {
    const bad = await runSource('IN AX,5\nHLT');
    expect(bad.error?.id).toBe('port-in');
    const clock = await runSource('IN BX,8\nHLT', [], { seconds: 37 });
    expect(clock.cpu.regs.BX).toBe(37);
  });

  it('executing an empty cell is a fatal error even with the ignore option on', async () => {
    const r = await runSource('NOP', [], { ignoreUnknownOpcodes: true });
    expect(r.ended).toBe('error');
    expect(r.error?.id).toBe('blank-cell');
    expect(r.error?.kind).toBe('fatal');
    expect(r.error?.address).toBe(1);
  });

  it('executing a data cell raises the unrecognized-opcode error, skipped with the option on', async () => {
    const src = 'JMP 3\nNOP\nNOP\n1001110001000000\nHLT';
    const err = await runSource(src);
    expect(err.error?.id).toBe('unknown-opcode');
    expect(err.error?.address).toBe(3);
    expect(err.cpu.regs.PC).toBe(4);
    const ok = await runSource(src, [], { ignoreUnknownOpcodes: true });
    expect(ok.ended).toBe('halt');
  });

  it('jumps do not touch the flags: add; eap; mov ax,bx; eap; jc still sees C', async () => {
    const r = await runSource('ADD 20\nEAP\nMOV AX,BX\nEAP\nJC 6\nHLT\nMSG carry\nHLT', [], {
      setup: setup({ AX: 65535, mem: { '20': '1' } }),
    });
    expect(r.lines).toEqual(['0', '1', 'carry']);
    expect(r.cpu.flags.C).toBe(1);
    expect(r.cpu.flags.O).toBe(1);
  });

  it('EAP shows a two’s complement negative after a borrowing SUB (3-5 -> -2)', async () => {
    const r = await runSource('LDT\nSTA 20\nLDT\nSUB 20\nEAP resultado\nHLT', [5, 3]);
    expect(r.lines).toEqual(['resultado -2']);
    expect(r.cpu.flags.N).toBe(1);
    expect(r.cpu.flags.C).toBe(1);
    expect(r.last).toEqual({ decimal: '-2', binary: '1111111111111110' });
  });

  it('LOOP decrements CX and jumps while CX != 0', async () => {
    const r = await runSource('INC BX\nLOOP 0\nHLT', [], { setup: setup({ CX: 4 }) });
    expect(r.cpu.regs.BX).toBe(4);
    expect(r.cpu.regs.CX).toBe(0);
    expect(r.cpu.stats.saltosCondicionales).toBe(4);
  });

  it('float arithmetic uses single precision and sets Z/N', async () => {
    const r = await runSource('LDF 20\nSUBF 22\nHLT', [], {
      setup: (cpu) => {
        const a = floatToRegs(2.5);
        const b = floatToRegs(2.5);
        cpu.mem.set(0x20, a.bx.toString(2));
        cpu.mem.set(0x21, a.ax.toString(2));
        cpu.mem.set(0x22, b.bx.toString(2));
        cpu.mem.set(0x23, b.ax.toString(2));
      },
    });
    expect(r.cpu.flags.Z).toBe(1);
    expect(r.cpu.flags.N).toBe(0);
    expect(regsToFloat(r.cpu.regs.BX, r.cpu.regs.AX)).toBe(0);
  });

  it('ITOF and FTOI use signed 16-bit two’s complement', async () => {
    const r = await runSource('ITOF\nHLT', [], { setup: setup({ AX: 0xfffe }) });
    expect(regsToFloat(r.cpu.regs.BX, r.cpu.regs.AX)).toBe(-2);
    expect(r.cpu.flags.N).toBe(1);
    const back = await runSource('FTOI\nHLT', [], {
      setup: (cpu) => {
        const { bx, ax } = floatToRegs(-2.75);
        cpu.regs.BX = bx;
        cpu.regs.AX = ax;
      },
    });
    expect(back.cpu.regs.AX).toBe(0xfffe);
    expect(back.cpu.flags.N).toBe(1);
    expect(back.cpu.flags.O).toBe(0);
  });

  it('OUT 1 prints the float rounded to 4 decimals without trailing zeros', async () => {
    const r = await runSource('OUT 1,AX\nHLT', [], {
      setup: (cpu) => {
        const { bx, ax } = floatToRegs(5 / 3);
        cpu.regs.BX = bx;
        cpu.regs.AX = ax;
      },
    });
    expect(r.lines).toEqual(['1.6667']);
  });

  it('OUT 13 beeps with the register as frequency and BX as duration', async () => {
    const r = await runSource('OUT 13,AX\nHLT', [], { setup: setup({ AX: 2600, BX: 500 }) });
    expect(r.ended).toBe('halt');
    expect(r.ports.beeps).toEqual([{ hz: 2600, ms: 500 }]);
  });

  it('multiplies pairs of 16-bit words (product in BX:AX) and divides with quotient and remainder', async () => {
    const data = { '102': '1100', '103': '1011101110111', '104': '11001000', '105': '111' };
    const m1 = await runSource('LDA 102\nMUL 103\nSTA 200\nMOV 201,BX\nHLT', [], { setup: setup({ mem: data }) });
    expect(m1.ended).toBe('halt');
    expect(m1.cpu.mem.readData(0x200).value).toBe((12 * 6007) % 65536);
    expect(m1.cpu.mem.readData(0x201).value).toBe(1);
    expect(m1.cpu.flags.O).toBe(1);
    const m2 = await runSource('LDA 104\nMUL 105\nSTA 202\nMOV 203,BX\nHLT', [], { setup: setup({ mem: data }) });
    expect(m2.cpu.mem.readData(0x202).value).toBe(1400);
    expect(m2.cpu.mem.readData(0x203).value).toBe(0);
    const d = await runSource('LDA 103\nDIV 104\nSTA 204\nMOV 205,BX\nEAP cociente\nMOV AX,BX\nEAP residuo\nHLT', [], { setup: setup({ mem: data }) });
    expect(d.lines).toEqual(['cociente 30', 'residuo 7']);
    expect(d.cpu.mem.get(0x204).text).toBe('11110');
    expect(d.cpu.mem.get(0x205).text).toBe('111');
  });

  it('JMP 000 for 1,000,000 cycles with animation off keeps the log at its cap', async () => {
    const asm = assemble('JMP 000');
    const mem = new Memory();
    mem.load(asm.cells);
    const cpu = new Cpu(mem, createTestDevices().devices);
    cpu.animation = false;
    for (let i = 0; i < 1_000_000; i++) cpu.step();
    expect(cpu.stats.instrucciones).toBe(1_000_000);
    expect(cpu.log.length).toBeLessThanOrEqual(2000);
    cpu.animation = true;
    for (let i = 0; i < 3000; i++) cpu.step();
    expect(cpu.log.length).toBe(2000);
    expect(cpu.log.lines()).toHaveLength(2000);
  });
});

/** Like setup(), and also sets the flags before the snippet runs. */
function withFlags(flags: Partial<Flags>, init: Parameters<typeof setup>[0] = {}) {
  return (cpu: Cpu) => {
    setup(init)(cpu);
    Object.assign(cpu.flags, flags);
  };
}

/** Writes a float into memory as two 16-bit binary words (high word first). */
function setFloat(cpu: Cpu, addr: number, value: number) {
  const { bx, ax } = floatToRegs(value);
  cpu.mem.set(addr, bx.toString(2));
  cpu.mem.set(addr + 1, ax.toString(2));
}

describe('regresiones de flags y estadísticas', () => {
  it('ADD FFFF+1 leaves BX:AX = 1:0000 with Z = 0 (Z looks at the whole sum)', async () => {
    const r = await runSource('ADD 20\nHLT', [], { setup: setup({ AX: 0xffff, mem: { '20': '1' } }) });
    expect(r.cpu.regs.AX).toBe(0);
    expect(r.cpu.regs.BX).toBe(1);
    expect([r.cpu.flags.C, r.cpu.flags.O, r.cpu.flags.Z, r.cpu.flags.N]).toEqual([1, 1, 0, 0]);
    const jeq = await runSource('ADD 20\nJEQ 4\nMSG nocero\nHLT\nMSG cero\nHLT', [], {
      setup: setup({ AX: 0xffff, mem: { '20': '1' } }),
    });
    expect(jeq.lines).toEqual(['nocero']);
  });

  it('FTOI of -0.5 gives AX = 0 with Z = 1 and N = 0 (both flags follow the converted integer)', async () => {
    const r = await runSource('FTOI\nHLT', [], {
      setup: (cpu) => {
        const { bx, ax } = floatToRegs(-0.5);
        cpu.regs.BX = bx;
        cpu.regs.AX = ax;
      },
    });
    expect(r.cpu.regs.AX).toBe(0);
    expect(r.cpu.flags.Z).toBe(1);
    expect(r.cpu.flags.N).toBe(0);
  });

  it('MUL clears a stale N, so EAP shows 100*500 as 50000', async () => {
    const r = await runSource('MUL 20\nEAP\nHLT', [], { setup: withFlags({ N: 1 }, { AX: 100, mem: { '20': '111110100' } }) });
    expect(r.cpu.flags.N).toBe(0);
    expect(r.lines).toEqual(['50000']);
  });

  it('DIV clears a stale N, so EAP shows 50000/1 as 50000', async () => {
    const r = await runSource('DIV 20\nEAP\nHLT', [], { setup: withFlags({ N: 1 }, { AX: 50000, mem: { '20': '1' } }) });
    expect(r.cpu.flags.N).toBe(0);
    expect(r.lines).toEqual(['50000']);
  });

  it('Aritméticas counts ITOF and FTOI but not INC and DEC (per-handler markers of the original)', async () => {
    const conv = await runSource('ITOF\nFTOI\nHLT');
    expect(conv.cpu.stats.aritmeticas).toBe(2);
    const incdec = await runSource('INC AX\nDEC AX\nHLT');
    expect(incdec.cpu.stats.aritmeticas).toBe(0);
    const all = await runSource('INC AX\nDEC AX\nITOF\nFTOI\nADD 10\nHLT');
    expect(all.cpu.stats.aritmeticas).toBe(3);
    expect(all.cpu.stats.instrucciones).toBe(6);
  });

  it.each(['2147483647', '-2147483647'])('a keyboard float %s that the parser accepts adds to 0 without overflow', async (raw) => {
    const k = parseKeyboardInput(raw, 'float');
    expect(k.ok).toBe(true);
    if (!k.ok) return;
    const r = await runSource('IN AX,1\nSTF 20\nLDF 22\nADDF 20\nHLT', [k.value], {
      setup: setup({ mem: { '22': '0', '23': '0' } }),
    });
    expect(r.ended).toBe('halt');
    expect(r.cpu.flags.O).toBe(0);
  });

  it('MULF overflow still sets O and clamps the result', async () => {
    const r = await runSource('LDF 20\nMULF 22\nHLT', [], {
      setup: (cpu) => {
        setFloat(cpu, 0x20, 2000000000);
        setFloat(cpu, 0x22, 2);
      },
    });
    expect(r.cpu.flags.O).toBe(1);
    expect(regsToFloat(r.cpu.regs.BX, r.cpu.regs.AX)).toBe(Math.fround(2147483647));
  });
});

describe('textos del ciclo como en el binario original', () => {
  async function logOf(source: string, init: Parameters<typeof setup>[0] | ((cpu: Cpu) => void)) {
    const r = await runSource(source, [], { animation: true, setup: typeof init === 'function' ? init : setup(init) });
    expect(r.ended).toBe('halt');
    return r.cpu.log.lines();
  }

  it('MUL with overflow has no ADD overflow line', async () => {
    const lines = await logOf('MUL 20\nHLT', { AX: 0xffff, mem: { '20': '10' } });
    expect(lines.some((l) => l.includes('Overflow'))).toBe(false);
    expect(lines).toContain('Después de Realizada la MULTIPLICACION, almaceno el resultado en AX');
  });

  it('ADD with overflow writes the SUMA line before the overflow line', async () => {
    const lines = await logOf('ADD 20\nHLT', { AX: 0xffff, mem: { '20': '1' } });
    const suma = lines.indexOf('Después de Realizada la SUMA, almaceno el resultado en AX');
    const over = lines.indexOf('Como hubo Overflow activo el flag y parto el resultado en AX y BX');
    expect(suma).toBeGreaterThanOrEqual(0);
    expect(over).toBe(suma + 1);
  });

  it('OR and XOR quote the operation name like the original', async () => {
    const or = await logOf('OR AX,20\nHLT', { AX: 1, mem: { '20': '10' } });
    expect(or).toContain('Leo AX para hacerle un "O inclusive lógico" con lo que esta en 020');
    expect(or).toContain('Leo de la Pos 020 de memoria el valor a hacerle el O INCLUSIVE LOGICO con el valor 0000000000000001');
    const orMem = await logOf('OR 20,AX\nHLT', { AX: 1, mem: { '20': '10' } });
    expect(orMem).toContain('Leo de la Pos 020 de memoria el valor a hacerle el "O inclusive logico" con AX');
    expect(orMem).toContain('Leo AX, el segundo parametro para hacerle un "O inclusive lógico" con 020');
    const xor = await logOf('XOR AX,20\nHLT', { AX: 1, mem: { '20': '10' } });
    expect(xor).toContain('Leo AX para hacerle un "O exclusivo" con lo que esta en 020');
    expect(xor).toContain('Leo de la Pos 020 de memoria el valor a hacerle el O exclusivo con el valor 0000000000000001');
    const xorMem = await logOf('XOR 20,AX\nHLT', { AX: 1, mem: { '20': '10' } });
    expect(xorMem).toContain('Leo de la Pos 020 de memoria el valor a hacerle el "O exclusivo" con AX');
    const and = await logOf('AND 20,AX\nHLT', { AX: 1, mem: { '20': '10' } });
    expect(and).toContain('Leo de la Pos 020 de memoria el valor a hacerle el Y LOGICO con AX');
    expect(and).toContain('Leo AX, el segundo parametro para hacerle un Y logico con 020');
  });

  it('shifts end the count with "veces." and write the result with no carry suffix', async () => {
    const lines = await logOf('SHL AX,3\nROR 20,1\nHLT', { AX: 1, mem: { '20': '1' } });
    expect(lines).toContain('Leo AX Para hacerle el desplazamiento a la IZQ 3 veces.');
    expect(lines).toContain('Leo de la Pos 020 el valor Para hacerle La Rotación a la Der 1 veces.');
    expect(lines).toContain('Escribo 0000000000001000 en AX');
    expect(lines.some((l) => l.includes('Ultimo bit'))).toBe(false);
  });

  it('LDB and STB end the BX line with " posiciones."', async () => {
    const lines = await logOf('LDB 20\nSTB 30\nHLT', { BX: 5, mem: { '25': '1' } });
    expect(lines).toContain('LDB: 020 a esta dirección le sumo el valor de BX: 5 posiciones.');
    expect(lines).toContain('STB: 030 a esta dirección le sumo el valor de BX: 5 posiciones.');
  });

  it('ADDF/SUBF say "Pos de Mem", MULF/DIVF say "Dir de Mem", and only ADDF has no comma in the overflow line', async () => {
    const floats = (cpu: Cpu) => {
      setFloat(cpu, 0x20, 1);
      setFloat(cpu, 0x22, 3e38);
    };
    const addf = await logOf('LDF 22\nADDF 22\nHLT', floats);
    expect(addf).toContain('Llevo la Pos de Mem 022 a MAR de donde esta lo que voy a sumar con BX y AX');
    expect(addf).toContain('Como hubo Overflow activo el O flag');
    const subf = await logOf('LDF 22\nSUBF 20\nHLT', floats);
    expect(subf).toContain('Llevo la Pos de Mem 020 a MAR de donde esta lo que voy a restar con BX y AX');
    const mulf = await logOf('LDF 22\nMULF 22\nHLT', floats);
    expect(mulf).toContain('Llevo la Dir de Mem 022 a MAR de donde esta lo que voy a multiplicar con BX y AX');
    expect(mulf).toContain('Como hubo Overflow, activo el O flag');
    const divf = await logOf('LDF 22\nDIVF 20\nHLT', floats);
    expect(divf).toContain('Llevo la Dir de Mem 020 a MAR de donde esta lo que voy a dividir con BX y AX');
  });
});

describe('cobertura de instrucciones sin test', () => {
  it('the ISA has the 53 instructions of the original list, in order', () => {
    const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const codes = [...range(1, 4), ...range(6, 18), ...range(20, 27), ...range(29, 42), 50, 51, 55, 56, ...range(60, 65), 80, 81, 90, 99];
    expect(codes).toHaveLength(53);
    expect(ISA.map((d) => d.code)).toEqual(codes);
  });

  it.each([
    ['JEQ', { Z: 1 }, true],
    ['JEQ', { Z: 0 }, false],
    ['JNE', { Z: 0 }, true],
    ['JNE', { Z: 1 }, false],
    ['JME', { N: 1 }, true],
    ['JME', { N: 0 }, false],
    ['JMA', { Z: 0, N: 0 }, true],
    ['JMA', { Z: 1, N: 0 }, false],
    ['JMA', { Z: 0, N: 1 }, false],
    ['JC', { C: 1 }, true],
    ['JC', { C: 0 }, false],
    ['JNC', { C: 0 }, true],
    ['JNC', { C: 1 }, false],
    ['JO', { O: 1 }, true],
    ['JO', { O: 0 }, false],
    ['JNO', { O: 0 }, true],
    ['JNO', { O: 1 }, false],
  ] as const)('%s with %o jumps: %s', async (mnemonic, flags, taken) => {
    const r = await runSource(`${mnemonic} 3\nMSG no\nHLT\nMSG si\nHLT`, [], { setup: withFlags(flags) });
    expect(r.ended).toBe('halt');
    expect(r.lines).toEqual([taken ? 'si' : 'no']);
    expect(r.cpu.flags).toMatchObject(flags);
    expect(r.cpu.stats.saltosCondicionales).toBe(1);
  });

  it('XAB swaps AX and BX', async () => {
    const r = await runSource('XAB\nHLT', [], { setup: setup({ AX: 1, BX: 2 }) });
    expect([r.cpu.regs.AX, r.cpu.regs.BX]).toEqual([2, 1]);
  });

  it('CLN, CLC, STC and CMC change only their flag', async () => {
    const cln = await runSource('CLN\nHLT', [], { setup: withFlags({ Z: 1, N: 1, C: 1, O: 1 }) });
    expect(cln.cpu.flags).toEqual({ Z: 1, N: 0, C: 1, O: 1 });
    const clc = await runSource('CLC\nHLT', [], { setup: withFlags({ Z: 1, N: 1, C: 1, O: 1 }) });
    expect(clc.cpu.flags).toEqual({ Z: 1, N: 1, C: 0, O: 1 });
    const stc = await runSource('STC\nHLT');
    expect(stc.cpu.flags).toEqual({ Z: 0, N: 0, C: 1, O: 0 });
    const cmc = await runSource('CMC\nHLT');
    expect(cmc.cpu.flags.C).toBe(1);
    const cmc2 = await runSource('CMC\nCMC\nHLT');
    expect(cmc2.cpu.flags.C).toBe(0);
  });

  it('DIVF with a negative dividend: -7.5 / 2 = -3.75, N = 1, CX = trunc(-1.5) as 16 bits', async () => {
    const r = await runSource('LDF 20\nDIVF 22\nHLT', [], {
      setup: (cpu) => {
        setFloat(cpu, 0x20, -7.5);
        setFloat(cpu, 0x22, 2);
      },
    });
    expect(regsToFloat(r.cpu.regs.BX, r.cpu.regs.AX)).toBe(-3.75);
    expect([r.cpu.flags.Z, r.cpu.flags.N, r.cpu.flags.O]).toEqual([0, 1, 0]);
    expect(r.cpu.regs.CX).toBe(0xffff);
  });
});
