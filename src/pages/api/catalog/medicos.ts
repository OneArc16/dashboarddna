import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const especialidad =
      typeof req.query.especialidad === "string" && req.query.especialidad.trim()
        ? req.query.especialidad.trim()
        : undefined;

    // Base: solo médicos (Perfil = 2)
    const whereEmpleados: any = { Perfil: 2 }; // en tu schema, Perfil es Int?

    // Si viene especialidad, limitamos por relación especialidad_empleados
    if (especialidad) {
      const rels = await prisma.especialidad_empleados.findMany({
        where: { C_digo_especialidad: especialidad },
        select: { C_digo_empleado: true },
      });

      const codigos = Array.from(new Set(rels.map((r) => r.C_digo_empleado)));
      if (codigos.length === 0) {
        return res.status(200).json({ options: [] });
      }
      whereEmpleados.C_digo_empleado = { in: codigos };
    }

    const medicos = await prisma.empleados.findMany({
      where: whereEmpleados,
      select: { C_digo_empleado: true, Nombre_empleado: true }, // solo lo necesario
      orderBy: { Nombre_empleado: "asc" },
    });

    const options = medicos.map((m) => ({
      value: m.C_digo_empleado,
      label: `${m.Nombre_empleado} (${m.C_digo_empleado})`,
    }));

    res.status(200).json({ options });
  } catch (e: any) {
    console.error("API /catalog/medicos error:", e);
    res.status(500).json({ error: e?.message ?? "Error" });
  }
}
