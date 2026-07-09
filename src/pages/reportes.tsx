"use client";

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { toast } from "react-hot-toast";
import {
  CalendarRange,
  Download,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import PageHeader from "@/components/agenda/PageHeader";
import StatsOverview from "@/components/agenda/StatsOverview";
import StatusBadge from "@/components/agenda/StatusBadge";
import StatusMessage from "@/components/agenda/StatusMessage";
import TableStateRow from "@/components/agenda/TableStateRow";
import ModulesMenu from "@/components/ModulesMenu";
import MultiSelectRS from "@/components/MultiSelectRS";
import {
  INPUT_CLASS_NAME,
  buildStats,
  getErrorMessage,
  type AgendaRow,
  type StatKey,
} from "@/lib/agenda-ui";

type Option = { value: string; label: string };
type LimitValue = number | "ALL";

const ALL_LIMIT = 1_000_000;

const TABLE_HEADERS = [
  "ID Cita",
  "Fecha",
  "Hora",
  "Tipo Doc",
  "N° Documento",
  "Paciente",
  "Telefono",
  "EPS",
  "Medico",
  "Estado",
  "Tipo Cita (CUPS)",
];

export default function ReportesPage() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [eps, setEps] = useState("");

  const [espSel, setEspSel] = useState<Option[]>([]);
  const [medSel, setMedSel] = useState<Option[]>([]);
  const [limit, setLimit] = useState<LimitValue>(1000);

  const [checkAsignada, setCheckAsignada] = useState(true);
  const [checkAtendida, setCheckAtendida] = useState(true);
  const [checkCumplida, setCheckCumplida] = useState(true);
  const [checkSinAsignar, setCheckSinAsignar] = useState(true);

  const [epsOpts, setEpsOpts] = useState<Option[]>([]);
  const [espOpts, setEspOpts] = useState<Option[]>([]);
  const [medOpts, setMedOpts] = useState<Option[]>([]);

  const [rows, setRows] = useState<AgendaRow[]>([]);
  const [loading, setLoading] = useState(false);

  const estadosSeleccionados = useMemo(() => {
    const states: StatKey[] = [];
    if (checkAsignada) states.push("ASIGNADA");
    if (checkAtendida) states.push("ATENDIDA");
    if (checkCumplida) states.push("CUMPLIDA");
    if (checkSinAsignar) states.push("SIN_ASIGNAR");
    return states;
  }, [checkAsignada, checkAtendida, checkCumplida, checkSinAsignar]);

  const stats = useMemo(() => buildStats(rows), [rows]);
  const total = rows.length;
  const statusFilters = [
    {
      key: "ASIGNADA" as const,
      label: "Asignadas",
      checked: checkAsignada,
      onChange: setCheckAsignada,
    },
    {
      key: "ATENDIDA" as const,
      label: "Atendidas",
      checked: checkAtendida,
      onChange: setCheckAtendida,
    },
    {
      key: "CUMPLIDA" as const,
      label: "Activadas",
      checked: checkCumplida,
      onChange: setCheckCumplida,
    },
    {
      key: "SIN_ASIGNAR" as const,
      label: "Sin asignar",
      checked: checkSinAsignar,
      onChange: setCheckSinAsignar,
    },
  ];

  const dateRangeMessage = useMemo(() => {
    if (!desde || !hasta) {
      return "Selecciona fecha inicial y final para habilitar la busqueda y la exportacion.";
    }
    if (desde > hasta) {
      return "La fecha inicial no puede ser mayor que la fecha final.";
    }
    return "";
  }, [desde, hasta]);

  const canRunQuery = !loading && !dateRangeMessage;

  useEffect(() => {
    (async () => {
      try {
        const [epsResponse, espResponse] = await Promise.all([
          fetch("/api/catalog/eps"),
          fetch("/api/catalog/especialidades"),
        ]);
        const { options: epsOptions } = await epsResponse.json();
        const { options: espOptions } = await espResponse.json();

        setEpsOpts([{ value: "", label: "Todas" }, ...epsOptions]);
        setEspOpts(espOptions);
      } catch (error) {
        console.error(error);
        toast.error("No fue posible cargar catalogos.");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const query = new URLSearchParams();
        espSel.forEach((option) => query.append("especialidades", option.value));

        const url = "/api/catalog/medicos" + (query.toString() ? `?${query.toString()}` : "");
        const response = await fetch(url);
        const { options } = await response.json();

        setMedOpts(options || []);
        setMedSel((prev) =>
          prev.filter((item) => (options || []).some((option: Option) => option.value === item.value)),
        );
      } catch (error) {
        console.error(error);
        setMedOpts([]);
        setMedSel([]);
      }
    })();
  }, [espSel]);

  const handleBuscar = async () => {
    if (!desde || !hasta) return toast.error("Selecciona el rango de fechas.");
    if (desde > hasta) return toast.error("La fecha 'Desde' no puede ser mayor a 'Hasta'.");

    setLoading(true);

    try {
      const body = {
        desde,
        hasta,
        eps: eps || undefined,
        especialidades: espSel.map((option) => option.value),
        medicos: medSel.map((option) => option.value),
        estados: estadosSeleccionados,
        limit: limit === "ALL" ? ALL_LIMIT : Number(limit),
        offset: 0,
      };

      const response = await fetch("/api/reportes/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "No se pudo obtener el reporte.");
      }

      const data = (await response.json()) as { rows: AgendaRow[] };
      const nextRows = data.rows;
      const nextStats = buildStats(nextRows);

      setRows(nextRows);
      toast.success(
        `Resultados: ${nextRows.length} | Asignadas: ${nextStats.ASIGNADA} | Atendidas: ${nextStats.ATENDIDA} | Activadas: ${nextStats.CUMPLIDA} | Sin asignar: ${nextStats.SIN_ASIGNAR}`,
      );
    } catch (error: unknown) {
      console.error("Buscar error:", error);
      toast.error(getErrorMessage(error, "Error al buscar."));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!desde || !hasta) return toast.error("Selecciona el rango de fechas.");

    const query = new URLSearchParams();
    query.set("desde", desde);
    query.set("hasta", hasta);
    estadosSeleccionados.forEach((state) => query.append("estados", state));
    if (eps) query.set("eps", eps);
    espSel.forEach((option) => query.append("especialidades", option.value));
    medSel.forEach((option) => query.append("medicos", option.value));

    window.open(`/api/reportes/export?${query.toString()}`, "_blank");
  };

  const resetFiltros = () => {
    setDesde("");
    setHasta("");
    setEps("");
    setEspSel([]);
    setMedSel([]);
    setCheckAsignada(true);
    setCheckAtendida(true);
    setCheckCumplida(true);
    setCheckSinAsignar(true);
    setLimit(1000);
    setRows([]);
  };

  return (
    <>
      <Head>
        <title>Reportes DNAPLUS</title>
      </Head>

      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <PageHeader
          title="Reportes"
          description="Consulta agenda, filtra por especialidad o medico y exporta el resultado actual sin cambiar la logica del reporte."
          aside={<ModulesMenu />}
        />

        <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Filtros principales
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Empieza por el rango de fechas y luego afina el resultado solo si
                lo necesitas.
              </p>
            </div>

            <StatusMessage
              icon={CalendarRange}
              message={dateRangeMessage || "Rango de fechas listo para consultar y exportar."}
              tone={dateRangeMessage ? "warning" : "success"}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-3">
              <label htmlFor="reporte-desde" className="text-sm font-medium text-slate-700">
                Desde
              </label>
              <input
                id="reporte-desde"
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className={[
                  INPUT_CLASS_NAME,
                  dateRangeMessage && desde && hasta ? "border-amber-300 focus:ring-amber-500/10" : "",
                ].join(" ")}
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="reporte-hasta" className="text-sm font-medium text-slate-700">
                Hasta
              </label>
              <input
                id="reporte-hasta"
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className={[
                  INPUT_CLASS_NAME,
                  dateRangeMessage && desde && hasta ? "border-amber-300 focus:ring-amber-500/10" : "",
                ].join(" ")}
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="reporte-eps" className="text-sm font-medium text-slate-700">
                EPS
              </label>
              <select
                id="reporte-eps"
                value={eps}
                onChange={(event) => setEps(event.target.value)}
                className={INPUT_CLASS_NAME}
              >
                {epsOpts.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label htmlFor="reporte-limit" className="text-sm font-medium text-slate-700">
                Registros por consulta
              </label>
              <select
                id="reporte-limit"
                value={limit === "ALL" ? "ALL" : String(limit)}
                onChange={(event) =>
                  setLimit(event.target.value === "ALL" ? "ALL" : Number(event.target.value))
                }
                className={INPUT_CLASS_NAME}
              >
                {[100, 500, 1000, 5000].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value="ALL">Todos</option>
              </select>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Filtros detallados
                </h3>
                <p className="text-sm text-slate-600">
                  Especialidad, medico y estados ayudan a reducir el volumen sin
                  recargar la pantalla principal.
                </p>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Opcionales
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-6">
                <MultiSelectRS
                  label="Especialidad"
                  placeholder="Filtra por especialidad..."
                  options={espOpts}
                  value={espSel}
                  onChange={setEspSel}
                  summaryLabel="especialidades"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium">
                    {espSel.length} seleccionada(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => setEspSel([])}
                    disabled={espSel.length === 0}
                    className="rounded-full border border-slate-300 px-2.5 py-1 font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="md:col-span-6">
                <MultiSelectRS
                  label="Medico"
                  placeholder="Filtra por medico..."
                  options={medOpts}
                  value={medSel}
                  onChange={setMedSel}
                  summaryLabel="medicos"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium">
                    {medSel.length} seleccionado(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => setMedSel([])}
                    disabled={medSel.length === 0}
                    className="rounded-full border border-slate-300 px-2.5 py-1 font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Limpiar
                  </button>
                  <span className="text-slate-500">
                    {medOpts.length} medico(s) disponibles con la seleccion actual.
                  </span>
                </div>
              </div>

              <fieldset className="md:col-span-12">
                <legend className="text-sm font-medium text-slate-700">
                  Estados incluidos
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {statusFilters.map((option) => {
                    return (
                      <label
                        key={option.key}
                        className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={option.checked}
                          onChange={(event) => option.onChange(event.target.checked)}
                          className="h-4 w-4 rounded border-slate-400 text-cyan-700 focus:ring-cyan-600"
                        />
                        <span className="font-medium">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleBuscar}
              disabled={!canRunQuery}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Search className="h-4 w-4" />
              {loading ? "Buscando..." : "Buscar"}
            </button>

            <button
              type="button"
              onClick={resetFiltros}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
              Restablecer filtros
            </button>

            <p className="text-sm text-slate-500">
              La exportacion utiliza exactamente los filtros visibles.
            </p>
          </div>
        </section>

        <section
          className="mt-6 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm"
          aria-busy={loading}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Resultados</h2>
              <p className="mt-1 text-sm text-slate-600">
                {rows.length > 0
                  ? `Mostrando ${rows.length} registro(s) para los filtros actuales.`
                  : canRunQuery
                    ? "Ejecuta la consulta para cargar resultados o exportar a Excel."
                    : "Completa un rango valido para empezar."}
              </p>
            </div>

            <button
              onClick={handleExport}
              disabled={!canRunQuery}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              title="Exportar el reporte actual a Excel"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </button>
          </div>

          <StatsOverview stats={stats} total={total} />

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Resultados del reporte de citas</caption>
              <thead className="bg-slate-50">
                <tr className="text-left">
                  {TABLE_HEADERS.map((header) => (
                    <th
                      key={header}
                      className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <TableStateRow
                    colSpan={TABLE_HEADERS.length}
                    loading={loading}
                    emptyTitle="Aun no hay resultados visibles."
                    emptyDescription="Usa un rango valido y pulsa Buscar."
                  />
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`${row.cita_id ?? index}-${index}`}
                      className="border-b border-slate-200 bg-white even:bg-slate-50/50 hover:bg-cyan-50/50"
                    >
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-700">
                        {row.cita_id ?? ""}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{row.fecha}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{row.hora ?? ""}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{row.doc_tipo ?? ""}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{row.doc_numero ?? ""}</td>
                      <td className="px-3 py-3 text-slate-700">
                        <div className="max-w-[220px] truncate" title={row.paciente ?? ""}>
                          {row.paciente ?? ""}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {row.telefono ?? ""}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div className="max-w-[180px] truncate" title={row.eps ?? ""}>
                          {row.eps ?? ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div className="max-w-[220px] truncate" title={row.medico ?? ""}>
                          {row.medico ?? ""}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <StatusBadge estado={row.estado} />
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div className="max-w-[240px] truncate" title={row.tipo_cita ?? ""}>
                          {row.tipo_cita ?? ""}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
