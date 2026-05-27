import Link from "next/link";
import { ArrowRight, Check, Star } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LegalFooter } from "@/components/legal-footer";
import { ThemeToggleButton } from "@/components/theme-toggle-button";

export default function Home() {
  return (
    <main className="min-h-screen bg-surface-page text-ink-strong">
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
    <header className="sticky top-0 z-40 border-b border-line-cream bg-surface-page/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-body md:flex">
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
          <ThemeToggleButton />
          <Link
            href="/login"
            className="hidden h-9 items-center rounded-full px-4 text-sm font-semibold text-ink-body hover:text-ink-strong md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-coral to-brand-orange px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
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
        className="pointer-events-none absolute -top-32 right-[-200px] h-[600px] w-[600px] rounded-full opacity-[0.45] dark:opacity-[0.08]"
        style={{
          background:
            "radial-gradient(closest-side,#FFD9D0 0%,#FFE9D6 35%,rgba(255,251,247,0) 75%)",
        }}
      />
      <div
        className="pointer-events-none absolute top-20 right-[120px] h-[280px] w-[280px] rounded-full opacity-40 dark:opacity-[0.08]"
        style={{
          background:
            "radial-gradient(closest-side,#EAD8FF 0%,rgba(255,251,247,0) 70%)",
        }}
      />

      <div className="mx-auto grid max-w-[1240px] gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-warning-border bg-warning-tint px-3.5 py-1.5 text-[13px] font-semibold text-warning-strong">
            <span className="h-1.5 w-1.5 rounded-full bg-warning-amber" />
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
              className="inline-block rounded-md bg-fuchsia-400 px-[0.18em] text-ink-on-accent ring-[0.06em] ring-fuchsia-400"
            >
              barbers
            </span>
            <br />
            to{" "}
            <span
              className="inline-block rounded-md bg-orange-300 px-[0.18em] text-ink-on-accent ring-[0.06em] ring-orange-300"
            >
              comedians
            </span>
            .
          </h1>
          <p className="mt-7 max-w-[520px] text-[17px] leading-[1.6] text-ink-body">
            Bookvella makes it easy for service providers to share their booking
            link — and for guests to discover and book in seconds. No app needed.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center rounded-full bg-gradient-to-r from-brand-coral to-brand-orange px-6 text-[15px] font-bold text-white shadow-sm hover:brightness-105"
            >
              Create your free page
              <ArrowRight className="ml-2 size-4" />
            </Link>
            <a
              href="#examples"
              className="inline-flex h-12 items-center rounded-full border border-ink-strong bg-surface-card px-6 text-[15px] font-bold text-ink-strong hover:bg-ink-strong hover:text-surface-card"
            >
              See an example page
            </a>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2 [&>*]:ring-2 [&>*]:ring-surface-page">
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-r from-brand-coral to-brand-orange text-[11px] font-bold text-white">
                M
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-coral via-purple-vivid to-purple-strong text-[11px] font-bold text-white">
                S
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-success-bright to-info-cyan text-[11px] font-bold text-white">
                J
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple text-[11px] font-bold text-white">
                K
              </span>
              <span className="flex size-8 items-center justify-center rounded-full border border-line-cream bg-surface-card text-[11px] font-bold text-ink-soft">
                +
              </span>
            </div>
            <p className="text-[13px] text-ink-body">
              <span className="font-bold text-ink-strong">2,400+ hosts</span>{" "}
              <span className="text-ink-soft">
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
      <div className="absolute -right-2 -top-2 z-10 hidden rounded-2xl border border-warning-border bg-warning-tint p-3 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)] md:block">
        <div className="flex items-center gap-2">
          <Star className="size-4 fill-warning-amber text-warning-amber" />
          <div className="leading-tight">
            <p className="text-[10px] font-bold uppercase tracking-wider text-warning-strong">
              Avg rating
            </p>
            <p className="text-[14px] font-bold text-ink-strong tabular-nums">
              4.9 / 5.0
            </p>
          </div>
        </div>
      </div>

      <div
        className="relative rounded-[28px] border border-line-cream bg-surface-card p-6"
        style={{
          boxShadow:
            "0 1px 0 rgba(17,24,39,0.04), 0 30px 60px -28px rgba(255,95,99,0.28), 0 16px 40px -24px rgba(168,85,247,0.18)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-brand-coral via-purple-vivid to-purple-strong text-base font-bold text-white">
            M
          </div>
          <div className="leading-tight">
            <p className="text-base font-bold">Marcus Williams</p>
            <p className="text-xs text-ink-soft">Master Barber · London</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[19px] font-bold">Fresh Cut Session</p>
          <p className="mt-1 text-xs text-ink-soft">
            45 minutes · Shoreditch Studio
          </p>
          <p className="mt-2 text-xs text-warning-amber">
            ★★★★★ <span className="text-ink-soft">4.9 · 312 reviews</span>
          </p>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
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
                    ? "h-10 rounded-lg bg-gradient-to-r from-brand-coral to-brand-orange text-[13px] font-bold text-white tabular-nums shadow-sm"
                    : "h-10 rounded-lg border border-line-cream bg-surface-card text-[13px] font-bold tabular-nums"
                }
              >
                {slot.time}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange text-sm font-bold text-white shadow-sm"
        >
          Book this slot →
        </button>
      </div>

      <div className="absolute -bottom-4 -left-4 z-10 hidden w-[230px] rounded-2xl border border-success-border-soft bg-surface-card p-3 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)] md:block">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-success-bright text-white">
            <Check className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight">Booking confirmed!</p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">
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
      bg: "bg-gradient-to-r from-brand-coral to-brand-orange",
    },
    {
      letter: "C",
      title: "Comedians",
      sub: "Sets, tours, private gigs",
      bg: "bg-gradient-to-br from-brand-orange to-brand-coral",
    },
    {
      letter: "F",
      title: "Trainers & coaches",
      sub: "PT, programs, check-ins",
      bg: "bg-gradient-to-br from-success-bright to-info-cyan",
    },
    {
      letter: "B",
      title: "Beauty & nails",
      sub: "Sittings, sets, fittings",
      bg: "bg-gradient-to-br from-pink-500 to-purple",
    },
    {
      letter: "T",
      title: "Tutors",
      sub: "1:1 lessons, exam prep",
      bg: "bg-gradient-to-br from-brand-coral via-purple-vivid to-purple-strong",
    },
    {
      letter: "C",
      title: "Consultants",
      sub: "Intro calls, advisory",
      bg: "bg-gradient-to-br from-green-500 to-success-bright",
    },
  ];
  return (
    <section id="built-for" className="border-t border-line-cream bg-surface-card">
      <div className="mx-auto max-w-[1240px] px-6 py-20 lg:py-24">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-muted">
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
          <p className="mt-3 text-[15px] text-ink-soft">
            One link, every service. From a single-chair barber to a touring
            comedian.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-center rounded-2xl border border-line-cream bg-surface-card p-5 text-center shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)]"
            >
              <div
                className={`flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm ${item.bg}`}
              >
                {item.letter}
              </div>
              <p className="mt-3 text-sm font-bold">{item.title}</p>
              <p className="text-[11px] text-ink-muted">{item.sub}</p>
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
      bg: "bg-gradient-to-r from-brand-coral to-brand-orange",
      title: "Create your profile",
      text: "Sign up free, add your services, set your weekly hours. Your personal booking page is live in under 5 minutes.",
    },
    {
      n: 2,
      bg: "bg-gradient-to-br from-brand-coral via-purple-vivid to-purple-strong",
      title: "Share your link",
      text: "Post your Bookvella link on Instagram, WhatsApp, or wherever your clients find you. No app install required for guests.",
    },
    {
      n: 3,
      bg: "bg-gradient-to-br from-success-bright to-info-cyan",
      title: "Get booked & earn reviews",
      text: "Clients pick a slot, confirm with email, and show up. After each appointment, they're invited to leave a star rating automatically.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-[1240px] px-6 py-20 lg:py-24">
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-muted">
          Simple by design
        </p>
        <h2
          className="mt-3 text-[36px] font-extrabold md:text-[48px]"
          style={{ letterSpacing: "-0.03em", lineHeight: "1.04" }}
        >
          Up and running in minutes
        </h2>
        <p className="mt-3 text-[15px] text-ink-soft">
          From signup to your first confirmed booking — about five minutes.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.n}
            className="rounded-2xl border border-line-cream bg-surface-card p-6 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)]"
          >
            <div
              className={`flex size-10 items-center justify-center rounded-xl text-sm font-bold text-white ${step.bg}`}
            >
              {step.n}
            </div>
            <p className="mt-5 text-lg font-bold">{step.title}</p>
            <p className="mt-2 text-sm leading-[1.6] text-ink-soft">
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
      chipBg: "bg-brand-tint-100 text-brand",
      heroBg:
        "linear-gradient(135deg,#FFE0DA 0%,#FFD3A6 60%,#FFC9C2 100%)",
      avatarBg: "bg-gradient-to-r from-brand-coral to-brand-orange",
    },
    {
      letter: "S",
      name: "Sofia Martinez",
      role: "Comedian · Manchester",
      rating: "4.8 · 94 reviews",
      chip: "Comedy",
      chipBg: "bg-purple-tint text-purple",
      heroBg:
        "linear-gradient(135deg,#F4EAFF 0%,#E1CFFA 60%,#D7CDF8 100%)",
      avatarBg: "bg-gradient-to-br from-brand-coral via-purple-vivid to-purple-strong",
    },
    {
      letter: "J",
      name: "Jake Robinson",
      role: "Personal Trainer · Birmingham",
      rating: "5.0 · 208 reviews",
      chip: "Fitness",
      chipBg: "bg-success-tint-soft text-success-teal",
      heroBg:
        "linear-gradient(135deg,#D7F2EA 0%,#B6E4F2 60%,#CFE9E0 100%)",
      avatarBg: "bg-gradient-to-br from-success-bright to-info-cyan",
    },
    {
      letter: "K",
      name: "Kofi Mensah",
      role: "Nail Artist · Bristol",
      rating: "4.7 · 156 reviews",
      chip: "Beauty",
      chipBg: "bg-purple-tint text-purple-vivid",
      heroBg:
        "linear-gradient(135deg,#FFE2C7 0%,#FFD0B5 50%,#FFC7C7 100%)",
      avatarBg: "bg-gradient-to-br from-pink-500 to-purple",
    },
  ];

  return (
    <section id="examples" className="border-t border-line-cream bg-surface-card">
      <div className="mx-auto max-w-[1240px] px-6 py-20 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-muted">
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
          <p className="max-w-[320px] text-[13px] text-ink-soft">
            Every host gets their own page at{" "}
            <span className="font-semibold text-ink-strong">
              bookvella.com/your-handle
            </span>{" "}
            — no Bookvella branding above your name.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.name}
              className="group block overflow-hidden rounded-2xl border border-line-cream bg-surface-card shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)] transition hover:-translate-y-0.5"
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
                <p className="text-xs text-ink-soft">{card.role}</p>
                <p className="mt-2 text-[11px] text-warning-amber">
                  ★★★★★ <span className="text-ink-soft">{card.rating}</span>
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
      <div className="bg-gradient-to-r from-brand-coral via-brand-sunset via-65% to-purple">
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
              className="inline-flex h-12 items-center rounded-full bg-surface-card px-7 text-[15px] font-bold text-ink-strong shadow-sm"
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
