"use client";

import { FormEvent, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Check, Send } from "lucide-react";
import { apiRequest } from "@/lib/api";

const TOPICS = [
  { value: "general", label: "General question" },
  { value: "bug", label: "Bug report" },
  { value: "privacy", label: "Privacy / data request" },
  { value: "illegal", label: "Report illegal content" },
  { value: "other", label: "Other" },
] as const;

type Topic = (typeof TOPICS)[number]["value"];

type FormErrors = Partial<{
  name: string;
  email: string;
  contentUrl: string;
  message: string;
  consent: string;
  form: string;
}>;

export function ContactReportForm() {
  const [topic, setTopic] = useState<Topic>("general");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = {
      topic,
      name: readText(form, "name"),
      email: readText(form, "email"),
      contentUrl: readText(form, "contentUrl"),
      message: readText(form, "message"),
      website: readText(form, "website"),
      consent: agreed,
      currentPage: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setSent(false);

    try {
      await apiRequest<{ success: boolean }>("/contact/report", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setSent(true);
      formElement.reset();
      setAgreed(false);
      setTopic("general");
    } catch (caught) {
      const error = caught as Error;
      setErrors({
        form: error.message || "Could not send your message right now.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-[#EEE7DF] bg-white p-6 shadow-sm md:p-7"
      noValidate
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9CA3AF]">
        Send us a message
      </p>
      <h2
        className="mt-1 text-[26px] font-extrabold md:text-[28px]"
        style={{ letterSpacing: "-0.03em", lineHeight: "1.05" }}
      >
        Use the form or email us
      </h2>

      <input
        type="text"
        name="website"
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <fieldset className="mt-6">
        <legend className="text-[13px] font-bold">What is this about?</legend>
        <div className="mt-2 flex flex-wrap gap-1.5 rounded-2xl border border-[#EEE7DF] bg-white p-1.5">
          {TOPICS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTopic(item.value)}
              className={`h-9 rounded-xl px-3.5 text-[12px] font-bold transition ${
                topic === item.value
                  ? "bg-[#FFF0EF] text-[#FF5F63]"
                  : "text-[#4B5563] hover:bg-[#FFFBF7] hover:text-[#0B1220]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Your name"
          name="name"
          placeholder="First and last name"
          error={errors.name}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="you@email.com"
          error={errors.email}
        />
      </div>

      <Field
        className="mt-4"
        label={
          <>
            Link to the content / page{" "}
            <span className="font-medium text-[#9CA3AF]">if reporting</span>
          </>
        }
        name="contentUrl"
        type="url"
        placeholder="https://bookvella.com/host/..."
        error={errors.contentUrl}
      />

      <label className="mt-4 block">
        <span className="text-[13px] font-bold">Message</span>
        <textarea
          name="message"
          rows={6}
          placeholder="Tell us what's going on. If reporting content, please describe what is illegal or against our rules, and why."
          className={`mt-2 w-full resize-y rounded-2xl border bg-white px-4 py-3.5 text-[14px] leading-[1.6] outline-none placeholder:text-[#9CA3AF] focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)] ${
            errors.message ? "border-[#FF5F63]" : "border-[#E5E7EB]"
          }`}
        />
        {errors.message ? (
          <span className="mt-1 block text-[12px] font-semibold text-[#FF5F63]">
            {errors.message}
          </span>
        ) : null}
      </label>

      <label className="mt-4 flex cursor-pointer items-start gap-3 text-[12px] font-medium leading-snug">
        <span
          role="checkbox"
          aria-checked={agreed}
          tabIndex={0}
          onClick={(event) => {
            event.preventDefault();
            setAgreed((value) => !value);
          }}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              setAgreed((value) => !value);
            }
          }}
          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ${
            agreed
              ? "bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-white"
              : "border border-[#D1D5DB] bg-white"
          }`}
        >
          {agreed ? <Check className="size-3.5" /> : null}
        </span>
        <span>
          I understand my details will be processed under Bookvella&apos;s{" "}
          <Link
            href="/legal/privacy"
            className="font-bold text-[#FF5F63] hover:underline"
          >
            Privacy Policy
          </Link>{" "}
          solely to handle this request.
          {errors.consent ? (
            <span className="mt-1 block font-semibold text-[#FF5F63]">
              {errors.consent}
            </span>
          ) : null}
        </span>
      </label>

      {errors.form ? (
        <p className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#B91C1C]">
          {errors.form}
        </p>
      ) : null}

      {sent ? (
        <p className="mt-4 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-[13px] font-semibold text-[#15803D]">
          Message sent. We&apos;ll review it at support.bookvella@gmail.com.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13.5px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Send message"}
        <Send className="size-4" />
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  error,
  className = "",
}: {
  label: ReactNode;
  name: string;
  type?: string;
  placeholder: string;
  error?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[13px] font-bold">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className={`mt-2 h-11 w-full rounded-2xl border bg-white px-4 text-[14px] outline-none placeholder:text-[#9CA3AF] focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)] ${
          error ? "border-[#FF5F63]" : "border-[#E5E7EB]"
        }`}
      />
      {error ? (
        <span className="mt-1 block text-[12px] font-semibold text-[#FF5F63]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function validate(values: {
  name: string;
  email: string;
  contentUrl: string;
  message: string;
  consent: boolean;
}) {
  const errors: FormErrors = {};

  if (values.name.length < 2) {
    errors.name = "Enter your name";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email";
  }

  if (values.contentUrl) {
    try {
      const url = new URL(values.contentUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.contentUrl = "Enter a valid link";
      }
    } catch {
      errors.contentUrl = "Enter a valid link";
    }
  }

  if (values.message.length < 10) {
    errors.message = "Tell us a little more";
  }

  if (!values.consent) {
    errors.consent = "Please confirm before sending";
  }

  return errors;
}

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
