import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIALOG_TEXTS, ISA_BY_MNEMONIC, MANUAL_TEXTS, Memory, STATUS, assemble, disassemble, disassembleWithWarnings, serializeSmp } from '../../src/core';
import { AppStore, MAX_PROGRAM_FILE_BYTES, STATS_TEXTS, type WatchEntry } from '../../src/state/store';
import { silenceSpeaker } from '../../src/platform/audio';
import { downloadBytes, normalizeSaveName } from '../../src/platform/files';
import { S } from '../../src/ui/strings';

// No DOM under Vitest: record the downloads and the speaker resets instead of performing them.
vi.mock('../../src/platform/files', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../src/platform/files')>()), downloadBytes: vi.fn() }));
vi.mock('../../src/platform/audio', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../src/platform/audio')>()), silenceSpeaker: vi.fn() }));

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Lets the runner and the dialogs settle: waits until `pred` holds (or gives up). */
async function until(pred: () => boolean, max = 200): Promise<void> {
  for (let i = 0; i < max && !pred(); i++) await tick();
}

/** Stores whose program may still loop when a test fails; afterEach stops them. */
const stores: AppStore[] = [];

async function makeStore(source: string, name = 'p.asm'): Promise<AppStore> {
  const store = new AppStore();
  stores.push(store);
  store.setConfig({ animation: false });
  await store.openFile(new File([source], name));
  expect(store.state.status).toBe(STATUS.abierto + name);
  return store;
}

function watch(store: AppStore, patch: Partial<WatchEntry>, addrText = '20'): void {
  store.setWatch(0, { addrText });
  store.setWatch(0, { enabled: true, ...patch });
}

const boxTitle = (store: AppStore) => store.state.messageBox?.title ?? null;
const isWatchBox = (store: AppStore) => boxTitle(store) === STATUS.vigilantePausa;
const settled = (store: AppStore) => store.state.messageBox !== null || store.runner.state === 'idle' || store.runner.state === 'paused';

async function answerWhenAsked(store: AppStore, title: string, choice: string): Promise<void> {
  await until(() => boxTitle(store) === title);
  expect(boxTitle(store)).toBe(title);
  store.answer(choice);
}

afterEach(() => {
  for (const s of stores.splice(0)) s.runner.stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(downloadBytes).mockClear();
  vi.mocked(silenceSpeaker).mockClear();
});

describe('AppStore: Vigilante de Memoria', () => {
  it('keeps the last 5 distinct values in the history, newest first', async () => {
    const src = ['INC AX', ...Array.from({ length: 7 }, () => 'MOV 20,AX\nINC AX'), 'HLT'].join('\n');
    const store = await makeStore(src);
    watch(store, {});
    store.run();
    await until(() => store.runner.state === 'idle');
    expect(store.cpu.status).toBe('halted');
    const w = store.state.watches[0];
    expect(w.last).toBe('0000000000000111');
    expect(w.history).toEqual(['0000000000000110', '0000000000000101', '0000000000000100', '0000000000000011', '0000000000000010']);
  });

  it('"Pausar Simulación" pauses after the change and Sí resumes the run', async () => {
    const store = await makeStore('INC AX\nMOV 20,AX\nINC AX\nINC AX\nHLT');
    watch(store, { pauseOnChange: true });
    store.run();
    await until(() => isWatchBox(store));
    expect(store.runner.state).toBe('paused');
    expect(store.cpu.regs.PC).toBe(2);
    expect(store.state.messageBox?.message).toContain('ha cambiado de 0000000000000000 a 0000000000000001');
    store.answer(S.buttons.si);
    await until(() => store.runner.state === 'idle');
    expect(store.cpu.status).toBe('halted');
    expect(store.cpu.regs.AX).toBe(3);
  });

  it('"Pausar solo si el Valor es =" reads the value in binary and pauses only when it becomes equal', async () => {
    // 020 becomes 2, stays 2 over a NOP, drops to 1 and becomes 2 again: two pauses.
    const store = await makeStore('INC AX\nINC AX\nMOV 20,AX\nNOP\nDEC AX\nMOV 20,AX\nINC AX\nMOV 20,AX\nHLT');
    watch(store, { pauseIfEqual: true, compareText: '10' });
    store.run();
    const pcs: number[] = [];
    for (let i = 0; i < 5; i++) {
      await until(() => isWatchBox(store) || store.runner.state === 'idle');
      if (!isWatchBox(store)) break;
      pcs.push(store.cpu.regs.PC);
      expect(store.state.messageBox?.message).toContain('es IGUAL al valor 10 especificado');
      store.answer(S.buttons.si);
    }
    expect(pcs).toEqual([3, 8]);
    expect(store.cpu.status).toBe('halted');
  });

  it('"10d" is read as decimal', async () => {
    const store = await makeStore('INC AX\nMOV 20,AX\nJMP 000');
    watch(store, { pauseIfEqual: true, compareText: '10d' });
    store.run();
    await until(() => isWatchBox(store));
    expect(isWatchBox(store)).toBe(true);
    expect(store.cpu.regs.AX).toBe(10);
    expect(store.state.messageBox?.message).toContain('es IGUAL al valor 10d especificado');
    store.answer(S.buttons.cancelar);
    await until(() => store.runner.state === 'idle');
    expect(store.runner.state).toBe('idle');
  });

  it('a watch pause after Paso a paso stays paused whatever the answer', async () => {
    for (const choice of [S.buttons.si, S.buttons.no]) {
      const store = await makeStore('INC AX\nMOV 20,AX\nINC AX\nINC AX\nHLT');
      watch(store, { pauseOnChange: true });
      store.stepOnce();
      await until(() => store.runner.state === 'paused');
      store.stepOnce();
      await until(() => isWatchBox(store));
      expect(isWatchBox(store)).toBe(true);
      store.answer(choice);
      await until(() => store.runner.state !== 'paused', 20);
      expect(store.runner.state).toBe('paused');
      expect(store.cpu.regs.PC).toBe(2);
      expect(store.cpu.regs.AX).toBe(1);
      expect(store.state.messageBox).toBeNull();
      expect(store.state.watches[0].pauseOnChange).toBe(choice === S.buttons.si);
    }
  });

  it('Nuevo while a watch pause is pending does not block later watch pauses', async () => {
    const store = await makeStore('INC AX\nMOV 20,AX\nJMP 000');
    watch(store, { pauseOnChange: true });
    // Without animation the batch that hits the watch ends before the pause is applied.
    store.run();
    expect(store.runner.state).toBe('running');
    const nuevo = store.nuevoPrograma();
    store.answer(S.buttons.si);
    await nuevo;
    expect(store.runner.state).toBe('idle');
    await store.openFile(new File(['INC AX\nMOV 20,AX\nHLT'], 'b.asm'));
    store.run();
    await until(() => settled(store));
    expect(store.runner.state).toBe('paused');
    expect(store.cpu.regs.PC).toBe(2);
    expect(store.state.messageBox?.message).toContain('ha cambiado de 0000000000000000 a 0000000000000001');
  });

  it('loading another program refreshes the watched value, so it does not raise a false change', async () => {
    const store = await makeStore('INC AX\nMOV 20,AX\nHLT', 'a.asm');
    watch(store, { pauseOnChange: true });
    store.run();
    await answerWhenAsked(store, STATUS.vigilantePausa, S.buttons.si);
    await until(() => store.runner.state === 'idle');
    expect(store.state.watches[0].history).toEqual(['0000000000000000']);
    await store.openFile(new File(['NOP\nNOP\nNOP\nHLT'], 'b.asm'));
    expect(store.state.watches[0].last).toBe('0000000000000000');
    store.run();
    await until(() => settled(store) && store.runner.state !== 'running');
    expect(store.state.messageBox).toBeNull();
    expect(store.cpu.status).toBe('halted');
    expect(store.state.watches[0].history).toEqual(['0000000000000000']);
  });

  it('enabling a watch again takes the current value as its baseline', async () => {
    const store = await makeStore('INC AX\nMOV 20,AX\nNOP\nNOP\nHLT');
    watch(store, {});
    store.run();
    await until(() => store.runner.state === 'idle');
    expect(store.state.watches[0].last).toBe('0000000000000001');
    store.setWatch(0, { enabled: false });
    expect(store.modifyMemory('20', '0')).toBeNull();
    store.setWatch(0, { enabled: true, pauseOnChange: true });
    expect(store.state.watches[0].last).toBe('0000000000000000');
    store.run();
    await until(() => settled(store) && store.runner.state !== 'running');
    // The first pause is the real change made by MOV, not the value edited while disabled.
    expect(store.state.messageBox?.message).toContain('ha cambiado de 0000000000000000 a 0000000000000001');
    expect(store.cpu.regs.PC).toBe(2);
  });
});

describe('AppStore: loading a program or Nuevo resets the program state', () => {
  const NOP = ISA_BY_MNEMONIC.get('NOP')!.code;

  it('forgets the manual-entry additions, so Borrar cannot erase the loaded program', async () => {
    const store = new AppStore();
    expect(store.manualAdd(NOP, '', '')).toBeNull();
    expect(store.manualAdd(NOP, '', '')).toBeNull();
    await store.openFile(new File(['MOV AX,BX\nMOV BX,AX\nHLT\n'], 'p.asm'));
    expect(store.state.manual).toEqual({ nextAddr: 0, added: [] });
    expect(store.manualDelete()).toBe(MANUAL_TEXTS.e22);
    expect(store.mem.get(1).text).toBe('10BX,AX');
    expect(store.state.modified).toBe(false);
  });

  it('Nuevo also forgets the manual-entry additions', async () => {
    const store = new AppStore();
    expect(store.manualAdd(NOP, '', '')).toBeNull();
    const nuevo = store.nuevoPrograma();
    store.answer(S.buttons.si);
    await nuevo;
    expect(store.state.manual).toEqual({ nextAddr: 0, added: [] });
    expect(store.manualDelete()).toBe(MANUAL_TEXTS.e22);
    expect(store.state.modified).toBe(false);
  });

  it('clears the previous run duration and header', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (now += 1));
    for (const reload of ['open', 'nuevo'] as const) {
      const store = await makeStore('INC AX\nHLT');
      store.run();
      await until(() => store.runner.state === 'idle');
      expect(store.state.statsHeader).toBe(STATS_TEXTS.finished);
      expect(store.elapsedMs()).toBeGreaterThan(0);
      if (reload === 'open') {
        await store.openFile(new File(['NOP\nHLT'], 'b.asm'));
      } else {
        const nuevo = store.nuevoPrograma();
        store.answer(S.buttons.si);
        await nuevo;
      }
      expect(store.cpu.stats.instrucciones).toBe(0);
      expect(store.elapsedMs()).toBe(0);
      expect(store.state.statsHeader).toBe('');
    }
  });
});

