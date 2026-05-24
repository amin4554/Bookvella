"use client";

import { FormEvent, useState } from "react";
import { Check } from "lucide-react";
import type { PublicEvent } from "@/lib/api";
import {
  buildPriceLabel,
  formatGuestTime,
  formatFullDateKey,
  formatLocationLabel,
} from "./helpers";

export type GuestDetails = {
  name: string;
  email: string;
  phone: string;
  note: string;
};

type Props = {
  data: PublicEvent;
  guest: GuestDetails;
  timezone: string;
  selectedDateKey: string;
  selectedStartUtc: string;
  selectedEndUtc: string;
  submitting: boolean;
  onBack: () => void;
  onSubmit: (values: GuestDetails) => void;
};

export function StepDetails({
  data,
  guest,
  timezone,
  selectedDateKey,
  selectedStartUtc,
  selectedEndUtc,
  submitting,
  onBack,
  onSubmit,
}: Props) {
  const firstName = data.host.name.split(/\s+/)[0];
  const [agreed, setAgreed] = useState(true);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreed) return;
    const form = new FormData(event.currentTarget);
    onSubmit({
      name: readText(form, "name"),
      email: readText(form, "email"),
      phone: readText(form, "phone"),
      note: readText(form, "note"),
    });
  }

  const startLabel = formatGuestTime(selectedStartUtc, timezone);
  const endLabel = formatGuestTime(selectedEndUtc, timezone);

  return (
    <section>
      <h1
        className="text-[36px] font-extrabold md:text-[44px]"
        style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
      >
        Your details
      </h1>
      <p className="mt-2 text-[14px] text-[#6B7280]">
        Tell {firstName} a little about yourself so they can prepare for your
        visit.
      </p>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <Field
            label="Full name"
            name="name"
            placeholder="First and last name"
            defaultValue={guest.name}
            required
          />
          <Field
            label="Email address"
            name="email"
            type="email"
            placeholder="you@example.com"
            defaultValue={guest.email}
            required
            help="We'll email a 6-digit code here next."
          />
          <Field
            label="Phone number"
            optional
            name="phone"
            placeholder="+44 7700 000000"
            defaultValue={guest.phone}
          />
          <label className="block">
            <FieldLabel label={`Note for ${firstName}`} optional />
            <textarea
              name="note"
              defaultValue={guest.note}
              rows={4}
              placeholder="Anything they should know before the appointment?"
              className="mt-1.5 w-full resize-none rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-[15px] outline-none placeholder:text-[#9CA3AF] focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
            />
          </label>

          <label className="flex cursor-pointer items-start gap-3 text-[13px]">
            <span
              onClick={(event) => {
                event.preventDefault();
                setAgreed((v) => !v);
              }}
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md transition ${
                agreed
                  ? "bg-gradient-to-r from-[#FF6267] to-[#FF8A4C]"
                  : "border border-[#D1D5DB] bg-white"
              }`}
              role="checkbox"
              aria-checked={agreed}
              tabIndex={0}
            >
              {agreed ? <Check className="size-3.5 text-white" /> : null}
            </span>
            <span className="leading-snug">
              I agree to Bookvella&apos;s{" "}
              <a className="font-bold text-[#FF5F63] hover:underline" href="#">
                terms
              </a>{" "}
              and acknowledge how my details are used to confirm and remind me
              of this booking.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !agreed}
            className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(255,95,99,0.5)] transition hover:brightness-105 disabled:opacity-60"
          >
            {submitting ? "Sending code…" : "Send verification code →"}
          </button>
          <p className="text-center text-[12px] text-[#6B7280]">
            Your details are only shared with {firstName}.
          </p>
        </form>

        {/* sticky summary */}
        <aside className="self-start rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
            Your appointment
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div
              className="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF] text-[14px] font-bold text-white"
              style={
                data.host.profileImageUrl
                  ? {
                      backgroundImage: `url(${data.host.profileImageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              {!data.host.profileImageUrl
                ? data.host.name.charAt(0).toUpperCase()
                : null}
            </div>
            <div>
              <p className="text-[14px] font-bold">{data.host.name}</p>
              <p className="text-[12px] text-[#6B7280]">
                {data.host.headline ??
                  data.host.businessCategory ??
                  "Bookvella host"}
              </p>
            </div>
          </div>
          <div className="my-4 h-px bg-[#EEE7DF]" />
          <p className="text-[14px] font-bold">{data.eventType.title}</p>
          <ul className="mt-3 space-y-2 text-[13px]">
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#FF5F63]" />
              {data.eventType.durationMinutes} minutes
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#A855F7]" />
              {data.eventType.locationDetails ??
                formatLocationLabel(data.eventType.locationType)}
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#10B981]" />
              {buildPriceLabel({
                priceType: data.eventType.priceType,
                priceAmount: data.eventType.priceAmount,
                priceMaxAmount: data.eventType.priceMaxAmount,
                priceCurrency: data.eventType.priceCurrency,
              })}
            </li>
          </ul>
          <div className="my-4 h-px bg-[#EEE7DF]" />
          <p className="text-[17px] font-bold">
            {formatFullDateKey(selectedDateKey)} — {startLabel}
          </p>
          <p className="mt-0.5 text-[12px] text-[#6B7280]">
            Ends at {endLabel} · {timezone}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-3 text-[12.5px] font-bold text-[#FF5F63]"
          >
            ← Change time
          </button>
        </aside>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  placeholder,
  defaultValue,
  type = "text",
  required,
  optional,
  help,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  help?: string;
}) {
  return (
    <div>
      <FieldLabel label={label} optional={optional} />
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className="mt-1.5 h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[15px] font-medium outline-none placeholder:text-[#9CA3AF] focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
      />
      {help ? (
        <p className="mt-1.5 text-[12px] text-[#6B7280]">{help}</p>
      ) : null}
    </div>
  );
}

function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <span className="block text-[13px] font-bold text-[#0B1220]">
      {label}
      {optional ? (
        <span className="ml-1 font-normal text-[#9CA3AF]">optional</span>
      ) : null}
    </span>
  );
}

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
