import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  appTheme?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  appTheme: string
  setAppTheme: (appTheme: string) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  appTheme: "classic",
  setAppTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  appTheme: initialAppTheme = "classic",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => {
      if (typeof window !== "undefined") {
        return (localStorage.getItem(storageKey) as Theme) || defaultTheme
      }
      return defaultTheme
    }
  )

  const [appTheme, setAppThemeState] = useState<string>(initialAppTheme)

  // Sync state if prop changes (e.g. initial load fetches data)
  useEffect(() => {
    setAppThemeState(initialAppTheme)
  }, [initialAppTheme])

  useEffect(() => {
    const root = window.document.documentElement

    // Manage light/dark class
    root.classList.remove("light", "dark")
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }

    // Manage data-theme attribute
    if (appTheme && appTheme !== "classic") {
      root.setAttribute("data-theme", appTheme)
    } else {
      root.removeAttribute("data-theme")
    }
  }, [theme, appTheme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
    appTheme,
    setAppTheme: (newTheme: string) => {
      setAppThemeState(newTheme)
      // Broadcast event so other components (like __root) can hear it
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app-theme-change", { detail: { theme: newTheme } }))
      }
    }
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
