import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Flag, Mail, Shield } from "lucide-react";
import { ContactReportForm } from "@/components/contact-report-form";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Contact / Report | Bookvella",
  description: "Contact Bookvella or report content.",
};

const CONTACT_EMAIL = "support.bookvella@gmail.com";

export default function ContactPage() {
  return (
    <LegalPage
      eyebrow="Contact and reports"
      title={
        <>
          Get in touch or
          <br />
          report content
        </>
      }
      intro="Bookvella is a public student portfolio project that can contain public profiles, service listings, images, bookings, and reviews. Use this page for product questions, privacy requests, security concerns, and content reports."
      maxWidth="max-w-[1000px]"
    >
      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <Channel
          href={`mailto:${CONTACT_EMAIL}`}
          icon={<Mail className="size-5" />}
          tint="bg-[#FFF0EF] text-[#FF5F63]"
          title="General and product"
          email={CONTACT_EMAIL}
          text="Questions, bugs, portfolio feedback, and account help."
        />
        <Channel
          href={`mailto:${CONTACT_EMAIL}?subject=Bookvella%20privacy%20request`}
          icon={<Shield className="size-5" />}
          tint="bg-[#F4EAFF] text-[#7C3AED]"
          title="Privacy / data rights"
          email={CONTACT_EMAIL}
          text="Access, deletion, correction, portability, objection, and consent requests."
        />
        <Channel
          href={`mailto:${CONTACT_EMAIL}?subject=Bookvella%20illegal%20content%20report`}
          icon={<Flag className="size-5" />}
          tint="bg-[#FEE2E2] text-[#DC2626]"
          title="Report illegal content"
          email={CONTACT_EMAIL}
          text="Public profiles, service listings, uploaded images, or reviews."
        />
        <Channel
          href={`mailto:${CONTACT_EMAIL}?subject=Bookvella%20abuse%20or%20security%20report`}
          icon={<AlertTriangle className="size-5" />}
          tint="bg-[#FEF3C7] text-[#B45309]"
          title="Abuse and security"
          email={CONTACT_EMAIL}
          text="Spam, harassment, threats, account compromise, or vulnerabilities."
        />
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <ContactReportForm />

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
              <li>We review the content against applicable law and Bookvella&apos;s terms.</li>
              <li>We may leave it up, restrict it, remove it, or suspend an account.</li>
              <li>Affected users can challenge moderation decisions by email.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
              Formal notices
            </p>
            <p className="mt-2 text-[13px] leading-snug text-[#6B7280]">
              For this non-commercial student project, email is the published
              contact channel. If Bookvella becomes commercial or actively
              onboards real users, the{" "}
              <Link href="/legal/impressum" className="font-bold text-[#FF5F63] hover:underline">
                Project Notice / Impressum
              </Link>{" "}
              should be replaced with full provider details and a serviceable
              address.
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
        Last updated May 26, 2026.
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
