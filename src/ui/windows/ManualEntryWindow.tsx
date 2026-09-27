import { useState } from 'react';
import { ISA, ISA_BY_CODE, MANUAL_TEXTS, hex3 } from '../../core';
import { store, useAppState } from '../../state/store';
import { Window } from '../Window';
import { S } from '../strings';

/** "Entrada de Instrucciones Manualmente": instruction list, address, parameters, comment, Ok, Borrar. */
export function ManualEntryWindow({ z, onFocus }: { z: number; onFocus: () => void }) {
  const manual = useAppState((s) => s.manual);
  const [code, setCode] = useState<number | null>(null);
  const [addrText, setAddrText] = useState<string | null>(null);
  const [operands, setOperands] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const def = code === null ? undefined : ISA_BY_CODE.get(code);
  const isMessage = def?.shape === 'msg';
  const needsOperands = def !== undefined && def.shape !== 'none' && !isMessage;
  const shownAddr = addrText ?? hex3(manual.nextAddr);

  /** Applies a typed address; false when it is not valid (the error stays shown). */
  const commitAddr = (): boolean => {
    if (addrText === null) return true;
    const err = store.manualSetAddress(addrText);
    setError(err);
    if (!err) setAddrText(null);
    return err === null;
  };

  const submit = () => {
    // An invalid address writes nothing: nextAddr is still the previous one.
    if (!commitAddr()) return;
    const err = store.manualAdd(code, operands, comment);
    setError(err);
    if (!err) {
      setOperands('');
      setComment('');
    }
  };

  return (
    <Window title={S.manual.title} onClose={() => store.setWindow('manual', false)} x={40} y={80} width={620} z={z} onFocus={onFocus} testId="win-manual">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-(--muted)" title={S.manual.hintLista}>
            {S.manual.lista}
          </span>
          <select
            className="field mono"
            size={8}
            value={code ?? ''}
            onChange={(e) => {
              setCode(e.target.value === '' ? null : Number(e.target.value));
              setError(null);
            }}
            data-testid="manual-list"
          >
            {ISA.map((d) => (
              <option key={d.code} value={d.code}>
                {d.list}
              </option>
            ))}
          </select>
        </label>
        <div className="min-h-8 rounded border border-(--border) bg-(--panel-2) px-2 py-1 text-[11px]" data-testid="manual-description">
          {def ? def.description : MANUAL_TEXTS.seleccione}
        </div>
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <span title={S.manual.hintDir}>{S.manual.dir}</span>
          <input
            className="field mono w-24"
            value={shownAddr}
            onChange={(e) => setAddrText(e.target.value)}
            onBlur={() => commitAddr()}
            title={S.manual.hintDir}
            data-testid="manual-addr"
          />
          <span title={S.manual.hintParams}>{S.manual.parametros}</span>
          <input
            className="field mono"
            value={operands}
            onChange={(e) => setOperands(e.target.value)}
            disabled={!needsOperands}
            placeholder={needsOperands ? def?.list.replace(/^\d\d - \w+\s*/, '') : ''}
            title={S.manual.hintParams}
            data-testid="manual-operands"
          />
          <span title={S.manual.hintComentario}>{S.manual.comentario}</span>
          <input
            className="field"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={isMessage ? S.manual.placeholderComentario : ''}
            title={S.manual.hintComentario}
            data-testid="manual-comment"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-(--err)" data-testid="manual-error">
            {error ?? ''}
          </span>
          <div className="flex gap-1">
            <button type="submit" className="btn btn-primary" title={S.manual.hintOk} data-testid="manual-ok">
              {S.buttons.ok}
            </button>
            <button
              type="button"
              className="btn"
              title={S.manual.hintBorrar}
              onClick={() => {
                setError(store.manualDelete());
                setAddrText(null);
              }}
              data-testid="manual-borrar"
            >
              {S.buttons.borrar}
            </button>
          </div>
        </div>
      </form>
    </Window>
  );
}