describe('AppStore: statistics', () => {
  it('does not count the time a runtime-error dialog is open', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const store = await makeStore('POP AX\nHLT');
    store.run();
    await until(() => store.state.messageBox !== null);
    expect(store.state.messageBox?.buttons).toEqual([S.buttons.si, S.buttons.no]);
    now += 5000;
    store.answer(S.buttons.si);
    await until(() => store.runner.state === 'idle');
    expect(store.cpu.status).toBe('halted');
    expect(store.elapsedMs()).toBe(0);
  });

  it('the header keeps the fixed "El Programa en Memoria" line of the original', async () => {
    expect(STATS_TEXTS.finished).toBe('El Programa en Memoria\nha terminado su ejecución con éxito, estas son las estadísticas del programa:');
    expect(STATS_TEXTS.interrupted).toBe('El Programa en Memoria\nha sido interrumpido, estas son las estadísticas del programa:');
    const store = await makeStore('LDT\nHLT');
    store.run();
    expect(store.runner.state).toBe('waiting');
    const reiniciar = store.reiniciarRegistros();
    await answerWhenAsked(store, DIALOG_TEXTS.reiniciarTitulo, S.buttons.si);
    await reiniciar;
    expect(store.state.statsHeader).toBe(STATS_TEXTS.interrupted);
  });
});

