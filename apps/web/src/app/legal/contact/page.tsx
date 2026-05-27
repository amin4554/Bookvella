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
          tint="bg-brand-tint-100 text-brand"
          title="General and product"
          email={CONTACT_EMAIL}
          text="Questions, bugs, portfolio feedback, and account help."
        />
        <Channel
          href={`mailto:${CONTACT_EMAIL}?subject=Bookvella%20privacy%20request`}
          icon={<Shield className="size-5" />}
          tint="bg-purple-tint text-purple-strong"
          title="Privacy / data rights"
          email={CONTACT_EMAIL}
          text="Access, deletion, correction, portability, objection, and consent requests."
        />
        <Channel
          href={`mailto:${CONTACT_EMAIL}?subject=Bookvella%20illegal%20content%20report`}
          icon={<Flag className="size-5" />}
          tint="bg-danger-tint-strong text-danger-strong"
          title="Report illegal content"
          email={CONTACT_EMAIL}
          text="Public profiles, service listings, uploaded images, or reviews."
        />
        <Channel
          href={`mailto:${CONTACT_EMAIL}?subject=Bookvella%20abuse%20or%20security%20report`}
          icon={<AlertTriangle className="size-5" />}
          tint="bg-warning-tint text-warning"
          title="Abuse and security"
          email={CONTACT_EMAIL}
          text="Spam, harassment, threats, account compromise, or vulnerabilities."
        />
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <ContactReportForm />

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line-cream bg-surface-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              How reports work
            </p>
            <h3 className="mt-1 text-[18px] font-bold">
              Notice and review flow
            </h3>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-[13px] text-ink-body marker:font-bold marker:text-brand">
              <li>You send a report with a link and reason.</li>
              <li>We acknowledge receipt where legally required and practical.</li>
              <li>We review the content against applicable law and Bookvella&apos;s terms.</li>
              <li>We may leave it up, restrict it, remove it, or suspend an account.</li>
              <li>Affected users can challenge moderation decisions by email.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-line-cream bg-surface-page p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Formal notices
            </p>
            <p className="mt-2 text-[13px] leading-snug text-ink-soft">
              For this non-commercial student project, email is the published
              contact channel. If Bookvella becomes commercial or actively
              onboards real users, the{" "}
              <Link href="/legal/impressum" className="font-bold text-brand hover:underline">
                Project Notice / Impressum
              </Link>{" "}
              should be replaced with full provider details and a serviceable
              address.
            </p>
          </div>

          <div className="rounded-2xl border border-line-cream bg-surface-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Privacy requests
            </p>
            <p className="mt-2 text-[13px] leading-snug text-ink-soft">
              We aim to respond to GDPR requests within one month. See the{" "}
              <Link href="/legal/privacy" className="font-bold text-brand hover:underline">
                Privacy Policy
              </Link>{" "}
              for data rights and retention details.
            </p>
          </div>
        </aside>
      </section>

      <p className="mt-12 text-[12px] text-ink-muted">
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
      className="flex gap-3.5 rounded-2xl border border-line-cream bg-surface-card p-4 hover:border-brand-tint-300"
    >
      <div className={`grid size-[42px] shrink-0 place-items-center rounded-xl ${tint}`}>
        {icon}
      </div>
      <div>
        <p className="text-[14px] font-bold">{title}</p>
        <p className="mt-1 text-[12.5px] text-ink-soft">{email}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{text}</p>
      </div>
    </a>
  );
}
