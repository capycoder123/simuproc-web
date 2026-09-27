import { useSyncExternalStore } from 'react';
import {
  ASM_HEADER,
  Cpu,
  ISA_BY_CODE,
  MANUAL_TEXTS,
  MAX_ADDR,
  DIALOG_TEXTS,
  END_TEXTS,
  Memory,
  Runner,
  STATUS,
  SimplePorts,
  SmpFormatError,
  assemble,
  bin16,
  buildManualCell,
  cellFromParsed,
  decodeProgramBytes,
  disassembleWithWarnings,
  encodeAsmFile,
  encodeSmpFile,
  hex3,
  memoryToRows,
  normalizeLineEndings,
  parseAddress,
  parseBinaryWord,
  parseKeyboardInput,
  parseSmp,
  parseSourceLine,
  rowsToCells,
  rowsToText,
  serializeSmp,
  systemClock,
  textToRows,
  validateManualAddress,
  type AsmError,
  type AsmWarning,
  type Cell,
  type Editor1Row,
  type ErrorDecision,
  type FlagName,
  type InputRequest,
  type Keyboard,
  type KeyboardMode,
  type RunnerState,
  type RuntimeErrorInfo,
  type Screen,
  type SmpHeader,
  type StepTrace,
} from '../core';
import { findExample, type ExampleGroupId } from '../ejemplos';
import { silenceSpeaker } from '../platform/audio';
import { downloadBytes, fileExtension, normalizeSaveName, readFileBytes } from '../platform/files';
import { APP_NAME, BUTTONS, MODIFY_TEXTS } from './texts';

/** Delay per animated instruction for each position of the speed slider (Min .. Max). */
export const SPEED_DELAYS = [2000, 1000, 500, 250, 120, 60, 30, 15, 5, 1, 0];

export interface Config {
  animation: boolean;
  speed: number;
  autoscrollInstr: boolean;
  autoscrollVars: boolean;
  monitorLines: number;
  floatDecimals: number;
  stripZeros: boolean;
  editMemoryDirectly: boolean;
  ignoreUnknownOpcodes: boolean;
  resetStats: boolean;
  showInstructions: boolean;
  readColor: string;
  writeColor: string;
  showStatsAfterRun: boolean;
}

export const DEFAULT_CONFIG: Config = {
  animation: true,
  speed: 3,
  autoscrollInstr: true,
  autoscrollVars: true,
  monitorLines: 5000,
  floatDecimals: 4,
  stripZeros: true,
  editMemoryDirectly: false,
  ignoreUnknownOpcodes: false,
  resetStats: true,
  showInstructions: true,
  readColor: '#ffe38a',
  writeColor: '#ffb1a4',
  showStatsAfterRun: false,
};

/** One of the six positions of "Vigilante de Memoria". */
export interface WatchEntry {
  enabled: boolean;
  addrText: string;
  addr: number | null;
  last: string | null;
  history: string[];
  pauseOnChange: boolean;
  pauseIfEqual: boolean;
  compareText: string;
  wasEqual: boolean;
}

export function emptyWatch(): WatchEntry {
  return { enabled: false, addrText: '', addr: null, last: null, history: [], pauseOnChange: false, pauseIfEqual: false, compareText: '', wasEqual: false };
}

/** Value of a cell as the watch window shows it. */
export function watchDisplay(text: string): string {
  if (text === '') return '0000000000000000';
  const word = parseBinaryWord(text);
  return word !== null ? bin16(word) : text;
}

function watchNumeric(text: string): number | null {
  if (text === '') return 0;
  return parseBinaryWord(text);
}

/** Value of "Pausar solo si el Valor es =": binary like the cells, or decimal with a 'd' suffix. */
function parseCompare(text: string): number | null {
  const t = text.trim();
  const word = parseBinaryWord(t);
  if (word !== null) return word;
  const dec = /^(\d{1,5})d$/i.exec(t);
  if (dec) return Number(dec[1]);
  if (/^\d{1,5}$/.test(t)) return Number(t);
  return null;
}

/** Largest program file that Abrir and Cargar read; far above any real program of 4096 cells. */
export const MAX_PROGRAM_FILE_BYTES = 1024 * 1024;

export const STATS_TEXTS = {
  finished: 'El Programa en Memoria\nha terminado su ejecución con éxito, estas son las estadísticas del programa:',
  interrupted: 'El Programa en Memoria\nha sido interrumpido, estas son las estadísticas del programa:',
  none: 'El Programa en Memoria\nmostrará acá sus estadistícas después o durante su ejecución.',
} as const;

export interface MessageBoxState {
  title: string;
  message: string;
  buttons: string[];
  resolve: (choice: string) => void;
}

export interface EditorState {
  tab: 'editor1' | 'editor2';
  rows: Editor1Row[];
  text: string;
  errors: AsmError[];
  warnings: AsmWarning[];
}

export interface ErrorListState {
  title: string;
  items: string[];
}

