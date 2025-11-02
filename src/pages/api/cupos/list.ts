// src/pages/api/cupos/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

type AnyRec = Record<string, any>;

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

function dateOnly(d: string): Date {
  // columna es @db.Date, el tiempo se ignora, basta con un Date del día
  return new Date(`${d}T00:00:00.000Z`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

    const body = req.body ?? {};
    const { desde, hasta } = body as { desde?: string; hasta?: string };

    const horaDesde: string | undefined = body.horaDesde || undefined; // "HH:MM"
    const horaHasta: string | undefined = body.horaHasta || undefined;
    const eps: string | undefined = body.eps || undefined;

    // Unificamos entradas posibles
    const espList = Array.from(
      new Set([
        ...toList(body.especialidad),
        ...toList(body.especialidades),
        ...toList(body.especialidadCsv),
        ...toList(body.especialidadesCsv),
      ])
    );
    const medList = Array.from(
      new Set([...toList(body.medicos), ...toList(body.medicosCsv)])
    );

    // Armado del where
    const where: AnyRec = {};

    if (desde && hasta) {
      where.fecha_cita = {
        gte: dateOnly(desde),
        lte: dateOnly(hasta),
      };
    }

    const and: AnyRec[] = [];
    if (horaDesde) and.push({ idhora: { gte: horaDesde } });
    if (horaHasta) and.push({ idhora: { lte: horaHasta } });
    if (and.length) where.AND = and;

    if (eps) {
      // Si agenda guarda el código EPS aquí, filtramos directo.
      // Si en tu caso se filtra por otra columna, cámbialo acá.
      where.Entidad = eps;
    }

    // ===== CUPS dinámicos desde tvespecialidades =====
    if (espList.length) {
      // Saca los CUPS asociados a las especialidades seleccionadas
      const cupsRows = await prisma.tvespecialidades.findMany({
        where: { CodigoEspecialidad: { in: espList } },
        select: { CUPS: true, CodigoEspecialidad: true },
      });

      let cups = cupsRows
        .map((r) => (r.CUPS || "").trim())
        .filter(Boolean);

      // Fallback de los que ya nos pasaste (por si alguna especialidad no tiene CUPS en la tabla)
      const fallback: Record<string, string> = {
        "016": "890201", // Medicina General
        "022": "890203", // Odontología
        "062": "890262", // Medicina Laboral
        "036": "890206", // Nutrición
      };
      for (const esp of espList) {
        const fb = fallback[esp];
        if (fb && !cups.includes(fb)) cups.push(fb);
      }

      // Solo aplicar el filtro si hay CUPS
      if (cups.length) {
        where.TipoCita = { in: cups };
      }
    }

    // Médicos seleccionados
    if (medList.length) {
      where.idmedico = { in: medList };
    }

    const agendas = await prisma.agenda.findMany({
      where,
      select: {
        idagenda: true,
        fecha_cita: true,
        idhora: true,
        idusuario: true,
        idmedico: true,
        Estado: true,
        TipoCita: true,
        Entidad: true,
      },
      orderBy: [{ fecha_cita: "asc" }, { idhora: "asc" }],
      take: 5000,
    });

    // Nombres de médicos (opcional pero útil)
    const medIds = Array.from(
      new Set(agendas.map((a) => a.idmedico).filter(Boolean) as string[])
    );
    let medMap: Record<string, string> = {};
    if (medIds.length) {
      const ms = await prisma.empleados.findMany({
        where: { C_digo_empleado: { in: medIds } },
        select: { C_digo_empleado: true, Nombre_empleado: true },
      });
      medMap = Object.fromEntries(
        ms.map((m) => [m.C_digo_empleado, m.Nombre_empleado ?? m.C_digo_empleado])
      );
    }

    const rows = agendas.map((a) => ({
      cita_id: a.idagenda,
      fecha: a.fecha_cita.toISOString().slice(0, 10),
      hora: a.idhora,
      idusuario: a.idusuario ? Number(a.idusuario) : null,
      paciente: null, // si luego quieres nombre, se puede enriquecer
      eps: a.Entidad ?? null,
      idmedico: a.idmedico,
      medico: a.idmedico ? medMap[a.idmedico] ?? a.idmedico : null,
      estado: a.Estado ?? null,
      tipo_cita: a.TipoCita ?? null,
    }));

    return res.status(200).json({ rows });
  } catch (err: any) {
    console.error("API /api/cupos/list error:", err);
    return res.status(500).json({ error: err?.message ?? "Error" });
  }
}
