import { nullDevices } from './devices';
import { errors, RuntimeError, type RuntimeErrorInfo } from './errors';
import { FLOAT_LIMIT_F32, floatToRegs, formatFloat, regsToFloat } from './float';
import { bin16, bin32, displayDecimal, hex3 } from './format';
import type { InstrDef } from './isa';
import { LogBuffer } from './log';
import { MAX_ADDR, MEM_SIZE, Memory } from './memory';
import type { Operand } from './operands';
import { DIALOG_TEXTS, END_TEXTS, FETCH_TEXTS } from './texts';
import {
  emptyStats,
  type Devices,
  type Flags,
  type InputRequest,
  type RegName,
  type Registers,
  type StatClass,
  type Stats,
} from './types';

export type CpuStatus = 'stopped' | 'running' | 'waiting' | 'halted' | 'error';

export type StepResult =
  | { type: 'ok' }
  | { type: 'halt' }
  | { type: 'input'; request: InputRequest }
  | { type: 'error'; error: RuntimeErrorInfo };

/** Accesses of the last step, used by the UI for the highlights. */
export interface StepTrace {
  reads: number[];
  writes: number[];
  regs: string[];
}

export interface CpuOptions {
  ignoreUnknownOpcodes: boolean;
  floatDecimals: number;
  stripTrailingZeros: boolean;
}

export const DEFAULT_BP = 0xf80;
const OK: StepResult = { type: 'ok' };
const HALT: StepResult = { type: 'halt' };

function memOf(op: Operand): number {
  if (op.kind !== 'mem') throw new Error('operando de memoria esperado');
  return op.addr;
}

function regOf(op: Operand): RegName {
  if (op.kind !== 'reg') throw new Error('registro esperado');
  return op.reg;
}

function numOf(op: Operand): number {
  if (op.kind !== 'count' && op.kind !== 'port') throw new Error('número esperado');
  return op.n;
}

function opName(op: Operand): string {
  return op.kind === 'reg' ? op.reg : op.kind === 'mem' ? hex3(op.addr) : String(op.n);
}

/** The simulated processor. Synchronous: LDT and IN 1 suspend it until deliverInput(). */
export class Cpu {
  readonly mem: Memory;
  readonly regs: Registers;
  readonly flags: Flags;
  readonly stats: Stats;
  readonly options: CpuOptions;
  readonly log: LogBuffer;
  readonly trace: StepTrace;
  devices: Devices;
  /** With animation off no micro-step lines and no highlights are produced. */
  animation = true;
  status: CpuStatus = 'stopped';
  pending: InputRequest | null = null;

  constructor(mem?: Memory, devices?: Devices) {
    this.mem = mem ?? new Memory();
    this.devices = devices ?? nullDevices();
    this.regs = { AX: 0, BX: 0, CX: 0, PC: 0, MAR: 0, MDR: '', IR: '', BP: DEFAULT_BP, SP: DEFAULT_BP };
    this.flags = { Z: 0, N: 0, C: 0, O: 0 };
    this.stats = emptyStats();
    this.options = { ignoreUnknownOpcodes: false, floatDecimals: 4, stripTrailingZeros: true };
    this.log = new LogBuffer(2000);
    this.trace = { reads: [], writes: [], regs: [] };
  }

  /** "Reiniciar Registros": PC=000, SP=BP, flags 0, AX=BX=CX=0; memory intact. */
  resetRegisters(): void {
    const r = this.regs;
    r.AX = 0;
    r.BX = 0;
    r.CX = 0;
    r.PC = 0;
    r.MAR = 0;
    r.MDR = '';
    r.IR = '';
    r.SP = r.BP;
    this.flags.Z = 0;
    this.flags.N = 0;
    this.flags.C = 0;
    this.flags.O = 0;
    this.pending = null;
    this.status = 'stopped';
    this.clearTrace();
  }

  /** Full reset for "Nuevo Programa": registers, BP=F80, statistics and log. */
  resetAll(): void {
    this.regs.BP = DEFAULT_BP;
    this.resetRegisters();
    this.resetStats();
    this.log.clear();
  }

  resetStats(): void {
    Object.assign(this.stats, emptyStats());
  }

  /** Abandons a pending keyboard request (manual stop). */
  cancelInput(): void {
    this.pending = null;
  }

  private clearTrace(): void {
    this.trace.reads.length = 0;
    this.trace.writes.length = 0;
    this.trace.regs.length = 0;
  }

