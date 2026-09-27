import { useState } from 'react';
import { ISA, PORT_HELP, parseAddress } from '../../core';
import { store, useAppState, useTick } from '../../state/store';
import { Dialog } from '../Dialog';
import { fileExtension } from '../../platform/files';
import { capList } from '../listCap';
import { S } from '../strings';

export function ModifyMemoryDialog() {
  useTick();
  const prefill = useAppState((s) => s.modifyAddr);
  const [addr, setAddr] = useState(prefill ?? '');
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const a = parseAddress(addr);
  const current = a ? store.mem.get(a.addr) : null;
  const flags = store.cpu.flags;
  const close = () => store.setWindow('modifyMemory', false);
  const submit = () => {
    const err = store.modifyMemory(addr, value);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: S.modify.ok });
  };
  return (
    <Dialog title={S.modify.title} onClose={close} width={460} testId="dlg-modify">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex items-center gap-2">
          <span className="w-20">{S.modify.direccion}</span>
          <input className="field mono w-24" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="000" title={S.modify.hintDir} data-testid="modify-addr" />
          {current && (
            <span className="text-[11px] text-(--muted)">
              actual: {current.text === '' ? '(vacía)' : current.text}
              {current.comment ? ` ; ${current.comment}` : ''}
            </span>
          )}
        </label>
        <label className="flex items-center gap-2">
          <span className="w-20">{S.modify.valor}</span>
          <input className="field mono flex-1" value={value} onChange={(e) => setValue(e.target.value)} placeholder="MOV AX,BX  ó  1011" title={S.modify.hintValor} data-testid="modify-value" />
        </label>
        <div className="flex items-center justify-between">
          <span className={msg ? (msg.ok ? 'text-(--ok)' : 'text-(--err)') : ''} data-testid="modify-msg">
            {msg?.text ?? ''}
          </span>
          <button type="submit" className="btn btn-primary" data-testid="modify-submit">
            {S.buttons.modificar}
          </button>
        </div>
      </form>
      <fieldset className="groupbox mt-3">
        <legend>{S.modify.flags}</legend>
        <div className="flex gap-4">
          {(['Z', 'N', 'C', 'O'] as const).map((f) => (
            <label key={f} className="flex items-center gap-1">
              <input type="checkbox" checked={flags[f] === 1} onChange={(e) => store.setFlag(f, e.target.checked ? 1 : 0)} />
              {f === 'Z' ? 'Z (Zero Flag)' : f === 'N' ? 'N (Negative ó Sign Flag)' : f === 'C' ? 'C (Carry Flag)' : 'O (Overflow Flag)'}
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  );
}

export function HelpDialog() {
  return (
    <Dialog title={S.help.title} onClose={() => store.setWindow('help', false)} width={760} testId="dlg-help">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-(--panel-2) text-left">
            <tr>
              <th className="px-2 py-1">{S.help.codigo}</th>
              <th className="px-2 py-1">{S.help.instruccion}</th>
              <th className="px-2 py-1">{S.help.descripcion}</th>
            </tr>
          </thead>
          <tbody>
            {ISA.map((d) => (
              <tr key={d.code} className="border-b border-(--panel-2) align-top">
                <td className="mono px-2 py-1">{d.code.toString().padStart(2, '0')}</td>
                <td className="mono px-2 py-1 whitespace-nowrap">{d.list.slice(5)}</td>
                <td className="px-2 py-1">{d.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

export function AboutDialog() {
  return (
    <Dialog title={S.about.title} onClose={() => store.setWindow('about', false)} width={480} testId="dlg-about">
      <div className="space-y-2 text-center">
        <div className="text-2xl font-bold tracking-[0.3em] text-(--accent)">{S.about.banner}</div>
        <div className="font-semibold">{S.about.subtitle}</div>
        <div>{S.about.version} · {S.about.date}</div>
        <div>
          Autor del programa original: <strong>{S.about.author}</strong> (Vlaye)
        </div>
        <div className="text-[12px]">
          {S.about.web}{' '}
          <a className="text-(--accent) underline" href="http://simuproc.cjb.net" target="_blank" rel="noreferrer">
            simuproc.cjb.net
          </a>{' '}
          ·{' '}
          <a className="text-(--accent) underline" href="http://simuproc.tk/" target="_blank" rel="noreferrer">
            simuproc.tk
          </a>
        </div>
        <hr className="border-(--border)" />
        <div className="text-[12px] text-(--muted)">
          SimuProc Web es una reimplementación libre para el navegador de SimuProc 1.4.3.0, hecha a partir de su documentación, sus
          textos y sus programas de ejemplo, para poder usarlo en macOS y Linux. El original es freeware y "puede ser distribuido
          libremente".
        </div>
      </div>
    </Dialog>
  );
}

export function SaveAsDialog() {
  const fileName = useAppState((s) => s.fileName);
  const initialExt = fileName ? fileExtension(fileName) : 'smp';
  const [format, setFormat] = useState<'smp' | 'asm'>(initialExt === 'asm' || initialExt === 'txt' ? 'asm' : 'smp');
  const [name, setName] = useState(fileName ?? 'programa.smp');
  const close = () => store.setWindow('saveAs', false);
  const changeFormat = (f: 'smp' | 'asm') => {
    setFormat(f);
    setName((n) => n.replace(/\.[^.]*$/, '') + '.' + f);
  };
  // A typed program extension selects its format, so the name and the saved format agree.
  const typeName = (n: string) => {
    setName(n);
    const ext = fileExtension(n.trim());
    if (ext === 'smp') setFormat('smp');
    else if (ext === 'asm' || ext === 'txt') setFormat('asm');
  };
  return (
    <Dialog title={S.saveAs.title} onClose={close} width={440} testId="dlg-saveas">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() !== '') store.saveAs(name.trim(), format);
        }}
      >
        <label className="flex items-center gap-2">
          <span className="w-32">{S.saveAs.nombre}</span>
          <input className="field flex-1" value={name} onChange={(e) => typeName(e.target.value)} data-testid="saveas-name" />
        </label>
        <div className="flex items-center gap-4">
          <span className="w-32">{S.saveAs.formato}</span>
          <label className="flex items-center gap-1">
            <input type="radio" checked={format === 'smp'} onChange={() => changeFormat('smp')} /> Programa del Simulador (*.smp)
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={format === 'asm'} onChange={() => changeFormat('asm')} /> Texto del Editor 2 (*.asm)
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={close}>
            {S.buttons.cancelar}
          </button>
          <button type="submit" className="btn btn-primary" data-testid="saveas-submit">
            {S.menus.guardar}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function ErrorListDialog() {
  const list = useAppState((s) => s.windows.errorList);
  if (!list) return null;
  const close = () => store.setWindow('errorList', null);
  const { shown, more } = capList(list.items);
  return (
    <Dialog title={list.title} onClose={close} width={520} testId="dlg-errors">
      <ul className="mb-3 max-h-64 list-disc overflow-auto pl-5 text-[12px]" data-testid="error-list">
        {shown.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
        {more && <li className="list-none text-(--muted)">{more}</li>}
      </ul>
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary" onClick={close}>
          {S.buttons.aceptar}
        </button>
      </div>
    </Dialog>
  );
}

export function PortHelpDialog() {
  const port = useAppState((s) => s.windows.portHelp);
  if (port === null) return null;
  const text = (PORT_HELP as Record<number, string>)[port] ?? `Puerto ${port}`;
  // The original shows each port's help in a message box captioned "Dispositivos", like the menu.
  return (
    <Dialog title={S.menus.dispositivos} onClose={() => store.setWindow('portHelp', null)} width={560}>
      <pre className="mono whitespace-pre-wrap text-[12px]">{text}</pre>

    </Dialog>
  );
}
