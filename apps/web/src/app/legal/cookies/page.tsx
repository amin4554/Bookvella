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
      intro="This policy explains the cookies and similar browser storage Bookvella uses while operated as a non-commercial student portfolio project."
    >
      <LegalProse>
        <h2>The short version</h2>
        <p>
          Bookvella currently uses only cookies and browser storage that are
          needed for login, session security, dashboard routing, booking flows,
          and saving your cookie preferences. Bookvella does not currently use
          advertising cookies, retargeting pixels, analytics cookies, embedded
          media cookies, or cross-site tracking tools.
        </p>

        <h2>Cookies and similar technologies</h2>
        <p>
          Cookies are small pieces of data stored in your browser. Similar
          technologies, including localStorage, can store session markers,
          profile display data, or preferences. This policy covers both.
        </p>

        <h2>Cookies Bookvella sets today</h2>
        <LegalTable
          headers={["Name", "Purpose", "Duration", "Category"]}
          rows={[
            [
              <code key="session">bookvella.session</code>,
              "Non-sensitive marker used by the web app to detect that a host is signed in and route dashboard pages.",
              "Session or configured auth lifetime",
              "Strictly necessary",
            ],
            [
              <code key="access">bookvella.access</code>,
              "Short-lived API authentication token stored as an httpOnly cookie.",
              "Short-lived",
              "Strictly necessary",
            ],
            [
              <code key="refresh">bookvella.refresh</code>,
              "Refresh token stored as an httpOnly cookie so hosts can stay signed in without storing tokens in localStorage.",
              "Session or configured auth lifetime",
              "Strictly necessary",
            ],
            [
              <code key="local">localStorage: bookvella.user</code>,
              "Stores a public user snapshot for dashboard display only. It is not used as an access token.",
              "Until logout or browser clearing",
              "Strictly necessary",
            ],
            [
              <code key="prefs">localStorage: bv.cookiePrefs</code>,
              "Stores your non-essential cookie preference choices from this page.",
              "Until browser clearing",
              "Preference",
            ],
          ]}
        />

        <h2>What Bookvella does not use today</h2>
        <ul>
          <li>Analytics cookies.</li>
          <li>Advertising, retargeting, affiliate, or social media pixels.</li>
          <li>Third-party embedded media cookies.</li>
          <li>Fingerprinting or cross-site tracking tools.</li>
        </ul>

        <h2>Legal basis</h2>
        <p>
          Strictly necessary storage is used because it is required to provide
          the feature requested by the user, such as logging in, securing a
          session, or completing a booking. Non-essential cookies or similar
          storage require consent before they are used.
        </p>

        <h2>Manage cookies</h2>
        <p>
          You can clear cookies and localStorage in your browser. Blocking
          strictly necessary cookies may sign you out or prevent booking and
          dashboard features from working. You can also read more in the{" "}
          <Link href="/legal/privacy">Privacy Policy</Link>.
        </p>
      </LegalProse>

      <CookiePreferences />

      <p className="mt-10 text-[12px] text-[#9CA3AF]">
        Last updated May 26, 2026.
      </p>
    </LegalPage>
  );
}
