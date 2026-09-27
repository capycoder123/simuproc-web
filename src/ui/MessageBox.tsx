import { useEffect, useRef } from 'react';
import { store, useAppState } from '../state/store';
import { Dialog } from './Dialog';

/** The original's message boxes (Sí/No, Aceptar), driven by store.ask(). */
export function MessageBox() {
  const box = useAppState((s) => s.messageBox);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, [box]);
  if (!box) return null;
  return (
    <Dialog title={box.title} testId="msgbox" width={420}>
      <p className="mb-4 whitespace-pre-line" data-testid="msgbox-message">
        {box.message}
      </p>
      <div className="flex justify-end gap-2">
        {box.buttons.map((b, i) => (
          <button
            key={b}
            ref={i === 0 ? first : undefined}
            type="button"
            className={'btn ' + (i === 0 ? 'btn-primary' : '')}
            onClick={() => store.answer(b)}
            data-testid={`msgbox-btn-${b}`}
          >
            {b}
          </button>
        ))}
      </div>
    </Dialog>
  );
}
