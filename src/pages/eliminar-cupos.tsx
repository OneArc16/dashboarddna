"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  CalendarRange,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import FieldError from "@/components/agenda/FieldError";
import PageHeader from "@/components/agenda/PageHeader";
import ResponsiveResultsTable from "@/components/agenda/ResponsiveResultsTable";
import SelectionActionBar from "@/components/agenda/SelectionActionBar";
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
  parseQueryValue,
  toQueryParams,
  useAgendaFilters,
} from "@/hooks/useAgendaFilters";
import { useAgendaValidation } from "@/hooks/useAgendaValidation";
import {
  INPUT_CLASS_NAME,
  INPUT_INVALID_CLASS_NAME,
  buildStats,
  estadoKey,
  getErrorMessage,
  type AgendaRow,
} from "@/lib/agenda-ui";

type CuposListPayload = {
  desde: string;
  hasta: string;
  horaDesde?: string;
  horaHasta?: string;
  eps?: string;
  especialidad?: string[];
  especialidades?: string[];
  especialidadCsv?: string;
  especialidadesCsv?: string;
  medicos?: string[];
  medicosCsv?: string;
};

type DeleteField = "desde" | "hasta" | "horaDesde" | "horaHasta";
type DeleteFiltersState = {
  desde: string;
  hasta: string;
  horaDesde: string;
  horaHasta: string;
  eps: string;
  espSel: RSOption[];
  medSel: RSOption[];
};

const createDefaultResultsNotice = () => ({
  tone: "info" as const,
  message: "Ajusta el rango y pulsa Buscar para revisar los cupos disponibles.",
});

const toValues = (options: RSOption[]) => options.map((option) => option.value);

function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const ask = () =>
    new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpen(true);
    });

  const onCancel = () => {
    setOpen(false);
    resolverRef.current?.(false);
  };

  const onAccept = () => {
    setOpen(false);
    resolverRef.current?.(true);
  };

  return { open, ask, onCancel, onAccept };
}

