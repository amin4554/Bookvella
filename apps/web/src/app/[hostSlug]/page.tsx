import { notFound, permanentRedirect } from "next/navigation";
import { PublicHostProfileView } from "./view";
import type { PublicHostProfile } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// Reserve internal app paths that share the `/{slug}` namespace. If someone
// types `/dashboard` we never want to query the backend for that user.
const RESERVED = new Set([
  "dashboard",
  "login",
  "register",
  "logout",
  "cancel",
  "settings",
  "bookings",
  "profile",
  "availability",
  "event-types",
  "services",
  "api",
  "auth",
  "admin",
  "support",
  "help",
  "media",
  "uploads",
  "reviews",
  "health",
  "public",
  "icon.png",
  "favicon.ico",
]);

export default async function HostProfilePage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;

  if (!hostSlug || RESERVED.has(hostSlug.toLowerCase())) {
    notFound();
  }

  let data: PublicHostProfile | null = null;
  try {
    const res = await fetch(
      `${API_URL}/public/host/${encodeURIComponent(hostSlug)}`,
      { cache: "no-store" },
    );
    if (res.status === 404) {
      const redirect = await resolveLinkRedirect(hostSlug);
      if (redirect?.hostSlug) {
        permanentRedirect(`/${redirect.hostSlug}`);
      }
      notFound();
    }
    if (!res.ok) {
      throw new Error(`Upstream ${res.status}`);
    }
    data = (await res.json()) as PublicHostProfile;
  } catch (error) {
    // permanentRedirect throws a NEXT_REDIRECT marker that Next.js handles
    // upstream — let it bubble. Anything else is treated as a hard 404.
    if (isRedirectError(error)) throw error;
    notFound();
  }

  if (!data) notFound();

  return <PublicHostProfileView data={data} />;
}

type RedirectResolution = { hostSlug: string; eventSlug: string | null };

async function resolveLinkRedirect(
  hostSlug: string,
  eventSlug?: string,
): Promise<RedirectResolution | null> {
  try {
    const params = new URLSearchParams({ hostSlug });
    if (eventSlug) params.set("eventSlug", eventSlug);
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  if (!hostSlug || RESERVED.has(hostSlug.toLowerCase())) {
    return { title: "Bookvella" };
  }

  try {
    const res = await fetch(
      `${API_URL}/public/host/${encodeURIComponent(hostSlug)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { title: "Bookvella" };
    const data = (await res.json()) as PublicHostProfile;
    return {
      title: `${data.host.name} — bookvella.com/${data.host.slug}`,
      description:
        data.host.headline ?? `Book ${data.host.name} on Bookvella.`,
    };
  } catch {
    return { title: "Bookvella" };
  }
}
