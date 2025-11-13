// src/pages/reportes.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import Head from "next/head";
import MultiSelectRS from "@/components/MultiSelectRS";
import ModulesMenu from "@/components/ModulesMenu";

/* ============================ Tipos y helpers ============================ */

type Option = { value: string; label: string };

type Row = {
  cita_id: number | null;
  fecha: string;
  hora: string | null;
  // NUEVO:
  doc_tipo: string | null;
  doc_numero: string | null;
  // ------
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

const BADGE_META: Record<StatKey, { label: string; cls: string }> = {
  ASIGNADA: { label: "Asignada", cls: "bg-amber-100 text-amber-900 border border-amber-200" },
  ATENDIDA: { label: "Atendido", cls: "bg-emerald-100 text-emerald-900 border border-emerald-200" },
  CUMPLIDA: { label: "Activada", cls: "bg-indigo-100 text-indigo-900 border border-indigo-200" },
  SIN_ASIGNAR: { label: "Sin asignar", cls: "bg-zinc-100 text-zinc-800 border border-zinc-200" },
};

function EstadoBadge({ estado }: { estado: string | null }) {
  const k = estadoKey(estado);
  if (!k) return <span>{estado ?? ""}</span>;
  const meta = BADGE_META[k];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block ${meta.cls}`}>{meta.label}</span>;
}

const ALL_LIMIT = 1_000_000;
type LimitValue = number | "ALL";

/* ============================ Página ============================ */

export default function ReportesPage() {
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [eps, setEps] = useState<string>("");

  // legacy (no tocar)
  const [especialidad, setEspecialidad] = useState<string>("");
  const [medico, setMedico] = useState<string>("");

  const [espSel, setEspSel] = useState<Option[]>([]);
  const [medSel, setMedSel] = useState<Option[]>([]);
  const [limit, setLimit] = useState<LimitValue>(1000);

  const [checkAsignada, setCheckAsignada] = useState(true);
  const [checkAtendida, setCheckAtendida] = useState(true);
  const [checkCumplida, setCheckCumplida] = useState(true);
  const [checkSinAsignar, setCheckSinAsignar] = useState(true);

  const estadosSeleccionados = useMemo(() => {
    const arr: StatKey[] = [];
    if (checkAsignada) arr.push("ASIGNADA");
    if (checkAtendida) arr.push("ATENDIDA");
    if (checkCumplida) arr.push("CUMPLIDA");
    if (checkSinAsignar) arr.push("SIN_ASIGNAR");
    return arr;
  }, [checkAsignada, checkAtendida, checkCumplida, checkSinAsignar]);

  const [epsOpts, setEpsOpts] = useState<Option[]>([]);
  const [espOpts, setEspOpts] = useState<Option[]>([]);
  const [medOpts, setMedOpts] = useState<Option[]>([]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<Record<StatKey, number>>({
    ASIGNADA: 0,
    ATENDIDA: 0,
    CUMPLIDA: 0,
    SIN_ASIGNAR: 0,
  });
  const [total, setTotal] = useState(0);

  function recomputeStats(data: Row[]) {
    const next: Record<StatKey, number> = { ASIGNADA: 0, ATENDIDA: 0, CUMPLIDA: 0, SIN_ASIGNAR: 0 };
    for (const r of data) {
      const k = estadoKey(r.estado);
      if (k) next[k]++;
    }
    setStats(next);
    setTotal(data.length);
    return next;
  }

  useEffect(() => {
    recomputeStats(rows);
  }, [rows]);

  useEffect(() => {
    (async () => {
      try {
        const [rEps, rEsp] = await Promise.all([fetch("/api/catalog/eps"), fetch("/api/catalog/especialidades")]);
        const { options: epsOptions } = await rEps.json();
        const { options: espOptions } = await rEsp.json();
        setEpsOpts([{ value: "", label: "Todas" }, ...epsOptions]);
        setEspOpts(espOptions);
      } catch (e) {
        console.error(e);
        toast.error("No fue posible cargar catálogos.");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const qs = new URLSearchParams();
        espSel.forEach((es) => qs.append("especialidades", es.value));
        const url = "/api/catalog/medicos" + (qs.toString() ? `?${qs.toString()}` : "");
        const r = await fetch(url);
        const { options } = await r.json();
        setMedOpts(options || []);
        setMedSel((prev) => prev.filter((m) => (options || []).some((o: Option) => o.value === m.value)));
      } catch (e) {
        console.error(e);
        setMedOpts([]);
        setMedSel([]);
      }
    })();
  }, [espSel]);

  const handleBuscar = async () => {
    if (!desde || !hasta) return toast.error("Selecciona el rango de fechas.");
    if (new Date(desde) > new Date(hasta)) return toast.error("La fecha 'Desde' no puede ser mayor a 'Hasta'.");

    setLoading(true);
    try {
      const limitToSend = limit === "ALL" ? ALL_LIMIT : Number(limit);
      const body = {
        desde,
        hasta,
        eps: eps || undefined,
        especialidades: espSel.map((o) => o.value),
        medicos: medSel.map((o) => o.value),
        estados: estadosSeleccionados,
        limit: limitToSend,
        offset: 0,
      };

      const r = await fetch("/api/reportes/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "No se pudo obtener el reporte.");
      }
      const data = (await r.json()) as { rows: Row[] };
      setRows(data.rows);
      const localStats = recomputeStats(data.rows);

      toast.success(
        `Resultados: ${data.rows.length} | Asignadas: ${localStats.ASIGNADA} | Atendidas: ${localStats.ATENDIDA} | Activadas: ${localStats.CUMPLIDA} | Sin asignar: ${localStats.SIN_ASIGNAR}`
      );
    } catch (e: any) {
      console.error("Buscar error:", e);
      toast.error(e?.message ?? "Error al buscar.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!desde || !hasta) return toast.error("Selecciona el rango de fechas.");
    const q = new URLSearchParams();
    q.set("desde", desde);
    q.set("hasta", hasta);
    estadosSeleccionados.forEach((s) => q.append("estados", s));
    if (eps) q.set("eps", eps);
    espSel.forEach((o) => q.append("especialidades", o.value));
    medSel.forEach((o) => q.append("medicos", o.value));
    window.open(`/api/reportes/export?${q.toString()}`, "_blank");
  };

  const resetFiltros = () => {
    setEps("");
    setEspecialidad("");
    setMedico("");
    setEspSel([]);
    setMedSel([]);
    setCheckAsignada(true);
    setCheckAtendida(true);
    setCheckCumplida(true);
    setCheckSinAsignar(true);
    setLimit(1000);
  };

  return (
    <>
      <Head><title>Reportes DNAPLUS</title></Head>

      <div className="px-4 py-6 mx-auto max-w-[1400px]">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold">Reportes DNAPLUS</h1>
          <div className="flex items-center gap-2">
            <ModulesMenu />
            <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 text-white bg-black rounded-xl hover:opacity-90" title="Descargar Excel">
              <span>📥</span> Descargar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="p-4 border rounded-2xl">
          <h2 className="mb-4 font-medium">Filtros</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className="text-sm text-slate-700">Desde</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full h-[42px] px-3 py-2 mt-1 border rounded-lg" />
            </div>
            <div className="md:col-span-3">
              <label className="text-sm text-slate-700">Hasta</label>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full h-[42px] px-3 py-2 mt-1 border rounded-lg" />
            </div>

            <div className="md:col-span-3">
              <label className="text-sm text-slate-700">EPS</label>
              <select value={eps} onChange={(e) => setEps(e.target.value)} className="w-full h-[42px] px-3 py-2 mt-1 border rounded-lg">
                {epsOpts.map((o) => (
                  <option key={o.value || "all"} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-sm text-slate-700">Registros por página</label>
              <select
                value={limit === "ALL" ? "ALL" : String(limit)}
                onChange={(e) => setLimit(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                className="w-full h-[42px] px-3 py-2 mt-1 border rounded-lg"
              >
                {[100, 500, 1000, 5000].map((n) => <option key={n} value={n}>{n}</option>)}
                <option value="ALL">Todos</option>
              </select>
            </div>

            <div className="md:col-span-6">
              <MultiSelectRS label="Especialidad" options={espOpts} value={espSel} onChange={setEspSel} />
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                <button type="button" onClick={() => setEspSel([])} className="px-2 py-1 border rounded">Limpiar selección ({espSel.length})</button>
                <span>{espSel.length} seleccionada(s)</span>
              </div>
            </div>

            <div className="md:col-span-6">
              <MultiSelectRS label="Médico" options={medOpts} value={medSel} onChange={setMedSel} />
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600">
                <button type="button" onClick={() => setMedSel([])} className="px-2 py-1 border rounded">Limpiar selección ({medSel.length})</button>
                <span>{medSel.length} seleccionado(s)</span>
                <span className="text-slate-500">Mostrando {medOpts.length} médico(s) para {espSel.length || "todas"} especialidad(es).</span>
              </div>
            </div>

            <div className="md:col-span-12">
              <div className="grid grid-cols-2 gap-2 mt-1 md:grid-cols-4">
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={checkAsignada} onChange={(e) => setCheckAsignada(e.target.checked)} /> Asignadas</label>
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={checkAtendida} onChange={(e) => setCheckAtendida(e.target.checked)} /> Atendidas</label>
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={checkCumplida} onChange={(e) => setCheckCumplida(e.target.checked)} /> Activadas</label>
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={checkSinAsignar} onChange={(e) => setCheckSinAsignar(e.target.checked)} /> Sin asignar</label>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2 md:col-span-12">
              <button onClick={handleBuscar} disabled={loading} className="px-4 py-2 text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-60">
                {loading ? "Buscando..." : "Buscar"}
              </button>
              <button onClick={resetFiltros} className="px-4 py-2 border rounded-xl text-slate-700 hover:bg-slate-50">Limpiar filtros</button>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="p-4 mt-6 border rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Resultados ({total})</h3>
            <div className="text-sm text-slate-500">Mostrando {rows.length} registro(s)</div>
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
                  {[
                    "ID Cita",
                    "Fecha",
                    "Hora",
                    "Tipo Doc",       // NUEVO
                    "N° Documento",   // NUEVO
                    "Paciente",
                    "EPS",
                    "ID Médico",
                    "Médico",
                    "Estado",
                    "Tipo Cita (CUPS)",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500 whitespace-nowrap" colSpan={11}>Sin resultados</td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={`${r.cita_id ?? i}-${i}`} className="border-b">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{r.cita_id ?? ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.fecha}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.hora ?? ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.doc_tipo ?? ""}</td>     {/* NUEVO */}
                    <td className="px-3 py-2 whitespace-nowrap">{r.doc_numero ?? ""}</td>   {/* NUEVO */}
                    <td className="px-3 py-2 whitespace-nowrap">{r.paciente ?? ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.eps ?? ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.idmedico ?? ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.medico ?? ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><EstadoBadge estado={r.estado} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.tipo_cita ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
