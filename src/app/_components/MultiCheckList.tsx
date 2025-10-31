"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X, Check } from "lucide-react";

export type Option = { value: string; label: string };

export default function MultiCheckList({
  options,
  selected,
  onChange,
  placeholder = "Seleccionar…",
  className = "",
  widthClass = "w-80",
}: {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  /** Tailwind width para el popover (w-64, w-80, etc.) */
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // cerrar al clicar fuera
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t
      ? options.filter((o) => o.label.toLowerCase().includes(t))
      : options;
  }, [options, q]);

  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((o) => selected.includes(o.value));

  const toggleValue = (val: string) =>
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
    );

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      // deselecciona sólo los visibles
      onChange(selected.filter((v) => !filtered.some((o) => o.value === v)));
    } else {
      // añade los visibles que falten
      const union = new Set([...selected, ...filtered.map((o) => o.value)]);
      onChange([...union]);
    }
  };

  const clearAll = () => onChange([]);

  const summary =
    selected.length === 0
      ? placeholder
      : `${selected.length} seleccionado${selected.length > 1 ? "s" : ""}`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-between gap-2 rounded-md border border-[var(--subtle)] bg-[var(--panel)] px-3 py-2 text-sm w-full"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 rounded-md border border-[var(--subtle)] bg-white shadow-lg ${widthClass}`}
        >
          {/* header */}
          <div className="flex items-center gap-2 p-2 border-b border-[var(--subtle)]">
            <input
              placeholder="Buscar médico…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-md border border-[var(--subtle)] bg-[var(--panel)] px-2 py-1 text-sm outline-none"
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="p-1 rounded text-slate-500 hover:bg-slate-100"
                title="Limpiar selección"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* seleccionar todos visibles */}
          <label className="flex items-center gap-2 px-3 py-2 text-sm border-b border-[var(--subtle)] cursor-pointer">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
            />
            <span>
              {allVisibleSelected ? "Quitar" : "Seleccionar"} todos (lista
              actual)
            </span>
          </label>

          {/* lista */}
          <div className="py-1 overflow-auto max-h-64">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-500">
                Sin resultados
              </div>
            )}
            {filtered.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(o.value)}
                  />
                  <span className="flex-1 truncate">{o.label}</span>
                  {checked && <Check size={14} className="text-[var(--brand)]" />}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