  /** One cycle: fetch (MAR, MDR, IR, PC+1) and execute. */
  step(): StepResult {
    if (this.pending) return { type: 'input', request: this.pending };
    this.clearTrace();
    this.status = 'running';
    const pc = this.regs.PC;
    if (pc < 0 || pc >= MEM_SIZE) return this.raise(errors.blankCell(pc));
    const cell = this.mem.cells[pc];
    this.regs.MAR = pc;
    this.regs.MDR = cell.text;
    this.regs.IR = cell.text;
    this.regs.PC = pc + 1;
    if (this.animation) {
      this.trace.reads.push(pc);
      this.log.push(FETCH_TEXTS.pc(hex3(pc)));
      this.log.push(FETCH_TEXTS.mar);
      this.log.push(FETCH_TEXTS.mdr);
      this.log.push(FETCH_TEXTS.ir);
    }
    if (cell.text === '') return this.raise(errors.blankCell(pc));
    const d = this.mem.decode(pc);
    if (!d.def || !d.ops) {
      if (d.def && d.badShiftCount) return this.raise(errors.shiftCount(d.def.mnemonic));
      if (this.options.ignoreUnknownOpcodes) {
        this.log.push(`Codigo de Operacion no reconocido en la Dir: ${hex3(pc)} (instrucción ignorada)`);
        return OK;
      }
      return this.raise(errors.unknownOpcode(pc));
    }
    this.stats.instrucciones++;
    this.countClass(d.def.cls);
    try {
      return this.execute(d.def, d.ops, cell.comment);
    } catch (e) {
      if (e instanceof RuntimeError) return this.raise(e.info);
      throw e;
    }
  }

  /** Completes a suspended LDT (AX ← value) or IN 1 (BX:AX ← IEEE 754 single). */
  deliverInput(value: number): void {
    const req = this.pending;
    if (!req) return;
    this.pending = null;
    this.status = 'running';
    if (req.kind === 'ldt') {
      const v = Math.trunc(value) & 0xffff;
      this.regs.AX = v;
      this.trace.regs.push('AX');
      this.emit(`Dato leido del teclado: ${v}. Lo llevo a AX: ${bin16(v)}`);
    } else {
      const { bx, ax } = floatToRegs(value);
      this.regs.BX = bx;
      this.regs.AX = ax;
      this.trace.regs.push('BX', 'AX');
      this.emit(`Numero flotante leido: ${value}. Lo llevo a BX y AX: ${bin32(bx, ax)}`);
    }
  }

  private raise(info: RuntimeErrorInfo): StepResult {
    this.log.push(info.summary);
    if (info.kind === 'fatal') this.status = 'error';
    return { type: 'error', error: info };
  }

  private emit(line: string): void {
    if (this.animation) this.log.push(line);
  }

  private countClass(c: StatClass): void {
    const s = this.stats;
    switch (c) {
      case 'condJump':
        s.saltosCondicionales++;
        break;
      case 'uncondJump':
        s.saltosIncondicionales++;
        break;
      case 'push':
        s.push++;
        break;
      case 'pop':
        s.pop++;
        break;
      case 'compare':
        s.comparaciones++;
        break;
      case 'logic':
        s.logicas++;
        break;
      case 'arith':
        s.aritmeticas++;
        break;
      case 'shift':
        s.desplazamientos++;
        break;
      case 'input':
        s.entrada++;
        break;
      case 'output':
        s.salida++;
        break;
      default:
        break;
    }
  }

  // ----- data access -----

  private readData(addr: number): number {
    const r = this.mem.readData(addr);
    this.regs.MAR = addr;
    this.regs.MDR = this.mem.cells[addr].text;
    if (this.animation) this.trace.reads.push(addr);
    if (r.warning) this.log.push(r.warning);
    return r.value;
  }

  private writeData(addr: number, value: number): void {
    this.mem.writeData(addr, value);
    this.regs.MAR = addr;
    this.regs.MDR = this.mem.cells[addr].text;
    if (this.animation) this.trace.writes.push(addr);
  }

  private setReg(reg: RegName, value: number): void {
    if (reg === 'BP') {
      this.setBP(value);
      return;
    }
    this.regs[reg] = value & 0xffff;
    this.trace.regs.push(reg);
  }

  /** Writing BP validates an address 000-FFF and resets SP to the new BP. */
  private setBP(value: number): void {
    if (value < 0 || value > MAX_ADDR) throw new RuntimeError(errors.bpInvalid());
    this.regs.BP = value;
    this.regs.SP = value;
    this.trace.regs.push('BP', 'SP');
  }

  private getOperand(op: Operand): number {
    return op.kind === 'reg' ? this.regs[op.reg] : this.readData(memOf(op));
  }

  private setOperand(op: Operand, value: number): void {
    if (op.kind === 'reg') this.setReg(op.reg, value);
    else this.writeData(memOf(op), value);
  }

  private setZ(value: number): void {
    this.flags.Z = value === 0 ? 1 : 0;
  }

  private jump(target: number, mnemonic: string, taken: boolean, why: string): void {
    if (taken) {
      this.regs.PC = target;
      this.emit(`${mnemonic}: Como ${why}, la prox dirección a ejecutar sera: ${hex3(target)}`);
    } else {
      this.emit(`${mnemonic}: La condición (${why}) no se cumple, no salto.`);
    }
  }

