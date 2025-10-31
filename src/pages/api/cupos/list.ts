// /src/pages/api/cupos/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

/** Utilidades ------------------------------------------------------------- */
const qid = (x: string) => `\`${x.replace(/`/g, "")}\``;
const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

async function getCols(table: string) {
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    `,
    table
  );
  const list = rows.map((r) => r.COLUMN_NAME);
  const set = new Set(list.map(norm));
  return { list, set };
}

function pickOne(
  cols: { list: string[]; set: Set<string> },
  candidates: string[],
  opts?: { required?: boolean; label?: string }
) {
  for (const c of candidates) {
    const nc = norm(c);
    if (cols.set.has(nc)) {
      // devolver el nombre real con el case exacto
      const real = cols.list.find((x) => norm(x) === nc)!;
      return real;
    }
  }
  if (opts?.required) {
    throw new Error(
      `No se encontró columna requerida ${opts.label ?? candidates[0]} en la tabla`
    );
  }
  return null;
}

function pickMany(cols: { list: string[]; set: Set<string> }, groups: string[][]) {
  const found: string[] = [];
  for (const group of groups) {
    const col = pickOne(cols, group, { required: false });
    if (col) found.push(col);
  }
  return found;
}

/** Handler ---------------------------------------------------------------- */
type Body = {
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
  horaDesde?: string; // HH:MM
  horaHasta?: string; // HH:MM
  eps?: string;
  especialidad?: string;
  medicos?: string[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { desde, hasta, horaDesde, horaHasta, eps, especialidad, medicos } = req.body as Body;

    if (!desde || !hasta) return res.status(400).json({ error: "desde y hasta son obligatorios" });
    if (horaDesde && horaHasta && horaDesde > horaHasta) {
      return res.status(400).json({ error: "La hora 'Desde' no puede ser mayor a 'Hasta'." });
    }

    /** Detectar columnas de agenda */
    const agendaCols = await getCols("agenda");
    const A_PK = pickOne(
      agendaCols,
      ["id", "idcita", "id_cita", "idagenda", "id_agenda"],
      { required: true, label: "PK (id/idcita/...)" }
    )!;
    const A_FECHA = pickOne(
      agendaCols,
      ["fecha_cita", "fecha", "fechacita", "fec_cita", "fecha_programada"],
      { required: true, label: "fecha de cita" }
    )!;
    const A_HORA = pickOne(agendaCols, ["hora", "hora_cita", "horacita", "hora_inicio"]); // opcional
    const A_ESTADO = pickOne(agendaCols, ["Estado", "estado"], { required: true, label: "Estado" })!;
    const A_TIPO = pickOne(agendaCols, ["TipoCita", "tipo_cita", "cups"], {
      required: false,
    });
    const A_IDUSU = pickOne(agendaCols, ["idusuario", "IdUsuario", "id_usuario"], {
      required: true,
      label: "idusuario",
    })!;
    const A_IDMED = pickOne(agendaCols, ["idmedico", "IdMedico", "id_medico", "cod_medico"], {
      required: true,
      label: "idmedico",
    })!;

    /** Detectar columnas de usuarios */
    const usuariosCols = await getCols("usuarios");
    const U_ID = pickOne(usuariosCols, ["IdUsuario", "idusuario", "id_usuario"], {
      required: true,
      label: "usuarios.IdUsuario",
    })!;
    const U_EPS = pickOne(usuariosCols, ["Codigo_eps", "codigo_eps"], {
      required: false,
    });
    const U_NOMBRES = pickMany(usuariosCols, [
      ["Primer_nombre", "primer_nombre"],
      ["Segundo_nombre", "segundo_nombre"],
      ["Primer_apellido", "primer_apellido"],
      ["Segundo_apellido", "segundo_apellido"],
    ]);
    const nombresExpr = U_NOMBRES.length
      ? `TRIM(CONCAT_WS(' ', ${U_NOMBRES.map((c) => `u.${qid(c)}`).join(", ")}))`
      : `''`;

    /** Detectar columnas de empleados */
    const empleadosCols = await getCols("empleados");
    const E_COD = pickOne(
      empleadosCols,
      ["Código_empleado", "Codigo_empleado", "codigo_empleado", "CodigoEmpleado"],
      { required: true, label: "empleados.Código_empleado" }
    )!;
    const E_NOMBRE = pickOne(
      empleadosCols,
      ["Nombre_empleado", "nombre_empleado", "NombreEmpleado"],
      { required: true, label: "empleados.Nombre_empleado" }
    )!;

    /** Joins auxiliares */
    const joinEE = !!especialidad;
    let EE_EMP = "Código_empleado";
    let EE_ESP = "especialidad";
    if (joinEE) {
      // intentar detectar también en especialidad_empleados si existiera variación
      const eeCols = await getCols("especialidad_empleados");
      EE_EMP =
        pickOne(
          eeCols,
          ["Código_empleado", "Codigo_empleado", "codigo_empleado", "CodigoEmpleado"],
          { required: true, label: "especialidad_empleados.Código_empleado" }
        ) || EE_EMP;
      EE_ESP =
        pickOne(eeCols, ["especialidad", "Especialidad", "codigo_especialidad"], {
          required: true,
          label: "especialidad_empleados.especialidad",
        }) || EE_ESP;
    }

    /** WHERE dinámico */
    const where: string[] = [];
    const params: any[] = [];

    // fecha
    where.push(`a.${qid(A_FECHA)} BETWEEN ? AND ?`);
    params.push(desde, hasta);

    // horas
    if (A_HORA && horaDesde) {
      where.push(`TIME(a.${qid(A_HORA)}) >= TIME(?)`);
      params.push(horaDesde);
    }
    if (A_HORA && horaHasta) {
      where.push(`TIME(a.${qid(A_HORA)}) <= TIME(?)`);
      params.push(horaHasta);
    }

    // EPS (si existe en usuarios)
    if (U_EPS && eps) {
      where.push(`u.${qid(U_EPS)} = ?`);
      params.push(eps);
    }

    // médicos
    if (medicos && medicos.length > 0) {
      const ph = medicos.map(() => "?").join(",");
      where.push(`a.${qid(A_IDMED)} IN (${ph})`);
      params.push(...medicos);
    }

    // especialidad vía tabla puente
    if (joinEE) {
      where.push(`ee.${qid(EE_ESP)} = ?`);
      params.push(especialidad);
    }

    /** SELECT dinámico */
    const horaExpr = A_HORA
      ? `IFNULL(DATE_FORMAT(a.${qid(A_HORA)}, '%H:%i'), '') AS hora`
      : `'' AS hora`;
    const epsExpr = U_EPS ? `u.${qid(U_EPS)} AS eps` : `'' AS eps`;
    const tipoExpr = A_TIPO ? `a.${qid(A_TIPO)} AS tipo_cita` : `NULL AS tipo_cita`;

    const sql = `
      SELECT
        a.${qid(A_PK)} AS cita_id,
        DATE_FORMAT(a.${qid(A_FECHA)}, '%Y-%m-%d') AS fecha,
        ${horaExpr},
        a.${qid(A_IDUSU)} AS idusuario,
        ${nombresExpr} AS paciente,
        ${epsExpr},
        a.${qid(A_IDMED)} AS idmedico,
        e.${qid(E_NOMBRE)} AS medico,
        a.${qid(A_ESTADO)} AS estado,
        ${tipoExpr}
      FROM ${qid("agenda")} a
      LEFT JOIN ${qid("usuarios")} u ON u.${qid(U_ID)} = a.${qid(A_IDUSU)}
      LEFT JOIN ${qid("empleados")} e ON e.${qid(E_COD)} = a.${qid(A_IDMED)}
      ${joinEE ? `LEFT JOIN ${qid("especialidad_empleados")} ee ON ee.${qid(EE_EMP)} = a.${qid(A_IDMED)}` : ""}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.${qid(A_FECHA)} ASC ${A_HORA ? `, a.${qid(A_HORA)} ASC` : ""}, a.${qid(A_PK)} ASC
    `;

    const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return res.status(200).json({ rows });
  } catch (err: any) {
    console.error("API /api/cupos/list error:", err);
    return res.status(500).json({ error: err?.message || "Error interno" });
  }
}
