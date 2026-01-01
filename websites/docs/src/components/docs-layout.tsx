import { useMemo, useState } from "react"
import { NavLink } from "react-router-dom"
import {
  Book,
  Code,
  Menu,
  Search,
  Settings,
  Shield,
  X,
  Zap,
} from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { cn } from "../lib/utils"

type NavItem = {
  label: string
  href: string
  icon?: "book" | "zap" | "code" | "shield" | "settings"
}

type NavGroup = {
  title: string
  items: NavItem[]
}

type TocItem = {
  id: string
  label: string
}

type DocsLayoutProps = {
  children: React.ReactNode
  navGroups: NavGroup[]
  tocItems: TocItem[]
  searchValue: string
  onSearchChange: (value: string) => void
  headerActions?: React.ReactNode
  badgeText?: string
}

const iconMap = {
  book: Book,
  zap: Zap,
  code: Code,
  shield: Shield,
  settings: Settings,
}

export function DocsLayout({
  children,
  navGroups,
  tocItems,
  searchValue,
  onSearchChange,
  headerActions,
  badgeText = "Docs",
}: DocsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const filteredGroups = useMemo(() => {
    if (!searchValue.trim()) return navGroups
    const query = searchValue.toLowerCase()
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [navGroups, searchValue])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed inset-x-0 top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-sm bg-foreground" />
              <span className="font-semibold">{badgeText}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">{headerActions}</div>
        </div>
      </header>

      <div className="flex-1 flex pt-14">
        <aside
          className={cn(
            "fixed top-14 bottom-0 left-0 z-30 w-64 bg-background border-r border-border transition-transform duration-200 md:fixed md:top-14 md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="h-full overflow-y-auto p-4">
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-9 bg-secondary border-border"
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </div>
            </div>

            <nav className="space-y-6">
              {filteredGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.title}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon ? iconMap[item.icon] : null
                      return (
                        <NavLink
                          key={item.href}
                          to={item.href}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                              isActive
                                ? "bg-secondary text-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                            )
                          }
                        >
                          {Icon && <Icon className="h-4 w-4 text-current" />}
                          {item.label}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 md:pl-64">
          <div className="flex">
            <div className="flex-1 px-4 py-8 md:px-8 lg:px-12">
              {children}
            </div>
            <aside className="hidden xl:block w-64 border-l border-border sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-6">
              <h4 className="text-sm font-semibold mb-3">On this page</h4>
              <nav className="space-y-2 text-sm">
                {tocItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </aside>
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
