// src/pages/eliminar-cupos.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import toast from "react-hot-toast";
import MultiSelectRS, { type RSOption } from "@/components/MultiSelectRS";

/* ============================ Tipos y helpers ============================ */

type Row = {
  cita_id: number | null;
  fecha: string;           // 'YYYY-MM-DD'
  hora: string | null;     // 'HH:MM'
  idusuario: number | null;
  paciente: string | null;
  eps: string | null;
  idmedico: string | null;
  medico: string | null;
  estado: string | null;
  tipo_cita: string | null;
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

const toValues = (arr: RSOption[]) => arr.map((o) => o.value);

/* ============================ Página ============================ */

export default function EliminarCuposPage() {
  // Filtros base
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [horaDesde, setHoraDesde] = useState<string>("");
  const [horaHasta, setHoraHasta] = useState<string>("");
  const [eps, setEps] = useState<string>("");

  // Especialidades & Médicos
  const [espOptions, setEspOptions] = useState<RSOption[]>([]);
  const [espSel, setEspSel] = useState<RSOption[]>([]);
  const [medOptions, setMedOptions] = useState<RSOption[]>([]);
  const [medSel, setMedSel] = useState<RSOption[]>([]);

  // EPS
  const [epsOpts, setEpsOpts] = useState<RSOption[]>([]);

  // Resultados / selección
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Estadísticas
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

  useEffect(() => {
    recomputeStats(rows);
  }, [rows]);

  /* ============================ Cargar catálogos ============================ */

  useEffect(() => {
    (async () => {
      try {
        const [rEps, rEsp] = await Promise.all([
          fetch("/api/catalog/eps"),
          fetch("/api/catalog/especialidades"),
        ]);

        const { options: epsOptions } = await rEps.json();
        const { options: espOptionsRaw } = await rEsp.json();

        setEpsOpts([{ value: "", label: "Todas" }, ...(epsOptions as RSOption[])]);
        setEspOptions((espOptionsRaw as RSOption[]).filter((o) => o.value));
      } catch (e) {
        console.error(e);
        toast.error("No fue posible cargar catálogos.");
      }
    })();
  }, []);

  // Médicos dependientes de especialidades
  useEffect(() => {
    (async () => {
      try {
        setMedSel([]); // limpiar selección al cambiar especialidad

        if (espSel.length === 0) {
          const r = await fetch("/api/catalog/medicos");
          const { options } = await r.json().catch(() => ({ options: [] as RSOption[] }));
          const opts = (options as RSOption[]) ?? [];
          setMedOptions(opts);
          setMedSel((prev) => prev.filter((p) => opts.some((o) => o.value === p.value)));
          return;
        }

        // ?especialidad=016&especialidad=022
        const qs = new URLSearchParams();
        toValues(espSel).forEach((code) => qs.append("especialidad", code));
        const r = await fetch(`/api/catalog/medicos?${qs.toString()}`);
        const { options } = await r.json().catch(() => ({ options: [] as RSOption[] }));
        const opts = (options as RSOption[]) ?? [];
        setMedOptions(opts);
        setMedSel((prev) => prev.filter((p) => opts.some((o) => o.value === p.value)));
      } catch (e) {
        console.error(e);
        setMedOptions([]);
      }
    })();
  }, [espSel]);

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

    const espArr = toValues(espSel);
    const medArr = toValues(medSel);
    const espCsv = espArr.join(",");
    const medCsv = medArr.join(",");

    // 🔑 Enviamos TODAS las variantes para que el backend tome la que soporte.
    const payload: any = {
      desde,
      hasta,
      horaDesde: horaDesde || undefined,
      horaHasta: horaHasta || undefined,
      eps: eps || undefined,
    };
    if (espArr.length) {
      payload.especialidad = espArr;
      payload.especialidades = espArr;
      payload.especialidadCsv = espCsv;
      payload.especialidadesCsv = espCsv;
    }
    if (medArr.length) {
      payload.medicos = medArr;
      payload.medicosCsv = medCsv;
    }

    try {
      const r = await fetch("/api/cupos/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "No se pudo obtener la lista de cupos.");
      }

      const data = (await r.json()) as { rows: Row[] };
      const finalRows = data?.rows || [];
      setRows(finalRows);
      recomputeStats(finalRows);
      toast.success(`Se cargaron ${finalRows.length} registro(s)`);
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
    setEspSel([]);
    setMedSel([]);
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
            {/* Fechas/Horas/EPS */}
            <div className="col-span-6 md:col-span-2">
              <label className="text-sm text-slate-700">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg h-[42px]"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className="text-sm text-slate-700">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg h-[42px]"
              />
            </div>

            <div className="col-span-6 md:col-span-2">
              <label className="text-sm text-slate-700">Hora desde</label>
              <input
                type="time"
                value={horaDesde}
                onChange={(e) => setHoraDesde(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg h-[42px]"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className="text-sm text-slate-700">Hora hasta</label>
              <input
                type="time"
                value={horaHasta}
                onChange={(e) => setHoraHasta(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg h-[42px]"
              />
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="text-sm text-slate-700">EPS</label>
              <select
                value={eps}
                onChange={(e) => setEps(e.target.value)}
                className="w-full px-3 py-2 mt-1 border rounded-lg h-[42px]"
              >
                {epsOpts.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Especialidad / Médicos */}
            <div className="col-span-12 md:col-span-6">
              <MultiSelectRS
                label="Especialidad"
                placeholder="Selecciona especialidades…"
                options={espOptions}
                value={espSel}
                onChange={setEspSel}
              />
              <div className="flex items-center gap-2 mt-2 text-sm">
                <button
                  onClick={() => setEspSel([])}
                  className="px-3 py-1.5 border rounded-lg"
                  disabled={espSel.length === 0}
                  title="Limpiar selección"
                >
                  Limpiar selección ({espSel.length})
                </button>
                <span className="text-slate-500">{espSel.length} seleccionada(s)</span>
              </div>
            </div>

            <div className="col-span-12 md:col-span-6">
              <MultiSelectRS
                label="Médicos"
                placeholder="Selecciona médicos…"
                options={medOptions}
                value={medSel}
                onChange={setMedSel}
              />
              <div className="flex items-center gap-2 mt-2 text-sm">
                <button
                  onClick={() => setMedSel([])}
                  className="px-3 py-1.5 border rounded-lg"
                  disabled={medSel.length === 0}
                  title="Limpiar selección"
                >
                  Limpiar selección ({medSel.length})
                </button>
                <span className="text-slate-500">{medSel.length} seleccionado(s)</span>
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

            <button
              onClick={selectAllCuposLibres}
              disabled={cuposLibres.length === 0}
              className="px-4 py-2 border rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              title="Selecciona todos los cupos SIN ASIGNAR del resultado"
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

          <div className="flex flex-wrap gap-2 mt-1 mb-3 text-sm">
            {STATUS_ORDER.map((k) => {
              const pct = total ? ((stats[k] / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={k} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5">
                  <span className={`inline-block size-2 rounded-full ${STATUS_META[k].dot}`} />
                  <span className="font-medium">{STATUS_META[k].label}:</span>
                  <span className="tabular-nums">{stats[k]}</span>
                  <span className="text-zinc-500">({pct}%)</span>
                </div>
              );
            })}
          </div>

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
