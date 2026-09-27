import { MEM_SIZE } from '../../core';
import { store, useTick } from '../../state/store';
import { S } from '../strings';

function Gauge({ label, ratio, hint, testId }: { label: string; ratio: number; hint: string; testId: string }) {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  return (
    <div title={hint}>
      <div className="mb-0.5 flex justify-between text-[11px]">
        <span>{label}</span>
        <span data-testid={testId}>{pct.toFixed(1)}%</span>
      </div>
      <div className="gauge" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function GaugesPanel() {
  useTick();
  const used = store.mem.usedCells();
  const r = store.cpu.regs;
  const stackSpace = MEM_SIZE - r.BP;
  const stackRatio = stackSpace > 0 ? (r.SP - r.BP) / stackSpace : 0;
  return (
    <fieldset className="groupbox space-y-2">
      <legend>{S.groups.usoMemoria}</legend>
      <Gauge label={`Memoria (${used} / ${MEM_SIZE})`} ratio={used / MEM_SIZE} hint={S.hints.usoMemoria} testId="gauge-mem" />
      <Gauge label="Pila" ratio={stackRatio} hint={S.hints.usoPila} testId="gauge-stack" />
    </fieldset>
  );
}
