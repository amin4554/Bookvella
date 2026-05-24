import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Cookie, Mail, ScrollText, Shield } from "lucide-react";
import { LegalPage, LegalProse } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Impressum / Legal Notice | Bookvella",
  description: "Provider information for Bookvella.",
};

const CONTACT_EMAIL = "support.bookvella@gmail.com";
const PHONE = "+49 155 1007066";

const DETAILS = [
  ["Service name", "Bookvella"],
  ["Service provider", "Amin Niaziardekani"],
  ["Legal form", "Natural person / student project"],
  ["Postal address", "Schwalbenweg 15, 12529 Schoenefeld, Germany"],
  ["Email", CONTACT_EMAIL],
  ["Phone / fast contact", PHONE],
  ["VAT ID", "Not available"],
  ["Commercial register", "Not registered"],
  [
    "Responsible for content",
    "Amin Niaziardekani, Schwalbenweg 15, 12529 Schoenefeld, Germany",
  ],
];

export default function ImpressumPage() {
  return (
    <LegalPage
      title={
        <>
          Impressum
          <br />
          <span className="text-[#9CA3AF]">/ Legal Notice</span>
        </>
      }
      intro="Provider information for Bookvella. German business websites generally need this information to be easy to recognize, directly reachable, and permanently available."
      maxWidth="max-w-[760px]"
    >
      <section className="mt-10">
        <h2 className="text-[22px] font-bold tracking-[-0.02em]">
          Service provider
        </h2>
        <dl className="mt-4">
          {DETAILS.map(([term, value]) => (
            <div
              key={term}
              className="grid gap-2 border-t border-[#EEE7DF] py-3.5 first:border-t-0 sm:grid-cols-[200px_1fr] sm:gap-6"
            >
              <dt className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">
                {term}
              </dt>
              <dd className="text-[14.5px] font-semibold text-[#0B1220]">
                {term === "Email" ? (
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-[#FF5F63] hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                ) : term === "Phone / fast contact" ? (
                  <a href={`tel:${PHONE.replace(/\s/g, "")}`}>{value}</a>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-10 rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 text-[#B45309]" />
          <div>
            <p className="text-[13.5px] font-bold text-[#92400E]">
              Confirm before relying on this page
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#B45309]">
              This page uses the personal details provided by the operator. If
              you do not want a home address or personal contact data public,
              arrange a legally usable business address and reachable contact
              channel before launch. A P.O. box is usually not enough for a
              German Impressum.
            </p>
          </div>
        </div>
      </div>

      <LegalProse>
        <h2>Online dispute resolution</h2>
        <p>
          The European Commission&apos;s Online Dispute Resolution platform was
          discontinued on July 20, 2025. For complaints, contact{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or your
          local consumer protection authority.
        </p>

        <h2>Liability for content</h2>
        <p>
          We create Bookvella&apos;s own content with care. We cannot guarantee that
          all information is always complete, accurate, or up to date. Hosts and
          guests are responsible for content they upload, including public
          profiles, service listings, images, and reviews.
        </p>

        <h2>Liability for external links</h2>
        <p>
          Bookvella may contain links to external websites. We have no control
          over those websites and are not responsible for their content.
        </p>

        <h2>Copyright</h2>
        <p>
          Content created by Bookvella is protected by copyright. Content
          uploaded by hosts and guests remains theirs, subject to the limited
          license described in the <Link href="/legal/terms">Terms</Link>.
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
        Last updated May 24, 2026.
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
