import Link from "next/link";
import { CalendarCheck, Clock3, Star } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FFFBF7] text-[#111827]">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-6">
        <BrandLogo />
        <nav className="flex items-center gap-3">
          <Link href="/login" className="rounded-2xl px-5 py-3 text-sm font-bold text-[#6B7280] hover:text-[#111827]">
            Sign in
          </Link>
          <Link href="/register" className="rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 py-3 text-sm font-bold text-white">
            Create free page
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-[1180px] gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <h1 className="max-w-[760px] text-[56px] font-bold leading-[1.04] tracking-normal md:text-[78px]">
            Get booked without the back-and-forth.
          </h1>
          <p className="mt-7 max-w-[610px] text-xl leading-8 text-[#6B7280]">
            Create a polished booking page, set your weekly hours, and share one link guests can use to book verified appointments.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="/register" className="rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-7 py-4 text-base font-bold text-white">
              Start for free
            </Link>
            <Link href="/login" className="rounded-2xl border border-[#E8DED7] bg-white px-7 py-4 text-base font-bold">
              Sign in
            </Link>
          </div>
          <div className="mt-10 grid max-w-[620px] gap-4 sm:grid-cols-3">
            <MiniStat value="5 min" label="to launch" icon={Clock3} />
            <MiniStat value="4.9" label="avg rating" icon={Star} />
            <MiniStat value="0%" label="commission" icon={CalendarCheck} />
          </div>
        </div>

        <div className="rounded-[36px] bg-gradient-to-br from-[#FF6865] via-[#FF8B52] to-[#A855F7] p-6 shadow-[0_30px_80px_rgba(255,95,99,0.28)]">
          <div className="rounded-[28px] bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-[#FF5F63]">Today</p>
                <h2 className="mt-2 text-3xl font-bold">4 appointments</h2>
              </div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF6267] to-[#A855F7] text-xl font-bold text-white">
                B
              </div>
            </div>
            <div className="mt-8 space-y-3">
              {[
                ["9:00 AM", "Fresh Cut Session", "James Thompson"],
                ["11:15 AM", "Beard Trim", "Aisha Mensah"],
                ["2:00 PM", "Intro Call", "David Kim"],
              ].map(([time, service, guest]) => (
                <div key={time} className="grid grid-cols-[86px_1fr] items-center rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
                  <div className="text-center text-sm font-bold text-[#FF5F63]">{time}</div>
                  <div>
                    <p className="font-bold">{guest}</p>
                    <p className="text-sm text-[#6B7280]">{service}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniStat({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[22px] border border-[#E8DED7] bg-white p-5">
      <Icon className="size-5 text-[#FF5F63]" />
      <p className="mt-4 text-2xl font-bold">{value}</p>
      <p className="text-sm text-[#6B7280]">{label}</p>
    </div>
  );
}
