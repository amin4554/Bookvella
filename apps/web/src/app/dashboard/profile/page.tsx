"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Copy, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  authedApiRequest,
  publicBookingUrl,
  type EventType,
  type HostReview,
  type PublicUser,
  uploadImage,
  updateStoredUser,
} from "@/lib/api";

const fallbackServices = [
  {
    title: "Fresh Cut Session",
    durationMinutes: 45,
    locationDetails: "Your studio",
  },
  {
    title: "Beard Trim & Shape",
    durationMinutes: 30,
    locationDetails: "Your studio",
  },
];

export default function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [reviews, setReviews] = useState<HostReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [me, services, hostReviews] = await Promise.all([
          authedApiRequest<PublicUser>("/auth/me"),
          authedApiRequest<EventType[]>("/event-types"),
          authedApiRequest<HostReview[]>("/reviews"),
        ]);
        setUser(me);
        setProfileImageUrl(me.profileImageUrl ?? "");
        setCoverImageUrl(me.coverImageUrl ?? "");
        setEvents(services);
        setReviews(hostReviews);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not load profile",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    try {
      const updated = await authedApiRequest<PublicUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: readText(form, "name"),
          slug: readText(form, "slug"),
          profileImageUrl: profileImageUrl || null,
          coverImageUrl: coverImageUrl || null,
          headline: readOptionalText(form, "headline"),
          businessCategory: readOptionalText(form, "businessCategory"),
          location: readOptionalText(form, "location"),
          about: readOptionalText(form, "about"),
          whatToExpect: readOptionalText(form, "whatToExpect"),
          websiteUrl: readOptionalText(form, "websiteUrl"),
          instagramUrl: readOptionalText(form, "instagramUrl"),
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

  return (
    <AppShell
      active="Profile"
      title="Your public profile"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      <form onSubmit={save}>
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[34px] font-bold leading-tight">
              Your public profile
            </h2>
            <p className="mt-1 text-base text-[#6B7280]">
              This is what guests see before booking you.
            </p>
          </div>
          <Button
            className="h-12 rounded-2xl bg-[#FF6267] px-8 font-bold text-white hover:bg-[#F05258]"
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-6">
            <Panel eyebrow="Public identity">
              {loading || !user ? (
                <Skeleton text="Loading your profile details." />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-5">
                    <Avatar user={user} size="large" />
                    <div>
                      <p className="font-bold">Profile photo</p>
                      <p className="mt-1 text-sm text-[#6B7280]">
                        Shown on your booking page and emails.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#FF6267] px-4 text-sm font-bold text-[#FF6267]">
                          <Upload className="size-4" />
                          Upload below
                        </span>
                        <span className="inline-flex h-10 items-center rounded-xl border border-[#E8DED7] px-4 text-sm font-bold text-[#6B7280]">
                          Preview below
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Name or business name"
                      name="name"
                      defaultValue={user.name}
                    />
                    <Field
                      label="Service category"
                      name="businessCategory"
                      defaultValue={user.businessCategory ?? ""}
                      placeholder="Barbering"
                    />
                  </div>
                  <Field
                    label="Headline"
                    name="headline"
                    defaultValue={user.headline ?? ""}
                    placeholder="Precision cuts in Downtown Austin"
                    hint="Guests see this right under your name."
                  />
                  <Field
                    label="Location or service area"
                    name="location"
                    defaultValue={user.location ?? ""}
                    placeholder="Shoreditch, London"
                  />
                  <ImageUploadField
                    label="Profile picture"
                    shape="circle"
                    value={profileImageUrl}
                    uploading={uploadingProfile}
                    onClear={() => setProfileImageUrl("")}
                    onChange={(file) =>
                      handleImageUpload(file, setUploadingProfile, setProfileImageUrl)
                    }
                  />
                  <ImageUploadField
                    label="Cover image"
                    value={coverImageUrl}
                    uploading={uploadingCover}
                    onClear={() => setCoverImageUrl("")}
                    onChange={(file) =>
                      handleImageUpload(file, setUploadingCover, setCoverImageUrl)
                    }
                  />
                </>
              )}
            </Panel>

            <Panel eyebrow="About">
              <TextArea
                label="About you"
                name="about"
                defaultValue={user?.about ?? ""}
                placeholder="Tell guests about your experience, style, or approach."
              />
              <TextArea
                label="What to expect"
                name="whatToExpect"
                defaultValue={user?.whatToExpect ?? ""}
                placeholder="Share how the appointment works and how guests can prepare."
              />
            </Panel>

            <Panel eyebrow="Links and public URL">
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Website"
                  name="websiteUrl"
                  defaultValue={user?.websiteUrl ?? ""}
                  placeholder="https://your-site.com"
                />
                <Field
                  label="Instagram"
                  name="instagramUrl"
                  defaultValue={user?.instagramUrl ?? ""}
                  placeholder="https://instagram.com/you"
                />
              </div>
              <div className="rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
                <p className="text-sm font-bold">Public profile URL</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm text-[#6B7280]">
                  <span className="truncate">
                    {profileUrl(user?.slug)}
                  </span>
                  <button
                    type="button"
                    className="text-sm font-bold text-[#FF6267]"
                    onClick={() => {
                      const url = profileUrl(user?.slug);
                      navigator.clipboard.writeText(url);
                      toast.success("Profile link copied");
                    }}
                  >
                    Copy
                  </button>
                </div>
                <details className="mt-3 rounded-xl border border-[#E8DED7] bg-white px-4 py-3">
                  <summary className="cursor-pointer text-sm font-bold text-[#6B7280]">
                    Advanced — Edit public URL
                  </summary>
                  <p className="mt-2 text-xs text-[#9CA3AF]">
                    Changing your handle will break older links unless you set
                    up a redirect.
                  </p>
                  <div className="mt-3">
                    <Field
                      label="Public URL ending"
                      name="slug"
                      defaultValue={user?.slug ?? ""}
                      placeholder="your-name"
                    />
                  </div>
                </details>
                <p className="mt-3 text-xs text-[#9CA3AF]">
                  Need to change your timezone? It moved to{" "}
                  <Link
                    href="/dashboard/settings"
                    className="font-semibold text-[#FF5F63] hover:underline"
                  >
                    Settings → Account
                  </Link>
                  .
                </p>
              </div>
            </Panel>

            <Panel eyebrow="Reviews">
              {reviews.length === 0 ? (
                <p className="text-sm leading-6 text-[#6B7280]">
                  Reviews will appear here after guests leave feedback from a
                  booking confirmation email.
                </p>
              ) : null}
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="flex gap-3 rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-4"
                >
                  <span className="mt-1 text-[#B8C0CC]">::</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-amber-500">
                      {stars(review.rating)}
                    </p>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      &quot;{review.comment}&quot;
                    </p>
                    <p className="mt-2 text-sm font-bold">
                      {review.guestName} - {review.eventType.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg px-2 text-xs font-bold text-[#FF6267]"
                    onClick={() => toggleReview(review)}
                  >
                    {review.isVisible ? "Hide" : "Show"}
                  </button>
                </div>
              ))}
            </Panel>
          </div>

          <aside className="xl:sticky xl:top-8 xl:self-start">
            <div className="mb-4 flex items-center justify-between text-sm font-bold text-[#6B7280]">
              <span>Live preview - what guests see</span>
              <span className="rounded-full bg-[#D8FFE8] px-4 py-1 text-xs text-[#16A34A]">
                Live
              </span>
            </div>
            <Preview user={user} events={events} reviews={reviews} />
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#FF6267]"
              onClick={() => {
                const firstService = events[0];
                const url =
                  firstService && user
                    ? publicBookingUrl(user.slug, firstService.slug)
                    : `${window.location.origin}/${user?.slug ?? "your-link"}`;
                navigator.clipboard.writeText(url);
                toast.success("Public link copied");
              }}
            >
              <Copy className="size-4" />
              Copy public link
            </button>
          </aside>
        </div>
      </form>
    </AppShell>
  );

  async function toggleReview(review: HostReview) {
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
      setError(caught instanceof Error ? caught.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  }
}

