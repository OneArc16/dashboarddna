// /src/pages/api/cupos/delete.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

/** Ajusta según tu esquema si difiere */
const T_AGENDA = "`agenda`";
const COL_PK = "`id`";
const COL_ESTADO = "`Estado`";

type Body = { ids: number[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { ids } = req.body as Body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids es obligatorio (array no vacío)" });
    }

    // 1) Validar cuáles están SIN ASIGNAR
    const ph = ids.map(() => "?").join(",");
    const checkSql = `
      SELECT ${COL_PK} AS id
      FROM ${T_AGENDA}
      WHERE ${COL_PK} IN (${ph})
        AND UPPER(${COL_ESTADO}) LIKE 'SIN ASIGNAR%'
    `;
    const canDelete = await prisma.$queryRawUnsafe<{ id: number }[]>(checkSql, ...ids);
    const okIds = canDelete.map(r => r.id);

    if (okIds.length === 0) {
      return res.status(400).json({ error: "Ninguno de los cupos seleccionados está 'SIN ASIGNAR'." });
    }

    // 2) Eliminar solo los válidos
    const delPh = okIds.map(() => "?").join(",");
    const delSql = `
      DELETE FROM ${T_AGENDA}
      WHERE ${COL_PK} IN (${delPh})
        AND UPPER(${COL_ESTADO}) LIKE 'SIN ASIGNAR%'
    `;
    const result: any = await prisma.$executeRawUnsafe(delSql, ...okIds);

    // Nota: MySQL retorna el número de filas afectadas en result (depende del driver).
    // Prisma con $executeRawUnsafe devuelve el count como number.
    const deleted = typeof result === "number" ? result : (result?.affectedRows ?? okIds.length);

    return res.status(200).json({ ok: true, deleted, skipped: ids.length - okIds.length });
  } catch (err: any) {
    console.error("API /api/cupos/delete error:", err);
    return res.status(500).json({ error: err?.message || "Error interno" });
  }
}