function ConfirmModal({
  open,
  count,
  onCancel,
  onAccept,
}: {
  open: boolean;
  count: number;
  onCancel: () => void;
  onAccept: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = [cancelRef.current, acceptRef.current].filter(Boolean) as HTMLButtonElement[];
      if (focusable.length === 0) return;

      const currentIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);

      if (event.shiftKey) {
        if (currentIndex <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1]?.focus();
        }
        return;
      }

      if (currentIndex === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => acceptRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previousFocusRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div
        aria-modal="true"
        role="dialog"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-description"
        className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
            <Trash2 className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 id="confirm-delete-title" className="text-lg font-semibold text-slate-900">
              Confirmar eliminacion
            </h2>
            <p id="confirm-delete-description" className="mt-1 text-sm text-slate-600">
              Vas a eliminar {count} cupo{count === 1 ? "" : "s"} libre
              {count === 1 ? "" : "s"}. Esta accion no se puede deshacer.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
          Solo se eliminaran registros con estado <strong>SIN ASIGNAR</strong>.
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            ref={acceptRef}
            type="button"
            onClick={onAccept}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar definitivamente
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function EliminarCuposPage() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [horaDesde, setHoraDesde] = useState("");
  const [horaHasta, setHoraHasta] = useState("");
  const [eps, setEps] = useState("");
  const [espOptions, setEspOptions] = useState<RSOption[]>([]);
  const [espSel, setEspSel] = useState<RSOption[]>([]);
  const [medOptions, setMedOptions] = useState<RSOption[]>([]);
  const [medSel, setMedSel] = useState<RSOption[]>([]);
  const [epsOpts, setEpsOpts] = useState<RSOption[]>([]);
  const [rows, setRows] = useState<AgendaRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultsNotice, setResultsNotice] = useState<{
    tone: "success" | "danger" | "info";
    message: string;
  }>(createDefaultResultsNotice());

  const confirmDialog = useConfirmDialog();

  const desdeRef = useRef<HTMLInputElement>(null);
  const hastaRef = useRef<HTMLInputElement>(null);
  const horaDesdeRef = useRef<HTMLInputElement>(null);
  const horaHastaRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => buildStats(rows), [rows]);
  const total = rows.length;

  const cuposLibres = useMemo(
    () => rows.filter((row) => estadoKey(row.estado) === "SIN_ASIGNAR" && row.cita_id != null),
    [rows],
  );

  const selectedCount = selectedIds.length;
  const allSelectableIds = useMemo(() => cuposLibres.map((row) => row.cita_id!), [cuposLibres]);
  const allSelected =
    allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedIds.includes(id));

  const fieldErrors = useMemo(() => {
    const nextErrors: Partial<Record<DeleteField, string>> = {};

    if (!desde) nextErrors.desde = "Selecciona la fecha inicial.";
    if (!hasta) nextErrors.hasta = "Selecciona la fecha final.";

    if (desde && hasta && desde > hasta) {
      nextErrors.desde = "La fecha inicial no puede ser mayor que la fecha final.";
      nextErrors.hasta = "La fecha final debe ser igual o posterior a la fecha inicial.";
    }

    if (horaDesde && horaHasta && horaDesde > horaHasta) {
      nextErrors.horaDesde = "La hora inicial no puede ser mayor que la hora final.";
      nextErrors.horaHasta = "La hora final debe ser igual o posterior a la hora inicial.";
    }

    return nextErrors;
  }, [desde, hasta, horaDesde, horaHasta]);

  const validation = useAgendaValidation<DeleteField>({
    errors: fieldErrors,
    fieldOrder: ["desde", "hasta", "horaDesde", "horaHasta"],
    fieldRefs: {
      desde: desdeRef,
      hasta: hastaRef,
      horaDesde: horaDesdeRef,
      horaHasta: horaHastaRef,
    },
  });

  const hasValidationErrors = Object.keys(fieldErrors).length > 0;
  const hasActiveFilters =
    Boolean(desde || hasta || horaDesde || horaHasta || eps) ||
    espSel.length > 0 ||
    medSel.length > 0;

  const filterState = useMemo<DeleteFiltersState>(
    () => ({
      desde,
      hasta,
      horaDesde,
      horaHasta,
      eps,
      espSel,
      medSel,
    }),
    [desde, hasta, horaDesde, horaHasta, eps, espSel, medSel],
  );

  const querySync = useAgendaFilters<DeleteFiltersState>({
    state: filterState,
    parse: (query) => ({
      desde: parseQueryValue(query, "desde"),
      hasta: parseQueryValue(query, "hasta"),
      horaDesde: parseQueryValue(query, "horaDesde"),
      horaHasta: parseQueryValue(query, "horaHasta"),
      eps: parseQueryValue(query, "eps"),
      espSel: createOptionPlaceholders(parseQueryCsv(query, "especialidades")),
      medSel: createOptionPlaceholders(parseQueryCsv(query, "medicos")),
    }),
    serialize: (state) =>
      toQueryParams([
        ["desde", state.desde],
        ["hasta", state.hasta],
        ["horaDesde", state.horaDesde],
        ["horaHasta", state.horaHasta],
        ["eps", state.eps],
        ["especialidades", getOptionValues(state.espSel).join(",")],
        ["medicos", getOptionValues(state.medSel).join(",")],
      ]),
    apply: (nextState) => {
      setDesde(nextState.desde);
      setHasta(nextState.hasta);
      setHoraDesde(nextState.horaDesde);
      setHoraHasta(nextState.horaHasta);
      setEps(nextState.eps);
      setEspSel(nextState.espSel);
      setMedSel(nextState.medSel);
    },
  });

  const formMessage = useMemo(() => {
    if (hasValidationErrors) {
      return {
        tone: "warning" as const,
        message: "Corrige el rango o las horas antes de ejecutar la busqueda.",
      };
    }

    if (!desde || !hasta) {
      return {
        tone: "warning" as const,
        message: "Selecciona fecha inicial y final para preparar la busqueda.",
      };
    }

    return {
      tone: "success" as const,
      message: "Rango listo. Solo se podran seleccionar cupos sin asignar.",
    };
  }, [desde, hasta, hasValidationErrors]);

  const resultsStatus = useMemo(() => {
    if (loading) {
      return {
        tone: "info" as const,
        message: "Actualizando la lista de cupos con los filtros actuales...",
      };
    }

    if (deleting) {
      return {
        tone: "info" as const,
        message: "Eliminando los cupos seleccionados...",
      };
    }

    if (rows.length > 0 || hasSearched) {
      return resultsNotice;
    }

    if (querySync.hasQueryState && hasActiveFilters) {
      return {
        tone: "info" as const,
        message: "Filtros restaurados desde la URL. Pulsa Buscar para revisar los cupos.",
      };
    }

    return resultsNotice;
  }, [
    deleting,
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
        setEspOptions((espOptionsRaw as RSOption[]).filter((option) => option.value));
      } catch (error) {
        console.error(error);
        toast.error("No fue posible cargar catalogos.");
      }
    })();
  }, []);

  useEffect(() => {
    if (espOptions.length === 0) return;

    setEspSel((prev) => normalizeSelectedOptions(prev, espOptions));
  }, [espOptions]);

  useEffect(() => {
    (async () => {
      try {
        if (espSel.length === 0) {
          const response = await fetch("/api/catalog/medicos");
          const { options } = await response.json().catch(() => ({
            options: [] as RSOption[],
          }));

          const nextOptions = (options as RSOption[]) ?? [];
          setMedOptions(nextOptions);
          setMedSel((prev) => normalizeSelectedOptions(filterSelectedOptions(prev, nextOptions), nextOptions));
          return;
        }

        const query = new URLSearchParams();
        toValues(espSel).forEach((code) => query.append("especialidad", code));

        const response = await fetch(`/api/catalog/medicos?${query.toString()}`);
        const { options } = await response.json().catch(() => ({
          options: [] as RSOption[],
        }));

        const nextOptions = (options as RSOption[]) ?? [];
        setMedOptions(nextOptions);
        setMedSel((prev) => normalizeSelectedOptions(filterSelectedOptions(prev, nextOptions), nextOptions));
      } catch (error) {
        console.error(error);
        setMedOptions([]);
        setMedSel([]);
      }
    })();
  }, [espSel]);

  const handleBuscar = async () => {
    if (!validation.validate()) return;

    setHasSearched(true);
    setLoading(true);
    setSelectedIds([]);
    setResultsNotice({
      tone: "info",
      message: "Actualizando la lista de cupos con los filtros actuales...",
    });

    const especialidades = toValues(espSel);
    const medicos = toValues(medSel);

    const payload: CuposListPayload = {
      desde,
      hasta,
      horaDesde: horaDesde || undefined,
      horaHasta: horaHasta || undefined,
      eps: eps || undefined,
    };

    if (especialidades.length) {
      const especialidadesCsv = especialidades.join(",");
      payload.especialidad = especialidades;
      payload.especialidades = especialidades;
      payload.especialidadCsv = especialidadesCsv;
      payload.especialidadesCsv = especialidadesCsv;
    }

    if (medicos.length) {
      payload.medicos = medicos;
      payload.medicosCsv = medicos.join(",");
    }

    try {
      const response = await fetch("/api/cupos/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "No se pudo obtener la lista de cupos.");
      }

      const data = (await response.json()) as { rows: AgendaRow[] };
      const nextRows = data?.rows || [];
      const nextCuposLibres = nextRows.filter(
        (row) => estadoKey(row.estado) === "SIN_ASIGNAR" && row.cita_id != null,
      ).length;

      setRows(nextRows);
      setResultsNotice({
        tone: "success",
        message: `Consulta lista. ${nextRows.length} registro(s) cargados y ${nextCuposLibres} cupo(s) libre(s) disponibles para eliminar.`,
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

  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return Array.from(next);
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (allSelected) {
        for (const id of allSelectableIds) next.delete(id);
      } else {
        for (const id of allSelectableIds) next.add(id);
      }

      return Array.from(next);
    });
  };

  const selectAllCuposLibres = () => {
    setSelectedIds(allSelectableIds);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleEliminar = async () => {
    if (selectedIds.length === 0) return;

    const confirmed = await confirmDialog.ask();
    if (!confirmed) return;

    setDeleting(true);

    try {
      const response = await fetch("/api/cupos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "No se pudo eliminar.");
      }

      const { deleted } = (await response.json()) as { ok: true; deleted: number };
      const removed = new Set(selectedIds);
      const nextRows = rows.filter((row) => !(row.cita_id && removed.has(row.cita_id)));

      setRows(nextRows);
      setSelectedIds([]);
      setResultsNotice({
        tone: "success",
        message: `Eliminacion completada. Se quitaron ${deleted} cupo(s) del resultado actual.`,
      });
    } catch (error: unknown) {
      console.error(error);
      const message = getErrorMessage(error, "Error al eliminar.");
      setResultsNotice({
        tone: "danger",
        message,
      });
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const resetFiltros = () => {
    setDesde("");
    setHasta("");
    setHoraDesde("");
    setHoraHasta("");
    setEps("");
    setEspSel([]);
    setMedSel([]);
    setRows([]);
    setSelectedIds([]);
    setHasSearched(false);
    setResultsNotice(createDefaultResultsNotice());
    validation.resetValidation();
  };

  const desdeError = validation.getFieldError("desde");
  const hastaError = validation.getFieldError("hasta");
  const horaDesdeError = validation.getFieldError("horaDesde");
  const horaHastaError = validation.getFieldError("horaHasta");

  return (
    <>
      <Head>
        <title>Eliminar Cupos DNAPLUS</title>
      </Head>

      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <PageHeader
          title="Eliminar cupos"
          description="Busca cupos por rango, revisa el estado y elimina solo los registros que esten sin asignar."
          aside={<ModulesMenu />}
        />

        <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Filtros de busqueda</h2>
              <p className="mt-1 text-sm text-slate-600">
                Define primero el rango y luego afina por EPS, especialidad o medico si hace
                falta.
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
              <label htmlFor="cupos-desde" className="text-sm font-medium text-slate-700">
                Desde
              </label>
              <input
                ref={desdeRef}
                id="cupos-desde"
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                onBlur={() => validation.markTouched("desde")}
                aria-invalid={Boolean(desdeError)}
                aria-describedby={desdeError ? "cupos-desde-error" : undefined}
                className={[
                  INPUT_CLASS_NAME,
                  desdeError ? INPUT_INVALID_CLASS_NAME : "",
                ].join(" ")}
              />
              <FieldError id="cupos-desde-error" message={desdeError} />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="cupos-hasta" className="text-sm font-medium text-slate-700">
                Hasta
              </label>
              <input
                ref={hastaRef}
                id="cupos-hasta"
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                onBlur={() => validation.markTouched("hasta")}
                aria-invalid={Boolean(hastaError)}
                aria-describedby={hastaError ? "cupos-hasta-error" : undefined}
                className={[
                  INPUT_CLASS_NAME,
                  hastaError ? INPUT_INVALID_CLASS_NAME : "",
                ].join(" ")}
              />
              <FieldError id="cupos-hasta-error" message={hastaError} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="cupos-hora-desde" className="text-sm font-medium text-slate-700">
                Hora desde
              </label>
              <input
                ref={horaDesdeRef}
                id="cupos-hora-desde"
                type="time"
                value={horaDesde}
                onChange={(event) => setHoraDesde(event.target.value)}
                onBlur={() => validation.markTouched("horaDesde")}
                aria-invalid={Boolean(horaDesdeError)}
                aria-describedby={horaDesdeError ? "cupos-hora-desde-error" : undefined}
                className={[
                  INPUT_CLASS_NAME,
                  horaDesdeError ? INPUT_INVALID_CLASS_NAME : "",
                ].join(" ")}
              />
              <FieldError id="cupos-hora-desde-error" message={horaDesdeError} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="cupos-hora-hasta" className="text-sm font-medium text-slate-700">
                Hora hasta
              </label>
              <input
                ref={horaHastaRef}
                id="cupos-hora-hasta"
                type="time"
                value={horaHasta}
                onChange={(event) => setHoraHasta(event.target.value)}
                onBlur={() => validation.markTouched("horaHasta")}
                aria-invalid={Boolean(horaHastaError)}
                aria-describedby={horaHastaError ? "cupos-hora-hasta-error" : undefined}
                className={[
                  INPUT_CLASS_NAME,
                  horaHastaError ? INPUT_INVALID_CLASS_NAME : "",
                ].join(" ")}
              />
              <FieldError id="cupos-hora-hasta-error" message={horaHastaError} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="cupos-eps" className="text-sm font-medium text-slate-700">
                EPS
              </label>
              <select
                id="cupos-eps"
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
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <StatusMessage
              icon={ShieldAlert}
              message="La eliminacion solo se habilita para filas con estado SIN ASIGNAR."
              tone="danger"
              className="rounded-2xl"
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-6">
                <MultiSelectRS
                  label="Especialidad"
                  placeholder="Filtra por especialidad..."
                  options={espOptions}
                  value={espSel}
                  onChange={setEspSel}
                  summaryLabel="especialidades"
                  helperText={`Escribe para filtrar. ${espOptions.length} especialidad(es) disponibles.`}
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
                  label="Medicos"
                  placeholder="Filtra por medico..."
                  options={medOptions}
                  value={medSel}
                  onChange={setMedSel}
                  summaryLabel="medicos"
                  helperText={
                    espSel.length > 0
                      ? `Escribe para filtrar. ${medOptions.length} medico(s) disponibles para la especialidad actual.`
                      : `Escribe para filtrar. ${medOptions.length} medico(s) disponibles en total.`
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
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={handleBuscar}
              disabled={loading || deleting}
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
              Los filtros se conservan en la URL y la seleccion se limpia cuando ejecutas una nueva
              busqueda.
            </p>
          </div>
        </section>

        <section
          className="mt-6 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm"
          aria-busy={loading || deleting}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Resultados y seleccion</h2>
              <p className="mt-1 text-sm text-slate-600">
                {rows.length > 0
                  ? `Mostrando ${rows.length} registro(s). Selecciona solo los cupos libres que quieras eliminar.`
                  : "La tabla y las tarjetas muestran el mismo resultado segun el ancho de pantalla."}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">
              Seleccionados: <strong className="text-slate-900">{selectedCount}</strong>
            </div>
          </div>

          <StatusMessage
            icon={loading || deleting ? Search : CalendarRange}
            message={resultsStatus.message}
            tone={resultsStatus.tone}
            className="mt-4"
          />

          <StatsOverview stats={stats} total={total} />

          {(rows.length > 0 || selectedCount > 0) && (
            <SelectionActionBar
              selectedCount={selectedCount}
              availableCount={cuposLibres.length}
              deleting={deleting}
              onSelectAll={selectAllCuposLibres}
              onClear={clearSelection}
              onDelete={handleEliminar}
            />
          )}

          <ResponsiveResultsTable
            rows={rows}
            loading={loading}
            caption="Resultados de cupos disponibles para eliminacion"
            emptyTitle="Aun no hay resultados visibles."
            emptyDescription={
              hasSearched
                ? "No se encontraron cupos para los filtros actuales."
                : querySync.hasQueryState
                ? "Los filtros ya estan listos. Pulsa Buscar para revisar los cupos."
                : "Define un rango valido y pulsa Buscar."
            }
            selection={{
              allSelected,
              deleting,
              selectedIds,
              selectableCount: allSelectableIds.length,
              onToggleAll: toggleSelectAllVisible,
              onToggleRow: toggleSelectOne,
            }}
          />
        </section>
      </div>

      <ConfirmModal
        open={confirmDialog.open}
        count={selectedCount}
        onCancel={confirmDialog.onCancel}
        onAccept={confirmDialog.onAccept}
      />
    </>
  );
}
