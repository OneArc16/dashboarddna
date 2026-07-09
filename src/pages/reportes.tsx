"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { toast } from "react-hot-toast";
import {
  CalendarRange,
  Download,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import FieldError from "@/components/agenda/FieldError";
import PageHeader from "@/components/agenda/PageHeader";
import ResponsiveResultsTable from "@/components/agenda/ResponsiveResultsTable";
import StatsOverview from "@/components/agenda/StatsOverview";
import StatusMessage from "@/components/agenda/StatusMessage";
import ModulesMenu from "@/components/ModulesMenu";
import MultiSelectRS, { type RSOption } from "@/components/MultiSelectRS";
import {
  createOptionPlaceholders,
  filterSelectedOptions,
  getOptionValues,
  normalizeSelectedOptions,
  parseQueryCsv,
  parseQueryLimit,
  parseQueryValue,
  toQueryParams,
  useAgendaFilters,
} from "@/hooks/useAgendaFilters";
import { useAgendaValidation } from "@/hooks/useAgendaValidation";
import {
  INPUT_CLASS_NAME,
  INPUT_INVALID_CLASS_NAME,
  STATUS_META,
  STATUS_ORDER,
  buildStats,
  getErrorMessage,
  type AgendaRow,
  type StatKey,
} from "@/lib/agenda-ui";

type LimitValue = number | "ALL";
type ResultNoticeTone = "success" | "danger" | "info";
type ReportField = "desde" | "hasta";
type ReportFiltersState = {
  desde: string;
  hasta: string;
  eps: string;
  espSel: RSOption[];
  medSel: RSOption[];
  selectedStates: StatKey[];
  limit: LimitValue;
};

const ALL_LIMIT = 1_000_000;
const DEFAULT_LIMIT: LimitValue = 1000;
const DEFAULT_SELECTED_STATES = [...STATUS_ORDER];

const normalizeStates = (values: string[]) => {
  if (values.length === 1 && values[0] === "NONE") return [];

  const nextStates = values.filter((value): value is StatKey =>
    STATUS_ORDER.includes(value as StatKey),
  );

  return values.length === 0 ? [...DEFAULT_SELECTED_STATES] : nextStates;
};

const createDefaultResultsNotice = () => ({
  tone: "info" as const,
  message: "Ajusta el rango y pulsa Buscar para cargar resultados.",
});

export default function ReportesPage() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [eps, setEps] = useState("");
  const [espSel, setEspSel] = useState<RSOption[]>([]);
  const [medSel, setMedSel] = useState<RSOption[]>([]);
  const [limit, setLimit] = useState<LimitValue>(DEFAULT_LIMIT);
  const [selectedStates, setSelectedStates] = useState<StatKey[]>(DEFAULT_SELECTED_STATES);
  const [epsOpts, setEpsOpts] = useState<RSOption[]>([]);
  const [espOpts, setEspOpts] = useState<RSOption[]>([]);
  const [medOpts, setMedOpts] = useState<RSOption[]>([]);
  const [rows, setRows] = useState<AgendaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultsNotice, setResultsNotice] = useState<{
    tone: ResultNoticeTone;
    message: string;
  }>(createDefaultResultsNotice());

  const desdeRef = useRef<HTMLInputElement>(null);
  const hastaRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => buildStats(rows), [rows]);
  const total = rows.length;

  const fieldErrors = useMemo(() => {
    const nextErrors: Partial<Record<ReportField, string>> = {};

    if (!desde) nextErrors.desde = "Selecciona la fecha inicial.";
    if (!hasta) nextErrors.hasta = "Selecciona la fecha final.";

    if (desde && hasta && desde > hasta) {
      nextErrors.desde = "La fecha inicial no puede ser mayor que la fecha final.";
      nextErrors.hasta = "La fecha final debe ser igual o posterior a la fecha inicial.";
    }

    return nextErrors;
  }, [desde, hasta]);

  const validation = useAgendaValidation<ReportField>({
    errors: fieldErrors,
    fieldOrder: ["desde", "hasta"],
    fieldRefs: {
      desde: desdeRef,
      hasta: hastaRef,
    },
  });

  const hasValidationErrors = Boolean(fieldErrors.desde || fieldErrors.hasta);
  const hasActiveFilters =
    Boolean(desde || hasta || eps) ||
    espSel.length > 0 ||
    medSel.length > 0 ||
    selectedStates.length !== STATUS_ORDER.length ||
    limit !== DEFAULT_LIMIT;

  const filterState = useMemo<ReportFiltersState>(
    () => ({
      desde,
      hasta,
      eps,
      espSel,
      medSel,
      selectedStates,
      limit,
    }),
    [desde, hasta, eps, espSel, medSel, selectedStates, limit],
  );

  const querySync = useAgendaFilters<ReportFiltersState>({
    state: filterState,
    parse: (query) => {
      const parsedLimit = parseQueryLimit(query, "limit");

      return {
        desde: parseQueryValue(query, "desde"),
        hasta: parseQueryValue(query, "hasta"),
        eps: parseQueryValue(query, "eps"),
        espSel: createOptionPlaceholders(parseQueryCsv(query, "especialidades")),
        medSel: createOptionPlaceholders(parseQueryCsv(query, "medicos")),
        selectedStates: normalizeStates(parseQueryCsv(query, "estados")),
        limit:
          typeof parsedLimit === "number" || parsedLimit === "ALL"
            ? parsedLimit
            : DEFAULT_LIMIT,
      };
    },
    serialize: (state) =>
      toQueryParams([
        ["desde", state.desde],
        ["hasta", state.hasta],
        ["eps", state.eps],
        ["especialidades", getOptionValues(state.espSel).join(",")],
        ["medicos", getOptionValues(state.medSel).join(",")],
        ["estados", state.selectedStates.length > 0 ? state.selectedStates.join(",") : "NONE"],
        ["limit", state.limit === "ALL" ? "ALL" : state.limit],
      ]),
    apply: (nextState) => {
      setDesde(nextState.desde);
      setHasta(nextState.hasta);
      setEps(nextState.eps);
      setEspSel(nextState.espSel);
      setMedSel(nextState.medSel);
      setSelectedStates(nextState.selectedStates);
      setLimit(nextState.limit);
    },
  });

  const statusFilters = STATUS_ORDER.map((key) => ({
    key,
    label: STATUS_META[key].filterLabel,
    helperText: STATUS_META[key].helperText,
    checked: selectedStates.includes(key),
  }));

  const formMessage = useMemo(() => {
    if (hasValidationErrors) {
      return {
        tone: "warning" as const,
        message: "Corrige el rango de fechas para habilitar la consulta y la exportacion.",
      };
    }

    if (!desde || !hasta) {
      return {
        tone: "warning" as const,
        message: "Selecciona fecha inicial y final para preparar la consulta.",
      };
    }

    return {
      tone: "success" as const,
      message: "Rango listo. Puedes buscar o exportar usando los filtros visibles.",
    };
  }, [desde, hasta, hasValidationErrors]);

  const resultsStatus = useMemo(() => {
    if (loading) {
      return {
        tone: "info" as const,
        message: "Actualizando resultados con los filtros actuales...",
      };
    }

    if (exporting) {
      return {
        tone: "info" as const,
        message: "Preparando el archivo de exportacion con los filtros visibles...",
      };
    }

    if (rows.length > 0 || hasSearched) {
      return resultsNotice;
    }

    if (querySync.hasQueryState && hasActiveFilters) {
      return {
        tone: "info" as const,
        message: "Filtros restaurados desde la URL. Pulsa Buscar para cargar resultados.",
      };
    }

    return resultsNotice;
  }, [
    exporting,
    hasActiveFilters,
    hasSearched,
    loading,
    querySync.hasQueryState,
    resultsNotice,
    rows.length,
  ]);

  useEffect(() => {
    (async () => {
      try {
        const [epsResponse, espResponse] = await Promise.all([
          fetch("/api/catalog/eps"),
          fetch("/api/catalog/especialidades"),
        ]);

        const { options: epsOptions } = await epsResponse.json();
        const { options: espOptionsRaw } = await espResponse.json();

        setEpsOpts([{ value: "", label: "Todas" }, ...(epsOptions as RSOption[])]);
        setEspOpts((espOptionsRaw as RSOption[]) ?? []);
      } catch (error) {
        console.error(error);
        toast.error("No fue posible cargar catalogos.");
      }
    })();
  }, []);

  useEffect(() => {
    if (espOpts.length === 0) return;

    setEspSel((prev) => normalizeSelectedOptions(prev, espOpts));
  }, [espOpts]);

  useEffect(() => {
    (async () => {
      try {
        const query = new URLSearchParams();
        getOptionValues(espSel).forEach((value) => query.append("especialidades", value));

        const response = await fetch(
          "/api/catalog/medicos" + (query.toString() ? `?${query.toString()}` : ""),
        );
        const { options } = await response.json();

        const nextOptions = (options as RSOption[]) ?? [];
        setMedOpts(nextOptions);
        setMedSel((prev) => normalizeSelectedOptions(filterSelectedOptions(prev, nextOptions), nextOptions));
      } catch (error) {
        console.error(error);
        setMedOpts([]);
        setMedSel([]);
      }
    })();
  }, [espSel]);

  const toggleStatus = (stateKey: StatKey, checked: boolean) => {
    setSelectedStates((prev) => {
      if (checked) {
        return prev.includes(stateKey) ? prev : [...prev, stateKey];
      }

      return prev.filter((item) => item !== stateKey);
    });
  };

  const handleBuscar = async () => {
    if (!validation.validate()) return;

    setHasSearched(true);
    setLoading(true);
    setResultsNotice({
      tone: "info",
      message: "Actualizando resultados con los filtros actuales...",
    });

    try {
      const response = await fetch("/api/reportes/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desde,
          hasta,
          eps: eps || undefined,
          especialidades: getOptionValues(espSel),
          medicos: getOptionValues(medSel),
          estados: selectedStates,
          limit: limit === "ALL" ? ALL_LIMIT : Number(limit),
          offset: 0,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "No se pudo obtener el reporte.");
      }

      const data = (await response.json()) as { rows: AgendaRow[] };
      const nextRows = data.rows ?? [];
      const nextStats = buildStats(nextRows);

      setRows(nextRows);
      setResultsNotice({
        tone: "success",
        message: `Consulta lista. ${nextRows.length} registro(s) cargados: ${nextStats.ASIGNADA} asignadas, ${nextStats.ATENDIDA} atendidas, ${nextStats.CUMPLIDA} activadas y ${nextStats.SIN_ASIGNAR} sin asignar.`,
      });
    } catch (error: unknown) {
      console.error("Buscar error:", error);
      const message = getErrorMessage(error, "Error al buscar.");
      setResultsNotice({
        tone: "danger",
        message,
      });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!validation.validate()) return;

    setExporting(true);

    try {
      const query = new URLSearchParams();
      query.set("desde", desde);
      query.set("hasta", hasta);
      selectedStates.forEach((state) => query.append("estados", state));
      if (eps) query.set("eps", eps);
      getOptionValues(espSel).forEach((value) => query.append("especialidades", value));
      getOptionValues(medSel).forEach((value) => query.append("medicos", value));

      window.open(`/api/reportes/export?${query.toString()}`, "_blank");
      setResultsNotice({
        tone: "info",
        message: "La exportacion se abrio con los filtros visibles actualmente.",
      });
    } catch (error) {
      console.error(error);
      toast.error("No fue posible preparar la exportacion.");
    } finally {
      window.setTimeout(() => {
        setExporting(false);
      }, 1200);
    }
  };

  const resetFiltros = () => {
    setDesde("");
    setHasta("");
    setEps("");
    setEspSel([]);
    setMedSel([]);
    setSelectedStates([...DEFAULT_SELECTED_STATES]);
    setLimit(DEFAULT_LIMIT);
    setRows([]);
    setHasSearched(false);
    setResultsNotice(createDefaultResultsNotice());
    validation.resetValidation();
  };

  const desdeError = validation.getFieldError("desde");
  const hastaError = validation.getFieldError("hasta");

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
              <h2 className="text-lg font-semibold text-slate-900">Filtros principales</h2>
              <p className="mt-1 text-sm text-slate-600">
                Empieza por el rango de fechas y afina solo lo necesario para reducir ruido.
              </p>
            </div>

            <StatusMessage
              icon={CalendarRange}
              message={formMessage.message}
              tone={formMessage.tone}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-3">
              <label htmlFor="reporte-desde" className="text-sm font-medium text-slate-700">
                Desde
              </label>
              <input
                ref={desdeRef}
                id="reporte-desde"
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                onBlur={() => validation.markTouched("desde")}
                aria-invalid={Boolean(desdeError)}
                aria-describedby={desdeError ? "reporte-desde-error" : undefined}
                className={[
                  INPUT_CLASS_NAME,
                  desdeError ? INPUT_INVALID_CLASS_NAME : "",
                ].join(" ")}
              />
              <FieldError id="reporte-desde-error" message={desdeError} />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="reporte-hasta" className="text-sm font-medium text-slate-700">
                Hasta
              </label>
              <input
                ref={hastaRef}
                id="reporte-hasta"
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                onBlur={() => validation.markTouched("hasta")}
                aria-invalid={Boolean(hastaError)}
                aria-describedby={hastaError ? "reporte-hasta-error" : undefined}
                className={[
                  INPUT_CLASS_NAME,
                  hastaError ? INPUT_INVALID_CLASS_NAME : "",
                ].join(" ")}
              />
              <FieldError id="reporte-hasta-error" message={hastaError} />
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
                <h3 className="text-sm font-semibold text-slate-900">Filtros detallados</h3>
                <p className="text-sm text-slate-600">
                  Especialidad, medico y estados ayudan a reducir volumen sin recargar la pantalla
                  principal.
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
                  helperText={`Escribe para filtrar. ${espOpts.length} especialidad(es) disponibles.`}
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
                  helperText={
                    espSel.length > 0
                      ? `Escribe para filtrar. ${medOpts.length} medico(s) disponibles para la especialidad actual.`
                      : `Escribe para filtrar. ${medOpts.length} medico(s) disponibles en total.`
                  }
                  noOptionsMessage={
                    espSel.length > 0
                      ? "No hay medicos para la especialidad seleccionada."
                      : "Sin coincidencias."
                  }
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
                    {espSel.length > 0
                      ? "La lista se ajusta automaticamente a la especialidad seleccionada."
                      : "La lista muestra todos los medicos disponibles."}
                  </span>
                </div>
              </div>

              <fieldset className="md:col-span-12">
                <legend className="text-sm font-medium text-slate-700">Estados incluidos</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {statusFilters.map((option) => (
                    <label
                      key={option.key}
                      className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={option.checked}
                        onChange={(event) => toggleStatus(option.key, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-400 text-cyan-700 focus:ring-cyan-600"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{option.label}</span>
                        <span className="block text-xs text-slate-500">{option.helperText}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={handleBuscar}
              disabled={loading}
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
              Los filtros se conservan en la URL para que puedas recargar, compartir o retomar la
              consulta sin reconfigurarla.
            </p>
          </div>
        </section>

        <section
          className="mt-6 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm"
          aria-busy={loading || exporting}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Resultados</h2>
              <p className="mt-1 text-sm text-slate-600">
                {rows.length > 0
                  ? `Mostrando ${rows.length} registro(s) para los filtros actuales.`
                  : "La tabla y las tarjetas muestran el mismo resultado segun el ancho de pantalla."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={loading || exporting}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              title="Exportar el reporte actual a Excel"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Preparando archivo..." : "Exportar Excel"}
            </button>
          </div>

          <StatusMessage
            icon={loading || exporting ? Search : CalendarRange}
            message={resultsStatus.message}
            tone={resultsStatus.tone}
            className="mt-4"
          />

          <StatsOverview stats={stats} total={total} />

          <ResponsiveResultsTable
            rows={rows}
            loading={loading}
            caption="Resultados del reporte de citas"
            emptyTitle="Aun no hay resultados visibles."
            emptyDescription={
              hasSearched
                ? "No se encontraron registros para los filtros actuales."
                : querySync.hasQueryState
                ? "Los filtros ya estan listos. Pulsa Buscar para cargar resultados."
                : "Define un rango valido y pulsa Buscar."
            }
          />
        </section>
      </div>
    </>
  );
}
