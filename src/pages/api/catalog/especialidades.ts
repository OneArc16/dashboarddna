// src/pages/api/catalog/especialidades.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

/** "890201 - MEDICINA GENERAL" -> "MEDICINA GENERAL" */
function cleanEspecialidadName(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/^\s*\d+\s*[-–]\s*/u, "").trim();
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await prisma.tvespecialidades.findMany({
      select: { CodigoEspecialidad: true, Especialidad: true },
      // tvespecialidades ya tiene PK único por CodigoEspecialidad
    });

    const options = rows
      .map(r => ({
        value: r.CodigoEspecialidad,                          // p.ej. "016"
        label: cleanEspecialidadName(r.Especialidad) || r.CodigoEspecialidad, // "MEDICINA GENERAL"
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

    res.status(200).json({ options });
  } catch (e: any) {
    console.error("API /catalog/especialidades error:", e);
    res.status(500).json({ error: e?.message ?? "Error" });
  }
}
