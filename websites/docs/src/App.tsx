import { useEffect, useState } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import "@/app/App.css"
import "./docs-overrides.css"
import type { ThemeMode } from "./lib/docs-types"
import { DocsShell } from "./pages/DocsShell"

const THEME_STORAGE_KEY = "docs-theme"

function App() {
  const [theme, setTheme] = useState<ThemeMode>("light")

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")
      ?.matches
    if (stored === "dark" || stored === "light") {
      setTheme(stored)
      document.documentElement.classList.toggle("dark", stored === "dark")
    } else if (prefersDark) {
      setTheme("dark")
      document.documentElement.classList.add("dark")
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.classList.toggle("dark", next === "dark")
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
  }

  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/docs/introduction" replace />} />
        <Route
          path="/docs/:slug"
          element={<DocsShell theme={theme} toggleTheme={toggleTheme} />}
        />
        <Route path="*" element={<Navigate to="/docs/introduction" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
