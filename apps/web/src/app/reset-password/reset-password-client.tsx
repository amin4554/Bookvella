"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LegalInlineLinks } from "@/components/legal-footer";
import { apiRequest } from "@/lib/api";

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const newPassword = readText(form, "newPassword");
    const confirmPassword = readText(form, "confirmPassword");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      setSubmitting(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setSubmitting(false);
      return;
    }

    try {
      await apiRequest<{ success: boolean }>("/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setComplete(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not reset password",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFFBF7] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[480px] flex-col">
        <Link href="/" className="inline-flex items-center gap-2.5 self-start">
          <BrandLogo />
        </Link>

        <section className="my-auto rounded-2xl border border-[#EEE7DF] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(17,24,39,0.28)]">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[13px] font-bold text-[#6B7280] hover:text-[#0B1220]"
          >
            <ArrowLeft className="size-4" /> Back to sign in
          </Link>

          <div className="mt-7">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#FFEDEA] text-[#FF5F63]">
              {complete ? <CheckCircle2 className="size-5" /> : <KeyRound className="size-5" />}
            </span>
            <h1 className="mt-5 text-[34px] font-extrabold leading-none">
              Choose a new password
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              After reset, old sessions are signed out and you can sign in with
              the new password.
            </p>
          </div>

          {!token ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] leading-6 text-red-800">
              This reset link is missing its token. Request a new password reset.
            </div>
          ) : complete ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] leading-6 text-emerald-900">
                Your password has been reset.
              </div>
              <Link
                href="/login"
                className="block h-14 rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 py-4 text-center text-[15px] font-bold text-white shadow-sm hover:brightness-105"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={submit}>
              <PasswordInput label="New password" name="newPassword" />
              <PasswordInput label="Confirm password" name="confirmPassword" />

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-800">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-[15px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-70"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {submitting ? "Saving..." : "Reset password"}
              </button>
            </form>
          )}
        </section>

        <LegalInlineLinks className="mt-6 justify-center" />
      </div>
    </main>
  );
}

function PasswordInput({ label, name }: { label: string; name: string }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#6B7280]">
        {label}
      </span>
      <input
        name={name}
        type="password"
        autoComplete="new-password"
        minLength={8}
        className="mt-1.5 h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[15px] font-medium outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]"
      />
    </label>
  );
}

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
