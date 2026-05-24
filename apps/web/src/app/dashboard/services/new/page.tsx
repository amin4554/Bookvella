"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ServiceEditor } from "@/components/service-editor";
import { authedApiRequest, type PublicUser } from "@/lib/api";

export default function NewServicePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedApiRequest<PublicUser>("/auth/me")
      .then(setUser)
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Could not load profile",
        ),
      );
  }, []);

  return (
    <AppShell
      active="Services"
      title="New service"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {user ? <ServiceEditor user={user} initial={null} /> : null}
    </AppShell>
  );
}
