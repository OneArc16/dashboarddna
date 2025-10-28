// src/pages/reportes.tsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import toast from "react-hot-toast";

/* ===================== Tipos ===================== */
type Option = { value: string; label: string };

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

/* ===================== Utiles ===================== */
const todayISO = () => new Date().toISOString().slice(0, 10);
const firstDayOfYearISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
};

const ESTADOS = [
  { key: "ASIGNADA", label: "Asignada" },
  { key: "ATENDIDA", label: "Atendida" },
  { key: "CUMPLIDA", label: "Cumplida" },
  { key: "SIN_ASIGNAR", label: "Sin asignar" },
] as const;
type EstadoKey = (typeof ESTADOS)[number]["key"];

/* ===================== Componente ===================== */
export default function ReportesPage() {
  // filtros
  const [desde, setDesde] = useState(firstDayOfYearISO());
  const [hasta, setHasta] = useState(todayISO());

  const [eps, setEps] = useState<string>("");
  const [especialidad, setEspecialidad] = useState<string>("");
  const [medico, setMedico] = useState<string>("");

  const [estadoChecks, setEstadoChecks] = useState<Record<EstadoKey, boolean>>({
    ASIGNADA: false,
    ATENDIDA: true,
    CUMPLIDA: false,
    SIN_ASIGNAR: false,
  });

  type LimitValue = number | 'ALL';
  const ALL_LIMIT = 1000000;
  const [limit, setLimit] = useState<LimitValue>(1000);

  // catálogos
  const [epsOptions, setEpsOptions] = useState<Option[]>([{ value: "", label: "Todas" }]);
  const [espOptions, setEspOptions] = useState<Option[]>([{ value: "", label: "Todas" }]);
  const [medicoOptions, setMedicoOptions] = useState<Option[]>([{ value: "", label: "Todos" }]);

  // data
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);

  const estadosSeleccionados = useMemo(
    () => (Object.entries(estadoChecks).filter(([, v]) => v).map(([k]) => k) as EstadoKey[]),
    [estadoChecks]
  );

  /* ===================== Carga de catálogos ===================== */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/catalog/eps");
        const { options } = await r.json();
        setEpsOptions([{ value: "", label: "Todas" }, ...(options ?? [])]);
      } catch {
        setEpsOptions([{ value: "", label: "Todas" }]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/catalog/especialidades");
        const { options } = await r.json();
        setEspOptions([{ value: "", label: "Todas" }, ...(options ?? [])]);
      } catch {
        setEspOptions([{ value: "", label: "Todas" }]);
      }
    })();
  }, []);

  useEffect(() => {
    // al cambiar especialidad, resetea médico y recarga lista de médicos
    setMedico("");
    (async () => {
      try {
        const q = new URLSearchParams();
        if (especialidad) q.set("especialidad", especialidad);
        const r = await fetch(`/api/catalog/medicos?${q.toString()}`);
        const { options } = await r.json();
        setMedicoOptions([{ value: "", label: "Todos" }, ...(options ?? [])]);
      } catch {
        setMedicoOptions([{ value: "", label: "Todos" }]);
      }
    })();
  }, [especialidad]);

  /* ===================== Acciones ===================== */
  const handleBuscar = async () => {
    if (!desde || !hasta) {
      toast.error("Selecciona el rango de fechas.");
      return;
    }
    if (new Date(desde) > new Date(hasta)) {
      toast.error("La fecha 'Desde' no puede ser mayor a 'Hasta'.");
      return;
    }

    setLoading(true);
    try {
      const limitToSend = limit === 'ALL' ? ALL_LIMIT : limit; // ya no hace falta Number()

      
      const body = {
        desde,
        hasta,
        eps: eps || undefined,
        estados: estadosSeleccionados.length ? estadosSeleccionados : ESTADOS.map((e) => e.key),
        limit: limitToSend,
        offset: 0,
        especialidad: especialidad || undefined,
        medico: medico || undefined,
      };

      const r = await fetch("/api/reportes/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || "Error al consultar");
      }

      const json = await r.json();
      setRows(json.rows ?? []);
      toast.success(`Se cargaron ${json.rows?.length ?? 0} registros`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al consultar");
    } finally {
      setLoading(false);
    }
  };

// dentro del componente ReportesPage

  const handleDescargar = () => {
    const q = new URLSearchParams();
    q.set("desde", desde);
    q.set("hasta", hasta);
    if (eps) q.set("eps", eps);
    if (especialidad) q.set("especialidad", especialidad);
    if (medico) q.set("medico", medico);
    const est = estadosSeleccionados.length ? estadosSeleccionados : ESTADOS.map((e) => e.key);
    q.set("estados", est.join(","));

    // abre la descarga (mismo tab). Si prefieres nueva pestaña: window.open(...)
    window.location.href = `/api/reportes/export?${q.toString()}`;
  };


  /* ===================== UI ===================== */
  return (
    <>
      <Head>
        <title>Reportes DNAPLUS</title>
      </Head>

      <main className="p-4 mx-auto max-w-7xl sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Reportes DNAPLUS</h1>

          <button
            onClick={handleDescargar}
            className="inline-flex items-center gap-2 px-3 py-2 text-white bg-black shadow rounded-xl hover:opacity-90 disabled:opacity-50"
            disabled={loading}
            title="Descargar en Excel"
          >
            <span>⬇️</span> Descargar
          </button>
        </div>

        {/* Card de filtros */}
        <div className="bg-white border shadow-sm rounded-2xl">
          <div className="px-4 py-3 font-medium text-gray-700 border-b">Filtros</div>

          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-6">
            {/* Desde */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Desde</label>
              <input
                type="date"
                className="px-3 border rounded-md h-9"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>

            {/* Hasta */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Hasta</label>
              <input
                type="date"
                className="px-3 border rounded-md h-9"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>

            {/* EPS */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">EPS</label>
              <select
                className="px-3 border rounded-md h-9"
                value={eps}
                onChange={(e) => setEps(e.target.value)}
              >
                {epsOptions.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Especialidad */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Especialidad</label>
              <select
                className="px-3 border rounded-md h-9"
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
              >
                {espOptions.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Médico */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Médico</label>
              <select
                className="px-3 border rounded-md h-9"
                value={medico}
                onChange={(e) => setMedico(e.target.value)}
              >
                {medicoOptions.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Registros por página */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Registros por página</label>
              <select
                className="px-3 border rounded-md h-9"
                value={limit === 'ALL' ? 'ALL' : String(limit)}
                onChange={(e) => {
                  const v = e.target.value;
                  setLimit(v === "ALL" ? "ALL" : Number(e.target.value));
                }}
              >
                {[100, 500, 1000, 5000].map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="ALL">Todos</option>
              </select>
            </div>
          </div>

          {/* Estados */}
          <div className="flex flex-wrap items-center gap-6 pb-4 pl-4 px -4">
            <div className="text-sm text-gray-600">Estados</div>
            {ESTADOS.map((e) => (
              <label key={e.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={!!estadoChecks[e.key]}
                  onChange={(ev) =>
                    setEstadoChecks((s) => ({ ...s, [e.key]: ev.target.checked }))
                  }
                />
                {e.label}
              </label>
            ))}

            <div className="pr-4 ml-auto">
              <button
                onClick={handleBuscar}
                disabled={loading}
                className="px-4 py-2 text-white bg-blue-600 shadow rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="mt-4 bg-white border shadow-sm rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="font-medium text-gray-700">Resultados ({rows.length})</div>
            <div className="text-xs text-gray-500">
              {rows.length > 0 && `Mostrando ${rows.length} registro(s)`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 text-xs text-left text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-3 py-2"># Cita</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Hora</th>
                  <th className="px-3 py-2">Paciente</th>
                  <th className="px-3 py-2">EPS</th>
                  <th className="px-3 py-2">ID Médico</th>
                  <th className="px-3 py-2">Médico</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Tipo Cita</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                      Sin resultados
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr key={`${r.cita_id ?? idx}`} className="odd:bg-white even:bg-gray-50">
                      <td className="px-3 py-2">{r.cita_id ?? "-"}</td>
                      <td className="px-3 py-2">{r.fecha ?? "-"}</td>
                      <td className="px-3 py-2">{r.hora ?? "-"}</td>
                      <td className="px-3 py-2">{r.paciente ?? "-"}</td>
                      <td className="px-3 py-2">{r.eps ?? "-"}</td>
                      <td className="px-3 py-2">{r.idmedico ?? "-"}</td>
                      <td className="px-3 py-2">{r.medico ?? "-"}</td>
                      <td className="px-3 py-2">{r.estado ?? "-"}</td>
                      <td className="px-3 py-2">{r.tipo_cita ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
