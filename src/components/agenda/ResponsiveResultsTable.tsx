import { useMemo, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import StatusBadge from "@/components/agenda/StatusBadge";
import TableStateRow from "@/components/agenda/TableStateRow";
import {
  estadoKey,
  formatAgendaValue,
  type AgendaRow,
} from "@/lib/agenda-ui";

type RowSelectionProps = {
  allSelected: boolean;
  deleting: boolean;
  selectedIds: number[];
  selectableCount: number;
  onToggleAll: () => void;
  onToggleRow: (id: number, checked: boolean) => void;
};

type ResponsiveResultsTableProps = {
  rows: AgendaRow[];
  loading: boolean;
  caption: string;
  emptyTitle: string;
  emptyDescription: string;
  selection?: RowSelectionProps;
};

type DesktopColumn = {
  key: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: AgendaRow) => ReactNode;
};

const desktopColumns: DesktopColumn[] = [
  {
    key: "fecha",
    label: "Fecha",
    cellClassName: "whitespace-nowrap px-3 py-3 text-slate-700",
    render: (row) => row.fecha,
  },
  {
    key: "hora",
    label: "Hora",
    cellClassName: "whitespace-nowrap px-3 py-3 text-slate-700",
    render: (row) => row.hora ?? "Sin hora",
  },
  {
    key: "paciente",
    label: "Paciente",
    cellClassName: "px-3 py-3 text-slate-700",
    render: (row) => (
      <div className="max-w-[220px] whitespace-normal break-words">
        {formatAgendaValue(row.paciente, "Sin paciente asignado")}
      </div>
    ),
  },
  {
    key: "telefono",
    label: "Telefono",
    cellClassName: "whitespace-nowrap px-3 py-3 text-slate-700",
    render: (row) => formatAgendaValue(row.telefono),
  },
  {
    key: "estado",
    label: "Estado",
    cellClassName: "whitespace-nowrap px-3 py-3",
    render: (row) => <StatusBadge estado={row.estado} />,
  },
  {
    key: "medico",
    label: "Medico",
    cellClassName: "px-3 py-3 text-slate-700",
    render: (row) => (
      <div className="max-w-[240px] whitespace-normal break-words">
        {formatAgendaValue(row.medico)}
      </div>
    ),
  },
  {
    key: "eps",
    label: "EPS",
    headerClassName: "hidden xl:table-cell",
    cellClassName: "hidden xl:table-cell px-3 py-3 text-slate-700",
    render: (row) => (
      <div className="max-w-[180px] whitespace-normal break-words">
        {formatAgendaValue(row.eps)}
      </div>
    ),
  },
  {
    key: "documento",
    label: "Documento",
    headerClassName: "hidden xl:table-cell",
    cellClassName: "hidden xl:table-cell px-3 py-3 text-slate-700",
    render: (row) => (
      <div className="min-w-[140px] whitespace-normal break-words">
        <div className="font-medium text-slate-900">{formatAgendaValue(row.doc_tipo)}</div>
        <div className="text-sm text-slate-500">{formatAgendaValue(row.doc_numero)}</div>
      </div>
    ),
  },
  {
    key: "tipo_cita",
    label: "Tipo Cita",
    headerClassName: "hidden 2xl:table-cell",
    cellClassName: "hidden 2xl:table-cell px-3 py-3 text-slate-700",
    render: (row) => (
      <div className="max-w-[240px] whitespace-normal break-words">
        {formatAgendaValue(row.tipo_cita)}
      </div>
    ),
  },
  {
    key: "cita_id",
    label: "ID Cita",
    cellClassName: "whitespace-nowrap px-3 py-3 tabular-nums text-slate-700",
    render: (row) => row.cita_id ?? "Sin ID",
  },
];

const renderMobileStateCard = (
  loading: boolean,
  emptyTitle: string,
  emptyDescription: string,
) => {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-slate-600 shadow-sm">
        <div className="flex items-center justify-center gap-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-700" />
          Cargando resultados...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-center shadow-sm">
      <p className="text-sm font-medium text-slate-700">{emptyTitle}</p>
      <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
    </div>
  );
};

const getRowTitle = (row: AgendaRow) =>
  formatAgendaValue(row.paciente, row.cita_id ? `Cita ${row.cita_id}` : "Registro sin paciente");

