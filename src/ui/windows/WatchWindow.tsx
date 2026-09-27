import { hex3 } from '../../core';
import { store, useAppState, useTick, watchDisplay } from '../../state/store';
import { Window } from '../Window';
import { S } from '../strings';

/** "Vigilante de Memoria": up to six watched addresses with history and pause conditions. */
export function WatchWindow({ z, onFocus }: { z: number; onFocus: () => void }) {
  useTick();
  const watches = useAppState((s) => s.watches);
  return (
    <Window title={S.watch.title} onClose={() => store.setWindow('watch', false)} x={200} y={40} width={760} z={z} onFocus={onFocus} testId="win-watch">
      <p className="mb-2 text-[11px] text-(--muted)">{S.watch.intro}</p>
      <div className="grid grid-cols-2 gap-2">
        {watches.map((w, i) => {
          const current = w.addr !== null ? watchDisplay(store.mem.cells[w.addr].text) : '';
          return (
            <fieldset key={i} className="groupbox space-y-1" data-testid={`watch-${i + 1}`}>
              <legend>
                {S.watch.posicion} {i + 1}
              </legend>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1" title={S.watch.verActivar}>
                  <input type="checkbox" checked={w.enabled} onChange={(e) => store.setWatch(i, { enabled: e.target.checked })} />
                  {S.watch.verActivar}
                </label>
                <span>{S.watch.dir}</span>
                <input
                  className="field mono w-16"
                  value={w.addrText}
                  placeholder="000"
                  title={S.watch.hintDir}
                  onChange={(e) => store.setWatch(i, { addrText: e.target.value })}
                  data-testid={`watch-${i + 1}-addr`}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24">{S.watch.valorActual}</span>
                <span className="reg-box flex-1" data-testid={`watch-${i + 1}-value`}>
                  {w.addr !== null ? current : ''}
                </span>
              </div>
              <div className="flex items-start gap-2" title={S.watch.hintHistorial}>
                <span className="w-24">{S.watch.ultimos}</span>
                <div className="mono flex-1 text-[11px]" data-testid={`watch-${i + 1}-history`}>
                  {w.history.length === 0 ? <span className="text-(--muted)">—</span> : w.history.map((h, j) => <div key={j}>{h}</div>)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <label className="flex items-center gap-1" title={S.watch.hintPausar}>
                  <input type="checkbox" checked={w.pauseOnChange} onChange={(e) => store.setWatch(i, { pauseOnChange: e.target.checked })} />
                  {S.watch.pausar}
                </label>
                <label className="flex items-center gap-1" title={S.watch.hintPausarIgual}>
                  <input type="checkbox" checked={w.pauseIfEqual} onChange={(e) => store.setWatch(i, { pauseIfEqual: e.target.checked })} />
                  {S.watch.pausarIgual}
                </label>
                <input
                  className="field mono w-28"
                  value={w.compareText}
                  placeholder={S.watch.placeholderValor}
                  title={`${S.watch.hintValor}. ${S.watch.formatoValor}`}
                  onChange={(e) => store.setWatch(i, { compareText: e.target.value })}
                  data-testid={`watch-${i + 1}-compare`}
                />
                <button type="button" className="btn btn-sm" onClick={() => store.clearWatchHistory(i)}>
                  {S.watch.borrarValores}
                </button>
              </div>
              {w.enabled && w.addr !== null && <div className="text-[10px] text-(--muted)">Vigilando {hex3(w.addr)}</div>}
            </fieldset>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" className="btn" onClick={() => store.setWindow('watch', false)}>
          {S.buttons.ocultar}
        </button>
      </div>
    </Window>
  );
}
