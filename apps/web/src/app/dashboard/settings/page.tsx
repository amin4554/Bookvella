"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  Calendar,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Shield,
  ShieldCheck,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import {
  authedApiRequest,
  type PublicUser,
  updateStoredUser,
} from "@/lib/api";
import {
  detectBrowserTimezone,
  formatOffset,
  timezoneCity,
} from "@/lib/timezones";

type Section =
  | "account"
  | "security"
  | "notifications"
  | "calendar"
  | "data";

const navSections: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "account", label: "Account", icon: UserCircle2 },
  { id: "security", label: "Security", icon: KeyRound },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "data", label: "Data & privacy", icon: Shield },
];

export default function SettingsPage() {
  const detectedTimezone = useMemo(() => detectBrowserTimezone(), []);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("account");
  const [savingAccount, setSavingAccount] = useState(false);
  const [timezone, setTimezone] = useState<string>(detectedTimezone);

  useEffect(() => {
    async function load() {
      try {
        const me = await authedApiRequest<PublicUser>("/auth/me");
        setUser(me);
        if (me.timezone) setTimezone(me.timezone);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not load settings",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSavingAccount(true);
    const form = new FormData(event.currentTarget);
    try {
      const updated = await authedApiRequest<PublicUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: readText(form, "name"),
          timezone: timezone || detectedTimezone,
        }),
      });
      setUser(updated);
      updateStoredUser(updated);
      toast.success("Account updated");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not save",
      );
    } finally {
      setSavingAccount(false);
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
          <h1
            className="text-[36px] font-extrabold md:text-[42px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
          >
            Settings
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Manage your account, security, and how Bookvella talks to you.
          </p>
        </div>
        <Link
          href="/dashboard/profile"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
        >
          <UserCircle2 className="size-4" /> Edit public profile
        </Link>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-7 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-[#EEE7DF] bg-white p-2 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)] lg:sticky lg:top-6 lg:self-start">
          <nav className="flex flex-col gap-1 p-1">
            {navSections.map((item) => {
              const Icon = item.icon;
              const selected = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={
                    selected
                      ? "flex items-center gap-3 rounded-xl bg-[#FFEDEA] px-3 py-2.5 text-[13px] font-bold text-[#FF5F63]"
                      : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#374151] hover:bg-[#FFFBF7]"
                  }
                >
                  <Icon
                    className={
                      selected
                        ? "size-4 text-[#FF5F63]"
                        : "size-4 text-[#9CA3AF]"
                    }
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronRight className="size-3.5 text-[#9CA3AF]" />
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-6">
          {section === "account" ? (
            <AccountSection
              user={user}
              loading={loading}
              saving={savingAccount}
              detectedTimezone={detectedTimezone}
              timezone={timezone}
              onTimezoneChange={setTimezone}
              onSave={saveAccount}
            />
          ) : null}
          {section === "security" ? (
            <SecuritySection
              user={user}
              onUserUpdated={(updated) => {
                setUser(updated);
                updateStoredUser(updated);
              }}
            />
          ) : null}
          {section === "notifications" ? <NotificationsSection /> : null}
          {section === "calendar" ? <CalendarSection /> : null}
          {section === "data" ? <DataSection /> : null}
        </div>
      </div>
    </AppShell>
  );
}

function AccountSection({
  user,
  loading,
  saving,
  detectedTimezone,
  timezone,
  onTimezoneChange,
  onSave,
}: {
  user: PublicUser | null;
  loading: boolean;
  saving: boolean;
  detectedTimezone: string;
  timezone: string;
  onTimezoneChange: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isDetected = timezone === detectedTimezone;
  return (
    <form onSubmit={onSave}>
      <SettingsPanel
        eyebrow="Account"
        title="Personal details"
        description="Used for login and shown on your booking page header."
      >
        {loading || !user ? (
          <p className="text-sm text-[#6B7280]">Loading account details…</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" name="name" defaultValue={user.name} />
              <Field
                label="Email address"
                name="email"
                defaultValue={user.email}
                disabled
                hint="Email changes are coming soon."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Public handle"
                name="slug"
                defaultValue={user.slug}
                disabled
                hint="Change this from your public profile page."
              />
              <div>
                <label className="block">
                  <span className="text-sm font-bold">Timezone</span>
                  <div className="mt-2">
                    <TimezoneCombobox
                      value={timezone}
                      onChange={onTimezoneChange}
                      detectedTimezone={detectedTimezone}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#9CA3AF]">
                    {isDetected ? (
                      <>
                        Auto-detected from your browser (
                        <span className="font-semibold text-[#374151]">
                          {timezoneCity(detectedTimezone)}
                        </span>
                        ,{" "}
                        <span className="font-semibold text-[#374151] tabular-nums">
                          {formatOffset(detectedTimezone)}
                        </span>
                        ). Used for your schedule and guest displays.
                      </>
                    ) : (
                      <>
                        Your browser timezone is{" "}
                        <button
                          type="button"
                          onClick={() => onTimezoneChange(detectedTimezone)}
                          className="font-semibold text-[#FF5F63] underline-offset-2 hover:underline"
                        >
                          {timezoneCity(detectedTimezone)} ({" "}
                          {formatOffset(detectedTimezone)} )
                        </button>{" "}
                        — click to use it.
                      </>
                    )}
                  </p>
                </label>
              </div>
            </div>
            <div className="mt-1 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        )}
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Account"
        title="Connected sign-in"
        description="How you log in to Bookvella."
      >
        <div className="flex items-center justify-between rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white text-[#4285F4]">
              <Mail className="size-4" />
            </span>
            <div>
              <p className="text-[13px] font-bold">Google sign-in</p>
              <p className="text-[11px] text-[#6B7280]">
                Connect Google to sign in with one click.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[11px] font-bold text-[#6B7280]">
            Optional
          </span>
        </div>
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Account"
        title="Delete account"
        description="Permanently removes your profile, services, and bookings."
        danger
      >
        <button
          type="button"
          disabled
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 text-[13px] font-bold text-[#B91C1C] disabled:opacity-70"
        >
          <Trash2 className="size-4" /> Delete account
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-[#6B7280]">
            Soon
          </span>
        </button>
      </SettingsPanel>
    </form>
  );
}

function SecuritySection({
  user,
  onUserUpdated,
}: {
  user: PublicUser | null;
  onUserUpdated: (user: PublicUser) => void;
}) {
  return (
    <>
      <SettingsPanel
        eyebrow="Security"
        title={user?.hasPassword ? "Password" : "Add a password"}
        description={
          user?.hasPassword
            ? "Change the password used to sign in."
            : "Add email-and-password sign-in to your Google account."
        }
      >
        <PasswordForm user={user} onUserUpdated={onUserUpdated} />
      </SettingsPanel>
      <SettingsPanel
        eyebrow="Security"
        title="Active sessions"
        description="Sign out of every device you don't recognise."
      >
        <button
          type="button"
          disabled
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-70"
        >
          <LogOut className="size-4" /> Revoke other sessions
          <span className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] text-[#6B7280]">
            Soon
          </span>
        </button>
      </SettingsPanel>
      <SettingsPanel
        eyebrow="Security"
        title="Two-factor authentication"
        description="Add an extra layer of security at sign-in."
      >
        <div className="flex items-start gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
          <ShieldCheck className="mt-0.5 size-5 text-amber-600" />
          <p className="text-[13px] leading-[1.6] text-[#92400E]">
            Two-factor is on the way. For now, use a unique password and keep
            your inbox protected.
          </p>
        </div>
      </SettingsPanel>
    </>
  );
}

function PasswordForm({
  user,
  onUserUpdated,
}: {
  user: PublicUser | null;
  onUserUpdated: (user: PublicUser) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const hasPassword = Boolean(user?.hasPassword);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

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
      event.currentTarget.reset();
      toast.success(hasPassword ? "Password changed" : "Password added");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not update password",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return <p className="text-sm text-[#6B7280]">Loading security settings...</p>;
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {hasPassword ? (
        <PasswordField
          label="Current password"
          name="currentPassword"
          autoComplete="current-password"
          show={showPasswords}
        />
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4">
          <ShieldCheck className="mt-0.5 size-5 text-[#2563EB]" />
          <p className="text-[13px] leading-[1.6] text-[#1E3A8A]">
            You currently sign in with Google. Add a password to also sign in
            with your email address.
          </p>
        </div>
      )}
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
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 text-[12px] font-bold text-[#374151] hover:bg-[#F9FAFB]"
        >
          {showPasswords ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
          {showPasswords ? "Hide passwords" : "Show passwords"}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          {saving
            ? "Saving..."
            : hasPassword
              ? "Change password"
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
      <span className="text-sm font-bold">{label}</span>
      <input
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={8}
        className="mt-2 h-12 w-full rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-4 outline-none placeholder:text-[#9CA3AF] focus:border-[#FF6267] focus:ring-4 focus:ring-[#FF6267]/10"
      />
    </label>
  );
}

function NotificationsSection() {
  const items = [
    {
      key: "host_confirm",
      title: "New booking confirmations",
      sub: "Email when a guest confirms a new booking.",
      defaultOn: true,
    },
    {
      key: "guest_cancel",
      title: "Guest cancellation notices",
      sub: "Email when a guest cancels their booking.",
      defaultOn: true,
    },
    {
      key: "reminders",
      title: "Reminder emails (host & guest)",
      sub: "Send everyone a friendly reminder before the appointment.",
      defaultOn: true,
    },
    {
      key: "marketing",
      title: "Product updates",
      sub: "Get an occasional email about new Bookvella features.",
      defaultOn: false,
    },
  ];

  return (
    <SettingsPanel
      eyebrow="Notifications"
      title="Email notifications"
      description="Choose what Bookvella emails you about."
    >
      <ul className="divide-y divide-[#EEE7DF] rounded-xl border border-[#EEE7DF] bg-white">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start justify-between gap-4 p-4"
          >
            <div>
              <p className="text-[14px] font-bold">{item.title}</p>
              <p className="mt-0.5 text-[12px] text-[#6B7280]">{item.sub}</p>
            </div>
            <ToggleStub defaultOn={item.defaultOn} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-[#9CA3AF]">
        SMS reminders are coming soon. For now we send branded email reminders
        in your guests&apos; timezone.
      </p>
    </SettingsPanel>
  );
}

function CalendarSection() {
  return (
    <SettingsPanel
      eyebrow="Calendar"
      title="Connect a calendar"
      description="Bookvella will read busy time and write confirmed bookings."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <CalendarOption
          title="Google Calendar"
          sub="Two-way sync with your Google calendar."
          gradient="from-[#4285F4] via-[#34A853] to-[#FBBC05]"
        />
        <CalendarOption
          title="Microsoft Outlook"
          sub="Two-way sync with Outlook / Microsoft 365."
          gradient="from-[#0078D4] to-[#106EBE]"
        />
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#E1CFFA] bg-[#F8F1FF] p-4">
        <Calendar className="mt-0.5 size-4 text-[#7C4DFF]" />
        <p className="text-[13px] leading-[1.6] text-[#374151]">
          Calendar sync is on the roadmap. Until it ships, Bookvella enforces
          your weekly availability and date overrides — no double-bookings from
          inside Bookvella.
        </p>
      </div>
    </SettingsPanel>
  );
}

function CalendarOption({
  title,
  sub,
  gradient,
}: {
  title: string;
  sub: string;
  gradient: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#EEE7DF] bg-white p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-white ${gradient}`}
        >
          <Calendar className="size-4" />
        </span>
        <div>
          <p className="text-[14px] font-bold">{title}</p>
          <p className="text-[11px] text-[#6B7280]">{sub}</p>
        </div>
      </div>
      <button
        type="button"
        disabled
        className="inline-flex h-9 items-center rounded-lg border border-[#E5E7EB] bg-white px-3 text-[12px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-70"
      >
        Connect
        <span className="ml-1.5 rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] text-[#6B7280]">
          Soon
        </span>
      </button>
    </div>
  );
}

function DataSection() {
  return (
    <>
      <SettingsPanel
        eyebrow="Data & privacy"
        title="Export your data"
        description="Download a CSV of your bookings and guest list."
      >
        <button
          type="button"
          disabled
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-70"
        >
          Export bookings.csv
          <span className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] text-[#6B7280]">
            Soon
          </span>
        </button>
      </SettingsPanel>
      <SettingsPanel
        eyebrow="Data & privacy"
        title="What guests see"
        description="Guests only see what's needed to confirm a booking."
      >
        <div className="flex items-start gap-3 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
          <AlertCircle className="mt-0.5 size-4 text-[#9CA3AF]" />
          <p className="text-[13px] leading-[1.6] text-[#374151]">
            Guests see your name, profile photo, services, and public profile
            URL. They never see your private calendar events or other guests.
          </p>
        </div>
      </SettingsPanel>
    </>
  );
}

function SettingsPanel({
  eyebrow,
  title,
  description,
  children,
  danger,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={
        danger
          ? "rounded-2xl border border-[#FECACA] bg-white p-6 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]"
          : "rounded-2xl border border-[#EEE7DF] bg-white p-6 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]"
      }
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[18px] font-bold">{title}</h2>
      <p className="mt-1 text-[13px] text-[#6B7280]">{description}</p>
      <div className="mt-5 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  hint,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        className="mt-2 h-12 w-full rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-4 outline-none placeholder:text-[#9CA3AF] focus:border-[#FF6267] focus:ring-4 focus:ring-[#FF6267]/10 disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#6B7280]"
      />
      {hint ? (
        <span className="mt-1 block text-xs text-[#9CA3AF]">{hint}</span>
      ) : null}
    </label>
  );
}

function ToggleStub({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      onClick={() => setOn((value) => !value)}
      aria-pressed={on}
      className={
        on
          ? "relative h-6 w-11 rounded-full bg-[#FF5F63] transition"
          : "relative h-6 w-11 rounded-full bg-[#E5E7EB] transition"
      }
    >
      <span
        className={
          on
            ? "absolute left-6 top-0.5 size-5 rounded-full bg-white shadow"
            : "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow"
        }
      />
    </button>
  );
}

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
