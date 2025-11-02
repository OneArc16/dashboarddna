// src/components/ModulesMenu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Search, Trash2, BarChart3 } from "lucide-react";

type ModuleItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  desc?: string;
};

const DEFAULT_ITEMS: ModuleItem[] = [
  { href: "/reportes",       label: "Reportes",       icon: <BarChart3 className="w-5 h-5" /> },
  { href: "/eliminar-cupos", label: "Eliminar cupos", icon: <Trash2 className="w-5 h-5" /> },
];

export default function ModulesMenu({ items = DEFAULT_ITEMS }: { items?: ModuleItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  // cerrar con click afuera / ESC
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => i.label.toLowerCase().includes(t));
  }, [q, items]);

  return (
    <div className="relative" ref={ref}>
      {/* Botón launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-3 py-2 transition bg-white border shadow-sm group rounded-2xl hover:bg-slate-50 border-slate-200 text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        title="Módulos"
      >
        <LayoutGrid className="w-5 h-5 transition group-hover:scale-110" />
        <span className="hidden sm:block">Módulos</span>
      </button>

      {/* Panel */}
      <div
        className={`absolute right-0 z-50 mt-2 w-[320px] sm:w-[380px] origin-top-right
                    rounded-2xl border border-slate-200 bg-white shadow-xl
                    transition-all ${open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"}`}
        role="menu"
        aria-label="Selector de módulos"
      >
        {/* Barra de búsqueda */}
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar módulo…"
              className="w-full py-2 pr-3 text-sm border outline-none rounded-xl border-slate-200 pl-9 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Grid de módulos */}
        <div className="grid grid-cols-2 gap-2 p-3">
          {filtered.map((m) => (
            <Link
              key={m.href + m.label}
              href={m.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-3 transition border border-transparent rounded-xl hover:bg-slate-50 hover:border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="grid bg-white border place-items-center rounded-xl border-slate-200 w-9 h-9 text-rose-600">
                {m.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate text-slate-800">{m.label}</p>
                {m.desc && <p className="text-xs truncate text-slate-500">{m.desc}</p>}
              </div>
            </Link>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-2 p-6 text-sm text-center text-slate-500">
              Sin coincidencias
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
