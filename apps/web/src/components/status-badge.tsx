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
          ? "bg-[#DDFBE7] text-[#126C36]"
          : status === "cancelled"
            ? "bg-[#FFE6E6] text-[#D9232E]"
            : "bg-[#F0ECE7] text-[#9CA3AF]",
      )}
    >
      {children}
    </span>
  );
}