export interface WindowsState {
  devices: boolean;
  editor: boolean;
  modifyMemory: boolean;
  help: boolean;
  about: boolean;
  saveAs: boolean;
  portHelp: number | null;
  errorList: ErrorListState | null;
  bases: boolean;
  manual: boolean;
  stats: boolean;
  watch: boolean;
  switches: boolean;
  config: boolean;
}

export interface UiState {
  tick: number;
  runState: RunnerState;
  inputRequest: InputRequest | null;
  inputError: string | null;
  inputStatus: string | null;
  keyboardMode: 'decimal' | 'binario';
  status: string;
  modified: boolean;
  fileName: string | null;
  config: Config;
  windows: WindowsState;
  messageBox: MessageBoxState | null;
  editor: EditorState;
  showCode: boolean;
  monitorScroll: boolean;
  modifyAddr: string | null;
  switches: number;
  watches: WatchEntry[];
  manual: { nextAddr: number; added: number[] };
  statsHeader: string;
  /** Floating windows from back to front. */
  windowOrder: FloatingWindow[];
}

export type FloatingWindow = 'devices' | 'editor' | 'manual' | 'stats' | 'watch' | 'switches';
const FLOATING: readonly FloatingWindow[] = ['devices', 'editor', 'manual', 'stats', 'watch', 'switches'];

const INITIAL_STATE: UiState = {
  tick: 0,
  runState: 'idle',
  inputRequest: null,
  inputError: null,
  inputStatus: null,
  keyboardMode: 'decimal',
  status: STATUS.sinPrograma,
  modified: false,
  fileName: null,
  config: DEFAULT_CONFIG,
  windows: {
    devices: false,
    editor: false,
    modifyMemory: false,
    help: false,
    about: false,
    saveAs: false,
    portHelp: null,
    errorList: null,
    bases: false,
    manual: false,
    stats: false,
    watch: false,
    switches: false,
    config: false,
  },
  messageBox: null,
  editor: { tab: 'editor2', rows: [], text: '', errors: [], warnings: [] },
  showCode: false,
  monitorScroll: true,
  modifyAddr: null,
  switches: 0,
  watches: Array.from({ length: 6 }, () => emptyWatch()),
  manual: { nextAddr: 0, added: [] },
  statsHeader: '',
  windowOrder: [...FLOATING],
};

interface InputResolver {
  resolve: (value: number) => void;
  reject: (error: Error) => void;
  mode: KeyboardMode;
}

/** Application store: owns the CPU, the memory and the runner; exposes an immutable UI state. */
export class AppStore {
  readonly mem = new Memory();
  readonly cpu: Cpu;
  readonly runner: Runner;
  readonly ports = new SimplePorts();
  /** Monitor lines of "Dispositivos de E/S" (mutable, read through the tick). */
  readonly monitor: string[] = [];
  lastValue: { decimal: string; binary: string } | null = null;
  smpHeader: SmpHeader | null = null;
  /** Accesses of the last step for the highlights. */
  readonly highlight: StepTrace = { reads: [], writes: [], regs: [] };
  private readonly listeners = new Set<() => void>();
  private current: UiState = INITIAL_STATE;
  private inputResolver: InputResolver | null = null;
  private runStartedAt: number | null = null;
  private runAccumMs = 0;
  private watchActive = false;
  private pendingWatchEvent: { index: number; kind: 'change' | 'equal'; from: string; to: string } | null = null;
  /** True while a "Paso a paso" cycle runs: a watch pause then must not resume the simulation. */
  private stepping = false;
  /** The message box shown first, then the ones waiting. */
  private readonly boxQueue: MessageBoxState[] = [];
  /** Changes when a run is abandoned, so an answer that arrives later leaves the new state alone. */
  private session = 0;

  constructor() {
    const keyboard: Keyboard = {
      read: (prompt, mode) => this.keyboardRead(prompt, mode),
      cancel: () => this.keyboardCancel(),
    };
    const screen: Screen = {
      write: (line) => this.screenWrite(line),
      setLastValue: (decimal, binary) => {
        this.lastValue = { decimal, binary };
      },
    };
    this.cpu = new Cpu(this.mem, { keyboard, screen, ports: this.ports, clock: systemClock });
    this.runner = new Runner(this.cpu, this.cpu.devices, {
      getAnimation: () => this.current.config.animation,
      getDelayMs: () => SPEED_DELAYS[this.current.config.speed] ?? 0,
      onUpdate: () => this.onRunnerUpdate(),
      onStateChange: (s) => this.onRunState(s),
      onHalt: () => this.onHalt(),
      onError: (e) => this.onRuntimeError(e),
      onInput: (req) => this.onInputRequest(req),
      afterStep: () => this.checkWatches(),
    });
  }

  private onHalt(): void {
    this.set({
      status: `${END_TEXTS.terminado} ${END_TEXTS.completa}`,
      statsHeader: STATS_TEXTS.finished,
      windows: this.current.config.showStatsAfterRun ? { ...this.current.windows, stats: true } : this.current.windows,
    });
  }

  /** Milliseconds spent in the running state since the statistics were reset. */
  elapsedMs(): number {
    return this.runAccumMs + (this.runStartedAt !== null ? performance.now() - this.runStartedAt : 0);
  }