describe('AppStore: Enviar a Memoria', () => {
  it('answering No to overwrite leaves a running simulation untouched', async () => {
    const store = await makeStore('LDT\nHLT');
    store.run();
    expect(store.runner.state).toBe('waiting');
    const before = store.mem.get(0).text;
    store.editorSetRows([{ addr: 0, source: 'HLT', comment: '' }]);
    const send = store.editorSendToMemory();
    await answerWhenAsked(store, S.appName, S.buttons.si);
    await answerWhenAsked(store, DIALOG_TEXTS.advertencia, S.buttons.no);
    await send;
    expect(store.runner.state).toBe('waiting');
    expect(store.mem.get(0).text).toBe(before);
    expect(store.state.statsHeader).not.toBe(STATS_TEXTS.interrupted);
  });
});

describe('AppStore: Modificar una Posición de Memoria', () => {
  it('validates the address and stores the value', () => {
    const store = new AppStore();
    expect(store.modifyMemory('  ', '1')).toBe(S.modify.indique);
    expect(store.modifyMemory('1000', '1')).toBe(S.modify.badDir);
    expect(store.modifyMemory('XYZ', '1')).toBe(S.modify.badDir);
    expect(store.modifyMemory('2Ah', 'HLT')).toBeNull();
    expect(store.mem.get(0x2a).text).toBe('99000');
    expect(store.state.modified).toBe(true);
  });

  it('rejects MSG without a message, so a program saved as .asm reopens', () => {
    const store = new AppStore();
    expect(store.modifyMemory('0', 'MSG')).toBe(MANUAL_TEXTS.mensajeVacio);
    expect(store.modifyMemory('0', "MSG '  '")).toBe(MANUAL_TEXTS.mensajeVacio);
    expect(store.mem.get(0).text).toBe('');
    expect(store.state.modified).toBe(false);
    expect(store.modifyMemory('0', "MSG 'hola'")).toBeNull();
    expect(store.mem.get(0)).toMatchObject({ text: '42000', comment: 'hola' });
    // Without a new message the cell's comment stays the message.
    expect(store.modifyMemory('0', 'MSG')).toBeNull();
    expect(store.mem.get(0)).toMatchObject({ text: '42000', comment: 'hola' });
    expect(store.modifyMemory('1', 'HLT')).toBeNull();
    expect(assemble(disassemble(store.mem.entries())).errors).toEqual([]);
  });
});

