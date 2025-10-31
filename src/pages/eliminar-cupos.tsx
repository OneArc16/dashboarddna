// src/pages/eliminar-cupos.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import toast from "react-hot-toast";

/* ============================ Tipos y helpers ============================ */

type Option = { value: string; label: string };

type Row = {
  cita_id: number | null;
  fecha: string;           // 'YYYY-MM-DD'
  hora: string | null;     // 'HH:MM'
  idusuario: number | null;
  paciente: string | null;
  eps: string | null;
  idmedico: string | null;
  medico: string | null;
  estado: string | null;   // variantes
  tipo_cita: string | null;// CUPS
};

type StatKey = "ASIGNADA" | "ATENDIDA" | "CUMPLIDA" | "SIN_ASIGNAR";

const STATUS_META: Record<StatKey, { label: string; dot: string }> = {
  ASIGNADA: { label: "Inasistentes", dot: "bg-amber-500" },
  ATENDIDA: { label: "Atendidas", dot: "bg-emerald-500" },
  CUMPLIDA: { label: "Activadas", dot: "bg-indigo-500" },
  SIN_ASIGNAR: { label: "Cupos libres", dot: "bg-zinc-400" },
};
const STATUS_ORDER: StatKey[] = ["ASIGNADA", "ATENDIDA", "CUMPLIDA", "SIN_ASIGNAR"];

const normalize = (s?: string | null) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();

const estadoKey = (s?: string | null): StatKey | null => {
  const v = normalize(s);
  if (v.startsWith("ASIGNAD")) return "ASIGNADA";
  if (v.startsWith("ATENDID")) return "ATENDIDA";
  if (v.startsWith("CUMPLID")) return "CUMPLIDA";
  if (v.startsWith("SIN ASIGNAR")) return "SIN_ASIGNAR";
  return null;
};

/* ============================ Componente: MultiSelectDropdown ============================ */