  private shiftBits(code: number, v: number, n: number): { r: number; c: 0 | 1 } {
    let c: 0 | 1 = 0;
    for (let i = 0; i < n; i++) {
      switch (code) {
        case 15: // ROL
          c = ((v >>> 15) & 1) as 0 | 1;
          v = ((v << 1) | c) & 0xffff;
          break;
        case 16: // ROR
          c = (v & 1) as 0 | 1;
          v = (v >>> 1) | (c << 15);
          break;
        case 17: // SHL
          c = ((v >>> 15) & 1) as 0 | 1;
          v = (v << 1) & 0xffff;
          break;
        default: // SHR
          c = (v & 1) as 0 | 1;
          v = v >>> 1;
          break;
      }
    }
    return { r: v, c };
  }

  private readFloatAt(addr: number, mnemonic: string): number {
    if (addr + 1 > MAX_ADDR) throw new RuntimeError(errors.memoryEnd(mnemonic, false));
    const hi = this.readData(addr);
    const lo = this.readData(addr + 1);
    return regsToFloat(hi, lo);
  }

  private setFloatResult(r: number): void {
    const { bx, ax } = floatToRegs(r);
    this.regs.BX = bx;
    this.regs.AX = ax;
    this.trace.regs.push('BX', 'AX');
    this.setZ(r);
    this.flags.N = r < 0 ? 1 : 0;
  }

  // ----- execute -----

