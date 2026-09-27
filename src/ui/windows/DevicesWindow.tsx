import { useEffect, useRef, useState } from 'react';
import { store, useAppState, useTick } from '../../state/store';
import { Window } from '../Window';
import { S } from '../strings';

/** "Dispositivos de E/S": monitor, keyboard and last value. Opens automatically on LDT / IN 1. */
export function DevicesWindow({ z, onFocus }: { z: number; onFocus: () => void }) {
  const tick = useTick();
  const req = useAppState((s) => s.inputRequest);
  const inputError = useAppState((s) => s.inputError);
  const inputStatus = useAppState((s) => s.inputStatus);
  const mode = useAppState((s) => s.keyboardMode);
  const scroll = useAppState((s) => s.monitorScroll);
  const [text, setText] = useState('');
  const [seenRequest, setSeenRequest] = useState(req);
  const inputRef = useRef<HTMLInputElement>(null);
  const monitorRef = useRef<HTMLDivElement>(null);
  const lines = store.monitor;
  const last = store.lastValue;

  // A new request clears the field (the original forgets the last value entered).
  if (req !== seenRequest) {
    setSeenRequest(req);
    if (req) setText('');
  }

  useEffect(() => {
    if (req) inputRef.current?.focus();
  }, [req]);

  // Follow the output only when the simulation changed something, not on every keystroke in Teclado.
  useEffect(() => {
    const el = monitorRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tick]);

  const submit = () => {
    store.submitInput(text);
    if (store.state.inputError === null) setText('');
  };

  const floatMode = req?.kind === 'in1';
  const prompt = req ? req.message || 'Entre un dato' : '';
  const x = Math.max(8, window.innerWidth - 560);
  const y = Math.max(8, window.innerHeight - 640);

  return (
    <Window title={S.devices.title} onClose={() => store.setWindow('devices', false)} x={x} y={y} width={540} z={z} onFocus={onFocus} testId="win-devices">
      <p className="mb-1 text-[11px] text-(--muted)">{S.devices.intro}</p>
      <fieldset className="groupbox">
        <legend title={S.hints.pantalla}>{S.devices.pantalla}</legend>
        <div ref={monitorRef} className={'monitor h-52 rounded ' + (scroll ? 'overflow-auto' : 'overflow-hidden')} data-testid="monitor" aria-live="polite">
          {lines.map((l, i) => (
            <div key={i}>{l === '' ? ' ' : l}</div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          <button type="button" className="btn btn-sm" onClick={() => store.toggleMonitorScroll()} aria-pressed={scroll}>
            {S.buttons.verScroll}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => store.clearMonitor()}>
            {S.buttons.limpiarMonitor}
          </button>
        </div>
      </fieldset>
      <fieldset className="groupbox mt-2 space-y-1">
        <legend title={S.hints.teclado}>{S.devices.leer}</legend>
        <div className={'min-h-5 ' + (req ? 'font-semibold' : 'text-[11px] text-(--muted)')} data-testid="input-prompt">
          {req ? prompt : 'Esperando que el programa pida un dato (LDT ó IN registro,1)…'}
        </div>
        <div className="flex items-center gap-4 text-[12px]">
          <label className="flex items-center gap-1">
            <input type="radio" name="kbmode" checked={mode === 'decimal'} disabled={floatMode} onChange={() => store.setKeyboardMode('decimal')} />
            {S.devices.decimal}
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="kbmode" checked={mode === 'binario'} disabled={floatMode} onChange={() => store.setKeyboardMode('binario')} />
            {S.devices.binario}
          </label>
          {floatMode && <span className="text-[11px] text-(--muted)">(puerto 1: número real o entero, positivo o negativo)</span>}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            ref={inputRef}
            className="field mono flex-1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Teclado"
            data-testid="input-teclado"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary" data-testid="btn-entrar-dato">
            {S.buttons.entrarDato}
          </button>
        </form>
        {inputError && (
          <div className="text-(--err)" data-testid="input-error" role="alert">
            {inputError}
          </div>
        )}
        {inputStatus && !inputError && <div className="text-[11px] text-(--muted)">{inputStatus}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-2" title={S.devices.hintUltimo}>
          <span>{S.devices.ultimoDato}</span>
          <span className="reg-box min-w-16" data-testid="last-decimal">
            {last?.decimal ?? ''}
          </span>
          <span>{S.devices.binarioLabel}</span>
          <span className="reg-box min-w-40" data-testid="last-binary">
            {last?.binary ?? ''}
          </span>
        </div>
      </fieldset>
      <div className="mt-2 flex justify-end">
        <button type="button" className="btn" onClick={() => store.setWindow('devices', false)} data-testid="btn-ocultar-es">
          {S.buttons.ocultar}
        </button>
      </div>
    </Window>
  );
}
