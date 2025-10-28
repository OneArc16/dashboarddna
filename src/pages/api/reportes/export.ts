// src/pages/api/reportes/export.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import {
  FiltrosSchema,
  buildWherePrisma,
  fmtFecha,
  fmtHoraFromIdHora,
  buildNombre,
} from "@/lib/reportes";
import { z } from "zod";

const ExportSchema = FiltrosSchema.omit({ limit: true, offset: true }); // <-- no limit/offset para export

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

    // ====== Leer query ======
    const desde = String(req.query.desde ?? "");
    const hasta = String(req.query.hasta ?? "");
    const eps = req.query.eps ? String(req.query.eps) : undefined;
    const especialidad = req.query.especialidad ? String(req.query.especialidad) : undefined;
    const medico = req.query.medico ? String(req.query.medico) : undefined;
    const estados = String(req.query.estados ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as z.infer<typeof FiltrosSchema>["estados"];

    // Validar/normalizar (sin limit/offset)
    const parsed = ExportSchema.parse({
      desde,
      hasta,
      eps,
      estados,
      especialidad,
      medico,
    });

    // ====== WHERE base (fecha + estados) ======
    let whereAgenda: any = buildWherePrisma({ ...parsed, limit: 1, offset: 0 } as any); // limit/offset ignorados

    // Especialidad -> CUPS -> agenda.TipoCita
    if (especialidad) {
      const spec = await prisma.tvespecialidades.findUnique({
        where: { CodigoEspecialidad: especialidad },
        select: { CUPS: true },
      });
      const cups = spec?.CUPS?.trim();
      if (!cups) return sendExcel(res, [], parsed);
      whereAgenda = { ...whereAgenda, TipoCita: { equals: cups } };
      // Si en tu DB TipoCita tiene texto adicional, usa: { startsWith: cups }
    }

    // Médico -> agenda.idmedico
    if (medico) whereAgenda = { ...whereAgenda, idmedico: { equals: medico } };

    // ====== Caches (joins en memoria) ======
    const userCache = new Map<
      number,
      {
        IdUsuario: number;
        Primer_nombre: string | null;
        Segundo_nombre: string | null;
        Primer_apellido: string | null;
        Segundo_apellido: string | null;
        Codigo_eps: string | null;
      }
    >();
    const docCache = new Map<string, { C_digo_empleado: string; Nombre_empleado: string | null }>();

    async function hydrateUsers(rows: { idusuario: string | null }[]) {
      const ids = Array.from(
        new Set(
          rows
            .map((r) => {
              const n = parseInt((r.idusuario ?? "").trim(), 10);
              return Number.isFinite(n) ? n : null;
            })
            .filter((v): v is number => v !== null),
        ),
      );
      const missing = ids.filter((id) => !userCache.has(id));
      if (missing.length) {
        const found = await prisma.usuarios.findMany({
          where: { IdUsuario: { in: missing } },
          select: {
            IdUsuario: true,
            Primer_nombre: true,
            Segundo_nombre: true,
            Primer_apellido: true,
            Segundo_apellido: true,
            Codigo_eps: true,
          },
        });
        for (const u of found) userCache.set(u.IdUsuario, u);
      }
    }

    async function hydrateDocs(rows: { idmedico: string | null }[]) {
      const ids = Array.from(new Set(rows.map((r) => r.idmedico).filter((x): x is string => !!x)));
      const missing = ids.filter((id) => !docCache.has(id));
      if (missing.length) {
        const found = await prisma.empleados.findMany({
          where: { C_digo_empleado: { in: missing } },
          select: { C_digo_empleado: true, Nombre_empleado: true },
        });
        for (const d of found) docCache.set(d.C_digo_empleado, d);
      }
    }

    // ====== Recolección de datos ======
    const BATCH = 5000;
    const SCAN_CAP = 300_000; // tope de seguridad
    let scanSkip = 0;
    let scanned = 0;
    const collected: {
      idagenda: number | null;
      fecha_cita: Date | null;
      idhora: string | null;
      idusuario: string | null;
      idmedico: string | null;
      Estado: string | null;
      TipoCita: string | null;
    }[] = [];

    if (!parsed.eps) {
      while (scanned < SCAN_CAP) {
        const batch = await prisma.agenda.findMany({
          where: whereAgenda,
          orderBy: { fecha_cita: "desc" },
          skip: scanSkip,
          take: BATCH,
          select: {
            idagenda: true,
            fecha_cita: true,
            idhora: true,
            idusuario: true,
            idmedico: true,
            Estado: true,
            TipoCita: true,
          },
        });
        if (!batch.length) break;
        scanned += batch.length;
        scanSkip += BATCH;

        await hydrateUsers(batch);
        await hydrateDocs(batch);

        collected.push(...batch);
      }
    } else {
      while (scanned < SCAN_CAP) {
        const batch = await prisma.agenda.findMany({
          where: whereAgenda,
          orderBy: { fecha_cita: "desc" },
          skip: scanSkip,
          take: BATCH,
          select: {
            idagenda: true,
            fecha_cita: true,
            idhora: true,
            idusuario: true,
            idmedico: true,
            Estado: true,
            TipoCita: true,
          },
        });
        if (!batch.length) break;
        scanned += batch.length;
        scanSkip += BATCH;

        await hydrateUsers(batch);
        await hydrateDocs(batch);

        for (const a of batch) {
          const n = parseInt((a.idusuario ?? "").trim(), 10);
          const u = Number.isFinite(n) ? userCache.get(n) : undefined;
          if (u?.Codigo_eps === parsed.eps) collected.push(a);
        }
      }
    }

    // ====== Construir filas exportables ======
    const rows = collected.map((a) => {
      const n = parseInt((a.idusuario ?? "").trim(), 10);
      const u = Number.isFinite(n) ? userCache.get(n) : undefined;
      const d = a.idmedico ? docCache.get(a.idmedico) : undefined;
      return {
        cita_id: a.idagenda ?? null,
        fecha: fmtFecha(a.fecha_cita ?? undefined),
        hora: fmtHoraFromIdHora(a.idhora ?? undefined),
        paciente: buildNombre(u) || null,
        eps: u?.Codigo_eps ?? null,
        idmedico: a.idmedico ?? null,
        medico: d?.Nombre_empleado ?? null,
        estado: a.Estado ?? null,
        tipo_cita: a.TipoCita ?? null,
      };
    });

    // ====== Enviar Excel ======
    return sendExcel(res, rows, parsed);
  } catch (e: any) {
    console.error("API /reportes/export error:", e);
    res.status(400).json({ error: e?.message ?? "Error" });
  }
}

