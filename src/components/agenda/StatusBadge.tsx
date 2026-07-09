import { getStatusBadgeMeta } from "@/lib/agenda-ui";

export default function StatusBadge({ estado }: { estado: string | null }) {
  const meta = getStatusBadgeMeta(estado);

  if (!meta) return <span>{estado ?? ""}</span>;

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  );
}
