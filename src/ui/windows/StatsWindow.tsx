import { mnemonicsOfClass } from '../../core';
import { STATS_TEXTS, store, useAppState, useTick } from '../../state/store';
import { Window } from '../Window';
import { S } from '../strings';

/** The instructions the "Aritméticas" counter adds up, from the ISA table. */
const ARITH_HINT = mnemonicsOfClass('arith').join(', ');

function formatSpeed(instr: number, ms: number): { value: string; unit: string; hint: string } {
  if (instr === 0 || ms <= 0) return { value: '0', unit: 'Hz', hint: 'Hertz (ciclos por segundo)' };
  const hz = instr / (ms / 1000);
  if (hz >= 1) return { value: hz.toFixed(hz >= 100 ? 0 : 2), unit: 'Hz', hint: 'Hertz (ciclos por segundo)' };
  if (hz >= 0.001) return { value: (hz * 1000).toFixed(2), unit: 'mHz', hint: 'miliHertz(mHz), NO MegaHertz(MHz) (un mHz es 1Hz/1000)' };
  return { value: (hz * 1_000_000).toFixed(2), unit: 'µHz', hint: 'microHertz(µHz) (1 µHz es 1Hz/1000000)' };
}

function Row({ label, value, hint, testId }: { label: string; value: string | number; hint?: string; testId?: string }) {
  return (
    <div className="flex items-center justify-between gap-3" title={hint}>
      <span>{label}</span>
      <span className="reg-box min-w-24 text-right" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

/** "Estadísticas de la Simulación": counters of the last (or current) run. */
export function StatsWindow({ z, onFocus }: { z: number; onFocus: () => void }) {
  useTick();
  const header = useAppState((s) => s.statsHeader);
  const config = useAppState((s) => s.config);
  const st = store.cpu.stats;
  const ms = store.elapsedMs();
  const speed = formatSpeed(st.instrucciones, ms);
  const avg = st.instrucciones > 0 ? (ms / st.instrucciones).toFixed(3) : '0';
  return (
    <Window title={S.stats.title} onClose={() => store.setWindow('stats', false)} x={120} y={60} width={520} z={z} onFocus={onFocus} testId="win-stats">
      <p className="mb-2 whitespace-pre-line text-[11px] text-(--muted)" data-testid="stats-header">
        {header || STATS_TEXTS.none}
      </p>
      <fieldset className="groupbox space-y-1">
        <legend>{S.stats.title}</legend>
        <Row label={S.stats.instrucciones} value={st.instrucciones} hint={S.stats.hintInstrucciones} testId="stats-instr" />
        <Row label={S.stats.duracion} value={`${(ms / 1000).toFixed(3)} s`} />
        <Row label={S.stats.velocidad} value={`${speed.value} ${speed.unit}`} hint={speed.hint} />
        <Row label={S.stats.promedio} value={`${avg} ms`} hint="Milisegundos" />
      </fieldset>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <fieldset className="groupbox space-y-1">
          <legend>{S.stats.saltos}</legend>
          <Row label={S.stats.condicionales} value={st.saltosCondicionales} hint={S.stats.hintCond} />
          <Row label={S.stats.incondicionales} value={st.saltosIncondicionales} />
        </fieldset>
        <fieldset className="groupbox space-y-1">
          <legend>{S.stats.pila}</legend>
          <Row label="Push:" value={st.push} hint={S.stats.hintPila} />
          <Row label="Pop:" value={st.pop} hint={S.stats.hintPila} />
        </fieldset>
      </div>
      <fieldset className="groupbox mt-2 space-y-1">
        <legend>{S.stats.otras}</legend>
        <Row label={S.stats.comparaciones} value={st.comparaciones} />
        <Row label={S.stats.logicas} value={st.logicas} hint="OR, XOR, AND, etc..." />
        <Row label={S.stats.aritmeticas} value={st.aritmeticas} hint={ARITH_HINT} />
        <Row label={S.stats.desplazamientos} value={st.desplazamientos} hint="Desplazamiento de Bits: SHR, SHL ROR, ROL" />
        <Row label={S.stats.entrada} value={st.entrada} hint="LDT, IN" />
        <Row label={S.stats.salida} value={st.salida} hint="EAP, MSG, OUT" />
      </fieldset>
      <label className="mt-2 flex items-center gap-2 text-[12px]" title={S.stats.hintMostrar}>
        <input type="checkbox" checked={config.showStatsAfterRun} onChange={(e) => store.setConfig({ showStatsAfterRun: e.target.checked })} />
        {S.stats.mostrarDespues}
      </label>
    </Window>
  );
}
