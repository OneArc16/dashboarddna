// src/pages/api/cupos/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

/* =========================================================================
   CONFIG — nombres EXACTOS como aparecen en tu schema.prisma
   ========================================================================= */
const MODEL = {
  agenda: "agenda",
  usuario: "usuarios",
  empleado: "empleados",
} as const;

// agenda
const A = {
  id: "idagenda",          // <-- PK real según tu schema
  fecha: "fecha_cita",     // Date @db.Date
  hora: "idhora",          // String "HH:MM" (o TIME)
  idusuario: "idusuario",  // String? (a veces guarda IdUsuario o Identificación_usuario)
  idmedico: "idmedico",    // String
  estado: "Estado",        // String?
  tipocita: "TipoCita",    // String? CUPS
} as const;

// usuarios
const U = {
  id: "IdUsuario",                         // Int @id
  ident: "Identificaci_n_usuario",         // String (mapeada a "Identificación_usuario")
  eps: "Codigo_eps",                       // String
  pNombre: "Primer_nombre",
  sNombre: "Segundo_nombre",
  pApellido: "Primer_apellido",
  sApellido: "Segundo_apellido",
} as const;

// empleados
const E = {
  codigo: "C_digo_empleado",  // String @id (mapeado a "Código_empleado")
  nombre: "Nombre_empleado",
} as const;

/* =========================================================================
   Utils
   ========================================================================= */
type AnyRec = Record<string, any>;
const getModel = (name: string) => (prisma as any)[name];

const toArray = (v: unknown): string[] => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  return [String(v)];
};

// Especialidad (3 dígitos) → CUPS (6 dígitos). Si ya llega CUPS, se respeta.
const ESPECIALIDAD_TO_CUPS: Record<string, string> = {
  "016": "890201", // Medicina General
  "022": "890203", // Odontología
  "062": "890262", // Medicina Laboral
  "036": "890206", // Nutrición
};
const especialidadesToCups = (codes: string[]): string[] => {
  const out: string[] = [];
  for (const c of codes) {
    const t = (c || "").trim();
    if (!t) continue;
    if (/^\d{6}$/.test(t)) out.push(t);
    else if (ESPECIALIDAD_TO_CUPS[t]) out.push(ESPECIALIDAD_TO_CUPS[t]);
  }
  return Array.from(new Set(out));
};

// Fechas "YYYY-MM-DD" → Date (local) inicio/fin del día
const parseLocalDate = (s: string): Date | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const startOfDayLocal = (s?: string): Date | undefined => {
  if (!s) return;
  const d = parseLocalDate(s);
  if (!d) return;
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfDayLocal = (s?: string): Date | undefined => {
  if (!s) return;
  const d = parseLocalDate(s);
  if (!d) return;
  d.setHours(23, 59, 59, 999);
  return d;
};

const fmtDate = (v: any): string => {
  try {
    if (!v) return "";
    if (typeof v === "string") return v.slice(0, 10);
    const d = new Date(v);
    return isNaN(+d) ? "" : d.toISOString().slice(0, 10);
  } catch { return ""; }
};
const fmtTimeHHmm = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 5); // "HH:MM"
  try { return new Date(v).toISOString().slice(11, 16); } catch { return ""; }
};

