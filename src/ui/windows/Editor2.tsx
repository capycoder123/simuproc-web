import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EDITOR_MENU_GROUPS } from '../../core';
import { highlightLine } from './highlight';
import { S } from '../strings';

interface Editor2Props {
  text: string;
  onChange: (text: string) => void;
}

/** Text editor with a highlighted overlay and the "Agregar Instrucción" context menu. */
export function Editor2({ text, onChange }: Editor2Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  const updateCursor = () => {
    const ta = taRef.current;
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const line = before.split('\n').length;
    const col = before.length - before.lastIndexOf('\n');
    setCursor({ line, col });
  };

  const syncScroll = () => {
    const ta = taRef.current;
    const pre = preRef.current;
    if (ta && pre) {
      // Keep the overlay out from under the textarea's scrollbars, so both reach the same maximum scroll offsets.
      pre.style.right = `${ta.offsetWidth - ta.clientWidth}px`;
      pre.style.bottom = `${ta.offsetHeight - ta.clientHeight}px`;
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    }
  };

  // Scrollbars come and go with the text and the window size.
  useLayoutEffect(syncScroll, [text]);
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const ro = new ResizeObserver(syncScroll);
    ro.observe(ta);
    return () => ro.disconnect();
  }, []);

  // Clamp the context menu to the viewport with its real size. The menu is sized to its content
  // (width: max-content), so where it is first laid out never squeezes it.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!menu || !el) return;
    const { width, height } = el.getBoundingClientRect();
    setMenuPos({
      left: Math.max(0, Math.min(menu.x, window.innerWidth - width)),
      top: Math.max(0, Math.min(menu.y, window.innerHeight - height)),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);

  const insert = (mnemonic: string) => {
    const ta = taRef.current;
    const snippet = `${mnemonic} `;
    if (!ta) {
      onChange(text + snippet);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = text.slice(0, start) + snippet + text.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + snippet.length, start + snippet.length);
    });
    setMenu(null);
  };

  const lines = text.split('\n');
  const common = 'mono m-0 p-2 whitespace-pre text-[13px] leading-5';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded border border-(--border) bg-(--field)">
        <pre ref={preRef} className={`${common} pointer-events-none absolute inset-0 overflow-hidden`} aria-hidden="true">
          {lines.map((l, i) => (
            <div key={i} className="min-h-5">
              {highlightLine(l, String(i))}
            </div>
          ))}
        </pre>
        <textarea
          ref={taRef}
          className={`${common} absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent caret-(--text) outline-none`}
          value={text}
          spellCheck={false}
          wrap="off"
          onChange={(e) => {
            onChange(e.target.value);
            updateCursor();
          }}
          onScroll={syncScroll}
          onKeyUp={updateCursor}
          onClick={updateCursor}
          onSelect={updateCursor}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuPos(null);
            setMenu({ x: e.clientX, y: e.clientY });
          }}
          aria-label={S.editor.tab2}
          data-testid="editor2-text"
        />
      </div>
      <div className="mt-1 text-[11px] text-(--muted)" data-testid="editor2-cursor">
        {S.editor.linea}
        {cursor.line}
        {S.editor.col}
        {cursor.col}
      </div>
      {menu && (
        <div
          ref={menuRef}
          className="menu-list"
          style={{
            position: 'fixed',
            left: menuPos?.left ?? menu.x,
            top: menuPos?.top ?? menu.y,
            width: 'max-content',
            maxWidth: '100vw',
            maxHeight: '100vh',
            overflowY: 'auto',
            zIndex: 90,
          }}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="menu-heading">{S.editor.agregar}</div>
          <div className="grid grid-cols-5 gap-x-2">
            {EDITOR_MENU_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="menu-heading">{g.title}</div>
                {g.mnemonics.map((m) => (
                  <button key={m} type="button" className="menu-item" role="menuitem" onClick={() => insert(m)}>
                    {m}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
