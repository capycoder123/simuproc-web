/** Example programs bundled at build time from src/ejemplos/{simuproc,curso,smp}. */

const simuprocFiles = import.meta.glob('./simuproc/*.asm', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;
const cursoFiles = import.meta.glob('./curso/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const smpFiles = import.meta.glob('./smp/*.smp', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export type ExampleGroupId = 'simuproc' | 'curso' | 'smp';

export interface ExampleEntry {
  group: ExampleGroupId;
  name: string;
  label: string;
  text: string;
}

export interface ExampleGroup {
  id: ExampleGroupId;
  title: string;
  entries: ExampleEntry[];
}

/** Captions of the original's "Programas de Ejemplo" menu (captions-formularios.txt). */
const SIMUPROC_LABELS: Record<string, string> = {
  'Ejemplo1.asm': 'Programa 1 - Hola mundo',
  'Ejemplo2.asm': 'Programa 2 - Iniciar variables',
  'Ejemplo3.asm': 'Programa 3 - Pedir datos',
  'Ejemplo4.asm': 'Programa 4 - Tomar decisiones',
  'Ejemplo5.asm': 'Programa 5 - Numeros de Punto Flotante',
  'Ejemplo6.asm': 'Programa 6 - Programa de Ejemplo',
};

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

function toEntries(group: ExampleGroupId, files: Record<string, string>, labels?: Record<string, string>): ExampleEntry[] {
  return Object.entries(files)
    .map(([path, text]) => {
      const name = path.split('/').pop() ?? path;
      return { group, name, label: labels?.[name] ?? name, text };
    })
    .sort((a, b) => collator.compare(a.name, b.name));
}

export const EXAMPLE_GROUPS: ExampleGroup[] = [
  { id: 'simuproc', title: 'Ejemplos de SimuProc', entries: toEntries('simuproc', simuprocFiles, SIMUPROC_LABELS) },
  { id: 'curso', title: 'Ejemplos del curso', entries: toEntries('curso', cursoFiles) },
  { id: 'smp', title: 'Programas .smp', entries: toEntries('smp', smpFiles) },
];

export function findExample(group: ExampleGroupId, name: string): ExampleEntry | undefined {
  return EXAMPLE_GROUPS.find((g) => g.id === group)?.entries.find((e) => e.name === name);
}