describe('AppStore: message boxes', () => {
  it('queues a second question instead of replacing the open one', async () => {
    const store = new AppStore();
    const first = store.ask('A', 'a', [S.buttons.si, S.buttons.no]);
    const second = store.ask('B', 'b', [S.buttons.aceptar]);
    expect(boxTitle(store)).toBe('A');
    store.answer(S.buttons.no);
    expect(boxTitle(store)).toBe('B');
    store.answer(S.buttons.aceptar);
    expect(store.state.messageBox).toBeNull();
    await expect(first).resolves.toBe(S.buttons.no);
    await expect(second).resolves.toBe(S.buttons.aceptar);
  });

  it('Reiniciar during a runtime-error question waits its turn and the run does not get stuck', async () => {
    const store = await makeStore('POP AX\nHLT');
    store.run();
    await until(() => store.state.messageBox !== null);
    const errorTitle = boxTitle(store);
    const reiniciar = store.reiniciarRegistros();
    expect(boxTitle(store)).toBe(errorTitle);
    store.answer(S.buttons.si);
    await answerWhenAsked(store, DIALOG_TEXTS.reiniciarTitulo, S.buttons.no);
    await reiniciar;
    await until(() => store.runner.state === 'idle');
    expect(store.runner.state).toBe('idle');
    expect(store.cpu.status).toBe('halted');
  });

  it('a runtime error raised while Nuevo is open is asked afterwards and does not touch the new state', async () => {
    const store = await makeStore('INC AX\nJNE 000\nPOP BX\nHLT');
    store.run();
    const nuevo = store.nuevoPrograma();
    await until(() => store.state.status.startsWith(STATUS.error), 5000);
    expect(store.state.status.startsWith(STATUS.error)).toBe(true);
    expect(boxTitle(store)).toBe(DIALOG_TEXTS.nuevoTitulo);
    store.answer(S.buttons.si);
    await nuevo;
    expect(store.state.status).toBe(STATUS.sinPrograma);
    expect(store.state.messageBox?.message).toContain('POP');
    store.answer(S.buttons.si);
    await until(() => false, 5);
    expect(store.state.messageBox).toBeNull();
    expect(store.runner.state).toBe('idle');
    expect(store.state.status).toBe(STATUS.sinPrograma);
  });
});

