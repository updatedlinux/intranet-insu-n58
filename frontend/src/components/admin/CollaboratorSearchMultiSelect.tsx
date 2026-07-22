import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { fetchCollaborators } from '../../api/collaborators';

export interface CollaboratorOption {
  id: number;
  label: string;
  detail: string;
}

interface CollaboratorSearchMultiSelectProps {
  value: number[];
  onChange: (value: number[]) => void;
  initialOptions?: CollaboratorOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

function collaboratorLabel(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function CollaboratorSearchMultiSelect({
  value,
  onChange,
  initialOptions = [],
  placeholder = 'Buscar colaborador por nombre o correo…',
  disabled = false,
  id: externalId,
}: CollaboratorSearchMultiSelectProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CollaboratorOption[]>([]);
  const [knownOptions, setKnownOptions] = useState<Map<number, CollaboratorOption>>(() => {
    const map = new Map<number, CollaboratorOption>();
    for (const opt of initialOptions) map.set(opt.id, opt);
    return map;
  });

  useEffect(() => {
    setKnownOptions((prev) => {
      const next = new Map(prev);
      for (const opt of initialOptions) next.set(opt.id, opt);
      return next;
    });
  }, [initialOptions]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetchCollaborators({ search: term, isActive: true, pageSize: 15 });
          if (!active) return;
          const options = res.items.map((c) => ({
            id: c.id,
            label: collaboratorLabel(c.firstName, c.lastName),
            detail: `${c.area.name} · ${c.position.name}`,
          }));
          setResults(options);
          setKnownOptions((prev) => {
            const next = new Map(prev);
            for (const opt of options) next.set(opt.id, opt);
            return next;
          });
        } catch {
          if (active) setResults([]);
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const addOption = (opt: CollaboratorOption) => {
    if (value.includes(opt.id)) return;
    setKnownOptions((prev) => new Map(prev).set(opt.id, opt));
    onChange([...value, opt.id]);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const removeOption = (optionId: number) => {
    onChange(value.filter((v) => v !== optionId));
  };

  const visibleResults = results.filter((r) => !value.includes(r.id));

  return (
    <div className={`collab-search-select${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <div
        className="collab-search-select__control admin-form__input"
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <div className="collab-search-select__chips">
          {value.map((optionId) => {
            const opt = knownOptions.get(optionId);
            return (
              <span key={optionId} className="collab-search-select__chip">
                <span>{opt?.label ?? `Colaborador #${optionId}`}</span>
                {!disabled && (
                  <button
                    type="button"
                    className="collab-search-select__chip-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOption(optionId);
                    }}
                    aria-label={`Quitar ${opt?.label ?? 'colaborador'}`}
                  >
                    <X size={14} aria-hidden />
                  </button>
                )}
              </span>
            );
          })}
          <input
            ref={inputRef}
            id={id}
            type="search"
            className="collab-search-select__input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={value.length === 0 ? placeholder : 'Buscar…'}
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      </div>

      {open && !disabled && (
        <ul className="collab-search-select__panel" role="listbox">
          {query.trim().length < 2 ? (
            <li className="collab-search-select__hint">
              Escriba al menos 2 caracteres para buscar
            </li>
          ) : loading ? (
            <li className="collab-search-select__hint">Buscando…</li>
          ) : visibleResults.length === 0 ? (
            <li className="collab-search-select__hint">No se encontraron colaboradores</li>
          ) : (
            visibleResults.map((opt) => (
              <li key={opt.id} role="option">
                <button
                  type="button"
                  className="collab-search-select__option"
                  onClick={() => addOption(opt)}
                >
                  <span className="collab-search-select__option-name">{opt.label}</span>
                  <span className="collab-search-select__option-detail">{opt.detail}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
