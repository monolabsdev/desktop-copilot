import { useState, type ReactNode } from "react"
import { cn } from "../lib/utils"
import { CodeBlock } from "./docs-codeblock"

type PreviewTab = "preview" | "code"

type ComponentPreviewProps = {
  title: string
  preview: ReactNode
  code: string
  language?: string
}

export function ComponentPreview({
  title,
  preview,
  code,
  language,
}: ComponentPreviewProps) {
  const [tab, setTab] = useState<PreviewTab>("preview")

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="flex items-center gap-2">
          {(["preview", "code"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition",
                tab === value
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "preview" ? "Preview" : "Code"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {tab === "preview" ? (
          <div className="rounded-md border border-border bg-background p-4">
            {preview}
          </div>
        ) : (
          <CodeBlock code={code} language={language} />
        )}
      </div>
    </div>
  )
}