describe('AppStore: files', () => {
  it('opens an SMP file saved under an .asm name', async () => {
    const mem = new Memory();
    mem.load(assemble('LDA 10\nHLT\n#10\n101').cells);
    const store = new AppStore();
    await store.openFile(new File([serializeSmp(mem.cells)], 'prog.asm'));
    expect(store.state.status).toBe(STATUS.abierto + 'prog.asm');
    expect(store.state.messageBox).toBeNull();
    expect(store.mem.get(0).text).toBe(mem.get(0).text);
    expect(store.mem.get(0x10).text).toBe(mem.get(0x10).text);
  });

  it('Guardar Como gives the name the extension of the chosen format', () => {
    expect(normalizeSaveName('prueba', 'smp')).toBe('prueba.smp');
    expect(normalizeSaveName('prog.txt', 'smp')).toBe('prog.smp');
    expect(normalizeSaveName('prog.asm', 'smp')).toBe('prog.smp');
    expect(normalizeSaveName('prog.txt', 'asm')).toBe('prog.txt');
    expect(normalizeSaveName('x.asm', 'asm')).toBe('x.asm');
    expect(normalizeSaveName('x.SMP', 'asm')).toBe('x.asm');
    expect(normalizeSaveName('v1.2', 'smp')).toBe('v1.2.smp');
    const store = new AppStore();
    store.saveAs('prueba', 'smp');
    expect(vi.mocked(downloadBytes).mock.calls.at(-1)?.[0]).toBe('prueba.smp');
    expect(store.state.fileName).toBe('prueba.smp');
  });

  it('a file that cannot be read reports the error instead of rejecting', async () => {
    const broken = { name: 'x.asm', arrayBuffer: () => Promise.reject(new Error('NotReadableError')) } as unknown as File;
    const store = new AppStore();
    const open = store.openFile(broken);
    await until(() => store.state.messageBox !== null);
    expect(store.state.status).toBe(STATUS.errorAbrir + 'x.asm');
    expect(store.state.messageBox?.message).toBe(DIALOG_TEXTS.archivoNoValido);
    store.answer(S.buttons.aceptar);
    await expect(open).resolves.toBeUndefined();
    const editorOpen = store.editorOpenFile(broken);
    await until(() => store.state.messageBox !== null);
    expect(store.state.messageBox?.message).toBe(DIALOG_TEXTS.archivoNoValido);
    store.answer(S.buttons.aceptar);
    await expect(editorOpen).resolves.toBeUndefined();
  });

  it('an .smp that fails for another reason shows the original text, not the raw exception', async () => {
    const mem = new Memory();
    mem.load(assemble('HLT').cells);
    const store = new AppStore();
    vi.spyOn(store.mem, 'load').mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'text')");
    });
    const open = store.openFile(new File([serializeSmp(mem.cells)], 'p.smp'));
    await until(() => store.state.messageBox !== null);
    expect(store.state.status).toBe(STATUS.errorAbrir + 'p.smp');
    expect(store.state.messageBox?.message).toBe(DIALOG_TEXTS.archivoNoValido);
    store.answer(S.buttons.aceptar);
    await open;
  });

  it('a file larger than 1 MiB is rejected without reading it', async () => {
    for (const open of ['abrir', 'editor'] as const) {
      const big = new File([new Uint8Array(MAX_PROGRAM_FILE_BYTES + 1)], 'big.asm');
      const read = vi.spyOn(big, 'arrayBuffer');
      const store = new AppStore();
      const done = open === 'abrir' ? store.openFile(big) : store.editorOpenFile(big);
      await until(() => store.state.messageBox !== null);
      expect(store.state.status).toBe(STATUS.errorAbrir + 'big.asm');
      expect(store.state.messageBox?.message).toBe(DIALOG_TEXTS.archivoNoValido);
      store.answer(S.buttons.aceptar);
      await done;
      expect(read).not.toHaveBeenCalled();
      expect(store.state.editor.text).toBe('');
    }
    const store = new AppStore();
    await store.openFile(new File(['HLT'.padEnd(MAX_PROGRAM_FILE_BYTES, ' ')], 'limite.asm'));
    expect(store.state.status).toBe(STATUS.abierto + 'limite.asm');
  });

  it('saving as .asm warns about a message the text form cannot keep, after the download', async () => {
    const store = new AppStore();
    // As an .smp can hold it: the message keeps its trailing space.
    store.mem.set(0, '42000', `aa';"; `);
    const expected = disassembleWithWarnings(store.mem.entries()).warnings;
    expect(expected).toHaveLength(1);
    store.saveAs('p', 'asm');
    expect(vi.mocked(downloadBytes).mock.calls.at(-1)?.[0]).toBe('p.asm');
    expect(store.state.fileName).toBe('p.asm');
    expect(boxTitle(store)).toBe(DIALOG_TEXTS.advertencia);
    expect(store.state.messageBox?.message).toBe(expected[0].message);
    store.answer(S.buttons.aceptar);
    store.saveAs('p', 'smp');
    expect(store.state.messageBox).toBeNull();
  });

  it('the error list title counts the errors like the question before it', async () => {
    for (const [source, title] of [
      ['XYZ\nHLT', '1 Error Encontrado'],
      ['XYZ\nABC\nHLT', '2 Errores Encontrados'],
    ] as const) {
      const store = new AppStore();
      const open = store.openFile(new File([source], 'e.asm'));
      await until(() => store.state.messageBox !== null);
      expect(store.state.messageBox?.message).toBe(`${title}!! Desea ver los Errores?`);
      store.answer(S.buttons.si);
      await open;
      expect(store.state.windows.errorList?.title).toBe(title);
    }
  });

  it('the Editor 2 text of an opened file uses \\n line endings only', async () => {
    const store = new AppStore();
    await store.editorOpenFile(new File(['MOV AX,1\rHLT\r'], 'cr.asm'));
    expect(store.state.editor.text).toBe('MOV AX,1\nHLT\n');
    await store.openFile(new File(['INC AX\r\nHLT\r\n'], 'crlf.asm'));
    expect(store.state.editor.text).toBe('INC AX\nHLT\n');
  });
});

