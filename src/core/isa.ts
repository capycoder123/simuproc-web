import type { StatClass } from './types';

/** How the operands of an instruction are written. */
export type OperandShape =
  | 'none' // no operands (stored as NN000)
  | 'mem' // one hex address
  | 'reg4' // AX BX CX BP
  | 'dest4' // AX BX CX BP or mem (INC, DEC)
  | 'mov' // dest,orig each AX BX CX BP or mem
  | 'log1' // AX BX CX or mem (NOT)
  | 'log2' // dest,orig each AX BX CX or mem
  | 'shift' // dest (AX BX CX or mem), decimal count 1..16
  | 'msg' // free text message (LDT, EAP, MSG)
  | 'in' // reg,port
  | 'out'; // port,reg

export interface InstrDef {
  code: number;
  mnemonic: string;
  shape: OperandShape;
  cls: StatClass;
  /** Text of the instruction list ([instr] in smpr_esp.lng). */
  list: string;
  /** Description shown inside the program ([instr] Ni in smpr_esp.lng). */
  description: string;
}

const MEM = '[Dirección Mem]';

function def(
  code: number,
  mnemonic: string,
  shape: OperandShape,
  cls: StatClass,
  list: string,
  description: string,
): InstrDef {
  return { code, mnemonic, shape, cls, list, description };
}