  private resetStatistics(): void {
    this.cpu.resetStats();
    this.runAccumMs = 0;
    this.runStartedAt = this.runner.state === 'running' ? performance.now() : null;
    this.set({ statsHeader: '' });
  }

  // ----- subscription -----

  get state(): UiState {
    return this.current;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(partial: Partial<UiState>): void {
    this.current = { ...this.current, ...partial };
    for (const l of this.listeners) l();
  }

  bump(): void {
    this.set({ tick: this.current.tick + 1 });
  }

  private setWindows(partial: Partial<WindowsState>): void {
    this.set({ windows: { ...this.current.windows, ...partial } });
  }

  setWindow<K extends keyof WindowsState>(name: K, value: WindowsState[K]): void {
    this.setWindows({ [name]: value } as Partial<WindowsState>);
    if (value === true && (FLOATING as readonly string[]).includes(name)) this.raiseWindow(name as FloatingWindow);
  }

  /** Brings a floating window to the front. */
  raiseWindow(name: FloatingWindow): void {
    const order = this.current.windowOrder;
    if (order[order.length - 1] === name) return;
    this.set({ windowOrder: [...order.filter((w) => w !== name), name] });
  }

  private setEditor(partial: Partial<EditorState>): void {
    this.set({ editor: { ...this.current.editor, ...partial } });
  }

  // ----- dialogs -----

  /** Questions wait their turn: the runner and the menus can ask at the same time. */
  ask(title: string, message: string, buttons: string[]): Promise<string> {
    return new Promise((resolve) => {
      this.boxQueue.push({ title, message, buttons, resolve });
      if (!this.current.messageBox) this.set({ messageBox: this.boxQueue[0] });
    });
  }

  answer(choice: string): void {
    const box = this.current.messageBox;
    if (!box) return;
    this.boxQueue.shift();
    this.set({ messageBox: this.boxQueue[0] ?? null });
    box.resolve(choice);
  }

  alert(title: string, message: string): Promise<void> {
    return this.ask(title, message, [BUTTONS.aceptar]).then(() => undefined);
  }

  async confirm(title: string, message: string): Promise<boolean> {
    return (await this.ask(title, message, [BUTTONS.si, BUTTONS.no])) === BUTTONS.si;
  }

  // ----- devices -----

  private keyboardRead(_prompt: string, mode: KeyboardMode): Promise<number> {
    return new Promise((resolve, reject) => {
      this.inputResolver = { resolve, reject, mode };
    });
  }

  private keyboardCancel(): void {
    const r = this.inputResolver;
    this.inputResolver = null;
    r?.reject(new Error('Entrada cancelada'));
  }

  private screenWrite(line: string): void {
    this.monitor.push(line);
    const cap = Math.max(2, this.current.config.monitorLines);
    if (this.monitor.length > cap) this.monitor.splice(0, this.monitor.length - cap);
  }

  private onInputRequest(req: InputRequest | null): void {
    this.set({
      inputRequest: req,
      inputError: null,
      windows: req ? { ...this.current.windows, devices: true } : this.current.windows,
    });
    if (req) this.raiseWindow('devices');
  }

  /** "Entrar Dato" of the E/S window. */
  submitInput(text: string): void {
    const r = this.inputResolver;
    if (!r) {
      this.set({ inputError: null, inputStatus: DIALOG_TEXTS.entradaNoPedida });
      return;
    }
    const mode: KeyboardMode = r.mode === 'float' ? 'float' : this.current.keyboardMode;
    const parsed = parseKeyboardInput(text, mode);
    if (!parsed.ok) {
      this.set({ inputError: parsed.message, inputStatus: null });
      return;
    }
    this.inputResolver = null;
    this.set({ inputError: null, inputStatus: DIALOG_TEXTS.ultimoDatoLeido(text.trim()) });
    r.resolve(parsed.value);
  }

  setKeyboardMode(mode: 'decimal' | 'binario'): void {
    this.set({ keyboardMode: mode, inputError: null });
  }

  clearMonitor(): void {
    this.monitor.length = 0;
    this.lastValue = null;
    this.bump();
  }

  toggleMonitorScroll(): void {
    this.set({ monitorScroll: !this.current.monitorScroll });
  }

  // ----- runner hooks -----

  private onRunnerUpdate(): void {
    const h = this.highlight;
    if (this.current.config.animation) {
      h.reads = [...this.cpu.trace.reads];
      h.writes = [...this.cpu.trace.writes];
      h.regs = [...this.cpu.trace.regs];
    } else {
      this.clearHighlight();
    }
    this.bump();
  }

  private clearHighlight(): void {
    this.highlight.reads = [];
    this.highlight.writes = [];
    this.highlight.regs = [];
  }

  /** Opens or closes the "Duración" stopwatch: only the running state counts. */
  private updateStopwatch(running: boolean): void {
    if (running && this.runStartedAt === null) this.runStartedAt = performance.now();
    if (!running && this.runStartedAt !== null) {
      this.runAccumMs += performance.now() - this.runStartedAt;
      this.runStartedAt = null;
    }
  }

  private runningStatus(): string {
    return this.current.config.animation ? STATUS.simulando : STATUS.sinAnimacion;
  }

  private onRunState(s: RunnerState): void {
    this.updateStopwatch(s === 'running');
    // A watch pause the runner had not applied yet dies with the run.
    if (s === 'idle') this.pendingWatchEvent = null;
    let status = this.current.status;
    if (s === 'running' || s === 'waiting') status = this.runningStatus();
    else if (s === 'paused') status = this.pendingWatchEvent ? STATUS.vigilantePausa : 'Simulación en Pausa.';
    else if (this.cpu.status !== 'halted') status = STATUS.detenida;
    this.set({ runState: s, status });
    if (s === 'paused' && this.pendingWatchEvent) void this.handleWatchEvent();
  }

  // ----- "Vigilante de Memoria" -----

  setWatch(index: number, patch: Partial<WatchEntry>): void {
    const watches = this.current.watches.map((w, i) => (i === index ? { ...w, ...patch } : w));
    const w = watches[index];
    if (patch.addrText !== undefined) {
      const a = parseAddress(patch.addrText)?.addr ?? null;
      watches[index] = { ...w, addr: a, last: a !== null ? watchDisplay(this.mem.cells[a].text) : null, history: [], wasEqual: false };
    }
    // A disabled position does not follow its cell, so enabling it starts from the current value.
    if (patch.enabled && !this.current.watches[index].enabled) watches[index] = this.watchBaseline(watches[index]);
    this.watchActive = watches.some((x) => x.enabled && x.addr !== null);
    this.set({ watches });
  }

  /** The current value of the watched cell as the reference for the next change or equality. */
  private watchBaseline(w: WatchEntry): WatchEntry {
    if (w.addr === null) return w;
    const text = this.mem.cells[w.addr].text;
    const cmp = parseCompare(w.compareText);
    return { ...w, last: watchDisplay(text), wasEqual: cmp !== null && cmp === watchNumeric(text) };
  }

  clearWatchHistory(index: number): void {
    this.setWatch(index, { history: [], last: this.current.watches[index].addr !== null ? watchDisplay(this.mem.cells[this.current.watches[index].addr as number].text) : null });
  }

  /** Runs after every executed instruction; returns true to pause the simulation. */
  private checkWatches(): boolean {
    if (!this.watchActive) return false;
    const watches = this.current.watches;
    let next: WatchEntry[] | null = null;
    let pause = false;
    for (let i = 0; i < watches.length; i++) {
      const w = watches[i];
      if (!w.enabled || w.addr === null) continue;
      const text = this.mem.cells[w.addr].text;
      const shown = watchDisplay(text);
      let updated = w;
      if (w.last !== shown) {
        const history = (w.last !== null ? [w.last, ...w.history] : w.history).slice(0, 5);
        updated = { ...updated, last: shown, history };
        if (w.pauseOnChange && !this.pendingWatchEvent && w.last !== null) {
          this.pendingWatchEvent = { index: i, kind: 'change', from: w.last, to: shown };
          pause = true;
        }
      }
      if (w.pauseIfEqual) {
        const cmp = parseCompare(w.compareText);
        const equal = cmp !== null && cmp === watchNumeric(text);
        if (equal && !w.wasEqual && !this.pendingWatchEvent) {
          this.pendingWatchEvent = { index: i, kind: 'equal', from: '', to: shown };
          pause = true;
        }
        if (equal !== w.wasEqual) updated = { ...updated, wasEqual: equal };
      }
      if (updated !== w) {
        if (!next) next = [...watches];
        next[i] = updated;
      }
    }
    if (next) this.set({ watches: next });
    return pause;
  }

  private async handleWatchEvent(): Promise<void> {
    const ev = this.pendingWatchEvent;
    if (!ev) return;
    const resume = !this.stepping;
    const w = this.current.watches[ev.index];
    const dir = w.addr !== null ? hex3(w.addr) : '???';
    this.setWindows({ watch: true });
    const message =
      ev.kind === 'change'
        ? `El contenido de la dirección ${dir}, ha cambiado de ${ev.from} a ${ev.to}\n\n¿Qué desea hacer?\nSi: Continuar la Simulación pausando si este valor vuelve a cambiar.\nNo: si Continuar la Simulación pero no pausa mas si este valor cambia.\nCancelar: No continuar con la simulación.`
        : `El contenido de la dirección ${dir}, es IGUAL al valor ${w.compareText.trim()} especificado por ud en la Posición de Vigilancia "${ev.index + 1}"\n\n¿Qué desea hacer?\nSi: Continuar la Simulación pausando si este valor vuelve a ser igual al especificado.\nNo: Si Continuar la Simulación pero sin pausar por comparar este valor.\nCancelar: No continuar con la simulación.`;
    const session = this.session;
    const choice = await this.ask(STATUS.vigilantePausa, message, [BUTTONS.si, BUTTONS.no, BUTTONS.cancelar]);
    if (session !== this.session) return;
    this.pendingWatchEvent = null;
    if (choice === BUTTONS.cancelar) {
      this.stopManually();
      return;
    }
    if (choice === BUTTONS.no) this.setWatch(ev.index, ev.kind === 'change' ? { pauseOnChange: false } : { pauseIfEqual: false });
    if (resume && this.runner.state === 'paused') void this.runner.run();
  }

  private async onRuntimeError(e: RuntimeErrorInfo): Promise<ErrorDecision> {
    this.set({ status: `${STATUS.error} ${e.summary}` });
    // The time the question stays open is not simulation time.
    this.updateStopwatch(false);
    const session = this.session;
    if (e.kind === 'fatal') {
      await this.alert(e.title, e.message);
      if (session === this.session) this.set({ status: STATUS.detenida });
      return 'stop';
    }
    const choice = await this.ask(e.title, `${e.message}\n\n${e.question}`, [BUTTONS.si, BUTTONS.no]);
    // Answered after Nuevo, a load or a manual stop: that run is gone.
    if (session !== this.session) return 'stop';
    const yes = choice === BUTTONS.si;
    if (e.kind === 'ignore') {
      if (yes) {
        this.set({ status: this.runningStatus() });
        this.updateStopwatch(this.runner.state === 'running');
        return 'continue';
      }
      this.set({ status: STATUS.detenida });
      return 'stop';
    }
    if (yes) return 'pause';
    this.set({ status: this.runningStatus() });
    this.updateStopwatch(this.runner.state === 'running');
    return 'continue';
  }

  // ----- simulation control -----

  run(): void {
    if (this.runner.state === 'paused') {
      void this.runner.run();
      return;
    }
    if (this.runner.state !== 'idle') return;
    if (!this.prepareStart()) return;
    void this.runner.run();
  }

  pause(): void {
    this.runner.pause();
  }

  stepOnce(): void {
    if (this.runner.state === 'running' || this.runner.state === 'waiting') return;
    if (!this.prepareStart()) return;
    this.stepping = true;
    void this.runner.stepOnce().finally(() => {
      this.stepping = false;
    });
  }

  /**
   * Shared start of Ejecutar and Paso a paso: alerts when memory is empty, rewinds a finished
   * program and resets the statistics when it starts from 000. Returns false if nothing can run.
   * With the runner idle the CPU is always 'stopped' after the rewind; the status check only
   * matters for a step from a paused run, whose CPU stays 'running'.
   */
  private prepareStart(): boolean {
    if (this.mem.usedCells() === 0) {
      void this.alert(DIALOG_TEXTS.sinProgramaTitulo, DIALOG_TEXTS.sinPrograma);
      return false;
    }
    if (this.cpu.status === 'halted' || this.cpu.status === 'error') this.cpu.resetRegisters();
    if (this.cpu.regs.PC === 0 && this.cpu.status === 'stopped' && this.current.config.resetStats) this.resetStatistics();
    return true;
  }

  /** Stops a running simulation with the original's manual-termination texts. */
  private stopManually(): void {
    if (this.runner.state === 'idle') return;
    this.runner.stop();
    this.session++;
    silenceSpeaker();
    this.pendingWatchEvent = null;
    this.cpu.log.push(END_TEXTS.manual);
    this.cpu.log.push(END_TEXTS.incompleta);
    this.cpu.resetRegisters();
    this.clearHighlight();
    this.set({ status: `${END_TEXTS.manual} ${END_TEXTS.incompleta}`, statsHeader: STATS_TEXTS.interrupted, inputRequest: null, inputError: null });
    this.bump();
  }

  async reiniciarRegistros(): Promise<void> {
    if (this.runner.state !== 'idle') {
      if (!(await this.confirm(DIALOG_TEXTS.reiniciarTitulo, DIALOG_TEXTS.reiniciar))) return;
      this.stopManually();
    }
    this.cpu.resetRegisters();
    this.clearHighlight();
    this.bump();
  }

  async nuevoPrograma(): Promise<void> {
    if (!(await this.confirm(DIALOG_TEXTS.nuevoTitulo, DIALOG_TEXTS.nuevo))) return;
    this.monitor.length = 0;
    this.lastValue = null;
    this.resetProgramState(null, { fileName: null, header: null, modified: false, status: STATUS.sinPrograma });
  }

  toggleFlag(flag: FlagName): void {
    this.cpu.flags[flag] = this.cpu.flags[flag] === 1 ? 0 : 1;
    this.bump();
  }

  setFlag(flag: FlagName, value: 0 | 1): void {
    this.cpu.flags[flag] = value;
    this.bump();
  }

  setConfig(partial: Partial<Config>): void {
    const config = { ...this.current.config, ...partial };
    this.cpu.options.ignoreUnknownOpcodes = config.ignoreUnknownOpcodes;
    this.cpu.options.floatDecimals = config.floatDecimals;
    this.cpu.options.stripTrailingZeros = config.stripZeros;
    this.cpu.animation = config.animation;
    let status = this.current.status;
    if (this.runner.state === 'running') status = config.animation ? STATUS.simulando : STATUS.sinAnimacion;
    // Configurar sends the whole config: only a real change of the option moves the memory view.
    const showCode = config.showInstructions !== this.current.config.showInstructions ? !config.showInstructions : this.current.showCode;
    this.set({ config, status, showCode });
  }

  // ----- "Switches - Puerto 9" -----

  setSwitches(value: number): void {
    const v = value & 0xffff;
    this.ports.switches = v;
    this.set({ switches: v });
  }

  toggleSwitchBit(bit: number): void {
    this.setSwitches(this.current.switches ^ (1 << bit));
  }

  // ----- "Entrada de Instrucciones Manualmente" -----

  manualSetAddress(text: string): string | null {
    const r = validateManualAddress(text);
    if (!r.ok) return r.message;
    this.set({ manual: { ...this.current.manual, nextAddr: r.addr } });
    return null;
  }

  /** "Ok": stores the instruction at the next address. Returns an error message or null. */
  manualAdd(code: number | null, operands: string, comment: string): string | null {
    const def = code === null ? undefined : ISA_BY_CODE.get(code);
    if (!def) return MANUAL_TEXTS.seleccione;
    const addr = this.current.manual.nextAddr;
    if (addr > MAX_ADDR) {
      this.set({ status: MANUAL_TEXTS.memoriaLlena });
      return MANUAL_TEXTS.memoriaLlena;
    }
    const r = buildManualCell(def, operands, comment);
    if (!r.ok) return r.message;
    this.mem.set(addr, r.cell.text, r.cell.comment, r.cell.origin);
    this.set({
      manual: { nextAddr: addr + 1, added: [...this.current.manual.added, addr] },
      status: `${MANUAL_TEXTS.anadida}${r.text}`,
      modified: true,
    });
    this.bump();
    return null;
  }

  /** "Borrar": removes the last instruction added manually. */
  manualDelete(): string | null {
    const added = this.current.manual.added;
    if (added.length === 0) return MANUAL_TEXTS.e22;
    const addr = added[added.length - 1];
    this.mem.clearCell(addr);
    this.set({ manual: { nextAddr: addr, added: added.slice(0, -1) }, status: MANUAL_TEXTS.borrada, modified: true });
    this.bump();
    return null;
  }

  openModify(addr: number | null): void {
    this.set({ modifyAddr: addr !== null ? hex3(addr) : null, windows: { ...this.current.windows, modifyMemory: true } });
  }

  /** The Cod button and "Mostrar Instrucción" of Configurar are the same option. */
  toggleShowCode(): void {
    const showCode = !this.current.showCode;
    this.set({ showCode, config: { ...this.current.config, showInstructions: !showCode } });
  }

  // ----- programs in memory -----

  private async ensureIdle(): Promise<boolean> {
    if (this.runner.state === 'idle') return true;
    if (!(await this.confirm(APP_NAME, DIALOG_TEXTS.detenerParaAbrir))) return false;
    this.stopManually();
    return true;
  }

  private loadCells(cells: Map<number, Cell>, opts: { fileName: string | null; header: SmpHeader | null; modified?: boolean }): void {
    this.resetProgramState(cells, { fileName: opts.fileName, header: opts.header, modified: opts.modified ?? false, status: STATUS.cargado });
  }

  /**
   * Replaces the program in memory (null clears it) and resets everything tied to the old one:
   * the run, the registers, the statistics, the highlights, the manual-entry additions and the
   * values the "Vigilante de Memoria" compares against.
   */
  private resetProgramState(
    cells: Map<number, Cell> | null,
    opts: { fileName: string | null; header: SmpHeader | null; modified: boolean; status: string },
  ): void {
    this.runner.stop();
    this.session++;
    silenceSpeaker();
    if (cells) this.mem.load(cells);
    else this.mem.clear();
    this.cpu.resetAll();
    this.resetStatistics();
    this.smpHeader = opts.header;
    this.clearHighlight();
    this.set({
      fileName: opts.fileName,
      modified: opts.modified,
      status: opts.status,
      inputRequest: null,
      inputError: null,
      manual: { nextAddr: 0, added: [] },
      watches: this.current.watches.map((w) => this.watchBaseline(w)),
    });
    this.bump();
  }

  /** Text of a program file with '\n' line endings, or null (already reported) if it cannot be read. */
  private async readProgramFile(file: File): Promise<string | null> {
    // A file far larger than any program is not read at all.
    if (file.size > MAX_PROGRAM_FILE_BYTES) return this.rejectFile(file);
    let bytes: Uint8Array;
    try {
      bytes = await readFileBytes(file);
    } catch {
      return this.rejectFile(file);
    }
    return normalizeLineEndings(decodeProgramBytes(bytes).text, '\n');
  }

  private async rejectFile(file: File): Promise<null> {
    this.set({ status: STATUS.errorAbrir + file.name });
    await this.alert(DIALOG_TEXTS.cambiadoTitulo, DIALOG_TEXTS.archivoNoValido);
    return null;
  }

  async openFile(file: File): Promise<void> {
    if (!(await this.ensureIdle())) return;
    const text = await this.readProgramFile(file);
    if (text === null) return;
    // An .smp document always starts with "SimuProc" and Editor 2 text never does ("#SimuProc"),
    // so the content decides when the extension does not match the format.
    if (fileExtension(file.name) === 'smp' || text.startsWith('SimuProc')) {
      try {
        const doc = parseSmp(text);
        this.loadCells(doc.cells, { fileName: file.name, header: doc.header });
        this.setEditor({ rows: memoryToRows(this.mem.entries()), errors: [], warnings: [] });
        this.set({ status: STATUS.abierto + file.name });
      } catch (e) {
        this.set({ status: STATUS.errorAbrir + file.name });
        // Only the format errors carry a text for the user; anything else is not a raw message to show.
        await this.alert(DIALOG_TEXTS.cambiadoTitulo, e instanceof SmpFormatError ? e.message : DIALOG_TEXTS.archivoNoValido);
      }
      return;
    }
    const asm = assemble(text);
    this.setEditor({ text, tab: 'editor2', errors: asm.errors, warnings: asm.warnings });
    if (asm.errors.length > 0) {
      this.setWindows({ editor: true });
      this.set({ status: STATUS.errorAbrir + file.name });
      await this.showAsmErrors(asm.errors);
      return;
    }
    this.loadCells(asm.cells, { fileName: file.name, header: null });
    this.setEditor({ rows: memoryToRows(this.mem.entries()) });
    this.set({ status: STATUS.abierto + file.name });
  }

  save(saveAs: boolean): void {
    if (this.mem.usedCells() === 0) {
      void this.alert(DIALOG_TEXTS.cambiadoTitulo, DIALOG_TEXTS.nadaQueGrabar);
      return;
    }
    const name = this.current.fileName;
    if (saveAs || !name) {
      this.setWindows({ saveAs: true });
      return;
    }
    const ext = fileExtension(name);
    this.saveAs(name, ext === 'asm' || ext === 'txt' ? 'asm' : 'smp');
  }

  saveAs(typedName: string, format: 'smp' | 'asm'): void {
    const name = normalizeSaveName(typedName, format);
    let bytes: Uint8Array;
    let warnings: AsmWarning[] = [];
    if (format === 'smp') {
      bytes = encodeSmpFile(serializeSmp(this.mem.cells, this.smpHeader ?? undefined));
    } else {
      const asm = disassembleWithWarnings(this.mem.entries());
      bytes = encodeAsmFile(asm.text);
      warnings = asm.warnings;
    }
    downloadBytes(name, bytes);
    this.set({ fileName: name, modified: false, status: STATUS.guardado + name, windows: { ...this.current.windows, saveAs: false } });
    // The file is saved first; the warning then says which messages the .asm could not keep.
    if (warnings.length > 0) void this.alert(DIALOG_TEXTS.advertencia, warnings.map((w) => w.message).join('\n'));
  }

  // ----- "Modificar una Posición de Memoria" -----

  modifyMemory(addrText: string, valueText: string): string | null {
    if (addrText.trim() === '') return MODIFY_TEXTS.indique;
    const a = parseAddress(addrText);
    if (!a) return MODIFY_TEXTS.badDir;
    const v = valueText.trim();
    const comment = this.mem.get(a.addr).comment;
    if (v === '') {
      this.mem.clearCell(a.addr);
    } else {
      const p = parseSourceLine(v, true);
      if (p.kind === 'error') {
        this.mem.set(a.addr, v, comment);
      } else {
        const cell = cellFromParsed(p, comment);
        // MSG keeps its message in the comment: without a new message the cell's comment stays, and
        // with neither it is rejected like in the manual entry, so a saved .asm always reopens.
        const noMessage = p.kind === 'instr' && p.def.code === 42 && cell.comment.trim() === '';
        if (noMessage && comment.trim() === '') return MANUAL_TEXTS.mensajeVacio;
        this.mem.set(a.addr, cell.text, noMessage ? comment : cell.comment, cell.origin);
      }
    }
    this.set({ modified: true });
    this.bump();
    return null;
  }

  // ----- editor -----

  editorSetTab(tab: 'editor1' | 'editor2'): void {
    this.setEditor({ tab });
  }

  editorSetText(text: string): void {
    this.setEditor({ text });
  }

  editorSetRows(rows: Editor1Row[]): void {
    this.setEditor({ rows });
  }

  private async showAsmErrors(errors: AsmError[]): Promise<void> {
    const n = errors.length;
    if (!(await this.confirm('Error', DIALOG_TEXTS.editorErrores(n)))) return;
    this.setWindows({
      errorList: {
        title: DIALOG_TEXTS.erroresEncontrados(n),
        items: errors.map((e, i) => `Error Numero: ${i + 1} de ${n}  -  ${e.message}`),
      },
    });
  }

  async editorLoadExample(group: ExampleGroupId, name: string): Promise<void> {
    const ex = findExample(group, name);
    if (!ex) return;
    if (group === 'smp') {
      if (!(await this.ensureIdle())) return;
      const doc = parseSmp(ex.text);
      this.loadCells(doc.cells, { fileName: ex.name, header: doc.header });
      this.setEditor({ rows: memoryToRows(this.mem.entries()), tab: 'editor1', errors: [], warnings: [] });
      this.set({ status: STATUS.abierto + ex.name });
      return;
    }
    if (this.current.editor.text.trim() !== '' && !(await this.confirm(DIALOG_TEXTS.advertencia, DIALOG_TEXTS.sobrescribirEditor2))) return;
    this.setEditor({ text: ex.text, tab: 'editor2', errors: [], warnings: [] });
  }

  async editorConvertTo1(): Promise<void> {
    const { rows, errors, warnings } = textToRows(this.current.editor.text);
    if (this.current.editor.rows.length > 0 && !(await this.confirm(DIALOG_TEXTS.advertencia, DIALOG_TEXTS.sobrescribirEditor1DesdeEditor2))) return;
    this.setEditor({ rows, errors, warnings, tab: 'editor1' });
    if (errors.length > 0) await this.showAsmErrors(errors);
  }

  async editorConvertTo2(): Promise<void> {
    if (this.current.editor.text.trim() !== '' && !(await this.confirm(DIALOG_TEXTS.advertencia, DIALOG_TEXTS.sobrescribirEditor2DesdeEditor1))) return;
    this.setEditor({ text: rowsToText(this.current.editor.rows), tab: 'editor2' });
  }

  async editorFromMemory(): Promise<void> {
    if (this.mem.usedCells() === 0) {
      await this.alert(DIALOG_TEXTS.sinProgramaTitulo, DIALOG_TEXTS.sinPrograma);
      return;
    }
    if (this.current.editor.rows.length > 0 && !(await this.confirm(DIALOG_TEXTS.advertencia, DIALOG_TEXTS.sobrescribirEditor1DesdeMemoria))) return;
    this.setEditor({ rows: memoryToRows(this.mem.entries()), errors: [], warnings: [], tab: 'editor1' });
  }

  async editorSendToMemory(): Promise<void> {
    const rows = this.current.editor.rows;
    if (rows.length === 0) {
      await this.alert(DIALOG_TEXTS.advertencia, 'No hay ningún programa en el Editor 1 para enviar a la memoria.');
      return;
    }
    const { cells, errors, warnings } = rowsToCells(rows);
    if (errors.length > 0) {
      this.setEditor({ errors });
      await this.showAsmErrors(errors);
      return;
    }
    // Both questions come before any side effect, so a No to the second one keeps the run going.
    const running = this.runner.state !== 'idle';
    if (running && !(await this.confirm(APP_NAME, DIALOG_TEXTS.detenerParaAbrir))) return;
    if (this.mem.usedCells() > 0 && !(await this.confirm(DIALOG_TEXTS.advertencia, DIALOG_TEXTS.sobrescribirMemoria))) return;
    if (running) this.stopManually();
    this.loadCells(cells, { fileName: this.current.fileName, header: this.smpHeader, modified: true });
    this.setEditor({ errors: [], warnings });
    await this.alert(APP_NAME, DIALOG_TEXTS.editorRecibido);
  }

  async editorClear(which: 'editor1' | 'editor2'): Promise<void> {
    const msg = which === 'editor1' ? DIALOG_TEXTS.limpiarEditor1 : DIALOG_TEXTS.limpiarEditor2;
    if (!(await this.confirm(which === 'editor1' ? 'Editor Tipo Memoria' : 'Editor de Texto', msg))) return;
    if (which === 'editor1') this.setEditor({ rows: [], errors: [] });
    else this.setEditor({ text: '', errors: [], warnings: [] });
  }

  async editorOpenFile(file: File): Promise<void> {
    const text = await this.readProgramFile(file);
    if (text === null) return;
    if (this.current.editor.text.trim() !== '' && !(await this.confirm(DIALOG_TEXTS.advertencia, DIALOG_TEXTS.sobrescribirEditor2))) return;
    const asm = assemble(text);
    this.setEditor({ text, tab: 'editor2', errors: asm.errors, warnings: asm.warnings });
  }

  editorSaveFile(): void {
    let text = this.current.editor.text;
    if (!text.trimStart().startsWith('#SimuProc')) text = `${ASM_HEADER}\n${text}`;
    const base = this.current.fileName ? this.current.fileName.replace(/\.[^.]+$/, '') : 'programa';
    downloadBytes(`${base}.asm`, encodeAsmFile(text));
  }

  async salir(): Promise<void> {
    if (this.current.modified) {
      const choice = await this.ask(DIALOG_TEXTS.cambiadoTitulo, DIALOG_TEXTS.cambiado, [BUTTONS.si, BUTTONS.no, BUTTONS.cancelar]);
      if (choice === BUTTONS.cancelar) return;
      if (choice === BUTTONS.si) {
        this.save(false);
        // Without a file name "Guardar Como" opens instead; the program is still unsaved.
        if (this.current.modified) return;
      }
    }
    await this.alert(APP_NAME, 'SimuProc Web se ejecuta en el navegador: para salir, cierra esta pestaña.');
  }

  /** "beforeunload" handler: the browser asks before closing or reloading a modified program. */
  onBeforeUnload(e: Event): void {
    if (this.current.modified) e.preventDefault();
  }
}

export const store = new AppStore();

export function useAppState<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.state));
}

export function useTick(): number {
  return useAppState((s) => s.tick);
}