describe('AppStore: a modified program', () => {
  const NOP = ISA_BY_MNEMONIC.get('NOP')!.code;

  it('Salir asks "Desea Guardarlo??" and Cancelar keeps the program', async () => {
    const store = new AppStore();
    expect(store.manualAdd(NOP, '', '')).toBeNull();
    const salir = store.salir();
    expect(store.state.messageBox?.title).toBe(DIALOG_TEXTS.cambiadoTitulo);
    expect(store.state.messageBox?.message).toBe(DIALOG_TEXTS.cambiado);
    store.answer(S.buttons.cancelar);
    await salir;
    expect(store.state.messageBox).toBeNull();
    expect(store.state.modified).toBe(true);
    expect(store.mem.usedCells()).toBe(1);
  });

  it('Salir with Sí saves the program first', async () => {
    const store = new AppStore();
    await store.openFile(new File(['NOP\nHLT'], 'p.asm'));
    expect(store.modifyMemory('5', 'NOP')).toBeNull();
    const salir = store.salir();
    store.answer(S.buttons.si);
    await until(() => boxTitle(store) === S.appName);
    expect(vi.mocked(downloadBytes).mock.calls.at(-1)?.[0]).toBe('p.asm');
    expect(store.state.modified).toBe(false);
    expect(store.state.messageBox?.title).toBe(S.appName);
    store.answer(S.buttons.aceptar);
    await salir;
  });

  it('closing the page is guarded only while the program is modified', () => {
    const store = new AppStore();
    const unload = () => {
      const e = new Event('beforeunload', { cancelable: true });
      store.onBeforeUnload(e);
      return e.defaultPrevented;
    };
    expect(unload()).toBe(false);
    expect(store.manualAdd(NOP, '', '')).toBeNull();
    expect(unload()).toBe(true);
    store.saveAs('p.smp', 'smp');
    expect(unload()).toBe(false);
  });
});

describe('AppStore: Configurar and the memory view', () => {
  it('Aceptar in Configurar keeps the Cod toggle', () => {
    const store = new AppStore();
    store.toggleShowCode();
    expect(store.state.showCode).toBe(true);
    expect(store.state.config.showInstructions).toBe(false);
    store.setConfig({ ...store.state.config, monitorLines: 500 });
    expect(store.state.showCode).toBe(true);
    store.setConfig({ ...store.state.config, showInstructions: true });
    expect(store.state.showCode).toBe(false);
  });

  it('a highlight colour only changes the state; the page colours belong to the UI', () => {
    const touched: string[] = [];
    const style = {
      setProperty: (k: string) => void touched.push(k),
      removeProperty: (k: string) => void touched.push(k),
    };
    vi.stubGlobal('document', { documentElement: { style } });
    const store = new AppStore();
    store.setConfig({ readColor: '#123456', writeColor: '#654321' });
    expect(store.state.config.readColor).toBe('#123456');
    expect(store.state.config.writeColor).toBe('#654321');
    expect(touched).toEqual([]);
  });
});

describe('AppStore: PC Speaker', () => {
  it('stopping or replacing the program silences the queued notes', async () => {
    const store = await makeStore('LDT\nHLT');
    vi.mocked(silenceSpeaker).mockClear();
    store.run();
    expect(store.runner.state).toBe('waiting');
    const reiniciar = store.reiniciarRegistros();
    store.answer(S.buttons.si);
    await reiniciar;
    expect(silenceSpeaker).toHaveBeenCalledTimes(1);
    await store.openFile(new File(['HLT'], 'b.asm'));
    expect(silenceSpeaker).toHaveBeenCalledTimes(2);
  });
});
