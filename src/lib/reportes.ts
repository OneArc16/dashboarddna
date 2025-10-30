import { z } from "zod";

export const EstadosEnum = z.enum(["ASIGNADA", "ATENDIDA", "CUMPLIDA", "SIN_ASIGNAR"]);
export type EstadoKey = z.infer<typeof EstadosEnum>;

// tope oficial para consultas/export
export const MAX_LIMIT = 1_000_000;

export const FiltrosSchema = z.object({
  desde: z.string().min(10), // YYYY-MM-DD
  hasta: z.string().min(10), // YYYY-MM-DD
  eps: z.string().optional(),
  estados: z.array(EstadosEnum).default(["ASIGNADA", "ATENDIDA", "CUMPLIDA", "SIN_ASIGNAR"]),
  especialidad: z.string().optional(),
  medico: z.string().optional(),
  all: z.boolean().optional().default(false),
  limit: z.coerce.number().int().positive().max(1000000).default(5000),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/** where para prisma.agenda (sin SQL crudo) */
export function buildWherePrisma(input: z.infer<typeof FiltrosSchema>) {
  const { desde, hasta, estados } = input;

  // En tu schema fecha_cita es @db.Date (sin hora)
  // Usa límites por fecha (00:00–23:59 no aplica aquí; es Date plano)
  const gte = new Date(desde);
  const lte = new Date(hasta);

  // Prefijos respetando el casing de tu DB (no se puede usar "mode" en MySQL)
  const prefixMap: Record<EstadoKey, string> = {
    ASIGNADA: "Asignad",
    ATENDIDA: "Atendid",
    CUMPLIDA: "Cumplid",
    SIN_ASIGNAR: "Sin asignar",
  };

  const orEstados = estados?.length
    ? estados.map((k) => ({ Estado: { startsWith: prefixMap[k] } }))
    : undefined;

  return {
    fecha_cita: { gte, lte },
    ...(orEstados ? { OR: orEstados } : {}),
  };
}

/** Helpers de formato */
export const fmtFecha = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
export const fmtHoraFromIdHora = (idhora?: string | null) => idhora ?? ""; // tu hora está en `idhora`
export const buildNombre = (u?: {
  Primer_nombre?: string | null;
  Segundo_nombre?: string | null;
  Primer_apellido?: string | null;
  Segundo_apellido?: string | null;
} | null) =>
  [u?.Primer_nombre, u?.Segundo_nombre, u?.Primer_apellido, u?.Segundo_apellido]
    .filter(Boolean)
    .join(" ");
