import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Handshake, Link as LinkIcon, Shield } from "lucide-react";
import { LegalPage, LegalProse, Toc } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Bookvella",
  description: "The rules for using Bookvella as a host or guest.",
};

const CONTACT_EMAIL = "support.bookvella@gmail.com";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="The rules that apply when you use Bookvella, whether you create a host account or book a service as a guest."
    >
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <SummaryCard
          icon={<LinkIcon className="size-5" />}
          tint="bg-[#FFF0EF] text-[#FF5F63]"
          title="Bookvella is the platform"
          text="We provide booking software and public booking pages."
        />
        <SummaryCard
          icon={<Handshake className="size-5" />}
          tint="bg-[#F4EAFF] text-[#7C3AED]"
          title="Your service contract is with the host"
          text="Hosts are independent providers, not Bookvella employees."
        />
        <SummaryCard
          icon={<Banknote className="size-5" />}
          tint="bg-[#E0F7EF] text-[#0D9488]"
          title="No payments through Bookvella"
          text="Bookvella currently does not collect payments or commissions."
        />
        <SummaryCard
          icon={<Shield className="size-5" />}
          tint="bg-[#FEF3C7] text-[#B45309]"
          title="Illegal or abusive content is not allowed"
          text="Profiles, services, images, and reviews must follow the law and these terms."
        />
      </div>

      <Toc
        items={[
          { href: "#service", label: "What Bookvella is" },
          { href: "#accounts", label: "Accounts" },
          { href: "#hosts", label: "Host responsibilities" },
          { href: "#guests", label: "Guest responsibilities" },
          { href: "#consumer", label: "Consumer information" },
          { href: "#content", label: "Reviews and content" },
          { href: "#moderation", label: "Moderation" },
          { href: "#liability", label: "Liability" },
          { href: "#law", label: "Governing law" },
        ]}
      />

      <LegalProse>
        <h2 id="service">1. What Bookvella is</h2>
        <p>
          Bookvella is booking and scheduling software for independent service
          providers. Bookvella provides accounts, public pages, service listings,
          availability tools, email verification, booking confirmations,
          cancellation links, and review features.
        </p>
        <p>
          Bookvella is not the provider of the underlying host service. When a
          guest books a service, the service contract is normally between the
          guest and the host.
        </p>

        <h2 id="accounts">2. Accounts and eligibility</h2>
        <p>
          Hosts must be at least 18 years old, or the age of majority where they
          live, to create an account. You are responsible for keeping your login
          details secure and for all activity under your account.
        </p>

        <h2 id="hosts">3. Host responsibilities</h2>
        <p>Hosts agree that they will:</p>
        <ul>
          <li>only offer services they are legally allowed and qualified to provide;</li>
          <li>keep service descriptions, prices, durations, locations, photos, and availability accurate;</li>
          <li>honor confirmed bookings or cancel them promptly with a clear reason;</li>
          <li>provide guests with any required legal business information, cancellation terms, and consumer information;</li>
          <li>handle guest personal data only for the booking and service relationship;</li>
          <li>not use Bookvella to spam, harass, mislead, or discriminate against guests.</li>
        </ul>

        <h2 id="guests">4. Guest responsibilities</h2>
        <p>Guests agree that they will:</p>
        <ul>
          <li>provide accurate booking details and a reachable email address;</li>
          <li>verify bookings with the email code sent by Bookvella;</li>
          <li>cancel as early as possible if they cannot attend;</li>
          <li>not book in another person&apos;s name without permission;</li>
          <li>leave reviews only for genuine booking experiences.</li>
        </ul>

        <h2 id="consumer">5. Consumer and marketplace information</h2>
        <p>
          Because Bookvella hosts independent service listings, guests should
          check the host profile and service details before booking. Hosts are
          responsible for any legally required pre-contract information, including
          trader identity, total price, cancellation/no-show rules, and any
          withdrawal rights that apply to their service.
        </p>
        <p>
          Bookvella currently does not process payments. Any payment, refund,
          invoice, tax, VAT, or receipt question is handled directly between the
          host and guest unless Bookvella later adds payment features and updates
          these terms.
        </p>

        <h2 id="content">6. Reviews and user content</h2>
        <p>
          Hosts and guests keep ownership of content they upload, including
          profile text, service text, images, and reviews. By uploading content,
          you give Bookvella a limited, worldwide, non-exclusive license to host,
          display, reproduce, and technically process that content for operating
          and improving the service.
        </p>
        <p>
          Reviews must be truthful, relevant to a real booking, and not abusive,
          defamatory, discriminatory, or illegal.
        </p>

        <h2 id="moderation">7. Moderation, suspension, and reports</h2>
        <p>
          We may remove content, restrict access, or suspend accounts if content
          appears illegal, harmful, misleading, abusive, spammy, or in breach of
          these terms. Where legally required and reasonable, we will explain the
          decision and provide a way to challenge it.
        </p>
        <p>
          Illegal content and abuse reports can be sent through{" "}
          <Link href="/legal/contact">Contact / Report</Link> or by email to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2 id="liability">8. Disclaimers and liability</h2>
        <p>
          Bookvella is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We do not
          guarantee uninterrupted availability or error-free operation. We are not
          responsible for the quality, safety, legality, punctuality, or outcome
          of services provided by hosts, or for guest conduct.
        </p>
        <p>
          Nothing in these terms excludes liability that cannot be excluded by
          law, including liability for intent, gross negligence, or personal
          injury where applicable.
        </p>

        <h2 id="law">9. Governing law and complaints</h2>
        <p>
          These terms are governed by German law, without affecting mandatory
          consumer protections in a consumer&apos;s country of residence.
        </p>
        <p>
          The EU Online Dispute Resolution platform was discontinued on July 20,
          2025. You can contact us directly at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <p className="mt-12 text-[12px] text-[#9CA3AF]">
          Version 1.0. Last updated May 24, 2026. Effective May 24, 2026.
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
    <div className="flex gap-3.5 rounded-2xl border border-[#EEE7DF] bg-white p-4">
      <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${tint}`}>
        {icon}
      </div>
      <div>
        <p className="text-[13.5px] font-bold">{title}</p>
        <p className="mt-1 text-[12.5px] leading-snug text-[#6B7280]">{text}</p>
      </div>
    </div>
  );
}
