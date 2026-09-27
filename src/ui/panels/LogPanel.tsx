import { useEffect, useRef } from 'react';
import { store, useTick } from '../../state/store';
import { S } from '../strings';

const MAX_RENDERED = 400;

/** Micro-step log of the fetch/execute cycle (the original's animation texts). */
export function LogPanel() {
  const tick = useTick();
  const ref = useRef<HTMLDivElement>(null);
  const all = store.cpu.log.lines();
  const lines = all.length > MAX_RENDERED ? all.slice(all.length - MAX_RENDERED) : all;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tick]);
  return (
    <fieldset className="groupbox flex min-h-[220px] flex-1 flex-col">
      <legend>{S.groups.ciclo}</legend>
      <div
        ref={ref}
        className="mono min-h-0 flex-1 overflow-auto rounded border border-(--border) bg-(--field) px-1.5 py-1 text-[11px]"
        data-testid="log"
      >
        {all.length > MAX_RENDERED && (
          <div className="text-(--muted)">
            … {all.length - MAX_RENDERED} líneas anteriores (máximo {store.cpu.log.cap})
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {l}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            store.cpu.log.clear();
            store.bump();
          }}
        >
          Limpiar
        </button>
      </div>
    </fieldset>
  );
}
