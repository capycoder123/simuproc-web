/** Browser file helpers: open a local file and download bytes. */

export function downloadBytes(name: string, bytes: Uint8Array): void {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(input.files && input.files.length > 0 ? input.files[0] : null);
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/**
 * The name "Guardar Como" writes for `format`: Abrir and Guardar pick the format from the
 * extension, so a missing one is added and a program extension of the other format is replaced.
 */
export function normalizeSaveName(name: string, format: 'smp' | 'asm'): string {
  const ext = fileExtension(name);
  const matches = format === 'smp' ? ext === 'smp' : ext === 'asm' || ext === 'txt';
  if (matches) return name;
  const base = ext === 'smp' || ext === 'asm' || ext === 'txt' ? name.slice(0, name.length - ext.length - 1) : name.replace(/\.+$/, '');
  return `${base}.${format}`;
}
