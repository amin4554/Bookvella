"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import {
  authedApiRequest,
  checkSlugAvailability,
  type HostBooking,
  type PublicUser,
  publicBookingUrl,
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

// Notification preferences are not yet persisted server-side — they live in
// localStorage so the host's toggle state survives a reload while the backend
// catches up. See Bookvella-Agent-Continuation-Brief.md "Settings — remaining
// backend work" for the actual data model that needs to land.
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

export default function SettingsPage() {
  const detectedTimezone = useMemo(() => detectBrowserTimezone(), []);

  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable account/business fields. These mirror the saved `user` until
  // edited; `dirty` derives from a diff so the sticky footer knows when to
  // show the Save/Discard pair.
  const [draftName, setDraftName] = useState("");
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

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const me = await authedApiRequest<PublicUser>("/auth/me");
        if (!alive) return;
        setUser(me);
        setDraftName(me.name);
        setDraftSlug(me.slug);
        setDraftTimezone(me.timezone || detectedTimezone);
        setDraftLocation(me.location ?? "");
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
  }, [detectedTimezone]);

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

  // Scrollspy: highlight the rail link whose section is closest to the top.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveSection(visible[0].target.id as SectionId);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // Debounced slug availability check whenever the host edits the booking
  // link. We do all the work inside a setTimeout callback so React's
  // "no setState in effect body" rule passes — the setState calls fire from
  // the timer, which is asynchronous to the effect.
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
      draftSlug.trim() !== user.slug ||
      draftTimezone !== user.timezone ||
      (draftLocation || "") !== (user.location ?? "")
    );
  }, [user, draftName, draftSlug, draftTimezone, draftLocation]);

  function discardChanges() {
    if (!user) return;
    setDraftName(user.name);
    setDraftSlug(user.slug);
    setDraftTimezone(user.timezone || detectedTimezone);
    setDraftLocation(user.location ?? "");
    setSlugStatus({ kind: "idle" });
  }

  async function saveProfile() {
    if (!user || !dirty) return;
    if (slugStatus.kind === "error") {
      toast.error(slugStatus.message);
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await authedApiRequest<PublicUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: draftName.trim(),
          slug: draftSlug.trim(),
          timezone: draftTimezone,
          location: draftLocation.trim() || null,
        }),
      });
      setUser(updated);
      updateStoredUser(updated);
      setDraftName(updated.name);
      setDraftSlug(updated.slug);
      setDraftTimezone(updated.timezone);
      setDraftLocation(updated.location ?? "");
      setSlugStatus({ kind: "idle" });
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
            onDraftName={setDraftName}
          />
          <SecuritySection user={user} onUserUpdated={(u) => {
            setUser(u);
            updateStoredUser(u);
          }} />
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
          <DangerSection />
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
  return (
    <nav className="space-y-1 self-start lg:sticky lg:top-6">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const on = active === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={() => onPick(section.id)}
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
}: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  minWidth?: string;
}) {
  return (
    <div className={`relative ${minWidth}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 ${minWidth} appearance-none rounded-xl border border-[#E5E7EB] bg-white pl-3.5 pr-9 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]`}
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

// ── sections ───────────────────────────────────────────────────────────────────

function AccountSection({
  user,
  loading,
  draftName,
  onDraftName,
}: {
  user: PublicUser | null;
  loading: boolean;
  draftName: string;
  onDraftName: (next: string) => void;
}) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);

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
            disabled
            title="Coming soon"
            className="text-[13px] font-bold text-[#9CA3AF]"
          >
            Change
          </button>
        </Row>
        <Row
          title="Password"
          sub={
            user
              ? user.hasPassword
                ? "Sign in with email and password."
                : "You currently sign in with Google. Add a password to also sign in by email."
              : "Loading…"
          }
        >
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
                updateStoredUser(updated);
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
              disabled
              title="Coming soon"
              className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#9CA3AF]"
            >
              Disconnect
            </button>
          ) : (
            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-bold text-[#6B7280]">
              Not linked
            </span>
          )}
        </Row>
      </Card>
    </section>
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
      const updated = await authedApiRequest<PublicUser>(
        "/auth/password/change",
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword: hasPassword ? currentPassword : undefined,
            newPassword,
          }),
        },
      );
      onUserUpdated(updated);
      formRef.current?.reset();
      toast.success(hasPassword ? "Password changed" : "Password added");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not update password",
      );
    } finally {
      setSaving(false);
    }
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
          {saving ? "Saving…" : hasPassword ? "Change password" : "Add password"}
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
}: {
  user: PublicUser | null;
  onUserUpdated: (user: PublicUser) => void;
}) {
  return (
    <section id="security">
      <SectionHeader
        eyebrow="Security"
        title="Sessions & sign-in"
        description="2FA and per-device session control are on the roadmap."
      />
      <Card>
        <Row
          title="Two-factor authentication"
          sub="Require a code from your authenticator app every time you sign in on a new device."
        >
          <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-bold text-[#6B7280]">
            Coming soon
          </span>
          <Toggle on={false} onChange={() => undefined} disabled />
        </Row>
        <Row title="Active sessions" align="start">
          <div className="w-full space-y-2 lg:min-w-[420px]">
            <div className="flex items-center gap-3 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-white text-[#FF5F63]">
                <Laptop className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold">
                  This device{" "}
                  <span className="ml-1 inline-flex align-middle items-center gap-1 rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] font-bold text-[#15803D]">
                    Active
                  </span>
                </p>
                <p className="text-[12px] text-[#6B7280]">
                  Signed in on this browser
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#EEE7DF] p-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#F4EAFF] text-[#7C3AED]">
                <Smartphone className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#9CA3AF]">
                  Other devices appear here when session listing ships
                </p>
                <p className="text-[12px] text-[#9CA3AF]">
                  Until then, password reset signs everyone out at once.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled
              className="text-[13px] font-bold text-[#9CA3AF]"
              title="Coming soon — for now, reset your password to revoke every session."
            >
              Sign out of all other devices
            </button>
          </div>
        </Row>
      </Card>
      {!user?.hasPassword ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
          <ShieldCheck className="mt-0.5 size-4 text-amber-600" />
          <p className="text-[13px] leading-[1.6] text-[#92400E]">
            You sign in with Google only. Add a password from the Account
            section to also sign in by email.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState<Record<NotificationKey, boolean>>(
    NOTIFICATION_DEFAULTS,
  );
  const [reminder, setReminder] = useState("2h");

  // Persist preferences locally so a reload doesn't reset toggles. Server-side
  // notification preferences (and the actual send-side honoring of them) are
  // tracked in the agent brief as a remaining backend task.
  //
  // The load runs inside a microtask so we don't call setState synchronously
  // from the effect body (React 19 / Next 16 lint rule).
  useEffect(() => {
    let alive = true;
    const handle = window.setTimeout(() => {
      if (!alive) return;
      try {
        const raw = localStorage.getItem("bookvella.settings.notifications");
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          prefs?: Partial<Record<NotificationKey, boolean>>;
          reminder?: string;
        };
        if (parsed.prefs) {
          setPrefs((current) => ({ ...current, ...parsed.prefs }));
        }
        if (typeof parsed.reminder === "string") setReminder(parsed.reminder);
      } catch {
        // ignore — fall back to defaults
      }
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, []);

  function persist(next: Record<NotificationKey, boolean>, nextReminder: string) {
    try {
      localStorage.setItem(
        "bookvella.settings.notifications",
        JSON.stringify({ prefs: next, reminder: nextReminder }),
      );
    } catch {
      // ignore
    }
  }

  function togglePref(key: NotificationKey) {
    setPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      persist(next, reminder);
      return next;
    });
  }

  return (
    <section id="notifications">
      <SectionHeader
        eyebrow="Notifications"
        title="What we send you"
        description="Preferences are saved on this device for now. Server-side honoring is on the roadmap."
      />
      <Card>
        <Row
          title="New booking"
          sub="Email when a guest confirms a booking."
        >
          <Toggle on={prefs.newBooking} onChange={() => togglePref("newBooking")} />
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
            onChange={(v) => {
              setReminder(v);
              persist(prefs, v);
            }}
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
  return (
    <section id="calendar">
      <SectionHeader
        eyebrow="Calendar"
        title="Connected calendars"
        description="Bookvella will check your calendar for conflicts and write new bookings back to it. Guests never see private event details — only that a time isn't available."
      />

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[#EEE7DF] bg-[#FFFBF7] px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-white text-[#FF5F63]">
          <CalendarClock className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-[#0B1220]">
            No calendar connected yet
          </p>
          <p className="text-[12px] text-[#6B7280]">
            Your availability still works from the schedule you set in
            Availability. Calendar sync ships next.
          </p>
        </div>
      </div>

      <Card>
        <Row
          title={
            <div className="flex items-center gap-3">
              <GoogleGlyph />
              <span>
                Google Calendar{" "}
                <Pill tone="grey">Coming soon</Pill>
              </span>
            </div>
          }
          sub="Two-way sync: read busy times, write new bookings into the calendar of your choice."
        >
          <button
            type="button"
            disabled
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-3.5 text-[13px] font-bold text-white opacity-60"
          >
            Connect
          </button>
        </Row>
        <Row
          title={
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#DBEAFE]">
                <CalendarIcon className="size-5 text-[#1D4ED8]" />
              </span>
              <span>
                Outlook / Microsoft 365{" "}
                <Pill tone="grey">Coming soon</Pill>
              </span>
            </div>
          }
          sub="Pull busy times and write new bookings to Outlook."
        >
          <button
            type="button"
            disabled
            className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#9CA3AF]"
          >
            Connect
          </button>
        </Row>
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
            When sync ships, conflicting times are hidden. Guests see &ldquo;no
            longer available&rdquo; — never event titles, locations, or
            attendees.
          </p>
        </div>
      </div>
    </section>
  );
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
          title={
            <span className="flex items-center gap-2">
              Customer list <Pill tone="amber">Soon</Pill>
            </span>
          }
          sub="Email-based contact list of guests who've booked you. Coming after the bookings dashboard adds saved-customer state."
        >
          <button
            type="button"
            disabled
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#9CA3AF]"
          >
            <Download className="size-4" /> Download CSV
          </button>
        </Row>
        <Row
          title={
            <span className="flex items-center gap-2">
              Booking calendar feed (.ics){" "}
              <Pill tone="amber">Soon</Pill>
            </span>
          }
          sub="A read-only feed of all confirmed bookings you can subscribe to from any calendar app. Individual .ics attachments already ship with each confirmation email."
        >
          <button
            type="button"
            disabled
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#9CA3AF]"
          >
            <LinkIcon className="size-4" /> Copy feed URL
          </button>
        </Row>
      </Card>
    </section>
  );
}

function DangerSection() {
  return (
    <section id="danger">
      <SectionHeader
        eyebrow="Danger zone"
        title="Irreversible actions"
        description="Plumbed in the UI; the actual destructive endpoints land with billing/compliance review."
        tone="danger"
      />
      <div className="mt-4 rounded-2xl border border-[#FCC9C5] bg-[#FFF5F4]">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="max-w-[480px]">
            <p className="text-[14px] font-bold">Deactivate account</p>
            <p className="mt-1 text-[12.5px] text-[#6B7280]">
              Your public page will show a &ldquo;currently unavailable&rdquo;
              notice. Existing bookings stay. You can reactivate any time.
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#9CA3AF]"
          >
            Deactivate
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#FCC9C5] p-5">
          <div className="max-w-[480px]">
            <p className="text-[14px] font-bold text-[#B91C1C]">
              Delete account permanently
            </p>
            <p className="mt-1 text-[12.5px] text-[#6B7280]">
              All bookings, services, reviews, and your public page will be
              removed. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#EF4444] px-3.5 text-[13px] font-bold text-white opacity-60"
          >
            <Trash2 className="size-4" /> Delete account
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

// Silence unused-warning for icons reserved for the next iteration (revoke
// button, sync indicator). Keeps the import list aligned with the design's
// vocabulary so it's a one-line edit to wire them up later.
void LogOut;
void RefreshCw;
