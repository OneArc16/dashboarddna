// src/pages/api/catalog/medicos.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

type Option = { value: string; label: string };

// Helpers ----------------------------------------------------------
function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string")
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

function parseEspecialidades(req: NextApiRequest): string[] {
  const out = new Set<string>();

  // Body (POST) – soporta {especialidades:[...]}, {especialidad:[...]}, CSV, string
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const b = body?.especialidades ?? body?.especialidad;
      for (const s of toArray(b)) out.add(s);
    } catch {
      /* body vacío o no-JSON */
    }
  }

  // Query (GET) – soporta ?especialidad=016&especialidad=022, CSV y variantes
  const q = req.query as Record<string, unknown>;
  const keys = ["especialidad", "especialidad[]", "especialidades", "especialidades[]"];
  for (const k of keys) {
    if (q[k] !== undefined) {
      for (const s of toArray(q[k])) out.add(s);
    }
  }

  return Array.from(out);
}

// Handler ----------------------------------------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const especialidades = parseEspecialidades(req); // p.ej. ["016","022"]

    // Base: SOLO médicos (Perfil = 2) del centro 900018045
    const whereEmpleados: any = {
      Perfil: 2,
      IdCentro: 900018045,
    };

    // Si vienen especialidades, limitar por relación especialidad_empleados
    if (especialidades.length > 0) {
      const rels = await prisma.especialidad_empleados.findMany({
        where: { C_digo_especialidad: { in: especialidades } },
        select: { C_digo_empleado: true },
      });

      const codigos = Array.from(new Set(rels.map((r) => r.C_digo_empleado))).filter(Boolean);
      if (codigos.length === 0) {
        return res.status(200).json({ options: [] as Option[] });
      }
      whereEmpleados.C_digo_empleado = { in: codigos };
    }

    const medicos = await prisma.empleados.findMany({
      where: whereEmpleados,
      select: { C_digo_empleado: true, Nombre_empleado: true },
      orderBy: { Nombre_empleado: "asc" },
    });

    const options: Option[] = medicos.map((m) => ({
      value: m.C_digo_empleado,
      label: m.Nombre_empleado ?? m.C_digo_empleado,
    }));

    return res.status(200).json({ options });
  } catch (e: any) {
    console.error("API /catalog/medicos error:", e);
    return res.status(500).json({ error: e?.message ?? "Error" });
  }
}
