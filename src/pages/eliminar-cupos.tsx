"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  CalendarRange,
  ListChecks,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/agenda/PageHeader";
import StatsOverview from "@/components/agenda/StatsOverview";
import StatusBadge from "@/components/agenda/StatusBadge";
import StatusMessage from "@/components/agenda/StatusMessage";
import TableStateRow from "@/components/agenda/TableStateRow";
import ModulesMenu from "@/components/ModulesMenu";
import MultiSelectRS, { type RSOption } from "@/components/MultiSelectRS";
import {
  INPUT_CLASS_NAME,
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

const TABLE_HEADERS = [
  "Sel.",
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

  const confirmDialog = useConfirmDialog();

  const stats = useMemo(() => buildStats(rows), [rows]);
  const total = rows.length;

  const cuposLibres = useMemo(
    () => rows.filter((row) => estadoKey(row.estado) === "SIN_ASIGNAR" && row.cita_id != null),
    [rows],
  );

  const selectedCount = selectedIds.length;
  const allSelectableIds = useMemo(
    () => cuposLibres.map((row) => row.cita_id!),
    [cuposLibres],
  );
  const allSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selectedIds.includes(id));

  const searchMessage = useMemo(() => {
    if (!desde || !hasta) {
      return "Selecciona fecha inicial y final para habilitar la busqueda.";
    }
    if (desde > hasta) {
      return "La fecha inicial no puede ser mayor que la fecha final.";
    }
    if (horaDesde && horaHasta && horaDesde > horaHasta) {
      return "La hora inicial no puede ser mayor que la hora final.";
    }
    return "";
  }, [desde, hasta, horaDesde, horaHasta]);

  const canSearch = !loading && !deleting && !searchMessage;

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
    (async () => {
      try {
        setMedSel([]);

        if (espSel.length === 0) {
          const response = await fetch("/api/catalog/medicos");
          const { options } = await response.json().catch(() => ({
            options: [] as RSOption[],
          }));
          const nextOptions = (options as RSOption[]) ?? [];

          setMedOptions(nextOptions);
          setMedSel((prev) =>
            prev.filter((item) => nextOptions.some((option) => option.value === item.value)),
          );
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
        setMedSel((prev) =>
          prev.filter((item) => nextOptions.some((option) => option.value === item.value)),
        );
      } catch (error) {
        console.error(error);
        setMedOptions([]);
      }
    })();
  }, [espSel]);

  const handleBuscar = async () => {
    if (!desde || !hasta) return toast.error("Selecciona el rango de fechas.");
    if (desde > hasta) return toast.error("La fecha 'Desde' no puede ser mayor a 'Hasta'.");
    if (horaDesde && horaHasta && horaDesde > horaHasta) {
      return toast.error("La hora 'Desde' no puede ser mayor a 'Hasta'.");
    }

    setLoading(true);
    setSelectedIds([]);

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
      setRows(nextRows);
      toast.success(`Se cargaron ${nextRows.length} registro(s).`);
    } catch (error: unknown) {
      console.error("Buscar error:", error);
      toast.error(getErrorMessage(error, "Error al buscar."));
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
    toast.success(`Seleccionados ${allSelectableIds.length} cupo(s) libre(s).`);
  };

  const clearSelection = () => setSelectedIds([]);

  const handleEliminar = async () => {
    if (selectedIds.length === 0) return toast.error("No hay cupos seleccionados para eliminar.");

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
      toast.success(`Eliminados ${deleted} cupo(s).`);
    } catch (error: unknown) {
      console.error(error);
      toast.error(getErrorMessage(error, "Error al eliminar."));
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
  };

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
              <h2 className="text-lg font-semibold text-slate-900">
                Filtros de busqueda
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Define primero el rango y luego filtra por EPS, especialidad o medico.
              </p>
            </div>

            <StatusMessage
              icon={CalendarRange}
              message={searchMessage || "Rango listo. Solo se podran seleccionar cupos sin asignar."}
              tone={searchMessage ? "warning" : "success"}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-3">
              <label htmlFor="cupos-desde" className="text-sm font-medium text-slate-700">
                Desde
              </label>
              <input
                id="cupos-desde"
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className={[
                  INPUT_CLASS_NAME,
                  searchMessage && desde && hasta ? "border-amber-300 focus:ring-amber-500/10" : "",
                ].join(" ")}
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="cupos-hasta" className="text-sm font-medium text-slate-700">
                Hasta
              </label>
              <input
                id="cupos-hasta"
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className={[
                  INPUT_CLASS_NAME,
                  searchMessage && desde && hasta ? "border-amber-300 focus:ring-amber-500/10" : "",
                ].join(" ")}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="cupos-hora-desde" className="text-sm font-medium text-slate-700">
                Hora desde
              </label>
              <input
                id="cupos-hora-desde"
                type="time"
                value={horaDesde}
                onChange={(event) => setHoraDesde(event.target.value)}
                className={[
                  INPUT_CLASS_NAME,
                  horaDesde && horaHasta && horaDesde > horaHasta
                    ? "border-amber-300 focus:ring-amber-500/10"
                    : "",
                ].join(" ")}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="cupos-hora-hasta" className="text-sm font-medium text-slate-700">
                Hora hasta
              </label>
              <input
                id="cupos-hora-hasta"
                type="time"
                value={horaHasta}
                onChange={(event) => setHoraHasta(event.target.value)}
                className={[
                  INPUT_CLASS_NAME,
                  horaDesde && horaHasta && horaDesde > horaHasta
                    ? "border-amber-300 focus:ring-amber-500/10"
                    : "",
                ].join(" ")}
              />
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
                    {medOptions.length} medico(s) disponibles con la seleccion actual.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleBuscar}
              disabled={!canSearch}
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
              La seleccion se limpia automaticamente cada vez que se ejecuta una nueva busqueda.
            </p>
          </div>
        </section>

        <section
          className="mt-6 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm"
          aria-busy={loading || deleting}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Resultados y seleccion
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {rows.length > 0
                  ? `Mostrando ${rows.length} registro(s). Marca solo los cupos libres que quieras eliminar.`
                  : canSearch
                    ? "Ejecuta la busqueda para revisar cupos y seleccionar los eliminables."
                    : "Completa un rango valido para empezar."}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">
              Seleccionados: <strong className="text-slate-900">{selectedCount}</strong>
            </div>
          </div>

          <StatsOverview stats={stats} total={total} />

          <div
            className={[
              "mt-5 rounded-2xl border p-3.5",
              selectedCount > 0
                ? "border-red-200 bg-red-50/80"
                : "border-slate-200 bg-slate-50/80",
            ].join(" ")}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedCount > 0
                    ? `${selectedCount} cupo(s) listo(s) para eliminar`
                    : "Selecciona los cupos libres del resultado actual"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {cuposLibres.length} cupo(s) libre(s) disponibles. Los estados distintos a
                  SIN ASIGNAR quedan bloqueados.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllCuposLibres}
                  disabled={cuposLibres.length === 0 || deleting}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <ListChecks className="h-4 w-4" />
                  Seleccionar cupos libres
                </button>

                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selectedCount === 0 || deleting}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <RotateCcw className="h-4 w-4" />
                  Limpiar seleccion
                </button>

                <button
                  type="button"
                  onClick={handleEliminar}
                  disabled={selectedCount === 0 || deleting}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? "Eliminando..." : "Eliminar seleccionados"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Resultados de cupos disponibles para eliminacion</caption>
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAllVisible}
                        disabled={cuposLibres.length === 0 || deleting}
                        className="h-4 w-4 rounded border-slate-400 text-red-600 focus:ring-red-500"
                        title="Seleccionar o deseleccionar todos los cupos libres visibles"
                      />
                      Sel.
                    </label>
                  </th>

                  {TABLE_HEADERS.slice(1).map((header) => (
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
                  rows.map((row, index) => {
                    const rowId = row.cita_id ?? -1 * (index + 1);
                    const esCupoLibre =
                      estadoKey(row.estado) === "SIN_ASIGNAR" && row.cita_id != null;
                    const checked =
                      row.cita_id != null && selectedIds.includes(row.cita_id);

                    return (
                      <tr
                        key={`${rowId}-${index}`}
                        className={[
                          "border-b border-slate-200",
                          checked
                            ? "bg-red-50 hover:bg-red-100/70"
                            : esCupoLibre
                              ? "bg-white even:bg-slate-50/50 hover:bg-cyan-50/50"
                              : "bg-slate-50/80 text-slate-600 hover:bg-slate-100/80",
                        ].join(" ")}
                      >
                        <td className="whitespace-nowrap px-3 py-3">
                          <input
                            type="checkbox"
                            disabled={!esCupoLibre || deleting}
                            checked={checked}
                            onChange={(event) =>
                              row.cita_id && toggleSelectOne(row.cita_id, event.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-400 text-red-600 focus:ring-red-500"
                            aria-label={
                              esCupoLibre
                                ? `Seleccionar cita ${row.cita_id} para eliminar`
                                : `La cita ${row.cita_id ?? ""} no es eliminable`
                            }
                            title={
                              esCupoLibre
                                ? "Marcar para eliminar"
                                : "Solo se pueden seleccionar cupos SIN ASIGNAR"
                            }
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">{row.cita_id ?? ""}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.fecha}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.hora ?? ""}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.doc_tipo ?? ""}</td>
                        <td className="whitespace-nowrap px-3 py-3">{row.doc_numero ?? ""}</td>
                        <td className="px-3 py-3">
                          <div className="max-w-[220px] truncate" title={row.paciente ?? ""}>
                            {row.paciente ?? ""}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{row.telefono ?? ""}</td>
                        <td className="px-3 py-3">
                          <div className="max-w-[180px] truncate" title={row.eps ?? ""}>
                            {row.eps ?? ""}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="max-w-[220px] truncate" title={row.medico ?? ""}>
                            {row.medico ?? ""}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <StatusBadge estado={row.estado} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="max-w-[240px] truncate" title={row.tipo_cita ?? ""}>
                            {row.tipo_cita ?? ""}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
