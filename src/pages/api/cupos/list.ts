// src/pages/api/cupos/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

type AnyRec = Record<string, any>;

const FALLBACK_CUPS: Record<string, string> = {
  "016": "890201", // Medicina General
  "022": "890203", // Odontología
  "062": "890262", // Medicina Laboral
  "036": "890206", // Nutrición
};

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function toList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .flatMap((x) => String(x).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function dateOnlyUTC(yyyyMmDd: string): Date {
  // agenda.fecha_cita es DATE sin hora: basta con la fecha UTC 00:00
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function buildNombre(u: {
  Primer_nombre: string | null;
  Segundo_nombre: string | null;
  Primer_apellido: string | null;
  Segundo_apellido: string | null;
}) {
  return [
    u.Primer_nombre,
    u.Segundo_nombre,
    u.Primer_apellido,
    u.Segundo_apellido,
  ]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

type PacienteInfo = {
  nombre: string | null;
  doc_tipo: string | null;
  doc_numero: string | null;
  eps: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

    const b = req.body ?? {};

    const desde: string | undefined = b.desde || undefined;
    const hasta: string | undefined = b.hasta || undefined;
    const horaDesde: string | undefined = b.horaDesde || undefined; // "HH:MM"
    const horaHasta: string | undefined = b.horaHasta || undefined; // "HH:MM"
    const eps: string | undefined = b.eps || undefined;

    // Acepta múltiples formatos desde el front (array o CSV)
    const especialidades = uniq([
      ...toList(b.especialidad),
      ...toList(b.especialidades),
      ...toList(b.especialidadCsv),
      ...toList(b.especialidadesCsv),
    ]);
    const medicos = uniq([...toList(b.medicos), ...toList(b.medicosCsv)]);

    // ----- WHERE base
    const where: AnyRec = {};
    if (desde && hasta) {
      where.fecha_cita = { gte: dateOnlyUTC(desde), lte: dateOnlyUTC(hasta) };
    } else if (desde) {
      where.fecha_cita = { gte: dateOnlyUTC(desde) };
    } else if (hasta) {
      where.fecha_cita = { lte: dateOnlyUTC(hasta) };
    }

    const and: AnyRec[] = [];
    if (horaDesde) and.push({ idhora: { gte: horaDesde } });
    if (horaHasta) and.push({ idhora: { lte: horaHasta } });
    if (and.length) where.AND = and;

    if (eps) where.Entidad = eps;

    // ----- Especialidades -> CUPS
    if (especialidades.length) {
      const tv = await prisma.tvespecialidades.findMany({
        where: { CodigoEspecialidad: { in: especialidades } },
        select: { CUPS: true, CodigoEspecialidad: true },
      });

      let cups = tv
        .map((r) => (r.CUPS || "").trim())
        .filter(Boolean);

      // complementar con fallbacks si falta alguno
      for (const esp of especialidades) {
        const fb = FALLBACK_CUPS[esp];
        if (fb && !cups.includes(fb)) cups.push(fb);
      }
      cups = uniq(cups);

      if (cups.length) where.TipoCita = { in: cups };
    }

    // ----- Médicos
    if (medicos.length) {
      where.idmedico = { in: medicos };
    }

    // ----- Consulta principal
    const agendas = await prisma.agenda.findMany({
      where,
      select: {
        idagenda: true,
        fecha_cita: true,
        idhora: true,
        idusuario: true, // VARCHAR(18)
        idmedico: true,
        Estado: true,
        TipoCita: true,
        Entidad: true,
      },
      orderBy: [{ fecha_cita: "asc" }, { idhora: "asc" }],
      take: 5000,
    });

    // ===== Enriquecer con PACIENTE (nombre + tipo y número de documento + EPS)
    const rawUserKeys = uniq(
      agendas.map((a) => (a.idusuario || "").trim()).filter(Boolean)
    );
    const numericUserIds = rawUserKeys
      .filter((x) => /^\d+$/.test(x))
      .map((x) => Number(x));

    let usuarios: Array<{
      IdUsuario: number;
      Identificaci_n_usuario: string;
      Tipo_identificaci_n: string;
      Codigo_eps: string;
      Primer_nombre: string | null;
      Segundo_nombre: string | null;
      Primer_apellido: string | null;
      Segundo_apellido: string | null;
    }> = [];

    if (rawUserKeys.length) {
      usuarios = await prisma.usuarios.findMany({
        where: {
          OR: [
            numericUserIds.length
              ? ({ IdUsuario: { in: numericUserIds } } as any)
              : undefined,
            { Identificaci_n_usuario: { in: rawUserKeys } },
          ].filter(Boolean) as any,
        },
        select: {
          IdUsuario: true,
          Identificaci_n_usuario: true,
          Tipo_identificaci_n: true,
          Codigo_eps: true,
          Primer_nombre: true,
          Segundo_nombre: true,
          Primer_apellido: true,
          Segundo_apellido: true,
        },
      });
    }

    const pacientePorDoc: Record<string, PacienteInfo> = {};
    const pacientePorId: Record<number, PacienteInfo> = {};

    for (const u of usuarios) {
      const info: PacienteInfo = {
        nombre: buildNombre(u),
        doc_tipo: u.Tipo_identificaci_n ?? null,
        doc_numero: u.Identificaci_n_usuario ?? null,
        eps: u.Codigo_eps ?? null,
      };

      if (u.Identificaci_n_usuario) {
        pacientePorDoc[u.Identificaci_n_usuario] = info;
      }
      if (typeof u.IdUsuario === "number") {
        pacientePorId[u.IdUsuario] = info;
      }
    }

    // ===== Enriquecer con NOMBRE DEL MÉDICO
    const codsMed = uniq(
      agendas.map((a) => (a.idmedico || "").trim()).filter(Boolean)
    );
    const medRows =
      codsMed.length > 0
        ? await prisma.empleados.findMany({
            where: { C_digo_empleado: { in: codsMed } },
            select: { C_digo_empleado: true, Nombre_empleado: true },
          })
        : [];
    const medicoPorCodigo: Record<string, string> = {};
    for (const m of medRows) {
      medicoPorCodigo[m.C_digo_empleado] =
        m.Nombre_empleado ?? m.C_digo_empleado;
    }

    // ===== Respuesta
    const rows = agendas.map((a) => {
      const idu = (a.idusuario || "").trim();

      let info: PacienteInfo | undefined;
      if (idu) {
        info =
          pacientePorDoc[idu] ??
          (/^\d+$/.test(idu) ? pacientePorId[Number(idu)] : undefined);
      }

      return {
        cita_id: a.idagenda,
        fecha: a.fecha_cita.toISOString().slice(0, 10),
        hora: a.idhora,
        // idusuario crudo
        idusuario: idu || null,
        // datos de paciente
        paciente: info?.nombre ?? null,
        doc_tipo: info?.doc_tipo ?? null,
        doc_numero: info?.doc_numero ?? null,
        // EPS primero la del paciente, si no, la de la agenda
        eps: info?.eps ?? a.Entidad ?? null,
        // resto de campos
        idmedico: a.idmedico,
        medico: a.idmedico ? medicoPorCodigo[a.idmedico] ?? null : null,
        estado: a.Estado ?? null,
        tipo_cita: a.TipoCita ?? null,
      };
    });

    return res.status(200).json({ rows });
  } catch (err: any) {
    console.error("API /api/cupos/list error:", err);
    return res.status(500).json({ error: err?.message ?? "Error" });
  }
}
