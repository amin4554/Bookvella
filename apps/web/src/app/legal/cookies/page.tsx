import type { Metadata } from "next";
import Link from "next/link";
import { CookiePreferences } from "./cookie-preferences";
import { LegalPage, LegalProse, LegalTable } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy | Bookvella",
  description: "What cookies Bookvella uses and how to manage them.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      intro="What cookies Bookvella uses, why they are needed, and how to manage non-essential preferences if Bookvella adds them later."
    >
      <LegalProse>
        <h2>The short version</h2>
        <p>
          Bookvella currently uses cookies that are necessary for login, session
          security, and the booking flow. Bookvella does not currently use
          advertising cookies, retargeting pixels, or analytics cookies. If
          non-essential cookies are added later, they must stay off until you
          consent.
        </p>

        <h2>Cookies and similar technologies</h2>
        <p>
          Cookies are small pieces of data stored in your browser. Similar
          technologies, including localStorage, can also store preferences or
          session-related information. This policy covers both.
        </p>

        <h2>Cookies Bookvella sets today</h2>
        <LegalTable
          headers={["Name", "Purpose", "Duration", "Category"]}
          rows={[
            [
              <code key="session">bookvella.session</code>,
              "Non-sensitive marker used by the web app to route signed-in users to the dashboard.",
              "Session or configured auth lifetime",
              "Strictly necessary",
            ],
            [
              <code key="access">bookvella.access</code>,
              "Short-lived access token used by the API to authenticate dashboard requests.",
              "Short-lived",
              "Strictly necessary",
            ],
            [
              <code key="refresh">bookvella.refresh</code>,
              "Refresh token used to keep a host signed in without storing tokens in localStorage.",
              "Configured auth lifetime",
              "Strictly necessary",
            ],
            [
              <code key="local">localStorage user snapshot</code>,
              "Stores a public user snapshot for dashboard display only, not access or refresh tokens.",
              "Until logout or browser clearing",
              "Strictly necessary",
            ],
            [
              <code key="prefs">bv.cookiePrefs</code>,
              "Stores your non-essential cookie choices from this page.",
              "Until browser clearing",
              "Preference",
            ],
          ]}
        />

        <h2>What Bookvella does not use today</h2>
        <ul>
          <li>Analytics cookies.</li>
          <li>Advertising, retargeting, or social media pixels.</li>
          <li>Third-party embedded media cookies.</li>
          <li>Fingerprinting or cross-site tracking tools.</li>
        </ul>

        <h2>Legal basis</h2>
        <p>
          Strictly necessary cookies are used because they are needed to provide
          the service requested by the user, such as signing in or completing a
          booking. Non-essential cookies require prior, freely given, specific,
          informed, and withdrawable consent.
        </p>

        <h2>Manage cookies</h2>
        <p>
          You can clear cookies in your browser. Blocking strictly necessary
          cookies may sign you out or stop booking and dashboard features from
          working. You can also review Bookvella&apos;s data processing in the{" "}
          <Link href="/legal/privacy">Privacy Policy</Link>.
        </p>
      </LegalProse>

      <CookiePreferences />

      <p className="mt-10 text-[12px] text-[#9CA3AF]">
        Last updated May 24, 2026.
      </p>
    </LegalPage>
  );
}
