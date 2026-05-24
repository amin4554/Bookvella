"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ServiceEditor } from "@/components/service-editor";
import {
  authedApiRequest,
  type EventType,
  type PublicUser,
} from "@/lib/api";

export function EditServiceClient({ id }: { id: string }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [event, setEvent] = useState<EventType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authedApiRequest<PublicUser>("/auth/me"),
      authedApiRequest<EventType[]>("/event-types"),
    ])
      .then(([me, list]) => {
        if (cancelled) return;
        setUser(me);
        const match = list.find((entry) => entry.id === id) ?? null;
        if (!match) {
          setError("This service no longer exists or has been removed.");
        }
        setEvent(match);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : "Could not load service",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <AppShell
      active="Services"
      title="Edit service"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      {loading ? (
        <div className="mt-6 rounded-xl border border-[#EEE7DF] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#6B7280]">Loading service…</p>
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : user && event ? (
        <ServiceEditor user={user} initial={event} />
      ) : null}
    </AppShell>
  );
}
