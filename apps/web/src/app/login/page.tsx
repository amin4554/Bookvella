import { AuthCard } from "@/components/auth-card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;

  return (
    <AuthCard
      mode="login"
      state={state === "error" || state === "loading" ? state : "default"}
    />
  );
}
