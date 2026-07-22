import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computeFixedDropdownStyle } from '../../utils/dropdownPortal';

export interface MultiSelectOption {
  value: number;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /** Evita que el panel quede recortado dentro de modales (position: fixed + portal). */
  usePortal?: boolean;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar…',
  disabled = false,
  id: externalId,
  usePortal = true,
}: MultiSelectProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

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

  const selectedLabels = options.filter((o) => value.includes(o.value)).map((o) => o.label);

  const toggle = (optionValue: number) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const panel = open ? (
    <ul
      ref={panelRef}
      className={`multi-select__panel${usePortal ? ' multi-select__panel--portal' : ''}`}
      role="listbox"
      aria-multiselectable
      style={usePortal ? panelStyle : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {options.length === 0 ? (
        <li className="multi-select__empty">No hay opciones disponibles</li>
      ) : (
        options.map((opt) => (
          <li key={opt.value} role="option" aria-selected={value.includes(opt.value)}>
            <label className="multi-select__option" onPointerDown={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          </li>
        ))
      )}
    </ul>
  ) : null;

  return (
    <div className={`multi-select${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="multi-select__trigger admin-form__input"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={selectedLabels.length ? '' : 'multi-select__placeholder'}>
          {selectedLabels.length ? selectedLabels.join(', ') : placeholder}
        </span>
        <span className="multi-select__caret" aria-hidden>
          ▾
        </span>
      </button>
      {usePortal && panel ? createPortal(panel, document.body) : panel}
    </div>
  );
}
