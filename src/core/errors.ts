import { hex3 } from './format';

/**
 * fatal: an OK dialog, the simulation stops.
 * ignore: "Sí" skips the instruction and continues, "No" stops.
 * pause: "Sí" pauses the simulation, "No" continues.
 */
export type ErrorKind = 'fatal' | 'ignore' | 'pause';

export interface RuntimeErrorInfo {
  id: string;
  kind: ErrorKind;
  title: string;
  message: string;
  question: string;
  /** Short text for the status bar and the log. */
  summary: string;
  address?: number;
}

export class RuntimeError extends Error {
  readonly info: RuntimeErrorInfo;
  constructor(info: RuntimeErrorInfo) {
    super(info.summary);
    this.name = 'RuntimeError';
    this.info = info;
  }
}

const ERROR_TITLE = 'Error ....';

export const errors = {
  stackOverflow: (): RuntimeErrorInfo => ({
    id: 'stack-overflow',
    kind: 'fatal',
    title: ERROR_TITLE,
    message: 'Pila Llena o Stack Overflow! Reserve mas espacio para la Pila cambiando BP.',
    question: '',
    summary: 'Desbordamiento de la Pila.  Simulación Detenida.',
  }),
  popEmpty: (): RuntimeErrorInfo => ({
    id: 'pop-empty',
    kind: 'ignore',
    title: 'Uso indebido de la instrucción POP',
    message:
      'El Simulador acaba de encontrar un error\nen su programa.\nLa Instrucción POP no puede ser utilizada\nsin haberse usado antes la instrucción PUSH.',
    question: 'Desea ignorar esta instrucción\ny seguir ejecutando su programa??',
    summary: 'La pila esta vacía, uso indebido de POP.',
  }),
  bpInvalid: (): RuntimeErrorInfo => ({
    id: 'bp-invalid',
    kind: 'ignore',
    title: 'Valor inválido para el destino especificado en la Instruccion MOV',
    message:
      'El Simulador acaba de encontrar un Valor\ninválido para el destino especificado en\nla Instruccion MOV.\nEn este caso el destino es "BP" que solo acepta\ndirecciones en hexa. No otros valores.',
    question: 'Desea ignorar esta instruccion y seguir ejecutandolo??',
    summary: 'Se ha intentado copiar un Valor no Válido a BP. Error en su programa.',
  }),
  shiftCount: (mnemonic: string): RuntimeErrorInfo => ({
    id: 'shift-count',
    kind: 'ignore',
    title: `Entero no Válido en el parametro veces de la Instrucción ${mnemonic}`,
    message: `El Simulador acaba de encontrar un error\nen el parámetro "veces" en la inst ${mnemonic}\nEste parámetro no es un entero válido.\nVerifique que su programa no se haya\nmodificado accidentalmente.`,
    question: 'Desea seguir ejecutando el programa??',
    summary: `El parámetro veces no es un entero válido para la instrucción ${mnemonic}`,
  }),
  divisionByZero: (): RuntimeErrorInfo => ({
    id: 'div-zero',
    kind: 'fatal',
    title: ERROR_TITLE,
    message: 'Su Programa Intentó hacer una División por Cero.  Simulación Detenida.',
    question: '',
    summary: 'Intento de Division por Cero.',
  }),
  memoryEnd: (mnemonic: string, viaBx: boolean): RuntimeErrorInfo => ({
    id: 'mem-end',
    kind: 'pause',
    title: `${mnemonic}: Error`,
    message: viaBx
      ? `El Valor de BX usado para sumarle a la Dir de mem de ${mnemonic}\nHa superado el final de la memoria.`
      : `La dirección siguiente usada por ${mnemonic}\nHa superado el final de la memoria.`,
    question: 'Desea Pausar la Simulación?',
    summary: `${mnemonic}: Ha superado el final de la memoria.`,
  }),
  portIn: (port: number): RuntimeErrorInfo => ({
    id: 'port-in',
    kind: 'ignore',
    title: 'Puerto de entrada no Válido; Instrucción IN',
    message: `ERROR en IN, no hay ningun dispositivo conectado al puerto: ${port}`,
    question: 'Desea seguir ejecutando el programa??',
    summary: `ERROR en IN, no se puede leer del Puerto: ${port}`,
  }),
  portOut: (port: number): RuntimeErrorInfo => ({
    id: 'port-out',
    kind: 'ignore',
    title: 'Puerto de salida no Válido; Instrucción OUT',
    message: `ERROR en OUT, no hay ningun dispositivo conectado al puerto: ${port}`,
    question: 'Desea seguir ejecutando el programa??',
    summary: `ERROR en OUT, no se puede escribir en el Puerto: ${port}`,
  }),
  unknownOpcode: (addr: number): RuntimeErrorInfo => ({
    id: 'unknown-opcode',
    kind: 'ignore',
    title: 'Error en su Programa cargado',
    message: `El Simulador acaba de encontrar un Codigo\nde Operación no Válido en su programa.\nEl Error esta en la Posición de memoria: ${hex3(addr)}`,
    question: 'Desea ignorarlo y seguir ejecutandolo??',
    summary: 'Se leyo de memoria un Codigo de Operacion no reconocido.',
    address: addr,
  }),
  blankCell: (addr: number): RuntimeErrorInfo => ({
    id: 'blank-cell',
    kind: 'fatal',
    title: ERROR_TITLE,
    message: `Intento de ejecución de una posición de memoria en blanco en la Dir: ${hex3(addr)}\nSu programa es erroneo o no tiene la instrucción 99 - HLT`,
    question: '',
    summary: `Intento de ejecución de una posición de memoria en blanco en la Dir: ${hex3(addr)}`,
    address: addr,
  }),
};