  private execute(def: InstrDef, ops: Operand[], comment: string): StepResult {
    const r = this.regs;
    const f = this.flags;
    const a = this.animation;
    switch (def.code) {
      case 1: {
        // LDA mem
        const m = memOf(ops[0]);
        if (a) this.log.push(`Busco en la Pos de Mem ${hex3(m)} lo que voy a cargar en AX.`);
        const v = this.readData(m);
        if (a) this.log.push(`Llevo al MDR el contenido de la dirección ${hex3(m)}`);
        this.setReg('AX', v);
        if (a) this.log.push(`Cargo en AX el contenido de la dirección ${hex3(m)}`);
        return OK;
      }
      case 2: {
        // STA mem
        const m = memOf(ops[0]);
        if (a) {
          this.log.push(`Llevo la Pos de Mem ${hex3(m)} a MAR que es donde voy a guardar AX.`);
          this.log.push('Leo AX Para ser llevado al MDR antes de ser escrito en Memoria');
          this.log.push(`Llevo a MDR el contenido de AX para luego escribirlo en ${hex3(m)}`);
        }
        this.writeData(m, r.AX);
        if (a) this.log.push(`Escribo en la Pos ${hex3(m)} el valor: ${bin16(r.AX)}`);
        return OK;
      }
      case 3: {
        // XAB
        const t = r.AX;
        r.AX = r.BX;
        r.BX = t;
        this.trace.regs.push('AX', 'BX');
        this.emit('Se Intercambian los valores de AX y BX');
        return OK;
      }
      case 4: // CLA
        this.setReg('AX', 0);
        this.emit('CLA: Vuelvo AX = 0');
        return OK;
      case 6: {
        // PUSH reg
        const reg = regOf(ops[0]);
        if (r.SP > MAX_ADDR) throw new RuntimeError(errors.stackOverflow());
        const v = r[reg];
        if (a) this.log.push(`Llevo el Valor del Registro ${reg} a la Pila.`);
        this.writeData(r.SP, v);
        if (a) this.log.push(`Escribo el la Pos ${hex3(r.SP)} el valor: ${bin16(v)}`);
        r.SP = r.SP + 1;
        this.trace.regs.push('SP');
        return OK;
      }
      case 7: {
        // POP reg
        const reg = regOf(ops[0]);
        if (r.SP <= r.BP) throw new RuntimeError(errors.popEmpty());
        const v = this.readData(r.SP - 1);
        if (reg === 'BP' && (v < 0 || v > MAX_ADDR)) throw new RuntimeError(errors.bpInvalid());
        r.SP = r.SP - 1;
        this.trace.regs.push('SP');
        if (a) this.log.push(`Traigo de la pila el ultimo valor almacenado y lo llevo al Registro ${reg}`);
        this.setReg(reg, v);
        return OK;
      }
      case 8: {
        // INC dest
        const op = ops[0];
        if (a) {
          this.log.push(
            op.kind === 'reg'
              ? `Leo ${op.reg} (registro a incrementar) para llevarlo a la ALU y sumarle 1`
              : `Leo de la Pos ${hex3(memOf(op))} de memoria el valor a incrementar`,
          );
        }
        const v = this.getOperand(op);
        const s = v + 1;
        const res = s & 0xffff;
        if (op.kind === 'reg' && op.reg === 'BP' && res > MAX_ADDR) throw new RuntimeError(errors.bpInvalid());
        f.C = s > 0xffff ? 1 : 0;
        f.O = f.C;
        this.setZ(res);
        this.setOperand(op, res);
        if (a) {
          this.log.push(
            op.kind === 'reg'
              ? `Escribo ${op.reg} (registro ya incrementado)`
              : `Escribo el valor en memoria ya incrementado en la pos ${hex3(memOf(op))}`,
          );
        }
        return OK;
      }
      case 9: {
        // DEC dest
        const op = ops[0];
        if (a) {
          this.log.push(
            op.kind === 'reg'
              ? `Leo ${op.reg} (registro a Decrementar) para llevarlo a la ALU y restarle 1`
              : `Leo de la Pos ${hex3(memOf(op))} de memoria el valor a decrementar`,
          );
        }
        const v = this.getOperand(op);
        const res = (v - 1) & 0xffff;
        if (op.kind === 'reg' && op.reg === 'BP' && v === 0) throw new RuntimeError(errors.bpInvalid());
        f.N = v === 0 ? 1 : 0;
        this.setZ(res);
        this.setOperand(op, res);
        if (a) {
          this.log.push(
            op.kind === 'reg'
              ? `Escribo ${op.reg} (registro ya decrementado)`
              : `Escribo el valor en memoria ya decrementado en la pos ${hex3(memOf(op))}`,
          );
        }
        return OK;
      }
      case 10: {
        // MOV dest,orig
        const dest = ops[0];
        const orig = ops[1];
        const destName = opName(dest);
        if (a) {
          this.log.push(
            orig.kind === 'reg'
              ? `Leo ${orig.reg} para copiarlo a ${destName}`
              : `Leo de la Pos ${hex3(memOf(orig))} de memoria el valor a copiar en ${destName}`,
          );
        }
        if (dest.kind === 'reg' && dest.reg === 'BP' && orig.kind === 'mem' && !this.mem.isBinary(memOf(orig))) {
          throw new RuntimeError(errors.bpInvalid());
        }
        const v = this.getOperand(orig);
        this.setOperand(dest, v);
        if (a) this.log.push(`Escribo ${bin16(v)} en ${destName}`);
        return OK;
      }
      case 11:
      case 13:
      case 14: {
        // AND / OR / XOR dest,orig
        const dest = ops[0];
        const orig = ops[1];
        const d = opName(dest);
        const o = opName(orig);
        // The original quotes the OR/XOR names in some lines and not in others.
        const name = def.code === 11 ? 'Y logico' : def.code === 13 ? '"O inclusive lógico"' : '"O exclusivo"';
        const memName = def.code === 11 ? 'Y LOGICO' : def.code === 13 ? '"O inclusive logico"' : '"O exclusivo"';
        const upper = def.code === 11 ? 'Y LOGICO' : def.code === 13 ? 'O INCLUSIVE LOGICO' : 'O exclusivo';
        if (a) {
          this.log.push(
            dest.kind === 'reg'
              ? `Leo ${d} para hacerle un ${name} con lo que esta en ${o}`
              : `Leo de la Pos ${d} de memoria el valor a hacerle el ${memName} con ${o}`,
          );
        }
        const dv = this.getOperand(dest);
        if (a) {
          this.log.push(
            orig.kind === 'reg'
              ? `Leo ${o}, el segundo parametro para hacerle un ${name} con ${d}`
              : `Leo de la Pos ${o} de memoria el valor a hacerle el ${upper} con el valor ${bin16(dv)}`,
          );
        }
        const ov = this.getOperand(orig);
        const res = (def.code === 11 ? dv & ov : def.code === 13 ? dv | ov : dv ^ ov) & 0xffff;
        this.setZ(res);
        this.setOperand(dest, res);
        if (a) this.log.push(`Escribo ${bin16(res)} en ${d}`);
        return OK;
      }
      case 12: {
        // NOT dest
        const dest = ops[0];
        const d = opName(dest);
        if (a) {
          this.log.push(
            dest.kind === 'reg'
              ? `Leo ${d} Para hacer el NOT con el mismo.`
              : `Leo de la Pos ${d} de memoria el valor Para hacer el NOT con el mismo.`,
          );
        }
        const res = ~this.getOperand(dest) & 0xffff;
        this.setZ(res);
        this.setOperand(dest, res);
        if (a) this.log.push(`Escribo ${bin16(res)} en ${d}`);
        return OK;
      }
      case 15:
      case 16:
      case 17:
      case 18: {
        // ROL / ROR / SHL / SHR dest,n
        const dest = ops[0];
        const n = numOf(ops[1]);
        const d = opName(dest);
        const what =
          def.code === 15
            ? 'La Rotación a la Izq'
            : def.code === 16
              ? 'La Rotación a la Der'
              : def.code === 17
                ? 'el desplazamiento a la IZQ'
                : 'el desplazamiento a la DER';
        if (a) {
          this.log.push(
            dest.kind === 'reg'
              ? `Leo ${d} Para hacerle ${what} ${n} veces.`
              : `Leo de la Pos ${d} el valor Para hacerle ${what} ${n} veces.`,
          );
        }
        const v = this.getOperand(dest);
        const { r: res, c } = this.shiftBits(def.code, v, n);
        f.C = c;
        this.setZ(res);
        this.setOperand(dest, res);
        if (a) this.log.push(`Escribo ${bin16(res)} en ${d}`);
        return OK;
      }
      case 20: {
        // ADD mem
        const m = memOf(ops[0]);
        if (a) this.log.push(`Llevo la Pos de Mem ${hex3(m)} a MAR de donde esta lo que voy a sumar con AX`);
        const v = this.readData(m);
        if (a) {
          this.log.push(`Llevo al MDR el contenido de la dirección ${hex3(m)}`);
          this.log.push('Leo AX y MDR Para ser llevados a la ALU y realizar la suma');
        }
        const s = r.AX + v;
        if (s > 0xffff) {
          this.setReg('AX', s & 0xffff);
          this.setReg('BX', s >>> 16);
          f.C = 1;
          f.O = 1;
        } else {
          this.setReg('AX', s);
          f.C = 0;
          f.O = 0;
        }
        f.N = 0;
        this.setZ(s);
        if (a) {
          this.log.push('Después de Realizada la SUMA, almaceno el resultado en AX');
          if (s > 0xffff) this.log.push('Como hubo Overflow activo el flag y parto el resultado en AX y BX');
        }
        return OK;
      }
      case 21: {
        // SUB mem
        const m = memOf(ops[0]);
        if (a) this.log.push(`Llevo la Pos de Mem ${hex3(m)} a MAR de donde esta lo que voy a restar a AX`);
        const v = this.readData(m);
        if (a) {
          this.log.push(`Llevo al MDR el contenido de la dirección ${hex3(m)}`);
          this.log.push('Leo AX y MDR Para ser llevados a la ALU y realizar la resta');
        }
        if (r.AX >= v) {
          this.setReg('AX', r.AX - v);
          f.N = 0;
          f.C = 0;
        } else {
          this.setReg('AX', (r.AX - v) & 0xffff);
          f.N = 1;
          f.C = 1;
        }
        f.O = 0;
        this.setZ(r.AX);
        if (a) this.log.push('Después de Realizada la RESTA, almaceno el resultado en AX');
        return OK;
      }
      case 22: {
        // MUL mem
        const m = memOf(ops[0]);
        if (a) this.log.push(`Llevo la Pos de Mem ${hex3(m)} a MAR de donde esta lo que voy a multiplicar con AX`);
        const v = this.readData(m);
        if (a) {
          this.log.push(`Llevo al MDR el contenido de la dirección ${hex3(m)}`);
          this.log.push('Leo AX y MDR Para ser llevados a la ALU y realizar la multiplicación');
        }
        const p = r.AX * v;
        const hi = Math.floor(p / 0x10000);
        this.setReg('AX', p % 0x10000);
        this.setReg('BX', hi);
        f.O = hi !== 0 ? 1 : 0;
        f.N = 0;
        this.setZ(p);
        if (a) this.log.push('Después de Realizada la MULTIPLICACION, almaceno el resultado en AX');
        return OK;
      }
      case 23: {
        // DIV mem
        const m = memOf(ops[0]);
        if (a) this.log.push(`Llevo la Pos de Mem ${hex3(m)} a MAR de donde esta lo que voy a Dividir con AX`);
        const v = this.readData(m);
        if (a) {
          this.log.push(`Llevo al MDR el contenido de la dirección ${hex3(m)}`);
          this.log.push('Leo AX y MDR Para ser llevados a la ALU y realizar la división');
        }
        if (v === 0) throw new RuntimeError(errors.divisionByZero());
        const q = Math.floor(r.AX / v);
        const rem = r.AX % v;
        this.setReg('AX', q);
        this.setReg('BX', rem);
        f.N = 0;
        this.setZ(q);
        if (a) this.log.push('Realizada la División, almaceno el cociente en AX y el residuo en BX');
        return OK;
      }
      case 24: // CLN
        f.N = 0;
        this.emit('Limpio el Negative Flag: Vuelvo N = 0');
        return OK;
      case 25: // CLC
        f.C = 0;
        this.emit('Limpio el Carry Flag: Vuelvo C = 0');
        return OK;
      case 26: // STC
        f.C = 1;
        this.emit('Activo el Carry Flag: Vuelvo C = 1');
        return OK;
      case 27: // CMC
        if (a) this.log.push(`Leo el Carry Flag para invertirlo, Valor Actual: ${f.C}`);
        f.C = f.C === 1 ? 0 : 1;
        if (a) this.log.push(`Invierto el Carry Flag: Ahora queda en: ${f.C}`);
        return OK;
      case 29: {
        // LOOP mem
        const m = memOf(ops[0]);
        if (a) this.log.push('LOOP: Leo CX para llevarlo a la ALU y restarle 1');
        this.setReg('CX', (r.CX - 1) & 0xffff);
        if (a) this.log.push('Escribo CX (registro ya decrementado)');
        if (r.CX !== 0) {
          r.PC = m;
          if (a) this.log.push(`LOOP: como CX > 0 Cambio el PC para que la prox dirección a ejecutar sea: ${hex3(m)}`);
        } else if (a) {
          this.log.push('LOOP: como CX = 0 continuo con la siguiente instrucción');
        }
        return OK;
      }
      case 30: {
        // JMP mem
        const m = memOf(ops[0]);
        r.PC = m;
        if (a) this.log.push(`JMP: Cambio el PC para que la prox dirección a ejecutar sea: ${hex3(m)}`);
        return OK;
      }
      case 31: // JEQ
        this.emit('JEQ: Leo Z para ver si es igual a 1');
        this.jump(memOf(ops[0]), 'JEQ', f.Z === 1, 'Z = 1');
        return OK;
      case 32: {
        // CMP mem
        const m = memOf(ops[0]);
        if (a) this.log.push(`Llevo la Pos de Mem ${hex3(m)} a MAR de donde esta lo que voy a restar a AX`);
        const v = this.readData(m);
        if (a) {
          this.log.push(`Llevo al MDR el contenido de la dirección ${hex3(m)}`);
          this.log.push('Leo AX y MDR Para ser llevados a la ALU y realizar la resta para comparar');
        }
        if (r.AX > v) {
          f.Z = 0;
          f.N = 0;
        } else if (r.AX === v) {
          f.Z = 1;
          f.N = 0;
        } else {
          f.Z = 0;
          f.N = 1;
        }
        if (a) this.log.push(`Resultado de la comparación: Z = ${f.Z}, N = ${f.N} (AX no cambia)`);
        return OK;
      }
      case 33: // JME
        this.emit('JME: Leo N para ver si es igual a 1 "Comprobar si AX era menor"');
        this.jump(memOf(ops[0]), 'JME', f.N === 1, 'N = 1');
        return OK;
      case 34: // JMA
        this.emit('JMA: Leo Z y N para ver si estan en cero, "ver si AX era mayor"');
        this.jump(memOf(ops[0]), 'JMA', f.Z === 0 && f.N === 0, 'N,Z = 0');
        return OK;
      case 35: // JC
        this.emit('JC: Leo C para ver si es igual a 1.');
        this.jump(memOf(ops[0]), 'JC', f.C === 1, 'C = 1');
        return OK;
      case 36: // JNC
        this.emit('JNC: Leo C para ver si es igual a 0.');
        this.jump(memOf(ops[0]), 'JNC', f.C === 0, 'C = 0');
        return OK;
      case 37: // JO
        this.emit('JO: Leo O para ver si es igual a 1.');
        this.jump(memOf(ops[0]), 'JO', f.O === 1, 'O = 1');
        return OK;
      case 38: // JNO
        this.emit('JNO: Leo O para ver si es igual a 0.');
        this.jump(memOf(ops[0]), 'JNO', f.O === 0, 'O = 0');
        return OK;
      case 39: // JNE
        this.emit('JNE: Leo Z para ver si es igual a 0.');
        this.jump(memOf(ops[0]), 'JNE', f.Z === 0, 'Z = 0');
        return OK;
      case 40: {
        // LDT [message]
        if (a) {
          this.log.push('Leo un Valor del Teclado. Para luego llevarlo a AX');
          this.log.push(DIALOG_TEXTS.entreDato);
        }
        this.pending = { kind: 'ldt', mode: 'decimal', message: comment };
        this.status = 'waiting';
        return { type: 'input', request: this.pending };
      }
      case 41: {
        // EAP [message]
        const dec = String(displayDecimal(r.AX, f.N));
        const line = comment !== '' ? `${comment} ${dec}` : dec;
        this.devices.screen.write(line);
        this.devices.screen.setLastValue?.(dec, bin16(r.AX));
        this.emit('Escribo en Pantalla el Valor del registro AX');
        return OK;
      }
      case 42: // MSG message
        this.devices.screen.write(comment);
        this.emit('Escribo en Pantalla Un Mensaje');
        return OK;
      case 50: {
        // LDB mem
        const m = memOf(ops[0]);
        const addr = m + r.BX;
        if (a) this.log.push(`LDB: ${hex3(m)} a esta dirección le sumo el valor de BX: ${r.BX} posiciones.`);
        if (addr > MAX_ADDR) throw new RuntimeError(errors.memoryEnd('LDB', true));
        const v = this.readData(addr);
        if (a) this.log.push(`Llevo al MDR el contenido de la dirección ${hex3(addr)}`);
        this.setReg('AX', v);
        if (a) this.log.push(`Cargo en AX el contenido de la dirección ${hex3(addr)}`);
        return OK;
      }
      case 51: {
        // STB mem
        const m = memOf(ops[0]);
        const addr = m + r.BX;
        if (a) this.log.push(`STB: ${hex3(m)} a esta dirección le sumo el valor de BX: ${r.BX} posiciones.`);
        if (addr > MAX_ADDR) throw new RuntimeError(errors.memoryEnd('STB', true));
        if (a) {
          this.log.push(`Llevo la Pos de Mem ${hex3(addr)} a MAR que es donde voy a guardar AX.`);
          this.log.push('Leo AX Para ser llevado al MDR antes de ser escrito en Memoria');
          this.log.push(`Llevo a MDR el contenido de AX para luego escribirlo en ${hex3(addr)}`);
        }
        this.writeData(addr, r.AX);
        if (a) this.log.push(`Escribo en la Pos ${hex3(addr)} el valor: ${bin16(r.AX)}`);
        return OK;
      }
      case 55: {
        // LDF mem
        const m = memOf(ops[0]);
        if (m + 1 > MAX_ADDR) throw new RuntimeError(errors.memoryEnd('LDF', false));
        if (a) this.log.push(`Busco en la Pos de Mem ${hex3(m)} y sgte, el nro de 32bits que voy a cargar en BX y AX.`);
        const hi = this.readData(m);
        if (a) this.log.push(`Llevo al MDR el contenido de la dirección ${hex3(m)}`);
        this.setReg('BX', hi);
        if (a) this.log.push(`Cargo en BX los digitos mas significativos: el contenido de la dirección ${hex3(m)}`);
        const lo = this.readData(m + 1);
        if (a) this.log.push('Llevo al MDR el contenido de la sgte pos');
        this.setReg('AX', lo);
        if (a) this.log.push(`Cargo en AX los digitos menos significativos: el contenido de la dirección sgte ${hex3(m + 1)}`);
        return OK;
      }
      case 56: {
        // STF mem
        const m = memOf(ops[0]);
        if (m + 1 > MAX_ADDR) throw new RuntimeError(errors.memoryEnd('STF', false));
        if (a) {
          this.log.push(`Llevo la dir de Mem ${hex3(m)} a MAR que es donde se guardara BX y AX`);
          this.log.push('Leo BX (Bits mas significativos) Para ser llevado al MDR antes de ser escrito en Memoria');
          this.log.push(`Llevo a MDR el contenido de BX para luego escribirlo en ${hex3(m)}`);
        }
        this.writeData(m, r.BX);
        if (a) {
          this.log.push(`Escribo en la Pos ${hex3(m)} el valor: ${bin16(r.BX)}`);
          this.log.push('Leo AX Para ser llevado al MDR antes de ser escrito en Memoria');
          this.log.push('Llevo a MDR el contenido de AX para luego escribirlo en la sgte pos de mem');
        }
        this.writeData(m + 1, r.AX);
        if (a) this.log.push(`Escribo el la sgte Pos el valor: ${bin16(r.AX)}`);
        return OK;
      }
      case 60:
      case 61:
      case 62:
      case 63: {
        // ADDF / SUBF / MULF / DIVF mem
        const m = memOf(ops[0]);
        const verb = def.code === 60 ? 'sumar' : def.code === 61 ? 'restar' : def.code === 62 ? 'multiplicar' : 'dividir';
        const where = def.code === 60 || def.code === 61 ? 'Pos' : 'Dir';
        if (a) this.log.push(`Llevo la ${where} de Mem ${hex3(m)} a MAR de donde esta lo que voy a ${verb} con BX y AX`);
        const x = regsToFloat(r.BX, r.AX);
        const y = this.readFloatAt(m, def.mnemonic);
        if (a) {
          this.log.push(`Llevo al MDR el contenido de la dirección ${hex3(m)}`);
          this.log.push('leo la sgte Pos de mem para completar el numero de 32 bits');
          this.log.push(`Leo BX y AX Para ser llevados a la ALU y realizar la ${def.code === 60 ? 'suma' : def.code === 61 ? 'Resta' : def.code === 62 ? 'Multiplicación' : 'División'} con MDR`);
        }
        let res: number;
        let overflow = false;
        switch (def.code) {
          case 60:
            res = Math.fround(x + y);
            break;
          case 61:
            res = Math.fround(x - y);
            break;
          case 62:
            res = Math.fround(x * y);
            if (Math.abs(res) > FLOAT_LIMIT_F32) {
              overflow = true;
              res = Math.sign(res) * FLOAT_LIMIT_F32;
            }
            break;
          default: {
            if (y === 0) throw new RuntimeError(errors.divisionByZero());
            res = Math.fround(x / y);
            const rem = Math.fround(x % y);
            const cx = Number.isFinite(rem) ? Math.trunc(rem) & 0xffff : 0;
            this.setReg('CX', cx);
            break;
          }
        }
        if (!Number.isFinite(res) || Math.abs(res) > FLOAT_LIMIT_F32) overflow = true;
        f.O = overflow ? 1 : 0;
        this.setFloatResult(res);
        if (a) {
          this.log.push(
            def.code === 63
              ? 'Lista la División, Resultado en BX (bits mas significativos) y AX (los menos), CX = Residuo'
              : `Realizada la ${def.code === 60 ? 'SUMA' : def.code === 61 ? 'RESTA' : 'Multiplicación'}, almaceno resultado en BX (bits mas significativos) y AX (los menos)`,
          );
          if (overflow) this.log.push(def.code === 60 ? 'Como hubo Overflow activo el O flag' : 'Como hubo Overflow, activo el O flag');
        }
        return OK;
      }
      case 64: {
        // ITOF
        if (a) this.log.push('Leo AX Para ser llevado a la ALU y realizar la Conversión a Real');
        const signed = r.AX >= 0x8000 ? r.AX - 0x10000 : r.AX;
        this.setFloatResult(Math.fround(signed));
        if (a) this.log.push('Realizada la Conversión, almaceno resultado en BX (bits mas significativos) y AX (los menos)');
        return OK;
      }
      case 65: {
        // FTOI
        if (a) this.log.push('Leo BX y AX Para ser llevados a la ALU y realizar la Conversion a Entero');
        const x = regsToFloat(r.BX, r.AX);
        let t = Math.trunc(x);
        let overflow = false;
        if (!Number.isFinite(t)) {
          t = 0;
          overflow = true;
        }
        if (Math.abs(t) > 65535) overflow = true;
        f.O = overflow ? 1 : 0;
        this.setReg('AX', t & 0xffff);
        this.setZ(t);
        f.N = t < 0 ? 1 : 0;
        if (a) this.log.push('Realizada la Conversión a entero, almaceno resultado en AX');
        return OK;
      }
      case 80: {
        // IN reg,port
        const reg = regOf(ops[0]);
        const port = numOf(ops[1]);
        if (port === 1) {
          if (a) {
            this.log.push('Leo un Valor flotante positivo o negativo. Para luego llevarlo a BX y AX');
            this.log.push(DIALOG_TEXTS.entreFlotante);
          }
          this.pending = { kind: 'in1', mode: 'float', message: 'Decimal Flotante positivo o negativo' };
          this.status = 'waiting';
          return { type: 'input', request: this.pending };
        }
        if (a) this.log.push(`Leo valor del puerto ${port}`);
        let v: number | undefined;
        if (port === 8) v = this.devices.clock.seconds();
        else v = this.devices.ports.in(port);
        if (v === undefined) throw new RuntimeError(errors.portIn(port));
        v = v & 0xffff;
        this.setReg(reg, v);
        if (a) this.log.push(`El puerto ${port} retorno: ${v} Lo escribire en ${reg}`);
        return OK;
      }
      case 81: {
        // OUT port,reg
        const port = numOf(ops[0]);
        const reg = regOf(ops[1]);
        if (port === 1) {
          if (a) this.log.push('OUT Puerto 1: Leo numero binario almacenado en BX y AX Para ser mostrados en Pantalla');
          const s = formatFloat(regsToFloat(r.BX, r.AX), this.options.floatDecimals, this.options.stripTrailingZeros);
          this.devices.screen.write(s);
          this.devices.screen.setLastValue?.(s, bin32(r.BX, r.AX));
          if (a) this.log.push('Escribo en Pantalla el Valor del numero IEEE 754 formado en BX y AX');
          return OK;
        }
        const v = r[reg];
        if (a) this.log.push(`Leo ${reg} Para enviarle el valor al puerto: ${port}`);
        if (!this.devices.ports.out(port, v, r.BX)) throw new RuntimeError(errors.portOut(port));
        if (a && port === 13) this.log.push(`Tocando: ${v} Hz   Duración: ${r.BX} ms`);
        return OK;
      }
      case 90: // NOP
        this.emit('NOP - No se realiza ninguna operación');
        return OK;
      case 99: // HLT
        this.status = 'halted';
        this.log.push(END_TEXTS.terminado);
        this.log.push(END_TEXTS.completa);
        return HALT;
      default:
        throw new Error(`instrucción sin implementar: ${def.mnemonic}`);
    }
  }
}
