import type { ReactNode } from "react"

export type DocBlock =
  | { type: "paragraph"; content: string }
  | { type: "code"; content: string; language?: string }
  | { type: "list"; content: string[] }
  | {
      type: "preview"
      title: string
      preview: ReactNode
      code: string
      language?: string
    }

export type DocSection = {
  id: string
  title: string
  blocks: DocBlock[]
}

export type DocPage = {
  slug: string
  title: string
  summary: string
  sections: DocSection[]
}

export type NavGroup = {
  title: string
  items: {
    label: string
    href: string
    icon?: "book" | "zap" | "code" | "shield" | "settings"
  }[]
}

export type ThemeMode = "light" | "dark"
