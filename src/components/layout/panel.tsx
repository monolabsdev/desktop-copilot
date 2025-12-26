import * as React from "react";

import { cn } from "@/lib/utils";

type PanelVariant = "overlay" | "preferences";

interface PanelRootProps extends React.ComponentProps<"div"> {
  variant?: PanelVariant;
}

function PanelRoot({ variant = "overlay", className, ...props }: PanelRootProps) {
  return (
    <div
      className={cn("panel-root", `panel-root--${variant}`, className)}
      {...props}
    />
  );
}

function PanelStage({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("panel-stage", className)} {...props} />;
}

interface PanelFrameProps extends React.ComponentProps<"div"> {
  variant?: PanelVariant;
}

function PanelFrame({
  variant = "overlay",
  className,
  ...props
}: PanelFrameProps) {
  return (
    <div
      className={cn("panel-frame", `panel-frame--${variant}`, className)}
      {...props}
    />
  );
}

function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("panel-body", className)} {...props} />;
}

function PanelFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("panel-footer", className)} {...props} />;
}

function PanelEyebrow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("panel-eyebrow", className)} {...props} />;
}

function PanelTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("panel-title", className)} {...props} />;
}

function PanelSubtitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("panel-subtitle", className)} {...props} />;
}

function PanelSectionTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("panel-section-title", className)} {...props} />;
}

function PanelFieldLabel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("panel-field-label", className)} {...props} />;
}

type PanelStackGap = "sm" | "md" | "lg";

interface PanelStackProps extends React.ComponentProps<"div"> {
  gap?: PanelStackGap;
}

function PanelStack({ gap = "md", className, ...props }: PanelStackProps) {
  return (
    <div
      className={cn("panel-stack", `panel-stack--${gap}`, className)}
      {...props}
    />
  );
}

type PanelRowGap = "sm" | "md" | "lg";

interface PanelRowProps extends React.ComponentProps<"div"> {
  gap?: PanelRowGap;
}

function PanelRow({ gap = "md", className, ...props }: PanelRowProps) {
  return (
    <div
      className={cn("panel-row", `panel-row--${gap}`, className)}
      {...props}
    />
  );
}

export {
  PanelRoot,
  PanelStage,
  PanelFrame,
  PanelBody,
  PanelFooter,
  PanelEyebrow,
  PanelTitle,
  PanelSubtitle,
  PanelSectionTitle,
  PanelFieldLabel,
  PanelStack,
  PanelRow,
};
