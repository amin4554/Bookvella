import { PublicBooking } from "@/components/public-booking";

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
