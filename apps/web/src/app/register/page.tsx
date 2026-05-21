import { AuthCard } from "@/components/auth-card";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;

  return (
    <AuthCard
      mode="register"
      state={state === "error" || state === "loading" ? state : "default"}
    />
  );
}
