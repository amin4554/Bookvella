"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LegalInlineLinks } from "@/components/legal-footer";
import { apiRequest } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = form.get("email");

    try {
      await apiRequest<{ success: boolean; message: string }>(
        "/auth/password/forgot",
        {
          method: "POST",
          body: JSON.stringify({
            email: typeof email === "string" ? email.trim() : "",
          }),
        },
      );
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not send reset email",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface-page px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[480px] flex-col">
        <Link href="/" className="inline-flex items-center gap-2.5 self-start">
          <BrandLogo />
        </Link>

        <section className="my-auto rounded-2xl border border-line-cream bg-surface-card p-6 shadow-[0_24px_80px_-40px_rgba(17,24,39,0.28)]">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[13px] font-bold text-ink-soft hover:text-ink-strong"
          >
            <ArrowLeft className="size-4" /> Back to sign in
          </Link>

          <div className="mt-7">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-tint-200 text-brand">
              {sent ? <CheckCircle2 className="size-5" /> : <Mail className="size-5" />}
            </span>
            <h1 className="mt-5 text-[34px] font-extrabold leading-none">
              Reset your password
            </h1>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Enter your email and we will send a link that works for 30
              minutes.
            </p>
          </div>

          {sent ? (
            <div className="mt-6 rounded-2xl border border-success-border bg-success-tint p-4 text-[13px] leading-6 text-success-deep">
              If that email belongs to a Bookvella account, a reset link has
              been sent.
            </div>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={submit}>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
                  Email address
                </span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@studio.com"
                  className="mt-1.5 h-12 w-full rounded-2xl border border-line-soft bg-surface-card px-4 text-[15px] font-medium outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]"
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-danger-border bg-danger-tint p-3.5 text-[13px] text-danger-deep">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-coral to-brand-orange text-[15px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-70"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}
        </section>

        <LegalInlineLinks className="mt-6 justify-center" />
      </div>
    </main>
  );
}
