import { useState } from 'react';
import { DEFAULT_CONFIG, store, useAppState, type Config } from '../../state/store';
import { Dialog } from '../Dialog';
import { S } from '../strings';

/** "Configurar SimuProc": only the options that change behaviour in the web version. */
export function ConfigDialog() {
  const current = useAppState((s) => s.config);
  const [cfg, setCfg] = useState<Config>(current);
  const close = () => store.setWindow('config', false);
  const patch = (p: Partial<Config>) => setCfg((c) => ({ ...c, ...p }));
  const accept = () => {
    store.setConfig({
      ...cfg,
      monitorLines: Math.max(2, Math.min(15000, Math.round(cfg.monitorLines) || 2)),
      floatDecimals: Math.max(0, Math.min(10, Math.round(cfg.floatDecimals) || 0)),
    });
    close();
  };
  return (
    <Dialog title={S.config.title} onClose={close} width={560} testId="dlg-config">
      <div className="space-y-2">
        <fieldset className="groupbox space-y-1">
          <legend>{S.config.animacion}</legend>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              {S.config.colorLectura}
              <input type="color" value={cfg.readColor} onChange={(e) => patch({ readColor: e.target.value })} title={S.config.hintColor} data-testid="config-read-color" />
            </label>
            <label className="flex items-center gap-2">
              {S.config.colorEscritura}
              <input type="color" value={cfg.writeColor} onChange={(e) => patch({ writeColor: e.target.value })} title={S.config.hintColor} />
            </label>
            <button type="button" className="btn btn-sm" onClick={() => patch({ readColor: DEFAULT_CONFIG.readColor, writeColor: DEFAULT_CONFIG.writeColor })}>
              {S.config.coloresDefecto}
            </button>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cfg.autoscrollInstr} onChange={(e) => patch({ autoscrollInstr: e.target.checked })} />
            {S.config.perseguirInstr}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cfg.autoscrollVars} onChange={(e) => patch({ autoscrollVars: e.target.checked })} />
            {S.config.perseguirVars}
          </label>
        </fieldset>
        <fieldset className="groupbox space-y-1">
          <legend>{S.config.entradaSalida}</legend>
          <label className="flex items-center gap-2" title={S.config.hintLineas}>
            {S.config.capacidadLineas}
            <input type="number" className="field w-24" min={2} max={15000} value={cfg.monitorLines} onChange={(e) => patch({ monitorLines: Number(e.target.value) })} data-testid="config-lines" />
            <button type="button" className="btn btn-sm" onClick={() => patch({ monitorLines: DEFAULT_CONFIG.monitorLines })}>
              {S.config.porDefecto}
            </button>
          </label>
          <label className="flex items-center gap-2">
            {S.config.redondear}
            <input type="number" className="field w-16" min={0} max={10} value={cfg.floatDecimals} onChange={(e) => patch({ floatDecimals: Number(e.target.value) })} data-testid="config-decimals" />
            {S.config.cifras}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cfg.stripZeros} onChange={(e) => patch({ stripZeros: e.target.checked })} />
            {S.config.eliminarCeros}
          </label>
        </fieldset>
        <fieldset className="groupbox space-y-1">
          <legend>{S.config.avanzado}</legend>
          <label className="flex items-center gap-2" title={S.config.hintEditar}>
            <input type="checkbox" checked={cfg.editMemoryDirectly} onChange={(e) => patch({ editMemoryDirectly: e.target.checked })} />
            {S.config.editarMemoria}
          </label>
          <label className="flex items-center gap-2" title={S.config.hintIgnorar}>
            <input type="checkbox" checked={cfg.ignoreUnknownOpcodes} onChange={(e) => patch({ ignoreUnknownOpcodes: e.target.checked })} data-testid="config-ignore" />
            {S.config.ignorar}
          </label>
          <label className="flex items-center gap-2" title={S.config.hintResetear}>
            <input type="checkbox" checked={cfg.resetStats} onChange={(e) => patch({ resetStats: e.target.checked })} />
            {S.config.resetear}
          </label>
          <label className="flex items-center gap-2" title={S.config.hintMostrarInst}>
            <input type="checkbox" checked={cfg.showInstructions} onChange={(e) => patch({ showInstructions: e.target.checked })} />
            {S.config.mostrarInst}
          </label>
          <label className="flex items-center gap-2" title={S.stats.hintMostrar}>
            <input type="checkbox" checked={cfg.showStatsAfterRun} onChange={(e) => patch({ showStatsAfterRun: e.target.checked })} />
            {S.stats.mostrarDespues}
          </label>
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={close}>
            {S.buttons.cancelar}
          </button>
          <button type="button" className="btn btn-primary" onClick={accept} data-testid="config-accept">
            {S.buttons.aceptar}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
