import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MEM_SIZE, bin16, cellToSource, hex3, parseBinaryWord, type Cell } from '../../core';
import { store, useAppState, useTick } from '../../state/store';
import { S } from '../strings';

const ROW_H = 22;
const ZEROS = '0000000000000000';

function cellValue(cell: Cell, showCode: boolean): string {
  if (cell.origin === 'empty') return ZEROS;
  if (cell.origin === 'instr') return showCode ? cell.text : cellToSource(cell).source;
  const word = parseBinaryWord(cell.text);
  return word !== null ? bin16(word) : cell.text;
}

function rowTitle(addr: number, cell: Cell): string {
  const parts = [hex3(addr)];
  const word = cell.origin === 'data' ? parseBinaryWord(cell.text) : null;
  if (word !== null) parts.push(`= ${word} decimal`);
  if (cell.origin === 'instr') parts.push(`(${cell.text})`);
  if (cell.comment) parts.push(`; ${cell.comment}`);
  return parts.join(' ');
}

/** The 4096-row memory list, windowed to the visible rows. */
export function MemoryPanel() {
  const tick = useTick();
  const showCode = useAppState((s) => s.showCode);
  const config = useAppState((s) => s.config);
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(400);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // AutoScroll: follow the executed instruction and/or the accessed variable.
  useEffect(() => {
    const el = ref.current;
    if (!el || !config.animation) return;
    const h = store.highlight;
    const targets: number[] = [];
    if (config.autoscrollInstr && h.reads.length > 0) targets.push(h.reads[0]);
    if (config.autoscrollVars) {
      const vars = [...h.reads.slice(1), ...h.writes];
      if (vars.length > 0) targets.push(vars[vars.length - 1]);
    }
    for (const t of targets) {
      const top = t * ROW_H;
      if (top < el.scrollTop || top + ROW_H > el.scrollTop + el.clientHeight) {
        el.scrollTop = Math.max(0, top - el.clientHeight / 2);
      }
    }
  }, [tick, config.animation, config.autoscrollInstr, config.autoscrollVars]);

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
  const last = Math.min(MEM_SIZE - 1, Math.ceil((scrollTop + height) / ROW_H) + 4);
  const h = store.highlight;
  const pc = store.cpu.regs.PC;
  const fetched = h.reads.length > 0 ? h.reads[0] : -1;
  const rows = [];
  for (let i = first; i <= last; i++) {
    const cell = store.mem.cells[i];
    const isRead = h.reads.includes(i) && i !== fetched;
    const isWrite = h.writes.includes(i);
    rows.push(
      <div
        key={i}
        className="mem-row"
        style={{ top: i * ROW_H }}
        data-origin={cell.origin}
        data-pc={i === fetched || (fetched < 0 && i === pc) ? 1 : 0}
        data-read={isRead ? 1 : 0}
        data-write={isWrite ? 1 : 0}
        data-testid={`mem-${hex3(i)}`}
        title={rowTitle(i, cell)}
        onClick={config.editMemoryDirectly ? () => store.openModify(i) : undefined}
        onDoubleClick={() => store.openModify(i)}
      >
        <span className="addr">{hex3(i)}</span>
        <span className="val">{cellValue(cell, showCode)}</span>
      </div>,
    );
  }

  return (
    <fieldset className="groupbox flex min-h-0 flex-1 flex-col">
      <legend>{S.groups.memoria}</legend>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
        <button
          type="button"
          className={'btn btn-sm ' + (showCode ? 'btn-primary' : '')}
          onClick={() => store.toggleShowCode()}
          title={S.hints.cod}
          aria-pressed={showCode}
          data-testid="btn-cod"
        >
          {S.buttons.cod}
        </button>
        <label className="flex items-center gap-1" title={S.hints.autoInstr}>
          <input type="checkbox" checked={config.autoscrollInstr} onChange={(e) => store.setConfig({ autoscrollInstr: e.target.checked })} />
          AutoScroll instr.
        </label>
        <label className="flex items-center gap-1" title={S.hints.autoVars}>
          <input type="checkbox" checked={config.autoscrollVars} onChange={(e) => store.setConfig({ autoscrollVars: e.target.checked })} />
          AutoScroll var.
        </label>
      </div>
      <div className="grid grid-cols-[60px_1fr] gap-x-2 border-b border-(--border) px-1.5 pb-1 text-[11px] font-semibold text-(--muted)">
        <span>{S.memoria.direccion}</span>
        <span>{S.memoria.valor}</span>
      </div>
      <div
        ref={ref}
        className="relative min-h-0 flex-1 overflow-auto rounded border border-(--border) bg-(--field)"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        data-testid="memory-list"
        data-row-height={ROW_H}
      >
        <div style={{ height: MEM_SIZE * ROW_H, position: 'relative' }}>{rows}</div>
      </div>
    </fieldset>
  );
}
