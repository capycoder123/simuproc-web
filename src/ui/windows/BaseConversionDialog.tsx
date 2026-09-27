import { Fragment, useId, useState, type CSSProperties } from 'react';
import { floatBreakdown, floatBreakdownFromBits, formatInBase, readFloatBitsFromMemory, validateBase } from '../../core/bases';
import { parseAddress } from '../../core/operands';
import { Dialog } from '../Dialog';
import { editBase, editFloatBits, editFloatDecimal, editIntField, floatStateFrom, initialIntState, stepBase } from './baseConversion';

/** Texts of the original's TConvBases form. */
const T = {
  title: 'Conversión de bases',
  decimal: 'Decimal',
  binario: 'Binario',
  hexadecimal: 'Hexadecimal',
  octal: 'Octal',
  otraBase: 'Otra Base',
  base: 'Base',
  rango: 'Rango de Teclas admitidas para la base Seleccionada',
  ascii: 'Ascii',
  longitudActual: 'Longitud Actual',
  flotantes: 'Numeros de Punto Flotante',
  base10: 'Base 10',
  base2: 'Base 2: formato IEEE 754 - 32 bits',
  plantilla: 'SEEEEEEEEMMMMMMMMMMMMMMMMMMMMMMM',
  partes: 'S=Signo  E=Exponente Desplazado  M=Mantisa',
  signo: 'Signo',
  exponente: 'Exponente Desplazado',
  mantisa: 'Mantisa',
  expD: 'Exp D.',
  leerMemoria: 'Leer número de memoria',
  direccion: 'Dirección (000 - FFE)',
  leer: 'Leer',
  direccionErronea: 'Dirección Erronea',
  cerrar: 'Cerrar',
} as const;

const FIXED_FIELDS = [
  { field: 'decimal', label: T.decimal, testId: 'bases-decimal' },
  { field: 'binary', label: T.binario, testId: 'bases-binario' },
  { field: 'hex', label: T.hexadecimal, testId: 'bases-hex' },
  { field: 'octal', label: T.octal, testId: 'bases-octal' },
] as const;

/** Width of a monospace `.field` that fits `chars` characters (padding + border = 14px, plus caret room). */
const fieldWidth = (chars: number): CSSProperties => ({ width: `calc(${chars}ch + 16px)`, maxWidth: '100%' });
const READ_ONLY_STYLE: CSSProperties = { backgroundColor: 'var(--panel-2)' };
const TEXT_INPUT = { type: 'text', spellCheck: false, autoComplete: 'off' } as const;

function ReadOnlyField({ label, title, value, chars, testId }: { label: string; title?: string; value: string; chars: number; testId: string }) {
  const id = useId();
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-[11px] text-(--muted)" title={title}>
        {label}
      </label>
      <input id={id} className="field mono" style={{ ...fieldWidth(chars), ...READ_ONLY_STYLE }} value={value} readOnly data-testid={testId} />
    </div>
  );
}

