import { permanentRedirect } from "next/navigation";
import { PublicBooking } from "@/components/public-booking";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ hostSlug: string; eventSlug: string }>;
  searchParams: Promise<{
    step?: string;
    reviewBooking?: string;
    reviewToken?: string;
  }>;
}) {
  const { hostSlug, eventSlug } = await params;
  const { step, reviewBooking, reviewToken } = await searchParams;

  // If the public event lookup 404s, fall through to the redirect table so
  // links shared before a slug change still resolve.
  try {
    const probe = await fetch(
      `${API_URL}/public/${encodeURIComponent(hostSlug)}/${encodeURIComponent(eventSlug)}`,
      { cache: "no-store" },
    );
    if (probe.status === 404) {
      const redirect = await resolveLinkRedirect(hostSlug, eventSlug);
      if (redirect?.hostSlug && redirect.eventSlug) {
        permanentRedirect(`/${redirect.hostSlug}/${redirect.eventSlug}`);
      } else if (redirect?.hostSlug) {
        permanentRedirect(`/${redirect.hostSlug}`);
      }
    }
  } catch (error) {
    if (isRedirectError(error)) throw error;
    // Non-404 upstream errors fall through to the client component which has
    // its own error display.
  }

  return (
    <PublicBooking
      hostSlug={hostSlug}
      eventSlug={eventSlug}
      initialStep={step}
      reviewBookingId={reviewBooking}
      reviewToken={reviewToken}
    />
  );
}

type RedirectResolution = { hostSlug: string; eventSlug: string | null };

async function resolveLinkRedirect(
  hostSlug: string,
  eventSlug: string,
): Promise<RedirectResolution | null> {
  try {
    const params = new URLSearchParams({ hostSlug, eventSlug });
    const res = await fetch(`${API_URL}/public/link-redirect?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      redirect: RedirectResolution | null;
    };
    return body.redirect;
  } catch {
    return null;
  }
}

function isRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
