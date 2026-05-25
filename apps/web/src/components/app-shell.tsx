"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarSync,
  Check,
  ChevronUp,
  Copy,
  ExternalLink,
  LayoutGrid,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  LogOut,
  MessageSquareText,
  Moon,
  Settings,
  Sun,
  UserCircle2,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LegalFooter } from "@/components/legal-footer";
import {
  authedApiRequest,
  clearAuthSession,
  getAuthSession,
  logoutAuthSession,
  type PublicUser,
  updateStoredUser,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// The redesigned sidebar shows 5 primary entries. Profile & Settings live in
// the bottom user menu (per `designs/pages/services.html` + `profile.html`).
type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Bookings", href: "/dashboard/bookings", icon: CalendarCheck2 },
  { label: "Services", href: "/dashboard/services", icon: Layers },
  { label: "Availability", href: "/dashboard/availability", icon: CalendarClock },
  {
    label: "Calendar sync",
    href: "/dashboard/settings#calendar",
    icon: CalendarSync,
  },
];

// Mobile bottom nav doesn't show "Calendar sync" since it's just a deep-link
// to a Settings section. Profile is surfaced instead to keep mobile users one
// tap away from editing their public page.
const MOBILE_NAV_ITEMS: NavItem[] = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  NAV_ITEMS[2],
  NAV_ITEMS[3],
  { label: "Profile", href: "/dashboard/profile", icon: UserCircle2 },
];

export function AppShell({
  active,
  title,
  userInitial = "B",
  bookingCount,
  children,
}: {
  active: string;
  title: string;
  userInitial?: string;
  bookingCount?: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] =
    useState<ReturnType<typeof getAuthSession>>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let alive = true;

    async function verifySession() {
      const current = getAuthSession();

      if (!current) {
        if (alive) {
          setSession(null);
          setCheckingSession(false);
          router.replace("/login");
        }
        return;
      }

      try {
        const user = await authedApiRequest<PublicUser>("/auth/me");
        updateStoredUser(user);
        const refreshed = getAuthSession();
        if (alive) {
          setSession(refreshed ? { ...refreshed, user } : null);
          setCheckingSession(false);
        }
      } catch (caught) {
        const status =
          caught instanceof Error && "status" in caught
            ? (caught.status as number | undefined)
            : undefined;

        if (status === 401) {
          clearAuthSession();
          if (alive) {
            setSession(null);
            setCheckingSession(false);
            const next =
              typeof window === "undefined"
                ? "/dashboard"
                : `${window.location.pathname}${window.location.search}`;
            router.replace(
              `/login?reason=session_expired&next=${encodeURIComponent(next)}`,
            );
          }
          return;
        }

        if (alive) {
          setSession(current);
          setCheckingSession(false);
        }
      }
    }

    verifySession();
    return () => {
      alive = false;
    };
  }, [router]);

  const logout = useCallback(async () => {
    await logoutAuthSession();
    router.push("/login");
  }, [router]);

  if (checkingSession || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFBF7] px-6 text-center text-[#6B7280]">
        <div className="rounded-2xl border border-[#EEE7DF] bg-white px-6 py-5 shadow-sm">
          Checking your session…
        </div>
      </div>
    );
  }

  const userName = session?.user.name ?? "Bookvella host";
  const userSlug = session?.user.slug ?? "your-link";
  const userProfileImage = session?.user.profileImageUrl ?? null;
  const bookingLink = publicAppUrl(`/${userSlug}`);

  return (
    <>
      <div className="min-h-screen bg-[#FFFBF7] pb-20 text-[#0B1220] lg:grid lg:grid-cols-[260px_1fr] lg:pb-0">
        <DesktopSidebar
          active={active}
          bookingCount={bookingCount}
          userName={userName}
          userInitial={userInitial}
          userSlug={userSlug}
          userProfileImage={userProfileImage}
          bookingLink={bookingLink}
          onLogout={logout}
        />

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#EEE7DF] bg-white px-5 lg:hidden">
            <div className="lg:hidden">
              <BrandLogo />
            </div>
            <h1 className="hidden text-lg font-semibold lg:block">{title}</h1>
            <MobileUserMenuButton
              userInitial={userInitial}
              userProfileImage={userProfileImage}
              userSlug={userSlug}
              bookingLink={bookingLink}
              onLogout={logout}
            />
          </header>

          <MobileNav active={active} bookingCount={bookingCount} />

          <main className="px-5 py-8 lg:px-10 lg:py-10">
            <div className="mx-auto max-w-[1380px]">{children}</div>
          </main>
        </div>
      </div>
      <LegalFooter />
    </>
  );
}

