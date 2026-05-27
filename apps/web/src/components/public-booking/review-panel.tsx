"use client";

import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

export function ReviewPanel({
  bookingId,
  token,
  onSubmitted,
}: {
  bookingId: string;
  token: string;
  onSubmitted: () => Promise<void>;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      await apiRequest("/public/reviews", {
        method: "POST",
        body: JSON.stringify({
          bookingId,
          token,
          rating: Number(form.get("rating")),
          comment: typeof form.get("comment") === "string"
            ? (form.get("comment") as string).trim()
            : "",
        }),
      });
      setSubmitted(true);
      await onSubmitted();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not submit review",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mt-6 rounded-2xl border border-success-border bg-success-tint p-5 text-sm text-success-deep">
        Thanks for the review. It will help future guests book with confidence.
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-2xl border border-line-cream bg-surface-card p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]"
    >
      <h3 className="text-[15px] font-bold">Leave a review</h3>
      <p className="mt-1 text-[12.5px] text-ink-soft">
        Share a few words about your booking. Reviews are public when approved
        by the host.
      </p>
      <label className="mt-4 block">
        <span className="text-[12px] font-bold uppercase tracking-[0.10em] text-ink-soft">
          Rating
        </span>
        <select
          name="rating"
          defaultValue="5"
          className="mt-1.5 h-11 w-full rounded-xl border border-line-soft bg-surface-card px-3 text-sm font-medium outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
        >
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>
              {"★".repeat(rating)} ({rating})
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block">
        <span className="text-[12px] font-bold uppercase tracking-[0.10em] text-ink-soft">
          Comment
        </span>
        <textarea
          name="comment"
          required
          maxLength={800}
          rows={4}
          placeholder="What should future guests know?"
          className="mt-1.5 w-full resize-none rounded-xl border border-line-soft bg-surface-card px-4 py-3 text-sm outline-none placeholder:text-ink-muted focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
        />
      </label>
      {error ? (
        <p className="mt-3 text-[12px] text-danger">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange text-[13px] font-bold text-white hover:brightness-105 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
