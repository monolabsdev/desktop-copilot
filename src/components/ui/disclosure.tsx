import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DisclosureProps = {
  trigger: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  autoCloseMs?: number;
  className?: string;
  triggerClassName?: string;
};

export function Disclosure({
  trigger,
  children,
  defaultOpen = false,
  autoCloseMs,
  className,
  triggerClassName,
}: DisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  useEffect(() => {
    if (!isOpen || !autoCloseMs) return;
    const timeout = window.setTimeout(() => {
      setIsOpen(false);
    }, autoCloseMs);
    return () => window.clearTimeout(timeout);
  }, [autoCloseMs, isOpen]);

  return (
    <div className={cn("text-xs text-white/70", className)}>
      <button
        type="button"
        data-no-drag
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between text-left transition-colors hover:text-white/90",
          triggerClassName,
        )}
        aria-expanded={isOpen}
      >
        {trigger}
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-white/50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-white/50" />
        )}
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  );
}
