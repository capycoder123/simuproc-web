import { MAX_ADDR, bin16, hex3 } from '../../core';
import { store, useTick } from '../../state/store';
import { S } from '../strings';

function RegValue({
  label,
  value,
  hint,
  changed,
  testId,
  extra,
}: {
  label: string;
  value: string;
  hint: string;
  changed?: boolean;
  testId: string;
  extra?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 font-semibold" title={hint}>
        {label}
      </span>
      <div className={'reg-box min-w-0 flex-1 truncate ' + (changed ? 'reg-changed' : '')} data-testid={testId} title={value}>
        {value}
        {extra !== undefined && <span className="ml-2 text-(--muted)">({extra})</span>}
      </div>
    </div>
  );
}

export function ProcessorRegisters() {
  useTick();
  const r = store.cpu.regs;
  return (
    <fieldset className="groupbox space-y-1">
      <legend>{S.groups.registrosProcesador}</legend>
      <RegValue label="PC" value={hex3(r.PC)} hint={S.hints.pc} testId="reg-PC" changed={store.highlight.reads.length > 0} />
      <RegValue label="MAR" value={hex3(r.MAR)} hint={S.hints.mar} testId="reg-MAR" />
      <RegValue label="MDR" value={r.MDR} hint={S.hints.mdr} testId="reg-MDR" />
      <RegValue label="IR" value={r.IR} hint={S.hints.ir} testId="reg-IR" />
    </fieldset>
  );
}

export function GeneralRegisters() {
  useTick();
  const r = store.cpu.regs;
  const changed = (n: string) => store.highlight.regs.includes(n);
  return (
    <fieldset className="groupbox space-y-1">
      <legend>{S.groups.registrosGenerales}</legend>
      <RegValue label="AX" value={bin16(r.AX)} extra={String(r.AX)} hint={S.hints.ax} testId="reg-AX" changed={changed('AX')} />
      <RegValue label="BX" value={bin16(r.BX)} extra={String(r.BX)} hint={S.hints.bx} testId="reg-BX" changed={changed('BX')} />
      <RegValue label="CX" value={bin16(r.CX)} extra={String(r.CX)} hint={S.hints.cx} testId="reg-CX" changed={changed('CX')} />
    </fieldset>
  );
}

export function StackPanel() {
  useTick();
  const r = store.cpu.regs;
  const changed = (n: string) => store.highlight.regs.includes(n);
  return (
    <fieldset className="groupbox space-y-1">
      <legend>{S.groups.pila}</legend>
      <RegValue label="BP" value={hex3(r.BP)} hint={S.hints.bp} testId="reg-BP" changed={changed('BP')} />
      <RegValue
        label="SP"
        value={r.SP > MAX_ADDR ? r.SP.toString(16).toUpperCase() : hex3(r.SP)}
        hint={S.hints.sp}
        testId="reg-SP"
        changed={changed('SP')}
      />
    </fieldset>
  );
}

export function FlagsPanel() {
  useTick();
  const f = store.cpu.flags;
  const flags = [
    { name: 'Z' as const, hint: S.hints.z },
    { name: 'N' as const, hint: S.hints.n },
    { name: 'C' as const, hint: S.hints.c },
    { name: 'O' as const, hint: S.hints.o },
  ];
  return (
    <fieldset className="groupbox">
      <legend>{S.groups.registrosControl}</legend>
      <div className="flex items-center justify-around">
        {flags.map((fl) => (
          <div key={fl.name} className="flex flex-col items-center gap-1">
            <button
              type="button"
              className="flag"
              data-on={f[fl.name]}
              title={fl.hint}
              // The original forces a flag with a double click (ZvalorDblClick...); Enter or Space keep it keyboard-accessible.
              onDoubleClick={() => store.toggleFlag(fl.name)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                store.toggleFlag(fl.name);
              }}
              data-testid={`flag-${fl.name}`}
              aria-pressed={f[fl.name] === 1}
            >
              {f[fl.name]}
            </button>
            <span className="text-[11px] font-semibold">{fl.name}</span>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export function AluPanel() {
  useTick();
  const last = store.cpu.log.last();
  return (
    <fieldset className="groupbox">
      <legend title={S.hints.alu}>{S.groups.alu}</legend>
      <div className="reg-box min-h-[40px] whitespace-normal text-[11px]" data-testid="alu" title={S.hints.alu}>
        {last || '—'}
      </div>
    </fieldset>
  );
}
