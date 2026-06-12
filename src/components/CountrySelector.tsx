import { useEffect, useMemo, useRef, useState } from 'react';
import type { CountryState } from '../engine';

interface Props {
  countries: CountryState[];
  value: string;
  onChange: (iso: string) => void;
}

/**
 * Country selector with type-ahead search — built for the v2 universe of
 * ~170 economies where a flat <select> stops being navigable.
 *
 * Trigger:   <button> styled to look like a select. Click toggles the panel.
 * Panel:     dropdown with a search input + a filtered scrollable list.
 * Filter:    case-insensitive substring match on country name and ISO-3 code.
 * Keyboard:  ArrowDown / ArrowUp move the highlight; Home / End jump to ends;
 *            Enter selects; Escape closes the panel and returns focus.
 * A11y:      role=combobox / role=listbox / role=option, aria-activedescendant
 *            on the search input so screen readers track the highlighted option.
 */
export function CountrySelector({ countries, value, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);

  const selected = countries.find(c => c.iso === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      c => c.name.toLowerCase().includes(q) || c.iso.toLowerCase().includes(q),
    );
  }, [countries, query]);

  // Reset the highlight whenever the filtered set changes.
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Focus the search input on open.
  useEffect(() => {
    if (isOpen) {
      searchRef.current?.focus();
    }
  }, [isOpen]);

  // Click outside the component closes the panel.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen]);

  // Keep the highlighted option in view as the user arrows through the list.
  useEffect(() => {
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const commitSelection = (iso: string) => {
    onChange(iso);
    setIsOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex(i =>
        Math.min(i + 1, Math.max(0, filtered.length - 1)),
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = filtered[highlightedIndex];
      if (target) commitSelection(target.iso);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlightedIndex(Math.max(0, filtered.length - 1));
    }
  };

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    // Open on ArrowDown/ArrowUp/Enter/Space — standard combobox idiom.
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  const triggerLabel = selected?.name ?? 'Select a country…';
  const activeOptionId = filtered[highlightedIndex]
    ? `country-option-${filtered[highlightedIndex].iso}`
    : undefined;

  return (
    <div className="country-selector" ref={rootRef}>
      <span className="country-selector__label" id="country-selector-label">
        Country
      </span>
      <button
        ref={triggerRef}
        type="button"
        className="country-selector__trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="country-selector-label"
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="country-selector__trigger-text">{triggerLabel}</span>
        <span className="country-selector__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="country-selector__panel" role="presentation">
          <input
            ref={searchRef}
            type="text"
            className="country-selector__search"
            placeholder={`Search ${countries.length} countries…`}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Filter countries"
            aria-controls="country-selector-listbox"
            aria-activedescendant={activeOptionId}
            autoComplete="off"
            spellCheck={false}
          />
          <ul
            id="country-selector-listbox"
            role="listbox"
            aria-label="Countries"
            className="country-selector__list"
          >
            {filtered.length === 0 ? (
              <li className="country-selector__empty" role="presentation">
                No countries match "{query}"
              </li>
            ) : (
              filtered.map((country, index) => {
                const isHighlighted = index === highlightedIndex;
                const isSelected = country.iso === value;
                const className = [
                  'country-selector__option',
                  isHighlighted && 'country-selector__option--highlighted',
                  isSelected && 'country-selector__option--selected',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li
                    key={country.iso}
                    id={`country-option-${country.iso}`}
                    ref={node => {
                      optionRefs.current[index] = node;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    className={className}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={event => {
                      // mousedown (not click) — beats the document mousedown
                      // close handler so the option click registers cleanly.
                      event.preventDefault();
                      commitSelection(country.iso);
                    }}
                  >
                    <span className="country-selector__option-name">
                      {country.name}
                    </span>
                    <span
                      className="country-selector__option-iso"
                      aria-hidden="true"
                    >
                      {country.iso.toUpperCase()}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
