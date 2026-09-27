import { SPEED_DELAYS, store, useAppState } from '../../state/store';
import { S } from '../strings';

export function ControlPanel() {
  const runState = useAppState((s) => s.runState);
  const config = useAppState((s) => s.config);
  const devicesOpen = useAppState((s) => s.windows.devices);
  const busy = runState === 'running' || runState === 'waiting';
  return (
    <>
      <fieldset className="groupbox space-y-2">
        <legend>{S.groups.control}</legend>
        <div className="flex items-center gap-2" title={S.hints.velocidad}>
          <span className="text-[11px]">{S.buttons.min}</span>
          <input
            type="range"
            min={0}
            max={SPEED_DELAYS.length - 1}
            value={config.speed}
            onChange={(e) => store.setConfig({ speed: Number(e.target.value) })}
            className="flex-1"
            aria-label={S.hints.velocidad}
            data-testid="speed"
          />
          <span className="text-[11px]">{S.buttons.max}</span>
        </div>
        <label className="flex items-center gap-2" title={S.hints.animacion}>
          <input
            type="checkbox"
            checked={config.animation}
            onChange={(e) => store.setConfig({ animation: e.target.checked })}
            data-testid="animation"
          />
          {S.buttons.animacion}
        </label>
        <div className="flex flex-wrap gap-1">
          {runState === 'running' ? (
            <button type="button" className="btn btn-primary" onClick={() => store.pause()} data-testid="btn-pausar">
              {S.buttons.pausar}
            </button>
          ) : runState === 'paused' ? (
            <button type="button" className="btn btn-primary" onClick={() => store.run()} data-testid="btn-reanudar">
              {S.buttons.reanudar}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => store.run()} disabled={busy} data-testid="btn-ejecutar">
              {S.buttons.ejecutar}
            </button>
          )}
          <button type="button" className="btn" onClick={() => store.stepOnce()} disabled={busy} data-testid="btn-paso">
            {S.buttons.paso}
          </button>
          <button type="button" className="btn" onClick={() => void store.reiniciarRegistros()} data-testid="btn-reiniciar">
            {S.buttons.reiniciar}
          </button>
        </div>
      </fieldset>
      <fieldset className="groupbox">
        <legend>{S.groups.dispositivos}</legend>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-(--muted)" title={S.hints.pantalla + ' / ' + S.hints.teclado}>
            Pantalla y Teclado
          </span>
          <button type="button" className="btn" onClick={() => store.setWindow('devices', !devicesOpen)} data-testid="btn-mostrar-es">
            {devicesOpen ? S.buttons.ocultar : S.buttons.mostrar}
          </button>
        </div>
      </fieldset>
    </>
  );
}
