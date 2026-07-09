import { ListChecks, RotateCcw, Trash2 } from "lucide-react";

type SelectionActionBarProps = {
  selectedCount: number;
  availableCount: number;
  deleting: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
};

export default function SelectionActionBar({
  selectedCount,
  availableCount,
  deleting,
  onSelectAll,
  onClear,
  onDelete,
}: SelectionActionBarProps) {
  return (
    <div className="sticky top-3 z-20 mt-5 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-200/60 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {selectedCount > 0
              ? `${selectedCount} cupo(s) listo(s) para eliminar`
              : "Selecciona los cupos libres del resultado actual"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {availableCount} cupo(s) libre(s) disponibles. Los registros en otros estados quedan
            bloqueados.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={availableCount === 0 || deleting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <ListChecks className="h-4 w-4" />
            Seleccionar cupos libres
          </button>

          <button
            type="button"
            onClick={onClear}
            disabled={selectedCount === 0 || deleting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <RotateCcw className="h-4 w-4" />
            Limpiar seleccion
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={selectedCount === 0 || deleting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Eliminando..." : "Eliminar seleccionados"}
          </button>
        </div>
      </div>
    </div>
  );
}