export default function ResponsiveResultsTable({
  rows,
  loading,
  caption,
  emptyTitle,
  emptyDescription,
  selection,
}: ResponsiveResultsTableProps) {
  const selectedIdsSet = useMemo(
    () => new Set(selection?.selectedIds ?? []),
    [selection?.selectedIds],
  );

  const desktopColSpan = desktopColumns.length + (selection ? 1 : 0);

  return (
    <>
      <div className="mt-5 space-y-3 lg:hidden">
        {rows.length === 0
          ? renderMobileStateCard(loading, emptyTitle, emptyDescription)
          : rows.map((row, index) => {
              const rowId = row.cita_id ?? -1 * (index + 1);
              const selectable =
                Boolean(selection) &&
                estadoKey(row.estado) === "SIN_ASIGNAR" &&
                row.cita_id != null;
              const checked = row.cita_id != null && selectedIdsSet.has(row.cita_id);

              return (
                <article
                  key={`${rowId}-${index}`}
                  className={[
                    "rounded-2xl border bg-white p-4 shadow-sm",
                    checked
                      ? "border-red-200 bg-red-50/70"
                      : selectable
                        ? "border-slate-200"
                        : "border-slate-200 bg-slate-50/80",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    {selection && (
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          disabled={!selectable || selection.deleting}
                          checked={checked}
                          onChange={(event) =>
                            row.cita_id && selection.onToggleRow(row.cita_id, event.target.checked)
                          }
                          className="h-5 w-5 rounded border-slate-400 text-red-600 focus:ring-red-500"
                          aria-label={
                            selectable
                              ? `Seleccionar cita ${row.cita_id} para eliminar`
                              : `La cita ${row.cita_id ?? ""} no es eliminable`
                          }
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{getRowTitle(row)}</h3>
                        <StatusBadge estado={row.estado} />
                      </div>

                      <div className="mt-2 grid gap-1 text-sm text-slate-600">
                        <p>
                          <span className="font-medium text-slate-700">Fecha:</span> {row.fecha}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">Hora:</span>{" "}
                          {formatAgendaValue(row.hora, "Sin hora")}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">Telefono:</span>{" "}
                          {formatAgendaValue(row.telefono)}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">Medico:</span>{" "}
                          {formatAgendaValue(row.medico)}
                        </p>
                      </div>

                      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-slate-700">
                          Ver detalle completo
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </summary>

                        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600">
                          <div>
                            <dt className="font-medium text-slate-700">ID Cita</dt>
                            <dd className="mt-1">{row.cita_id ?? "Sin ID"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-700">Tipo documento</dt>
                            <dd className="mt-1">{formatAgendaValue(row.doc_tipo)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-700">Documento</dt>
                            <dd className="mt-1">{formatAgendaValue(row.doc_numero)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-700">EPS</dt>
                            <dd className="mt-1">{formatAgendaValue(row.eps)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-700">Tipo cita</dt>
                            <dd className="mt-1">{formatAgendaValue(row.tipo_cita)}</dd>
                          </div>
                        </dl>
                      </details>
                    </div>
                  </div>
                </article>
              );
            })}
      </div>

      <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
        <table className="min-w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-slate-50">
            <tr className="text-left">
              {selection && (
                <th className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selection.allSelected}
                      onChange={selection.onToggleAll}
                      disabled={selection.selectableCount === 0 || selection.deleting}
                      className="h-4 w-4 rounded border-slate-400 text-red-600 focus:ring-red-500"
                      title="Seleccionar o deseleccionar todos los cupos libres visibles"
                    />
                    Sel.
                  </label>
                </th>
              )}

              {desktopColumns.map((column) => (
                <th
                  key={column.key}
                  className={[
                    "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600",
                    column.headerClassName ?? "",
                  ].join(" ")}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <TableStateRow
                colSpan={desktopColSpan}
                loading={loading}
                emptyTitle={emptyTitle}
                emptyDescription={emptyDescription}
              />
            ) : (
              rows.map((row, index) => {
                const rowId = row.cita_id ?? -1 * (index + 1);
                const selectable =
                  Boolean(selection) &&
                  estadoKey(row.estado) === "SIN_ASIGNAR" &&
                  row.cita_id != null;
                const checked = row.cita_id != null && selectedIdsSet.has(row.cita_id);

                return (
                  <tr
                    key={`${rowId}-${index}`}
                    className={[
                      "border-b border-slate-200 align-top",
                      checked
                        ? "bg-red-50 hover:bg-red-100/70"
                        : selectable
                          ? "bg-white even:bg-slate-50/50 hover:bg-cyan-50/50"
                          : "bg-white even:bg-slate-50/50",
                    ].join(" ")}
                  >
                    {selection && (
                      <td className="whitespace-nowrap px-3 py-3">
                        <input
                          type="checkbox"
                          disabled={!selectable || selection.deleting}
                          checked={checked}
                          onChange={(event) =>
                            row.cita_id && selection.onToggleRow(row.cita_id, event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-400 text-red-600 focus:ring-red-500"
                          aria-label={
                            selectable
                              ? `Seleccionar cita ${row.cita_id} para eliminar`
                              : `La cita ${row.cita_id ?? ""} no es eliminable`
                          }
                        />
                      </td>
                    )}

                    {desktopColumns.map((column) => (
                      <td key={column.key} className={column.cellClassName}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
