import { useAppState } from '../../state/store';
import { S } from '../strings';

export function StatusBar() {
  const status = useAppState((s) => s.status);
  const fileName = useAppState((s) => s.fileName);
  const modified = useAppState((s) => s.modified);
  return (
    <footer className="flex items-center justify-between gap-4 border-t border-(--border) bg-(--panel) px-3 py-1 text-[12px]">
      <span data-testid="status">{status}</span>
      <span className="text-(--muted)" data-testid="status-file">
        {fileName ?? 'Sin archivo'}
        {modified ? ` ${S.status.modificado}` : ''}
      </span>
    </footer>
  );
}
