import { useEffect, useState } from 'react';

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  separator?: boolean;
  heading?: boolean;
  testId?: string;
}

export interface Menu {
  id: string;
  label: string;
  items: MenuItem[];
}

export function MenuBar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('.menu-root')) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <nav className="menu-bar" aria-label="Menú principal">
      <span className="mr-3 font-semibold text-(--accent)">SimuProc Web</span>
      {menus.map((m) => (
        <div key={m.id} className="menu-root relative">
          <button
            type="button"
            className="menu-button"
            aria-haspopup="menu"
            aria-expanded={open === m.id}
            onClick={() => setOpen(open === m.id ? null : m.id)}
            onMouseEnter={() => {
              if (open && open !== m.id) setOpen(m.id);
            }}
            data-testid={`menu-${m.id}`}
          >
            {m.label}
          </button>
          {open === m.id && (
            <div className="menu-list" role="menu">
              {m.items.map((it, i) =>
                it.separator ? (
                  <div key={i} className="menu-separator" role="separator" />
                ) : it.heading ? (
                  <div key={i} className="menu-heading">
                    {it.label}
                  </div>
                ) : (
                  <button
                    key={i}
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    disabled={it.disabled}
                    data-testid={it.testId}
                    onClick={() => {
                      setOpen(null);
                      it.onSelect?.();
                    }}
                  >
                    <span>{it.label}</span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
