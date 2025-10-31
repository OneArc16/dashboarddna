// src/lib/reportes.ts
import { z } from "zod";

export const EstadosEnum = z.enum([
  "ASIGNADA",
  "ATENDIDA",
  "CUMPLIDA",
  "SIN_ASIGNAR",
]);
export type EstadoKey = z.infer<typeof EstadosEnum>;

// Tope oficial para consultas/export
export const MAX_LIMIT = 1_000_000;

// Schema de filtros (con soporte a arrays y compatibilidad con singulares)
export const FiltrosSchema = z
  .object({
    desde: z.string().min(10), // YYYY-MM-DD
    hasta: z.string().min(10), // YYYY-MM-DD

    // EPS opcional
    eps: z.string().optional(),

    // Estados (por defecto todos)
    estados: z
      .array(EstadosEnum)
      .default(["ASIGNADA", "ATENDIDA", "CUMPLIDA", "SIN_ASIGNAR"]),

    // Compatibilidad hacia atrás (singulares)
    especialidad: z.string().optional(),
    medico: z.string().optional(),

    // Nuevos campos: múltiples especialidades y múltiples médicos
    especialidades: z.array(z.string()).optional().default([]),
    medicos: z.array(z.string()).optional().default([]),

    // Paginación
    all: z.boolean().optional().default(false),
    limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(5000),
    offset: z.coerce.number().int().nonnegative().default(0),
  })
  // Normalización: si vienen singulares, se agregan a los arrays
  .transform((v) => {
    const especialidades = [...(v.especialidades ?? [])];
    if (v.especialidad) especialidades.push(v.especialidad);

    const medicos = [...(v.medicos ?? [])];
    if (v.medico) medicos.push(v.medico);

    return { ...v, especialidades, medicos };
  });

/** where para prisma.agenda (sin SQL crudo) */
export function buildWherePrisma(input: z.infer<typeof FiltrosSchema>) {
  const { desde, hasta, estados } = input;

  // En tu schema fecha_cita es @db.Date (sin hora)
  // Usamos rango inclusivo por fecha
  const gte = new Date(desde);
  const lte = new Date(hasta);

  // Prefijos tal como están en tu DB (MySQL: sin "mode: insensitive")
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
export const fmtFecha = (d?: Date | null) =>
  d ? d.toISOString().slice(0, 10) : "";

export const fmtHoraFromIdHora = (idhora?: string | null) => idhora ?? ""; // tu hora está en `idhora`

export const buildNombre = (u?:
  | {
      Primer_nombre?: string | null;
      Segundo_nombre?: string | null;
      Primer_apellido?: string | null;
      Segundo_apellido?: string | null;
    }
  | null) =>
  [u?.Primer_nombre, u?.Segundo_nombre, u?.Primer_apellido, u?.Segundo_apellido]
    .filter(Boolean)
    .join(" ");
