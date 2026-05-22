import { AuthCard } from "@/components/auth-card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string; state?: string }>;
}) {
  const { next, reason, state } = await searchParams;

  return (
    <AuthCard
      mode="login"
      state={state === "error" || state === "loading" ? state : "default"}
      message={
        reason === "session_expired"
          ? "Your session expired. Please sign in again."
          : undefined
      }
      redirectTo={next}
    />
  );
}
