"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Clock3, Copy, DollarSign, MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  authedApiRequest,
  type EventType,
  type LocationType,
  type PublicUser,
  publicBookingUrl,
  uploadImage,
} from "@/lib/api";

const locationOptions: { value: LocationType; label: string }[] = [
  { value: "VIDEO", label: "Video call" },
  { value: "PHONE", label: "Phone call" },
  { value: "IN_PERSON", label: "In person" },
];

export default function EventTypesPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [editing, setEditing] = useState<EventType | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deactivate, setDeactivate] = useState<EventType | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initial = useMemo(() => editing ?? undefined, [editing]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [me, eventTypes] = await Promise.all([
          authedApiRequest<PublicUser>("/auth/me"),
          authedApiRequest<EventType[]>("/event-types"),
        ]);
        setUser(me);
        setEvents(eventTypes);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load event types",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(event: EventType) {
    setEditing(event);
    setDrawerOpen(true);
  }

  async function reactivateService(event: EventType) {
    setReactivating(event.id);
    try {
      const updated = await authedApiRequest<EventType>(`/event-types/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      });
      setEvents((current) => current.map((e) => (e.id === updated.id ? updated : e)));
      toast.success("Service reactivated");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not reactivate service");
    } finally {
      setReactivating(null);
    }
  }

  return (
    <AppShell
      active="Services"
      title="Services"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[34px] font-bold leading-tight">Services</h2>
          <p className="mt-1 text-base text-[#6B7280]">
            Manage the services guests can book with you.
          </p>
        </div>
        <Button
          className="h-12 rounded-2xl bg-[#FF6267] px-6 font-bold text-white hover:bg-[#F05258]"
          onClick={openCreate}
        >
          <Plus className="mr-2 size-4" />
          Create service
        </Button>
      </section>

      {error ? <InlineState title="Services unavailable" text={error} /> : null}
      {loading ? (
        <InlineState title="Loading services" text="Fetching your services." />
      ) : null}

      {!loading && !error ? (
        <div className="mt-6 space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className={`flex flex-col gap-4 rounded-[22px] border border-[#EEE7DF] bg-white p-5 shadow-sm lg:flex-row lg:items-center ${
                !event.isActive ? "opacity-55" : ""
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <button
                  className="flex size-9 items-center justify-center rounded-lg border border-[#FF5F63] bg-[#EFFFFD] text-[#FF5F63]"
                  onClick={() => {
                    if (!user) return;
                    navigator.clipboard.writeText(
                      publicBookingUrl(user.slug, event.slug),
                    );
                    toast.success("Link copied");
                  }}
                  aria-label={`Copy ${event.title} link`}
                >
                  <Copy className="size-4" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {event.imageUrl ? (
                      <div
                        className="size-12 shrink-0 rounded-xl bg-cover bg-center"
                        style={{ backgroundImage: `url(${event.imageUrl})` }}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="font-semibold">{event.title}</p>
                      <p className="truncate text-sm text-[#6B7280]">
                        {user
                          ? publicBookingUrl(user.slug, event.slug)
                          : event.slug}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-8 gap-y-1 text-xs text-[#6B7280]">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3" />
                      {event.durationMinutes} minutes
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3 text-red-500" />
                      {event.locationDetails ||
                        formatLocation(event.locationType)}
                    </span>
                    {event.priceAmount != null ? (
                      <span className="inline-flex items-center gap-0.5 font-bold text-[#16A34A]">
                        <DollarSign className="size-3" />
                        {formatPrice(event.priceAmount, event.priceCurrency)}
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF]">Price on request</span>
                    )}
                    {event.category ? (
                      <span className="rounded-full bg-[#FFF0EF] px-2 py-0.5 font-bold text-[#FF6267]">
                        {event.category}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      {event.whatIncluded ?? "Guest experience ready"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={event.isActive ? "active" : "inactive"}>
                  {event.isActive ? "Active" : "Inactive"}
                </StatusBadge>
                <button
                  className="h-8 rounded-md bg-[#FFFBF7] px-4 text-sm font-medium"
                  onClick={() => openEdit(event)}
                >
                  Edit
                </button>
                {event.isActive ? (
                  <button
                    className="h-8 rounded-md bg-red-100 px-4 text-sm font-medium text-red-600"
                    onClick={() => setDeactivate(event)}
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    className="h-8 rounded-md bg-emerald-100 px-4 text-sm font-medium text-emerald-700 disabled:opacity-50"
                    disabled={reactivating === event.id}
                    onClick={() => reactivateService(event)}
                  >
                    {reactivating === event.id ? "Reactivating..." : "Reactivate"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {events.length === 0 ? (
            <InlineState
              title="No services yet"
              text="Create your first bookable service to get a public booking link."
            />
          ) : null}
        </div>
      ) : null}

      {drawerOpen ? (
        <EventTypeDrawer
          initial={initial}
          onClose={() => setDrawerOpen(false)}
          onSaved={(event) => {
            setEvents((current) =>
              initial
                ? current.map((item) => (item.id === event.id ? event : item))
                : [event, ...current],
            );
            setDrawerOpen(false);
            toast.success(initial ? "Service updated" : "Service created");
          }}
        />
      ) : null}

      {deactivate ? (
        <ConfirmDeactivate
          event={deactivate}
          onClose={() => setDeactivate(null)}
          onConfirm={async () => {
            const updated = await authedApiRequest<EventType>(
              `/event-types/${deactivate.id}`,
              {
                method: "DELETE",
              },
            );
            setEvents((current) =>
              current.map((event) =>
                event.id === updated.id ? updated : event,
              ),
            );
            setDeactivate(null);
            toast.success("Service deactivated");
          }}
        />
      ) : null}
    </AppShell>
  );
}

function EventTypeDrawer({
  initial,
  onClose,
  onSaved,
}: {
  initial?: EventType;
  onClose: () => void;
  onSaved: (event: EventType) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const priceInput = readOptionalText(form, "priceInput");
    const priceCurrency = readText(form, "priceCurrency") || "USD";
    const priceAmount =
      priceInput !== null ? Math.round(parseFloat(priceInput) * 100) : null;

    const payload = {
      title: readText(form, "title"),
      slug: readOptionalText(form, "slug") ?? undefined,
      category: readOptionalText(form, "category"),
      imageUrl: imageUrl || null,
      description: readOptionalText(form, "description"),
      whatIncluded: readOptionalText(form, "whatIncluded"),
      locationDetails: readOptionalText(form, "locationDetails"),
      durationMinutes: readNumber(form, "durationMinutes"),
      bufferBeforeMinutes: readNumber(form, "bufferBeforeMinutes"),
      bufferAfterMinutes: readNumber(form, "bufferAfterMinutes"),
      locationType: readText(form, "locationType") as LocationType,
      isActive: form.get("isActive") === "on",
      priceAmount:
        priceAmount !== null && !Number.isNaN(priceAmount) ? priceAmount : null,
      priceCurrency,
    };

    try {
      const saved = await authedApiRequest<EventType>(
        initial ? `/event-types/${initial.id}` : "/event-types",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      onSaved(saved);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save event type",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-[#111827]/10">
      <aside className="ml-auto flex h-full w-full max-w-[760px] flex-col bg-[#FFFBF7] shadow-2xl">
        <header className="flex h-16 items-center justify-between border-b border-[#EEE7DF] px-8">
          <h3 className="text-xl font-semibold">
            {initial ? "Edit service" : "Create a service"}
          </h3>
          <button onClick={onClose} aria-label="Close form">
            <X className="size-5 text-[#6B7280]" />
          </button>
        </header>
        <form
          className="flex flex-1 flex-col overflow-y-auto px-8 py-6"
          onSubmit={submit}
        >
          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <div className="space-y-5">
            <FormPanel eyebrow="What service do you offer?">
              <Field
                label="Service name"
                name="title"
                placeholder="Fresh Cut Session"
                value={initial?.title}
              />
              <Field
                label="Category"
                name="category"
                placeholder="Barbering, coaching, tutoring..."
                value={initial?.category ?? ""}
              />
              <Field
                label="Description"
                name="description"
                placeholder="A focused session to discuss..."
                value={initial?.description ?? ""}
              />
              <Field
                label="What's included"
                name="whatIncluded"
                placeholder="Precision cut, styling, and finish"
                value={initial?.whatIncluded ?? ""}
              />
              <PriceField
                priceAmount={initial?.priceAmount ?? null}
                priceCurrency={initial?.priceCurrency ?? "USD"}
              />
              <ServiceImageUpload
                value={imageUrl}
                uploading={uploadingImage}
                onClear={() => setImageUrl("")}
                onChange={async (file) => {
                  setUploadingImage(true);
                  setError(null);
                  try {
                    const uploaded = await uploadImage(file);
                    setImageUrl(uploaded.url);
                    toast.success("Service image uploaded");
                  } catch (caught) {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : "Could not upload image",
                    );
                  } finally {
                    setUploadingImage(false);
                  }
                }}
              />
            </FormPanel>
            <FormPanel eyebrow="Booking rules">
              <SelectNumber
                label="Duration"
                name="durationMinutes"
                value={initial?.durationMinutes ?? 30}
                options={[15, 30, 45, 60, 90]}
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectNumber
                  label="Prep time"
                  name="bufferBeforeMinutes"
                  value={initial?.bufferBeforeMinutes ?? 0}
                  options={[0, 5, 10, 15, 30]}
                />
                <SelectNumber
                  label="Cleanup time"
                  name="bufferAfterMinutes"
                  value={initial?.bufferAfterMinutes ?? 0}
                  options={[0, 5, 10, 15, 30]}
                />
              </div>
            </FormPanel>
            <FormPanel eyebrow="Where does it happen?">
              <label className="block">
                <span className="text-sm font-medium">Location type</span>
                <select
                  name="locationType"
                  defaultValue={initial?.locationType ?? "VIDEO"}
                  className="mt-1 h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm outline-none focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
                >
                  {locationOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Location details"
                name="locationDetails"
                placeholder="Studio address, video link later, or phone call"
                value={initial?.locationDetails ?? ""}
              />
              <label className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium">Public and bookable</span>
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={initial?.isActive ?? true}
                  className="size-5 accent-[#FF5F63]"
                />
              </label>
              {initial ? (
                <details className="rounded-xl border border-[#EEE7DF] bg-white px-4 py-3">
                  <summary className="cursor-pointer text-sm font-bold text-[#6B7280]">
                    Edit public URL
                  </summary>
                  <div className="mt-3">
                    <Field
                      label="Public URL ending"
                      name="slug"
                      placeholder="fresh-cut"
                      value={initial.slug}
                    />
                  </div>
                </details>
              ) : null}
            </FormPanel>
          </div>
          <footer className="mt-auto grid grid-cols-2 gap-3 border-t border-[#EEE7DF] pt-4">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-lg bg-white font-semibold"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="h-10 rounded-lg bg-[#FF5F63] font-semibold text-white hover:bg-[#F05258]"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : initial
                  ? "Save changes"
                  : "Publish service"}
            </Button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function ServiceImageUpload({
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
  return (
    <div className="rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Service picture</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            Optional. JPG, PNG, WEBP, or GIF up to 5 MB.
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
            className="h-20 w-28 rounded-xl border border-[#E8DED7] bg-cover bg-center"
            style={{ backgroundImage: `url(${value})` }}
          />
        ) : (
          <div className="flex h-20 w-28 items-center justify-center rounded-xl border border-dashed border-[#E8DED7] bg-white text-xs font-bold text-[#B8C0CC]">
            No image
          </div>
        )}
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#FF6267] bg-white px-4 text-sm font-bold text-[#FF6267]">
          <Plus className="size-4" />
          {uploading ? "Uploading..." : "Choose image"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                onChange(file);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}

function ConfirmDeactivate({
  event,
  onClose,
  onConfirm,
}: {
  event: EventType;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/45 px-4">
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-8 shadow-2xl">
        <h3 className="text-xl font-semibold">Deactivate service?</h3>
        <p className="mt-2 max-w-sm text-sm leading-5 text-[#6B7280]">
          Guests cannot book this service until you reactivate it.
        </p>
        <div className="mt-6 rounded-lg bg-[#FFFBF7] px-4 py-3 text-sm font-semibold">
          {event.title}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-10 rounded-lg bg-white font-semibold"
            onClick={onClose}
          >
            Keep active
          </Button>
          <Button
            className="h-10 rounded-lg bg-[#DC2626] font-semibold text-white hover:bg-[#b91c1c]"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Deactivating..." : "Deactivate"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  value,
}: {
  label: string;
  name: string;
  placeholder: string;
  value?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        className="mt-1 h-11 w-full rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-3 text-sm outline-none placeholder:text-[#B8C0CC] focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
      />
    </label>
  );
}

function FormPanel({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[#EEE7DF] bg-white p-5">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
        {eyebrow}
      </p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SelectNumber({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: number;
  options: number[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="mt-1 h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm outline-none focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
      >
        {options.map((option) => (
          <option value={option} key={option}>
            {option} minutes
          </option>
        ))}
      </select>
    </label>
  );
}

function InlineState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-6 rounded-xl border border-[#EEE7DF] bg-white p-6 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[#6B7280]">{text}</p>
    </div>
  );
}

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalText(form: FormData, key: string) {
  const value = readText(form, key);
  return value ? value : null;
}

function readNumber(form: FormData, key: string) {
  return Number(readText(form, key));
}

function formatLocation(locationType: LocationType) {
  return (
    locationOptions.find((option) => option.value === locationType)?.label ??
    locationType
  );
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function PriceField({
  priceAmount,
  priceCurrency,
}: {
  priceAmount: number | null;
  priceCurrency: string;
}) {
  const defaultDollars =
    priceAmount != null ? (priceAmount / 100).toFixed(2) : "";

  return (
    <div>
      <span className="text-sm font-bold">Price</span>
      <p className="mb-2 text-xs text-[#9CA3AF]">
        Leave blank to show &ldquo;Price on request&rdquo;.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-sm text-[#9CA3AF]">
            $
          </span>
          <input
            name="priceInput"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            defaultValue={defaultDollars}
            className="h-11 w-full rounded-xl border border-[#E8DED7] bg-[#FFFBF7] pl-7 pr-3 text-sm outline-none placeholder:text-[#B8C0CC] focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
          />
        </div>
        <select
          name="priceCurrency"
          defaultValue={priceCurrency}
          className="h-11 rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-3 text-sm outline-none focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
        >
          {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
