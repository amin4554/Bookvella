"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { apiRequest, AuthResponse, saveAuthSession } from "@/lib/api";

type AuthCardProps = {
  mode: "login" | "register";
  state?: "default" | "error" | "loading";
};

export function AuthCard({ mode, state = "default" }: AuthCardProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    state === "error" ? "Please check your details and try again." : null,
  );
  const isRegister = mode === "register";
  const loading = submitting || state === "loading";
  const buttonText = loading
    ? isRegister
      ? "Creating page..."
      : "Signing in..."
    : isRegister
      ? "Create my free Bookvella page"
      : "Sign in to Bookvella";

  return (
    <main className="min-h-screen bg-white text-[#111827] lg:grid lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-[#FF6865] via-[#FF8B52] to-[#A855F7] px-16 py-14 text-white lg:flex lg:flex-col">
        <div className="absolute right-[-120px] top-[-160px] size-[520px] rounded-full bg-white/10" />
        <div className="absolute bottom-[-170px] left-[-130px] size-[430px] rounded-full bg-white/10" />
        <div className="relative z-10">
          <BrandLogo inverse />
        </div>
        <div className="relative z-10 my-auto max-w-[540px]">
          <h1 className="text-[52px] font-bold leading-[1.12] tracking-normal">
            {isRegister ? "Get booked. For free. Forever." : "Your booking page, live in 5 minutes."}
          </h1>
          <p className="mt-7 max-w-[440px] text-xl leading-8 text-white/90">
            {isRegister
              ? "Create your profile, set your hours, share one link. No subscription, no commission, no catch."
              : "Join barbers, coaches, tutors, and everyday service providers who use Bookvella to get booked."}
          </p>
        </div>
        <div className="relative z-10 rounded-[24px] border border-white/30 bg-white/10 p-7 backdrop-blur">
          <p className="text-lg italic text-white/90">
            I shared my Bookvella link and had bookings within the first hour.
          </p>
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-white/25 font-bold">
                M
              </div>
              <div>
                <p className="font-bold">Marcus Williams</p>
                <p className="text-sm text-white/75">Service provider</p>
              </div>
            </div>
            <span className="text-amber-300">*****</span>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-white px-5 py-10">
        <div className="w-full max-w-[500px]">
          <div className="mb-10 lg:hidden">
            <BrandLogo />
          </div>
          <h1 className="text-[34px] font-bold leading-tight">
            {isRegister ? "Create your free page" : "Welcome back"}
          </h1>
          <p className="mt-2 text-base text-[#6B7280]">
            {isRegister ? "Already have an account?" : "Sign in to your Bookvella account"}
            <Link
              href={isRegister ? "/login" : "/register"}
              className="ml-1 font-bold text-[#FF5F63] hover:underline"
            >
              {isRegister ? "Sign in here" : "create one free"}
            </Link>
          </p>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            {isRegister ? (
              <Field label="Full name" name="name" placeholder="Marcus Williams" invalid={Boolean(error)} />
            ) : null}
            <Field
              label="Email address"
              name="email"
              placeholder="marcus@barbershop.co.uk"
              invalid={Boolean(error)}
              type="email"
            />
            <Field label="Password" name="password" placeholder="Enter your password" type="password" />
            {isRegister ? (
              <>
                <div>
                  <Field label="Your booking link" name="slug" placeholder="marcus-williams" />
                  <p className="mt-1 text-xs text-[#6B7280]">bookvella.com/your-link</p>
                </div>
                <label className="block">
                  <span className="text-sm font-bold uppercase tracking-wide text-[#111827]">Timezone</span>
                  <select
                    name="timezone"
                    defaultValue={guessTimezone()}
                    className="mt-2 h-11 w-full rounded-2xl border border-[#E8DED7] bg-[#FFFBF7] px-4 text-sm text-[#111827] outline-none focus:border-[#FF5F63] focus:ring-4 focus:ring-[#FF5F63]/10"
                  >
                    <option>America / New_York (UTC-5)</option>
                    <option>Europe / Berlin (UTC+1)</option>
                    <option>UTC</option>
                  </select>
                </label>
              </>
            ) : null}

            <Button
              className="mt-2 h-12 w-full rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-base font-bold text-white shadow-none hover:opacity-95"
              disabled={loading}
            >
              {buttonText}
            </Button>
          </form>

          <div className="mt-10 flex flex-wrap gap-3 text-sm text-[#6B7280]">
            {["Barbers", "Comedians", "Trainers", "Tutors", "Nail artists", "Musicians"].map((item) => (
              <span key={item} className="rounded-full border border-[#E8DED7] bg-[#FFFBF7] px-4 py-2 font-semibold">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const session = await apiRequest<AuthResponse>(
        isRegister ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(
            isRegister
              ? {
                  name: readFormText(form, "name"),
                  email: readFormText(form, "email"),
                  password: readFormText(form, "password"),
                  timezone: normalizeTimezone(readFormText(form, "timezone")),
                  slug: readOptionalFormText(form, "slug"),
                }
              : {
                  email: readFormText(form, "email"),
                  password: readFormText(form, "password"),
                },
          ),
        },
      );

      saveAuthSession(session);
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  invalid = false,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold uppercase tracking-wide text-[#111827]">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        minLength={type === "password" ? 8 : undefined}
        className={`mt-2 h-11 w-full rounded-2xl border bg-[#FFFBF7] px-4 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#FF5F63] focus:ring-4 focus:ring-[#FF5F63]/10 ${
          invalid ? "border-red-300" : "border-[#E8DED7]"
        }`}
      />
    </label>
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

function normalizeTimezone(value: string) {
  if (value.startsWith("America / New_York")) {
    return "America/New_York";
  }
  if (value.startsWith("Europe / Berlin")) {
    return "Europe/Berlin";
  }
  return value || "UTC";
}

function guessTimezone() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (timezone === "Europe/Berlin") {
    return "Europe / Berlin (UTC+1)";
  }
  if (timezone === "America/New_York") {
    return "America / New_York (UTC-5)";
  }
  return "UTC";
}
