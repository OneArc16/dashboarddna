// src/pages/api/reportes/data.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import {
  FiltrosSchema,
  buildWherePrisma,
  fmtFecha,
  fmtHoraFromIdHora,
  buildNombre,
} from "@/lib/reportes";

type ReportRow = {
  cita_id: number | null;
  fecha: string;
  hora: string | null;
  idusuario: number | null;
  paciente: string | null;
  eps: string | null;
  idmedico: string | null;
  medico: string | null;
  estado: string | null;
  tipo_cita: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

    const parsed = FiltrosSchema.parse(req.body);

    // ---- compatibilidad: aceptar singular o array ----
    const p: any = parsed;
    const eps: string | undefined = p.eps || undefined;

    const especialidades: string[] = Array.isArray(p.especialidades)
      ? p.especialidades
      : p.especialidad
      ? [p.especialidad]
      : [];

    const medicos: string[] = Array.isArray(p.medicos)
      ? p.medicos
      : p.medico
      ? [p.medico]
      : [];

    // where base: fechas + estados (NO incluye eps/especialidad/medicos)
    const whereAgendaBase = buildWherePrisma(parsed);

    // --- Construimos el where final sobre AGENDA ---
    let whereAgenda: any = { ...whereAgendaBase };

    // Especialidades -> mapear a lista de CUPS y filtrar por agenda.TipoCita IN (...)
    if (especialidades.length > 0) {
      const specs = await prisma.tvespecialidades.findMany({
        where: { CodigoEspecialidad: { in: especialidades } },
        select: { CUPS: true },
      });
      const cupsList = specs
        .map((s) => (s.CUPS ?? "").trim())
        .filter((x) => x.length > 0);

      if (cupsList.length === 0) {
        return res.status(200).json({ rows: [] });
      }

      whereAgenda = { ...whereAgenda, TipoCita: { in: cupsList } };
    }

    // Médicos -> filtrar por agenda.idmedico IN (...)
    if (medicos.length > 0) {
      whereAgenda = { ...whereAgenda, idmedico: { in: medicos } };
    }

    // ===== Igual que antes: dos caminos (con / sin EPS) =====

    // caches
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
            .filter((v): v is number => v !== null)
        )
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

    // Sin EPS ⇒ paginamos directamente en BD
    if (!eps) {
      const agendaRows = await prisma.agenda.findMany({
        where: whereAgenda,
        orderBy: { fecha_cita: "desc" },
        skip: parsed.offset,
        take: parsed.limit,
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

      await hydrateUsers(agendaRows);
      await hydrateDocs(agendaRows);

      const rows: ReportRow[] = agendaRows.map((a) => {
        const n = parseInt((a.idusuario ?? "").trim(), 10);
        const u = Number.isFinite(n) ? userCache.get(n) : undefined;
        const d = a.idmedico ? docCache.get(a.idmedico) : undefined;
        return {
          cita_id: a.idagenda ?? null,
          fecha: fmtFecha(a.fecha_cita),
          hora: fmtHoraFromIdHora(a.idhora),
          idusuario: u?.IdUsuario ?? null,
          paciente: buildNombre(u) || null,
          eps: u?.Codigo_eps ?? null,
          idmedico: a.idmedico ?? null,
          medico: d?.Nombre_empleado ?? null,
          estado: a.Estado ?? null,
          tipo_cita: a.TipoCita ?? null,
        };
      });

      return res.status(200).json({ rows });
    }

    // Con EPS ⇒ escaneo incremental (whereAgenda ya incluye filtros de especialidad y médicos)
    const TARGET_END = parsed.offset + parsed.limit;
    const BATCH = 2000;
    const SCAN_CAP = 200_000;

    let scanSkip = 0;
    let scanned = 0;
    const matched: any[] = [];

    while (matched.length < TARGET_END && scanned < SCAN_CAP) {
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
        if (u?.Codigo_eps === eps) matched.push(a);
        if (matched.length >= TARGET_END) break;
      }
    }

    const pageSlice = matched.slice(parsed.offset, parsed.offset + parsed.limit);

    const rows: ReportRow[] = pageSlice.map((a) => {
      const n = parseInt((a.idusuario ?? "").trim(), 10);
      const u = Number.isFinite(n) ? userCache.get(n) : undefined;
      const d = a.idmedico ? docCache.get(a.idmedico) : undefined;
      return {
        cita_id: a.idagenda ?? null,
        fecha: fmtFecha(a.fecha_cita ?? undefined),
        hora: fmtHoraFromIdHora(a.idhora ?? undefined),
        idusuario: u?.IdUsuario ?? null,
        paciente: buildNombre(u) || null,
        eps: u?.Codigo_eps ?? null,
        idmedico: a.idmedico ?? null,
        medico: d?.Nombre_empleado ?? null,
        estado: a.Estado ?? null,
        tipo_cita: a.TipoCita ?? null,
      };
    });

    return res.status(200).json({ rows });
  } catch (e: any) {
    console.error("API /reportes/data error:", e);
    res.status(400).json({ error: e?.message ?? "Error" });
  }
}
