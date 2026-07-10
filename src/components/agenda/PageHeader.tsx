import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  aside?: ReactNode;
  eyebrow?: string;
};

export default function PageHeader({
  title,
  description,
  aside,
  eyebrow = "DNAPLUS",
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
          {eyebrow}
        </p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {aside ? <div className="w-full lg:max-w-xl">{aside}</div> : null}
    </div>
  );
}
