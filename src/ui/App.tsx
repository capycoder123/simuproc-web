import { store, useAppState, type FloatingWindow } from '../state/store';
import { MenuBar, type Menu } from './MenuBar';
import { MessageBox } from './MessageBox';
import { useHighlightColors } from './highlightColors';
import { SPEAKER_MAX_HZ, SPEAKER_MIN_HZ, beep } from '../platform/audio';
import { pickFile } from '../platform/files';
import { ControlPanel } from './panels/Control';
import { GaugesPanel } from './panels/Gauges';
import { LogPanel } from './panels/LogPanel';
import { MemoryPanel } from './panels/MemoryPanel';
import { AluPanel, FlagsPanel, GeneralRegisters, ProcessorRegisters, StackPanel } from './panels/Registers';
import { StatusBar } from './panels/StatusBar';
import { S } from './strings';
import { BaseConversionDialog } from './windows/BaseConversionDialog';
import { ConfigDialog } from './windows/ConfigDialog';
import { DevicesWindow } from './windows/DevicesWindow';
import { AboutDialog, ErrorListDialog, HelpDialog, ModifyMemoryDialog, PortHelpDialog, SaveAsDialog } from './windows/Dialogs';
import { EditorWindow } from './windows/EditorWindow';
import { ManualEntryWindow } from './windows/ManualEntryWindow';
import { StatsWindow } from './windows/StatsWindow';
import { SwitchesWindow } from './windows/SwitchesWindow';
import { WatchWindow } from './windows/WatchWindow';

// Port 13 (PC Speaker): frequency from the register, duration from BX.
store.ports.onBeep = (hz, ms) => {
  if (beep(hz, ms) === 'out-of-range') store.cpu.log.push(`Puerto 13: frecuencia ${hz} Hz fuera del rango ${SPEAKER_MIN_HZ}-${SPEAKER_MAX_HZ}, no se produce sonido.`);
};

export function App() {
  useHighlightColors();
  const windows = useAppState((s) => s.windows);
  const runState = useAppState((s) => s.runState);
  const order = useAppState((s) => s.windowOrder);
  const z = (w: FloatingWindow) => 20 + order.indexOf(w);
  const focus = (w: FloatingWindow) => store.raiseWindow(w);
  const open = (w: FloatingWindow) => store.setWindow(w, true);

  const menus: Menu[] = [
    {
      id: 'archivo',
      label: S.menus.archivo,
      items: [
        { label: S.menus.nuevo, onSelect: () => void store.nuevoPrograma(), testId: 'menu-nuevo' },
        {
          label: S.menus.abrir,
          onSelect: () => {
            void pickFile('.smp,.asm,.txt').then((f) => f && store.openFile(f));
          },
          testId: 'menu-abrir',
        },
        { label: S.menus.guardar, onSelect: () => store.save(false), testId: 'menu-guardar' },
        { label: S.menus.guardarComo, onSelect: () => store.save(true), testId: 'menu-guardar-como' },
        { label: '', separator: true },
        { label: S.menus.salir, onSelect: () => void store.salir() },
      ],
    },
    {
      id: 'simulacion',
      label: S.menus.simulacion,
      items: [
        runState === 'running'
          ? { label: S.menus.pausar, onSelect: () => store.pause() }
          : runState === 'paused'
            ? { label: S.menus.reanudar, onSelect: () => store.run() }
            : { label: S.menus.ejecutar, onSelect: () => store.run(), disabled: runState === 'waiting' },
        { label: S.menus.pasoAPaso, onSelect: () => store.stepOnce(), disabled: runState === 'running' || runState === 'waiting' },
        { label: S.menus.estadisticas, onSelect: () => open('stats'), testId: 'menu-estadisticas' },
        { label: S.menus.reiniciar, onSelect: () => void store.reiniciarRegistros() },
      ],
    },
    {
      id: 'utilidades',
      label: S.menus.utilidades,
      items: [
        { label: S.menus.modificarMemoria, onSelect: () => store.openModify(null), testId: 'menu-modificar' },
        { label: S.menus.entradaManual, onSelect: () => open('manual'), testId: 'menu-manual' },
        { label: S.menus.vigilante, onSelect: () => open('watch'), testId: 'menu-vigilante' },
        { label: S.menus.conversion, onSelect: () => store.setWindow('bases', true), testId: 'menu-conversion' },
        { label: S.menus.editor, onSelect: () => open('editor'), testId: 'menu-editor' },
      ],
    },
    { id: 'opciones', label: S.menus.opciones, items: [{ label: S.menus.configurar, onSelect: () => store.setWindow('config', true), testId: 'menu-configurar' }] },
    {
      id: 'ayuda',
      label: S.menus.ayuda,
      items: [
        { label: S.menus.acercaDe, onSelect: () => store.setWindow('about', true), testId: 'menu-acerca' },
        { label: S.menus.instrucciones, onSelect: () => store.setWindow('help', true), testId: 'menu-instrucciones' },
      ],
    },
    {
      id: 'dispositivos',
      label: S.menus.dispositivos,
      items: [
        { label: S.menus.puertos, heading: true },
        {
          label: S.menus.puerto1,
          // Like the original's PantallaytecladoClick: the E/S window plus the port's help.
          onSelect: () => {
            open('devices');
            store.setWindow('portHelp', 1);
          },
        },
        { label: S.menus.puerto8, onSelect: () => store.setWindow('portHelp', 8) },
        { label: S.menus.puerto9, onSelect: () => open('switches'), testId: 'menu-switches' },
        { label: S.menus.puerto13, onSelect: () => store.setWindow('portHelp', 13) },
      ],
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <MenuBar menus={menus} />
      <div className="flex min-h-0 flex-1 gap-2 p-2 max-lg:flex-col max-lg:overflow-auto">
        <div className="flex w-[310px] shrink-0 flex-col gap-2 overflow-auto max-lg:w-auto max-lg:shrink">
          <ProcessorRegisters />
          <GeneralRegisters />
          <StackPanel />
          <FlagsPanel />
          <AluPanel />
        </div>
        <div className="flex min-w-0 flex-1 flex-col max-lg:min-h-[420px]">
          <MemoryPanel />
        </div>
        <div className="flex w-[360px] shrink-0 flex-col gap-2 max-lg:w-auto max-lg:shrink">
          <ControlPanel />
          <GaugesPanel />
          <LogPanel />
        </div>
      </div>
      <StatusBar />
      <div className="pointer-events-none fixed inset-0 z-20">
        {windows.devices && <DevicesWindow z={z('devices')} onFocus={() => focus('devices')} />}
        {windows.editor && <EditorWindow z={z('editor')} onFocus={() => focus('editor')} />}
        {windows.manual && <ManualEntryWindow z={z('manual')} onFocus={() => focus('manual')} />}
        {windows.stats && <StatsWindow z={z('stats')} onFocus={() => focus('stats')} />}
        {windows.watch && <WatchWindow z={z('watch')} onFocus={() => focus('watch')} />}
        {windows.switches && <SwitchesWindow z={z('switches')} onFocus={() => focus('switches')} />}
      </div>
      {windows.modifyMemory && <ModifyMemoryDialog />}
      {windows.help && <HelpDialog />}
      {windows.about && <AboutDialog />}
      {windows.saveAs && <SaveAsDialog />}
      {windows.config && <ConfigDialog />}
      {windows.bases && <BaseConversionDialog onClose={() => store.setWindow('bases', false)} readWord={(addr) => store.mem.readData(addr).value} />}
      <ErrorListDialog />
      <PortHelpDialog />
      <MessageBox />
    </div>
  );
}
