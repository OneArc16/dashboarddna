// src/pages/api/cupos/delete.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

function parseIds(input: any): number[] {
  if (!input) return [];
  const raw: string[] = Array.isArray(input)
    ? input.flatMap((x) => String(x ?? "").split(","))
    : String(input).split(",");

  const ids = raw
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  // evitar duplicados
  return Array.from(new Set(ids));
}

function isSinAsignar(estado?: string | null): boolean {
  const v = (estado ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().trim();
  // admite variantes habituales
  return v === "SIN ASIGNAR" || v.startsWith("SIN ASIGNAR");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const ids = parseIds(req.body?.ids);
    if (ids.length === 0) {
      return res.status(400).json({ error: "Debes enviar al menos un ID válido en 'ids'." });
    }

    // Traer los registros para validar estado
    const rows = await prisma.agenda.findMany({
      where: { idagenda: { in: ids } },
      select: { idagenda: true, Estado: true },
    });

    // Verificaciones básicas
    const encontrados = new Set(rows.map((r) => r.idagenda));
    const idsInexistentes = ids.filter((id) => !encontrados.has(id));
    if (idsInexistentes.length > 0) {
      return res.status(400).json({
        error: `Algunos IDs no existen: ${idsInexistentes.slice(0, 10).join(", ")}${idsInexistentes.length > 10 ? "…" : ""}`,
      });
    }

    // Validar que todos sean "Sin asignar"
    const noLibres = rows.filter((r) => !isSinAsignar(r.Estado));
    if (noLibres.length > 0) {
      const sample = noLibres.slice(0, 10).map((r) => `${r.idagenda} (${r.Estado ?? "sin estado"})`).join(", ");
      return res.status(400).json({
        error: `Solo se pueden eliminar cupos SIN ASIGNAR. No libres: ${sample}${noLibres.length > 10 ? "…" : ""}`,
      });
    }

    // Eliminar (protección adicional por estado exacto)
    const result = await prisma.agenda.deleteMany({
      where: {
        idagenda: { in: ids },
        Estado: "Sin asignar", // colación de MySQL suele ser case-insensitive; ajusta si tuvieras variantes
      },
    });

    return res.status(200).json({ ok: true, deleted: result.count });
  } catch (e: any) {
    console.error("API /api/cupos/delete error:", e);
    return res.status(500).json({ error: e?.message ?? "Error interno del servidor" });
  }
}
