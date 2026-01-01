import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface Props {
  isOpen: boolean
  title: string
  description?: string
  footer?: ReactNode
  children?: ReactNode
  className?: string
  portal?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ModalShell({
  isOpen,
  title,
  description,
  footer,
  children,
  className,
  portal,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        portal={portal}
        className={cn("bg-neutral-950/90 text-white/90 border-white/10", className)}
      >
        <DialogHeader>
          <DialogTitle className="text-base text-white/90">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-white/60">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}