/** "Conversión de bases" utility window: integers between bases, Ascii and IEEE 754 single precision. */
export function BaseConversionDialog({ onClose, readWord }: { onClose: () => void; readWord: (addr: number) => number }) {
  const id = useId();
  const [ints, setInts] = useState(initialIntState);
  const [floats, setFloats] = useState(() => floatStateFrom(floatBreakdown(0)));
  const [memAddr, setMemAddr] = useState('');

  const base = validateBase(ints.baseText);
  const digitRange = base.ok ? `0 - ${formatInBase(BigInt(base.base - 1), base.base)}` : '';
  const parts = floats.parts;

  const readMemory = () => {
    const addr = parseAddress(memAddr);
    const bits = addr ? readFloatBitsFromMemory(readWord, addr.addr) : null;
    if (bits === null) {
      setFloats((s) => ({ ...s, error: T.direccionErronea }));
      return;
    }
    setFloats(floatStateFrom(floatBreakdownFromBits(bits)));
  };

  return (
    <Dialog title={T.title} onClose={onClose} width={580} testId="dlg-bases">
      <div className="space-y-3">
        <fieldset className="groupbox">
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
            {FIXED_FIELDS.map(({ field, label, testId }) => (
              <Fragment key={field}>
                <label htmlFor={`${id}-${field}`}>{label}</label>
                <input
                  {...TEXT_INPUT}
                  id={`${id}-${field}`}
                  className="field mono w-full"
                  value={ints.texts[field]}
                  onChange={(e) => {
                    const text = e.target.value;
                    setInts((s) => editIntField(s, field, text));
                  }}
                  autoFocus={field === 'decimal'}
                  data-testid={testId}
                />
              </Fragment>
            ))}
            <label htmlFor={`${id}-other`}>{T.otraBase}</label>
            <div className="flex min-w-0 items-center gap-2">
              <input
                {...TEXT_INPUT}
                id={`${id}-other`}
                className="field mono min-w-0 flex-1"
                value={ints.texts.other}
                onChange={(e) => {
                  const text = e.target.value;
                  setInts((s) => editIntField(s, 'other', text));
                }}
                data-testid="bases-otra"
              />
              <label htmlFor={`${id}-base`}>{T.base}</label>
              <input
                {...TEXT_INPUT}
                id={`${id}-base`}
                className="field mono w-12 text-center"
                inputMode="numeric"
                value={ints.baseText}
                onChange={(e) => {
                  const text = e.target.value;
                  setInts((s) => editBase(s, text));
                }}
                onKeyDown={(e) => {
                  const delta = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
                  if (delta === 0) return;
                  e.preventDefault();
                  setInts((s) => stepBase(s, delta));
                }}
                data-testid="bases-base"
              />
              <span className="mono w-12 text-[11px] whitespace-nowrap text-(--muted)" title={T.rango}>
                {digitRange}
              </span>
            </div>
            <label htmlFor={`${id}-ascii`}>{T.ascii}</label>
            <input id={`${id}-ascii`} className="field mono w-full" style={READ_ONLY_STYLE} value={ints.ascii} readOnly data-testid="bases-ascii" />
            <span />
            <span className="text-[11px] text-(--muted)" title={T.longitudActual} data-testid="bases-longitud">
              Longitud = {ints.bits} Bits
            </span>
          </div>
          <p className="mt-1 min-h-5 text-(--err)" aria-live="polite" data-testid="bases-error">
            {ints.error}
          </p>
        </fieldset>

        <fieldset className="groupbox">
          <legend>{T.flotantes}</legend>
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-2">
            <label htmlFor={`${id}-float-dec`}>{T.base10}</label>
            <input
              {...TEXT_INPUT}
              id={`${id}-float-dec`}
              className="field mono w-full"
              inputMode="decimal"
              value={floats.decText}
              onChange={(e) => {
                const text = e.target.value;
                setFloats((s) => editFloatDecimal(s, text));
              }}
              data-testid="bases-float-dec"
            />
          </div>
          <label htmlFor={`${id}-float-bin`} className="mt-2 block">
            {T.base2}
          </label>
          <div className="mono pl-[7px] text-[12px] leading-tight text-(--muted) select-none" title={T.partes} aria-hidden="true">
            {T.plantilla}
          </div>
          <input
            {...TEXT_INPUT}
            id={`${id}-float-bin`}
            className="field mono"
            style={fieldWidth(32)}
            inputMode="numeric"
            value={floats.binText}
            onChange={(e) => {
              const text = e.target.value;
              setFloats((s) => editFloatBits(s, text));
            }}
            data-testid="bases-float-bin"
          />
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <ReadOnlyField label="S" title={T.signo} value={parts.sign} chars={1} testId="bases-float-sign" />
            <ReadOnlyField label="E" title={T.exponente} value={parts.exponent} chars={8} testId="bases-float-exp" />
            <ReadOnlyField label={T.expD} title={T.exponente} value={String(parts.exponentDecimal)} chars={3} testId="bases-float-expd" />
            <ReadOnlyField label={T.mantisa} value={parts.mantissa} chars={23} testId="bases-float-mant" />
          </div>
          <p className="mt-1 text-[11px] whitespace-pre text-(--muted)">{T.partes}</p>
          <p className="mt-1 min-h-5 text-(--err)" aria-live="polite" data-testid="bases-float-error">
            {floats.error}
          </p>
          <form
            className="mt-1 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              readMemory();
            }}
          >
            <label htmlFor={`${id}-mem`}>{T.leerMemoria}</label>
            <input
              {...TEXT_INPUT}
              id={`${id}-mem`}
              className="field mono w-16"
              value={memAddr}
              onChange={(e) => setMemAddr(e.target.value)}
              placeholder="000"
              title={T.direccion}
              data-testid="bases-mem-addr"
            />
            <button type="submit" className="btn btn-sm" data-testid="bases-mem-read">
              {T.leer}
            </button>
          </form>
        </fieldset>

        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={onClose} data-testid="bases-cerrar">
            {T.cerrar}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