function Panel({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[#EEE7DF] bg-white p-6 shadow-sm md:p-8">
      <p className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
        {eyebrow}
      </p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Preview({
  user,
  events,
  reviews,
}: {
  user: PublicUser | null;
  events: EventType[];
  reviews: HostReview[];
}) {
  const services = events.length ? events : fallbackServices;
  const name = user?.name ?? "Bookvella host";
  const visibleReviews = reviews.filter((review) => review.isVisible);
  const averageRating =
    visibleReviews.length === 0
      ? null
      : visibleReviews.reduce((sum, review) => sum + review.rating, 0) /
        visibleReviews.length;

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#EEE7DF] bg-white shadow-sm">
      <div
        className="h-28 bg-gradient-to-r from-[#FF6267] to-[#C653D8]"
        style={
          user?.coverImageUrl
            ? {
                backgroundImage: `url(${user.coverImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />
      <div className="px-6 pb-6">
        <div className="-mt-9">
          <Avatar user={user} />
        </div>
        <h3 className="mt-4 text-2xl font-bold">{name}</h3>
        <p className="mt-1 text-sm text-[#6B7280]">
          {user?.headline ?? "Tell guests what makes booking you worthwhile."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[user?.businessCategory, user?.location]
            .filter(Boolean)
            .map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#E8DED7] bg-[#FFFBF7] px-3 py-1 text-xs font-bold text-[#6B7280]"
              >
                {item}
              </span>
            ))}
        </div>
        {averageRating ? (
          <p className="mt-4 text-sm text-amber-500">
            {stars(averageRating)}{" "}
            <span className="text-[#6B7280]">
              {averageRating.toFixed(1)} - {visibleReviews.length}{" "}
              {visibleReviews.length === 1 ? "review" : "reviews"}
            </span>
          </p>
        ) : null}
        <PreviewSection
          title="About"
          text={
            user?.about ??
            "Add a short profile so guests feel confident before booking."
          }
        />
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
            Services
          </p>
          <div className="mt-3 space-y-2">
            {services.slice(0, 2).map((service) => (
              <div
                key={service.title}
                className="flex gap-3 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-4"
              >
                {"imageUrl" in service && service.imageUrl ? (
                  <div
                    className="size-14 shrink-0 rounded-xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${service.imageUrl})` }}
                  />
                ) : null}
                <div>
                  <p className="font-bold">{service.title}</p>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    {service.durationMinutes} min -{" "}
                    {service.locationDetails ?? "Location shared after booking"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex h-12 items-center justify-center rounded-xl bg-[#FF6267] font-bold text-white">
          Book an appointment
        </div>
      </div>
    </div>
  );
}

function PreviewSection({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{text}</p>
    </div>
  );
}

function Avatar({
  user,
  size = "default",
}: {
  user: PublicUser | null;
  size?: "default" | "large";
}) {
  const className =
    size === "large"
      ? "size-20 rounded-[20px] text-3xl"
      : "size-16 rounded-2xl text-2xl";

  if (user?.profileImageUrl) {
    return (
      <div
        className={`${className} bg-cover bg-center`}
        style={{ backgroundImage: `url(${user.profileImageUrl})` }}
      />
    );
  }

  return (
    <div
      className={`flex ${className} items-center justify-center bg-gradient-to-br from-[#FF6267] to-[#B450F4] font-bold text-white ring-4 ring-white`}
    >
      {user?.name.charAt(0).toUpperCase() ?? "B"}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-4 outline-none placeholder:text-[#9CA3AF] focus:border-[#FF6267] focus:ring-4 focus:ring-[#FF6267]/10"
      />
      {hint ? (
        <span className="mt-1 block text-xs text-[#9CA3AF]">{hint}</span>
      ) : null}
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={4}
        className="mt-2 w-full resize-none rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-4 py-3 leading-7 outline-none placeholder:text-[#9CA3AF] focus:border-[#FF6267] focus:ring-4 focus:ring-[#FF6267]/10"
      />
    </label>
  );
}

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
          Cancel
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
        {ready && (
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
        )}
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
          className="flex-1 accent-[#FF6267]"
        />
        <ZoomIn className="size-4 shrink-0 text-white/60" />
      </div>

      <button
        type="button"
        onClick={handleCrop}
        className="mt-6 h-12 rounded-2xl bg-[#FF6267] px-10 font-bold text-white hover:bg-[#F05258]"
      >
        Apply crop
      </button>
    </div>
  );
}

function ImageUploadField({
  label,
  value,
  uploading,
  onChange,
  onClear,
  shape = "rect",
}: {
  label: string;
  value: string;
  uploading: boolean;
  onChange: (file: File) => void;
  onClear: () => void;
  shape?: "circle" | "rect";
}) {
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);

  const thumbClass =
    shape === "circle"
      ? "rounded-full size-20 border border-[#E8DED7] bg-cover bg-center"
      : "rounded-2xl size-20 border border-[#E8DED7] bg-cover bg-center";

  const emptyClass =
    shape === "circle"
      ? "flex rounded-full size-20 items-center justify-center border border-dashed border-[#E8DED7] bg-white text-xs font-bold text-[#B8C0CC]"
      : "flex rounded-2xl size-20 items-center justify-center border border-dashed border-[#E8DED7] bg-white text-xs font-bold text-[#B8C0CC]";

  return (
    <>
      {pendingSrc ? (
        <CropModal
          src={pendingSrc}
          shape={shape}
          onConfirm={(file) => {
            setPendingSrc(null);
            onChange(file);
          }}
          onCancel={() => setPendingSrc(null)}
        />
      ) : null}
      <div className="rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">{label}</p>
            <p className="mt-1 text-xs text-[#6B7280]">
              JPG, PNG, WEBP, or GIF up to 5 MB.
            </p>
          </div>
          {value ? (
            <button
              type="button"
              className="text-xs font-bold text-[#FF6267]"
              onClick={onClear}
            >
              Remove
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {value ? (
            <div
              className={thumbClass}
              style={{ backgroundImage: `url(${value})` }}
            />
          ) : (
            <div className={emptyClass}>No image</div>
          )}
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#FF6267] bg-white px-4 text-sm font-bold text-[#FF6267]">
            <Upload className="size-4" />
            {uploading ? "Uploading..." : "Choose image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) =>
                  setPendingSrc(ev.target?.result as string);
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {value && (
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#E8DED7] bg-white px-4 text-sm font-bold text-[#6B7280]">
              <Upload className="size-4" />
              Replace
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) =>
                    setPendingSrc(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          )}
        </div>
      </div>
    </>
  );
}

function Skeleton({ text }: { text: string }) {
  return <p className="text-sm text-[#6B7280]">{text}</p>;
}

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalText(form: FormData, key: string) {
  const value = readText(form, key);
  return value ? value : null;
}

function stars(rating: number) {
  return "*****".slice(0, Math.max(0, Math.min(5, Math.round(rating))));
}

function profileUrl(slug?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  return `${appUrl.replace(/\/$/, "")}/${slug ?? "your-link"}`;
}
