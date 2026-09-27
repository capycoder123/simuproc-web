/** Shared types of the SimuProc core. The core never imports React or the DOM. */

export type Origin = 'instr' | 'data' | 'empty';

/** One memory cell: the text exactly as the original stores it in a .smp file. */
export interface Cell {
  text: string;
  comment: string;
  origin: Origin;
}

export type RegName = 'AX' | 'BX' | 'CX' | 'BP';
export type FlagName = 'Z' | 'N' | 'C' | 'O';
export type Bit = 0 | 1;

export interface Flags {
  Z: Bit;
  N: Bit;
  C: Bit;
  O: Bit;
}

export interface Registers {
  AX: number;
  BX: number;
  CX: number;
  PC: number;
  MAR: number;
  MDR: string;
  IR: string;
  BP: number;
  SP: number;
}

export type KeyboardMode = 'decimal' | 'binario' | 'float';

export interface InputRequest {
  kind: 'ldt' | 'in1';
  mode: KeyboardMode;
  message: string;
}

export interface Keyboard {
  read(prompt: string, mode: KeyboardMode): Promise<number>;
  cancel?(): void;
}

export interface Screen {
  write(line: string): void;
  setLastValue?(decimal: string, binary: string): void;
}

export interface Ports {
  /** Returns undefined when no device is connected to the port. */
  in(port: number): number | undefined;
  /** Returns false when no device is connected to the port. */
  out(port: number, value: number, bx: number): boolean;
}

export interface Clock {
  seconds(): number;
}

export interface Devices {
  keyboard: Keyboard;
  screen: Screen;
  ports: Ports;
  clock: Clock;
}

export type StatClass =
  | 'other'
  | 'condJump'
  | 'uncondJump'
  | 'push'
  | 'pop'
  | 'compare'
  | 'logic'
  | 'arith'
  | 'shift'
  | 'input'
  | 'output';

export interface Stats {
  instrucciones: number;
  saltosCondicionales: number;
  saltosIncondicionales: number;
  push: number;
  pop: number;
  comparaciones: number;
  logicas: number;
  aritmeticas: number;
  desplazamientos: number;
  entrada: number;
  salida: number;
}

export function emptyStats(): Stats {
  return {
    instrucciones: 0,
    saltosCondicionales: 0,
    saltosIncondicionales: 0,
    push: 0,
    pop: 0,
    comparaciones: 0,
    logicas: 0,
    aritmeticas: 0,
    desplazamientos: 0,
    entrada: 0,
    salida: 0,
  };
}
