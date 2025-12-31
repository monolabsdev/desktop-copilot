import * as React from "react"

import { cn } from "@/lib/utils"

type TooltipContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null)

function useTooltipContext() {
  const context = React.useContext(TooltipContext)
  if (!context) {
    throw new Error("Tooltip components must be used within Tooltip")
  }
  return context
}

type TooltipProps = {
  children: React.ReactNode
}

function Tooltip({ children }: TooltipProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <span className="relative inline-flex">{children}</span>
    </TooltipContext.Provider>
  )
}

type TooltipTriggerProps = {
  children: React.ReactNode
  asChild?: boolean
  disabled?: boolean
} & React.HTMLAttributes<HTMLElement>

function TooltipTrigger({
  children,
  asChild = false,
  disabled = false,
  ...props
}: TooltipTriggerProps) {
  const { setOpen } = useTooltipContext()

  const handlers = {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      if (!disabled) setOpen(true)
      props.onMouseEnter?.(event)
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      setOpen(false)
      props.onMouseLeave?.(event)
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      if (!disabled) setOpen(true)
      props.onFocus?.(event)
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      setOpen(false)
      props.onBlur?.(event)
    },
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...handlers,
      ...props,
    })
  }

  return (
    <span {...handlers} {...props}>
      {children}
    </span>
  )
}

type TooltipContentProps = {
  side?: "top" | "bottom" | "left" | "right"
  children: React.ReactNode
  className?: string
}

function TooltipContent({
  side = "top",
  children,
  className,
}: TooltipContentProps) {
  const { open } = useTooltipContext()

  if (!open) return null

  const sideClass =
    side === "bottom"
      ? "top-full mt-2 left-1/2 -translate-x-1/2"
      : side === "left"
        ? "right-full mr-2 top-1/2 -translate-y-1/2"
        : side === "right"
          ? "left-full ml-2 top-1/2 -translate-y-1/2"
          : "bottom-full mb-2 left-1/2 -translate-x-1/2"

  return (
    <span
      role="tooltip"
      className={cn(
        "absolute z-50 whitespace-nowrap rounded-md border border-border/60 bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm",
        sideClass,
        className,
      )}
    >
      {children}
    </span>
  )
}

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
}