function MultiSelectDropdown({
  options,
  value,
  onChange,
  placeholder = "Selecciona...",
  emptyText = "Sin resultados",
  labelSearch = "Buscar...",
  className = "",
}: {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  labelSearch?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const allRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toUpperCase();
    if (!qq) return options;
    return options.filter(
      (o) => o.label?.toUpperCase().includes(qq) || o.value?.toUpperCase().includes(qq)
    );
  }, [options, q]);

  const allChecked =
    filtered.length > 0 && filtered.every((o) => value.includes(o.value));

  const someChecked =
    filtered.some((o) => value.includes(o.value)) && !allChecked;

  useEffect(() => {
    if (allRef.current) {
      allRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const toggleOne = (val: string, checked: boolean) => {
    const set = new Set(value);
    if (checked) set.add(val);
    else set.delete(val);
    onChange(Array.from(set));
  };

  const toggleAll = (checked: boolean) => {
    if (!filtered.length) return;
    if (checked) {
      const set = new Set(value);
      for (const o of filtered) set.add(o.value);
      onChange(Array.from(set));
    } else {
      const toRemove = new Set(filtered.map((o) => o.value));
      onChange(value.filter((v) => !toRemove.has(v)));
    }
  };

  const clear = () => onChange([]);

  const summary =
    value.length === 0
      ? placeholder
      : `${value.length} seleccionado${value.length === 1 ? "" : "s"}`;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Botón que parece input */}
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex items-center justify-between w-full px-3 py-2 mt-1 text-left bg-white border rounded-lg hover:bg-slate-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value.length === 0 ? "text-slate-500" : ""}>
          {summary}
        </span>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <div
          className="absolute z-50 w-full mt-2 bg-white border shadow-xl rounded-xl"
          role="listbox"
        >
          {/* Search */}
          <div className="p-2 border-b">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={labelSearch}
              className="w-full px-3 py-2 border rounded-lg"
              autoFocus
            />
            <label className="inline-flex items-center gap-2 mt-2 text-sm select-none">
              <input
                ref={allRef}
                type="checkbox"
                checked={allChecked}
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={filtered.length === 0}
              />
              {allChecked ? "Desmarcar todos" : "Marcar todos"} ({filtered.length})
            </label>
          </div>

          {/* Listado */}
          <div className="p-1 overflow-auto max-h-64">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">{emptyText}</div>
            ) : (
              filtered.map((o) => {
                const checked = value.includes(o.value);
                return (
                  <label
                    key={o.value}
                    className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer select-none hover:bg-slate-50"
                    title={o.label}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleOne(o.value, e.target.checked)}
                    />
                    <span className="truncate">{o.label}</span>
                  </label>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 p-2 border-t">
            <button
              onClick={clear}
              className="px-3 py-1.5 text-sm border rounded-lg"
              disabled={value.length === 0}
            >
              Limpiar
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-sm rounded-lg bg-black text-white"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Página ============================ */

export default function EliminarCuposPage() {
  // Filtros
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [horaDesde, setHoraDesde] = useState<string>(""); // HH:MM
  const [horaHasta, setHoraHasta] = useState<string>(""); // HH:MM
  const [eps, setEps] = useState<string>("");
  const [especialidad, setEspecialidad] = useState<string>("");
  const [medicosSel, setMedicosSel] = useState<string[]>([]); // valores del dropdown

  // Catálogos
  const [epsOpts, setEpsOpts] = useState<Option[]>([]);
  const [espOpts, setEspOpts] = useState<Option[]>([]);
  const [medOpts, setMedOpts] = useState<Option[]>([]);

  // Resultados y selección
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Stats
  const [stats, setStats] = useState<Record<StatKey, number>>({
    ASIGNADA: 0,
    ATENDIDA: 0,
    CUMPLIDA: 0,
    SIN_ASIGNAR: 0,
  });
  const [total, setTotal] = useState(0);

  const cuposLibres = useMemo(
    () => rows.filter((r) => estadoKey(r.estado) === "SIN_ASIGNAR" && r.cita_id != null),
    [rows]
  );

  const selectedCount = selectedIds.length;
  const allSelectableIds = useMemo(() => cuposLibres.map((r) => r.cita_id!), [cuposLibres]);
  const allSelected =
    allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedIds.includes(id));

  function recomputeStats(data: Row[]) {
    const next: Record<StatKey, number> = {
      ASIGNADA: 0,
      ATENDIDA: 0,
      CUMPLIDA: 0,
      SIN_ASIGNAR: 0,
    };
    for (const r of data) {
      const k = estadoKey(r.estado);
      if (k) next[k]++;
    }
    setStats(next);
    setTotal(data.length);
  }

  useEffect(() => { recomputeStats(rows); }, [rows]);

  /* ============================ Cargar catálogos ============================ */

  useEffect(() => {
    (async () => {
      try {
        const [rEps, rEsp] = await Promise.all([
          fetch("/api/catalog/eps"),
          fetch("/api/catalog/especialidades"),
        ]);
        const { options: epsOptions } = await rEps.json();
        const { options: espOptions } = await rEsp.json();
        setEpsOpts([{ value: "", label: "Todas" }, ...epsOptions]);
        setEspOpts([{ value: "", label: "Todas" }, ...espOptions]);
      } catch (e) {
        console.error(e);
        toast.error("No fue posible cargar catálogos.");
      }
    })();
  }, []);

  // Médicos dependientes de especialidad
  useEffect(() => {
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (especialidad) qs.set("especialidad", especialidad);
        const url = "/api/catalog/medicos" + (qs.toString() ? `?${qs.toString()}` : "");
        const r = await fetch(url);
        const { options } = await r.json();
        setMedOpts(options || []);
      } catch (e) {
        console.error(e);
        setMedOpts([]);
      } finally {
        setMedicosSel([]); // reset selección si cambia la especialidad
      }
    })();
  }, [especialidad]);

  /* ============================ Acciones ============================ */

  const handleBuscar = async () => {
    if (!desde || !hasta) {
      toast.error("Selecciona el rango de fechas.");
      return;
    }
    if (new Date(desde) > new Date(hasta)) {
      toast.error("La fecha 'Desde' no puede ser mayor a 'Hasta'.");
      return;
    }
    if (horaDesde && horaHasta && horaDesde > horaHasta) {
      toast.error("La hora 'Desde' no puede ser mayor a 'Hasta'.");
      return;
    }

    setLoading(true);
    setSelectedIds([]);

    try {
      const body = {
        desde, hasta,
        horaDesde: horaDesde || undefined,
        horaHasta: horaHasta || undefined,
        eps: eps || undefined,
        especialidad: especialidad || undefined,
        medicos: medicosSel.length ? medicosSel : undefined,
      };

      const r = await fetch("/api/cupos/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "No se pudo obtener la lista de cupos.");
      }

      const data = (await r.json()) as { rows: Row[] };
      setRows(data.rows || []);
      recomputeStats(data.rows || []);
      toast.success(`Se cargaron ${data.rows?.length ?? 0} registros`);
    } catch (e: any) {
      console.error("Buscar error:", e);
      toast.error(e?.message ?? "Error al buscar.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (allSelected) {
        for (const id of allSelectableIds) set.delete(id);
      } else {
        for (const id of allSelectableIds) set.add(id);
      }
      return Array.from(set);
    });
  };

  const selectAllCuposLibres = () => {
    setSelectedIds(allSelectableIds);
    toast.success(`Seleccionados ${allSelectableIds.length} cupo(s) libre(s).`);
  };

  const clearSelection = () => setSelectedIds([]);

  const handleEliminar = async () => {
    if (selectedIds.length === 0) {
      toast.error("No hay cupos seleccionados para eliminar.");
      return;
    }

    const msg =
      `Vas a eliminar ${selectedIds.length} cupo(s) libre(s).\n` +
      `Esta acción no se puede deshacer.\n\n¿Confirmas?`;

    if (!window.confirm(msg)) return;

    try {
      const r = await fetch("/api/cupos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "No se pudo eliminar.");
      }

      const { deleted } = (await r.json()) as { ok: true; deleted: number };
      toast.success(`Eliminados ${deleted} cupo(s).`);

      const removed = new Set(selectedIds);
      const nextRows = rows.filter((r) => !(r.cita_id && removed.has(r.cita_id)));
      setRows(nextRows);
      setSelectedIds([]);
      recomputeStats(nextRows);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al eliminar.");
    }
  };

  const resetFiltros = () => {
    setEps("");
    setEspecialidad("");
    setMedicosSel([]);
    setHoraDesde("");
    setHoraHasta("");
  };

  /* ============================ UI ============================ */

  return (
    <>
      <Head>
        <title>Eliminar Cupos DNAPLUS</title>
      </Head>

      <div className="px-4 py-6 mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold">Eliminar cupos</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEliminar}
              className="inline-flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-60"
              disabled={selectedIds.length === 0}
              title="Eliminar cupos seleccionados"
            >
              🗑️ Eliminar ({selectedCount})
            </button>
          </div>
        </div>

        {/* --------- Filtros --------- */}
        <div className="p-4 border rounded-2xl">
          <h2 className="mb-4 font-medium">Filtros</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {/* Fechas */}
            <div className="col-span-6 md:col-span-2">
              <label className="text-sm text-slate-700">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className="text-sm text-slate-700">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg"
              />
            </div>

            {/* Rango de horas */}
            <div className="col-span-6 md:col-span-2">
              <label className="text-sm text-slate-700">Hora desde</label>
              <input
                type="time"
                value={horaDesde}
                onChange={(e) => setHoraDesde(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className="text-sm text-slate-700">Hora hasta</label>
              <input
                type="time"
                value={horaHasta}
                onChange={(e) => setHoraHasta(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg"
              />
            </div>

            {/* EPS */}
            <div className="col-span-6 md:col-span-2">
              <label className="text-sm text-slate-700">EPS</label>
              <select
                value={eps}
                onChange={(e) => setEps(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg"
              >
                {[{ value: "", label: "Todas" }, ...epsOpts].map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Especialidad */}
            <div className="col-span-6 md:col-span-2">
              <label className="text-sm text-slate-700">Especialidad</label>
              <select
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg"
              >
                {[{ value: "", label: "Todas" }, ...espOpts].map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Médicos (dropdown multi) */}
            <div className="col-span-12 md:col-span-4">
              <label className="text-sm text-slate-700">Médicos</label>
              <MultiSelectDropdown
                options={medOpts}
                value={medicosSel}
                onChange={setMedicosSel}
                placeholder="Selecciona médicos..."
                labelSearch="Buscar médico..."
                className="w-full"
              />
              <div className="flex items-center gap-2 mt-2 text-sm">
                <button
                  onClick={() => setMedicosSel([])}
                  className="px-3 py-1.5 border rounded-lg"
                  disabled={medicosSel.length === 0}
                  title="Limpiar selección"
                >
                  Limpiar selección ({medicosSel.length})
                </button>
                <span className="text-slate-500">{medicosSel.length} seleccionado(s)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              onClick={handleBuscar}
              disabled={loading}
              className="px-4 py-2 text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
            <button
              onClick={resetFiltros}
              className="px-4 py-2 border rounded-xl text-slate-700 hover:bg-slate-50"
            >
              Limpiar filtros
            </button>

            {/* Selección masiva de cupos libres */}
            <button
              onClick={selectAllCuposLibres}
              disabled={cuposLibres.length === 0}
              className="px-4 py-2 border rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              title="Selecciona todos los cupos que están SIN ASIGNAR en el resultado actual"
            >
              Seleccionar todos los cupos libres
            </button>
            <button
              onClick={clearSelection}
              disabled={selectedIds.length === 0}
              className="px-4 py-2 border rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Limpiar selección ({selectedCount})
            </button>
          </div>
        </div>

        {/* --------- Resultados --------- */}
        <div className="p-4 mt-6 border rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Resultados ({total})</h3>
            <div className="text-sm text-slate-500">
              Seleccionados: <span className="font-semibold">{selectedCount}</span>
            </div>
          </div>

          {/* Resumen por estado */}
          <div className="flex flex-wrap gap-2 mt-1 mb-3 text-sm">
            {STATUS_ORDER.map((k) => {
              const pct = total ? ((stats[k] / total) * 100).toFixed(1) : "0.0";
              return (
                <div
                  key={k}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5"
                >
                  <span className={`inline-block size-2 rounded-full ${STATUS_META[k].dot}`} />
                  <span className="font-medium">{STATUS_META[k].label}:</span>
                  <span className="tabular-nums">{stats[k]}</span>
                  <span className="text-zinc-500">({pct}%)</span>
                </div>
              );
            })}
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-slate-50">
                  <th className="px-3 py-2 font-semibold">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAllVisible}
                        disabled={cuposLibres.length === 0}
                        title="Seleccionar/deseleccionar todos los cupos libres visibles"
                      />
                      Sel.
                    </label>
                  </th>
                  {[
                    "ID Cita",
                    "Fecha",
                    "Hora",
                    "Paciente",
                    "EPS",
                    "ID Médico",
                    "Médico",
                    "Estado",
                    "Tipo Cita (CUPS)",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                      Sin resultados
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => {
                  const id = r.cita_id ?? -1 * (i + 1);
                  const esCupoLibre = estadoKey(r.estado) === "SIN_ASIGNAR" && r.cita_id != null;
                  const checked = r.cita_id != null && selectedIds.includes(r.cita_id);
                  return (
                    <tr key={`${id}-${i}`} className="border-b">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={!esCupoLibre}
                          checked={checked}
                          onChange={(e) => r.cita_id && toggleSelectOne(r.cita_id, e.target.checked)}
                          title={
                            esCupoLibre
                              ? "Marcar para eliminar"
                              : "Solo se pueden seleccionar cupos SIN ASIGNAR"
                          }
                        />
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.cita_id ?? ""}</td>
                      <td className="px-3 py-2">{r.fecha}</td>
                      <td className="px-3 py-2">{r.hora ?? ""}</td>
                      <td className="px-3 py-2">{r.paciente ?? ""}</td>
                      <td className="px-3 py-2">{r.eps ?? ""}</td>
                      <td className="px-3 py-2">{r.idmedico ?? ""}</td>
                      <td className="px-3 py-2">{r.medico ?? ""}</td>
                      <td className="px-3 py-2">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs",
                            estadoKey(r.estado) === "SIN_ASIGNAR" && "bg-zinc-100 text-zinc-700",
                            estadoKey(r.estado) === "ASIGNADA" && "bg-amber-100 text-amber-700",
                            estadoKey(r.estado) === "ATENDIDA" && "bg-emerald-100 text-emerald-700",
                            estadoKey(r.estado) === "CUMPLIDA" && "bg-indigo-100 text-indigo-700",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {r.estado ?? ""}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r.tipo_cita ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer acciones */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-600">
              {cuposLibres.length} cupo(s) libre(s) en el resultado actual.
            </div>
            <button
              onClick={handleEliminar}
              className="inline-flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-60"
              disabled={selectedIds.length === 0}
            >
              🗑️ Eliminar seleccionados ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
