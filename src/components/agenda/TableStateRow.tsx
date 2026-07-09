type TableStateRowProps = {
  colSpan: number;
  loading: boolean;
  loadingText?: string;
  emptyTitle: string;
  emptyDescription: string;
};

export default function TableStateRow({
  colSpan,
  loading,
  loadingText = "Cargando resultados...",
  emptyTitle,
  emptyDescription,
}: TableStateRowProps) {
  if (loading) {
    return (
      <tr>
        <td className="px-3 py-10 text-center text-slate-500" colSpan={colSpan}>
          <div className="flex items-center justify-center gap-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-700" />
            {loadingText}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-3 py-10" colSpan={colSpan}>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center">
          <p className="text-sm font-medium text-slate-700">{emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
        </div>
      </td>
    </tr>
  );
}
