import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Flag, Mail, Shield } from "lucide-react";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Contact / Report | Bookvella",
  description: "Contact Bookvella or report illegal content.",
};

const CONTACT_EMAIL = "support.bookvella@gmail.com";
const PHONE = "+49 155 1007066";

export default function ContactPage() {
  return (
    <LegalPage
      eyebrow="Contact and transparency"
      title={
        <>
          Get in touch or
          <br />
          report content
        </>
      }
      intro="Bookvella hosts public profiles, service listings, images, and reviews. You can contact us, exercise privacy rights, or report illegal content from this page."
      maxWidth="max-w-[1000px]"
    >
      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <Channel
          href={`mailto:${CONTACT_EMAIL}`}
          icon={<Mail className="size-5" />}
          tint="bg-[#FFF0EF] text-[#FF5F63]"
          title="General and product"
          email={CONTACT_EMAIL}
          text="Questions, bugs, and product feedback."
        />
        <Channel
          href={`mailto:${CONTACT_EMAIL}?subject=Bookvella%20privacy%20request`}
          icon={<Shield className="size-5" />}
          tint="bg-[#F4EAFF] text-[#7C3AED]"
          title="Privacy / data rights"
          email={CONTACT_EMAIL}
          text="GDPR access, deletion, correction, portability, and objection requests."
        />
        <Channel
          href={`mailto:${CONTACT_EMAIL}?subject=Bookvella%20illegal%20content%20report`}
          icon={<Flag className="size-5" />}
          tint="bg-[#FEE2E2] text-[#DC2626]"
          title="Report illegal content"
          email={CONTACT_EMAIL}
          text="DSA-style notice-and-action point for public profiles, listings, images, or reviews."
        />
        <Channel
          href={`mailto:${CONTACT_EMAIL}?subject=Bookvella%20abuse%20or%20safety%20report`}
          icon={<AlertTriangle className="size-5" />}
          tint="bg-[#FEF3C7] text-[#B45309]"
          title="Abuse and safety"
          email={CONTACT_EMAIL}
          text="Harassment, threats, spam, account compromise, or security concerns."
        />
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-[#EEE7DF] bg-white p-6 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
            What to include
          </p>
          <h2
            className="mt-1 text-[28px] font-extrabold"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.05 }}
          >
            Send reports by email
          </h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-[#6B7280]">
            Until a backend report form is added, email is the reliable channel.
            For illegal-content reports, include enough detail for us to identify
            the content and assess the issue.
          </p>
          <ul className="mt-5 space-y-3 text-[14px] leading-[1.6] text-[#374151]">
            <li><strong className="text-[#0B1220]">1. Link:</strong> the Bookvella profile, service, image, or review URL.</li>
            <li><strong className="text-[#0B1220]">2. Reason:</strong> what law or platform rule you believe is breached.</li>
            <li><strong className="text-[#0B1220]">3. Context:</strong> screenshots or details that help us understand the report.</li>
            <li><strong className="text-[#0B1220]">4. Contact:</strong> your name and email so we can acknowledge and follow up.</li>
          </ul>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Illegal%20content%20report%20on%20Bookvella`}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13.5px] font-bold text-white shadow-sm"
          >
            Email {CONTACT_EMAIL} <Mail className="size-4" />
          </a>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#EEE7DF] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
              How reports work
            </p>
            <h3 className="mt-1 text-[18px] font-bold">
              Notice and review flow
            </h3>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-[13px] text-[#374151] marker:font-bold marker:text-[#FF5F63]">
              <li>You send a report with a link and reason.</li>
              <li>We acknowledge receipt where legally required and practical.</li>
              <li>We review the content against applicable law and Bookvella terms.</li>
              <li>We may leave it up, restrict it, remove it, or suspend an account.</li>
              <li>Affected users can challenge moderation decisions by email.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
              Formal legal notices
            </p>
            <p className="mt-2 text-[13.5px] font-semibold">
              Formal notices can be sent to the postal address listed in the{" "}
              <Link href="/legal/impressum" className="text-[#FF5F63] hover:underline">
                Impressum
              </Link>{" "}
              or raised first by phone at{" "}
              <a href={`tel:${PHONE.replace(/\s/g, "")}`} className="text-[#FF5F63] hover:underline">
                {PHONE}
              </a>
              .
            </p>
            <p className="mt-3 text-[12px] leading-snug text-[#6B7280]">
              Do not rely on email alone for formal service of legal documents
              where postal service is required.
            </p>
          </div>

          <div className="rounded-2xl border border-[#EEE7DF] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
              Privacy requests
            </p>
            <p className="mt-2 text-[13px] leading-snug text-[#6B7280]">
              We aim to respond to GDPR requests within one month. See the{" "}
              <Link href="/legal/privacy" className="font-bold text-[#FF5F63] hover:underline">
                Privacy Policy
              </Link>{" "}
              for data rights and retention details.
            </p>
          </div>
        </aside>
      </section>

      <p className="mt-12 text-[12px] text-[#9CA3AF]">
        Last updated May 24, 2026.
      </p>
    </LegalPage>
  );
}

function Channel({
  href,
  icon,
  tint,
  title,
  email,
  text,
}: {
  href: string;
  icon: React.ReactNode;
  tint: string;
  title: string;
  email: string;
  text: string;
}) {
  return (
    <a
      href={href}
      className="flex gap-3.5 rounded-2xl border border-[#EEE7DF] bg-white p-4 hover:border-[#FCC9C5]"
    >
      <div className={`grid size-[42px] shrink-0 place-items-center rounded-xl ${tint}`}>
        {icon}
      </div>
      <div>
        <p className="text-[14px] font-bold">{title}</p>
        <p className="mt-1 text-[12.5px] text-[#6B7280]">{email}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[#9CA3AF]">{text}</p>
      </div>
    </a>
  );
}
