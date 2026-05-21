"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CircleDot,
  Clock3,
  Grid2X2,
  LogOut,
  Settings,
  Table2,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { clearAuthSession, getAuthSession } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Grid2X2 },
  { label: "Bookings", href: "/dashboard/bookings", icon: Clock3 },
  { label: "Event Types", href: "/dashboard/event-types", icon: Table2 },
  { label: "Availability", href: "/dashboard/availability", icon: CircleDot },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function AppShell({
  active,
  title,
  userInitial = "B",
  children,
}: {
  active: string;
  title: string;
  userInitial?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function logout() {
    clearAuthSession();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#FFFBF7] text-[#111827] lg:grid lg:grid-cols-[300px_1fr]">
      <aside className="hidden min-h-screen flex-col border-r border-[#EEE7DF] bg-white px-4 py-7 text-[#6B7280] lg:flex">
        <div className="px-3">
          <BrandLogo />
        </div>
        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = item.label === active;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-12 items-center gap-4 rounded-2xl px-5 text-base font-semibold transition",
                  selected
                    ? "bg-[#FFF0EF] text-[#FF5F63]"
                    : "text-[#6B7280] hover:bg-[#FFFBF7] hover:text-[#111827]",
                )}
              >
                <Icon className="size-4" />
                {item.label}
                {item.label === "Bookings" ? (
                  <span className="ml-auto rounded-full bg-[#FF666A] px-2.5 py-0.5 text-xs font-bold text-white">
                    5
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mx-3 mt-5 h-px bg-[#EEE7DF]" />
        <button
          type="button"
          className="mx-3 mt-auto flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#9CA3AF] hover:bg-[#FFFBF7] hover:text-[#111827]"
          onClick={logout}
        >
          <LogOut className="size-4" />
          Log out
        </button>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6B61] to-[#A855F7] text-sm font-bold text-white">
            {userInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#111827]">
              {getAuthSession()?.user.name ?? "Bookvella host"}
            </p>
            <p className="truncate text-xs text-[#6B7280]">
              bookvella.com/{getAuthSession()?.user.slug ?? "your-link"}
            </p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#EEE7DF] bg-white px-5 lg:hidden">
          <div className="lg:hidden">
            <BrandLogo />
          </div>
          <h1 className="hidden text-lg font-semibold lg:block">{title}</h1>
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6B61] to-[#A855F7] text-sm font-bold text-white">
            {userInitial}
          </div>
        </header>
        <nav className="sticky top-16 z-10 flex gap-2 overflow-x-auto border-b border-[#EEE7DF] bg-white px-5 py-2 lg:hidden">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const selected = item.label === active;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm",
                  selected
                    ? "bg-[#FFF0EF] font-semibold text-[#FF5F63]"
                    : "text-[#6B7280]",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="px-5 py-8 lg:px-14 lg:py-12 xl:px-16">
          <div className="mx-auto max-w-[1380px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function EmptyPage({
  active,
  title,
  children,
}: {
  active: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell active={active} title={title}>
      <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-8 shadow-sm">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#FFF0EF] text-[#FF5F63]">
          <CalendarClock className="size-5" />
        </div>
        {children}
      </div>
    </AppShell>
  );
}
