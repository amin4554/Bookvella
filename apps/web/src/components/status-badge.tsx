import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  children,
}: {
  status: "confirmed" | "cancelled" | "active" | "inactive";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-20 items-center justify-center rounded-full px-4 text-xs font-bold",
        status === "confirmed" || status === "active"
          ? "bg-badge-success-bg text-badge-success-fg"
          : status === "cancelled"
            ? "bg-badge-danger-bg text-badge-danger-fg"
            : "bg-badge-neutral-bg text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}
