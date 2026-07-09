export type AgendaRow = {
  cita_id: number | null;
  fecha: string;
  hora: string | null;
  doc_tipo: string | null;
  doc_numero: string | null;
  idusuario: number | null;
  paciente: string | null;
  telefono: string | null;
  eps: string | null;
  idmedico: string | null;
  medico: string | null;
  estado: string | null;
  tipo_cita: string | null;
};

export type StatKey = "ASIGNADA" | "ATENDIDA" | "CUMPLIDA" | "SIN_ASIGNAR";
export type StatTotals = Record<StatKey, number>;

type StatusMeta = {
  summaryLabel: string;
  filterLabel: string;
  badgeLabel: string;
  helperText: string;
  dot: string;
  badgeClass: string;
};

export const STATUS_META: Record<StatKey, StatusMeta> = {
  ASIGNADA: {
    summaryLabel: "Asignadas",
    filterLabel: "Asignadas",
    badgeLabel: "Asignada",
    helperText: "Citas que ya tienen paciente asignado.",
    dot: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-900",
  },
  ATENDIDA: {
    summaryLabel: "Atendidas",
    filterLabel: "Atendidas",
    badgeLabel: "Atendida",
    helperText: "Citas atendidas y cerradas correctamente.",
    dot: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-100 text-emerald-900",
  },
  CUMPLIDA: {
    summaryLabel: "Activadas",
    filterLabel: "Activadas",
    badgeLabel: "Activada",
    helperText: "Registros marcados como cumplidos en el sistema.",
    dot: "bg-indigo-500",
    badgeClass: "border border-indigo-200 bg-indigo-100 text-indigo-900",
  },
  SIN_ASIGNAR: {
    summaryLabel: "Sin asignar",
    filterLabel: "Sin asignar",
    badgeLabel: "Sin asignar",
    helperText: "Cupos disponibles sin paciente asociado.",
    dot: "bg-zinc-400",
    badgeClass: "border border-zinc-200 bg-zinc-100 text-zinc-800",
  },
};

export const STATUS_ORDER: StatKey[] = [
  "ASIGNADA",
  "ATENDIDA",
  "CUMPLIDA",
  "SIN_ASIGNAR",
];

export const INPUT_CLASS_NAME =
  "mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition focus:outline-none focus:ring-4 focus:ring-cyan-600/10";

export const INPUT_INVALID_CLASS_NAME =
  "border-red-300 bg-red-50/60 focus:ring-red-500/10";

export const createEmptyStats = (): StatTotals => ({
  ASIGNADA: 0,
  ATENDIDA: 0,
  CUMPLIDA: 0,
  SIN_ASIGNAR: 0,
});

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const normalize = (value?: string | null) =>
  (value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();

export const hasText = (value?: string | null) => Boolean(value?.trim());

export const formatAgendaValue = (
  value?: string | null,
  fallback = "Sin dato",
) => (hasText(value) ? value!.trim() : fallback);

export const estadoKey = (value?: string | null): StatKey | null => {
  const normalized = normalize(value);
  if (normalized.startsWith("ASIGNAD")) return "ASIGNADA";
  if (normalized.startsWith("ATENDID")) return "ATENDIDA";
  if (normalized.startsWith("CUMPLID")) return "CUMPLIDA";
  if (normalized.startsWith("SIN ASIGNAR")) return "SIN_ASIGNAR";
  return null;
};

export const getStatusBadgeMeta = (estado: string | null) => {
  const key = estadoKey(estado);

  if (!key) return null;

  const meta = STATUS_META[key];
  return {
    label: meta.badgeLabel,
    cls: meta.badgeClass,
  };
};

export const buildStats = (rows: Array<Pick<AgendaRow, "estado">>): StatTotals => {
  const next = createEmptyStats();

  for (const row of rows) {
    const key = estadoKey(row.estado);
    if (key) next[key] += 1;
  }

  return next;
};