/** The 53 instructions of SimuProc 1.4.3.0, in the order of the original list. */
export const ISA: readonly InstrDef[] = [
  def(1, 'LDA', 'mem', 'other', `01 - LDA ${MEM}`, 'Cargue en AX el contenido de la dirección de Memoria'),
  def(2, 'STA', 'mem', 'other', `02 - STA ${MEM}`, 'Guarde el contenido de AX en la dirección de Memoria'),
  def(3, 'XAB', 'none', 'other', '03 - XAB', 'Intercambia los valores de AX y BX'),
  def(4, 'CLA', 'none', 'other', '04 - CLA', 'Hace AX = 0'),
  def(6, 'PUSH', 'reg4', 'push', '06 - PUSH registro', 'Envia el valor del registro especificado a la pila.'),
  def(
    7,
    'POP',
    'reg4',
    'pop',
    '07 - POP registro',
    'Trae de la Pila el ultimo Valor llevado por PUSH (indicado por SP) y lo graba en el reg especificado.',
  ),
  def(8, 'INC', 'dest4', 'other', '08 - INC [mem] ó [reg]', 'Incrementa en 1 el destino especificado.'),
  def(
    9,
    'DEC',
    'dest4',
    'other',
    '09 - DEC [mem] ó [reg]',
    'Decrementa en 1 el destino especificado, Si el destino queda = 0, se vuelve Z = 1',
  ),
  def(10, 'MOV', 'mov', 'other', '10 - MOV dest,orig', 'Copia el valor almacenado en el origen al destino.'),
  def(
    11,
    'AND',
    'log2',
    'logic',
    '11 - AND dest,orig',
    'Y logico, hace un Y logico entre los dos operandos escribiendo el resultado en el destino.',
  ),
  def(
    12,
    'NOT',
    'log1',
    'logic',
    '12 - NOT dest',
    'NO logico, invierte los bits del operando formando el complemento del primero.',
  ),
  def(
    13,
    'OR',
    'log2',
    'logic',
    '13 - OR  dest,orig',
    'O inclusive logico, todo bit activo en cualquiera de los operandos sera activado en el destino.',
  ),
  def(
    14,
    'XOR',
    'log2',
    'logic',
    '14 - XOR dest,orig',
    'O exclusivo, realiza un O exclusivo entre los operandos y almacena el resultado en destino.',
  ),
  def(
    15,
    'ROL',
    'shift',
    'shift',
    '15 - ROL dest,veces',
    'Rota los bits a la izq n veces, Bits que salen por la izq reentran por la Der. Carry F tiene el ultimo bit rotado.',
  ),
  def(
    16,
    'ROR',
    'shift',
    'shift',
    '16 - ROR dest,veces',
    'Rota los bits a la der n veces, Bits que salen por la der reentran por la izq. CF guarda ult. bit rotado.',
  ),
  def(
    17,
    'SHL',
    'shift',
    'shift',
    '17 - SHL dest,veces',
    'Desplaza los bits a la izq n veces, agregando ceros a la der, Carry Flag guarda ultimo bit desplazado.',
  ),
  def(
    18,
    'SHR',
    'shift',
    'shift',
    '18 - SHR dest,veces',
    'Desplaza los bits a la Der n veces, agregando ceros a la izq, Carry Flag guarda ultimo bit desplazado.',
  ),
  def(20, 'ADD', 'mem', 'arith', `20 - ADD ${MEM}`, 'AX = AX + el contenido de la dirección de memoria'),
  def(21, 'SUB', 'mem', 'arith', `21 - SUB ${MEM}`, 'AX = AX - el contenido de la dirección de memoria'),
  def(22, 'MUL', 'mem', 'arith', `22 - MUL ${MEM}`, 'BX,AX = AX * el contenido de la dirección de memoria'),
  def(
    23,
    'DIV',
    'mem',
    'arith',
    `23 - DIV ${MEM}`,
    'AX = BX,AX / el contenido de la dir de mem, BX=(BX,AX)% el contenido de la dir de mem.',
  ),
  def(24, 'CLN', 'none', 'other', '24 - CLN', 'Limpia el Negative Flag.  N = 0'),
  def(25, 'CLC', 'none', 'other', '25 - CLC', 'Limpia el Carry Flag.  C = 0'),
  def(26, 'STC', 'none', 'other', '26 - STC', 'Pone el Carry Flag.  C = 1'),
  def(
    27,
    'CMC',
    'none',
    'other',
    '27 - CMC',
    'Complementa (invierte) el Carry Flag.  Si C = 1 vuelve C = 0 y viceversa.',
  ),
  def(29, 'LOOP', 'mem', 'condJump', `29 - LOOP ${MEM}`, 'Decrementa CX y va a la Pos de memoria si CX no es cero.'),
  def(
    30,
    'JMP',
    'mem',
    'uncondJump',
    `30 - JMP ${MEM}`,
    'Salto Incondicional. PC = dirección de memoria donde esta la sgte instrucción a ejecutar',
  ),
  def(31, 'JEQ', 'mem', 'condJump', `31 - JEQ ${MEM}`, 'Si Z = 1, PC = contenido de la memoria.'),
  def(
    32,
    'CMP',
    'mem',
    'compare',
    `32 - CMP ${MEM}`,
    'Compara AX con [mem], si AX es mayor, Z=0 N=0, si es igual Z=1 N=0, si es menor Z=0 N=1',
  ),
  def(33, 'JME', 'mem', 'condJump', `33 - JME ${MEM}`, 'Si N = 1, PC = contenido de la memoria'),
  def(34, 'JMA', 'mem', 'condJump', `34 - JMA ${MEM}`, 'Si Z = 0 y N = 0, PC = contenido de memoria'),
  def(35, 'JC', 'mem', 'condJump', `35 - JC  ${MEM}`, 'Si C = 1, PC = contenido de memoria'),
  def(36, 'JNC', 'mem', 'condJump', `36 - JNC ${MEM}`, 'Si C = 0, PC = contenido de memoria'),
  def(37, 'JO', 'mem', 'condJump', `37 - JO  ${MEM}`, 'Si O = 1, PC = contenido de memoria'),
  def(38, 'JNO', 'mem', 'condJump', `38 - JNO ${MEM}`, 'Si O = 0, PC = contenido de memoria'),
  def(39, 'JNE', 'mem', 'condJump', `39 - JNE ${MEM}`, 'Si Z = 0, PC = contenido de memoria'),
  def(40, 'LDT', 'msg', 'input', '40 - LDT', 'Lee un valor del Teclado y lo lleva al registro AX; Escriba un comentario.'),
  def(41, 'EAP', 'msg', 'output', '41 - EAP', 'Escribe en Pantalla el contenido del registro AX'),
  def(42, 'MSG', 'msg', 'output', '42 - MSG "mensaje"', 'Escribe en Pantalla un comentario'),
  def(
    50,
    'LDB',
    'mem',
    'other',
    `50 - LDB ${MEM}`,
    'Cargue en AX el contenido de la [dir] + BX (en bin), ej: Digamos que BX=10 ; LDB 1F carga 21 en AX',
  ),
  def(
    51,
    'STB',
    'mem',
    'other',
    `51 - STB ${MEM}`,
    'Guarda el contenido de AX en la [dir] + BX (en bin), ej: Digamos que BX=101 ; STB 3A guarda AX en 3F',
  ),
  def(
    55,
    'LDF',
    'mem',
    'other',
    `55 - LDF ${MEM}`,
    'Carga en BX y AX el número de 32bits almacenado en [mem] y mem+1, en BX quedan los bits mas sifnificativos',
  ),
  def(56, 'STF', 'mem', 'other', `56 - STF ${MEM}`, 'Guarda el número de 32 bits almacenado en BX y AX en la [mem] y mem+1'),
  def(
    60,
    'ADDF',
    'mem',
    'arith',
    `60 - ADDF ${MEM}`,
    'Suma números de 32 bits: En BX y AX, queda el resultado de la suma de estos mas el contenido de [mem] y mem+1',
  ),
  def(61, 'SUBF', 'mem', 'arith', `61 - SUBF ${MEM}`, 'Resta el numero de 32 bits: BX y AX = BX y AX - [mem]y mem+1'),
  def(62, 'MULF', 'mem', 'arith', `62 - MULF ${MEM}`, 'BX y AX = BX y AX * [mem]y mem+1'),
  def(
    63,
    'DIVF',
    'mem',
    'arith',
    `63 - DIVF ${MEM}`,
    'BX y AX = BX y AX / [mem]y mem+1,  en CX queda el residuo en entero de 16 bits',
  ),
  def(
    64,
    'ITOF',
    'none',
    'arith',
    '64 - ITOF',
    'Convierte el número entero(16bits) almacenado en AX en un numero Real (32bits), Resultado queda en BX y AX',
  ),
  def(
    65,
    'FTOI',
    'none',
    'arith',
    '65 - FTOI',
    'Convierte un número Real(32bits) BX y AX en un entero (16bits), Resultado queda en AX.',
  ),
  def(80, 'IN', 'in', 'input', '80 - IN registro,puerto', 'Recibe en un registro, el valor retornado por el puerto especificado.'),
  def(81, 'OUT', 'out', 'output', '81 - OUT puerto,registro', 'Envia al puerto especificado, el valor de un registro'),
  def(
    90,
    'NOP',
    'none',
    'other',
    '90 - NOP',
    'Esta operación no hace nada. Util para cuando se modifica la memoria para parchar codigo.',
  ),
  def(99, 'HLT', 'none', 'other', '99 - HLT', 'Terminar Programa'),
];

