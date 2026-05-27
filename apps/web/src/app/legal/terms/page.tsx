import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, GraduationCap, Handshake, Shield } from "lucide-react";
import { LegalPage, LegalProse, Toc } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use | Bookvella",
  description: "The rules for using Bookvella as a host or guest.",
};

const CONTACT_EMAIL = "support.bookvella@gmail.com";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro="These terms apply when you use Bookvella. Bookvella is currently a non-commercial student portfolio project with public access, not a paid marketplace or payment platform."
    >
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <SummaryCard
          icon={<GraduationCap className="size-5" />}
          tint="bg-info-tint text-info"
          title="Student portfolio project"
          text="Bookvella is public so the product can be reviewed, tested, and demonstrated."
        />
        <SummaryCard
          icon={<Handshake className="size-5" />}
          tint="bg-purple-tint text-purple-strong"
          title="Hosts are independent"
          text="If a host offers a real service, the service relationship is between host and guest."
        />
        <SummaryCard
          icon={<Banknote className="size-5" />}
          tint="bg-success-tint-soft text-success-teal"
          title="No payments"
          text="Bookvella does not process payments, charge commissions, or sell subscriptions."
        />
        <SummaryCard
          icon={<Shield className="size-5" />}
          tint="bg-warning-tint text-warning"
          title="Use it responsibly"
          text="Do not upload illegal content, spam people, or submit fake bookings or reviews."
        />
      </div>

      <Toc
        items={[
          { href: "#project", label: "What Bookvella is" },
          { href: "#accounts", label: "Accounts" },
          { href: "#hosts", label: "Hosts" },
          { href: "#guests", label: "Guests" },
          { href: "#reviews", label: "Reviews" },
          { href: "#content", label: "Content" },
          { href: "#moderation", label: "Moderation" },
          { href: "#availability", label: "Availability" },
          { href: "#liability", label: "Liability" },
          { href: "#law", label: "Law and contact" },
        ]}
      />

      <LegalProse>
        <h2 id="project">1. What Bookvella is</h2>
        <p>
          Bookvella is booking and scheduling software built as a student
          portfolio project. It demonstrates host accounts, public booking
          pages, service listings, availability tools, email verification,
          booking confirmations, cancellation and rescheduling links, reviews,
          uploads, and optional calendar-related features.
        </p>
        <p>
          Bookvella is not the provider of any host service. It is not a payment
          processor, financial service, employment agency, travel agency,
          healthcare provider, or regulated marketplace.
        </p>

        <h2 id="accounts">2. Accounts</h2>
        <p>
          You may create a host account to test or demonstrate the product. You
          must provide accurate account information, keep your login credentials
          secure, and not use another person&apos;s account without permission.
        </p>
        <p>
          Because Bookvella is a portfolio project, accounts, data, and features
          may be changed, limited, suspended, or deleted if needed for security,
          maintenance, legal compliance, or project operation.
        </p>

        <h2 id="hosts">3. Host responsibilities</h2>
        <p>Hosts agree that they will:</p>
        <ul>
          <li>only publish services they are legally allowed and qualified to provide;</li>
          <li>keep service descriptions, prices, duration, location, photos, and availability accurate;</li>
          <li>make clear whether a listing is only a test/demo listing or a real service;</li>
          <li>honor confirmed real bookings or cancel/reschedule promptly with a clear reason;</li>
          <li>provide guests with any legal business, consumer, cancellation, tax, invoice, or professional information that applies to the host&apos;s own service;</li>
          <li>use guest personal data only for the booking and related service communication;</li>
          <li>not use Bookvella for spam, harassment, fraud, misleading listings, illegal services, or discriminatory conduct.</li>
        </ul>

        <h2 id="guests">4. Guest responsibilities</h2>
        <p>Guests agree that they will:</p>
        <ul>
          <li>provide accurate booking details and a reachable email address;</li>
          <li>verify bookings with the one-time code sent by Bookvella;</li>
          <li>not submit fake bookings, abusive notes, or bookings in another person&apos;s name without permission;</li>
          <li>cancel or reschedule as early as possible if they cannot attend;</li>
          <li>check the host&apos;s service details before relying on a booking.</li>
        </ul>

        <h2 id="reviews">5. Reviews</h2>
        <p>
          Reviews may only be submitted through a valid review link connected to
          a confirmed booking. Reviews must reflect a genuine booking experience
          and must not be fake, abusive, defamatory, discriminatory, or illegal.
        </p>
        <p>
          Hosts may hide or show reviews on their public profile. Bookvella may
          remove or restrict reviews that appear unlawful, abusive, spammy, or
          inconsistent with these terms.
        </p>

        <h2 id="content">6. User content</h2>
        <p>
          Hosts and guests remain responsible for content they upload or submit,
          including profile text, service listings, images, booking notes, and
          reviews. You must have the rights needed to upload that content.
        </p>
        <p>
          By uploading content, you give Bookvella a limited, non-exclusive
          license to host, display, reproduce, and technically process the
          content only as needed to operate, secure, and improve the project.
        </p>

        <h2 id="moderation">7. Moderation and reports</h2>
        <p>
          We may remove content, restrict features, suspend accounts, or block
          access where content or behavior appears illegal, harmful, misleading,
          abusive, spammy, or in breach of these terms.
        </p>
        <p>
          Reports can be sent through{" "}
          <Link href="/legal/contact">Contact / Report</Link> or by email to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2 id="availability">8. Changes and availability</h2>
        <p>
          Bookvella is provided for portfolio, testing, and demonstration
          purposes. We do not guarantee uninterrupted availability, permanent
          data storage, error-free operation, or that every feature will remain
          available.
        </p>

        <h2 id="liability">9. Liability</h2>
        <p>
          Bookvella is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the
          extent permitted by law, Bookvella is not responsible for host service
          quality, safety, legality, punctuality, pricing, payments, tax issues,
          guest conduct, or the outcome of appointments arranged between hosts
          and guests.
        </p>
        <p>
          Nothing in these terms excludes liability that cannot be excluded by
          law, including liability for intent, gross negligence, or injury to
          life, body, or health where applicable.
        </p>

        <h2 id="law">10. Governing law and contact</h2>
        <p>
          These terms are governed by German law, without affecting mandatory
          consumer protections that may apply in a user&apos;s country of residence.
        </p>
        <p>
          The European Commission&apos;s Online Dispute Resolution platform was
          discontinued on July 20, 2025. Questions or complaints can be sent to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <p className="mt-12 text-[12px] text-ink-muted">
          Version 1.1. Last updated May 26, 2026. Effective May 26, 2026.
        </p>
      </LegalProse>
    </LegalPage>
  );
}

function SummaryCard({
  icon,
  tint,
  title,
  text,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3.5 rounded-2xl border border-line-cream bg-surface-card p-4">
      <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${tint}`}>
        {icon}
      </div>
      <div>
        <p className="text-[13.5px] font-bold">{title}</p>
        <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{text}</p>
      </div>
    </div>
  );
}