function DesktopSidebar({
  active,
  bookingCount,
  userName,
  userInitial,
  userSlug,
  userProfileImage,
  bookingLink,
  onLogout,
}: {
  active: string;
  bookingCount?: number;
  userName: string;
  userInitial: string;
  userSlug: string;
  userProfileImage: string | null;
  bookingLink: string;
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <aside className="sticky top-0 z-30 hidden h-screen flex-col self-start border-r border-[#EEE7DF] bg-white lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-[#EEE7DF] px-5">
        <BrandLogo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const selected = item.label === active;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                // Dot-led nav row per design (services.html / profile.html).
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
                selected
                  ? "bg-[#FFEDEA] text-[#FF5F63]"
                  : "text-[#374151] hover:bg-[#FFF6F0] hover:text-[#0B1220]",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  selected ? "bg-[#FF5F63]" : "bg-[#D1D5DB]",
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.label === "Bookings" && bookingCount && bookingCount > 0 ? (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF5F63] px-1.5 text-[10px] font-bold text-white">
                  {bookingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="relative m-3" ref={menuRef}>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3 text-left hover:bg-white"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF] text-[13px] font-bold text-white">
            {userProfileImage ? (
              <div
                className="size-full bg-cover bg-center"
                style={{ backgroundImage: `url(${userProfileImage})` }}
              />
            ) : (
              userInitial
            )}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-bold">{userName}</p>
            <p className="truncate text-[11px] text-[#6B7280]">
              bookvella.com/{userSlug}
            </p>
          </div>
          <ChevronUp
            className={cn(
              "size-4 text-[#9CA3AF] transition",
              menuOpen ? "" : "rotate-180",
            )}
          />
        </button>

        {menuOpen ? (
          <UserMenuItems
            placement="above"
            userSlug={userSlug}
            bookingLink={bookingLink}
            onClose={() => setMenuOpen(false)}
            onLogout={onLogout}
          />
        ) : null}
      </div>
    </aside>
  );
}

function MobileUserMenuButton({
  userInitial,
  userProfileImage,
  userSlug,
  bookingLink,
  onLogout,
}: {
  userInitial: string;
  userProfileImage: string | null;
  userSlug: string;
  bookingLink: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Open account menu"
        className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF] text-sm font-bold text-white"
      >
        {userProfileImage ? (
          <div
            className="size-full bg-cover bg-center"
            style={{ backgroundImage: `url(${userProfileImage})` }}
          />
        ) : (
          userInitial
        )}
      </button>

      {open ? (
        <UserMenuItems
          placement="below"
          userSlug={userSlug}
          bookingLink={bookingLink}
          onClose={() => setOpen(false)}
          onLogout={onLogout}
        />
      ) : null}
    </div>
  );
}