export const ISA_BY_CODE: ReadonlyMap<number, InstrDef> = new Map(ISA.map((d) => [d.code, d]));
export const ISA_BY_MNEMONIC: ReadonlyMap<string, InstrDef> = new Map(ISA.map((d) => [d.mnemonic, d]));

/** Mnemonics counted in one class of the statistics, in code order. */
export function mnemonicsOfClass(cls: StatClass): string[] {
  return ISA.filter((d) => d.cls === cls).map((d) => d.mnemonic);
}

/** Mnemonic aliases accepted by the assembler with a warning. */
export const MNEMONIC_ALIASES: ReadonlyMap<string, string> = new Map([['XBA', 'XAB']]);

/** Groups of the "Agregar Instrucción" menu of Editor 2 (captions-formularios.txt). */
export const EDITOR_MENU_GROUPS: readonly { title: string; mnemonics: readonly string[] }[] = [
  { title: '--Memoria--', mnemonics: ['LDA', 'STA', 'LDB', 'STB', 'MOV'] },
  { title: '--Aritm--', mnemonics: ['INC', 'DEC', 'ADD', 'SUB', 'MUL', 'DIV'] },
  { title: '--Bits--', mnemonics: ['AND', 'NOT', 'OR', 'XOR', 'ROL', 'ROR', 'SHL', 'SHR'] },
  { title: '--Pila--', mnemonics: ['PUSH', 'POP'] },
  { title: '--Flags--', mnemonics: ['CMP', 'CLN', 'CLC', 'STC', 'CMC'] },
  { title: '--Saltos--', mnemonics: ['LOOP', 'JMP', 'JEQ', 'JNE', 'JME', 'JMA', 'JC', 'JNC', 'JO', 'JNO'] },
  { title: '-- E/S --', mnemonics: ['LDT', 'EAP', 'MSG', 'IN', 'OUT'] },
  { title: '-- Flot --', mnemonics: ['LDF', 'STF', 'ADDF', 'SUBF', 'MULF', 'DIVF', 'ITOF', 'FTOI'] },
  { title: '--Otras--', mnemonics: ['XAB', 'CLA', 'NOP', 'HLT'] },
];
