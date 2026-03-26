"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar px-3 py-2 text-xs font-semibold text-sidebar-foreground transition-colors duration-300 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
      <span className="dark:hidden">Dark</span>
      <span className="hidden dark:inline-flex">Light</span>
    </button>
  );
}
