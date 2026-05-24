import Link from "next/link";
import { ArrowRight, Check, Star } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LegalFooter } from "@/components/legal-footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FFFBF7] text-[#0B1220]">
      <SiteHeader />
      <Hero />
      <BuiltFor />
      <HowItWorks />
      <Examples />
      <ClosingCta />
      <LegalFooter />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#EEE7DF] bg-[#FFFBF7]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-[#374151] md:flex">
          <a href="#how" className="hover:text-black">
            How it works
          </a>
          <a href="#built-for" className="hover:text-black">
            Who it&apos;s for
          </a>
          <a href="#examples" className="hover:text-black">
            Examples
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden h-9 items-center rounded-full px-4 text-sm font-semibold text-[#374151] hover:text-black md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-32 right-[-200px] h-[600px] w-[600px] rounded-full opacity-[0.45]"
        style={{
          background:
            "radial-gradient(closest-side,#FFD9D0 0%,#FFE9D6 35%,rgba(255,251,247,0) 75%)",
        }}
      />
      <div
        className="pointer-events-none absolute top-20 right-[120px] h-[280px] w-[280px] rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(closest-side,#EAD8FF 0%,rgba(255,251,247,0) 70%)",
        }}
      />

      <div className="mx-auto grid max-w-[1240px] gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-3.5 py-1.5 text-[13px] font-semibold text-[#854D0E]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Free for everyone, forever
          </span>
          <h1
            className="mt-6 text-[64px] font-extrabold md:text-[88px]"
            style={{ letterSpacing: "-0.035em", lineHeight: "0.98" }}
          >
            Book anyone.
            <br />
            From{" "}
            <span
              className="inline-block rounded-md px-[0.18em] text-[#0B1220]"
              style={{ background: "#E879F9", boxShadow: "0 0 0 0.06em #E879F9" }}
            >
              barbers
            </span>
            <br />
            to{" "}
            <span
              className="inline-block rounded-md px-[0.18em] text-[#0B1220]"
              style={{ background: "#FDBA74", boxShadow: "0 0 0 0.06em #FDBA74" }}
            >
              comedians
            </span>
            .
          </h1>
          <p className="mt-7 max-w-[520px] text-[17px] leading-[1.6] text-[#374151]">
            Bookvella makes it easy for service providers to share their booking
            link — and for guests to discover and book in seconds. No app needed.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center rounded-full bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-6 text-[15px] font-bold text-white shadow-sm hover:brightness-105"
            >
              Create your free page
              <ArrowRight className="ml-2 size-4" />
            </Link>
            <a
              href="#examples"
              className="inline-flex h-12 items-center rounded-full border border-[#0B1220] bg-white px-6 text-[15px] font-bold text-[#0B1220] hover:bg-[#0B1220] hover:text-white"
            >
              See an example page
            </a>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2 [&>*]:ring-2 [&>*]:ring-[#FFFBF7]">
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-[11px] font-bold text-white">
                M
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF] text-[11px] font-bold text-white">
                S
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#10B981] to-[#0EA5E9] text-[11px] font-bold text-white">
                J
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#EC4899] to-[#A855F7] text-[11px] font-bold text-white">
                K
              </span>
              <span className="flex size-8 items-center justify-center rounded-full border border-[#EEE7DF] bg-white text-[11px] font-bold text-[#6B7280]">
                +
              </span>
            </div>
            <p className="text-[13px] text-[#374151]">
              <span className="font-bold text-[#0B1220]">2,400+ hosts</span>{" "}
              <span className="text-[#6B7280]">
                already getting booked on Bookvella
              </span>
            </p>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div className="absolute -right-2 -top-2 z-10 hidden rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-3 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)] md:block">
        <div className="flex items-center gap-2">
          <Star className="size-4 fill-amber-400 text-amber-500" />
          <div className="leading-tight">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#92400E]">
              Avg rating
            </p>
            <p className="text-[14px] font-bold text-[#0B1220] tabular-nums">
              4.9 / 5.0
            </p>
          </div>
        </div>
      </div>

      <div
        className="relative rounded-[28px] border border-[#EEE7DF] bg-white p-6"
        style={{
          boxShadow:
            "0 1px 0 rgba(17,24,39,0.04), 0 30px 60px -28px rgba(255,95,99,0.28), 0 16px 40px -24px rgba(168,85,247,0.18)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF] text-base font-bold text-white">
            M
          </div>
          <div className="leading-tight">
            <p className="text-base font-bold">Marcus Williams</p>
            <p className="text-xs text-[#6B7280]">Master Barber · London</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[19px] font-bold">Fresh Cut Session</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            45 minutes · Shoreditch Studio
          </p>
          <p className="mt-2 text-xs text-amber-500">
            ★★★★★ <span className="text-[#6B7280]">4.9 · 312 reviews</span>
          </p>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
            Available Thursday
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[
              { time: "10:00", active: false },
              { time: "11:30", active: true },
              { time: "13:00", active: false },
              { time: "14:30", active: false },
              { time: "16:00", active: false },
              { time: "17:00", active: false },
            ].map((slot) => (
              <button
                key={slot.time}
                type="button"
                className={
                  slot.active
                    ? "h-10 rounded-lg bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-[13px] font-bold text-white tabular-nums shadow-sm"
                    : "h-10 rounded-lg border border-[#EEE7DF] bg-white text-[13px] font-bold tabular-nums"
                }
              >
                {slot.time}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-sm font-bold text-white shadow-sm"
        >
          Book this slot →
        </button>
      </div>

      <div className="absolute -bottom-4 -left-4 z-10 hidden w-[230px] rounded-2xl border border-[#D5EBDB] bg-white p-3 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)] md:block">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-[#10B981] text-white">
            <Check className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight">Booking confirmed!</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#6B7280]">
              Reminder email on its way.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BuiltFor() {
  const items: { letter: string; title: string; sub: string; bg: string }[] = [
    {
      letter: "B",
      title: "Barbers & stylists",
      sub: "Cuts, fades, beard work",
      bg: "bg-gradient-to-r from-[#FF6267] to-[#FF8A4C]",
    },
    {
      letter: "C",
      title: "Comedians",
      sub: "Sets, tours, private gigs",
      bg: "bg-gradient-to-br from-[#FF8A4C] to-[#FF6267]",
    },
    {
      letter: "F",
      title: "Trainers & coaches",
      sub: "PT, programs, check-ins",
      bg: "bg-gradient-to-br from-[#10B981] to-[#0EA5E9]",
    },
    {
      letter: "B",
      title: "Beauty & nails",
      sub: "Sittings, sets, fittings",
      bg: "bg-gradient-to-br from-[#EC4899] to-[#A855F7]",
    },
    {
      letter: "T",
      title: "Tutors",
      sub: "1:1 lessons, exam prep",
      bg: "bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF]",
    },
    {
      letter: "C",
      title: "Consultants",
      sub: "Intro calls, advisory",
      bg: "bg-gradient-to-br from-[#22C55E] to-[#10B981]",
    },
  ];
  return (
    <section id="built-for" className="border-t border-[#EEE7DF] bg-white">
      <div className="mx-auto max-w-[1240px] px-6 py-20 lg:py-24">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9CA3AF]">
            Built for independents
          </p>
          <h2
            className="mt-3 text-[36px] font-extrabold md:text-[48px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.04" }}
          >
            If your work runs on appointments,
            <br />
            Bookvella works for you.
          </h2>
          <p className="mt-3 text-[15px] text-[#6B7280]">
            One link, every service. From a single-chair barber to a touring
            comedian.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-center rounded-2xl border border-[#EEE7DF] bg-white p-5 text-center shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)]"
            >
              <div
                className={`flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm ${item.bg}`}
              >
                {item.letter}
              </div>
              <p className="mt-3 text-sm font-bold">{item.title}</p>
              <p className="text-[11px] text-[#9CA3AF]">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: 1,
      bg: "bg-gradient-to-r from-[#FF6267] to-[#FF8A4C]",
      title: "Create your profile",
      text: "Sign up free, add your services, set your weekly hours. Your personal booking page is live in under 5 minutes.",
    },
    {
      n: 2,
      bg: "bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF]",
      title: "Share your link",
      text: "Post your Bookvella link on Instagram, WhatsApp, or wherever your clients find you. No app install required for guests.",
    },
    {
      n: 3,
      bg: "bg-gradient-to-br from-[#10B981] to-[#0EA5E9]",
      title: "Get booked & earn reviews",
      text: "Clients pick a slot, confirm with email, and show up. After each appointment, they're invited to leave a star rating automatically.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-[1240px] px-6 py-20 lg:py-24">
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9CA3AF]">
          Simple by design
        </p>
        <h2
          className="mt-3 text-[36px] font-extrabold md:text-[48px]"
          style={{ letterSpacing: "-0.03em", lineHeight: "1.04" }}
        >
          Up and running in minutes
        </h2>
        <p className="mt-3 text-[15px] text-[#6B7280]">
          From signup to your first confirmed booking — about five minutes.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.n}
            className="rounded-2xl border border-[#EEE7DF] bg-white p-6 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)]"
          >
            <div
              className={`flex size-10 items-center justify-center rounded-xl text-sm font-bold text-white ${step.bg}`}
            >
              {step.n}
            </div>
            <p className="mt-5 text-lg font-bold">{step.title}</p>
            <p className="mt-2 text-sm leading-[1.6] text-[#6B7280]">
              {step.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Examples() {
  const cards = [
    {
      letter: "M",
      name: "Marcus Williams",
      role: "Master Barber · London",
      rating: "4.9 · 312 reviews",
      chip: "Barber",
      chipBg: "bg-[#FFF0EF] text-[#FF5F63]",
      heroBg:
        "linear-gradient(135deg,#FFE0DA 0%,#FFD3A6 60%,#FFC9C2 100%)",
      avatarBg: "bg-gradient-to-r from-[#FF6267] to-[#FF8A4C]",
    },
    {
      letter: "S",
      name: "Sofia Martinez",
      role: "Comedian · Manchester",
      rating: "4.8 · 94 reviews",
      chip: "Comedy",
      chipBg: "bg-[#F4EAFF] text-[#A855F7]",
      heroBg:
        "linear-gradient(135deg,#F4EAFF 0%,#E1CFFA 60%,#D7CDF8 100%)",
      avatarBg: "bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF]",
    },
    {
      letter: "J",
      name: "Jake Robinson",
      role: "Personal Trainer · Birmingham",
      rating: "5.0 · 208 reviews",
      chip: "Fitness",
      chipBg: "bg-[#E0F7EF] text-[#0D9488]",
      heroBg:
        "linear-gradient(135deg,#D7F2EA 0%,#B6E4F2 60%,#CFE9E0 100%)",
      avatarBg: "bg-gradient-to-br from-[#10B981] to-[#0EA5E9]",
    },
    {
      letter: "K",
      name: "Kofi Mensah",
      role: "Nail Artist · Bristol",
      rating: "4.7 · 156 reviews",
      chip: "Beauty",
      chipBg: "bg-[#FCE7F3] text-[#BE185D]",
      heroBg:
        "linear-gradient(135deg,#FFE2C7 0%,#FFD0B5 50%,#FFC7C7 100%)",
      avatarBg: "bg-gradient-to-br from-[#EC4899] to-[#A855F7]",
    },
  ];

  return (
    <section id="examples" className="border-t border-[#EEE7DF] bg-white">
      <div className="mx-auto max-w-[1240px] px-6 py-20 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9CA3AF]">
              A page you&apos;d actually want to share
            </p>
            <h2
              className="mt-3 text-[36px] font-extrabold md:text-[48px]"
              style={{ letterSpacing: "-0.03em", lineHeight: "1.04" }}
            >
              Example pages,
              <br className="md:hidden" /> made with Bookvella.
            </h2>
          </div>
          <p className="max-w-[320px] text-[13px] text-[#6B7280]">
            Every host gets their own page at{" "}
            <span className="font-semibold text-[#0B1220]">
              bookvella.com/your-handle
            </span>{" "}
            — no Bookvella branding above your name.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.name}
              className="group block overflow-hidden rounded-2xl border border-[#EEE7DF] bg-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)] transition hover:-translate-y-0.5"
            >
              <div
                className="relative h-32"
                style={{ background: card.heroBg }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`flex size-16 items-center justify-center rounded-2xl text-[22px] font-bold text-white shadow-sm ${card.avatarBg}`}
                  >
                    {card.letter}
                  </div>
                </div>
              </div>
              <div className="-mt-5 px-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white ${card.avatarBg}`}
                  >
                    {card.letter}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${card.chipBg}`}
                  >
                    {card.chip}
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold">{card.name}</p>
                <p className="text-xs text-[#6B7280]">{card.role}</p>
                <p className="mt-2 text-[11px] text-amber-500">
                  ★★★★★ <span className="text-[#6B7280]">{card.rating}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-gradient-to-r from-[#FF6267] via-[#FF8252] via-65% to-[#A855F7]">
        <div className="mx-auto max-w-[1240px] px-6 py-24 text-center lg:py-28">
          <h2
            className="text-[44px] font-extrabold text-white md:text-[60px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.04" }}
          >
            Ready to get booked?
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[16px] leading-[1.6] text-white/90">
            Create your free Bookvella page in under 5 minutes.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center rounded-full bg-white px-7 text-[15px] font-bold text-[#0B1220] shadow-sm"
            >
              Start for free <ArrowRight className="ml-2 size-4" />
            </Link>
            <a
              href="#examples"
              className="inline-flex h-12 items-center rounded-full border border-white/70 bg-transparent px-7 text-[15px] font-bold text-white hover:bg-white/10"
            >
              See an example page
            </a>
          </div>
          <p className="mt-5 text-[13px] text-white/80">
            Free forever · No credit card · 5-minute setup
          </p>
        </div>
      </div>
    </section>
  );
}
