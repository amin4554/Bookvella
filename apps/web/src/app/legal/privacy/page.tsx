import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalProse, LegalTable, Toc } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Bookvella",
  description: "How Bookvella collects, uses, and protects personal data.",
};

const CONTACT_EMAIL = "support.bookvella@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="How Bookvella collects, uses, and protects personal data. This policy is written for the current product: host accounts, public profiles, booking forms, email verification, reviews, uploads, and cancellation links."
    >
      <Toc
        items={[
          { href: "#controller", label: "Who is the controller" },
          { href: "#data", label: "What data we collect" },
          { href: "#purposes", label: "Why we process it" },
          { href: "#retention", label: "How long we keep it" },
          { href: "#processors", label: "Processors" },
          { href: "#transfers", label: "International transfers" },
          { href: "#rights", label: "Your rights" },
          { href: "#contact", label: "Contact" },
        ]}
      />

      <LegalProse>
        <h2 id="controller">1. Who is the controller</h2>
        <p>
          The controller responsible for Bookvella is Amin Niaziardekani,
          operating the service Bookvella. Full contact details are listed in
          the <Link href="/legal/impressum">Impressum / Legal Notice</Link>.
        </p>

        <h2 id="data">2. What data we collect</h2>
        <h3>From hosts</h3>
        <ul>
          <li>Account data: name, email address, password hash, timezone, public handle, and login/session records.</li>
          <li>Profile data: profile image, cover image, headline, business category, location, about text, website, Instagram, and public profile settings.</li>
          <li>Service data: service titles, descriptions, images, durations, prices, locations, preparation notes, visibility settings, and availability rules.</li>
          <li>Booking data: guest bookings, cancellations, notes, reviews, and host actions in the dashboard.</li>
        </ul>

        <h3>From guests</h3>
        <ul>
          <li>Name, email address, optional phone number, optional booking note, timezone, selected service, selected time slot, and cancellation/review token use.</li>
          <li>Email verification data, including the one-time code workflow used to confirm bookings.</li>
          <li>Review content submitted after a booking, including rating, guest display name, comment, and service reviewed.</li>
        </ul>

        <h3>Collected automatically</h3>
        <ul>
          <li>IP address, request timestamps, browser/device data, and security logs used for abuse prevention, debugging, and service reliability.</li>
          <li>Strictly necessary cookies and local storage used for login/session state and basic product operation. See the <Link href="/legal/cookies">Cookie Policy</Link>.</li>
        </ul>

        <h2 id="purposes">3. Why we process it and legal basis</h2>
        <p>
          Under GDPR Article 6, each processing purpose must have a legal basis.
          Bookvella currently relies on the following bases:
        </p>
        <LegalTable
          headers={["Purpose", "Examples", "Legal basis"]}
          rows={[
            [
              <strong key="operate">Operate the service</strong>,
              "Host accounts, public booking pages, booking confirmation, cancellations, reviews, dashboards",
              "GDPR Art. 6(1)(b), performance of a contract",
            ],
            [
              <strong key="security">Security and abuse prevention</strong>,
              "Rate limiting, session security, fraud/spam prevention, IP and server logs",
              "GDPR Art. 6(1)(f), legitimate interests",
            ],
            [
              <strong key="emails">Transactional emails</strong>,
              "Verification codes, booking confirmations, cancellation notices, review invitations",
              "GDPR Art. 6(1)(b), performance of a contract",
            ],
            [
              <strong key="legal">Legal compliance</strong>,
              "Responding to lawful requests, enforcing terms, preserving evidence of misuse",
              "GDPR Art. 6(1)(c) or 6(1)(f), depending on the request",
            ],
            [
              <strong key="marketing">Marketing emails</strong>,
              "Product tips or promotional updates, if enabled later",
              "GDPR Art. 6(1)(a), consent",
            ],
          ]}
        />

        <h2 id="retention">4. How long we keep it</h2>
        <ul>
          <li><strong>Account and profile data:</strong> kept while the account exists, then deleted or anonymized after account deletion unless legally required.</li>
          <li><strong>Booking records:</strong> kept for up to 24 months for dispute handling and operational history; longer only where law requires it.</li>
          <li><strong>Uploaded images:</strong> kept while attached to an active account or service, then removed after deletion workflows complete.</li>
          <li><strong>Verification codes:</strong> short-lived and expired after use or timeout.</li>
          <li><strong>Server/security logs:</strong> normally kept for 14 to 30 days unless needed to investigate abuse or security incidents.</li>
          <li><strong>Marketing consent records:</strong> kept until withdrawn and then retained only as necessary to prove consent status.</li>
        </ul>

        <h2 id="processors">5. Processors and subprocessors</h2>
        <p>
          Bookvella uses service providers to host the app, store the database,
          deliver email, and optionally enable Google sign-in. Make sure you have
          Data Processing Agreements with every provider before production.
        </p>
        <LegalTable
          headers={["Provider", "Role", "Status"]}
          rows={[
            ["Hetzner", "Hosting/VPS infrastructure for the web app, API, database, Nginx, and deployment stack", "Production hosting provider"],
            ["Brevo", "Sends transactional emails such as verification, booking, cancellation, and review emails", "Outbound email provider"],
            ["Google", "Google Sign-In is active when configured; Google Calendar connection is planned but not currently active", "Authentication provider; calendar prepared for future use"],
            ["API upload volume", "Stores uploaded profile, cover, and service images on the API filesystem volume", "Current upload storage"],
          ]}
        />

        <h2 id="transfers">6. International transfers</h2>
        <p>
          If personal data is transferred outside the EU/EEA, Bookvella uses an
          adequacy decision, the EU-US Data Privacy Framework where applicable,
          Standard Contractual Clauses, or another lawful transfer mechanism.
          This is most relevant to Google Sign-In. Hetzner and Brevo are listed
          above as the current hosting and outbound email providers.
        </p>

        <h2 id="rights">7. Your rights</h2>
        <p>You have the right to request:</p>
        <ul>
          <li>access to your data,</li>
          <li>correction of inaccurate data,</li>
          <li>deletion of data where legally possible,</li>
          <li>restriction of processing,</li>
          <li>data portability,</li>
          <li>objection to processing based on legitimate interests,</li>
          <li>withdrawal of consent for consent-based processing.</li>
        </ul>
        <p>
          You may also complain to the data protection authority in the EU/EEA
          country where you live, work, or believe an infringement happened.
        </p>

        <h2 id="contact">8. Contact</h2>
        <p>
          Privacy requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          General contact and DSA reports: <Link href="/legal/contact">Contact / Report</Link>.
        </p>

        <p className="mt-12 text-[12px] text-[#9CA3AF]">
          Version 1.0. Last updated May 24, 2026. Effective May 24, 2026.
        </p>
      </LegalProse>
    </LegalPage>
  );
}
