"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Circle,
  Eye,
  EyeOff,
  Globe,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LegalInlineLinks } from "@/components/legal-footer";
import { OtpStep } from "@/components/otp-step";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import {
  type ApiError,
  apiRequest,
  AuthResponse,
  authedApiRequest,
  checkSlugAvailability,
  getAuthSession,
  saveAuthSession,
  type PublicUser,
  type SlugAvailability,
  updateStoredUser,
} from "@/lib/api";
import {
  detectBrowserTimezone,
  formatOffset,
  timezoneCity,
} from "@/lib/timezones";

type AuthCardProps = {
  mode: "login" | "register";
  state?: "default" | "error" | "loading";
  message?: string;
  redirectTo?: string;
};

type GoogleCredentialHandler = (credential?: string) => void | Promise<void>;

let initializedGoogleClientId: string | null = null;
let googleCredentialHandler: GoogleCredentialHandler | null = null;

export function AuthCard({
  mode,
  state = "default",
  message,
  redirectTo,
}: AuthCardProps) {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    message ??
      (state === "error" ? "Please check your details and try again." : null),
  );
  const [showPassword, setShowPassword] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(
    Boolean(message?.toLowerCase().includes("session")),
  );
  // Defaults to checked because the historical behaviour was always-90-day
  // sessions. Unchecking now flips to a 12-hour session-scope cookie.
  const [rememberMe, setRememberMe] = useState(true);
  // Mirror into a ref so the Google sign-in callback — which is bound once on
  // mount — always reads the latest value without forcing a button re-render.
  const rememberMeRef = useRef(rememberMe);
  const [pendingTotp, setPendingTotp] = useState<
    | null
    | {
        email: string;
        password: string;
      }
  >(null);
  // After the email/password sign-up form is submitted we keep the user on the
  // register card with this OTP step visible. The actual user creation only
  // happens after the code is verified.
  const [pendingSignupOtp, setPendingSignupOtp] = useState<
    | null
    | {
        email: string;
        expiresAt: string | null;
        // Cached register-form payload so we can resend the code without
        // forcing the user to retype everything.
        request: {
          name: string;
          email: string;
          password: string;
          timezone: string;
          slug?: string;
        };
      }
  >(null);
  const [signupOtpCode, setSignupOtpCode] = useState("");
  const isRegister = mode === "register";
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  void state;

  useEffect(() => {
    rememberMeRef.current = rememberMe;
  }, [rememberMe]);

  useEffect(() => {
    let active = true;

    async function redirectIfAlreadySignedIn() {
      if (!getAuthSession()) return;

      try {
        const user = await authedApiRequest<PublicUser>("/auth/me");
        updateStoredUser(user);
        if (active) {
          router.replace(safeRedirect(redirectTo));
        }
      } catch {
        // Stay on the auth page if the saved session is stale.
      }
    }

    redirectIfAlreadySignedIn();
    return () => {
      active = false;
    };
  }, [redirectTo, router]);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    const scriptId = "google-identity-services";
    let active = true;

    const handleCredential: GoogleCredentialHandler = async (credential) => {
      if (!active) return;

      if (!credential) {
        setError("Google sign-in did not return a credential");
        return;
      }

      setGoogleLoading(true);
      setError(null);

      try {
        const session = await apiRequest<AuthResponse>("/auth/google", {
          method: "POST",
          body: JSON.stringify({
            credential,
            timezone: guessTimezoneValue(),
            // Reuse the same checkbox value the user picked on the login
            // form. On /register the checkbox is hidden so we default true.
            rememberMe: isRegister ? true : rememberMeRef.current,
          }),
        });

        if (!active) return;

        saveAuthSession(session);
        router.push(safeRedirect(redirectTo));
      } catch (caught) {
        if (!active) return;

        setError(
          caught instanceof Error ? caught.message : "Google sign-in failed",
        );
      } finally {
        if (active) {
          setGoogleLoading(false);
        }
      }
    };

    googleCredentialHandler = handleCredential;

    function renderGoogleButton() {
      if (!active) return;

      const google = window.google;
      const clientId = googleClientId;

      if (!google || !googleButtonRef.current || !clientId) return;

      if (initializedGoogleClientId !== clientId) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            void googleCredentialHandler?.(credential);
          },
        });
        initializedGoogleClientId = clientId;
      }

      // Match the full form width so the Google row aligns with the divider,
      // inputs, and primary actions below it.
      googleButtonRef.current.replaceChildren();
      const measured = googleButtonRef.current.offsetWidth;
      const buttonWidth = Math.max(280, Math.round(measured || 440));
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        type: "standard",
        shape: "pill",
        text: isRegister ? "signup_with" : "signin_with",
        logo_alignment: "center",
        width: buttonWidth,
      });
    }

    const cleanup = () => {
      active = false;
      if (googleCredentialHandler === handleCredential) {
        googleCredentialHandler = null;
      }
    };

    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      if (window.google) {
        renderGoogleButton();
        return cleanup;
      }

      existing.addEventListener("load", renderGoogleButton);
      return () => {
        existing.removeEventListener("load", renderGoogleButton);
        cleanup();
      };
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);

    return cleanup;
  }, [googleClientId, isRegister, router, redirectTo]);

  const formNode = isRegister ? (
    pendingSignupOtp ? (
      <OtpStep
        title="Confirm your email"
        recipient={pendingSignupOtp.email}
        expiresAt={pendingSignupOtp.expiresAt}
        value={signupOtpCode}
        onChange={setSignupOtpCode}
        onSubmit={handleSignupOtpSubmit}
        onResend={handleSignupOtpResend}
        onBack={() => {
          setPendingSignupOtp(null);
          setSignupOtpCode("");
          setError(null);
        }}
        backLabel="← Use a different email"
        submitLabel="Confirm and create my page →"
        submittingLabel="Creating account…"
        submitting={submitting}
        error={error}
        accent="register"
        theme="card"
        helper="Tip: codes can land in spam. Resend if it hasn't arrived in a minute."
      />
    ) : (
      <RegisterForm
        submitting={submitting}
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((value) => !value)}
        onSubmit={handleSubmit}
        error={error}
      />
    )
  ) : pendingTotp ? (
    <TotpStep
      submitting={submitting}
      error={error}
      onSubmit={handleTotpSubmit}
      onCancel={() => {
        setPendingTotp(null);
        setError(null);
      }}
    />
  ) : (
    <LoginForm
      submitting={submitting}
      showPassword={showPassword}
      onTogglePassword={() => setShowPassword((value) => !value)}
      onSubmit={handleSubmit}
      error={error}
      sessionExpired={sessionExpired}
      onDismissSessionExpired={() => setSessionExpired(false)}
      rememberMe={rememberMe}
      onRememberMeChange={setRememberMe}
    />
  );

  const headerCopy = isRegister ? (
    <>
      <h1
        className="text-[42px] font-extrabold md:text-[52px]"
        style={{ letterSpacing: "-0.035em", lineHeight: "0.98" }}
      >
        Create your free page
      </h1>
      <p className="mt-4 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand hover:underline"
        >
          Sign in here
        </Link>
      </p>
    </>
  ) : (
    <>
      <h1
        className="text-[44px] font-extrabold md:text-[52px]"
        style={{ letterSpacing: "-0.035em", lineHeight: "0.98" }}
      >
        Welcome back
      </h1>
      <p className="mt-4 text-sm text-ink-soft">
        Sign in to your Bookvella account
      </p>
    </>
  );

  const loginSignupCta =
    !isRegister && !pendingTotp ? (
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line-cream" />
          <span className="text-xs font-semibold text-ink-muted">
            New to Bookvella?
          </span>
          <span className="h-px flex-1 bg-line-cream" />
        </div>
        <Link
          href="/register"
          className="mt-8 flex h-14 w-full items-center justify-center rounded-2xl border border-line-soft bg-surface-card text-sm font-bold text-ink-strong hover:bg-surface-soft dark:bg-surface-soft dark:hover:bg-surface-blush"
        >
          Create your free booking page &rarr;
        </Link>
      </div>
    ) : null;

  const formColumn = (
    <div className="relative flex flex-col bg-surface-card px-6 py-10 sm:px-10 lg:px-16 lg:py-14 dark:bg-surface-page">
      <Link
        href="/"
        className="inline-flex items-center gap-2.5 self-start lg:hidden"
      >
        <BrandLogo />
      </Link>

      <div className="mx-auto mt-10 w-full max-w-[440px] lg:mt-16">
        {headerCopy}

        <div className="mt-9">
          {googleClientId ? (
            // GIS renders a fixed-pixel-wide button. The flex wrapper centers
            // it inside the form column so it lines up with the inputs below.
            <div
              className={`flex w-full justify-center ${
                googleLoading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <div ref={googleButtonRef} className="w-full" />
            </div>
          ) : (
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-line-soft bg-surface-card text-sm font-semibold text-ink-deep hover:bg-surface-soft dark:bg-surface-soft dark:hover:bg-surface-blush"
              onClick={() =>
                setError(
                  "Add NEXT_PUBLIC_GOOGLE_CLIENT_ID in the web app and GOOGLE_CLIENT_ID in the API to enable Google sign-in.",
                )
              }
            >
              <GoogleMark />
              Continue with Google
            </button>
          )}
        </div>

        <div className="my-7 flex items-center gap-3">
          <span className="h-px flex-1 bg-line-cream" />
          <span className="text-xs font-semibold text-ink-muted">
            or with email
          </span>
          <span className="h-px flex-1 bg-line-cream" />
        </div>

        {formNode}
        {loginSignupCta}
      </div>

      <p className="mt-14 text-center text-[11px] text-ink-muted lg:mt-auto lg:pt-14 lg:text-left">
        Copyright 2026 Bookvella. Made for independent pros.
      </p>
      <LegalInlineLinks className="mt-2 justify-center lg:justify-start" />
    </div>
  );

  const gradientColumn = isRegister ? (
    <RegisterGradientPanel />
  ) : (
    <LoginGradientPanel />
  );

  return (
    <>
      <ThemeToggleButton className="fixed right-[18px] top-[18px] z-50 size-10 rounded-[14px] bg-surface-card shadow-sm dark:border-line-soft dark:bg-surface-card/95 dark:hover:bg-surface-soft" />
      <main
        className={`grid min-h-screen ${
          isRegister
            ? "lg:grid-cols-[1.1fr_1fr]"
            : "lg:grid-cols-[1fr_1.05fr]"
        }`}
      >
        {isRegister ? formColumn : gradientColumn}
        {isRegister ? gradientColumn : formColumn}
      </main>
    </>
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      if (isRegister) {
        // Sign-up no longer creates the user in one shot — request an OTP and
        // hand off to the SignupOtpStep below to finish the flow.
        const request = {
          name: buildFullName(
            readFormText(form, "firstName"),
            readFormText(form, "lastName"),
          ),
          email: readFormText(form, "email"),
          password: readFormText(form, "password"),
          timezone:
            readOptionalFormText(form, "timezone") ?? guessTimezoneValue(),
          slug: readOptionalFormText(form, "slug"),
        };
        const response = await apiRequest<{
          success: boolean;
          email: string;
          expiresAt: string;
        }>("/auth/register/otp/request", {
          method: "POST",
          body: JSON.stringify(request),
        });
        setPendingSignupOtp({
          email: response.email,
          expiresAt: response.expiresAt,
          request,
        });
        setError(null);
        return;
      }

      const body = {
        email: readFormText(form, "email"),
        password: readFormText(form, "password"),
        rememberMe,
      };

      const session = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });

      saveAuthSession(session);
      router.push(safeRedirect(redirectTo));
    } catch (caught) {
      if (!isRegister && isTotpRequired(caught)) {
        setPendingTotp({
          email: readFormText(form, "email"),
          password: readFormText(form, "password"),
        });
        setError(null);
      } else {
        setError(
          caught instanceof Error ? caught.message : "Something went wrong",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignupOtpSubmit(code: string) {
    if (!pendingSignupOtp) return;
    if (code.length !== 6) return;
    setError(null);
    setSubmitting(true);
    try {
      const session = await apiRequest<AuthResponse>(
        "/auth/register/otp/verify",
        {
          method: "POST",
          body: JSON.stringify({
            email: pendingSignupOtp.email,
            code,
            rememberMe: true,
          }),
        },
      );
      saveAuthSession(session);
      router.push(safeRedirect(redirectTo));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Code is invalid or expired",
      );
      // Clear the input so the user can retype without grabbing the mouse —
      // OtpStep auto-focuses the first cell whenever value becomes empty.
      setSignupOtpCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignupOtpResend() {
    if (!pendingSignupOtp) return;
    setError(null);
    try {
      const response = await apiRequest<{
        success: boolean;
        email: string;
        expiresAt: string;
      }>("/auth/register/otp/request", {
        method: "POST",
        body: JSON.stringify(pendingSignupOtp.request),
      });
      setPendingSignupOtp({
        ...pendingSignupOtp,
        expiresAt: response.expiresAt,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not resend the code",
      );
    }
  }

  async function handleTotpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingTotp) return;
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const totpCode = readFormText(form, "totpCode");

    try {
      const session = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: pendingTotp.email,
          password: pendingTotp.password,
          totpCode,
          rememberMe,
        }),
      });

      saveAuthSession(session);
      router.push(safeRedirect(redirectTo));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Invalid two-factor authentication code",
      );
    } finally {
      setSubmitting(false);
    }
  }
}

function isTotpRequired(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const apiError = error as ApiError;
  const body = apiError.body;
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return (
    record.errorCode === "TOTP_REQUIRED" || record.requiresTwoFactor === true
  );
}

function TotpStep({
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="rounded-2xl border border-line-cream bg-surface-page p-4 text-[13px] text-ink-body">
        <p className="font-bold text-ink-strong">
          Two-factor authentication
        </p>
        <p className="mt-1">
          Enter the 6-digit code from your authenticator app, or a backup code
          if you&apos;ve lost access.
        </p>
      </div>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
          Code
        </span>
        <input
          name="totpCode"
          required
          inputMode="text"
          autoComplete="one-time-code"
          autoFocus
          placeholder="123456"
          className="mt-1.5 h-12 w-full rounded-2xl border border-line-soft bg-surface-card px-4 text-center text-[20px] font-bold tracking-[0.4em] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)] dark:bg-surface-card"
        />
      </label>
      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-danger-border bg-danger-tint p-3.5 text-[13px] text-danger-deep">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p>{error}</p>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="h-14 w-full rounded-2xl bg-gradient-to-r from-brand-coral to-brand-orange text-[15px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-70"
      >
        {submitting ? "Verifying..." : "Verify and sign in →"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="block w-full text-center text-[13px] font-semibold text-ink-soft hover:text-ink-strong"
      >
        ← Use a different account
      </button>
    </form>
  );
}

function LoginForm({
  submitting,
  showPassword,
  onTogglePassword,
  onSubmit,
  error,
  sessionExpired,
  onDismissSessionExpired,
  rememberMe,
  onRememberMeChange,
}: {
  submitting: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  sessionExpired: boolean;
  onDismissSessionExpired: () => void;
  rememberMe: boolean;
  onRememberMeChange: (next: boolean) => void;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {sessionExpired ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning-border bg-warning-tint p-3.5 text-[13px] text-warning-strong">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="flex-1">
            Your session expired. Sign in again to pick up where you left off.
          </p>
          <button
            type="button"
            className="text-warning hover:text-warning-strong"
            onClick={onDismissSessionExpired}
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <FieldLabel label="Email address">
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="marcus@barbershop.co.uk"
          className="mt-1.5 h-12 w-full rounded-2xl border border-line-soft bg-surface-card px-4 text-[15px] font-medium outline-none ring-0 focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)] dark:bg-surface-card"
        />
      </FieldLabel>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
            Password
          </span>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-brand hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative mt-1.5">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            className="h-12 w-full rounded-2xl border border-line-soft bg-surface-card px-4 pr-12 text-[15px] font-medium outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)] dark:bg-surface-card"
          />
          <button
            type="button"
            onClick={onTogglePassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-muted hover:text-ink-deep"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-danger-border bg-danger-tint p-3.5 text-[13px] text-danger-deep">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p>
            <strong className="font-semibold">That didn&apos;t work.</strong>{" "}
            {error}
          </p>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-[13px] text-ink-body">
        <input
          type="checkbox"
          name="rememberMe"
          checked={rememberMe}
          onChange={(event) => onRememberMeChange(event.target.checked)}
          className="size-4 rounded border-line-strong text-brand accent-brand focus:ring-brand"
        />
        Keep me signed in
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="h-14 w-full rounded-2xl bg-gradient-to-r from-brand-coral to-brand-orange text-[15px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-70"
      >
        {submitting ? "Signing in..." : "Sign in to Bookvella →"}
      </button>
    </form>
  );
}

function RegisterForm({
  submitting,
  showPassword,
  onTogglePassword,
  onSubmit,
  error,
}: {
  submitting: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string | null;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const detectedTimezone = useMemo(() => detectBrowserTimezone(), []);
  const [timezone, setTimezone] = useState<string>(detectedTimezone);
  const [editingTimezone, setEditingTimezone] = useState(false);

  const computedSlug = useMemo(
    () => slugify(`${firstName} ${lastName}`),
    [firstName, lastName],
  );
  const slug = customSlug ?? computedSlug;

  // The local "shape" check runs synchronously, so we don't need state for it.
  // Only the network response and in-flight flag need state.
  const localCheck = useMemo<SlugAvailability | null>(() => {
    if (!slug) return null;
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return {
        input: slug,
        normalized: slug,
        available: false,
        reason: "invalid",
      };
    }
    return null;
  }, [slug]);

  const [remoteResult, setRemoteResult] = useState<{
    slug: string;
    value: SlugAvailability | null;
  } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Skip network when the slug is empty or fails the local format check.
    if (!slug || localCheck) {
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      if (cancelled) return;
      setChecking(true);
      try {
        const result = await checkSlugAvailability(slug);
        if (!cancelled) {
          setRemoteResult({ slug, value: result });
        }
      } catch {
        if (!cancelled) setRemoteResult({ slug, value: null });
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [slug, localCheck]);

  const remoteForCurrent =
    remoteResult && remoteResult.slug === slug ? remoteResult.value : null;
  const liveAvailability = localCheck ?? remoteForCurrent;

  const slugStatus: {
    kind: "empty" | "ok" | "bad" | "checking";
    label: string;
  } = !slug
    ? { kind: "empty", label: "Choose a name" }
    : localCheck
      ? { kind: "bad", label: slugReasonLabel(localCheck.reason) }
      : checking || !remoteForCurrent
        ? { kind: "checking", label: "Checking…" }
        : liveAvailability && liveAvailability.available
          ? { kind: "ok", label: "Available" }
          : {
              kind: "bad",
              label: slugReasonLabel(liveAvailability?.reason ?? null),
            };

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="First name">
          <input
            name="firstName"
            type="text"
            autoComplete="given-name"
            placeholder="Marcus"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="mt-1.5 h-12 w-full rounded-2xl border border-line-soft bg-surface-card px-4 text-[15px] font-medium outline-none focus:border-success-teal-bright focus:shadow-[0_0_0_4px_rgba(20,184,166,0.18)] dark:bg-surface-card"
          />
        </FieldLabel>
        <FieldLabel label="Last name">
          <input
            name="lastName"
            type="text"
            autoComplete="family-name"
            placeholder="Williams"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="mt-1.5 h-12 w-full rounded-2xl border border-line-soft bg-surface-card px-4 text-[15px] font-medium outline-none focus:border-success-teal-bright focus:shadow-[0_0_0_4px_rgba(20,184,166,0.18)] dark:bg-surface-card"
          />
        </FieldLabel>
      </div>

      <FieldLabel label="Email address">
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@studio.com"
          className="mt-1.5 h-12 w-full rounded-2xl border border-line-soft bg-surface-card px-4 text-[15px] font-medium outline-none focus:border-success-teal-bright focus:shadow-[0_0_0_4px_rgba(20,184,166,0.18)] dark:bg-surface-card"
        />
      </FieldLabel>

      <FieldLabel label="Password">
        <div className="relative mt-1.5">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            className="h-12 w-full rounded-2xl border border-line-soft bg-surface-card px-4 pr-12 text-[15px] font-medium outline-none focus:border-success-teal-bright focus:shadow-[0_0_0_4px_rgba(20,184,166,0.18)] dark:bg-surface-card"
          />
          <button
            type="button"
            onClick={onTogglePassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-muted hover:text-ink-deep"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-muted">
          8+ characters. Mix letters and numbers.
        </p>
      </FieldLabel>

      <div>
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
          Your booking link
        </span>
        <div className="mt-1.5 flex h-12 items-center overflow-hidden rounded-2xl border border-line-soft bg-surface-card focus-within:border-success-teal-bright focus-within:shadow-[0_0_0_4px_rgba(20,184,166,0.18)] dark:bg-surface-card">
          <span className="flex h-full items-center border-r border-line-soft bg-surface-soft px-4 text-sm font-medium text-ink-soft tabular-nums">
            bookvella.com/
          </span>
          <input
            id="slug"
            name="slug"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={slug}
            onChange={(event) => {
              setCustomSlug(event.target.value.toLowerCase());
            }}
            className="h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] font-semibold tabular-nums outline-none"
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-muted">
            Auto-filled from your name. Lowercase letters, numbers and dashes.
          </p>
          <SlugStatusChip status={slugStatus} />
        </div>
      </div>

      <input type="hidden" name="timezone" value={timezone} />

      {editingTimezone ? (
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
            Your timezone
          </span>
          <div className="mt-1.5">
            <TimezoneCombobox
              value={timezone}
              onChange={(value) => {
                setTimezone(value);
                setEditingTimezone(false);
              }}
              detectedTimezone={detectedTimezone}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setTimezone(detectedTimezone);
              setEditingTimezone(false);
            }}
            className="mt-2 text-[11px] font-semibold text-ink-soft underline-offset-2 hover:underline"
          >
            Use my browser timezone instead
          </button>
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-xl border border-line-soft bg-surface-page px-3 py-2.5 text-[12px] text-ink-soft">
          <Globe className="size-3.5 text-ink-muted" />
          <span className="flex-1">
            Times will use{" "}
            <span className="font-semibold text-ink-strong">
              {timezoneCity(timezone)}
            </span>{" "}
            <span className="tabular-nums text-ink-strong">
              ({formatOffset(timezone)})
            </span>
            .
          </span>
          <button
            type="button"
            onClick={() => setEditingTimezone(true)}
            className="font-semibold text-brand hover:underline"
          >
            Change
          </button>
        </p>
      )}

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-danger-border bg-danger-tint p-3.5 text-[13px] text-danger-deep">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p>{error}</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="auth-register-cta mt-2 h-14 w-full rounded-2xl text-[15px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-70"
      >
        {submitting ? "Creating page..." : "Create my free Bookvella page →"}
      </button>

      <p className="text-center text-[12px] leading-relaxed text-ink-muted">
        By signing up you agree to our{" "}
        <Link href="/legal/terms" className="font-semibold text-ink-strong underline decoration-line-soft underline-offset-2 hover:decoration-ink-strong">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="font-semibold text-ink-strong underline decoration-line-soft underline-offset-2 hover:decoration-ink-strong">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

function SlugStatusChip({
  status,
}: {
  status: { kind: "empty" | "ok" | "bad" | "checking"; label: string };
}) {
  if (status.kind === "ok") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-mint px-2 py-1 text-[10px] font-bold text-success">
        <Check className="size-3" /> {status.label}
      </span>
    );
  }
  if (status.kind === "bad") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-tint-strong px-2 py-1 text-[10px] font-bold text-danger">
        <X className="size-3" /> {status.label}
      </span>
    );
  }
  if (status.kind === "checking") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-line-subtle px-2 py-1 text-[10px] font-bold text-ink-soft">
        <Loader2 className="size-3 animate-spin" /> {status.label}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-line-subtle px-2 py-1 text-[10px] font-bold text-ink-soft">
      <Circle className="size-3" /> {status.label}
    </span>
  );
}

function slugReasonLabel(reason: SlugAvailability["reason"]) {
  switch (reason) {
    case "taken":
      return "Taken";
    case "reserved":
      return "Reserved";
    case "too-short":
      return "Too short";
    case "invalid":
      return "Invalid chars";
    default:
      return "Unavailable";
  }
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}

function LoginGradientPanel() {
  return (
    <aside className="relative hidden overflow-hidden text-white lg:flex">
      <div
        className="absolute inset-0"
        style={{
          background: "var(--auth-login-side-grad)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-20 top-12 h-[420px] w-[420px] rounded-full opacity-30"
        style={{
          background: "var(--auth-login-glow-1)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-[440px] w-[440px] rounded-full opacity-30"
        style={{
          background: "var(--auth-login-glow-2)",
        }}
      />

      <div className="relative z-10 flex w-full flex-col px-12 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 self-start rounded-2xl border border-white/20 bg-white/15 px-3 py-2 backdrop-blur"
        >
          <BrandLogo inverse />
        </Link>

        <div className="mt-24">
          <h2
            className="text-[60px] font-extrabold xl:text-[76px]"
            style={{ letterSpacing: "-0.035em", lineHeight: "0.98" }}
          >
            Your booking
            <br />
            page, live in
            <br />
            5 minutes.
          </h2>
          <p className="mt-7 max-w-[440px] text-[17px] leading-[1.6] text-white/90">
            Join thousands of barbers, comedians, trainers and everyday service
            providers who use Bookvella to get booked — for free.
          </p>
        </div>

        <figure className="mt-auto max-w-[440px] rounded-2xl border border-white/20 bg-white/15 p-5 backdrop-blur">
          <span className="text-sm text-amber-300">★★★★★</span>
          <blockquote className="mt-3 text-[15px] leading-[1.6]">
            &ldquo;I shared my Bookvella link on Instagram and had 6 bookings
            within the first hour. It just works.&rdquo;
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-coral via-purple-vivid to-purple-strong text-sm font-bold text-white">
              M
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Marcus Williams</p>
              <p className="text-xs text-white/80">Master Barber · London</p>
            </div>
          </figcaption>
        </figure>
      </div>
    </aside>
  );
}

function RegisterGradientPanel() {
  return (
    <aside className="relative hidden overflow-hidden text-white lg:flex">
      <div
        className="absolute inset-0"
        style={{
          background: "var(--auth-register-side-grad)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-24 top-12 h-[420px] w-[420px] rounded-full opacity-30"
        style={{
          background: "var(--auth-register-glow-1)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-20 h-[440px] w-[440px] rounded-full opacity-30"
        style={{
          background: "var(--auth-register-glow-2)",
        }}
      />

      <div className="relative z-10 flex w-full flex-col px-12 py-12">
        <div className="flex items-center justify-end">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/15 px-3 py-2 backdrop-blur"
          >
            <BrandLogo inverse />
          </Link>
        </div>

        <div className="mt-24">
          <h2
            className="text-[64px] font-extrabold xl:text-[80px]"
            style={{ letterSpacing: "-0.035em", lineHeight: "0.98" }}
          >
            Get booked.
            <br />
            For free.
            <br />
            Forever.
          </h2>
          <p className="mt-7 max-w-[440px] text-[17px] leading-[1.6] text-white/90">
            Create your profile, set your hours, share one link. That&apos;s it.
            No subscription, no commission, no catch.
          </p>
        </div>

        <div className="mt-10 max-w-[420px] rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-coral via-purple-vivid to-purple-strong text-sm font-bold text-white">
              M
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Marcus Williams</p>
              <p className="text-[11px] text-white/80">
                bookvella.com/marcus · ★ 4.9 (312)
              </p>
            </div>
            <span className="ml-auto rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold">
              +4 booked today
            </span>
          </div>
        </div>

        <ol className="mt-auto space-y-4 pt-10">
          <Step n={1} title="Create your profile" text="Add your services and set weekly availability in minutes." />
          <Step n={2} title="Share your link" text="Post it anywhere. Guests book without needing an account." />
          <Step n={3} title="Earn reviews automatically" text="Guests get a rating email after every appointment." />
        </ol>
      </div>
    </aside>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
        {n}
      </span>
      <div>
        <p className="text-[15px] font-bold">{title}</p>
        <p className="text-[13px] text-white/80">{text}</p>
      </div>
    </li>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.614Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function readFormText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalFormText(form: FormData, key: string) {
  const value = readFormText(form, key);
  return value ? value : undefined;
}

function buildFullName(first: string, last: string) {
  return [first, last].filter(Boolean).join(" ").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function guessTimezoneValue() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function safeRedirect(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme: string;
              size: string;
              type: string;
              shape: string;
              text: string;
              width: number;
              logo_alignment?: string;
            },
          ) => void;
        };
      };
    };
  }
}
