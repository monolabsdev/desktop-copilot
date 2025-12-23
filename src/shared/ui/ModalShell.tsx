import type { ReactNode } from "react";

type Props = {
  isOpen: boolean;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};

export function ModalShell({
  isOpen,
  title,
  description,
  footer,
  children,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 pointer-events-auto">
      <div className="w-full max-w-md rounded-lg bg-neutral-900/95 text-white backdrop-blur">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <div className="mt-1 text-sm text-white/70">{description}</div>}
          {children}
        </div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
