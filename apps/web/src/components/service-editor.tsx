"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Image as ImageIcon,
  Info,
  Lightbulb,
  MapPin,
  Phone,
  Plus,
  Rocket,
  Save,
  Scissors,
  TriangleAlert,
  Upload,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  authedApiRequest,
  type EventType,
  type LocationType,
  type PriceType,
  type PublicUser,
  publicBookingUrl,
  uploadImage,
} from "@/lib/api";

type ServiceEditorProps = {
  user: PublicUser;
  initial: EventType | null;
};

const CATEGORIES = [
  "Barbering",
  "Hair & Beauty",
  "Fitness",
  "Coaching",
  "Photography",
  "Tutoring",
  "Other",
] as const;

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

const PREP_OPTIONS = [
  { value: 0, label: "None" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
];

const CLEANUP_OPTIONS = [
  { value: 0, label: "None" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
];

const LOCATION_TILES: {
  value: LocationType;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}[] = [
  {
    value: "IN_PERSON",
    label: "In person",
    hint: "At your studio or shop",
    icon: MapPin,
    iconColor: "text-[#FF5F63]",
  },
  {
    value: "VIDEO",
    label: "Video call",
    hint: "Zoom / Meet / Whereby",
    icon: Video,
    iconColor: "text-[#A855F7]",
  },
  {
    value: "PHONE",
    label: "Phone call",
    hint: "Old-school, still works",
    icon: Phone,
    iconColor: "text-[#0D9488]",
  },
  // No fourth backend location type yet — surface as "In person" + travel hint.
  // Kept for design parity; persists as IN_PERSON.
  {
    value: "IN_PERSON",
    label: "I travel to guest",
    hint: "House calls / mobile",
    icon: Car,
    iconColor: "text-[#D97706]",
  },
];

const PRICE_TYPE_OPTIONS: {
  value: PriceType;
  label: string;
  hint: string;
}[] = [
  { value: "FIXED", label: "Fixed", hint: "A single price, e.g. £40" },
  {
    value: "FROM",
    label: "Starts at",
    hint: "From £40 — final price varies",
  },
  {
    value: "RANGE",
    label: "Range",
    hint: "£30 – £60 depending on guest",
  },
  {
    value: "FREE",
    label: "Free / on request",
    hint: "Don't show a price publicly",
  },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "$",
  AUD: "$",
};

export function ServiceEditor({ user, initial }: ServiceEditorProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Basics
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [includedItems, setIncludedItems] = useState<string[]>(() =>
    parseList(initial?.whatIncluded),
  );
  const [duration, setDuration] = useState<number>(
    initial?.durationMinutes ?? 45,
  );
  const [prepMinutes, setPrepMinutes] = useState<number>(
    initial?.bufferBeforeMinutes ?? 0,
  );
  const [cleanupMinutes, setCleanupMinutes] = useState<number>(
    initial?.bufferAfterMinutes ?? 0,
  );
  const [locationType, setLocationType] = useState<LocationType>(
    initial?.locationType ?? "IN_PERSON",
  );
  const [locationDetails, setLocationDetails] = useState(
    initial?.locationDetails ?? "",
  );

  // Step 2 — Guest experience
  const [imageUrl, setImageUrl] = useState<string>(initial?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [gallery, setGallery] = useState<string[]>(
    initial?.galleryImageUrls ?? [],
  );
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [preparationNotes, setPreparationNotes] = useState(
    initial?.preparationNotes ?? "",
  );

  // Step 3 — Booking rules
  const [priceType, setPriceType] = useState<PriceType>(
    initial?.priceType ?? "FIXED",
  );
  const [priceLowerDollars, setPriceLowerDollars] = useState<string>(
    initial?.priceAmount != null ? (initial.priceAmount / 100).toFixed(2) : "",
  );
  const [priceUpperDollars, setPriceUpperDollars] = useState<string>(
    initial?.priceMaxAmount != null
      ? (initial.priceMaxAmount / 100).toFixed(2)
      : "",
  );
  const [priceCurrency, setPriceCurrency] = useState<string>(
    initial?.priceCurrency ?? "USD",
  );

  // Step 4 — Visibility
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [directLinkOnly, setDirectLinkOnly] = useState(
    initial?.directLinkOnly ?? false,
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  // Auto-derive slug from title until the user edits it manually.
  const [slugDirty, setSlugDirty] = useState(Boolean(initial?.slug));
  const computedSlug = useMemo(() => slugify(title), [title]);
  const effectiveSlug = slugDirty ? slug : computedSlug;

  const previewPriceLabel = formatPriceLabel({
    priceType,
    priceAmount: parseCents(priceLowerDollars),
    priceMaxAmount: parseCents(priceUpperDollars),
    priceCurrency,
  });

  const summaryReady = title.trim().length > 0 && effectiveSlug.length > 0;

  async function save(publish: boolean) {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        slug: effectiveSlug || undefined,
        category: category.trim() || null,
        imageUrl: imageUrl || null,
        galleryImageUrls: gallery,
        description: description.trim() || null,
        whatIncluded: joinList(includedItems) || null,
        preparationNotes: preparationNotes.trim() || null,
        locationType,
        locationDetails: locationDetails.trim() || null,
        durationMinutes: duration,
        bufferBeforeMinutes: prepMinutes,
        bufferAfterMinutes: cleanupMinutes,
        priceType,
        priceCurrency,
        priceAmount:
          priceType === "FREE"
            ? null
            : parseCents(priceLowerDollars),
        priceMaxAmount:
          priceType === "RANGE" ? parseCents(priceUpperDollars) : null,
        isFeatured,
        directLinkOnly,
        isActive: publish ? true : isActive,
      };

      const saved = await authedApiRequest<EventType>(
        initial ? `/event-types/${initial.id}` : "/event-types",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      toast.success(
        initial
          ? "Service updated"
          : publish
            ? "Service published"
            : "Draft saved",
      );

      router.push(`/dashboard/services`);
      router.refresh();
      // Avoid a stale local copy if the user navigates back.
      void saved;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save service",
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadMainImage(file: File) {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadImage(file);
      setImageUrl(uploaded.url);
      toast.success("Main photo uploaded");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not upload image",
      );
    } finally {
      setUploading(false);
    }
  }

  async function addGalleryImage(file: File) {
    if (gallery.length >= 5) {
      toast.error("Up to 5 extra photos");
      return;
    }
    setGalleryUploading(true);
    setError(null);
    try {
      const uploaded = await uploadImage(file);
      setGallery((current) => [...current, uploaded.url]);
      toast.success("Photo added");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not upload image",
      );
    } finally {
      setGalleryUploading(false);
    }
  }

  return (
    <div className="min-w-0">
      <div className="mx-auto max-w-[1380px] px-6 py-8 lg:px-10 lg:pt-10 lg:pb-14">
        {/* breadcrumb + title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] text-[#9CA3AF]">
              <Link
                href="/dashboard/services"
                className="hover:text-[#0B1220]"
              >
                Services
              </Link>{" "}
              /{" "}
              <span className="font-bold text-[#FF5F63]">
                {isEdit ? "Edit service" : "New service"}
              </span>
            </p>
            <h1
              className="mt-2 text-[36px] font-extrabold md:text-[42px]"
              style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
            >
              {isEdit ? `Edit "${initial?.title ?? "service"}"` : "Create a service"}
            </h1>
            <p className="mt-2 text-[14px] text-[#6B7280]">
              Tell guests what you offer so they know exactly what to expect.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/services"
              className="inline-flex h-11 items-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={!summaryReady || saving}
              onClick={() => save(false)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-60"
            >
              <Save className="size-4" /> Save draft
            </button>
            <button
              type="button"
              disabled={!summaryReady || saving}
              onClick={() => save(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
            >
              <Check className="size-4" /> Publish service
            </button>
          </div>
        </div>

        {/* step indicator */}
        <ol className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border border-[#EEE7DF] bg-white p-2 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)] md:grid-cols-4">
          <StepPill n={1} current={step} title="Basics" sub="Name, what & where" onClick={() => setStep(1)} />
          <StepPill n={2} current={step} title="Guest experience" sub="Photo, what's included" onClick={() => setStep(2)} />
          <StepPill n={3} current={step} title="Booking rules" sub="Buffer, notice, price" onClick={() => setStep(3)} />
          <StepPill n={4} current={step} title="Visibility" sub="Link & publish" onClick={() => setStep(4)} />
        </ol>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* two columns */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* form column */}
          <div className="space-y-6">
            {step === 1 ? (
              <Step1
                title={title}
                onTitle={setTitle}
                category={category}
                onCategory={setCategory}
                description={description}
                onDescription={setDescription}
                included={includedItems}
                onIncluded={setIncludedItems}
                duration={duration}
                onDuration={setDuration}
                prepMinutes={prepMinutes}
                onPrep={setPrepMinutes}
                cleanupMinutes={cleanupMinutes}
                onCleanup={setCleanupMinutes}
                locationType={locationType}
                onLocationType={setLocationType}
                locationDetails={locationDetails}
                onLocationDetails={setLocationDetails}
                onNext={() => setStep(2)}
              />
            ) : null}

            {step === 2 ? (
              <Step2
                imageUrl={imageUrl}
                onClearImage={() => setImageUrl("")}
                uploading={uploading}
                onUpload={uploadMainImage}
                gallery={gallery}
                galleryUploading={galleryUploading}
                onAddToGallery={addGalleryImage}
                onRemoveFromGallery={(idx) =>
                  setGallery((current) =>
                    current.filter((_, i) => i !== idx),
                  )
                }
                preparationNotes={preparationNotes}
                onPreparationNotes={setPreparationNotes}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            ) : null}

            {step === 3 ? (
              <Step3
                priceType={priceType}
                onPriceType={setPriceType}
                priceLowerDollars={priceLowerDollars}
                onPriceLower={setPriceLowerDollars}
                priceUpperDollars={priceUpperDollars}
                onPriceUpper={setPriceUpperDollars}
                priceCurrency={priceCurrency}
                onPriceCurrency={setPriceCurrency}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            ) : null}

            {step === 4 ? (
              <Step4
                hostSlug={user.slug}
                slug={effectiveSlug}
                onSlug={(value) => {
                  setSlug(value);
                  setSlugDirty(true);
                }}
                isEdit={isEdit}
                isFeatured={isFeatured}
                onIsFeatured={setIsFeatured}
                directLinkOnly={directLinkOnly}
                onDirectLinkOnly={setDirectLinkOnly}
                isActive={isActive}
                onIsActive={setIsActive}
                readinessChecklist={{
                  hasTitle: title.trim().length > 0,
                  hasDuration: duration > 0,
                  hasLocation: locationType.length > 0,
                  hasPrice:
                    priceType === "FREE" ||
                    (priceType !== "RANGE" && priceLowerDollars.length > 0) ||
                    (priceType === "RANGE" &&
                      priceLowerDollars.length > 0 &&
                      priceUpperDollars.length > 0),
                }}
                onBack={() => setStep(3)}
                onPublish={() => save(true)}
                saving={saving}
              />
            ) : null}
          </div>

          {/* right column: preview + tips */}
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <PreviewCard
              title={title || "New service"}
              duration={duration}
              locationLabel={
                LOCATION_TILES.find((tile) => tile.value === locationType)
                  ?.label ?? "In person"
              }
              priceLabel={previewPriceLabel}
              description={description}
              included={includedItems}
              imageUrl={imageUrl}
            />

            <div className="rounded-2xl border border-[#E1CFFA] bg-[#F8F1FF] p-5">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white text-[#A855F7]">
                  <Lightbulb className="size-4" />
                </span>
                <p className="text-[14px] font-bold text-[#5B21B6]">
                  Tips for a great listing
                </p>
              </div>
              <ul className="mt-4 space-y-2.5 text-[13px] leading-[1.55] text-[#374151]">
                <TipLine text="Use a clear, guest-friendly service name" />
                <TipLine text="Describe what's included so guests know what to expect" />
                <TipLine text="Add cleanup time to avoid back-to-back stress" />
                <TipLine text="Set the address so guests can plan their route" />
              </ul>
            </div>

            <div className="rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Your service link
              </p>
              <p className="mt-2 text-[13px] tabular-nums">
                <span className="text-[#9CA3AF]">
                  bookvella.com/{user.slug}/
                </span>
                <span className="font-bold text-[#0B1220]">
                  {effectiveSlug || "new-service"}
                </span>
              </p>
              <p className="mt-2 text-[11px] text-[#9CA3AF]">
                Auto-generated from the name. Customize it in Step 4 — Visibility.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StepPill({
  n,
  current,
  title,
  sub,
  onClick,
}: {
  n: 1 | 2 | 3 | 4;
  current: 1 | 2 | 3 | 4;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  const state = n === current ? "on" : n < current ? "done" : "todo";
  const dotClass =
    state === "on"
      ? "bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-white"
      : state === "done"
        ? "bg-[#10B981] text-white"
        : "bg-[#F3F4F6] text-[#9CA3AF]";
  const labelClass =
    state === "on"
      ? "text-[#FF5F63]"
      : state === "done"
        ? "text-[#10B981]"
        : "text-[#9CA3AF]";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
      >
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${dotClass}`}
        >
          {state === "done" ? <Check className="size-4" /> : n}
        </span>
        <span className="min-w-0 leading-tight">
          <span className={`text-[12px] font-bold ${labelClass}`}>{title}</span>
          <span className="block text-[11px] text-[#9CA3AF]">{sub}</span>
        </span>
      </button>
    </li>
  );
}

/* ============ STEP 1 ============ */

function Step1(props: {
  title: string;
  onTitle: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
  included: string[];
  onIncluded: (v: string[]) => void;
  duration: number;
  onDuration: (v: number) => void;
  prepMinutes: number;
  onPrep: (v: number) => void;
  cleanupMinutes: number;
  onCleanup: (v: number) => void;
  locationType: LocationType;
  onLocationType: (v: LocationType) => void;
  locationDetails: string;
  onLocationDetails: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <>
      <Card eyebrow="What service do you offer?" head="Tell guests what they're booking">
        <div className="space-y-5">
          <FieldText
            label="Service name"
            value={props.title}
            onChange={props.onTitle}
            placeholder="60-min massage, 1-on-1 coaching call…"
            help={`Use a name guests will immediately understand.`}
          />

          <div>
            <FieldEyebrow>Category</FieldEyebrow>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => props.onCategory(cat)}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-bold ${
                    props.category === cat
                      ? "border-[#FCC9C5] bg-[#FFF0EF] text-[#FF5F63]"
                      : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#FFFBF7]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <FieldTextArea
            label="Description"
            value={props.description}
            onChange={props.onDescription}
            rows={4}
            help="This appears on your public booking page. Keep it short and human."
            placeholder="A precision cut tailored to your style…"
          />

          <div>
            <FieldEyebrow>What&apos;s included</FieldEyebrow>
            <div className="mt-2 space-y-2">
              {props.included.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#E6F4EA] text-[#16A34A]">
                    <Check className="size-4" />
                  </span>
                  <input
                    value={item}
                    onChange={(event) => {
                      const next = [...props.included];
                      next[idx] = event.target.value;
                      props.onIncluded(next);
                    }}
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm font-medium outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]"
                    placeholder="e.g. Full cut, fade and detail work"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      props.onIncluded(
                        props.included.filter((_, i) => i !== idx),
                      )
                    }
                    aria-label="Remove"
                    className="rounded-md p-2 text-[#9CA3AF] hover:text-[#B91C1C]"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => props.onIncluded([...props.included, ""])}
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#FF5F63]"
            >
              <Plus className="size-3.5" /> Add another item
            </button>
          </div>
        </div>
      </Card>

      <Card eyebrow="How long does it take?" head="Set duration and breathing room">
        <div className="space-y-5">
          <div>
            <FieldEyebrow>Duration</FieldEyebrow>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {DURATION_PRESETS.map((mins) => (
                <Tile
                  key={mins}
                  selected={props.duration === mins}
                  onClick={() => props.onDuration(mins)}
                  main={String(mins)}
                  sub={`min · ${labelForDuration(mins)}`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSelectNumber
              label="Prep time"
              optional
              value={props.prepMinutes}
              onChange={props.onPrep}
              options={PREP_OPTIONS}
              help="Time you block before the appointment starts."
            />
            <FieldSelectNumber
              label="Cleanup time"
              optional
              value={props.cleanupMinutes}
              onChange={props.onCleanup}
              options={CLEANUP_OPTIONS}
              help="Gap between this and the next booking."
            />
          </div>
        </div>
      </Card>

      <Card eyebrow="Where does it happen?" head="Pick the location type">
        <div className="space-y-5">
          <div>
            <FieldEyebrow>Location type</FieldEyebrow>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {LOCATION_TILES.map((tile, idx) => {
                const TileIcon = tile.icon;
                const selected =
                  props.locationType === tile.value &&
                  // Treat the "I travel to guest" tile separately for visual selection
                  // since two tiles share the IN_PERSON enum value. We use the index.
                  selectedLocationTileIdx(
                    props.locationType,
                    props.locationDetails,
                  ) === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      props.onLocationType(tile.value);
                      if (idx === 3 && !props.locationDetails) {
                        props.onLocationDetails("I travel to the guest");
                      }
                    }}
                    className={`rounded-2xl border p-3 text-left transition ${
                      selected
                        ? "border-[#FCC9C5] bg-[#FFF0EF]"
                        : "border-[#E5E7EB] bg-white hover:border-[#FCC9C5] hover:bg-[#FFF9F8]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TileIcon className={`size-4 ${tile.iconColor}`} />
                      <p className="text-[13px] font-bold">{tile.label}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-[#9CA3AF]">
                      {tile.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <FieldText
            label="Location details"
            value={props.locationDetails}
            onChange={props.onLocationDetails}
            placeholder="Studio address, video link details, or phone instructions"
            help="Visible only after a guest confirms their booking."
          />
        </div>
      </Card>

      <StepFooter
        step={1}
        onNext={props.onNext}
        nextLabel="Continue to guest experience"
      />
    </>
  );
}

function selectedLocationTileIdx(
  type: LocationType,
  details: string,
): number {
  if (type === "VIDEO") return 1;
  if (type === "PHONE") return 2;
  if (
    type === "IN_PERSON" &&
    details.toLowerCase().includes("travel")
  )
    return 3;
  return 0;
}

/* ============ STEP 2 ============ */

function Step2(props: {
  imageUrl: string;
  onClearImage: () => void;
  uploading: boolean;
  onUpload: (file: File) => void;
  gallery: string[];
  galleryUploading: boolean;
  onAddToGallery: (file: File) => void;
  onRemoveFromGallery: (index: number) => void;
  preparationNotes: string;
  onPreparationNotes: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <Card eyebrow="Main photo" head="The one image guests see first">
        <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
          <div
            className="relative h-[200px] overflow-hidden rounded-2xl bg-cover bg-center"
            style={{
              background: props.imageUrl
                ? `url(${props.imageUrl}) center/cover`
                : "linear-gradient(135deg,#FFE0DA 0%,#FFD3A6 60%,#FFC9C2 100%)",
            }}
          >
            {!props.imageUrl ? (
              <div className="absolute inset-0 grid place-items-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-white/70 text-[#FF5F63] backdrop-blur">
                  <ImageIcon className="size-6" />
                </span>
              </div>
            ) : null}
            {props.imageUrl ? (
              <button
                type="button"
                onClick={props.onClearImage}
                className="absolute right-2 top-2 inline-flex h-7 items-center gap-1 rounded-md bg-white/90 px-2 text-[11px] font-bold text-[#B91C1C]"
              >
                <X className="size-3.5" /> Remove
              </button>
            ) : null}
          </div>
          <div>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-4 text-[13px] font-bold text-white shadow-sm">
              <Upload className="size-4" />
              {props.uploading ? "Uploading…" : "Upload main photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={props.uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) props.onUpload(file);
                }}
              />
            </label>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[#6B7280]">
              Aim for a horizontal photo, 1200×800 or larger.
            </p>
            <ul className="mt-3 space-y-1 text-[11.5px] text-[#9CA3AF]">
              <li className="flex items-center gap-1.5">
                <Check className="size-3 text-[#16A34A]" /> JPG or PNG, up to 10
                MB
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="size-3 text-[#16A34A]" /> Avoid logos or text
                over the photo
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="size-3 text-[#16A34A]" /> Real work, not stock
                imagery
              </li>
            </ul>
          </div>
        </div>
      </Card>

      <Card
        eyebrow="More photos"
        head={`Add up to 5 more`}
        headRight={
          <p className="text-[11px] text-[#9CA3AF]">
            <span className="font-bold tabular-nums text-[#0B1220]">
              {props.gallery.length}
            </span>{" "}
            / 5 added
          </p>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {props.gallery.map((url, idx) => (
            <div
              key={idx}
              className="relative aspect-square overflow-hidden rounded-xl bg-cover bg-center"
              style={{ backgroundImage: `url(${url})` }}
            >
              <button
                type="button"
                onClick={() => props.onRemoveFromGallery(idx)}
                aria-label="Remove"
                className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md bg-white/90 text-[#B91C1C] shadow"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {props.gallery.length < 5 ? (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-[#FCC9C5] bg-[#FFF7F5] text-[#FF5F63] hover:bg-[#FFF0EF]">
              <div className="text-center">
                <Plus className="mx-auto size-5" />
                <p className="mt-1 text-[11px] font-bold">
                  {props.galleryUploading ? "Uploading…" : "Add photo"}
                </p>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={props.galleryUploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) props.onAddToGallery(file);
                }}
              />
            </label>
          ) : null}
          {Array.from({ length: Math.max(0, 4 - props.gallery.length) }).map(
            (_, slotIdx) => (
              <div
                key={`slot-${slotIdx}`}
                className="aspect-square rounded-xl border border-dashed border-[#EEE7DF] bg-[#FFFBF7]"
              />
            ),
          )}
        </div>
        <p className="mt-4 text-[12px] text-[#6B7280]">
          Show your space, your work, and what guests can expect. The first
          photo is the main one used in listings and emails.
        </p>
      </Card>

      <Card eyebrow="What to expect" head="Set the right expectation before guests arrive">
        <FieldTextArea
          label="Before the appointment"
          optional
          value={props.preparationNotes}
          onChange={props.onPreparationNotes}
          rows={3}
          placeholder="Please arrive 5 minutes early. Bring a reference photo if you have one. Plenty of street parking nearby."
          help="Shown on the booking page and in the confirmation email."
        />
      </Card>

      <StepFooter
        step={2}
        onBack={props.onBack}
        onNext={props.onNext}
        nextLabel="Continue to booking rules"
      />
    </>
  );
}

/* ============ STEP 3 ============ */

function Step3(props: {
  priceType: PriceType;
  onPriceType: (v: PriceType) => void;
  priceLowerDollars: string;
  onPriceLower: (v: string) => void;
  priceUpperDollars: string;
  onPriceUpper: (v: string) => void;
  priceCurrency: string;
  onPriceCurrency: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const symbol = CURRENCY_SYMBOLS[props.priceCurrency] ?? "$";
  return (
    <>
      <Card eyebrow="Price" head="What will this cost?">
        <div className="space-y-5">
          <div>
            <FieldEyebrow>How is your price shown?</FieldEyebrow>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {PRICE_TYPE_OPTIONS.map((option) => (
                <Tile
                  key={option.value}
                  selected={props.priceType === option.value}
                  onClick={() => props.onPriceType(option.value)}
                  align="left"
                >
                  <p className="text-[13px] font-bold">{option.label}</p>
                  <p className="mt-1 text-[11px] text-[#9CA3AF]">
                    {option.hint}
                  </p>
                </Tile>
              ))}
            </div>
          </div>

          {props.priceType === "FIXED" ? (
            <CurrencyInput
              label="Price"
              symbol={symbol}
              value={props.priceLowerDollars}
              onChange={props.onPriceLower}
              currency={props.priceCurrency}
              onCurrency={props.onPriceCurrency}
            />
          ) : null}

          {props.priceType === "FROM" ? (
            <CurrencyInput
              label="Starts at"
              symbol={`${symbol}`}
              prefix={`From ${symbol}`}
              value={props.priceLowerDollars}
              onChange={props.onPriceLower}
              currency={props.priceCurrency}
              onCurrency={props.onPriceCurrency}
              help={`Guests see "from ${symbol}${props.priceLowerDollars || "—"}". Final amount is agreed with you.`}
            />
          ) : null}

          {props.priceType === "RANGE" ? (
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CurrencyInput
                  label="From"
                  symbol={symbol}
                  value={props.priceLowerDollars}
                  onChange={props.onPriceLower}
                  currency={props.priceCurrency}
                  onCurrency={props.onPriceCurrency}
                />
                <CurrencyInput
                  label="To"
                  symbol={symbol}
                  value={props.priceUpperDollars}
                  onChange={props.onPriceUpper}
                  currency={props.priceCurrency}
                  onCurrency={props.onPriceCurrency}
                />
              </div>
              <p className="mt-2 text-[11px] text-[#9CA3AF]">
                Guests see &ldquo;{symbol}
                {props.priceLowerDollars || "—"} – {symbol}
                {props.priceUpperDollars || "—"}&rdquo;.
              </p>
            </div>
          ) : null}

          {props.priceType === "FREE" ? (
            <div className="flex items-start gap-3 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3">
              <Info className="mt-0.5 size-4 text-[#9CA3AF]" />
              <p className="text-[12px] leading-snug text-[#6B7280]">
                No price will be shown publicly. Use this for free consultations
                or services where the price is agreed directly with each guest.
              </p>
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3">
            <Info className="mt-0.5 size-4 text-[#9CA3AF]" />
            <p className="text-[12px] leading-snug text-[#6B7280]">
              Payment happens directly with you — Bookvella never takes a cut
              and doesn&apos;t process payments.
            </p>
          </div>
        </div>
      </Card>

      <div className="rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white text-[#FF5F63]">
            <Clock className="size-4" />
          </span>
          <div className="flex-1">
            <p className="text-[13.5px] font-bold">
              Notice, horizon, and slot spacing live in Availability
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-[#6B7280]">
              Minimum notice, how far ahead guests can book, slot increments,
              and daily limits apply to every service.{" "}
              <Link
                href="/dashboard/availability"
                className="font-bold text-[#FF5F63] hover:underline"
              >
                Manage in Availability →
              </Link>
            </p>
          </div>
        </div>
      </div>

      <StepFooter
        step={3}
        onBack={props.onBack}
        onNext={props.onNext}
        nextLabel="Continue to visibility"
      />
    </>
  );
}

/* ============ STEP 4 ============ */

function Step4(props: {
  hostSlug: string;
  slug: string;
  onSlug: (v: string) => void;
  isEdit: boolean;
  isFeatured: boolean;
  onIsFeatured: (v: boolean) => void;
  directLinkOnly: boolean;
  onDirectLinkOnly: (v: boolean) => void;
  isActive: boolean;
  onIsActive: (v: boolean) => void;
  readinessChecklist: {
    hasTitle: boolean;
    hasDuration: boolean;
    hasLocation: boolean;
    hasPrice: boolean;
  };
  onBack: () => void;
  onPublish: () => void;
  saving: boolean;
}) {
  const allReady =
    props.readinessChecklist.hasTitle &&
    props.readinessChecklist.hasDuration &&
    props.readinessChecklist.hasLocation &&
    props.readinessChecklist.hasPrice;
  return (
    <>
      <Card eyebrow="Public link" head="Where guests will book this service">
        <div className="space-y-5">
          <div>
            <FieldEyebrow>Service URL</FieldEyebrow>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="flex h-11 items-center whitespace-nowrap rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] px-3 text-[13px] tabular-nums text-[#9CA3AF]">
                bookvella.com/{props.hostSlug}/
              </span>
              <input
                value={props.slug}
                onChange={(event) =>
                  props.onSlug(event.target.value.toLowerCase())
                }
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm font-medium tabular-nums outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      publicBookingUrl(props.hostSlug, props.slug),
                    );
                    toast.success("Link copied");
                  } catch {
                    toast.error("Copy failed");
                  }
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 text-[#9CA3AF] hover:text-[#FF5F63]"
                aria-label="Copy link"
              >
                <Copy className="size-4" />
              </button>
            </div>
          </div>

          {props.isEdit ? (
            <div className="rounded-xl border border-[#FCC9C5] bg-[#FFF5F4] p-4">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-4 text-[#DC2626]" />
                <div>
                  <p className="text-[12.5px] font-bold text-[#B91C1C]">
                    Changing the URL breaks existing shared links
                  </p>
                  <p className="mt-1 text-[12px] text-[#7c2222]">
                    If anyone has already shared this booking page, the old URL
                    will 404.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card eyebrow="Listing visibility" head="Where this service appears">
        <div className="divide-y divide-[#EEE7DF]">
          <ToggleRow
            title="Show on my public profile"
            sub={`Listed at bookvella.com/${props.hostSlug} alongside other services.`}
            on={!props.directLinkOnly}
            onChange={(value) => props.onDirectLinkOnly(!value)}
          />
          <ToggleRow
            title="Direct-link only"
            sub="Hide from your profile — only guests with the link can book."
            on={props.directLinkOnly}
            onChange={props.onDirectLinkOnly}
          />
          <ToggleRow
            title="Featured service"
            sub="Pin to the top of your public profile."
            on={props.isFeatured}
            onChange={props.onIsFeatured}
          />
          {props.isEdit ? (
            <ToggleRow
              title="Active and bookable"
              sub="Deactivating hides this service and stops new bookings. Existing bookings stay."
              on={props.isActive}
              onChange={props.onIsActive}
            />
          ) : null}
        </div>
      </Card>

      <section
        className={`rounded-2xl border p-6 ${
          allReady
            ? "border-[#A7F3D0] bg-[#ECFDF5]"
            : "border-[#FDE68A] bg-[#FFFBEB]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex size-10 items-center justify-center rounded-xl bg-white ${
              allReady ? "text-[#16A34A]" : "text-[#D97706]"
            }`}
          >
            <CheckCheck className="size-5" />
          </span>
          <div>
            <p
              className={`text-[15px] font-bold ${
                allReady ? "text-[#065F46]" : "text-[#92400E]"
              }`}
            >
              {allReady ? "Ready to publish" : "Almost there"}
            </p>
            <p
              className={`text-[12.5px] ${
                allReady ? "text-[#047857]" : "text-[#92400E]"
              }`}
            >
              {allReady
                ? "All required details are set. Guests can book as soon as you publish."
                : "Fill in the remaining details below to publish."}
            </p>
          </div>
        </div>
        <ul
          className={`mt-4 grid gap-2 text-[12.5px] sm:grid-cols-2 ${
            allReady ? "text-[#065F46]" : "text-[#92400E]"
          }`}
        >
          <ReadyLine ok={props.readinessChecklist.hasTitle} label="Name & description set" />
          <ReadyLine ok={props.readinessChecklist.hasDuration} label="Duration chosen" />
          <ReadyLine ok={props.readinessChecklist.hasLocation} label="Location confirmed" />
          <ReadyLine ok={props.readinessChecklist.hasPrice} label="Price configured" />
        </ul>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE7DF] bg-white p-3 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
        <button
          type="button"
          onClick={props.onBack}
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-bold text-[#6B7280] hover:text-[#0B1220]"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-[#9CA3AF]">Step 4 of 4</p>
          <button
            type="button"
            disabled={props.saving || !allReady}
            onClick={props.onPublish}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
          >
            <Rocket className="size-4" /> Publish service
          </button>
        </div>
      </div>
    </>
  );
}

function ReadyLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <Check className={`size-3.5 ${ok ? "" : "opacity-30"}`} /> {label}
    </li>
  );
}

/* ============ PREVIEW ============ */

function PreviewCard({
  title,
  duration,
  locationLabel,
  priceLabel,
  description,
  included,
  imageUrl,
}: {
  title: string;
  duration: number;
  locationLabel: string;
  priceLabel: string | null;
  description: string;
  included: string[];
  imageUrl: string;
}) {
  return (
    <div className="rounded-2xl border border-[#EEE7DF] bg-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="flex items-center justify-between border-b border-[#EEE7DF] px-5 py-3">
        <p className="text-[13px] font-bold">Guest preview</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-2 py-0.5 text-[10px] font-bold text-[#16A34A]">
          <span className="size-1.5 rounded-full bg-[#16A34A]" /> Live
        </span>
      </div>
      <div className="p-5">
        <div className="rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center overflow-hidden rounded-xl text-white"
              style={{
                background: imageUrl
                  ? `url(${imageUrl}) center/cover`
                  : "linear-gradient(135deg,#FF6267,#FF8A4C)",
              }}
            >
              {!imageUrl ? <Scissors className="size-4" /> : null}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[14px] font-bold">{title}</p>
              <p className="text-[11px] text-[#6B7280] tabular-nums">
                {duration} min · {locationLabel}
                {priceLabel ? ` · ${priceLabel}` : ""}
              </p>
            </div>
          </div>
          {description ? (
            <p className="mt-3 line-clamp-3 text-[12px] leading-[1.6] text-[#374151]">
              {description}
            </p>
          ) : null}
          {included.filter((v) => v.trim().length > 0).length > 0 ? (
            <div className="mt-3 border-t border-[#EEE7DF] pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                What&apos;s included
              </p>
              <ul className="mt-1.5 space-y-1 text-[11px] text-[#374151]">
                {included
                  .filter((v) => v.trim().length > 0)
                  .slice(0, 5)
                  .map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-3 text-[#16A34A]" /> {item}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            disabled
            className="mt-4 h-10 w-full rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-[12px] font-bold text-white shadow-sm opacity-90"
          >
            Book this service
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-[#9CA3AF]">
          Updates as you edit.
        </p>
      </div>
    </div>
  );
}

/* ============ shared bits ============ */

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
    <section className="rounded-[18px] border border-[#EEE7DF] bg-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEE7DF] px-5 py-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#9CA3AF]">
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
    <span className="text-[12px] font-bold uppercase tracking-[0.10em] text-[#6B7280]">
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  help?: string;
}) {
  return (
    <label className="block">
      <FieldEyebrow>{label}</FieldEyebrow>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm font-medium outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]"
      />
      {help ? (
        <p className="mt-1.5 text-[11px] text-[#9CA3AF]">{help}</p>
      ) : null}
    </label>
  );
}

function FieldTextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  help,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  help?: string;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <FieldEyebrow>
        {label}
        {optional ? (
          <span className="ml-1 font-normal normal-case tracking-normal text-[#9CA3AF]">
            optional
          </span>
        ) : null}
      </FieldEyebrow>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-3 text-sm leading-[1.55] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]"
      />
      {help ? (
        <p className="mt-1.5 text-[11px] text-[#9CA3AF]">{help}</p>
      ) : null}
    </label>
  );
}

function FieldSelectNumber({
  label,
  optional,
  value,
  onChange,
  options,
  help,
}: {
  label: string;
  optional?: boolean;
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
  help?: string;
}) {
  return (
    <label className="block">
      <FieldEyebrow>
        {label}
        {optional ? (
          <span className="ml-1 font-normal normal-case tracking-normal text-[#9CA3AF]">
            optional
          </span>
        ) : null}
      </FieldEyebrow>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {help ? (
        <p className="mt-1.5 text-[11px] text-[#9CA3AF]">{help}</p>
      ) : null}
    </label>
  );
}

function Tile({
  selected,
  onClick,
  main,
  sub,
  children,
  align,
}: {
  selected: boolean;
  onClick: () => void;
  main?: string;
  sub?: string;
  children?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-3 transition ${
        align === "left" ? "text-left" : "text-center"
      } ${
        selected
          ? "border-[#FCC9C5] bg-[#FFF0EF]"
          : "border-[#E5E7EB] bg-white hover:border-[#FCC9C5] hover:bg-[#FFF9F8]"
      }`}
    >
      {children ? (
        children
      ) : (
        <>
          <p
            className={`text-[18px] font-extrabold ${selected ? "text-[#FF5F63]" : "text-[#0B1220]"}`}
          >
            {main}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#9CA3AF]">
            {sub}
          </p>
        </>
      )}
    </button>
  );
}

function ToggleRow({
  title,
  sub,
  on,
  onChange,
}: {
  title: string;
  sub: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-5">
      <div>
        <p className="text-[13px] font-bold">{title}</p>
        <p className="text-[12px] text-[#6B7280]">{sub}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-5 w-9 rounded-full transition ${
          on ? "bg-[#FF5F63]" : "bg-[#E5E7EB]"
        }`}
      >
        <span
          className={`absolute top-[3px] size-3.5 rounded-full bg-white shadow transition ${
            on ? "left-[19px]" : "left-[3px]"
          }`}
        />
      </button>
    </div>
  );
}

function CurrencyInput({
  label,
  symbol,
  prefix,
  value,
  onChange,
  currency,
  onCurrency,
  help,
}: {
  label: string;
  symbol: string;
  prefix?: string;
  value: string;
  onChange: (v: string) => void;
  currency: string;
  onCurrency: (v: string) => void;
  help?: string;
}) {
  return (
    <label className="block">
      <FieldEyebrow>{label}</FieldEyebrow>
      <div className="mt-1.5 flex">
        <span className="flex h-11 items-center rounded-l-xl border border-r-0 border-[#E5E7EB] bg-[#FFFBF7] px-3 text-[14px] font-bold text-[#6B7280]">
          {prefix ?? symbol}
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 min-w-0 flex-1 border-y border-[#E5E7EB] bg-white px-3.5 text-sm font-medium outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]"
        />
        <select
          value={currency}
          onChange={(event) => onCurrency(event.target.value)}
          className="h-11 rounded-r-xl border border-l-0 border-[#E5E7EB] bg-[#FFFBF7] px-3 text-sm font-medium outline-none"
        >
          {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {help ? (
        <p className="mt-1.5 text-[11px] text-[#9CA3AF]">{help}</p>
      ) : null}
    </label>
  );
}

function TipLine({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-1 size-3.5 text-[#7C3AED]" /> {text}
    </li>
  );
}

function StepFooter({
  step,
  onBack,
  onNext,
  nextLabel,
}: {
  step: 1 | 2 | 3 | 4;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE7DF] bg-white p-3 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-bold text-[#6B7280] hover:text-[#0B1220]"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
      ) : (
        <Link
          href="/dashboard/services"
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-bold text-[#6B7280] hover:text-[#0B1220]"
        >
          <ArrowLeft className="size-4" /> Back to services
        </Link>
      )}
      <div className="flex items-center gap-2">
        <p className="text-[11px] text-[#9CA3AF]">Step {step} of 4</p>
        {onNext ? (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
          >
            {nextLabel} <ArrowRight className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ============ helpers ============ */

function labelForDuration(mins: number) {
  if (mins <= 15) return "Quick";
  if (mins <= 30) return "Short";
  if (mins === 45) return "Standard";
  if (mins === 60) return "1 hour";
  if (mins === 90) return "Extended";
  return "Long";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCents(dollars: string): number | null {
  if (!dollars.trim()) return null;
  const float = parseFloat(dollars);
  if (Number.isNaN(float) || float < 0) return null;
  return Math.round(float * 100);
}

function parseList(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinList(items: string[]): string {
  return items.map((item) => item.trim()).filter(Boolean).join("\n");
}

function formatPriceLabel({
  priceType,
  priceAmount,
  priceMaxAmount,
  priceCurrency,
}: {
  priceType: PriceType;
  priceAmount: number | null;
  priceMaxAmount: number | null;
  priceCurrency: string;
}): string | null {
  if (priceType === "FREE") return null;
  const symbol = CURRENCY_SYMBOLS[priceCurrency] ?? "$";
  if (priceType === "RANGE" && priceAmount != null && priceMaxAmount != null) {
    return `${symbol}${(priceAmount / 100).toFixed(2)} – ${symbol}${(priceMaxAmount / 100).toFixed(2)}`;
  }
  if (priceAmount == null) return null;
  const base = `${symbol}${(priceAmount / 100).toFixed(2)}`;
  if (priceType === "FROM") return `From ${base}`;
  return base;
}
