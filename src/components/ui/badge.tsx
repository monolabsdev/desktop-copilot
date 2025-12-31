import { cn } from "@/lib/utils";

export type BadgeProps = React.ComponentProps<"span"> & {
  variant?: "default" | "secondary";
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        variant === "secondary"
          ? "border-white/10 bg-white/5 text-white/70"
          : "border-white/20 bg-white/10 text-white/80",
        className,
      )}
      {...props}
    />
  );
}
