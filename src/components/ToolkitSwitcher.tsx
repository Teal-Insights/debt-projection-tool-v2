import { useEffect, useRef, useState } from 'react';

interface ToolEntry {
  label: string;
  description: string;
  href?: string;
  current?: boolean;
}

interface Props {
  /** Which version is the current page? Used to mark "you are here". */
  current: 'v1' | 'v2';
}

/**
 * Header-level switcher that surfaces the "toolkit of tools" model — a small
 * "Toolkit" pill that opens a dropdown listing v1 / v2 / v3+. Tells anyone
 * landing on either tool that there are siblings, and links to them.
 *
 * Real URLs are placeholders — replace with the actual deployed URLs once
 * v1 has its own deploy. v2's preview URL is currently a private-repo
 * "stunning-adventure-…" subdomain (see Linear/04 deploy issue).
 */
const TOOLKIT: ToolEntry[] = [
  {
    label: 'v1 — FT 2014 replica',
    description: 'IMF WEO October 2014 · 5 countries · integer sliders',
    href: '#v1', // placeholder
  },
  {
    label: 'v2 — Latest WEO',
    description:
      'IMF WEO April 2026 · 170 countries · one-decimal sliders · WEO baseline',
    href: '#v2', // placeholder
  },
  {
    label: 'v3+ — Custom data',
    description:
      'Planned: bring-your-own-data versions for users with prior assumptions',
  },
];

export function ToolkitSwitcher({ current }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="toolkit-switcher" ref={rootRef}>
      <button
        type="button"
        className="toolkit-switcher__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        Toolkit
        <span className="toolkit-switcher__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div
          className="toolkit-switcher__panel"
          role="menu"
          aria-label="Tool versions"
        >
          <p className="toolkit-switcher__intro">
            Simple tools for users with no prior data; more complex tools for
            users who bring their own.
          </p>
          <ul className="toolkit-switcher__list">
            {TOOLKIT.map(entry => {
              const isCurrent =
                (current === 'v1' && entry.label.startsWith('v1')) ||
                (current === 'v2' && entry.label.startsWith('v2'));
              return (
                <li key={entry.label}>
                  {entry.href && !isCurrent ? (
                    <a
                      href={entry.href}
                      className="toolkit-switcher__item"
                      role="menuitem"
                    >
                      <span className="toolkit-switcher__label">
                        {entry.label}
                      </span>
                      <span className="toolkit-switcher__desc">
                        {entry.description}
                      </span>
                    </a>
                  ) : (
                    <div
                      className={
                        'toolkit-switcher__item' +
                        (isCurrent ? ' toolkit-switcher__item--current' : ' toolkit-switcher__item--disabled')
                      }
                      role="menuitem"
                      aria-current={isCurrent ? 'page' : undefined}
                    >
                      <span className="toolkit-switcher__label">
                        {entry.label}
                        {isCurrent && (
                          <span className="toolkit-switcher__badge">
                            you are here
                          </span>
                        )}
                      </span>
                      <span className="toolkit-switcher__desc">
                        {entry.description}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
