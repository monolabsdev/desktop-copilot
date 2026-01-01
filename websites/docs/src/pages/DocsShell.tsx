import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { DocsLayout } from "../components/docs-layout"
import { Button } from "../components/ui/button"
import { CodeBlock } from "../components/docs-codeblock"
import { ComponentPreview } from "../components/docs-preview"
import type { DocBlock, ThemeMode } from "../lib/docs-types"
import { DOC_PAGES, NAV_GROUPS } from "./index"

type ShellProps = {
  theme: ThemeMode
  toggleTheme: () => void
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const renderBlocks = (blocks: DocBlock[]) => (
  <div className="space-y-4">
    {blocks.map((block, index) => {
      if (block.type === "paragraph") {
        return (
          <p key={index} className="text-muted-foreground leading-relaxed">
            {block.content}
          </p>
        )
      }
      if (block.type === "list") {
        return (
          <ul key={index} className="space-y-2 text-muted-foreground">
            {block.content.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )
      }
      if (block.type === "preview") {
        return (
          <ComponentPreview
            key={index}
            title={block.title}
            preview={block.preview}
            code={block.code}
            language={block.language}
          />
        )
      }
      return (
        <CodeBlock
          key={index}
          code={block.content}
          language={block.language}
        />
      )
    })}
  </div>
)

export function DocsShell({ theme, toggleTheme }: ShellProps) {
  const { slug } = useParams()
  const [searchValue, setSearchValue] = useState("")

  const page = DOC_PAGES.find((item) => item.slug === slug) ?? DOC_PAGES[0]

  useEffect(() => {
    if (!page) return
    document.title = `${page.title} - Docs`
  }, [page])

  const tocItems = useMemo(
    () =>
      page.sections.map((section) => ({
        id: section.id || toSlug(section.title),
        label: section.title,
      })),
    [page.sections],
  )

  const filteredNavGroups = useMemo(() => {
    if (!searchValue.trim()) return NAV_GROUPS
    const query = searchValue.toLowerCase()
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.label.toLowerCase().includes(query),
      ),
    })).filter((group) => group.items.length > 0)
  }, [searchValue])

  return (
    <DocsLayout
      navGroups={filteredNavGroups}
      tocItems={tocItems}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      badgeText="Docs"
      headerActions={
        <Button variant="ghost" size="sm" onClick={toggleTheme}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
      }
    >
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3 text-balance">
            {page.title}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {page.summary}
          </p>
        </div>

        {page.sections.map((section) => (
          <section key={section.id} className="mb-12">
            <h2
              id={section.id}
              className="text-2xl font-semibold mb-4 scroll-mt-20"
            >
              {section.title}
            </h2>
            {renderBlocks(section.blocks)}
          </section>
        ))}
      </div>
    </DocsLayout>
  )
}