function UserMenuItems({
  placement,
  userSlug,
  bookingLink,
  onClose,
  onLogout,
}: {
  placement: "above" | "below";
  userSlug: string;
  bookingLink: string;
  onClose: () => void;
  onLogout: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // Tailwind 4 themes via `:root.dark`, set via the `dark` class on <html>.
  // The lazy initializer is SSR-safe (returns false on the server, reads
  // localStorage on the first client render).
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("bookvella.theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignored
    }
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("bookvella.theme", next ? "dark" : "light");
    } catch {
      // ignored
    }
  }

  const positionClass =
    placement === "above"
      ? "bottom-[calc(100%+8px)] left-0 right-0"
      : "right-0 top-[calc(100%+8px)] w-[260px]";

  return (
    <div
      role="menu"
      className={cn(
        "absolute z-40 rounded-xl border border-[#EEE7DF] bg-white p-1.5 shadow-[0_24px_48px_-20px_rgba(17,24,39,0.16)]",
        positionClass,
      )}
    >
      <MenuRow
        as="a"
        href={`/${userSlug}`}
        target="_blank"
        rel="noreferrer"
        onClick={onClose}
        icon={
          <ExternalLink className="size-4 shrink-0 text-[#9CA3AF] group-hover:text-[#FF5F63]" />
        }
      >
        View public page
      </MenuRow>
      <MenuRow
        as="button"
        type="button"
        onClick={copyLink}
        icon={
          copied ? (
            <Check className="size-4 shrink-0 text-[#16A34A]" />
          ) : (
            <Copy className="size-4 shrink-0 text-[#9CA3AF] group-hover:text-[#FF5F63]" />
          )
        }
      >
        {copied ? "Copied!" : "Copy booking link"}
      </MenuRow>
      <MenuRow
        as={Link}
        href="/dashboard/profile"
        onClick={onClose}
        icon={
          <UserCircle2 className="size-4 shrink-0 text-[#9CA3AF] group-hover:text-[#FF5F63]" />
        }
      >
        Edit profile
      </MenuRow>
      <MenuRow
        as={Link}
        href="/dashboard/settings"
        onClick={onClose}
        icon={
          <Settings className="size-4 shrink-0 text-[#9CA3AF] group-hover:text-[#FF5F63]" />
        }
      >
        Settings
      </MenuRow>
      <div className="my-1 h-px bg-[#EEE7DF]" />
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={dark}
        onClick={toggleTheme}
        className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-[#374151] transition hover:bg-[#FFFBF7] hover:text-[#0B1220]"
      >
        {dark ? (
          <Sun className="size-4 shrink-0 text-[#9CA3AF] group-hover:text-[#FF5F63]" />
        ) : (
          <Moon className="size-4 shrink-0 text-[#9CA3AF] group-hover:text-[#FF5F63]" />
        )}
        <span className="flex-1">Dark mode</span>
        <span
          className={cn(
            "relative h-4 w-7 rounded-full transition",
            dark ? "bg-[#FF5F63]" : "bg-[#E5E7EB]",
          )}
        >
          <span
            className={cn(
              "absolute top-[2px] size-3 rounded-full bg-white shadow transition",
              dark ? "left-[14px]" : "left-[2px]",
            )}
          />
        </span>
      </button>
      <MenuRow
        as={Link}
        href="/legal/contact"
        onClick={onClose}
        icon={
          <LifeBuoy className="size-4 shrink-0 text-[#9CA3AF] group-hover:text-[#FF5F63]" />
        }
      >
        Help &amp; support
      </MenuRow>
      <MenuRow
        as="a"
        href="mailto:feedback@bookvella.com"
        onClick={onClose}
        icon={
          <MessageSquareText className="size-4 shrink-0 text-[#9CA3AF] group-hover:text-[#FF5F63]" />
        }
      >
        Send feedback
      </MenuRow>
      <div className="my-1 h-px bg-[#EEE7DF]" />
      <MenuRow
        as="button"
        type="button"
        onClick={() => {
          onClose();
          onLogout();
        }}
        danger
        icon={<LogOut className="size-4 shrink-0 text-[#DC2626]" />}
      >
        Sign out
      </MenuRow>
    </div>
  );
}

type MenuRowProps = {
  icon: ReactNode;
  children: ReactNode;
  danger?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  as?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

function MenuRow({
  icon,
  children,
  danger,
  as: As = "button",
  ...rest
}: MenuRowProps) {
  return (
    <As
      {...rest}
      role="menuitem"
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition",
        danger
          ? "text-[#B91C1C] hover:bg-[#FEF2F2]"
          : "text-[#374151] hover:bg-[#FFFBF7] hover:text-[#0B1220]",
      )}
    >
      {icon}
      {children}
    </As>
  );
}

function MobileNav({
  active,
  bookingCount,
}: {
  active: string;
  bookingCount?: number;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#EEE7DF] bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const selected = item.label === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold",
              selected ? "bg-[#FFF0EF] text-[#FF5F63]" : "text-[#9CA3AF]",
            )}
          >
            <Icon className="size-4" />
            {item.label}
            {item.label === "Bookings" && bookingCount && bookingCount > 0 ? (
              <span className="absolute right-2 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5F63] px-1 text-[9px] font-bold text-white">
                {bookingCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function publicAppUrl(path: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  return `${appUrl.replace(/\/$/, "")}${path}`;
}

export function EmptyPage({
  active,
  title,
  children,
}: {
  active: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AppShell active={active} title={title}>
      <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-8 shadow-sm">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#FFF0EF] text-[#FF5F63]">
          <LayoutGrid className="size-5" />
        </div>
        {children}
      </div>
    </AppShell>
  );
}
