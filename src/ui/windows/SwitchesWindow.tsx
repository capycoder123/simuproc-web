import { bin16 } from '../../core';
import { store, useAppState } from '../../state/store';
import { Window } from '../Window';
import { S } from '../strings';

const LABELS = 'FEDCBA9876543210'.split('');

/** "Switches - Puerto 9": sixteen toggles read by IN registro,9. */
export function SwitchesWindow({ z, onFocus }: { z: number; onFocus: () => void }) {
  const value = useAppState((s) => s.switches);
  return (
    <Window title={S.switches.title} onClose={() => store.setWindow('switches', false)} x={300} y={120} width={460} z={z} onFocus={onFocus} testId="win-switches">
      <div className="mono mb-2 text-center text-lg tracking-[0.35em]" data-testid="switches-value">
        {bin16(value)}
      </div>
      <div className="flex justify-center gap-1">
        {LABELS.map((label, i) => {
          const bit = 15 - i;
          const on = ((value >> bit) & 1) === 1;
          return (
            <button
              key={label}
              type="button"
              className="flag"
              style={{ width: 24, height: 40, fontSize: 12 }}
              data-on={on ? 1 : 0}
              aria-pressed={on}
              title={`Bit ${label}`}
              onClick={() => store.toggleSwitchBit(bit)}
              data-testid={`switch-${label}`}
            >
              {on ? 1 : 0}
            </button>
          );
        })}
      </div>
      <div className="mono mt-1 text-center text-[11px] tracking-[0.55em] text-(--muted)">FEDCBA9876543210</div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span>
          Decimal: <span className="mono">{value}</span>
        </span>
        <div className="flex gap-1">
          <button type="button" className="btn btn-sm" onClick={() => store.setSwitches(0)}>
            Todos a 0
          </button>
          <button type="button" className="btn btn-primary" onClick={() => store.setWindow('switches', false)} title="Ok!!!">
            {S.buttons.ok}
          </button>
        </div>
      </div>
    </Window>
  );
}
