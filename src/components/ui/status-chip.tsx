import { cn } from "@/lib/utils";

type StatusSpec = {
  label: string;
  className: string;
  tooltip: string;
  dotClassName?: string;
};

const VARIANTS: Record<string, StatusSpec> = {
  experimental: {
    label: "Experimental",
    className: "border-amber-300/40 text-amber-100/90 bg-amber-500/10",
    tooltip: "In development and may break.",
  },
  beta: {
    label: "Beta",
    className: "border-sky-300/40 text-sky-100/90 bg-sky-500/10",
    tooltip: "Works, but not polished yet.",
  },
  preview: {
    label: "Preview",
    className: "border-emerald-300/40 text-emerald-100/90 bg-emerald-500/10",
    tooltip: "Nearly finished and close to release.",
  },
  limited: {
    label: "Limited",
    className: "border-slate-300/40 text-slate-100/80 bg-slate-500/10",
    tooltip: "Reduced scope or caps apply.",
  },
  connected: {
    label: "Connected",
    className: "border-emerald-300/40 text-emerald-100/90 bg-emerald-500/10",
    dotClassName: "bg-emerald-300",
    tooltip: "Ollama is reachable.",
  },
  disconnected: {
    label: "Disconnected",
    className: "border-red-300/40 text-red-100/90 bg-red-500/10",
    dotClassName: "bg-red-300",
    tooltip: "Ollama is not reachable.",
  },
};

type StatusVariant = keyof typeof VARIANTS;

interface StatusChipProps {
  variant: StatusVariant;
  className?: string;
  showDot?: boolean;
  casing?: "upper" | "normal";
}

export function StatusChip({
  variant,
  className,
  showDot = false,
  casing = "upper",
}: StatusChipProps) {
  const spec = VARIANTS[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        casing === "upper" ? "uppercase tracking-[0.18em]" : "tracking-[0.08em]",
        spec.className,
        className,
      )}
      title={spec.tooltip}
      aria-label={`${spec.label} status`}
    >
      {showDot && spec.dotClassName ? (
        <span className={cn("mr-1.5 h-2 w-2 rounded-full", spec.dotClassName)} />
      ) : null}
      {spec.label}
    </span>
  );
}
