"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  CircleDot,
  Clock3,
  Home,
  Grid2X2,
  LogOut,
  Settings,
  Table2,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { getAuthSession, logoutAuthSession } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Bookings", href: "/dashboard/bookings", icon: Clock3 },
  { label: "Services", href: "/dashboard/event-types", icon: Table2 },
  { label: "Schedule", href: "/dashboard/availability", icon: CircleDot },
  { label: "Profile", href: "/dashboard/settings", icon: Grid2X2 },
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
  const [session, setSession] = useState<ReturnType<typeof getAuthSession>>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const current = getAuthSession();
    setSession(current);
    setCheckingSession(false);

    if (!current) {
      router.replace("/login");
    }
  }, [router]);

  if (checkingSession || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFBF7] px-6 text-center text-[#6B7280]">
        <div className="rounded-2xl border border-[#EEE7DF] bg-white px-6 py-5 shadow-sm">
          Checking your session...
        </div>
      </div>
    );
  }

  async function logout() {
    await logoutAuthSession();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#FFFBF7] pb-20 text-[#111827] lg:grid lg:grid-cols-[300px_1fr] lg:pb-0">
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
              {session?.user.name ?? "Bookvella host"}
            </p>
            <p className="truncate text-xs text-[#6B7280]">
              bookvella.com/{session?.user.slug ?? "your-link"}
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
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#EEE7DF] bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const selected = item.label === active;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold",
                  selected ? "bg-[#FFF0EF] text-[#FF5F63]" : "text-[#9CA3AF]",
                )}
              >
                <Icon className="size-4" />
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
