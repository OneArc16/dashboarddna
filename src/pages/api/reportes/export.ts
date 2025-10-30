import type { NextApiRequest, NextApiResponse } from "next";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  FiltrosSchema,
  buildWherePrisma,
  fmtFecha,
  fmtHoraFromIdHora,
  buildNombre,
  MAX_LIMIT,
} from "@/lib/reportes";

function qstr(q: any, k: string) {
  const v = q?.[k];
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

    // Leer filtros desde query
    const desde = qstr(req.query, "desde") || "";
    const hasta = qstr(req.query, "hasta") || "";
    const eps = qstr(req.query, "eps") || undefined;
    const especialidad = qstr(req.query, "especialidad") || undefined;
    const medico = qstr(req.query, "medico") || undefined;

    // estados puede venir como "A,B,C" o repetidos ?estados=A&estados=B
    const estadosParam = req.query.estados;
    const estados =
      estadosParam == null
        ? undefined
        : Array.isArray(estadosParam)
        ? estadosParam
        : String(estadosParam).split(",").map((s) => s.trim());

    // Normalizamos con schema; para export usamos MAX_LIMIT y offset 0
    const parsed = FiltrosSchema.parse({
      desde,
      hasta,
      eps,
      especialidad,
      medico,
      estados,
      limit: MAX_LIMIT,
      offset: 0,
    });

    // WHERE base (fechas + estados)
    let whereAgenda: any = buildWherePrisma(parsed);

    // Especialidad => filtra por CUPS en agenda.TipoCita
    if (parsed.especialidad) {
      const spec = await prisma.tvespecialidades.findUnique({
        where: { CodigoEspecialidad: parsed.especialidad },
        select: { CUPS: true },
      });
      const cups = spec?.CUPS?.trim();
      if (!cups) {
        // Devuelve Excel vacío con headers
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Reporte");
        ws.columns = [
          { header: "ID Cita", key: "cita_id", width: 12 },
          { header: "Fecha", key: "fecha", width: 12 },
          { header: "Hora", key: "hora", width: 10 },
          { header: "Paciente", key: "paciente", width: 35 },
          { header: "EPS", key: "eps", width: 12 },
          { header: "ID Médico", key: "idmedico", width: 14 },
          { header: "Médico", key: "medico", width: 35 },
          { header: "Estado", key: "estado", width: 14 },
          { header: "Tipo Cita (CUPS)", key: "tipo_cita", width: 18 },
        ];
        ws.getRow(1).font = { bold: true };
        const buf = await wb.xlsx.writeBuffer();
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="reporte_${parsed.desde}_a_${parsed.hasta}.xlsx"`
        );
        return res.status(200).send(Buffer.from(buf));
      }
      whereAgenda = { ...whereAgenda, TipoCita: { equals: cups } };
    }

    // Médico
    if (parsed.medico) whereAgenda = { ...whereAgenda, idmedico: parsed.medico };

    // Recolectamos todas las filas (aplicando EPS al vuelo)
    const rowsOut: Array<{
      cita_id: number | null;
      fecha: string;
      hora: string | null;
      paciente: string | null;
      eps: string | null;
      idmedico: string | null;
      medico: string | null;
      estado: string | null;
      tipo_cita: string | null;
    }> = [];

    const BATCH = 5000;
    let skip = 0;

    while (rowsOut.length < MAX_LIMIT) {
      const batch = await prisma.agenda.findMany({
        where: whereAgenda,
        orderBy: { fecha_cita: "desc" },
        skip,
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
      skip += BATCH;

      // Hydrate users y médicos
      const userIds = Array.from(
        new Set(
          batch
            .map((b) => parseInt((b.idusuario ?? "").trim(), 10))
            .filter((n) => Number.isFinite(n))
        )
      );
      const users = userIds.length
        ? await prisma.usuarios.findMany({
            where: { IdUsuario: { in: userIds } },
            select: {
              IdUsuario: true,
              Primer_nombre: true,
              Segundo_nombre: true,
              Primer_apellido: true,
              Segundo_apellido: true,
              Codigo_eps: true,
            },
          })
        : [];
      const mUsers = new Map(users.map((u) => [u.IdUsuario, u]));

      const docIds = Array.from(
        new Set(batch.map((b) => b.idmedico).filter((x): x is string => !!x))
      );
      const docs = docIds.length
        ? await prisma.empleados.findMany({
            where: { C_digo_empleado: { in: docIds } },
            select: { C_digo_empleado: true, Nombre_empleado: true },
          })
        : [];
      const mDocs = new Map(docs.map((d) => [d.C_digo_empleado, d]));

      for (const a of batch) {
        const idn = parseInt((a.idusuario ?? "").trim(), 10);
        const u = Number.isFinite(idn) ? mUsers.get(idn) : undefined;

        // Filtra por EPS si viene
        if (parsed.eps && u?.Codigo_eps !== parsed.eps) continue;

        const d = a.idmedico ? mDocs.get(a.idmedico) : undefined;

        rowsOut.push({
          cita_id: a.idagenda ?? null,
          fecha: fmtFecha(a.fecha_cita),
          hora: fmtHoraFromIdHora(a.idhora),
          paciente: buildNombre(u) || null,
          eps: u?.Codigo_eps ?? null,
          idmedico: a.idmedico ?? null,
          medico: d?.Nombre_empleado ?? null,
          estado: a.Estado ?? null,
          tipo_cita: a.TipoCita ?? null,
        });

        if (rowsOut.length >= MAX_LIMIT) break;
      }
    }

    // ===== Excel sin fila de "Filtros" =====
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reporte");

    ws.columns = [
      { header: "ID Cita", key: "cita_id", width: 12 },
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Hora", key: "hora", width: 10 },
      { header: "Paciente", key: "paciente", width: 35 },
      { header: "EPS", key: "eps", width: 12 },
      { header: "ID Médico", key: "idmedico", width: 14 },
      { header: "Médico", key: "medico", width: 35 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Tipo Cita (CUPS)", key: "tipo_cita", width: 18 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.addRows(rowsOut);

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="reporte_${parsed.desde}_a_${parsed.hasta}.xlsx"`
    );
    return res.status(200).send(Buffer.from(buf));
  } catch (e: any) {
    console.error("API /reportes/export error:", e);
    res.status(500).json({ error: e?.message ?? "Error" });
  }
}
