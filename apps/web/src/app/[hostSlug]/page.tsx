import { notFound } from "next/navigation";
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
      notFound();
    }
    if (!res.ok) {
      throw new Error(`Upstream ${res.status}`);
    }
    data = (await res.json()) as PublicHostProfile;
  } catch {
    notFound();
  }

  if (!data) notFound();

  return <PublicHostProfileView data={data} />;
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