/* =========================================================================
   Handler
   ========================================================================= */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const {
      desde, hasta, horaDesde, horaHasta, eps,
      especialidad, especialidades, especialidadesCsv,
      medicos, medicosCsv,
    } = req.body ?? {};

    // Normaliza entradas
    const especialidadesArr = toArray(especialidad ?? especialidades ?? especialidadesCsv);
    const medicosArr        = toArray(medicos ?? medicosCsv);
    const cupsArr           = especialidadesToCups(especialidadesArr);

    // where de agenda SOLO con campos de agenda
    const where: AnyRec = {};

    // Rango de fechas — Prisma espera Date
    const gte = startOfDayLocal(desde);
    const lte = endOfDayLocal(hasta);
    if (gte || lte) {
      where[A.fecha] = {};
      if (gte) where[A.fecha].gte = gte;
      if (lte) where[A.fecha].lte = lte;
    }

    if (cupsArr.length) where[A.tipocita] = { in: cupsArr };
    if (medicosArr.length) where[A.idmedico] = { in: medicosArr };

    // Modelos
    const agendaModel   = getModel(MODEL.agenda);
    const usuarioModel  = getModel(MODEL.usuario);
    const empleadoModel = getModel(MODEL.empleado);

    if (!agendaModel?.findMany) {
      return res.status(500).json({ error: "Modelo Prisma 'agenda' no disponible. Revisa schema.prisma." });
    }
    if (!usuarioModel?.findMany || !empleadoModel?.findMany) {
      return res.status(500).json({ error: "Modelos Prisma 'usuarios' o 'empleados' no disponibles. Revisa schema.prisma." });
    }

    // SELECT de agenda (incluye idhora)
    const selectAgenda: AnyRec = {
      [A.id]: true,
      [A.fecha]: true,
      [A.hora]: true,
      [A.idusuario]: true,
      [A.idmedico]: true,
      [A.estado]: true,
      [A.tipocita]: true,
    };

    const orderBy: AnyRec[] = [{ [A.fecha]: "asc" }, { [A.hora]: "asc" }];

    const agendas: AnyRec[] = await agendaModel.findMany({
      where,
      select: selectAgenda,
      orderBy,
    });

    // Filtro por rango de horas en memoria (idhora tipo "HH:MM")
    let filteredAgendas = agendas;
    if (horaDesde || horaHasta) {
      const hFrom = (horaDesde || "").slice(0, 5); // "HH:MM"
      const hTo   = (horaHasta || "").slice(0, 5);
      filteredAgendas = agendas.filter((r) => {
        const hhmm = fmtTimeHHmm(r[A.hora]);
        if (!hhmm) return false;
        if (hFrom && hhmm < hFrom) return false;
        if (hTo && hhmm > hTo) return false;
        return true;
      });
    }

    // -------- Usuarios: soportar join por IdUsuario (int) O por Identificación_usuario (string) --------
    const rawUserKeys = Array.from(
      new Set(filteredAgendas.map(r => r[A.idusuario]).filter(Boolean))
    ) as string[];

    const numericIds = rawUserKeys.filter(k => /^\d+$/.test(k)).map(k => parseInt(k, 10));
    const identKeys  = rawUserKeys; // pueden ser cédulas / identificaciones

    const usuariosByPk: AnyRec[] = numericIds.length ? await usuarioModel.findMany({
      where: { [U.id]: { in: numericIds } },
      select: {
        [U.id]: true,
        [U.ident]: true,
        [U.eps]: true,
        [U.pNombre]: true,
        [U.sNombre]: true,
        [U.pApellido]: true,
        [U.sApellido]: true,
      },
    }) : [];

    const usuariosByIdent: AnyRec[] = identKeys.length ? await usuarioModel.findMany({
      where: { [U.ident]: { in: identKeys } },
      select: {
        [U.id]: true,
        [U.ident]: true,
        [U.eps]: true,
        [U.pNombre]: true,
        [U.sNombre]: true,
        [U.pApellido]: true,
        [U.sApellido]: true,
      },
    }) : [];

    const uMapByPk    = new Map<number, AnyRec>(usuariosByPk.map(u => [u[U.id], u]));
    const uMapByIdent = new Map<string, AnyRec>(usuariosByIdent.map(u => [u[U.ident], u]));

    // Empleados
    const medIds = Array.from(new Set(filteredAgendas.map(r => r[A.idmedico]).filter(Boolean)));
    const empleados: AnyRec[] = medIds.length ? await empleadoModel.findMany({
      where: { [E.codigo]: { in: medIds } },
      select: { [E.codigo]: true, [E.nombre]: true },
    }) : [];
    const eMap = new Map<string, AnyRec>(empleados.map(e => [e[E.codigo], e]));

    // Filtro por EPS (después de cruzar con usuarios por cualquiera de las dos llaves)
    const finalAgendas = eps
      ? filteredAgendas.filter(r => {
          const key = r[A.idusuario];
          let u: AnyRec | undefined;
          if (key && /^\d+$/.test(String(key))) {
            u = uMapByPk.get(parseInt(String(key), 10)) || uMapByIdent.get(String(key));
          } else {
            u = uMapByIdent.get(String(key));
          }
          return u ? String(u[U.eps]) === String(eps) : false;
        })
      : filteredAgendas;

    // Respuesta normalizada
    const rows = finalAgendas.map((r) => {
      const key = r[A.idusuario];
      let u: AnyRec | undefined;
      if (key && /^\d+$/.test(String(key))) {
        u = uMapByPk.get(parseInt(String(key), 10)) || uMapByIdent.get(String(key));
      } else {
        u = uMapByIdent.get(String(key));
      }
      const e = eMap.get(r[A.idmedico]);

      const paciente = [
        u?.[U.pNombre] ?? "",
        u?.[U.sNombre] ?? "",
        u?.[U.pApellido] ?? "",
        u?.[U.sApellido] ?? "",
      ].filter(Boolean).join(" ").trim();

      return {
        cita_id: r[A.id] ?? null,
        fecha: fmtDate(r[A.fecha]),
        hora: fmtTimeHHmm(r[A.hora]),
        idusuario: r[A.idusuario] ?? null,
        paciente: paciente || null,
        eps: u?.[U.eps] ?? null,
        idmedico: r[A.idmedico] ?? null,
        medico: e?.[E.nombre] ?? null,
        estado: r[A.estado] ?? null,
        tipo_cita: r[A.tipocita] ?? null,
      };
    });

    return res.status(200).json({ rows });
  } catch (err: any) {
    console.error("API /api/cupos/list error:", err);
    const msg = err?.message || "Error interno al listar cupos.";
    return res.status(500).json({ error: msg });
  }
}
