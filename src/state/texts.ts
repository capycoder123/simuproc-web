/**
 * The UI labels the store itself shows (message box buttons and titles, "Modificar una Posición
 * de Memoria" errors). src/ui/strings.ts reuses them, so each text has a single source.
 */
export const APP_NAME = 'SimuProc Web';

export const BUTTONS = {
  aceptar: 'Aceptar',
  cancelar: 'Cancelar',
  si: 'Sí',
  no: 'No',
} as const;

export const MODIFY_TEXTS = {
  badDir: 'Dir de Mem No Válida, Solo Hexa desde 000 hasta FFF',
  indique: 'Indique una Dir.',
} as const;
