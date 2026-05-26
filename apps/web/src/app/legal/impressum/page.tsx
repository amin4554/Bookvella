import type { Metadata } from "next";
import Link from "next/link";
import { Cookie, Info, Mail, ScrollText, Shield } from "lucide-react";
import { LegalPage, LegalProse } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Project Notice / Impressum | Bookvella",
  description: "Project and contact information for Bookvella.",
};

const CONTACT_EMAIL = "support.bookvella@gmail.com";

const DETAILS = [
  ["Project", "Bookvella"],
  ["Project type", "Non-commercial student portfolio project"],
  ["Operator location", "Berlin, Germany"],
  ["Payments", "Bookvella does not process payments or charge users"],
  ["Commercial register", "Not registered"],
  ["VAT ID", "Not available"],
  ["Contact", CONTACT_EMAIL],
];

export default function ImpressumPage() {
  return (
    <LegalPage
      title={
        <>
          Project Notice
          <br />
          <span className="text-[#9CA3AF]">/ Impressum</span>
        </>
      }
      intro="Bookvella is currently operated as a non-commercial student portfolio project from Berlin, Germany. It is publicly reachable so the work can be reviewed, but it is not offered as a paid marketplace or commercial SaaS product."
      maxWidth="max-w-[780px]"
    >
      <section className="mt-10">
        <h2 className="text-[22px] font-bold tracking-[-0.02em]">
          Project information
        </h2>
        <dl className="mt-4">
          {DETAILS.map(([term, value]) => (
            <div
              key={term}
              className="grid gap-2 border-t border-[#EEE7DF] py-3.5 first:border-t-0 sm:grid-cols-[190px_1fr] sm:gap-6"
            >
              <dt className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">
                {term}
              </dt>
              <dd className="text-[14.5px] font-semibold text-[#0B1220]">
                {term === "Contact" ? (
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-[#FF5F63] hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-10 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-4 text-[#2563EB]" />
          <div>
            <p className="text-[13.5px] font-bold text-[#1D4ED8]">
              Note about private contact details
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#1E40AF]">
              This page intentionally does not publish a private home address or
              phone number. If Bookvella becomes commercial, adds paid plans,
              actively onboards real users, or is otherwise operated as a
              business-like digital service, this page should be replaced with a
              full legally reviewed Impressum that includes the required
              provider identity and a valid service address.
            </p>
          </div>
        </div>
      </div>

      <LegalProse>
        <h2>Responsible contact</h2>
        <p>
          For product questions, privacy requests, abuse reports, security
          concerns, or legal notices, contact{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Please
          include enough context for us to identify the page, account, booking,
          review, or upload involved.
        </p>

        <h2>Scope of the project</h2>
        <p>
          Bookvella is a portfolio project for demonstrating a booking product:
          account management, public booking pages, email verification,
          scheduling, reviews, and calendar-related workflows. It is not a
          payment processor, employment agency, service provider, or regulated
          marketplace.
        </p>

        <h2>Online dispute resolution</h2>
        <p>
          The European Commission&apos;s Online Dispute Resolution platform was
          discontinued on July 20, 2025. Bookvella does not process payments or
          sell services through the platform. Please contact{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you have a
          complaint about this project.
        </p>

        <h2>Liability for content</h2>
        <p>
          We create Bookvella&apos;s own content with care, but cannot guarantee
          that all information is always complete, accurate, or up to date. If a
          host or guest uploads content, including profile text, service
          listings, images, or reviews, that user is responsible for making sure
          the content is lawful and accurate.
        </p>

        <h2>External links</h2>
        <p>
          Bookvella may link to external websites such as calendar providers,
          websites added by hosts, or social profiles. We do not control those
          websites and are not responsible for their content.
        </p>

        <h2>Copyright</h2>
        <p>
          Bookvella&apos;s own text, design, and code are protected by applicable
          copyright law. Content uploaded by users remains theirs, subject to the
          limited license described in the <Link href="/legal/terms">Terms</Link>.
        </p>
      </LegalProse>

      <nav className="mt-10 rounded-2xl border border-[#EEE7DF] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
          More legal
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill href="/legal/privacy" icon={<Shield className="size-3.5" />}>
            Privacy
          </Pill>
          <Pill href="/legal/cookies" icon={<Cookie className="size-3.5" />}>
            Cookies
          </Pill>
          <Pill href="/legal/terms" icon={<ScrollText className="size-3.5" />}>
            Terms
          </Pill>
          <Pill href="/legal/contact" icon={<Mail className="size-3.5" />}>
            Contact / Report
          </Pill>
        </div>
      </nav>

      <p className="mt-8 text-[12px] text-[#9CA3AF]">
        Last updated May 26, 2026.
      </p>
    </LegalPage>
  );
}

function Pill({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#EEE7DF] bg-[#FFFBF7] px-3.5 py-1.5 text-[12.5px] font-bold hover:border-[#FCC9C5] hover:text-[#FF5F63]"
    >
      {icon}
      {children}
    </Link>
  );
}
