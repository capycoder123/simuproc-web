import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { S } from './strings';

interface WindowProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  x: number;
  y: number;
  width: number;
  height?: number;
  z?: number;
  onFocus?: () => void;
  testId?: string;
}

/** Keeps at least part of the title bar inside the viewport, so the window can always be dragged back. */
function clampToViewport(p: { x: number; y: number }): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - 120);
  const maxY = Math.max(0, window.innerHeight - 40);
  return { x: Math.min(maxX, Math.max(0, p.x)), y: Math.min(maxY, Math.max(0, p.y)) };
}

/** Floating, draggable window (the original's secondary forms). */
export function Window({ title, onClose, children, x, y, width, height, z = 20, onFocus, testId }: WindowProps) {
  const [pos, setPos] = useState(() => clampToViewport({ x, y }));
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // A narrower browser must not leave the window out of reach.
  useEffect(() => {
    const onResize = () => setPos(clampToViewport);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Clicks on the close button must reach it: do not start a drag from it.
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos(clampToViewport({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      className="win"
      style={{ left: pos.x, top: pos.y, width, height, maxWidth: 'calc(100vw - 8px)', maxHeight: 'calc(100vh - 8px)', zIndex: z }}
      data-testid={testId}
      onPointerDownCapture={onFocus}
      role="dialog"
      aria-label={title}
    >
      <div className="win-title" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <span>{title}</span>
        <button type="button" className="win-close" onClick={onClose} aria-label={S.buttons.cerrar} title={S.buttons.cerrar}>
          ×
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-2">{children}</div>
    </div>
  );
}
