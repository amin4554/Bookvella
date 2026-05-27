"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggleButton({ className }: { className?: string }) {
  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("bookvella.theme", next ? "dark" : "light");
    } catch {
      // ignored
    }
  }

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      title="Toggle theme"
      onClick={toggleTheme}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border border-line-cream bg-surface-card text-ink-body transition hover:border-brand-tint-300 hover:text-brand",
        className,
      )}
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}
