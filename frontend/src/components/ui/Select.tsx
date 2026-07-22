import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computeFixedDropdownStyle } from '../../utils/dropdownPortal';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  /** Evita recorte y desalineación del picker nativo en modales / móvil. */
  usePortal?: boolean;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar…',
  disabled = false,
  required = false,
  id: externalId,
  name,
  className = '',
  usePortal = true,
}: SelectProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value === '' ? '' : value);

  useLayoutEffect(() => {
    if (!open || !usePortal || !rootRef.current) return;

    const updatePosition = () => {
      setPanelStyle(computeFixedDropdownStyle(rootRef.current!));
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, usePortal]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  const panel = open ? (
    <ul
      ref={panelRef}
      className={`app-select__panel${usePortal ? ' app-select__panel--portal' : ''}`}
      role="listbox"
      id={`${id}-listbox`}
      style={usePortal ? panelStyle : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {options.length === 0 ? (
        <li className="app-select__empty">No hay opciones disponibles</li>
      ) : (
        options.map((opt) => (
          <li key={`${opt.value}-${opt.label}`} role="presentation">
            <button
              type="button"
              role="option"
              className={`app-select__option${opt.value === value ? ' is-selected' : ''}`}
              aria-selected={opt.value === value}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && pick(opt.value)}
            >
              {opt.label}
            </button>
          </li>
        ))
      )}
    </ul>
  ) : null;

  return (
    <div
      className={`app-select${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
      ref={rootRef}
    >
      {name ? (
        <input
          type="text"
          name={name}
          value={value}
          required={required}
          tabIndex={-1}
          aria-hidden
          className="app-select__native-fallback"
          readOnly
          onChange={() => {}}
        />
      ) : null}
      <button
        type="button"
        id={id}
        className="app-select__trigger admin-form__input"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? `${id}-listbox` : undefined}
        aria-required={required || undefined}
      >
        <span className={displayLabel ? '' : 'app-select__placeholder'}>
          {displayLabel || placeholder}
        </span>
        <span className="app-select__caret" aria-hidden>
          ▾
        </span>
      </button>
      {usePortal && panel ? createPortal(panel, document.body) : panel}
    </div>
  );
}
