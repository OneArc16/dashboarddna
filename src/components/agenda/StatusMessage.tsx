import type { LucideIcon } from "lucide-react";

type Tone = "success" | "warning" | "danger" | "info";

const TONE_CLASSNAMES: Record<Tone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-900",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

type StatusMessageProps = {
  icon: LucideIcon;
  message: string;
  tone: Tone;
  className?: string;
};

export default function StatusMessage({
  icon: Icon,
  message,
  tone,
  className = "",
}: StatusMessageProps) {
  return (
    <div
      className={[
        "flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm",
        TONE_CLASSNAMES[tone],
        className,
      ].join(" ")}
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      aria-live="polite"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
