// Mission Control does not use browser form widgets.
//
// A native <select> and a native <input type="range"> are painted by the operating system, not by
// this application: they arrive with Windows' own popup, Windows' own focus ring and Windows' own
// scrollbar, and they look like a settings dialog dropped into an instrument panel. Every control
// a person can operate here is drawn by the app itself so it obeys the same palette, the same
// radius and the same keyboard rules as everything around it — while keeping the semantics a
// screen reader needs (listbox/option, slider with aria-value*).

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type MenuOption<T extends string> = { value: T; label: string; hint?: string };

/** A listbox drawn by the app: button + popup, closed on Escape, outside click or selection. */
export function MenuSelect<T extends string>({
  value,
  options,
  onChange,
  icon,
  label,
  align = 'end',
}: {
  value: T;
  options: MenuOption<T>[];
  onChange: (value: T) => void;
  icon?: ReactNode;
  label: string;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const shell = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (shell.current && !shell.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  useEffect(() => {
    if (!open || !list.current) return;
    const node = list.current.children[active] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
      event.preventDefault(); setOpen(true); return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => (i + 1) % options.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
    else if (event.key === 'End') { event.preventDefault(); setActive(options.length - 1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(active); }
    else if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div className={`menu-select ${open ? 'open' : ''}`} ref={shell} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="menu-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => setOpen((was) => !was)}
      >
        {icon}
        <span className="menu-value">{current?.label ?? value}</span>
        <ChevronDown size={12} className="menu-caret" />
      </button>
      {open && (
        <div className={`menu-popup ${align}`} id={listId} role="listbox" aria-label={label} ref={list}>
          {options.map((option, index) => (
            <button
              type="button"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`menu-option ${index === active ? 'active' : ''} ${option.value === value ? 'selected' : ''}`}
              onPointerEnter={() => setActive(index)}
              onClick={() => commit(index)}
            >
              <span>{option.label}</span>
              {option.hint && <em>{option.hint}</em>}
              {option.value === value && <Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A slider drawn by the app: a track that responds to pointer drag and to the arrow keys. */
export function DialSlider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  format = (v: number) => `${v}%`,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  format?: (value: number) => string;
}) {
  const track = useRef<HTMLDivElement | null>(null);

  const fromClientX = useCallback((clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return value;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    const snapped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, snapped));
  }, [max, min, step, value]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    onChange(fromClientX(event.clientX));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onChange(fromClientX(event.clientX));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const bump = event.shiftKey ? step * 4 : step;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); onChange(Math.min(max, value + bump)); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); onChange(Math.max(min, value - bump)); }
    else if (event.key === 'Home') { event.preventDefault(); onChange(min); }
    else if (event.key === 'End') { event.preventDefault(); onChange(max); }
  };

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className="dial-slider">
      <div
        className="dial-track"
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        <span className="dial-fill" style={{ width: `${percent}%` }} />
        <span className="dial-knob" style={{ left: `${percent}%` }} />
      </div>
      <b>{format(value)}</b>
    </div>
  );
}
