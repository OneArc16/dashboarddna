// src/pages/api/catalog/eps.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    // Trae TODAS las EPS de tventidades (sin importar si hay usuarios asociados)
    const ents = await prisma.tventidades.findMany({
      select: { Codigo: true, NombreEntidad: true },
    });

    // Mapea y ordena por nombre (es-ES, sin diferenciar mayúsculas/minúsculas)
    const options = ents
      .map((e) => ({
        value: e.Codigo,
        label: (e.NombreEntidad ?? "").trim() || e.Codigo, // fallback al código si no hay nombre
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

    res.status(200).json({ options });
  } catch (e: any) {
    console.error("API /catalog/eps error:", e);
    res.status(500).json({ error: e?.message ?? "Error" });
  }
}
