import { useEffect, useRef, useState, type ReactNode } from 'react';
import { S } from './strings';

interface DialogProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
  testId?: string;
}

/** Mounted dialogs, bottom to top: only the topmost one handles Escape and keeps the focus. */
const openDialogs: object[] = [];
/** Key events already handled by a dialog: once the top one closes, the next one must not act on the same Escape. */
const handledKeys = new WeakSet<Event>();

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
}

/** Modal dialog with a backdrop. Like the original's modal forms, the page behind it cannot take the focus. */
export function Dialog({ title, onClose, children, width, testId }: DialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  // Read on the first render, before autoFocus or the children's effects move the focus.
  const [returnFocus] = useState(() => document.activeElement);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const id = {};
    openDialogs.push(id);
    const isTop = () => openDialogs[openDialogs.length - 1] === id;
    const modal = modalRef.current;
    if (modal && !modal.contains(document.activeElement)) {
      // The first control of the body, not the title's close button.
      (focusables(bodyRef.current ?? modal)[0] ?? focusables(modal)[0])?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (!isTop() || !modal || handledKeys.has(e)) return;
      handledKeys.add(e);
      if (e.key === 'Escape') {
        onCloseRef.current?.();
      } else if (e.key === 'Tab') {
        const items = focusables(modal);
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        const outside = !modal.contains(active);
        if (e.shiftKey && (outside || active === first)) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && (outside || active === last)) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    // Anything else that moves the focus behind the dialog (a click on the backdrop, a script) brings it back.
    const onFocusIn = (e: FocusEvent) => {
      if (!isTop() || !modal || modal.contains(e.target as Node)) return;
      focusables(modal)[0]?.focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      openDialogs.splice(openDialogs.indexOf(id), 1);
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
    };
  }, [returnFocus]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ width }} data-testid={testId}>
        <div className="win-title" style={{ cursor: 'default' }}>
          <span>{title}</span>
          {onClose && (
            <button type="button" className="win-close" onClick={onClose} aria-label={S.buttons.cerrar} title={S.buttons.cerrar}>
              ×
            </button>
          )}
        </div>
        <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
          {children}
        </div>
      </div>
    </div>
  );
}
