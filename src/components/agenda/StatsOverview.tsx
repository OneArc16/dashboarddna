import {
  STATUS_META,
  STATUS_ORDER,
  type StatTotals,
} from "@/lib/agenda-ui";

type StatsOverviewProps = {
  stats: StatTotals;
  total: number;
};

export default function StatsOverview({ stats, total }: StatsOverviewProps) {
  return (
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {STATUS_ORDER.map((stat) => {
        const percentage = total ? ((stats[stat] / total) * 100).toFixed(1) : "0.0";
        const meta = STATUS_META[stat];

        return (
          <div
            key={stat}
            className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5"
            aria-label={meta.helperText}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} />
              {meta.summaryLabel}
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {stats[stat]}
              </span>
              <span className="text-xs text-slate-500">{percentage}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
