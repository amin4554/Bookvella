"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Apple,
  Bell,
  Briefcase,
  Calendar as CalendarIcon,
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Link as LinkIcon,
  Loader2,
  LogOut,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { OtpStep } from "@/components/otp-step";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import {
  type AccountDeletionResponse,
  type ActiveUserSession,
  apiRequest,
  authedApiRequest,
  type BookingFeedResponse,
  type CalendarAuthorizationResponse,
  checkSlugAvailability,
  clearAuthSession,
  type ConnectedCalendar,
  downloadAuthedFile,
  type EmailChangeConfirmResponse,
  type EmailChangeRequestResponse,
  type HostBooking,
  type NotificationPreference,
  type NotificationPreferencesResponse,
  type PublicUser,
  publicBookingUrl,
  type TotpEnrollmentResponse,
  type TotpVerifyResponse,
  updateStoredUser,
} from "@/lib/api";
import {
  detectBrowserTimezone,
  formatOffset,
  timezoneCity,
} from "@/lib/timezones";

// Sections rendered in the page (all visible at once; left rail scrolls to them).
const SECTIONS = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "calendar", label: "Calendar", icon: CalendarClock },
  { id: "business", label: "Business", icon: Briefcase },
  { id: "data", label: "Data & export", icon: Database },
  { id: "danger", label: "Danger zone", icon: AlertTriangle },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

type NotificationKey =
  | "newBooking"
  | "cancellation"
  | "dailyAgenda"
  | "reminderBefore"
  | "productUpdates";

const NOTIFICATION_DEFAULTS: Record<NotificationKey, boolean> = {
  newBooking: true,
  cancellation: true,
  dailyAgenda: true,
  reminderBefore: true,
  productUpdates: false,
};

const REMINDER_OPTIONS = [
  { value: "2h", label: "2 hours before" },
  { value: "1h", label: "1 hour before" },
  { value: "30m", label: "30 minutes before" },
  { value: "off", label: "Off" },
];

const NOTIFICATION_TYPE_BY_KEY: Record<
  NotificationKey,
  NotificationPreference["type"]
> = {
  newBooking: "new_booking",
  cancellation: "cancellation",
  dailyAgenda: "daily_agenda",
  reminderBefore: "reminder_before",
  productUpdates: "product_updates",
};

const REMINDER_MINUTES_BY_VALUE: Record<string, number | null> = {
  "2h": 120,
  "1h": 60,
  "30m": 30,
  off: null,
};

function reminderValueFromMinutes(minutes: number | null) {
  switch (minutes) {
    case 30:
      return "30m";
    case 60:
      return "1h";
    case 120:
      return "2h";
    default:
      return "2h";
  }
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageFallback() {
  return (
    <AppShell active="Settings" title="Settings">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Loader2 className="size-4 animate-spin" /> Loading settings…
      </div>
    </AppShell>
  );
}

function SettingsPageContent() {
  const detectedTimezone = useMemo(() => detectBrowserTimezone(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const deleteToken = searchParams.get("deleteToken");

  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable account/business fields. These mirror the saved `user` until
  // edited; `dirty` derives from a diff so the sticky footer knows when to
  // show the Save/Discard pair.
  const [draftName, setDraftName] = useState("");
  const [draftBusinessDisplayName, setDraftBusinessDisplayName] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftTimezone, setDraftTimezone] = useState(detectedTimezone);
  const [draftLocation, setDraftLocation] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [slugStatus, setSlugStatus] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "ok" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [activeSection, setActiveSection] = useState<SectionId>("account");

  const applyUser = useCallback(
    (next: PublicUser) => {
      setUser(next);
      updateStoredUser(next);
      setDraftName(next.name);
      setDraftBusinessDisplayName(next.businessDisplayName ?? "");
      setDraftSlug(next.slug);
      setDraftTimezone(next.timezone || detectedTimezone);
      setDraftLocation(next.location ?? "");
      setSlugStatus({ kind: "idle" });
    },
    [detectedTimezone],
  );

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const me = await authedApiRequest<PublicUser>("/auth/me");
        if (!alive) return;
        applyUser(me);
      } catch (caught) {
        if (!alive) return;
        setError(
          caught instanceof Error ? caught.message : "Could not load settings",
        );
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [applyUser]);

  // Initial scroll to the section in the URL hash so the dashboard "Calendar
  // sync" link continues to land directly on the calendar section.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    if (!SECTIONS.some((s) => s.id === hash)) return;
    const target = document.getElementById(hash);
    if (!target) return;
    // Wait one frame so layout settles before scrolling.
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(hash as SectionId);
    });
  }, []);

  // Scrollspy: keep the rail matched to the section currently passing through
  // the upper part of the viewport while the user scrolls manually.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;

    function syncActiveSection() {
      frame = 0;
      const anchorY = Math.min(window.innerHeight * 0.28, 220);
      let next: SectionId = SECTIONS[0].id;

      for (const section of SECTIONS) {
        const element = document.getElementById(section.id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= anchorY) {
          next = section.id;
        }
      }

      const scrollBottom = window.scrollY + window.innerHeight;
      const pageBottom = document.documentElement.scrollHeight;
      if (pageBottom - scrollBottom < 8) {
        next = SECTIONS[SECTIONS.length - 1].id;
      }

      setActiveSection((current) => (current === next ? current : next));
    }

    function scheduleSync() {
      if (frame) return;
      frame = requestAnimationFrame(syncActiveSection);
    }

    scheduleSync();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
    };
  }, []);

  // Debounced slug availability check whenever the host edits the booking
  // link.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const handle = window.setTimeout(async () => {
      if (!alive) return;
      const normalized = draftSlug.trim().toLowerCase();
      if (!normalized || normalized === user.slug) {
        setSlugStatus({ kind: "idle" });
        return;
      }
      setSlugStatus({ kind: "checking" });
      try {
        const result = await checkSlugAvailability(normalized);
        if (!alive) return;
        if (result.available) {
          setSlugStatus({ kind: "ok" });
        } else {
          setSlugStatus({
            kind: "error",
            message:
              result.reason === "taken"
                ? "That link is already taken"
                : result.reason === "reserved"
                  ? "That link is reserved"
                  : result.reason === "too-short"
                    ? "Link must be at least 3 characters"
                    : "That link is not allowed",
          });
        }
      } catch {
        if (alive) setSlugStatus({ kind: "idle" });
      }
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [draftSlug, user]);

  const dirty = useMemo(() => {
    if (!user) return false;
    return (
      draftName.trim() !== user.name ||
      draftBusinessDisplayName.trim() !== (user.businessDisplayName ?? "") ||
      draftSlug.trim() !== user.slug ||
      draftTimezone !== user.timezone ||
      (draftLocation || "") !== (user.location ?? "")
    );
  }, [
    user,
    draftName,
    draftBusinessDisplayName,
    draftSlug,
    draftTimezone,
    draftLocation,
  ]);

  function discardChanges() {
    if (!user) return;
    applyUser(user);
  }

  async function saveProfile() {
    if (!user || !dirty) return;
    if (slugStatus.kind === "error") {
      toast.error(slugStatus.message);
      return;
    }
    setSavingProfile(true);
    try {
      const trimmedBusiness = draftBusinessDisplayName.trim();
      const updated = await authedApiRequest<PublicUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: draftName.trim(),
          businessDisplayName: trimmedBusiness ? trimmedBusiness : null,
          slug: draftSlug.trim(),
          timezone: draftTimezone,
          location: draftLocation.trim() || null,
        }),
      });
      applyUser(updated);
      toast.success("Settings saved");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not save settings",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <AppShell
      active="Settings"
      title="Settings"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
            Settings
          </p>
          <h1
            className="mt-1 text-[36px] font-extrabold md:text-[42px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
          >
            Account &amp; product settings
          </h1>
          <p className="mt-2 max-w-[640px] text-[14px] text-[#6B7280]">
            Manage your account, security, notifications, calendar sync, and
            business defaults. Profile editing has moved to{" "}
            <Link
              href="/dashboard/profile"
              className="font-bold text-[#FF5F63] hover:underline"
            >
              Profile
            </Link>
            .
          </p>
        </div>
        <SavedPill dirty={dirty} saving={savingProfile} />
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <LeftRail active={activeSection} onPick={setActiveSection} />

        <div className="space-y-10 pb-32">
          <AccountSection
            user={user}
            loading={loading}
            draftName={draftName}
            draftBusinessDisplayName={draftBusinessDisplayName}
            onDraftName={setDraftName}
            onDraftBusinessDisplayName={setDraftBusinessDisplayName}
            onUserUpdated={applyUser}
          />
          <SecuritySection user={user} onUserUpdated={applyUser} />
          <NotificationsSection />
          <CalendarSection />
          <BusinessSection
            user={user}
            loading={loading}
            draftSlug={draftSlug}
            draftTimezone={draftTimezone}
            draftLocation={draftLocation}
            slugStatus={slugStatus}
            detectedTimezone={detectedTimezone}
            onSlug={setDraftSlug}
            onTimezone={setDraftTimezone}
            onLocation={setDraftLocation}
          />
          <DataSection />
          <DangerSection
            user={user}
            onUserUpdated={applyUser}
            deleteToken={deleteToken}
            onDeleteTokenConsumed={() => {
              router.replace("/dashboard/settings#danger");
            }}
          />
        </div>
      </div>

      <StickySaveFooter
        dirty={dirty}
        saving={savingProfile}
        onDiscard={discardChanges}
        onSave={saveProfile}
      />
    </AppShell>
  );
}

