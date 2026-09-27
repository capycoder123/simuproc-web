import type { ReactNode } from 'react';
import { ISA_BY_MNEMONIC, MNEMONIC_ALIASES, stripComment } from '../../core';

const REGS = new Set(['AX', 'BX', 'CX', 'BP']);

function operandTokens(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /([0-9A-Za-z]+|[^0-9A-Za-z]+)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    const tok = m[0];
    const u = tok.toUpperCase();
    const key = `${keyBase}-${i++}`;
    if (REGS.has(u)) out.push(<span key={key} className="tk-reg">{tok}</span>);
    else if (/^[0-9A-F]{1,4}H?$/.test(u) || /^\d+$/.test(tok)) out.push(<span key={key} className="tk-num">{tok}</span>);
    else out.push(<span key={key}>{tok}</span>);
  }
  return out;
}

/** Syntax highlighting of one Editor 2 line: instructions, registers, addresses, strings, comments. */
export function highlightLine(line: string, key: string): ReactNode[] {
  const { code } = stripComment(line);
  const commentPart = code.length < line.length ? line.slice(code.length) : '';
  const parts: ReactNode[] = [];
  if (code.trimStart().startsWith('#')) {
    parts.push(<span key={`${key}-d`} className="tk-dir">{code}</span>);
  } else if (code.trim() === '') {
    parts.push(code);
  } else {
    const m = /^(\s*)([A-Za-z]+)(\b\s*)(.*)$/s.exec(code);
    if (m) {
      const mn = m[2].toUpperCase();
      const def = ISA_BY_MNEMONIC.get(mn) ?? ISA_BY_MNEMONIC.get(MNEMONIC_ALIASES.get(mn) ?? '');
      parts.push(m[1]);
      parts.push(<span key={`${key}-k`} className={def ? 'tk-kw' : ''}>{m[2]}</span>);
      parts.push(m[3]);
      if (def?.shape === 'msg') parts.push(<span key={`${key}-s`} className="tk-str">{m[4]}</span>);
      else parts.push(...operandTokens(m[4], key));
    } else {
      parts.push(<span key={`${key}-n`} className="tk-num">{code}</span>);
    }
  }
  if (commentPart !== '') parts.push(<span key={`${key}-c`} className="tk-cmt">{commentPart}</span>);
  return parts;
}
