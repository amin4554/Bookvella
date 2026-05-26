import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalProse, LegalTable, Toc } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Bookvella",
  description: "How Bookvella handles personal data.",
};

const CONTACT_EMAIL = "support.bookvella@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This privacy policy explains what personal data Bookvella processes while it is operated as a non-commercial student portfolio project with public access."
    >
      <Toc
        items={[
          { href: "#controller", label: "Controller" },
          { href: "#scope", label: "Project scope" },
          { href: "#data", label: "Data collected" },
          { href: "#purposes", label: "Purposes and legal basis" },
          { href: "#retention", label: "Retention" },
          { href: "#processors", label: "Processors" },
          { href: "#transfers", label: "International transfers" },
          { href: "#rights", label: "Your rights" },
          { href: "#contact", label: "Contact" },
        ]}
      />

      <LegalProse>
        <h2 id="controller">1. Controller</h2>
        <p>
          Bookvella is currently operated as a non-commercial student portfolio
          project from Berlin, Germany. Privacy requests can be sent to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Additional
          project information is available in the{" "}
          <Link href="/legal/impressum">Project Notice / Impressum</Link>.
        </p>
        <p>
          This policy is written for the current product state. If Bookvella is
          later run commercially, offers paid plans, or actively onboards real
          users, this policy should be reviewed by a lawyer and updated before
          launch.
        </p>

        <h2 id="scope">2. Project scope</h2>
        <p>
          Bookvella demonstrates booking software for independent service
          providers. It includes host accounts, public booking pages, service
          listings, availability tools, booking confirmations, guest
          verification, reviews, uploads, and optional calendar connections.
        </p>
        <p>
          Bookvella does not currently process payments, sell paid plans, run
          advertising, use analytics cookies, or broker contracts between hosts
          and guests.
        </p>

        <h2 id="data">3. Data collected</h2>
        <h3>Host account data</h3>
        <ul>
          <li>Name, email address, password hash, timezone, public slug, and login/session records.</li>
          <li>Profile details such as display name, image, cover image, headline, category, location, about text, website, Instagram, and visibility settings.</li>
          <li>Service details such as title, description, images, duration, price display, location, preparation notes, public link, visibility, and availability settings.</li>
          <li>Calendar connection metadata and encrypted provider tokens if a host connects Google or Outlook Calendar.</li>
        </ul>

        <h3>Guest booking data</h3>
        <ul>
          <li>Guest name, email address, optional phone number, optional note, timezone, selected service, selected time slot, cancellation token use, and rescheduling actions.</li>
          <li>Email verification data used to confirm bookings with one-time codes.</li>
          <li>Review content submitted after a booking, including rating, display name, comment, service reviewed, and submission time.</li>
        </ul>

        <h3>Technical and security data</h3>
        <ul>
          <li>IP address, request timestamps, browser/device metadata, server logs, rate-limit events, and error information.</li>
          <li>Strictly necessary cookies and localStorage entries used for authentication, session detection, security, and preferences. See the <Link href="/legal/cookies">Cookie Policy</Link>.</li>
        </ul>

        <h2 id="purposes">4. Purposes and legal basis</h2>
        <LegalTable
          headers={["Purpose", "Examples", "Legal basis"]}
          rows={[
            [
              <strong key="operate">Operate requested features</strong>,
              "Accounts, public booking pages, bookings, availability, cancellations, rescheduling, reviews, dashboards",
              "GDPR Art. 6(1)(b), contract or steps requested by the user",
            ],
            [
              <strong key="security">Security and abuse prevention</strong>,
              "Session security, rate limiting, CSRF protection, fraud/spam prevention, server logs",
              "GDPR Art. 6(1)(f), legitimate interests",
            ],
            [
              <strong key="emails">Transactional emails</strong>,
              "Verification codes, password reset, booking confirmation, cancellation, reschedule, review links",
              "GDPR Art. 6(1)(b), service operation requested by the user",
            ],
            [
              <strong key="calendar">Calendar sync</strong>,
              "Reading busy times and writing booking events when a host connects a calendar",
              "GDPR Art. 6(1)(a), consent, and Art. 6(1)(b), requested feature operation",
            ],
            [
              <strong key="legal">Legal and moderation handling</strong>,
              "Responding to lawful requests, investigating abuse, enforcing terms",
              "GDPR Art. 6(1)(c) or Art. 6(1)(f), depending on the situation",
            ],
          ]}
        />

        <h2 id="retention">5. Retention</h2>
        <ul>
          <li><strong>Account/profile data:</strong> kept while the account exists, then deleted or anonymized after account deletion unless retention is legally required.</li>
          <li><strong>Booking records:</strong> kept while needed for booking history, cancellation/rescheduling records, dispute handling, and project operation.</li>
          <li><strong>Verification codes:</strong> short-lived and invalid after expiry, use, or too many failed attempts.</li>
          <li><strong>Review data:</strong> kept while the related account/service exists, unless removed or hidden by the host or deleted as part of an account request.</li>
          <li><strong>Uploaded images:</strong> kept while attached to an account or service and removed when no longer needed or when deletion workflows complete.</li>
          <li><strong>Server/security logs:</strong> normally kept only as long as needed for security, debugging, and abuse prevention, unless a longer period is required for an incident.</li>
        </ul>

        <h2 id="processors">6. Service providers</h2>
        <p>
          Bookvella may use infrastructure, email, authentication, and calendar
          providers to run the project. The exact providers depend on production
          configuration.
        </p>
        <LegalTable
          headers={["Provider/category", "Role", "Data involved"]}
          rows={[
            ["Hosting/VPS provider", "Hosts the web app, API, database, uploaded files, and deployment stack", "Account, booking, log, and upload data"],
            ["SMTP/email provider", "Sends verification, password reset, booking, cancellation, rescheduling, and review emails", "Email address, message content, booking context"],
            ["Google", "Google Sign-In and optional Google Calendar connection when configured and chosen by the user", "Google identity data and calendar metadata/tokens"],
            ["Microsoft", "Optional Outlook Calendar connection when configured and chosen by the user", "Microsoft account/calendar metadata and tokens"],
          ]}
        />

        <h2 id="transfers">7. International transfers</h2>
        <p>
          If a provider processes personal data outside the EU/EEA, Bookvella
          relies on a lawful transfer mechanism such as an adequacy decision,
          the EU-US Data Privacy Framework where applicable, Standard
          Contractual Clauses, or another mechanism allowed by GDPR.
        </p>

        <h2 id="rights">8. Your rights</h2>
        <p>You may request:</p>
        <ul>
          <li>access to your personal data,</li>
          <li>correction of inaccurate data,</li>
          <li>deletion of data where legally possible,</li>
          <li>restriction of processing,</li>
          <li>data portability,</li>
          <li>objection to processing based on legitimate interests,</li>
          <li>withdrawal of consent where processing is based on consent.</li>
        </ul>
        <p>
          You may also complain to a data protection supervisory authority in
          the EU/EEA country where you live, work, or believe an infringement
          happened.
        </p>

        <h2 id="contact">9. Contact</h2>
        <p>
          Privacy requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          Abuse, security, and content reports:{" "}
          <Link href="/legal/contact">Contact / Report</Link>.
        </p>

        <p className="mt-12 text-[12px] text-[#9CA3AF]">
          Version 1.1. Last updated May 26, 2026. Effective May 26, 2026.
        </p>
      </LegalProse>
    </LegalPage>
  );
}