/** Genera y envía el Excel */
async function sendExcel(
  res: NextApiResponse,
  rows: Array<{
    cita_id: number | null;
    fecha: string;
    hora: string | null;
    paciente: string | null;
    eps: string | null;
    idmedico: string | null;
    medico: string | null;
    estado: string | null;
    tipo_cita: string | null;
  }>,
  parsed: { desde: string; hasta: string; eps?: string; especialidad?: string; medico?: string }
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Reporte DNAPLUS");

  ws.addRow([]);
  const desc =
    `Filtros: ${parsed.desde} a ${parsed.hasta}` +
    (parsed.eps ? ` | EPS: ${parsed.eps}` : "") +
    (parsed.especialidad ? ` | Esp: ${parsed.especialidad}` : "") +
    (parsed.medico ? ` | Médico: ${parsed.medico}` : "");
  ws.addRow([desc]);
  ws.mergeCells(2, 1, 2, 9);

  ws.columns = [
    { header: "ID Cita", key: "cita_id", width: 10 },
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Hora", key: "hora", width: 10 },
    { header: "Paciente", key: "paciente", width: 32 },
    { header: "EPS", key: "eps", width: 12 },
    { header: "ID Médico", key: "idmedico", width: 12 },
    { header: "Médico", key: "medico", width: 28 },
    { header: "Estado", key: "estado", width: 16 },
    { header: "Tipo Cita (CUPS)", key: "tipo_cita", width: 16 },
  ];

  rows.forEach((r) => ws.addRow(r));

  const buf = await wb.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=reporte_${parsed.desde}_a_${parsed.hasta}.xlsx`
  );
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(Buffer.from(buf));
}
