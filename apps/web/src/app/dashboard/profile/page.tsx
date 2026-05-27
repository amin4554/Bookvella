"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  Camera,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  MapPin,
  Settings as SettingsIcon,
  Trash2,
  Upload,
  UserCheck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  authedApiRequest,
  publicBookingUrl,
  type EventType,
  type HostReview,
  type PublicUser,
  uploadImage,
  updateStoredUser,
} from "@/lib/api";

const CATEGORY_OPTIONS = [
  "Barbering",
  "Hair & Beauty",
  "Fitness & Coaching",
  "Tutoring",
  "Consulting",
  "Music & Comedy",
  "Photography",
  "Other",
];

export default function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [reviews, setReviews] = useState<HostReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Controlled fields, so the live preview can mirror them as you type.
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [headline, setHeadline] = useState("");
  const [location, setLocation] = useState("");
  const [about, setAbout] = useState("");
  const [whatToExpect, setWhatToExpect] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [slug, setSlug] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [togglingHidden, setTogglingHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [me, services, hostReviews] = await Promise.all([
          authedApiRequest<PublicUser>("/auth/me"),
          authedApiRequest<EventType[]>("/event-types"),
          authedApiRequest<HostReview[]>("/reviews"),
        ]);
        if (cancelled) return;
        setUser(me);
        setName(me.name ?? "");
        setCategory(me.businessCategory ?? "");
        setHeadline(me.headline ?? "");
        setLocation(me.location ?? "");
        setAbout(me.about ?? "");
        setWhatToExpect(me.whatToExpect ?? "");
        setWebsite(me.websiteUrl ?? "");
        setInstagram(me.instagramUrl ?? "");
        setSlug(me.slug ?? "");
        setProfileImageUrl(me.profileImageUrl ?? "");
        setCoverImageUrl(me.coverImageUrl ?? "");
        setEvents(services);
        setReviews(hostReviews);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load profile",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Computed profile completeness — drives the progress bar.
  const completeness = useMemo(() => {
    const checks: { label: string; ok: boolean }[] = [
      { label: "name", ok: name.trim().length > 0 },
      { label: "category", ok: category.trim().length > 0 },
      { label: "headline", ok: headline.trim().length > 0 },
      { label: "location", ok: location.trim().length > 0 },
      { label: "about", ok: about.trim().length > 0 },
      { label: "what to expect", ok: whatToExpect.trim().length > 0 },
      { label: "profile photo", ok: Boolean(profileImageUrl) },
      { label: "cover image", ok: Boolean(coverImageUrl) },
    ];
    const done = checks.filter((c) => c.ok).length;
    const total = checks.length;
    const missing = checks.filter((c) => !c.ok).map((c) => c.label);
    return {
      percent: Math.round((done / total) * 100),
      done,
      total,
      missing,
    };
  }, [
    name,
    category,
    headline,
    location,
    about,
    whatToExpect,
    profileImageUrl,
    coverImageUrl,
  ]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);

    try {
      const updated = await authedApiRequest<PublicUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          slug,
          profileImageUrl: profileImageUrl || null,
          coverImageUrl: coverImageUrl || null,
          headline: headline.trim() || null,
          businessCategory: category.trim() || null,
          location: location.trim() || null,
          about: about.trim() || null,
          whatToExpect: whatToExpect.trim() || null,
          websiteUrl: website.trim() || null,
          instagramUrl: instagram.trim() || null,
        }),
      });
      setUser(updated);
      updateStoredUser(updated);
      toast.success("Profile saved");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save profile",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleProfileHidden() {
    if (!user) return;
    const next = !user.isProfileHidden;
    const verb = next ? "hide" : "show";
    const confirmed = window.confirm(
      next
        ? "Hide your profile from public? Guests visiting your booking page will see a 'not found' message. Existing bookings stay confirmed and direct service links keep working."
        : "Make your profile public again? It will show up at your booking-link URL.",
    );
    if (!confirmed) return;

    setTogglingHidden(true);
    try {
      const updated = await authedApiRequest<PublicUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ isProfileHidden: next }),
      });
      setUser(updated);
      updateStoredUser(updated);
      toast.success(next ? "Profile hidden" : "Profile is public again");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : `Could not ${verb} profile`,
      );
    } finally {
      setTogglingHidden(false);
    }
  }

  async function toggleReview(review: HostReview) {
    try {
      const updated = await authedApiRequest<HostReview>(
        `/reviews/${review.id}/visibility`,
        {
          method: "PATCH",
          body: JSON.stringify({ isVisible: !review.isVisible }),
        },
      );
      setReviews((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success(updated.isVisible ? "Review shown" : "Review hidden");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not update review",
      );
    }
  }

  async function handleImageUpload(
    file: File,
    setUploading: (value: boolean) => void,
    setUrl: (value: string) => void,
  ) {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadImage(file);
      setUrl(uploaded.url);
      toast.success("Image uploaded");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not upload image",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell
      active="Profile"
      title="Your public profile"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      <form onSubmit={save}>
        {/* title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              className="text-[36px] font-extrabold md:text-[42px]"
              style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
            >
              Your public profile
            </h1>
            <p className="mt-2 text-[14px] text-ink-soft">
              This is what guests see before booking you. Edit anything — your
              live page updates as you save.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/${slug || user?.slug || ""}`}
              target="_blank"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-soft"
            >
              <ExternalLink className="size-4" /> View public page
            </Link>
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-danger-border bg-danger-tint px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {/* profile completeness */}
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-line-cream bg-surface-card p-4 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-tint-100 text-brand">
            <UserCheck className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-bold">Profile completeness</p>
              <p className="text-[12px] font-semibold text-ink-soft">
                <span className="tabular-nums text-ink-strong">
                  {completeness.percent}%
                </span>{" "}
                ·{" "}
                {completeness.missing.length === 0
                  ? "you're all set"
                  : `add ${completeness.missing[0]} to keep going`}
              </p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line-subtle">
              <div
                className="h-full bg-gradient-to-r from-brand-coral to-brand-orange"
                style={{ width: `${completeness.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* two columns */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* LEFT */}
          <div className="space-y-6">
            {/* Public identity */}
            <Card eyebrow="Public identity" head="How guests recognise you">
              <div className="space-y-5">
                <PhotoRow
                  profileImageUrl={profileImageUrl}
                  uploading={uploadingProfile}
                  onChange={(file) =>
                    handleImageUpload(
                      file,
                      setUploadingProfile,
                      setProfileImageUrl,
                    )
                  }
                  onClear={() => setProfileImageUrl("")}
                  initial={(user?.name ?? name ?? "B")
                    .charAt(0)
                    .toUpperCase()}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldText
                    label="Display name"
                    value={name}
                    onChange={setName}
                    placeholder="Marcus Williams"
                  />
                  <FieldSelect
                    label="Service category"
                    value={category}
                    onChange={setCategory}
                    options={CATEGORY_OPTIONS}
                    placeholder="Pick a category"
                  />
                </div>

                <FieldText
                  label="Headline"
                  value={headline}
                  onChange={setHeadline}
                  placeholder="Precision cuts in Shoreditch, London"
                  help="Guests see this right under your name. Aim for 4–8 words."
                />

                <FieldText
                  label="Location or service area"
                  value={location}
                  onChange={setLocation}
                  icon={<MapPin className="size-4 text-ink-muted" />}
                  placeholder="Shoreditch, London · United Kingdom"
                />

                <CoverUpload
                  value={coverImageUrl}
                  uploading={uploadingCover}
                  onChange={(file) =>
                    handleImageUpload(file, setUploadingCover, setCoverImageUrl)
                  }
                  onClear={() => setCoverImageUrl("")}
                />

                {/* Advanced — public link handle */}
                <details className="rounded-xl border border-line-cream bg-surface-page p-4 open:bg-surface-card">
                  <summary className="flex cursor-pointer items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <SettingsIcon className="size-4 text-ink-muted" />
                      <span className="text-[13px] font-bold">
                        Advanced — public link handle
                      </span>
                    </div>
                    <ChevronDown className="size-4 text-ink-muted" />
                  </summary>
                  <div className="mt-4">
                    <FieldEyebrow>Your booking link</FieldEyebrow>
                    <div className="mt-1.5 flex h-12 items-center overflow-hidden rounded-2xl border border-line-soft bg-surface-card focus-within:border-brand">
                      <span className="flex h-full items-center border-r border-line-soft bg-surface-soft px-4 text-[14px] font-medium tabular-nums text-ink-soft">
                        bookvella.com/
                      </span>
                      <input
                        value={slug}
                        onChange={(event) =>
                          setSlug(event.target.value.toLowerCase())
                        }
                        className="h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] font-semibold tabular-nums outline-none"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-muted">
                      Changing this breaks links you&apos;ve already shared.
                    </p>
                  </div>
                </details>
              </div>
            </Card>

            {/* About */}
            <Card eyebrow="About" head="Tell guests who you are">
              <div className="space-y-5">
                <FieldTextarea
                  label="About you"
                  value={about}
                  onChange={setAbout}
                  rows={4}
                  help="Short bio. Visible at the top of your public profile."
                />
                <FieldTextarea
                  label="What to expect"
                  value={whatToExpect}
                  onChange={setWhatToExpect}
                  rows={3}
                  help="Sets expectations before the appointment. Helps reduce no-shows."
                />
              </div>
            </Card>

            {/* Links & social */}
            <Card
              eyebrow="Links & social"
              head="Where else can guests find you?"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldText
                  label="Website"
                  value={website}
                  onChange={setWebsite}
                  icon={<Globe className="size-4 text-ink-muted" />}
                  placeholder="https://yoursite.com"
                />
                <FieldText
                  label="Instagram"
                  value={instagram}
                  onChange={setInstagram}
                  icon={<AtSign className="size-4 text-ink-muted" />}
                  placeholder="@yourhandle"
                />
              </div>
            </Card>

            {/* Reviews */}
            <Card
              eyebrow="Reviews & testimonials"
              head="Choose what shows on your page"
              headRight={
                <p className="text-[12px] text-ink-soft">
                  {reviewsAverage(reviews) != null ? (
                    <>
                      <span className="font-bold tabular-nums text-ink-strong">
                        {reviewsAverage(reviews)!.toFixed(1)}
                      </span>{" "}
                      · {reviews.length}{" "}
                      {reviews.length === 1 ? "review" : "reviews"}
                    </>
                  ) : (
                    "No reviews yet"
                  )}
                </p>
              }
            >
              {reviews.length === 0 ? (
                <p className="text-[13px] leading-6 text-ink-soft">
                  Reviews will appear here after guests leave feedback from a
                  booking confirmation email. You can hide individual reviews
                  with the toggle.
                </p>
              ) : (
                <div className="divide-y divide-line-cream">
                  {reviews.map((review) => (
                    <ReviewListRow
                      key={review.id}
                      review={review}
                      onToggle={() => toggleReview(review)}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Hide profile toggle */}
            <section
              className={`rounded-2xl border p-5 ${
                user?.isProfileHidden
                  ? "border-warning-border bg-surface-amber"
                  : "border-danger-border bg-danger-tint"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-9 items-center justify-center rounded-xl bg-surface-card ${
                    user?.isProfileHidden ? "text-warning-strong" : "text-danger"
                  }`}
                >
                  {user?.isProfileHidden ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[14px] font-bold ${
                      user?.isProfileHidden ? "text-warning-strong" : "text-danger-deep"
                    }`}
                  >
                    {user?.isProfileHidden
                      ? "Profile is hidden from public"
                      : "Hide profile from public"}
                  </p>
                  <p
                    className={`mt-1 text-[12px] leading-[1.55] ${
                      user?.isProfileHidden
                        ? "text-warning-strong/80"
                        : "text-danger-deep/80"
                    }`}
                  >
                    {user?.isProfileHidden
                      ? "Your booking page returns a not-found response. Existing bookings stay confirmed and direct service links continue to work. Make it public again whenever you're ready."
                      : "Pause your public booking page while existing bookings stay confirmed. Direct service links keep working for guests you've shared them with."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleProfileHidden}
                  disabled={!user || togglingHidden}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-bold disabled:opacity-60 ${
                    user?.isProfileHidden
                      ? "border-warning-border bg-surface-card text-warning-strong hover:bg-surface-amber"
                      : "border-danger-border bg-surface-card text-danger hover:bg-danger-tint"
                  }`}
                >
                  {togglingHidden
                    ? "Saving…"
                    : user?.isProfileHidden
                      ? "Show profile"
                      : "Hide profile"}
                </button>
              </div>
            </section>
          </div>

          {/* RIGHT — live preview */}
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold">
                Live preview — what guests see
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-mint px-2.5 py-1 text-[10px] font-bold text-success">
                <span className="size-1.5 rounded-full bg-success" /> Live
              </span>
            </div>

            <div className="mt-3 overflow-hidden rounded-[24px] border border-line-cream bg-surface-card shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
              {/* cover */}
              <div
                className="relative h-24"
                style={{
                  background: coverImageUrl
                    ? `url(${coverImageUrl}) center/cover`
                    : "linear-gradient(135deg,#FF6267 0%,#FF8252 50%,#C661E0 100%)",
                }}
              >
                <div className="absolute -bottom-7 left-5">
                  <div
                    className="flex size-14 items-center justify-center overflow-hidden rounded-[14px] bg-gradient-to-br from-brand-coral via-purple-vivid to-purple-strong text-[16px] font-bold text-white ring-4 ring-surface-card"
                    style={
                      profileImageUrl
                        ? {
                            backgroundImage: `url(${profileImageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  >
                    {!profileImageUrl
                      ? (user?.name ?? name ?? "B").charAt(0).toUpperCase()
                      : null}
                  </div>
                </div>
              </div>
              <div className="px-5 pb-5 pt-10">
                <p className="text-[18px] font-bold leading-tight">
                  {name || "Your name"}
                </p>
                <p className="text-[12px] text-ink-soft">
                  {headline || "Add a headline so guests get the gist."}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {category ? <PreviewChip>{category}</PreviewChip> : null}
                  {location
                    ? location
                        .split(/[·,]/)
                        .map((part) => part.trim())
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => (
                          <PreviewChip key={part}>{part}</PreviewChip>
                        ))
                    : null}
                </div>
                {reviewsAverage(reviews) != null ? (
                  <div className="mt-3 flex items-center gap-1 text-[12px]">
                    <span className="text-warning-amber">
                      {"★".repeat(
                        Math.max(
                          0,
                          Math.min(5, Math.round(reviewsAverage(reviews)!)),
                        ),
                      )}
                    </span>
                    <span className="font-bold tabular-nums">
                      {reviewsAverage(reviews)!.toFixed(1)}
                    </span>
                    <span className="tabular-nums text-ink-muted">
                      · {reviews.length}{" "}
                      {reviews.length === 1 ? "review" : "reviews"}
                    </span>
                  </div>
                ) : null}

                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  About
                </p>
                <p className="mt-1.5 text-[12px] leading-[1.6] text-ink-body">
                  {about ||
                    "Your bio will appear here. Add a short intro to help guests trust you."}
                </p>

                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  Services
                </p>
                <div className="mt-2 space-y-2">
                  {events.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line-cream bg-surface-page p-3 text-[11px] text-ink-soft">
                      No active services yet.{" "}
                      <Link
                        href="/dashboard/services/new"
                        className="font-bold text-brand hover:underline"
                      >
                        Add one
                      </Link>
                    </p>
                  ) : (
                    events.slice(0, 3).map((service) => (
                      <div
                        key={service.id}
                        className="rounded-lg border border-line-cream bg-surface-page p-2.5"
                      >
                        <p className="text-[12px] font-bold">{service.title}</p>
                        <p className="text-[10px] tabular-nums text-ink-soft">
                          {service.durationMinutes} min ·{" "}
                          {service.locationDetails ?? "Location after booking"}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  disabled
                  className="mt-4 h-11 w-full rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange text-[13px] font-bold text-white shadow-sm"
                >
                  Book an appointment
                </button>
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] text-ink-muted">
              Updates immediately when you save.
            </p>

            {/* copy link button */}
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-line-cream bg-surface-card p-3.5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
              <p className="truncate text-[12px] tabular-nums text-ink-soft">
                bookvella.com/{slug || user?.slug || "your-link"}
              </p>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-brand-tint-400 bg-brand-tint-100 px-2.5 text-[11px] font-bold text-brand"
                onClick={() => {
                  if (!user) return;
                  const url =
                    events.length > 0
                      ? publicBookingUrl(slug || user.slug, events[0].slug)
                      : `${window.location.origin}/${slug || user.slug}`;
                  navigator.clipboard.writeText(url).then(
                    () => toast.success("Public link copied"),
                    () => toast.error("Copy failed"),
                  );
                }}
              >
                <Copy className="size-3" /> Copy
              </button>
            </div>
          </aside>
        </div>
      </form>
    </AppShell>
  );
}

/* ============ photo + cover upload ============ */

function PhotoRow({
  profileImageUrl,
  uploading,
  onChange,
  onClear,
  initial,
}: {
  profileImageUrl: string;
  uploading: boolean;
  onChange: (file: File) => void;
  onClear: () => void;
  initial: string;
}) {
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);

  return (
    <>
      {pendingSrc ? (
        <CropModal
          src={pendingSrc}
          shape="circle"
          onConfirm={(file) => {
            setPendingSrc(null);
            onChange(file);
          }}
          onCancel={() => setPendingSrc(null)}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative">
          <div
            className="flex size-20 items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-br from-brand-coral via-purple-vivid to-purple-strong text-[24px] font-bold text-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]"
            style={
              profileImageUrl
                ? {
                    backgroundImage: `url(${profileImageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {!profileImageUrl ? initial : null}
          </div>
          <label className="absolute -bottom-1.5 -right-1.5 inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-line-cream bg-surface-card text-brand shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
            <Camera className="size-3.5" />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) =>
                  setPendingSrc(ev.target?.result as string);
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold">Profile photo</p>
          <p className="mt-1 text-[12px] text-ink-soft">
            Shown on your booking page and emails. 400×400px recommended.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-brand-tint-400 bg-brand-tint-100 px-3 text-[12px] font-bold text-brand">
              <Upload className="size-3.5" />
              {uploading ? "Uploading…" : "Upload photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) =>
                    setPendingSrc(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {profileImageUrl ? (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-soft bg-surface-card px-3 text-[12px] font-bold text-ink-soft"
              >
                <Trash2 className="size-3.5" /> Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function CoverUpload({
  value,
  uploading,
  onChange,
  onClear,
}: {
  value: string;
  uploading: boolean;
  onChange: (file: File) => void;
  onClear: () => void;
}) {
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);

  return (
    <>
      {pendingSrc ? (
        <CropModal
          src={pendingSrc}
          shape="rect"
          onConfirm={(file) => {
            setPendingSrc(null);
            onChange(file);
          }}
          onCancel={() => setPendingSrc(null)}
        />
      ) : null}
      <div className="rounded-2xl border border-line-cream bg-surface-page p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold">Cover image</p>
            <p className="mt-0.5 text-[11px] text-ink-soft">
              Sits behind your name on your public page. 2:1 ratio recommended.
            </p>
          </div>
          {value ? (
            <button
              type="button"
              className="text-[11px] font-bold text-brand"
              onClick={onClear}
            >
              Remove
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {value ? (
            <div
              className="h-20 w-40 rounded-xl border border-line-warm bg-cover bg-center"
              style={{ backgroundImage: `url(${value})` }}
            />
          ) : (
            <div className="grid h-20 w-40 place-items-center rounded-xl border border-dashed border-line-warm bg-surface-card text-[11px] font-bold text-ink-disabled">
              No cover yet
            </div>
          )}
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-brand-tint-400 bg-surface-card px-4 text-[12px] font-bold text-brand">
            <Upload className="size-4" />
            {uploading ? "Uploading…" : value ? "Replace cover" : "Choose cover"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) =>
                  setPendingSrc(ev.target?.result as string);
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
      </div>
    </>
  );
}

/* ============ helpers ============ */

function ReviewListRow({
  review,
  onToggle,
}: {
  review: HostReview;
  onToggle: () => void;
}) {
  const initial = (review.guestName || "?").charAt(0).toUpperCase();
  const stars = "★".repeat(
    Math.max(0, Math.min(5, Math.round(review.rating))),
  );
  return (
    <div className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-purple-strong text-[12px] font-bold text-white">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-bold">{review.guestName}</p>
          <span className="text-[12px] text-warning-amber">{stars}</span>
          <span className="text-[11px] tabular-nums text-ink-muted">
            {review.eventType.title} · {relativeDate(review.createdAt)}
          </span>
          {!review.isVisible ? (
            <span className="rounded-full bg-line-subtle px-2 py-0.5 text-[10px] font-bold text-ink-soft">
              Hidden
            </span>
          ) : null}
        </div>
        <p
          className={`mt-1.5 text-[13px] leading-[1.6] ${review.isVisible ? "text-ink-body" : "text-ink-soft"}`}
        >
          &ldquo;{review.comment}&rdquo;
        </p>
      </div>
      <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-body">
        <input
          type="checkbox"
          checked={review.isVisible}
          onChange={onToggle}
          className="size-4 rounded border-line-strong text-brand focus:ring-brand"
        />
        Visible
      </label>
    </div>
  );
}

function Card({
  eyebrow,
  head,
  headRight,
  children,
}: {
  eyebrow: string;
  head: string;
  headRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-line-cream bg-surface-card shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-cream px-5 py-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-muted">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-[16px] font-extrabold">{head}</h2>
        </div>
        {headRight}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function FieldEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] font-bold uppercase tracking-[0.10em] text-ink-soft">
      {children}
    </span>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
  help,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  help?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <FieldEyebrow>{label}</FieldEyebrow>
      <div className="relative mt-1.5">
        {icon ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
            {icon}
          </span>
        ) : null}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-11 w-full rounded-xl border border-line-soft bg-surface-card px-3.5 text-sm font-medium outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)] ${icon ? "pl-10" : ""}`}
        />
      </div>
      {help ? (
        <p className="mt-1.5 text-[11px] text-ink-muted">{help}</p>
      ) : null}
    </label>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  help?: string;
}) {
  return (
    <label className="block">
      <FieldEyebrow>{label}</FieldEyebrow>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-1.5 w-full rounded-xl border border-line-soft bg-surface-card px-3.5 py-3 text-sm leading-[1.55] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]"
      />
      {help ? (
        <p className="mt-1.5 text-[11px] text-ink-muted">{help}</p>
      ) : null}
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <label className="block">
      <FieldEyebrow>{label}</FieldEyebrow>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-line-soft bg-surface-card px-3 text-sm font-medium outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]"
      >
        {value ? null : <option value="">{placeholder ?? "Select…"}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line-warm bg-surface-card px-2 py-1 text-[11px] font-semibold text-ink-body">
      {children}
    </span>
  );
}

function reviewsAverage(reviews: HostReview[]): number | null {
  const visible = reviews.filter((r) => r.isVisible);
  if (visible.length === 0) return null;
  return visible.reduce((sum, r) => sum + r.rating, 0) / visible.length;
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const day = 86_400_000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))} weeks ago`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))} months ago`;
  return `${Math.floor(diff / (365 * day))} years ago`;
}

/* ============ canvas crop modal (kept from earlier impl) ============ */

function CropModal({
  src,
  shape,
  onConfirm,
  onCancel,
}: {
  src: string;
  shape: "circle" | "rect";
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [cropSize, setCropSize] = useState(0);
  const [ready, setReady] = useState(false);

  const cropW = cropSize;
  const cropH = shape === "circle" ? cropSize : Math.round(cropSize / 2);
  const maxSlider = shape === "circle" ? 300 : 480;

  function initCrop() {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const base = Math.min(width, height) * (shape === "circle" ? 0.65 : 0.82);
    const initial = Math.min(Math.round(base), maxSlider);
    setCropSize(initial);
    setCropPos({ x: Math.round(width / 2), y: Math.round(height / 2) });
    setReady(true);
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const hw = cropW / 2;
      const hh = cropH / 2;
      const dx = e.clientX - dragStartRef.current.mx;
      const dy = e.clientY - dragStartRef.current.my;
      setCropPos({
        x: Math.max(hw, Math.min(width - hw, dragStartRef.current.px + dx)),
        y: Math.max(hh, Math.min(height - hh, dragStartRef.current.py + dy)),
      });
    }
    function onUp() {
      draggingRef.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [cropW, cropH]);

  function handleCrop() {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const cRect = container.getBoundingClientRect();
    const iRect = img.getBoundingClientRect();
    const imgLeft = iRect.left - cRect.left;
    const imgTop = iRect.top - cRect.top;
    const scaleX = img.naturalWidth / iRect.width;
    const scaleY = img.naturalHeight / iRect.height;

    const srcX = Math.max(0, (cropPos.x - cropW / 2 - imgLeft) * scaleX);
    const srcY = Math.max(0, (cropPos.y - cropH / 2 - imgTop) * scaleY);
    const srcW = Math.min(img.naturalWidth - srcX, cropW * scaleX);
    const srcH = Math.min(img.naturalHeight - srcY, cropH * scaleY);

    const outW = shape === "circle" ? 400 : 800;
    const outH = shape === "circle" ? 400 : 400;

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onConfirm(new File([blob], "crop.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="mb-5 flex w-full max-w-[580px] items-center justify-between">
        <h3 className="text-lg font-bold text-white">
          {shape === "circle" ? "Crop profile photo" : "Crop cover image"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-bold text-white/60 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative w-full max-w-[560px] overflow-hidden rounded-2xl bg-black"
        style={{ aspectRatio: "4/3" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={initCrop}
          className="h-full w-full object-contain"
        />
        {ready ? (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              draggingRef.current = true;
              dragStartRef.current = {
                mx: e.clientX,
                my: e.clientY,
                px: cropPos.x,
                py: cropPos.y,
              };
            }}
            className="absolute cursor-move select-none"
            style={{
              left: cropPos.x - cropW / 2,
              top: cropPos.y - cropH / 2,
              width: cropW,
              height: cropH,
              borderRadius: shape === "circle" ? "50%" : 8,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
              border: "2px solid rgba(255,255,255,0.85)",
            }}
          />
        ) : null}
      </div>

      <div className="mt-5 flex w-full max-w-[560px] items-center gap-3">
        <ZoomOut className="size-4 shrink-0 text-white/60" />
        <input
          type="range"
          min={80}
          max={maxSlider}
          value={cropSize || 80}
          onChange={(e) => {
            const next = Number(e.target.value);
            const el = containerRef.current;
            if (!el) return;
            const { width, height } = el.getBoundingClientRect();
            const hw = next / 2;
            const hh = (shape === "circle" ? next : Math.round(next / 2)) / 2;
            setCropSize(next);
            setCropPos((p) => ({
              x: Math.max(hw, Math.min(width - hw, p.x)),
              y: Math.max(hh, Math.min(height - hh, p.y)),
            }));
          }}
          className="flex-1 accent-brand"
        />
        <ZoomIn className="size-4 shrink-0 text-white/60" />
      </div>

      <button
        type="button"
        onClick={handleCrop}
        className="mt-6 h-12 rounded-2xl bg-gradient-to-r from-brand-coral to-brand-orange px-10 font-bold text-white hover:brightness-105"
      >
        Apply crop
      </button>
    </div>
  );
}
