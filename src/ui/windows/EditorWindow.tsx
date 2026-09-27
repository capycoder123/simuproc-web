import { useEffect, useState } from 'react';
import { MEM_SIZE, hex3, parseAddress, validateRow, type Editor1Row } from '../../core';
import { EXAMPLE_GROUPS } from '../../ejemplos';
import { store, useAppState } from '../../state/store';
import { Window } from '../Window';
import { capList } from '../listCap';
import { pickFile } from '../../platform/files';
import { S } from '../strings';
import { Editor2 } from './Editor2';

function Editor1Table() {
  const rows = useAppState((s) => s.editor.rows);
  const update = (i: number, patch: Partial<Editor1Row>) => store.editorSetRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => {
    const addr = rows.length > 0 ? Math.min(MEM_SIZE - 1, rows[rows.length - 1].addr + 1) : 0;
    store.editorSetRows([...rows, { addr, source: '', comment: '' }]);
  };
  const removeRow = (i: number) => store.editorSetRows(rows.filter((_, j) => j !== i));
  const pct = ((rows.length / MEM_SIZE) * 100).toFixed(2);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="table-editor min-h-0 flex-1 overflow-auto rounded border border-(--border) bg-(--field)" data-testid="editor1-table">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-(--panel-2) text-left text-[11px] text-(--muted)">
            <tr>
              <th className="w-14 px-1">{S.editor.columnas.dir}</th>
              <th className="w-56 px-1">{S.editor.columnas.inst}</th>
              <th className="px-1">{S.editor.columnas.comentario}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const err = validateRow(r);
              return (
                <tr key={i} data-error={err ? 1 : 0} title={err?.message} className="border-b border-(--panel-2)">
                  <td>
                    <input
                      key={`${i}-${r.addr}`}
                      defaultValue={hex3(r.addr)}
                      aria-label="Dirección"
                      onBlur={(e) => {
                        const a = parseAddress(e.target.value);
                        if (a) update(i, { addr: a.addr });
                        else e.target.value = hex3(r.addr);
                      }}
                    />
                  </td>
                  <td>
                    <input value={r.source} aria-label="Instrucción" onChange={(e) => update(i, { source: e.target.value })} />
                  </td>
                  <td>
                    <input value={r.comment} aria-label="Comentario" onChange={(e) => update(i, { comment: e.target.value })} />
                  </td>
                  <td className="text-center">
                    <button type="button" className="btn btn-sm" title={S.editor.borrarFila} onClick={() => removeRow(i)}>
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-3 text-(--muted)">Editor vacío. Convierte un programa del Editor 2, tráelo desde la memoria o agrega filas.</div>}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-(--muted)">
        <button type="button" className="btn btn-sm" onClick={addRow}>
          {S.editor.agregarFila}
        </button>
        <span>
          {S.editor.usoMemoria}
          {pct}% ({rows.length} / {MEM_SIZE})
        </span>
      </div>
    </div>
  );
}

function ExamplesMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('.examples-root')) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="examples-root relative">
      <button type="button" className="btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} data-testid="btn-ejemplos">
        {S.editor.ejemplos} ▾
      </button>
      {open && (
        <div className="menu-list max-h-[80vh] overflow-auto" role="menu" style={{ minWidth: 640 }}>
          <div className="grid grid-cols-3 gap-x-2">
            {EXAMPLE_GROUPS.map((g) => (
              <div key={g.id}>
                <div className="menu-heading">{g.title}</div>
                {g.entries.map((e) => (
                  <button
                    key={e.name}
                    type="button"
                    role="menuitem"
                    className="menu-item py-0.5"
                    data-testid={`ejemplo-${g.id}-${e.name}`}
                    onClick={() => {
                      setOpen(false);
                      void store.editorLoadExample(g.id, e.name);
                    }}
                  >
                    {e.label}
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

/** "Editor Interno de SimuProc" with Editor 1 (Tipo Memoria) and Editor 2 (De Texto). */
export function EditorWindow({ z, onFocus }: { z: number; onFocus: () => void }) {
  const editor = useAppState((s) => s.editor);
  const tab = editor.tab;
  const errors = capList(editor.errors);
  const warnings = capList(editor.warnings);
  const width = Math.min(860, window.innerWidth - 16);
  const height = Math.min(600, window.innerHeight - 16);
  const x = Math.max(8, (window.innerWidth - width) / 2);
  const y = Math.max(8, (window.innerHeight - height) / 2 - 20);

  return (
    <Window title={S.editor.title} onClose={() => store.setWindow('editor', false)} x={x} y={y} width={width} height={height} z={z} onFocus={onFocus} testId="win-editor">
      <div className="mb-2 flex gap-1 border-b border-(--border)">
        {(['editor1', 'editor2'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={'rounded-t px-3 py-1 text-[12px] ' + (tab === t ? 'bg-(--field) font-semibold text-(--accent) shadow' : 'text-(--muted) hover:bg-(--panel-2)')}
            onClick={() => store.editorSetTab(t)}
            role="tab"
            aria-selected={tab === t}
            data-testid={`tab-${t}`}
          >
            {t === 'editor1' ? S.editor.tab1 : S.editor.tab2}
          </button>
        ))}
      </div>
      {tab === 'editor1' ? (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            <button type="button" className="btn" onClick={() => void store.editorClear('editor1')} title={S.editor.limpiar1}>
              {S.editor.limpiar1}
            </button>
            <button type="button" className="btn" onClick={() => void store.editorConvertTo2()} data-testid="btn-convertir-a-editor2">
              {S.editor.convertirA2}
            </button>
            <button type="button" className="btn" onClick={() => void store.editorFromMemory()} title={S.editor.traer} data-testid="btn-traer-memoria">
              Traer desde Memoria Principal
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void store.editorSendToMemory()} title={S.editor.enviarHint} data-testid="btn-enviar-a-memoria">
              {S.editor.enviar}
            </button>
          </div>
          <Editor1Table />
        </>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            <button type="button" className="btn" onClick={() => void store.editorClear('editor2')}>
              {S.editor.limpiar2}
            </button>
            <button type="button" className="btn" onClick={() => void store.editorConvertTo1()} data-testid="btn-convertir-a-editor1">
              {S.editor.convertirA1}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void pickFile('.asm,.txt,.smp').then((f) => f && store.editorOpenFile(f));
              }}
            >
              {S.editor.cargar}
            </button>
            <button type="button" className="btn" onClick={() => store.editorSaveFile()}>
              {S.editor.guardar}
            </button>
            <ExamplesMenu />
          </div>
          <Editor2 text={editor.text} onChange={(t) => store.editorSetText(t)} />
        </>
      )}
      {(editor.errors.length > 0 || editor.warnings.length > 0) && (
        <div className="mt-2 max-h-24 overflow-auto rounded border border-(--border) bg-(--field) p-1 text-[11px]" data-testid="editor-messages">
          {errors.shown.map((e, i) => (
            <div key={`e${i}`} className="text-(--err)">
              {e.message}
            </div>
          ))}
          {errors.more && <div className="text-(--err)">{errors.more}</div>}
          {warnings.shown.map((w, i) => (
            <div key={`w${i}`} className="text-(--dir)">
              Aviso: {w.message}
            </div>
          ))}
          {warnings.more && <div className="text-(--dir)">{warnings.more}</div>}
        </div>
      )}
    </Window>
  );
}
