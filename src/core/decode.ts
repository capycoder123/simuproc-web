import { ISA_BY_CODE, type InstrDef } from './isa';
import { parseOperands, shiftDestinationIsValid, type Operand } from './operands';

export interface DecodeResult {
  /** Instruction whose opcode matches the first two characters, if any. */
  def: InstrDef | null;
  /** Parsed operands, or null when the operand text is invalid. */
  ops: Operand[] | null;
  /** True for ROL/ROR/SHL/SHR with a valid destination but an invalid count. */
  badShiftCount: boolean;
}

const NO_DECODE: DecodeResult = { def: null, ops: null, badShiftCount: false };

/**
 * Decodes a cell text: two decimal digits of opcode followed by the operands.
 * Instructions without operands are stored as NN000 (an empty tail is also accepted).
 */
export function decodeCell(text: string): DecodeResult {
  if (text.length < 2) return NO_DECODE;
  const c0 = text.charCodeAt(0);
  const c1 = text.charCodeAt(1);
  if (c0 < 48 || c0 > 57 || c1 < 48 || c1 > 57) return NO_DECODE;
  const def = ISA_BY_CODE.get((c0 - 48) * 10 + (c1 - 48));
  if (!def) return NO_DECODE;
  const rest = text.slice(2);
  if (def.shape === 'none' || def.shape === 'msg') {
    return rest === '' || rest === '000' ? { def, ops: [], badShiftCount: false } : { def, ops: null, badShiftCount: false };
  }
  const ops = parseOperands(def.shape, rest);
  if (ops) return { def, ops, badShiftCount: false };
  return { def, ops: null, badShiftCount: def.shape === 'shift' && shiftDestinationIsValid(rest) };
}