// ── shared bits ────────────────────────────────────────────────────────────────

function LeftRail({
  active,
  onPick,
}: {
  active: SectionId;
  onPick: (id: SectionId) => void;
}) {
  const navRef = useRef<HTMLElement | null>(null);

  // When the active section changes (via scrollspy or click), make sure the
  // matching rail link is also visible inside the rail. Useful when the rail
  // ever overflows (e.g. compact viewports / future extra sections).
  useEffect(() => {
    if (!navRef.current) return;
    const link = navRef.current.querySelector<HTMLAnchorElement>(
      `a[data-section="${active}"]`,
    );
    if (!link) return;
    link.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>, id: SectionId) {
    event.preventDefault();
    onPick(id);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  }

  return (
    <nav
      ref={navRef}
      className="space-y-1 self-start lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
    >
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const on = active === section.id;
        return (
          <a
            key={section.id}
            data-section={section.id}
            href={`#${section.id}`}
            onClick={(event) => handleClick(event, section.id)}
            className={
              on
                ? "flex items-center gap-3 rounded-xl border border-[#EEE7DF] bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#0B1220] shadow-[0_1px_0_rgba(17,24,39,0.04)]"
                : "flex items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-[13px] font-semibold text-[#374151] hover:bg-[#FFFBF7] hover:text-[#0B1220]"
            }
          >
            <Icon
              className={
                on ? "size-4 text-[#FF5F63]" : "size-4 text-[#9CA3AF]"
              }
            />
            <span className="flex-1">{section.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

function SavedPill({ dirty, saving }: { dirty: boolean; saving: boolean }) {
  const tone = dirty
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
  const dot = dirty ? "bg-amber-500" : "bg-emerald-500";
  const label = saving
    ? "Saving…"
    : dirty
      ? "Unsaved changes"
      : "All changes saved";
  return (
    <span
      className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] font-bold ${tone}`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  tone,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  tone?: "danger";
}) {
  return (
    <div>
      <p
        className={`text-[11px] font-bold uppercase tracking-[0.16em] ${
          tone === "danger" ? "text-[#DC2626]" : "text-[#9CA3AF]"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className="mt-1 text-[22px] font-extrabold"
        style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-[640px] text-[13px] text-[#6B7280]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 divide-y divide-[#EEE7DF] rounded-2xl border border-[#EEE7DF] bg-white">
      {children}
    </div>
  );
}

function Row({
  title,
  sub,
  children,
  align = "center",
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`flex flex-wrap gap-4 px-5 py-4 ${
        align === "start" ? "items-start" : "items-center"
      } justify-between`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-[#0B1220]">{title}</p>
        {sub ? (
          <p className="mt-0.5 text-[12px] leading-[1.5] text-[#6B7280]">
            {sub}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "grey" | "amber" | "red" | "blue";
}) {
  const tones: Record<typeof tone, string> = {
    green: "bg-[#DCFCE7] text-[#15803D]",
    grey: "bg-[#F3F4F6] text-[#6B7280]",
    amber: "bg-[#FEF3C7] text-[#B45309]",
    red: "bg-[#FEE2E2] text-[#DC2626]",
    blue: "bg-[#DBEAFE] text-[#1D4ED8]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition disabled:opacity-50 ${
        on ? "bg-gradient-to-r from-[#FF6267] to-[#FF8A4C]" : "bg-[#E5E7EB]"
      }`}
    >
      <span
        className={`absolute top-[2px] size-4 rounded-full bg-white shadow-sm transition-all ${
          on ? "left-[18px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  disabled,
  maxWidth = "max-w-[260px]",
}: {
  value: string;
  onChange?: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxWidth?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`h-11 ${maxWidth} w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[14px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)] disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#6B7280]`}
    />
  );
}

function Select({
  value,
  onChange,
  options,
  minWidth = "min-w-[200px]",
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  minWidth?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`relative ${minWidth}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`h-10 ${minWidth} appearance-none rounded-xl border border-[#E5E7EB] bg-white pl-3.5 pr-9 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)] disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <span className="flex size-10 items-center justify-center rounded-xl bg-[#F3F4F6]">
      <svg viewBox="0 0 48 48" className="size-5">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.1l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.1z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.4 0 10.3-2 14-5.4l-6.5-5.5C29.7 34.7 27 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.5 5.5C41.6 35.4 44 30 44 24c0-1.2-.1-2.3-.4-3.5z"
        />
      </svg>
    </span>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-[480px]",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border border-[#EEE7DF] bg-white shadow-xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#EEE7DF] px-5 py-4">
          <h3 className="text-[16px] font-bold text-[#0B1220]">{title}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── sections ───────────────────────────────────────────────────────────────────

function AccountSection({
  user,
  loading,
  draftName,
  draftBusinessDisplayName,
  onDraftName,
  onDraftBusinessDisplayName,
  onUserUpdated,
}: {
  user: PublicUser | null;
  loading: boolean;
  draftName: string;
  draftBusinessDisplayName: string;
  onDraftName: (next: string) => void;
  onDraftBusinessDisplayName: (next: string) => void;
  onUserUpdated: (user: PublicUser) => void;
}) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  async function disconnectGoogle() {
    if (!user) return;
    if (
      !window.confirm(
        "Disconnect Google sign-in? You'll still be able to sign in with email and password.",
      )
    ) {
      return;
    }
    setDisconnectingGoogle(true);
    try {
      const updated = await authedApiRequest<PublicUser>("/auth/google", {
        method: "DELETE",
      });
      onUserUpdated(updated);
      toast.success("Google sign-in disconnected");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not disconnect Google sign-in",
      );
    } finally {
      setDisconnectingGoogle(false);
    }
  }

  const passwordSub = useMemo(() => {
    if (!user) return "Loading…";
    if (!user.hasPassword) {
      return "You currently sign in with Google. Add a password to also sign in by email.";
    }
    if (user.passwordSetAt) {
      return `Sign in with email and password. Last changed ${formatRelativeDate(user.passwordSetAt)}.`;
    }
    return "Sign in with email and password.";
  }, [user]);

  return (
    <section id="account">
      <SectionHeader
        eyebrow="Account"
        title="Who you are on Bookvella"
        description="Used inside the dashboard, on receipts, and for sign-in."
      />
      <Card>
        <Row
          title="Full name"
          sub="Used inside the dashboard and on receipts. Not shown publicly unless you choose to."
        >
          {loading || !user ? (
            <span className="text-[12px] text-[#9CA3AF]">Loading…</span>
          ) : (
            <Input value={draftName} onChange={onDraftName} />
          )}
        </Row>
        <Row
          title="Business display name"
          sub="Shown on your public page and in booking emails when set. Leave empty to use your full name."
        >
          {loading || !user ? (
            <span className="text-[12px] text-[#9CA3AF]">Loading…</span>
          ) : (
            <Input
              value={draftBusinessDisplayName}
              onChange={onDraftBusinessDisplayName}
              placeholder="e.g. Marcus' Studio"
            />
          )}
        </Row>
        <Row
          title="Email address"
          sub={
            <>
              Used to sign in and receive booking notifications.{" "}
              <span className="font-semibold text-[#16A34A]">Verified</span>
            </>
          }
        >
          <Input value={user?.email ?? ""} disabled />
          <button
            type="button"
            onClick={() => setEmailModalOpen(true)}
            disabled={!user}
            className="text-[13px] font-bold text-[#FF5F63] hover:underline disabled:text-[#9CA3AF] disabled:no-underline"
          >
            Change
          </button>
        </Row>
        <Row title="Password" sub={passwordSub}>
          <button
            type="button"
            onClick={() => setShowPasswordForm((v) => !v)}
            className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
          >
            {showPasswordForm
              ? "Close"
              : user?.hasPassword
                ? "Change password"
                : "Add password"}
          </button>
        </Row>
        {showPasswordForm && user ? (
          <div className="px-5 py-4">
            <PasswordForm
              user={user}
              onUserUpdated={(updated) => {
                onUserUpdated(updated);
                setShowPasswordForm(false);
              }}
            />
          </div>
        ) : null}
        <Row
          title={
            <div className="flex items-center gap-3">
              <GoogleGlyph />
              <span>Google account</span>
            </div>
          }
          sub={
            user?.hasGoogleSignIn
              ? `Connected as ${user.email}. Sign in faster.`
              : "Not connected. You can link your Google account on next sign-in."
          }
        >
          {user?.hasGoogleSignIn ? (
            <button
              type="button"
              onClick={disconnectGoogle}
              disabled={disconnectingGoogle || !user.hasPassword}
              title={
                user.hasPassword
                  ? undefined
                  : "Add a password first so you can still sign in"
              }
              className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:hover:bg-white"
            >
              {disconnectingGoogle ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Disconnect"
              )}
            </button>
          ) : (
            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-bold text-[#6B7280]">
              Not linked
            </span>
          )}
        </Row>
      </Card>

      {emailModalOpen && user ? (
        <EmailChangeModal
          currentEmail={user.email}
          onClose={() => setEmailModalOpen(false)}
        />
      ) : null}
    </section>
  );
}

function EmailChangeModal({
  currentEmail,
  onClose,
}: {
  currentEmail: string;
  onClose: () => void;
}) {
  const router = useRouter();
  // Three steps now: enter the new email → confirm it from the CURRENT mailbox
  // (proves the person at the keyboard owns the account) → confirm it from the
  // NEW mailbox (proves they actually own the new address).
  const [step, setStep] = useState<
    "request" | "verifyCurrent" | "confirm" | "done"
  >("request");
  const [newEmail, setNewEmail] = useState("");
  const [currentCode, setCurrentCode] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [currentOtpExpiresAt, setCurrentOtpExpiresAt] = useState<string | null>(
    null,
  );

  async function requestCurrentOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const response = await authedApiRequest<{
        success: boolean;
        expiresAt: string;
      }>("/auth/email/change/otp/request", {
        method: "POST",
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });
      setCurrentOtpExpiresAt(response.expiresAt);
      setCurrentCode("");
      setStep("verifyCurrent");
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error
          ? caught.message
          : "Could not send confirmation code",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCurrentOtp(codeValue: string) {
    if (codeValue.length !== 6 || submitting) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const response = await authedApiRequest<EmailChangeRequestResponse>(
        "/auth/email/change",
        {
          method: "POST",
          body: JSON.stringify({
            newEmail: newEmail.trim(),
            otpCode: codeValue,
          }),
        },
      );
      setExpiresAt(response.expiresAt);
      setCode("");
      setStep("confirm");
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error
          ? caught.message
          : "Code is invalid or expired",
      );
      setCurrentCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCurrentOtp() {
    setErrorMessage(null);
    try {
      const response = await authedApiRequest<{
        success: boolean;
        expiresAt: string;
      }>("/auth/email/change/otp/request", {
        method: "POST",
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });
      setCurrentOtpExpiresAt(response.expiresAt);
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Could not resend the code",
      );
    }
  }

  async function confirmChange(codeValue: string) {
    if (codeValue.length !== 6 || submitting) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await authedApiRequest<EmailChangeConfirmResponse>(
        "/auth/email/confirm",
        {
          method: "POST",
          body: JSON.stringify({ token: codeValue }),
        },
      );
      setStep("done");
      clearAuthSession();
      toast.success("Email changed. Sign in again to continue.");
      setTimeout(() => {
        router.push(`/login?reason=session_expired`);
      }, 1500);
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error
          ? caught.message
          : "Code is invalid or expired",
      );
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendConfirmation() {
    setErrorMessage(null);
    try {
      const response = await authedApiRequest<{
        success: boolean;
        expiresAt: string;
      }>("/auth/email/confirm/resend", { method: "POST" });
      setExpiresAt(response.expiresAt);
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Could not resend the code",
      );
    }
  }

  return (
    <ModalShell title="Change email address" onClose={onClose}>
      {step === "request" ? (
        <form className="space-y-4" onSubmit={requestCurrentOtp}>
          <p className="text-[13px] text-[#6B7280]">
            For your security we&apos;ll first send a 6-digit code to your
            current email{" "}
            <span className="font-semibold text-[#0B1220]">{currentEmail}</span>{" "}
            to confirm it&apos;s you. Then we&apos;ll send a second code to the
            new address.
          </p>
          <label className="block">
            <span className="text-[13px] font-bold text-[#0B1220]">
              New email address
            </span>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="new@example.com"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[14px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
            />
          </label>
          {errorMessage ? (
            <p className="text-[13px] font-bold text-[#B91C1C]">
              {errorMessage}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitting ? "Sending…" : "Send code to current email"}
            </button>
          </div>
        </form>
      ) : step === "verifyCurrent" ? (
        <OtpStep
          title="Confirm it's you"
          recipient={currentEmail}
          expiresAt={currentOtpExpiresAt}
          value={currentCode}
          onChange={setCurrentCode}
          onSubmit={verifyCurrentOtp}
          onResend={resendCurrentOtp}
          onBack={() => {
            setCurrentCode("");
            setErrorMessage(null);
            setStep("request");
          }}
          backLabel="← Use a different email"
          submitLabel="Send code to new email"
          submittingLabel="Sending…"
          submitting={submitting}
          error={errorMessage}
        />
      ) : step === "confirm" ? (
        <OtpStep
          title="Confirm your new email"
          recipient={newEmail}
          expiresAt={expiresAt}
          value={code}
          onChange={setCode}
          onSubmit={confirmChange}
          onResend={resendConfirmation}
          onBack={() => {
            setCode("");
            setErrorMessage(null);
            setStep("request");
          }}
          backLabel="← Start over"
          submitLabel="Confirm change"
          submittingLabel="Confirming…"
          submitting={submitting}
          error={errorMessage}
        />
      ) : (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
            <Check className="size-6" />
          </div>
          <p className="text-[15px] font-bold text-[#0B1220]">
            Email updated.
          </p>
          <p className="text-[13px] text-[#6B7280]">
            We signed you out of every device. Redirecting you to sign in…
          </p>
        </div>
      )}
    </ModalShell>
  );
}

function PasswordForm({
  user,
  onUserUpdated,
}: {
  user: PublicUser;
  onUserUpdated: (user: PublicUser) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const hasPassword = Boolean(user.hasPassword);
  // OTP gate when CHANGING an existing password. Adding a password to a
  // Google-only account stays single-step because there's nothing to
  // double-confirm yet. The cached credentials let "Resend code" re-issue the
  // OTP without forcing the user to retype anything.
  const [otpStep, setOtpStep] = useState<{
    expiresAt: string | null;
    credentials: { currentPassword: string; newPassword: string };
  } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = readText(form, "currentPassword");
    const newPassword = readText(form, "newPassword");
    const confirmPassword = readText(form, "confirmPassword");

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      if (hasPassword) {
        // Validates current password server-side, stores the new hash on the
        // OTP record, and emails a code. The change does not land until the
        // OTP step below succeeds.
        const response = await authedApiRequest<{
          success: boolean;
          expiresAt: string;
        }>("/auth/password/change/otp/request", {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        setOtpStep({
          expiresAt: response.expiresAt,
          credentials: { currentPassword, newPassword },
        });
        setOtpCode("");
        setOtpError(null);
      } else {
        const updated = await authedApiRequest<PublicUser>(
          "/auth/password/change",
          {
            method: "POST",
            body: JSON.stringify({ newPassword }),
          },
        );
        onUserUpdated(updated);
        formRef.current?.reset();
        toast.success("Password added");
      }
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not update password",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitOtp(code: string) {
    if (code.length !== 6 || saving) return;
    setSaving(true);
    setOtpError(null);
    try {
      const updated = await authedApiRequest<PublicUser>(
        "/auth/password/change/otp/verify",
        {
          method: "POST",
          body: JSON.stringify({ code }),
        },
      );
      onUserUpdated(updated);
      formRef.current?.reset();
      setOtpStep(null);
      setOtpCode("");
      toast.success("Password changed");
    } catch (caught) {
      setOtpError(
        caught instanceof Error ? caught.message : "Code is invalid or expired",
      );
      setOtpCode("");
    } finally {
      setSaving(false);
    }
  }

  async function resendOtp() {
    if (!otpStep) return;
    setOtpError(null);
    try {
      const response = await authedApiRequest<{
        success: boolean;
        expiresAt: string;
      }>("/auth/password/change/otp/request", {
        method: "POST",
        body: JSON.stringify(otpStep.credentials),
      });
      setOtpStep({ ...otpStep, expiresAt: response.expiresAt });
    } catch (caught) {
      setOtpError(
        caught instanceof Error ? caught.message : "Could not resend the code",
      );
    }
  }

  if (otpStep) {
    return (
      <div className="rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
        <OtpStep
          title="Confirm this password change"
          recipient={user.email}
          expiresAt={otpStep.expiresAt}
          value={otpCode}
          onChange={setOtpCode}
          onSubmit={submitOtp}
          onResend={resendOtp}
          onBack={() => {
            setOtpStep(null);
            setOtpCode("");
            setOtpError(null);
          }}
          submitLabel="Confirm password change"
          submittingLabel="Confirming…"
          submitting={saving}
          error={otpError}
        />
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="space-y-4 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-4"
      onSubmit={submit}
    >
      {hasPassword ? (
        <PasswordField
          label="Current password"
          name="currentPassword"
          autoComplete="current-password"
          show={showPasswords}
        />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <PasswordField
          label="New password"
          name="newPassword"
          autoComplete="new-password"
          show={showPasswords}
        />
        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          show={showPasswords}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowPasswords((value) => !value)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-bold text-[#374151] hover:bg-[#F9FAFB]"
        >
          {showPasswords ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
          {showPasswords ? "Hide passwords" : "Show passwords"}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          {saving
            ? hasPassword
              ? "Sending code…"
              : "Saving…"
            : hasPassword
              ? "Send confirmation code"
              : "Add password"}
        </button>
      </div>
    </form>
  );
}

function PasswordField({
  label,
  name,
  autoComplete,
  show,
}: {
  label: string;
  name: string;
  autoComplete: string;
  show: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-bold text-[#0B1220]">{label}</span>
      <input
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={8}
        className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[14px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
      />
    </label>
  );
}

function SecuritySection({
  user,
  onUserUpdated,
}: {
  user: PublicUser | null;
  onUserUpdated: (user: PublicUser) => void;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ActiveUserSession[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const [totpModal, setTotpModal] = useState<"enroll" | "disable" | null>(null);

  const reloadSessions = useCallback(async () => {
    try {
      const list = await authedApiRequest<ActiveUserSession[]>("/auth/sessions");
      setSessions(list);
      setSessionsError(null);
    } catch (caught) {
      setSessionsError(
        caught instanceof Error ? caught.message : "Could not load sessions",
      );
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    async function load() {
      try {
        const list =
          await authedApiRequest<ActiveUserSession[]>("/auth/sessions");
        if (alive) {
          setSessions(list);
          setSessionsError(null);
        }
      } catch (caught) {
        if (alive) {
          setSessionsError(
            caught instanceof Error
              ? caught.message
              : "Could not load sessions",
          );
        }
      } finally {
        if (alive) setSessionsLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [user]);

  async function revokeSession(id: string) {
    setRevokingId(id);
    try {
      const result = await authedApiRequest<{
        success: boolean;
        revokedCurrent: boolean;
      }>(`/auth/sessions/${id}`, { method: "DELETE" });
      if (result.revokedCurrent) {
        clearAuthSession();
        toast.success("Signed out of this device");
        router.push("/login?reason=session_expired");
        return;
      }
      toast.success("Session revoked");
      await reloadSessions();
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not revoke session",
      );
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeOthers() {
    if (!window.confirm("Sign out of every other device?")) return;
    setRevokingOthers(true);
    try {
      const result = await authedApiRequest<{
        success: boolean;
        revokedCount: number;
      }>("/auth/sessions/others", { method: "DELETE" });
      toast.success(
        result.revokedCount === 1
          ? "Signed out 1 other device"
          : `Signed out ${result.revokedCount} other devices`,
      );
      await reloadSessions();
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not sign out other devices",
      );
    } finally {
      setRevokingOthers(false);
    }
  }

  const otherSessions = sessions?.filter((session) => !session.isCurrent) ?? [];
  const twoFactorEnabled = Boolean(user?.hasTwoFactor);

  return (
    <section id="security">
      <SectionHeader
        eyebrow="Security"
        title="Sessions & sign-in"
        description="Set up a second factor and keep an eye on where you're signed in."
      />
      <Card>
        <Row
          title="Two-factor authentication"
          sub={
            twoFactorEnabled
              ? "Enabled. A 6-digit code is required when signing in."
              : "Require a code from your authenticator app every time you sign in."
          }
        >
          {twoFactorEnabled ? (
            <>
              <Pill tone="green">Enabled</Pill>
              <button
                type="button"
                onClick={() => setTotpModal("disable")}
                className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
              >
                Disable
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setTotpModal("enroll")}
              disabled={!user?.hasPassword}
              title={
                user?.hasPassword
                  ? undefined
                  : "Add a password before enabling two-factor authentication"
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-3.5 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
            >
              Set up 2FA
            </button>
          )}
        </Row>
        <Row title="Active sessions" align="start">
          <div className="w-full space-y-2 lg:min-w-[420px]">
            {sessionsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3 text-[13px] text-[#6B7280]">
                <Loader2 className="size-4 animate-spin" /> Loading sessions…
              </div>
            ) : sessionsError ? (
              <p className="text-[13px] text-[#B91C1C]">{sessionsError}</p>
            ) : sessions && sessions.length > 0 ? (
              sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  revoking={revokingId === session.id}
                  onRevoke={() => revokeSession(session.id)}
                />
              ))
            ) : (
              <p className="text-[13px] text-[#6B7280]">
                No active sessions found.
              </p>
            )}
            <button
              type="button"
              onClick={revokeOthers}
              disabled={revokingOthers || otherSessions.length === 0}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#FF5F63] hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:no-underline"
            >
              {revokingOthers ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              {revokingOthers
                ? "Signing out…"
                : otherSessions.length > 0
                  ? `Sign out of ${otherSessions.length} other device${
                      otherSessions.length === 1 ? "" : "s"
                    }`
                  : "Sign out of all other devices"}
            </button>
          </div>
        </Row>
      </Card>
      {!user?.hasPassword ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
          <ShieldCheck className="mt-0.5 size-4 text-amber-600" />
          <p className="text-[13px] leading-[1.6] text-[#92400E]">
            You sign in with Google only. Add a password from the Account
            section to also sign in by email and to enable two-factor
            authentication.
          </p>
        </div>
      ) : null}

      {totpModal === "enroll" ? (
        <TotpEnrollmentModal
          onClose={() => setTotpModal(null)}
          onEnabled={(updated) => {
            onUserUpdated(updated);
            setTotpModal(null);
          }}
        />
      ) : null}
      {totpModal === "disable" ? (
        <TotpDisableModal
          onClose={() => setTotpModal(null)}
          onDisabled={(updated) => {
            onUserUpdated(updated);
            setTotpModal(null);
          }}
        />
      ) : null}
    </section>
  );
}

function SessionRow({
  session,
  revoking,
  onRevoke,
}: {
  session: ActiveUserSession;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const isMobile = /iOS|Android/.test(session.os);
  const Icon = isMobile ? Smartphone : Laptop;
  const colorClass = session.isCurrent
    ? "bg-white text-[#FF5F63]"
    : "bg-[#F4EAFF] text-[#7C3AED]";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        session.isCurrent
          ? "border-[#EEE7DF] bg-[#FFFBF7]"
          : "border-[#EEE7DF] bg-white"
      }`}
    >
      <div
        className={`flex size-9 items-center justify-center rounded-xl ${colorClass}`}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold">
          {session.deviceLabel}
          {session.isCurrent ? (
            <span className="ml-1 inline-flex align-middle items-center gap-1 rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] font-bold text-[#15803D]">
              This device
            </span>
          ) : null}
        </p>
        <p className="text-[12px] text-[#6B7280]">
          {session.ipRegion ?? session.ipAddress ?? "Unknown location"} ·{" "}
          Active {formatRelativeDate(session.lastUsedAt)}
        </p>
      </div>
      {session.isCurrent ? null : (
        <button
          type="button"
          onClick={onRevoke}
          disabled={revoking}
          className="text-[12px] font-bold text-[#FF5F63] hover:underline disabled:text-[#9CA3AF]"
        >
          {revoking ? "Revoking…" : "Sign out"}
        </button>
      )}
    </div>
  );
}

function TotpEnrollmentModal({
  onClose,
  onEnabled,
}: {
  onClose: () => void;
  onEnabled: (user: PublicUser) => void;
}) {
  const [stage, setStage] = useState<
    "loading" | "scan" | "verify" | "backup" | "error"
  >("loading");
  const [enrollment, setEnrollment] = useState<TotpEnrollmentResponse | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function start() {
      try {
        const response = await authedApiRequest<TotpEnrollmentResponse>(
          "/auth/totp/enroll",
          { method: "POST" },
        );
        if (!alive) return;
        setEnrollment(response);
        setStage("scan");
      } catch (caught) {
        if (!alive) return;
        setErrorMessage(
          caught instanceof Error
            ? caught.message
            : "Could not start two-factor enrollment",
        );
        setStage("error");
      }
    }
    void start();
    return () => {
      alive = false;
    };
  }, []);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const response = await authedApiRequest<TotpVerifyResponse>(
        "/auth/totp/verify",
        {
          method: "POST",
          body: JSON.stringify({ code: code.trim() }),
        },
      );
      setBackupCodes(response.backupCodes);
      setStage("backup");
      // We'll bubble the updated user up when the modal closes from the backup
      // step so the user sees the codes first.
      updateStoredUser(response.user);
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Invalid code",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function downloadBackupCodes() {
    const text = backupCodes.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookvella-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function finish() {
    try {
      const me = await authedApiRequest<PublicUser>("/auth/me");
      onEnabled(me);
    } catch {
      onClose();
    }
  }

  return (
    <ModalShell title="Set up two-factor authentication" onClose={onClose}>
      {stage === "loading" ? (
        <div className="flex items-center gap-2 py-6 text-[13px] text-[#6B7280]">
          <Loader2 className="size-4 animate-spin" /> Generating secret…
        </div>
      ) : stage === "error" ? (
        <div className="space-y-3">
          <p className="text-[13px] text-[#B91C1C]">{errorMessage}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
          >
            Close
          </button>
        </div>
      ) : stage === "scan" && enrollment ? (
        <div className="space-y-4">
          <p className="text-[13px] text-[#6B7280]">
            Scan this QR code in your authenticator app (Google Authenticator,
            1Password, Authy…). Or enter the secret manually.
          </p>
          <div className="flex justify-center rounded-xl border border-[#EEE7DF] bg-white p-4">
            <img
              alt="Authenticator QR code"
              width={196}
              height={196}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=196x196&data=${encodeURIComponent(enrollment.otpauthUrl)}`}
              className="rounded"
            />
          </div>
          <div className="rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">
              Secret
            </p>
            <p className="mt-1 break-all font-mono text-[13px] text-[#0B1220]">
              {enrollment.secret}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStage("verify")}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-3.5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
          >
            Continue
          </button>
        </div>
      ) : stage === "verify" ? (
        <form className="space-y-4" onSubmit={verify}>
          <p className="text-[13px] text-[#6B7280]">
            Enter the 6-digit code from your authenticator app to confirm
            setup.
          </p>
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="123456"
            className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-center text-[20px] font-bold tracking-[0.4em] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
          />
          {errorMessage ? (
            <p className="text-[13px] font-bold text-[#B91C1C]">
              {errorMessage}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStage("scan")}
              className="text-[13px] font-bold text-[#6B7280] hover:text-[#0B1220]"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Verify and enable
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[12px] text-[#92400E]">
            <p className="font-bold">Save these backup codes.</p>
            <p className="mt-1">
              Each code can be used once if you lose access to your
              authenticator. Store them somewhere safe — we won&apos;t show them
              again.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-2 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3">
            {backupCodes.map((codeValue) => (
              <li
                key={codeValue}
                className="rounded-md bg-white px-2 py-1.5 text-center font-mono text-[13px] font-bold tracking-[0.1em] text-[#0B1220]"
              >
                {codeValue}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={downloadBackupCodes}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[12px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
            >
              <Download className="size-3.5" /> Download as .txt
            </button>
            <button
              type="button"
              onClick={finish}
              className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function TotpDisableModal({
  onClose,
  onDisabled,
}: {
  onClose: () => void;
  onDisabled: (user: PublicUser) => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const response = await authedApiRequest<{
        success: boolean;
        user: PublicUser;
      }>("/auth/totp/disable", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
      });
      toast.success("Two-factor authentication disabled");
      onDisabled(response.user);
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Invalid code",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Disable two-factor authentication" onClose={onClose}>
      <form className="space-y-4" onSubmit={disable}>
        <p className="text-[13px] text-[#6B7280]">
          Enter a current 6-digit code or one of your backup codes to confirm.
        </p>
        <input
          required
          inputMode="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="123456 or backup code"
          className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[15px] font-bold tracking-[0.2em] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
        />
        {errorMessage ? (
          <p className="text-[13px] font-bold text-[#B91C1C]">{errorMessage}</p>
        ) : null}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || code.trim().length < 6}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#EF4444] px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Disable 2FA
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState<Record<NotificationKey, boolean>>(
    NOTIFICATION_DEFAULTS,
  );
  const [reminder, setReminder] = useState("2h");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<NotificationKey | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadPreferences() {
      try {
        const response =
          await authedApiRequest<NotificationPreferencesResponse>(
            "/auth/me/notifications",
          );
        if (alive) {
          applyNotificationResponse(response);
        }
      } catch {
        if (alive) {
          toast.error("Could not load notification preferences");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void loadPreferences();

    return () => {
      alive = false;
    };

    function applyNotificationResponse(
      response: NotificationPreferencesResponse,
    ) {
      const nextPrefs = { ...NOTIFICATION_DEFAULTS };

      for (const [key, type] of Object.entries(
        NOTIFICATION_TYPE_BY_KEY,
      ) as [NotificationKey, NotificationPreference["type"]][]) {
        const preference = response.preferences.find(
          (item) => item.channel === "email" && item.type === type,
        );

        if (!preference) continue;

        nextPrefs[key] = preference.enabled;

        if (key === "reminderBefore") {
          setReminder(
            preference.enabled
              ? reminderValueFromMinutes(preference.timingMinutes)
              : "off",
          );
        }
      }

      setPrefs(nextPrefs);
    }
  }, []);

  async function savePreference(
    key: NotificationKey,
    nextPrefs: Record<NotificationKey, boolean>,
    nextReminder: string,
  ) {
    setSavingKey(key);

    try {
      const response = await authedApiRequest<NotificationPreferencesResponse>(
        "/auth/me/notifications",
        {
          method: "PATCH",
          body: JSON.stringify({
            preferences: [
              {
                channel: "email",
                type: NOTIFICATION_TYPE_BY_KEY[key],
                enabled:
                  key === "reminderBefore"
                    ? nextReminder !== "off"
                    : nextPrefs[key],
                timingMinutes:
                  key === "reminderBefore"
                    ? REMINDER_MINUTES_BY_VALUE[nextReminder]
                    : null,
              },
            ],
          }),
        },
      );

      const savedPreference = response.preferences.find(
        (item) =>
          item.channel === "email" &&
          item.type === NOTIFICATION_TYPE_BY_KEY[key],
      );

      if (savedPreference) {
        setPrefs((current) => ({
          ...current,
          [key]: savedPreference.enabled,
        }));

        if (key === "reminderBefore") {
          setReminder(
            savedPreference.enabled
              ? reminderValueFromMinutes(savedPreference.timingMinutes)
              : "off",
          );
        }
      }

      toast.success("Notification preference saved");
    } catch {
      toast.error("Could not save notification preference");
    } finally {
      setSavingKey(null);
    }
  }

  function togglePref(key: NotificationKey) {
    if (loading || savingKey) return;

    setPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      void savePreference(key, next, reminder);
      return next;
    });
  }

  function updateReminder(value: string) {
    if (loading || savingKey) return;

    const nextPrefs = { ...prefs, reminderBefore: value !== "off" };
    setReminder(value);
    setPrefs(nextPrefs);
    void savePreference("reminderBefore", nextPrefs, value);
  }

  return (
    <section id="notifications">
      <SectionHeader
        eyebrow="Notifications"
        title="What we send you"
        description="Preferences are saved to your account and used for host-facing booking emails."
      />
      <Card>
        <Row
          title="New booking"
          sub="Email when a guest confirms a booking."
        >
          <Toggle
            on={prefs.newBooking}
            onChange={() => togglePref("newBooking")}
          />
        </Row>
        <Row
          title="Cancellation"
          sub="Email when a guest cancels a confirmed booking."
        >
          <Toggle
            on={prefs.cancellation}
            onChange={() => togglePref("cancellation")}
          />
        </Row>
        <Row
          title="Daily agenda"
          sub="A short rundown each morning of your appointments today."
        >
          <Toggle
            on={prefs.dailyAgenda}
            onChange={() => togglePref("dailyAgenda")}
          />
        </Row>
        <Row
          title="Reminder before appointment"
          sub="Send guests an email reminder before their booking."
        >
          <Select
            value={reminder}
            onChange={updateReminder}
            options={REMINDER_OPTIONS}
            minWidth="min-w-[180px]"
          />
        </Row>
        <Row
          title="Product updates & tips"
          sub="Occasional emails about new features and best practices. No more than monthly."
        >
          <Toggle
            on={prefs.productUpdates}
            onChange={() => togglePref("productUpdates")}
          />
        </Row>
      </Card>
    </section>
  );
}

function CalendarSection() {
  const [calendars, setCalendars] = useState<ConnectedCalendar[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<"google" | "outlook" | null>(
    null,
  );
  const [busyCalendarId, setBusyCalendarId] = useState<string | null>(null);
  const [busyConflictId, setBusyConflictId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const list =
          await authedApiRequest<ConnectedCalendar[]>("/auth/calendars");
        if (alive) {
          setCalendars(list);
          setError(null);
        }
      } catch (caught) {
        if (alive) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load connected calendars",
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  async function startConnect(provider: "google" | "outlook") {
    setConnecting(provider);
    try {
      const response = await authedApiRequest<CalendarAuthorizationResponse>(
        provider === "google"
          ? "/auth/google/calendar"
          : "/auth/outlook/calendar",
      );
      window.location.href = response.authorizationUrl;
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : `Could not start ${provider === "google" ? "Google" : "Outlook"} sign-in`;
      toast.error(message);
      setConnecting(null);
    }
  }

  function replaceCalendar(updated: ConnectedCalendar) {
    setCalendars((current) =>
      current?.map((calendar) =>
        calendar.id === updated.id ? updated : calendar,
      ) ?? [updated],
    );
  }

  async function updateCalendar(
    calendar: ConnectedCalendar,
    patch: {
      enabled?: boolean;
      conflictsOn?: boolean;
      writeBackCalendarId?: string | null;
      markBufferBusy?: boolean;
      includeGuestDetails?: boolean;
    },
  ) {
    setBusyCalendarId(calendar.id);
    try {
      const updated = await authedApiRequest<ConnectedCalendar>(
        `/auth/calendars/${calendar.id}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      replaceCalendar(updated);
      toast.success("Calendar settings saved");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not update calendar settings",
      );
    } finally {
      setBusyCalendarId(null);
    }
  }

  async function updateConflictCalendar(
    calendar: ConnectedCalendar,
    conflictId: string,
    enabled: boolean,
  ) {
    setBusyConflictId(conflictId);
    try {
      const updated = await authedApiRequest<ConnectedCalendar>(
        `/auth/calendars/${calendar.id}/conflicts/${conflictId}`,
        { method: "PATCH", body: JSON.stringify({ enabled }) },
      );
      replaceCalendar(updated);
      toast.success(enabled ? "Calendar blocks availability" : "Calendar ignored");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not update calendar",
      );
    } finally {
      setBusyConflictId(null);
    }
  }

  async function disconnectCalendar(calendar: ConnectedCalendar) {
    if (
      !window.confirm(
        `Disconnect ${calendar.accountEmail}? Bookvella will stop checking it for conflicts and stop writing bookings to it.`,
      )
    ) {
      return;
    }

    setBusyCalendarId(calendar.id);
    try {
      await authedApiRequest<{ success: boolean }>(
        `/auth/calendars/${calendar.id}`,
        { method: "DELETE" },
      );
      setCalendars((current) =>
        current?.filter((item) => item.id !== calendar.id) ?? [],
      );
      toast.success("Calendar disconnected");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not disconnect calendar",
      );
    } finally {
      setBusyCalendarId(null);
    }
  }

  async function refreshCalendarList(calendar: ConnectedCalendar) {
    setBusyCalendarId(calendar.id);
    try {
      const updated = await authedApiRequest<ConnectedCalendar>(
        `/auth/calendars/${calendar.id}/refresh`,
        { method: "PATCH" },
      );
      replaceCalendar(updated);
      toast.success("Calendar list refreshed");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not refresh calendar list",
      );
    } finally {
      setBusyCalendarId(null);
    }
  }

  const googleCalendars =
    calendars?.filter((c) => c.provider === "GOOGLE") ?? [];
  const outlookCalendars =
    calendars?.filter((c) => c.provider === "OUTLOOK") ?? [];

  return (
    <section id="calendar">
      <SectionHeader
        eyebrow="Calendar"
        title="Connected calendars"
        description="Bookvella will check your calendar for conflicts and write new bookings back to it. Guests never see private event details — only that a time isn't available."
      />

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card>
        <CalendarProviderRow
          label="Google Calendar"
          glyph={<GoogleGlyph />}
          description="Two-way sync: read busy times, write new bookings into the calendar of your choice."
          calendars={googleCalendars}
          loading={loading}
          connecting={connecting === "google"}
          onConnect={() => startConnect("google")}
          busyCalendarId={busyCalendarId}
          busyConflictId={busyConflictId}
          onUpdateCalendar={updateCalendar}
          onUpdateConflictCalendar={updateConflictCalendar}
          onDisconnectCalendar={disconnectCalendar}
          onRefreshCalendar={refreshCalendarList}
        />
        <CalendarProviderRow
          label="Outlook / Microsoft 365"
          glyph={
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#DBEAFE]">
              <CalendarIcon className="size-5 text-[#1D4ED8]" />
            </span>
          }
          description="Pull busy times and write new bookings to Outlook."
          calendars={outlookCalendars}
          loading={loading}
          connecting={connecting === "outlook"}
          onConnect={() => startConnect("outlook")}
          busyCalendarId={busyCalendarId}
          busyConflictId={busyConflictId}
          onUpdateCalendar={updateCalendar}
          onUpdateConflictCalendar={updateConflictCalendar}
          onDisconnectCalendar={disconnectCalendar}
          onRefreshCalendar={refreshCalendarList}
        />
        <Row
          title={
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#F3F4F6]">
                <Apple className="size-5 text-[#0B1220]" />
              </span>
              <span>
                Apple iCloud <Pill tone="amber">Later this year</Pill>
              </span>
            </div>
          }
          sub="iCloud sync is planned after Google + Outlook ship."
        >
          <button
            type="button"
            disabled
            className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#9CA3AF]"
          >
            Notify me
          </button>
        </Row>
      </Card>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-white text-[#0D9488]">
          <ShieldCheck className="size-4" />
        </div>
        <div>
          <p className="text-[13px] font-bold">
            Guests never see your private calendar
          </p>
          <p className="mt-1 text-[12px] leading-snug text-[#6B7280]">
            Conflicting times are hidden. Guests see &ldquo;no longer
            available&rdquo; — never event titles, locations, or attendees.
          </p>
        </div>
      </div>
    </section>
  );
}

function CalendarProviderRow({
  label,
  glyph,
  description,
  calendars,
  loading,
  connecting,
  onConnect,
  busyCalendarId,
  busyConflictId,
  onUpdateCalendar,
  onUpdateConflictCalendar,
  onDisconnectCalendar,
  onRefreshCalendar,
}: {
  label: string;
  glyph: React.ReactNode;
  description: string;
  calendars: ConnectedCalendar[];
  loading: boolean;
  connecting: boolean;
  onConnect: () => void;
  busyCalendarId: string | null;
  busyConflictId: string | null;
  onUpdateCalendar: (
    calendar: ConnectedCalendar,
    patch: {
      enabled?: boolean;
      conflictsOn?: boolean;
      writeBackCalendarId?: string | null;
      markBufferBusy?: boolean;
      includeGuestDetails?: boolean;
    },
  ) => void;
  onUpdateConflictCalendar: (
    calendar: ConnectedCalendar,
    conflictId: string,
    enabled: boolean,
  ) => void;
  onDisconnectCalendar: (calendar: ConnectedCalendar) => void;
  onRefreshCalendar: (calendar: ConnectedCalendar) => void;
}) {
  const connected = calendars.length > 0;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {glyph}
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-[#0B1220]">
              {label}
              {connected ? (
                <span className="ml-2 align-middle">
                  <Pill tone="green">Connected</Pill>
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[12px] leading-[1.5] text-[#6B7280]">
              {description}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onConnect}
          disabled={loading || connecting}
          className={
            connected
              ? "inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-60"
              : "inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-3.5 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
          }
        >
          {connecting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Redirecting…
            </>
          ) : connected ? (
            <>
              <RefreshCw className="size-3.5" /> Reconnect
            </>
          ) : (
            "Connect"
          )}
        </button>
      </div>

      {connected ? (
        <div className="mt-3 space-y-3">
          {calendars.map((calendar) => (
            <div
              key={calendar.id}
              className="rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[#0B1220]">
                    {calendar.accountEmail}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">
                    Last synced{" "}
                    {calendar.lastSyncedAt
                      ? formatRelativeDate(calendar.lastSyncedAt)
                      : "never"}{" "}
                    · {calendar.conflictCalendars.length} calendar
                    {calendar.conflictCalendars.length === 1 ? "" : "s"}
                  </p>
                </div>
                <CalendarStateChip state={calendar.state} />
              </div>
              {calendar.lastSyncError ? (
                <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-[#B91C1C]">
                  {calendar.lastSyncError}
                </p>
              ) : null}
              {calendar.conflictCalendars.length > 0 ? (
                <ul className="hidden">
                  {calendar.conflictCalendars.map((conflict) => (
                    <li
                      key={conflict.id}
                      className="flex items-center gap-2 text-[12px] text-[#374151]"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{
                          background: conflict.color ?? "#9CA3AF",
                        }}
                      />
                      <span className="flex-1 truncate">{conflict.name}</span>
                      <span
                        className={
                          conflict.enabled
                            ? "rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] font-bold text-[#15803D]"
                            : "rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-bold text-[#6B7280]"
                        }
                      >
                        {conflict.enabled ? "Blocks" : "Ignored"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <CalendarAccountControls
                calendar={calendar}
                busy={busyCalendarId === calendar.id}
                busyConflictId={busyConflictId}
                onUpdate={onUpdateCalendar}
                onUpdateConflict={onUpdateConflictCalendar}
                onDisconnect={onDisconnectCalendar}
                onRefresh={onRefreshCalendar}
              />
            </div>
          ))}
          <p className="text-[11px] text-[#9CA3AF]">
            Refresh pulls calendar-list changes. Reconnect refreshes provider tokens.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CalendarAccountControls({
  calendar,
  busy,
  busyConflictId,
  onUpdate,
  onUpdateConflict,
  onDisconnect,
  onRefresh,
}: {
  calendar: ConnectedCalendar;
  busy: boolean;
  busyConflictId: string | null;
  onUpdate: (
    calendar: ConnectedCalendar,
    patch: {
      enabled?: boolean;
      conflictsOn?: boolean;
      writeBackCalendarId?: string | null;
      markBufferBusy?: boolean;
      includeGuestDetails?: boolean;
    },
  ) => void;
  onUpdateConflict: (
    calendar: ConnectedCalendar,
    conflictId: string,
    enabled: boolean,
  ) => void;
  onDisconnect: (calendar: ConnectedCalendar) => void;
  onRefresh: (calendar: ConnectedCalendar) => void;
}) {
  const providerUnavailable = calendar.state === "TOKEN_EXPIRED";
  const controlDisabled = busy || providerUnavailable;
  const conflictWriteBackOptions = calendar.conflictCalendars.map((conflict) => ({
    value: conflict.providerCalendarId,
    label: conflict.name,
  }));
  const hasCurrentWriteBack =
    !calendar.writeBackCalendarId ||
    conflictWriteBackOptions.some(
      (option) => option.value === calendar.writeBackCalendarId,
    );
  const currentWriteBackOption =
    !hasCurrentWriteBack && calendar.writeBackCalendarId
      ? [
          {
            value: calendar.writeBackCalendarId,
            label: "Current write-back calendar",
          },
        ]
      : [];
  const writeBackOptions = [
    { value: "", label: "Default calendar" },
    ...currentWriteBackOption,
    ...conflictWriteBackOptions,
  ];

  return (
    <div className="mt-3 space-y-3 border-t border-[#EEE7DF] pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <CalendarToggleRow
          label="Account sync"
          note="Pause conflict checks and booking write-back."
          checked={calendar.state !== "PAUSED"}
          disabled={busy}
          onChange={(next) => onUpdate(calendar, { enabled: next })}
        />
        <CalendarToggleRow
          label="Block busy times"
          note="Hide slots that overlap this account."
          checked={calendar.conflictsOn}
          disabled={controlDisabled}
          onChange={(next) => onUpdate(calendar, { conflictsOn: next })}
        />
        <CalendarToggleRow
          label="Reserve buffers"
          note="Write service buffer time into calendar events."
          checked={calendar.markBufferBusy}
          disabled={controlDisabled}
          onChange={(next) => onUpdate(calendar, { markBufferBusy: next })}
        />
        <CalendarToggleRow
          label="Guest details"
          note="Include guest name, contact info, and note."
          checked={calendar.includeGuestDetails}
          disabled={controlDisabled}
          onChange={(next) => onUpdate(calendar, { includeGuestDetails: next })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EEE7DF] bg-white px-3 py-2.5">
        <div>
          <p className="text-[12px] font-bold text-[#0B1220]">
            Write bookings to
          </p>
          <p className="text-[11px] text-[#6B7280]">
            New confirmed bookings are added here.
          </p>
        </div>
        <Select
          value={calendar.writeBackCalendarId ?? ""}
          onChange={(next) =>
            onUpdate(calendar, { writeBackCalendarId: next || null })
          }
          options={writeBackOptions}
          minWidth="min-w-[220px]"
          disabled={controlDisabled}
        />
      </div>

      {calendar.conflictCalendars.length > 0 ? (
        <div className="rounded-lg border border-[#EEE7DF] bg-white p-3">
          <p className="text-[12px] font-bold text-[#0B1220]">
            Calendars that block availability
          </p>
          <ul className="mt-2 space-y-1.5">
            {calendar.conflictCalendars.map((conflict) => (
              <li
                key={conflict.id}
                className="flex items-center gap-2 rounded-md bg-[#FFFBF7] px-2.5 py-2 text-[12px] text-[#374151]"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: conflict.color ?? "#9CA3AF" }}
                />
                <span className="min-w-0 flex-1 truncate">{conflict.name}</span>
                {busyConflictId === conflict.id ? (
                  <Loader2 className="size-3.5 animate-spin text-[#9CA3AF]" />
                ) : null}
                <Toggle
                  on={conflict.enabled}
                  disabled={controlDisabled || busyConflictId === conflict.id}
                  onChange={(next) =>
                    onUpdateConflict(calendar, conflict.id, next)
                  }
                />
                <span
                  className={
                    conflict.enabled
                      ? "w-12 text-right text-[10px] font-bold text-[#15803D]"
                      : "w-12 text-right text-[10px] font-bold text-[#6B7280]"
                  }
                >
                  {conflict.enabled ? "Blocks" : "Ignored"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[#EEE7DF] bg-white px-3 py-3 text-center text-[12px] text-[#9CA3AF]">
          Refresh calendars or reconnect if this account needs a new token.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => onRefresh(calendar)}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[12px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh calendars
        </button>
        <button
          type="button"
          onClick={() => onDisconnect(calendar)}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[12px] font-bold text-[#B91C1C] hover:bg-red-50 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Disconnect
        </button>
      </div>
    </div>
  );
}

function CalendarToggleRow({
  label,
  note,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  note: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#EEE7DF] bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-[#0B1220]">{label}</p>
        <p className="text-[11px] leading-snug text-[#6B7280]">{note}</p>
      </div>
      <Toggle on={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function CalendarStateChip({
  state,
}: {
  state: ConnectedCalendar["state"];
}) {
  switch (state) {
    case "ACTIVE":
      return <Pill tone="green">Active</Pill>;
    case "PAUSED":
      return <Pill tone="grey">Paused</Pill>;
    case "TOKEN_EXPIRED":
      return <Pill tone="amber">Reconnect</Pill>;
    case "SYNC_ERROR":
    default:
      return <Pill tone="red">Sync error</Pill>;
  }
}

function BusinessSection({
  user,
  loading,
  draftSlug,
  draftTimezone,
  draftLocation,
  slugStatus,
  detectedTimezone,
  onSlug,
  onTimezone,
  onLocation,
}: {
  user: PublicUser | null;
  loading: boolean;
  draftSlug: string;
  draftTimezone: string;
  draftLocation: string;
  slugStatus:
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "ok" }
    | { kind: "error"; message: string };
  detectedTimezone: string;
  onSlug: (v: string) => void;
  onTimezone: (v: string) => void;
  onLocation: (v: string) => void;
}) {
  const isDetected = draftTimezone === detectedTimezone;

  async function copyBookingLink() {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(publicBookingUrl(user.slug, ""));
      toast.success("Booking link copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <section id="business">
      <SectionHeader
        eyebrow="Business"
        title="How your business is set up"
        description="Defaults for new services and your public booking link."
      />
      <Card>
        <Row
          title="Default timezone"
          sub="All slots and reports use this timezone unless overridden on a service."
          align="start"
        >
          {loading ? (
            <span className="text-[12px] text-[#9CA3AF]">Loading…</span>
          ) : (
            <div className="min-w-[260px]">
              <TimezoneCombobox
                value={draftTimezone}
                onChange={onTimezone}
                detectedTimezone={detectedTimezone}
              />
              <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                {isDetected ? (
                  <>
                    Auto-detected from your browser (
                    <span className="font-semibold text-[#374151]">
                      {timezoneCity(detectedTimezone)}
                    </span>
                    ,{" "}
                    <span className="font-semibold tabular-nums text-[#374151]">
                      {formatOffset(detectedTimezone)}
                    </span>
                    ).
                  </>
                ) : (
                  <>
                    Your browser timezone is{" "}
                    <button
                      type="button"
                      onClick={() => onTimezone(detectedTimezone)}
                      className="font-semibold text-[#FF5F63] underline-offset-2 hover:underline"
                    >
                      {timezoneCity(detectedTimezone)} (
                      {formatOffset(detectedTimezone)})
                    </button>{" "}
                    — click to use it.
                  </>
                )}
              </p>
            </div>
          )}
        </Row>
        <Row
          title="Default location"
          sub="Pre-filled when creating new services. Shown publicly only when a service uses it."
        >
          <Input
            value={draftLocation}
            onChange={onLocation}
            placeholder="Shoreditch Studio, 12 Brick Lane"
          />
        </Row>
        <Row
          title="Booking link"
          sub="Your public page lives here. Changing this breaks links you've already shared."
        >
          <div className="flex max-w-[420px] items-center gap-2">
            <span className="text-[13px] whitespace-nowrap text-[#9CA3AF]">
              bookvella.com /
            </span>
            <Input
              value={draftSlug}
              onChange={onSlug}
              maxWidth="max-w-[180px]"
            />
            <button
              type="button"
              aria-label="Copy booking link"
              onClick={copyBookingLink}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 hover:bg-[#F9FAFB]"
            >
              <Copy className="size-4 text-[#6B7280]" />
            </button>
          </div>
          {slugStatus.kind === "checking" ? (
            <span className="text-[12px] text-[#9CA3AF]">Checking…</span>
          ) : slugStatus.kind === "ok" ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#15803D]">
              <Check className="size-3.5" /> Available
            </span>
          ) : slugStatus.kind === "error" ? (
            <span className="text-[12px] font-bold text-[#B91C1C]">
              {slugStatus.message}
            </span>
          ) : null}
        </Row>
      </Card>
    </section>
  );
}

function DataSection() {
  const [exporting, setExporting] = useState(false);
  const [exportingCustomers, setExportingCustomers] = useState(false);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedBusy, setFeedBusy] = useState<"copy" | "rotate" | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadFeed() {
      try {
        const response =
          await authedApiRequest<BookingFeedResponse>("/bookings/feed");
        if (alive) setFeedUrl(response.feedUrl);
      } catch {
        if (alive) setFeedUrl(null);
      } finally {
        if (alive) setFeedLoading(false);
      }
    }
    void loadFeed();
    return () => {
      alive = false;
    };
  }, []);

  async function exportBookings() {
    setExporting(true);
    try {
      const bookings = await authedApiRequest<HostBooking[]>("/bookings");
      const csv = buildBookingsCsv(bookings);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(csv, `bookvella-bookings-${stamp}.csv`, "text/csv");
      toast.success(`Exported ${bookings.length} bookings`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not export bookings",
      );
    } finally {
      setExporting(false);
    }
  }

  async function exportCustomers() {
    setExportingCustomers(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadAuthedFile(
        "/bookings/customers.csv",
        `bookvella-customers-${stamp}.csv`,
      );
      toast.success("Customer list exported");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not export customer list",
      );
    } finally {
      setExportingCustomers(false);
    }
  }

  async function copyFeedUrl() {
    if (!feedUrl) return;
    setFeedBusy("copy");
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success("Feed URL copied");
    } catch {
      toast.error("Could not copy feed URL");
    } finally {
      setFeedBusy(null);
    }
  }

  async function rotateFeedUrl() {
    if (
      !window.confirm(
        "Rotating revokes the current feed URL. Any calendar app subscribed to the old URL will stop syncing.",
      )
    ) {
      return;
    }
    setFeedBusy("rotate");
    try {
      const response = await authedApiRequest<BookingFeedResponse>(
        "/bookings/feed/rotate",
        { method: "PATCH" },
      );
      setFeedUrl(response.feedUrl);
      toast.success("Feed URL rotated");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not rotate feed",
      );
    } finally {
      setFeedBusy(null);
    }
  }

  return (
    <section id="data">
      <SectionHeader
        eyebrow="Data & export"
        title="Take your data with you"
        description="Bookvella never holds your data hostage."
      />
      <Card>
        <Row
          title="Export bookings"
          sub="CSV containing every booking with guest, service, status, and timestamps."
        >
          <button
            type="button"
            onClick={exportBookings}
            disabled={exporting}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exporting ? "Preparing…" : "Download CSV"}
          </button>
        </Row>
        <Row
          title="Customer list"
          sub="Aggregated guests with most-recent name, contact info, booking count, last booking and total spend."
        >
          <button
            type="button"
            onClick={exportCustomers}
            disabled={exportingCustomers}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            {exportingCustomers ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exportingCustomers ? "Preparing…" : "Download CSV"}
          </button>
        </Row>
        <Row
          title="Booking calendar feed (.ics)"
          sub={
            feedLoading
              ? "Loading your feed URL…"
              : feedUrl
                ? "Subscribe to this URL in any calendar app for a live read-only feed of confirmed bookings."
                : "Could not load feed URL. Try again."
          }
          align="start"
        >
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={copyFeedUrl}
              disabled={!feedUrl || feedBusy !== null}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-60"
            >
              {feedBusy === "copy" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LinkIcon className="size-4" />
              )}
              Copy feed URL
            </button>
            <button
              type="button"
              onClick={rotateFeedUrl}
              disabled={!feedUrl || feedBusy !== null}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] hover:text-[#0B1220] disabled:opacity-60"
            >
              {feedBusy === "rotate" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Rotate URL
            </button>
          </div>
        </Row>
      </Card>
    </section>
  );
}

function DangerSection({
  user,
  onUserUpdated,
  deleteToken,
  onDeleteTokenConsumed,
}: {
  user: PublicUser | null;
  onUserUpdated: (user: PublicUser) => void;
  deleteToken: string | null;
  onDeleteTokenConsumed: () => void;
}) {
  const router = useRouter();
  const [deactivating, setDeactivating] = useState(false);
  const [requestingDelete, setRequestingDelete] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pendingDeleteExpiresAt, setPendingDeleteExpiresAt] = useState<
    string | null
  >(null);

  const isActive = user?.isActive ?? true;

  useEffect(() => {
    if (!deleteToken) return;
    let cancelled = false;
    async function confirm() {
      setConfirmingDelete(true);
      try {
        await apiRequest<{ success: boolean }>("/auth/me/delete/confirm", {
          method: "POST",
          body: JSON.stringify({ token: deleteToken }),
        });
        if (cancelled) return;
        toast.success("Account deleted");
        clearAuthSession();
        router.push("/");
      } catch (caught) {
        if (cancelled) return;
        toast.error(
          caught instanceof Error
            ? caught.message
            : "Could not confirm deletion",
        );
        onDeleteTokenConsumed();
      } finally {
        if (!cancelled) setConfirmingDelete(false);
      }
    }
    void confirm();
    return () => {
      cancelled = true;
    };
  }, [deleteToken, onDeleteTokenConsumed, router]);

  async function toggleActive(nextActive: boolean) {
    if (!user) return;
    if (!nextActive) {
      if (
        !window.confirm(
          "Deactivate your account? Your public profile will show 'currently unavailable' and new bookings will be blocked. You can reactivate any time.",
        )
      ) {
        return;
      }
    }
    setDeactivating(true);
    try {
      const updated = await authedApiRequest<PublicUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextActive }),
      });
      onUserUpdated(updated);
      toast.success(nextActive ? "Account reactivated" : "Account deactivated");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not update account state",
      );
    } finally {
      setDeactivating(false);
    }
  }

  async function requestDelete() {
    if (
      !window.confirm(
        "Send a deletion confirmation email? You'll have 30 days to click the link before the request expires.",
      )
    ) {
      return;
    }
    setRequestingDelete(true);
    try {
      const response = await authedApiRequest<AccountDeletionResponse>(
        "/auth/me/delete",
        { method: "POST" },
      );
      setPendingDeleteExpiresAt(response.expiresAt);
      toast.success("Confirmation email sent");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not send confirmation email",
      );
    } finally {
      setRequestingDelete(false);
    }
  }

  return (
    <section id="danger">
      <SectionHeader
        eyebrow="Danger zone"
        title="Irreversible actions"
        description="Deactivation is reversible; deletion anonymizes your account permanently."
        tone="danger"
      />
      <div className="mt-4 rounded-2xl border border-[#FCC9C5] bg-[#FFF5F4]">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="max-w-[480px]">
            <p className="text-[14px] font-bold">
              {isActive ? "Deactivate account" : "Account is deactivated"}
            </p>
            <p className="mt-1 text-[12.5px] text-[#6B7280]">
              {isActive
                ? "Your public page will show a 'currently unavailable' notice. Existing bookings stay. You can reactivate any time."
                : "Your public page is hidden and new bookings are blocked. Reactivate to make your services bookable again."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleActive(!isActive)}
            disabled={deactivating || !user}
            className={
              isActive
                ? "inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-60"
                : "inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-3.5 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
            }
          >
            {deactivating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isActive ? (
              "Deactivate"
            ) : (
              "Reactivate"
            )}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#FCC9C5] p-5">
          <div className="max-w-[480px]">
            <p className="text-[14px] font-bold text-[#B91C1C]">
              Delete account permanently
            </p>
            <p className="mt-1 text-[12.5px] text-[#6B7280]">
              We&apos;ll email a confirmation link. Clicking it anonymizes your
              account, hides bookings, services, reviews, and your public page.
              This cannot be undone.
            </p>
            {pendingDeleteExpiresAt ? (
              <p className="mt-1 text-[12px] font-bold text-amber-700">
                Confirmation link sent. Expires{" "}
                {formatRelativeDate(pendingDeleteExpiresAt)}.
              </p>
            ) : null}
            {confirmingDelete ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-[#B91C1C]">
                <Loader2 className="size-3.5 animate-spin" /> Confirming
                deletion…
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={requestDelete}
            disabled={requestingDelete || !user || confirmingDelete}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#EF4444] px-3.5 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
          >
            {requestingDelete ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {requestingDelete ? "Sending…" : "Send delete email"}
          </button>
        </div>
      </div>
    </section>
  );
}

function StickySaveFooter({
  dirty,
  saving,
  onDiscard,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 z-20 mt-6 lg:ml-[256px]">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE7DF] bg-white p-3 pl-5 shadow-[0_24px_48px_-20px_rgba(17,24,39,0.16),0_8px_24px_-12px_rgba(17,24,39,0.10)]">
        <p className="text-[13px] text-[#6B7280]">
          <span className="font-bold text-amber-600">●</span> You have unsaved
          changes.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────────

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildBookingsCsv(bookings: HostBooking[]): string {
  const header = [
    "id",
    "guest_name",
    "guest_email",
    "guest_phone",
    "service_title",
    "service_duration_minutes",
    "start_time_utc",
    "end_time_utc",
    "guest_timezone",
    "status",
    "cancellation_reason",
    "created_at",
  ];
  const rows = bookings.map((b) => [
    b.id,
    b.guestName,
    b.guestEmail,
    b.guestPhone ?? "",
    b.eventType.title,
    String(b.eventType.durationMinutes),
    b.startTimeUtc,
    b.endTimeUtc,
    b.guestTimezone,
    b.status,
    b.cancellationReason ?? "",
    b.createdAt,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string): string {
  const safe = value ?? "";
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatRelativeDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return formatter.format(diffDays, "day");
  }
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return formatter.format(diffMonths, "month");
  }
  return formatter.format(Math.round(diffMonths / 12), "year");
}
