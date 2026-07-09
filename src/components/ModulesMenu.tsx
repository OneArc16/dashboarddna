// src/components/ModulesMenu.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { Trash2, BarChart3 } from "lucide-react";

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
  const router = useRouter();

  return (
    <nav aria-label="Módulos principales" className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-sm">
        {items.map((item) => {
          const active = router.pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-11 flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600/30",
                active
                  ? "bg-cyan-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition",
                  active
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-slate-200 bg-slate-50 text-cyan-700",
                ].join(" ")}
              >
                {item.icon}
              </span>

              <span className="min-w-0">
                <span className="block font-medium">{item.label}</span>
                {item.desc && (
                  <span
                    className={[
                      "block truncate text-xs",
                      active ? "text-cyan-50/90" : "text-slate-500",
                    ].join(" ")}
                  >
                    {item.desc}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
